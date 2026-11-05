/* SHARED WORLD: wild Pokémon that live on the server, one set per map, seen by everyone on that map.
 *
 * The client side (world.mjs, wired in index.html) has existed since September and speaks this protocol; until now our
 * bundled server answered `soloWilds: true` and every browser spawned its own wilds. This module is that missing server.
 *
 * Who decides what:
 *   - Spawning: a client proposes a spot ({t:'nascer', area, x, z, aquatico, ...}). The server checks the player really
 *     stands in that area, rolls the species and level with the same habitat rules as a solo roll (server_wild.rollAt),
 *     and fixes the individual (IVs, nature, shiny) right away, so what everyone sees is what gets caught.
 *   - Movement: each wild has an OWNER (`dono`, a connection id). The owner's game runs the wild's walking and sends
 *     `spos`; everyone else follows it smoothly. When the owner leaves the map, ownership passes to another player there.
 *   - Combat: `ataque` (a player's Pokémon hits the wild) and `sataque` (the wild hits a player's Pokémon, sent by the
 *     owner who runs the wild's AI) are computed HERE with the raid formula and the real Pokémon from the save.
 *     The wild's HP is the server's; a player's party HP stays with the client, as it does in raids.
 *   - Knockout: `sestado` desmaiado with a catch window, XP for everyone who damaged it (server_wild.award), and `sumiu`
 *     when the window closes.
 *   - Catching: `capturar` spends the ball from the account, rolls the shakes (the client's Gen III formula), builds the
 *     Pokémon from the wild's own individual and tells the room, so everyone nearby watches the throw.
 *
 * Wire tokens stay as the client expects them (selvagem, spos, shp, sestado, sumiu, scapt, pdano, dono); renaming them
 * belongs to the protocol pass that renames both ends at once. */
import fs from 'node:fs';
import nodePath from 'node:path';
import crypto from 'node:crypto';
import { hp as hpBase, stat as statBase } from './individual.mjs';
import { efetividade } from './rules.mjs';
import { TODOS } from './moves_all.mjs';
import * as Stg from './stages.mjs';

const AREA_CAP = 16;              // most wilds one area holds at once (the client's own ceiling is 16 × density)
const ROOM_CAP = 160;             // most wilds one map holds at once
const PROPOSE_GAP_MS = 250;       // one proposal per player per quarter second
const PROPOSE_RANGE = 70;         // a proposed spot must be this close (m) to the player who proposes it
const IDLE_DESPAWN_MS = 6 * 60e3; // an untouched wild leaves after this long
const FAINT_MS = 20e3;            // catch window after a knockout
const FIGHT_RANGE = 30;           // how far (m) a player can be from the wild to hit it or throw at it
const STEP_MAX = 14;              // biggest jump (m) one position update may make
const XP_WINDOW_MS = 90e3;        // damage dealt this recently earns XP on the knockout
const EMPTY_ROOM_MS = 90e3;       // a map with nobody on it is cleared after this long
const IVS_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'vel'];
const ivsOf = p => (Array.isArray(p?.ivs) ? p.ivs : p?.ivs && typeof p.ivs === 'object' ? IVS_KEYS.map(k => +p.ivs[k] || 0) : [0, 0, 0, 0, 0, 0]);
const levelOf = p => Math.max(1, Math.min(100, Math.round(+p?.lv || 5)));
const EMPTY_SPECIES = { name: '?', types: ['Normal'], bs: [50, 50, 50, 50, 50, 50], rate: 45 };
const SAFARI_BALL = 1005;
const DEFAULT_BALLS = { 1001: 1, 1002: 1.5, 1003: 2, 1004: 255, 1005: 1.5, 1006: 1, 1007: 1, 1008: 1, 1009: 1 };

