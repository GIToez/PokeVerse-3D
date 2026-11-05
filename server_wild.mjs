/**
 * Wild Pokémon for a logged-in player are rolled here, and the experience for
 * defeating one is added here. The client picks the tile and shows the model.
 * It cannot name the species, the level, or the experience total.
 *
 * A defeat pays once, for a wild this server still has listed for that account.
 * The species comes from that area's habitat for the server's time of day, the
 * real season and weekday, and the weather (calendar.mjs); the level comes from
 * that row. The amount is the same Gen 5 formula the
 * client used to apply on its own.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import nodePath from 'node:path';
import * as Ev from './ev.mjs';
import { sortearSafari } from './safari_rules.mjs';
import * as Calendario from './calendar.mjs';
import * as Weather from './weather.mjs';
import { grantLevelHp } from './server_hp.mjs';
import { aguaSoPesca } from './water_fishing.mjs';   // PokeFable's fishing-only water areas
import { expMultOf, expSharers } from './exp_items.mjs';

const FLIP_X = -1;
const LIVE_CAP = 72;
const ROLL_WINDOW_MS = 1500;
const ROLLS_PER_WINDOW = 4;
const WILD_TTL_MS = 10 * 60 * 1000;
const BOX_MARGIN = 4;
const LEVEL_CAP = [20, 26, 32, 38, 46, 52, 58, 62, 70];

function readJson(abs, fallback) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch { return fallback; }
}

function serverHour(now = Date.now()) {
  const day = 60 * 60000;
  return ((now % day) / day) * 24;
}

export function criarWilds(ctx) {
  const root = ctx.dir;
  const habitats = readJson(nodePath.join(root, 'public/data/habitats.json'), { areas: {}, generico: [] });
  /* Kanto's Safari Zone (area 1192) rolls from public/data/safari.json's four sub-areas instead of the habitat table. That file
     is in game coordinates, like the player's position. */
  const safariTab = readJson(nodePath.join(root, 'public/data/safari.json'), null);
  const SAFARI_AREA = 1192;
  function safariRow(area, water, x, z) {
    if (+area !== SAFARI_AREA || !safariTab || !Number.isFinite(+x) || !Number.isFinite(+z)) return null;
    return sortearSafari(safariTab, +x, +z, !!water);   // safari.json is in game coordinates (its polygon is at x −300…−152, where the player stands)
  }
  const expTab = readJson(nodePath.join(root, 'public/data/exp.json'), { curvas: {}, especies: {} });
  const heldTab = readJson(nodePath.join(root, 'public/data/held.json'), { itens: {} });
  Ev.usarYields(readJson(nodePath.join(root, 'public/data/ev_yields.json'), { rende: {} }));

  let cfg = { mtime: -1, nivel: {}, cap: LEVEL_CAP };
  function gameConfig() {
    const abs = nodePath.join(root, 'public/data/game_config.json');
    let mt = -1;
    try { mt = fs.statSync(abs).mtimeMs; } catch { return cfg; }
    if (mt === cfg.mtime) return cfg;
    const raw = readJson(abs, {});
    const nivel = {};
    for (const [id, band] of Object.entries(raw.nivelArea || {})) {
      if (Array.isArray(band) && band.length === 2 && band.every(n => Number.isInteger(n) && n >= 1 && n <= 100 && band[0] <= band[1])) nivel[id] = band;
    }
    const cap = Array.isArray(raw.tetoNivel) && raw.tetoNivel.length === 9 && raw.tetoNivel.every(n => Number.isInteger(n) && n >= 1 && n <= 100)
      ? raw.tetoNivel : LEVEL_CAP;
    cfg = { mtime: mt, nivel, cap };
    return cfg;
  }

  const boxCache = new Map();
  function boxes(mapa) {
    if (!/^[\w.-]{1,40}$/.test(mapa || '')) return [];
    const abs = nodePath.join(root, 'public/data', mapa + '.json');
    let mt = -1;
    try { mt = fs.statSync(abs).mtimeMs; } catch { return []; }
    const hit = boxCache.get(mapa);
    if (hit && hit.mtime === mt) return hit.boxes;
    const raw = readJson(abs, {});
    const list = (raw.caixas || []).filter(c => c && c.sx > 0 && c.sz > 0).map(c => ({
      a: c.a, x: +c.x, z: +c.z, sx: +c.sx, sz: +c.sz,
    }));
    boxCache.set(mapa, { mtime: mt, boxes: list });
    return list;
  }

  /** Same test the client uses: render X is the negation of the stored box center. */
  function areasAt(mapa, x, z, margin) {
    const found = [];
    for (const c of boxes(mapa)) {
      if (Math.abs(x - FLIP_X * c.x) <= c.sx / 2 + margin && Math.abs(z - c.z) <= c.sz / 2 + margin) found.push(c.a);
    }
    return found;
  }

  const live = new Map();
  const rolledAt = new Map();

  function book(user) {
    let m = live.get(user);
    if (!m) { m = new Map(); live.set(user, m); }
    return m;
  }

  function sweep(user) {
    const m = book(user);
    const now = Date.now();
    for (const [id, w] of m) if (now - w.at > WILD_TTL_MS) m.delete(id);
    return m;
  }

  function curveOf(dex) {
    const name = expTab.especies?.[dex]?.c || expTab.especies?.[String(dex)]?.c || 'medium';
    return expTab.curvas?.[name] || [];
  }

  function levelCap(save) {
    const { cap } = gameConfig();
    if (save?.eliteVencida) return 100;
    const n = Array.isArray(save?.insignias) ? save.insignias.length : 0;
    return cap[Math.max(0, Math.min(8, n | 0))];
  }

  /** When this roll happens. The server's own clock decides; only staff may test another hour or weather
      (/time and /weather in the chat change just their own screen, and they send it along). */
  function momento(account, msg, now) {
    const staff = !!account?.gm;
    const hour = staff && Number.isFinite(+msg.hour) ? ((+msg.hour % 24) + 24) % 24 : serverHour(now);
    const dia = Calendario.hoje(now);
    let clima = staff && 'clima' in msg ? Weather.ler(msg.clima ?? '') : undefined;
    if (clima === undefined) clima = Weather.paraHora(hour, now);
    return { hora: hour, periodo: Calendario.periodoSpawn(hour), estacao: dia.estacao, semana: dia.semana, clima: clima || null };
  }

  function rowsFor(area, water, quando) {
    // Water species swim on open water (surfing routes, lakes, the sea) like PokeFable did; only the areas in
    // water_fishing.mjs (small town and route ponds) keep their water species as a rod encounter.
    if (water && aguaSoPesca(area)) return [];
    const table = habitats.areas?.[String(area)];
    const list = Array.isArray(table) ? table : (habitats.generico || []);
    const land = e => !!e.agua === !!water;
    const models = ctx.modelos?.() || new Set();
    const hasModel = e => !models.size || models.has(e.glb);
    const now = list.filter(e => land(e) && hasModel(e) && Calendario.podeAparecer(e, quando));
    if (now.length) return now;
    // Nothing fits this time of day (a small table tied to other hours): any hour will do, but a season, weekday or
    // weather rule still holds, so a winter-only Pokémon never fills an empty summer table.
    return list.filter(e => land(e) && hasModel(e) && !e.estacoes && !e.dias && !e.climas);
  }

  function pickRow(rows) {
    let sum = 0;
    for (const e of rows) sum += e.peso || 100;
    let r = Math.random() * sum;
    for (const e of rows) { r -= e.peso || 100; if (r <= 0) return e; }
    return rows[rows.length - 1];
  }

  function levelFor(row, area) {
    const lo = +row.lvMin, hi = +row.lvMax;
    if (Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && hi >= lo && hi <= 100) {
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    const band = gameConfig().nivel[String(area)] || [3, 6];
    return band[0] + Math.floor(Math.random() * (band[1] - band[0] + 1));
  }

  function accountOf(ws) {
    const user = ws?._usuario;
    const account = user && ctx.contas?.[user];
    if (!account?.save) return null;
    return { user, account };
  }

  function roll(ws, msg) {
    const who = accountOf(ws);
    if (!who) return { t: 'wild_spawn', ok: false };
    const info = ws._info || {};
    const x = +info.x, z = +info.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { t: 'wild_spawn', ok: false };
    const here = areasAt(ws._mapa, x, z, 0);
    const near = here.length ? here : areasAt(ws._mapa, x, z, BOX_MARGIN);
    const area = +msg.area;
    if (!near.some(a => +a === area)) return { t: 'wild_spawn', ok: false };

    const now = Date.now();
    const stamps = (rolledAt.get(who.user) || []).filter(t => now - t < ROLL_WINDOW_MS);
    if (stamps.length >= ROLLS_PER_WINDOW) return { t: 'wild_spawn', ok: false };
    const owned = sweep(who.user);
    if (owned.size >= LIVE_CAP) return { t: 'wild_spawn', ok: false };

    const quando = momento(who.account, msg, now);
    const saf = safariRow(area, msg.water, x, z);
    const rows = saf ? [saf] : rowsFor(area, !!msg.water, quando);
    if (!rows.length) return { t: 'wild_spawn', ok: false };
    const row = saf || pickRow(rows);
    const lv = saf ? saf.lv : levelFor(row, area);
    const id = crypto.randomBytes(8).toString('hex');
    owned.set(id, { dex: +row.dex, lv, at: now, area });
    stamps.push(now);
    rolledAt.set(who.user, stamps);
    return {
      t: 'wild_spawn', ok: true, id, dex: +row.dex, lv,
      glb: Calendario.glbDaEstacao(row.dex, row.glb, quando.estacao), nome: row.nome, agua: row.agua ? 1 : 0,
    };
  }

  function drop(ws, msg) {
    const who = accountOf(ws);
    if (!who || typeof msg.id !== 'string') return;
    sweep(who.user).delete(msg.id);
  }

  function grant(mon, save, foeDex, foeLv, mult) {
    const base = expTab.especies?.[foeDex]?.b || expTab.especies?.[String(foeDex)]?.b || 60;
    const foe = Math.max(1, foeLv | 0);
    const self = Math.max(1, mon.lv | 0);
    let gained = Math.floor((base * foe / 5) * Math.pow((2 * foe + 10) / (foe + self + 10), 2.5) + 1);
    gained = Math.max(1, Math.round(gained * mult));
    const curve = curveOf(mon.dex);
    const cap = levelCap(save);
    if (!Number.isInteger(mon.exp)) mon.exp = curve[Math.max(1, Math.min(100, mon.lv | 0))] || 0;
    const before = mon.lv | 0 || 1;
    if (before > cap) {
      mon.expReserva = (mon.expReserva | 0) + gained;
      return { gained, banked: gained, levels: 0 };
    }
    mon.exp += gained;
    const ceiling = cap >= 100 ? Infinity : (curve[Math.min(100, cap + 1)] ?? Infinity) - 1;
    let banked = 0;
    if (Number.isFinite(ceiling) && mon.exp > ceiling) {
      banked = mon.exp - ceiling;
      mon.exp = ceiling;
      mon.expReserva = (mon.expReserva | 0) + banked;
    }
    let levels = 0;
    while ((mon.lv | 0) < cap && (mon.lv | 0) < 100 && (curve[(mon.lv | 0) + 1] ?? Infinity) <= mon.exp) {
      mon.lv = (mon.lv | 0) + 1;
      levels++;
    }
    if (levels) {
      const baseFriend = expTab.especies?.[mon.dex]?.a ?? expTab.especies?.[String(mon.dex)]?.a ?? 70;
      mon.amizade = Math.min(255, (Number.isInteger(mon.amizade) ? mon.amizade : baseFriend) + 2 * levels);
    }
    const ev = Ev.ganharPorKo(mon, foeDex);
    grantLevelHp(mon, levels);
    return { gained, banked, levels, ev: ev.ganhou };
  }

  function defeat(ws, msg) {
    const who = accountOf(ws);
    if (!who || typeof msg.id !== 'string') return null;
    const owned = sweep(who.user);
    const wild = owned.get(msg.id);
    if (!wild) return null;
    const save = who.account.save;
    const party = Array.isArray(save.time) ? save.time : [];
    const alive = p => p && p.dex != null && (p.hp == null || p.hp > 0);
    const follow = save.seguidorUid;
    let mon = follow != null ? party.find(p => alive(p) && String(p.uid) === String(follow)) : null;
    if (!mon) mon = party.find(alive);
    if (!mon) return null;
    owned.delete(msg.id);
    const mult = Math.max(0.1, Math.min(10, +ctx.expMult?.() || 1));
    const result = grant(mon, save, wild.dex, wild.lv, mult * expMultOf(mon, heldTab));
    const shared = expSharers(party, mon, heldTab).map(({ mon: p, part }) => {
      const r = grant(p, save, wild.dex, wild.lv, mult * part);
      return { uid: p.uid, nome: p.nome, lv: p.lv, exp: p.exp, expReserva: p.expReserva || 0, amizade: p.amizade, evs: p.evs, gained: r.gained, banked: r.banked, levels: r.levels, share: true };
    });
    ctx.salvarContas?.();
    ctx.aoDerrotar?.(who.user, { dex: wild.dex, lv: wild.lv, meuLv: mon.lv - (result.levels || 0), area: wild.area });
    const evText = Ev.textoGanho(result.ev);
    return {
      t: 'wild_exp',
      uid: mon.uid,
      dex: wild.dex,
      lv: mon.lv,
      exp: mon.exp,
      expReserva: mon.expReserva || 0,
      amizade: mon.amizade,
      evs: mon.evs,
      gained: result.gained,
      banked: result.banked,
      levels: result.levels,
      evText: evText || '',
      shared,
    };
  }

  /* SHARED WORLD (server_world.mjs). The world asks for one species and level at the spot a player proposed: the same
     habitat rules, area check and level cap as `roll`, but no per-player budget (the world caps each area instead). */
  function rollAt(ws, area, water, spot) {
    const who = accountOf(ws);
    if (!who) return null;
    const info = ws._info || {};
    const x = +info.x, z = +info.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const here = areasAt(ws._mapa, x, z, 0);
    const near = here.length ? here : areasAt(ws._mapa, x, z, BOX_MARGIN);
    if (!near.some(a => +a === +area)) return null;
    const quando = momento(who.account, {}, Date.now());
    const saf = safariRow(area, water, spot ? +spot.x : x, spot ? +spot.z : z);
    if (saf) return { dex: +saf.dex, lv: saf.lv, glb: saf.glb, nome: saf.nome, agua: saf.agua ? 1 : 0 };
    const rows = rowsFor(+area, !!water, quando);
    if (!rows.length) return null;
    const row = pickRow(rows);
    return { dex: +row.dex, lv: levelFor(row, +area), glb: Calendario.glbDaEstacao(row.dex, row.glb, quando.estacao), nome: row.nome, agua: row.agua ? 1 : 0 };
  }
  /** XP for a shared wild this player helped knock out: the same grant as a solo defeat (party share, EVs, level cap). */
  function award(ws, wild) {
    const who = accountOf(ws);
    if (!who) return null;
    const id = 'w' + crypto.randomBytes(6).toString('hex');
    sweep(who.user).set(id, { dex: +wild.dex, lv: +wild.lv, at: Date.now(), area: wild.area });
    return defeat(ws, { id });
  }

  /** The area this player stands in (the first one, with the same edge margin as a roll), or null. */
  function areaOf(ws) {
    const info = ws._info || {}, x = +info.x, z = +info.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const here = areasAt(ws._mapa, x, z, 0);
    const near = here.length ? here : areasAt(ws._mapa, x, z, BOX_MARGIN);
    return near.length ? +near[0] : null;
  }

  return {
    rollAt,
    areaOf,
    levelCap,
    award: (ws, wild) => {
      const out = award(ws, wild);
      if (out) ctx.enviar(ws, out);
      return out;
    },
    roll: (ws, msg) => ctx.enviar(ws, roll(ws, msg || {})),
    drop: (ws, msg) => drop(ws, msg || {}),
    defeat: (ws, msg) => {
      const out = defeat(ws, msg || {});
      if (out) ctx.enviar(ws, out);
    },
    _test: { areasAt, rowsFor, levelCap, grant },
  };
}