export function createWorld(h) {
  const { root, dataDir, connections, send, accounts, wilds, newIndividual, markCaught, saveAccounts, gameConfig, onCatch, log = () => {} } = h;

  // ── Game data (the same files the client reads) ───────────────────────────────────────────────────────────────────
  let dex = null;
  function species(n) {
    if (!dex) {
      dex = { byN: new Map(), chart: {} };
      try {
        const d = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/pokedex.json'), 'utf8'));
        dex = { byN: new Map((d.species || []).map(s => [+s.n, s])), chart: d.chart || {} };
      } catch (e) { console.warn('world: pokedex.json:', e.message); }
    }
    return dex.byN.get(+n) || EMPTY_SPECIES;
  }
  let movesCache = { mtime: -1, table: TODOS };
  function moves() {   // the admin panel's data/moves.json wins; without it, the generated table
    try {
      const file = nodePath.join(dataDir, 'moves.json'), mt = fs.statSync(file).mtimeMs;
      if (mt !== movesCache.mtime) {
        const d = JSON.parse(fs.readFileSync(file, 'utf8'));
        movesCache = { mtime: mt, table: d && typeof d === 'object' && Object.keys(d).length ? Object.fromEntries(Object.entries(d).map(([k, g]) => [k, { ...g, id: k }])) : TODOS };
      }
    } catch { movesCache = { mtime: -1, table: TODOS }; }
    return movesCache.table;
  }
  const STRUGGLE = { id: 'struggle', tipo: 'Normal', poder: 50, cat: 'fisico', precisao: 100 };
  const moveById = id => (id === 'struggle' ? STRUGGLE : moves()[String(id || '')] || null);
  function ballRate(id) {
    const b = gameConfig()?.bolas?.[String(id)];
    if (b && typeof b === 'object' && Number.isFinite(+b.taxa)) return +b.taxa;
    if (Array.isArray(b) && Number.isFinite(+b[1])) return +b[1];
    return DEFAULT_BALLS[+id] ?? null;   // null = not a ball this game knows
  }

  // ── Rooms (one per map) ────────────────────────────────────────────────────────────────────────────────────────────
  const rooms = new Map();   // map name → { wilds: Map(id → wild), emptySince }
  const roomOf = map => {
    const key = String(map || 'kanto');
    let r = rooms.get(key);
    if (!r) rooms.set(key, (r = { wilds: new Map(), emptySince: 0 }));
    return r;
  };
  const allConnections = () => [...(typeof connections.values === 'function' ? connections.values() : connections)];
  const onMap = map => allConnections().filter(w => w.readyState === 1 && w._id != null && String(w._mapa) === String(map) && !w._raidArena);
  const toMap = (map, msg, except = null) => { for (const w of onMap(map)) if (w !== except) send(w, msg); };
  const userOf = ws => (ws._usuario && accounts[ws._usuario] ? ws._usuario : null);
  const where = ws => ({ x: +ws._info?.x, z: +ws._info?.z });
  const distTo = (ws, w) => { const p = where(ws); return Number.isFinite(p.x) && Number.isFinite(p.z) ? Math.hypot(p.x - w.x, p.z - w.z) : Infinity; };

  /** What the client gets for one wild (world.mjs `chegou`): never the server's bookkeeping. */
  function record(w) {
    return {
      id: w.id, area: w.area, dex: w.dex, glb: w.glb, nome: w.nome, lv: w.lv, shiny: w.ind.shiny, ivs: w.ind.ivs, natureza: w.ind.natureza,
      x: w.x, z: w.z, giro: w.giro, anim: w.anim, casa: w.casa, generico: w.generico, perfil: w.perfil, aquatico: w.aquatico,
      pertoDeGrama: w.pertoDeGrama, hp: w.hp, maxHp: w.maxHp, estado: w.state, ...(w.until ? { ate: w.until } : {}), dono: w.owner,
    };
  }
  /** The wilds a player joining `map` should see (the welcome's `selvagens`). */
  function list(map) {
    const r = rooms.get(String(map || 'kanto'));
    return r ? [...r.wilds.values()].filter(w => w.state !== 'gone').map(record) : [];
  }

  function remove(map, w, reason) {
    const r = roomOf(map);
    if (!r.wilds.delete(w.id)) return;
    clearTimeout(w.timer);
    w.state = 'gone';
    toMap(map, { t: 'sumiu', id: w.id, motivo: reason });
  }

  // ── Spawning ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function propose(ws, m) {
    const u = userOf(ws);
    if (!u) return;
    const now = Date.now();
    if (now - (ws._worldProposedAt || 0) < PROPOSE_GAP_MS) return;
    ws._worldProposedAt = now;
    const x = +m.x, z = +m.z, area = +m.area;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isInteger(area)) return;
    const me = where(ws);
    if (!(Math.hypot(me.x - x, me.z - z) <= PROPOSE_RANGE)) return;
    const room = roomOf(ws._mapa);
    if (room.wilds.size >= ROOM_CAP) return;
    let inArea = 0;
    for (const w of room.wilds.values()) if (w.area === area && w.state !== 'gone') inArea++;
    if (inArea >= AREA_CAP) return;
    const rolled = wilds.rollAt(ws, area, !!m.aquatico);   // area check + habitat roll + level cap, the solo rules
    if (!rolled) return;
    const S = species(rolled.dex);
    const ind = newIndividual({ dex: rolled.dex, nome: rolled.nome, glb: rolled.glb, lv: rolled.lv });
    const maxHp = Math.max(1, hpBase(S.bs[0], rolled.lv, ivsOf(ind)[0] || 0));
    const w = {
      id: crypto.randomBytes(6).toString('hex'), area, dex: rolled.dex, glb: rolled.glb, nome: rolled.nome, lv: rolled.lv, ind,
      x: +x.toFixed(2), z: +z.toFixed(2), giro: 0, anim: 'Idle', casa: m.casa && typeof m.casa === 'object' ? { x: +m.casa.x || 0, z: +m.casa.z || 0, livre: !!m.casa.livre } : null,
      generico: !!m.generico, perfil: rolled.agua ? 'arisco' : typeof m.perfil === 'string' ? m.perfil.slice(0, 16) : null, aquatico: !!rolled.agua,
      pertoDeGrama: !!m.pertoDeGrama, hp: maxHp, maxHp, state: 'vagando', until: 0, owner: ws._id, touched: now,
      damage: new Map(),   // user → { dealt, at }
      cooldowns: new Map(), lastHit: 0, catcher: null, timer: null, est: null,
    };
    room.wilds.set(w.id, w);
    toMap(ws._mapa, { t: 'selvagem', s: record(w) });
  }

  // ── Movement (from the owner only) ─────────────────────────────────────────────────────────────────────────────────
  function position(ws, m) {
    const w = roomOf(ws._mapa).wilds.get(String(m.id));
    if (!w || w.owner !== ws._id || w.state !== 'vagando') return;
    const x = +m.x, z = +m.z;
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x - w.x, z - w.z) > STEP_MAX) return;
    w.x = +x.toFixed(2); w.z = +z.toFixed(2);
    w.giro = Number.isFinite(+m.giro) ? +(+m.giro).toFixed(3) : w.giro;
    w.anim = typeof m.anim === 'string' ? m.anim.slice(0, 24) : 'Idle';
    toMap(ws._mapa, { t: 'spos', id: w.id, x: w.x, z: w.z, giro: w.giro, anim: w.anim }, ws);
  }

  // ── Combat ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The player's Pokémon in the field: the uid the client names, else the first with that species, else the first in
      the party. Level, IVs and nature always come from the save (the client only points at which one). */
  function fieldMon(u, hint = {}) {
    const party = accounts[u]?.save?.time || [];
    const alive = p => p && p.dex != null;
    return (hint.uid != null && party.find(p => alive(p) && String(p.uid) === String(hint.uid)))
      || (hint.dex != null && party.find(p => alive(p) && +p.dex === +hint.dex)) || party.find(alive) || null;
  }
  const statOf = (S, p, i) => statBase(S.bs[i], levelOf(p), ivsOf(p)[i] || 0, 0, p?.natureza, i);
  /** The raid formula, which is the client's `golpear`: STAB 1.5, type chart, 85–100 %. */
  function damage(move, lv, A, atk, D, def) {
    const eff = efetividade(dex?.chart || {}, move.tipo, D.types);
    const stab = A.types.includes(move.tipo) ? 1.5 : 1;
    const base = Math.floor(((2 * lv / 5 + 2) * (+move.poder || 0) * atk / Math.max(1, def)) / 50 + 2);
    return { eff, dano: eff === 0 ? 0 : Math.max(1, Math.floor(base * stab * eff * (0.85 + Math.random() * 0.15))) };
  }

  function attack(ws, m) {
    const u = userOf(ws);
    if (!u) return;
    const map = ws._mapa, w = roomOf(map).wilds.get(String(m.id));
    if (!w || w.state !== 'vagando' || distTo(ws, w) > FIGHT_RANGE) return;
    const move = moveById(m.golpe);
    if (!move) return;
    const now = Date.now(), gap = Math.max(450, (+move.recarga || 1.5) * 600);   // 60 % of the move's cooldown, as in raids
    const key = u + ':' + move.id;
    if (now - (w.cooldowns.get(key) || 0) < gap || now - (ws._worldLastHit || 0) < 300) return;
    w.cooldowns.set(key, now); ws._worldLastHit = now;
    const mon = fieldMon(u, m.atacante || {});
    if (!mon) return;
    w.touched = now;
    if (w.owner == null || !onMap(map).some(x => x._id === w.owner)) setOwner(map, w, ws._id);
    const A = species(mon.dex), B = species(w.dex), lv = levelOf(mon), physical = move.cat === 'fisico';
    if (Math.random() > Stg.chance(1, move, null, w.est)) {
      toMap(map, { t: 'shp', id: w.id, hp: w.hp, dano: 0, eff: 1, golpe: move.id, de: ws._id, errou: true });
      return;
    }
    const { dano, eff } = move.cat === 'status' ? { dano: 0, eff: 1 }
      : damage(move, lv, A, statOf(A, mon, physical ? 1 : 3), B, statBase(B.bs[physical ? 2 : 4], w.lv, ivsOf(w.ind)[physical ? 2 : 4] || 0, 0, w.ind.natureza, physical ? 2 : 4));
    w.hp = Math.max(0, w.hp - dano);
    const d = w.damage.get(u) || { dealt: 0, at: 0, ws: null };
    d.dealt += dano; d.at = now; d.ws = ws;
    w.damage.set(u, d);
    toMap(map, { t: 'shp', id: w.id, hp: w.hp, dano, eff, golpe: move.id, de: ws._id });
    if (w.hp <= 0) knockOut(map, w);
  }

  /** The wild hits a player's Pokémon. Sent by the owner, whose game runs the wild's AI; damage is computed here. */
  function wildAttack(ws, m) {
    const map = ws._mapa, w = roomOf(map).wilds.get(String(m.id));
    if (!w || w.owner !== ws._id || w.state !== 'vagando') return;
    const now = Date.now();
    if (now - w.lastHit < 900) return;
    const target = m.alvo == null ? ws : onMap(map).find(x => x._id === m.alvo);
    if (!target || distTo(target, w) > FIGHT_RANGE) return;
    const u = userOf(target);
    const mon = u ? fieldMon(u, m.defensor || {}) : null;
    if (!mon) return;
    const learned = moves();
    let move = moveById(m.golpe);
    if (!move || move.cat === 'status') move = learned.tackle || STRUGGLE;
    w.lastHit = now; w.touched = now;
    const B = species(w.dex), D = species(mon.dex), physical = move.cat === 'fisico';
    const missed = Math.random() > Stg.chance(1, move, w.est, null);
    const { dano, eff } = missed ? { dano: 0, eff: 1 }
      : damage(move, w.lv, B, statBase(B.bs[physical ? 1 : 3], w.lv, ivsOf(w.ind)[physical ? 1 : 3] || 0, 0, w.ind.natureza, physical ? 1 : 3), D, statOf(D, mon, physical ? 2 : 4));
    // no uid/hp: the Pokémon in the field takes it, and party HP is the client's (as in raids)
    toMap(map, { t: 'pdano', id: w.id, alvo: target._id, golpe: move.id, dano, eff, ...(missed ? { errou: true } : {}) });
  }

  /** A client-side tick (burn, poison) lowered the wild's HP: accept small drops from players fighting it. */
  function clientHp(ws, m) {
    const u = userOf(ws), map = ws._mapa, w = roomOf(map).wilds.get(String(m.id));
    if (!u || !w || w.state !== 'vagando' || !w.damage.has(u)) return;
    const hp = Math.round(+m.hp);
    if (!Number.isFinite(hp) || hp >= w.hp || w.hp - hp > Math.ceil(w.maxHp / 8)) return;
    w.hp = Math.max(0, hp);
    toMap(map, { t: 'shp', id: w.id, hp: w.hp }, ws);
    if (w.hp <= 0) knockOut(map, w);
  }

  function knockOut(map, w) {
    const now = Date.now();
    w.state = 'desmaiado'; w.hp = 0; w.until = now + FAINT_MS;
    toMap(map, { t: 'sestado', id: w.id, estado: 'desmaiado', ate: w.until, hp: 0 });
    for (const [, d] of w.damage) if (now - d.at < XP_WINDOW_MS && d.ws?.readyState === 1) wilds.award(d.ws, w);
    clearTimeout(w.timer);
    w.timer = setTimeout(() => { if (w.state === 'desmaiado') remove(map, w, 'morreu'); }, FAINT_MS);
  }

  // ── Catching ───────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Shakes (0–4), the client's sortearCaptura: Gen III with the ball's bonus. 4 = caught. */
  function shakes(w, bonus) {
    const rate = species(w.dex).rate || 45;
    const a = ((3 * w.maxHp - 2 * Math.max(0, w.hp)) * rate * bonus) / (3 * w.maxHp);
    if (a >= 255) return 4;
    const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
    let n = 0;
    while (n < 4 && Math.random() * 65536 < b) n++;
    return n;
  }
  function ballBonus(id, w, u) {
    const base = ballRate(id) || 1, save = accounts[u]?.save || {};
    if (+id === 1006) {   // Level Ball
      const mine = levelOf(fieldMon(u)), foe = w.lv;
      return mine >= foe * 4 ? 8 : mine >= foe * 2 ? 4 : mine > foe ? 2 : 1;
    }
    if (+id === 1007) { const t = species(w.dex).types || []; return t.includes('Bug') || t.includes('Water') ? 3.5 : 1; }   // Net Ball
    if (+id === 1008) return Math.max(1, (41 - w.lv) / 10);                                                                // Nest Ball
    if (+id === 1009) { const s = save.dex?.[w.dex]; return s === 'pego' || s === 'caught' ? 3 : 1; }                       // Repeat Ball
    return base;
  }
  function capture(ws, m) {
    const reply = o => send(ws, { t: 'scapt', id: String(m.id), ...o });
    const u = userOf(ws), map = ws._mapa;
    if (!u) return reply({ ok: false, chac: 0, erro: 'conta' });
    const w = roomOf(map).wilds.get(String(m.id));
    if (!w) return reply({ ok: false, chac: 0, erro: 'sumiu' });
    if (w.state === 'capturando') return reply({ ok: false, chac: 0, erro: 'outro' });
    if (w.state !== 'desmaiado') return reply({ ok: false, chac: 0, erro: 'acordado' });
    if (distTo(ws, w) > FIGHT_RANGE) return reply({ ok: false, chac: 0, erro: 'longe' });
    const ball = String(m.bola || 1001);
    if (ballRate(ball) == null) return reply({ ok: false, chac: 0, erro: 'bola' });
    const c = accounts[u], save = c.save || (c.save = {});
    if (!save.bolas || typeof save.bolas !== 'object') save.bolas = {};
    const safariBall = +ball === SAFARI_BALL;   // Safari Balls belong to the Safari visit, which the client keeps, not to the bag
    if (!safariBall && !((save.bolas[ball] | 0) > 0)) return reply({ ok: false, chac: 0, erro: 'sem-bola' });
    if (!safariBall) save.bolas[ball] = (save.bolas[ball] | 0) - 1;   // the ball is spent on every valid throw, caught or not
    const n = shakes(w, ballBonus(ball, w, u));
    w.state = 'capturando'; w.catcher = ws._id;
    clearTimeout(w.timer);
    toMap(map, { t: 'sestado', id: w.id, estado: 'capturando', porId: ws._id, bola: +ball, chac: n }, ws);
    const bag = { dinheiro: save.dinheiro ?? 0, itens: save.itens || {}, bolas: save.bolas };
    // the throw plays for ~3.5 s plus ~0.7 s per shake on everyone's screen; settle the wild after that
    const settleMs = 3500 + Math.max(1, n) * 700 + 400;
    if (n >= 4) {
      if (!Array.isArray(save.time)) save.time = [];
      if (!Array.isArray(save.caixa)) save.caixa = [];
      const pk = { ...w.ind, dex: w.dex, nome: w.nome, glb: w.glb, lv: w.lv };
      if (save.time.length < 6) save.time.push(pk); else save.caixa.push(pk);
      markCaught(c, pk.dex);
      c.rev = (c.rev || 0) + 1;
      saveAccounts();
      reply({ ok: true, chac: n, mon: pk, vidas: save.time, bolsa: bag });
      try { onCatch?.(ws, u, pk, +ball, !!w.aquatico); } catch (e) { console.warn('world: onCatch', e); }
      w.timer = setTimeout(() => remove(map, w, 'capturado'), settleMs);
      log('catch', u, pk.dex, pk.lv, pk.shiny ? 'shiny' : '');
    } else {
      saveAccounts();
      reply({ ok: false, chac: n, bolsa: bag });
      w.timer = setTimeout(() => {
        if (w.state !== 'capturando') return;
        w.state = 'desmaiado'; w.catcher = null; w.until = Date.now() + FAINT_MS / 2;   // broke free: a shorter second window
        toMap(map, { t: 'sestado', id: w.id, estado: 'desmaiado', ate: w.until, hp: 0 });
        w.timer = setTimeout(() => { if (w.state === 'desmaiado') remove(map, w, 'morreu'); }, FAINT_MS / 2);
      }, settleMs);
    }
  }

  // ── Ownership and housekeeping ─────────────────────────────────────────────────────────────────────────────────────
  function setOwner(map, w, id) {
    if (w.owner === id) return;
    w.owner = id;
    toMap(map, { t: 'dono', id: w.id, dono: id });
  }
  /** A player left a map (closed the tab, went through a door): their wilds go to the nearest player still there. */
  function left(ws, map = ws._mapa) {
    const room = rooms.get(String(map || 'kanto'));
    if (!room) return;
    const others = onMap(map).filter(x => x !== ws);
    for (const w of room.wilds.values()) {
      if (w.owner !== ws._id) continue;
      if (!others.length) { w.owner = null; continue; }
      const next = others.reduce((a, b) => (distTo(a, w) <= distTo(b, w) ? a : b));
      setOwner(map, w, next._id);
    }
  }
  /** A player joined a map: wilds nobody owns go to them. */
  function joined(ws) {
    const room = rooms.get(String(ws._mapa || 'kanto'));
    if (!room) return;
    for (const w of room.wilds.values()) if (w.owner == null && w.state === 'vagando') setOwner(ws._mapa, w, ws._id);
  }
  setInterval(() => {
    const now = Date.now();
    for (const [map, room] of rooms) {
      const here = onMap(map).length;
      if (!here) {
        if (!room.emptySince) room.emptySince = now;
        else if (now - room.emptySince > EMPTY_ROOM_MS) { for (const w of room.wilds.values()) clearTimeout(w.timer); rooms.delete(map); }
        continue;
      }
      room.emptySince = 0;
      for (const w of [...room.wilds.values()]) if (w.state === 'vagando' && now - w.touched > IDLE_DESPAWN_MS) remove(map, w, 'fugiu');
    }
  }, 15e3).unref?.();

  function receive(ws, m) {
    switch (m.t) {
      case 'nascer': return propose(ws, m);
      case 'spos': return position(ws, m);
      case 'ataque': return attack(ws, m);
      case 'sataque': return wildAttack(ws, m);
      case 'shp': return clientHp(ws, m);
      case 'capturar': return capture(ws, m);
    }
  }
  const stats = () => ({ maps: rooms.size, wilds: [...rooms.values()].reduce((n, r) => n + r.wilds.size, 0) });
  return { receive, list, joined, left, stats, _test: { shakes, rooms } };
}
