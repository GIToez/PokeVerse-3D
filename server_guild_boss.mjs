/* GUILD BOSS (Nov 7). Every guild base (room casa#<guild>) has its daily boss standing on the plateau (guilda.json base.chefe,
 * file coordinates: the world mirrors x). The rules live in guild.mjs (the Livro): which boss today (the ladder rotates by day and
 * the guild level), one entry per day, a window of `janelaS` seconds from the first hit, damage → tiers → guild fragments when the
 * day closes, the guild's daily goal (sum of everyone's damage ≥ the boss's reference HP → guild XP + guild coins in the treasury).
 * This module is the fight itself, the same way a raid boss works:
 *   the boss is a network wild in the base room's welcome (`lista(ws)`), with `raid: 'guild'` so the client draws it as a boss;
 *   the partner's hit = {t:'ataque', id} → damage counted HERE (the game's formula, the boss "fights at your level" like a raid boss,
 *   × the boss's weaknesses/resistances) → `shp` to the room; the boss hits a partner near it every `golpeMs` (pdano, a share of
 *   that Pokémon's max HP: danoMin..danoMax). The boss never faints: its bar is what's left of the guild's daily goal.
 *   Personal state to the hitter: {t:'gchefe', janelaAte, meu, faixa, total, alvo, metaOk}.
 * GM accounts: the boss shows even below the unlock level, and their window never runs out. */
import fs from 'node:fs';
import nodePath from 'node:path';
import * as G from './guild.mjs';
import * as Forms from './forms.mjs';
import { hp as hpBase, stat as statBase } from './individual.mjs';
import { efetividade } from './rules.mjs';
import { TODOS } from './moves_all.mjs';

const FLIPX = -1;
const ID_BASE = 2.5e9;                     // boss ids: not a raid boss (1e9..2e9) and never a shared-world wild
const ALCANCE = 22;                        // the boss only hits partners this close (m)
const IVS_31 = [31, 31, 31, 31, 31, 31];
const ivsDe = p => Array.isArray(p?.ivs) ? p.ivs : (p?.ivs && typeof p.ivs === 'object') ? ['hp', 'atk', 'def', 'spa', 'spd', 'vel'].map(k => +p.ivs[k] || 0) : [0, 0, 0, 0, 0, 0];
const lvDe = p => Math.max(1, Math.min(100, Math.round(+p?.lv || 5)));

export function createGuildBoss({ guilds, accounts, connections, send, socketsOf, dataPub, root, log = () => {} }) {
  const livro = guilds.livro;
  // ── game data ──────────────────────────────────────────────────────────────────────────────────────────────
  let dex = null;
  function especie(n) {
    if (!dex) {
      dex = { porN: new Map(), chart: {} };
      try { const d = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/pokedex.json'), 'utf8')); dex = { porN: new Map((d.species || []).filter(s => !s.base).map(s => [+s.n, s])), chart: d.chart || {} }; }
      catch (e) { console.warn('guild boss: pokedex.json:', e.message); }
    }
    return dex.porN.get(+n) || null;
  }
  const VAZIA = { name: '?', types: ['Normal'], bs: [50, 50, 50, 50, 50, 50] };
  let golpesCache = { mtime: -1, tab: TODOS };
  function golpes() {
    try {
      const arq = nodePath.join(dataPub, 'moves.json'), mt = fs.statSync(arq).mtimeMs;
      if (mt !== golpesCache.mtime) { const d = JSON.parse(fs.readFileSync(arq, 'utf8')); golpesCache = { mtime: mt, tab: d && Object.keys(d).length ? Object.fromEntries(Object.entries(d).map(([k, g]) => [k, { ...g, id: k }])) : TODOS }; }
    } catch { golpesCache = { mtime: -1, tab: TODOS }; }
    return golpesCache.tab;
  }
  const regras = () => G.dados()?.chefe?.regras || {};

  // ── who is where ───────────────────────────────────────────────────────────────────────────────────────────
  const naSala = sala => [...connections.values()].filter(w => w.readyState === 1 && String(w._mapa) === sala);
  const gidDaSala = sala => String(sala || '').startsWith('casa#') ? String(sala).slice(5) : null;
  const ehGm = u => !!accounts[u]?.gm;
  const monDe = (u, dica = {}) => { const t = accounts[u]?.save?.time || []; return (dica.uid != null && t.find(p => String(p?.uid) === String(dica.uid))) || (dica.dex != null && t.find(p => +p?.dex === +dica.dex)) || t[0] || null; };

  /* One boss per base room: { sala, gid, dia, degrau, id, x, z, giro, proxGolpe, golpes } — rebuilt when the day (and so the boss) changes. */
  const salas = new Map();
  function bossDa(sala, u = null) {
    const gid = gidDaSala(sala); if (!gid) return null;
    const g = livro.guilda(gid); if (!g) return null;
    const R = regras(), liberado = g.nivel >= (R.nivelMinimoGuilda || 1);
    if (!liberado && !(u && ehGm(u)) && !naSala(sala).some(w => ehGm(w._usuario))) return null;
    const c = livro._chefeDe(g), e = G.degrauDoChefe(c.degrau); if (!e) return null;
    let b = salas.get(sala);
    if (!b || b.dia !== c.dia || b.degrau !== c.degrau) {
      const velho = b;
      const p = G.dados()?.base?.chefe || { x: 28, z: -28 };
      b = { sala, gid, dia: c.dia, degrau: c.degrau, id: ID_BASE + (hashNum(gid) % 1e6) * 100 + (c.degrau % 100), x: +(FLIPX * (+p.x || 0)).toFixed(2), z: +(+p.z || 0).toFixed(2), giro: 0, proxGolpe: Date.now() + 3000, golpes: golpesDoChefe(e) };
      salas.set(sala, b);
      if (velho && velho.id !== b.id) for (const w of naSala(sala)) { send(w, { t: 'sumiu', id: velho.id, motivo: 'fugiu' }); send(w, { t: 'selvagem', s: registro(b) }); }
    }
    return b;
  }
  function hashNum(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
  function golpesDoChefe(e) {
    const tab = golpes(), S = especie(e.dex) || VAZIA;
    const meus = Object.values(tab).filter(g => g && g.cat !== 'status' && +g.poder > 0 && S.types.includes(g.tipo) && +g.poder <= 90);
    meus.sort((a, b) => b.poder - a.poder);
    const l = meus.slice(0, 3); if (tab.tackle) l.push(tab.tackle);
    return l.length ? l : [{ id: 'tackle', tipo: 'Normal', poder: 40, cat: 'fisico', anim: 'Attack' }];
  }
  /** What's left of today's goal (the boss never faints: 1 HP once the goal is reached). */
  function vida(b) {
    const g = livro.guilda(b.gid), c = g && livro._chefeDe(g), e = G.degrauDoChefe(b.degrau);
    const alvo = Math.max(1, Math.round((e?.hp || 1) * (regras().meta?.fracao ?? 1)));
    const total = c ? Object.values(c.contrib).reduce((s, v) => s + v, 0) : 0;
    return { hp: Math.max(1, alvo - total), maxHp: alvo, total, alvo };
  }
  function registro(b) {
    const e = G.degrauDoChefe(b.degrau), v = vida(b);
    return { id: b.id, dex: e.dex, glb: e.glb + '.glb', nome: e.nome, lv: e.lv, shiny: false, ivs: IVS_31, natureza: 'Serious',
      x: b.x, z: b.z, giro: b.giro, anim: 'Idle', area: null, generico: true, casa: null, perfil: 'agressivo', aquatico: false, pertoDeGrama: false,
      hp: v.hp, maxHp: v.maxHp, estado: 'vagando', dono: null, raid: 'guild', chefe: true, guildaChefe: true };
  }
  /** The welcome's extra wilds for a socket entering a base room. */
  function lista(ws) {
    const b = bossDa(String(ws._mapa || ''), ws._usuario);
    return b ? [registro(b)] : [];
  }

  // ── the partner hits the boss ───────────────────────────────────────────────────────────────────────────────
  const ultimoAviso = new Map();
  function avisar(ws, texto) {
    const u = ws._usuario || '', t = Date.now(); if (t - (ultimoAviso.get(u + texto) || 0) < 8000) return;
    ultimoAviso.set(u + texto, t); send(ws, { t: 'sistema', texto });
  }
  /** Makes sure the account has today's entry with a window that's still open. → null when it may hit, or the reason it can't. */
  function entrada(u) {
    const g = livro.guildaDe(u); if (!g) return "You're not in this guild.";
    const c = livro._chefeDe(g), hoje = G.chaveDia(Date.now()), j = c.janelas[u];
    if (c.entradas[u] === hoje && (!j || j.fim > Date.now())) return null;
    if (ehGm(u)) { c.entradas[u] = hoje; c.nEntradas[u] = 1; delete c.janelas[u]; return null; }   // GM: no level gate, no daily limit
    const r = livro.op_chefeEntrar(u);
    return r?.ok ? null : (r?.erro || "You can't fight the boss right now.");
  }
  function ataque(ws, m) {
    const sala = String(ws._mapa || ''); if (!sala.startsWith('casa#')) return false;
    const b = salas.get(sala) || bossDa(sala, ws._usuario);
    if (!b || String(m.id) !== String(b.id)) return false;
    const u = ws._usuario; if (!u || !accounts[u]) return true;
    if (livro.guildaDe(u)?.id !== b.gid) return true;
    const golpe = golpes()[String(m.golpe || '')]; if (!golpe) return true;
    const agora = Date.now(), espera = Math.max(500, (+golpe.recarga || 1.5) * 600);
    ws._gbCd = ws._gbCd || {};
    if (agora - (ws._gbCd[golpe.id] || 0) < espera || agora - (ws._gbUlt || 0) < 300) return true;
    const porque = entrada(u);
    if (porque) { avisar(ws, '⚠ ' + porque); return true; }
    ws._gbCd[golpe.id] = agora; ws._gbUlt = agora;
    const mon = monDe(u, m.atacante || {}); if (!mon) return true;
    ws._gbMon = mon;
    const e = G.degrauDoChefe(b.degrau), A = Forms.especie(especie(mon.dex), mon) || VAZIA, B = especie(e.dex) || VAZIA, lv = lvDe(mon), fis = golpe.cat === 'fisico';
    let dano = 0, eff = 1;
    if (golpe.cat !== 'status' && +golpe.poder > 0) {
      eff = efetividade(dex?.chart || {}, golpe.tipo, B.types);
      const a = statBase(A.bs[fis ? 1 : 3], lv, ivsDe(mon)[fis ? 1 : 3] || 0, 0, mon.natureza, fis ? 1 : 3), d = statBase(B.bs[fis ? 2 : 4], lv, 31, 0, null, fis ? 2 : 4);
      const base = Math.floor(((2 * lv / 5 + 2) * (+golpe.poder || 0) * a / Math.max(1, d)) / 50 + 2);
      const stab = A.types.includes(golpe.tipo) ? 1.5 : 1;
      dano = eff === 0 ? 0 : Math.max(1, Math.floor(base * stab * eff * G.fatorTipoChefe(e, golpe.tipo) * (+regras().danoMult || 1) * (0.85 + Math.random() * 0.15)));
    }
    const r = livro.chefeDano(u, dano);
    if (r?.erro) { avisar(ws, r.erro === 'window ended' ? '⏱ Your boss window for today is over. Another boss tomorrow!' : '⚠ ' + r.erro); return true; }
    guilds.gravar();
    if (ehGm(u)) { const c = livro._chefeDe(livro.guildaDe(u)); if (c.janelas[u]) c.janelas[u].fim = Math.max(c.janelas[u].fim, agora + (regras().janelaS || 120) * 1000); }
    const v = vida(b);
    for (const w of naSala(sala)) send(w, { t: 'shp', id: b.id, hp: v.hp, maxHp: v.maxHp, dano, eff, golpe: golpe.id, de: ws._id });
    const c = livro._chefeDe(livro.guildaDe(u));
    for (const w of socketsOf(u)) send(w, { t: 'gchefe', janelaAte: c.janelas[u]?.fim || 0, meu: r.meu, faixa: r.faixa, total: r.totalDia, alvo: r.meta?.alvo, metaOk: !!r.meta?.ok });
    if (r.meta?.ok && !b.metaAvisada) { b.metaAvisada = b.dia; for (const w of naSala(sala)) send(w, { t: 'sistema', texto: '🏆 Daily goal reached! ' + e.nome + ' is beaten for today: the guild gets XP and guild coins. Keep hitting for your own tier.' }); }
    return true;
  }

  // ── the boss hits back ──────────────────────────────────────────────────────────────────────────────────────
  function golpear(b) {
    const R = regras(), agora = Date.now();
    const alvos = naSala(b.sala).filter(w => w._info?.parceiro && Number.isFinite(+(w._info.px ?? w._info.x)) && Math.hypot((+(w._info.px ?? w._info.x)) - b.x, (+(w._info.pz ?? w._info.z)) - b.z) <= ALCANCE);
    b.proxGolpe = agora + Math.max(1500, (R.golpeMs || 4000) / Math.max(1, Math.sqrt(alvos.length)));
    if (!alvos.length) return;
    const w = alvos[Math.floor(Math.random() * alvos.length)], u = w._usuario;
    const mon = w._gbMon || monDe(u, { uid: w._info.uid }); if (!mon) return;
    const e = G.degrauDoChefe(b.degrau), golpe = b.golpes[Math.floor(Math.random() * b.golpes.length)];
    const D = Forms.especie(especie(mon.dex), mon) || VAZIA, eff = efetividade(dex?.chart || {}, golpe.tipo, D.types);
    const maxHp = +mon.maxHp > 0 ? +mon.maxHp : hpBase(D.bs[0], lvDe(mon), ivsDe(mon)[0] || 0);
    const lo = +R.danoMin || 0.08, hi = +R.danoMax || 0.14;
    const dano = eff === 0 ? 0 : Math.max(1, Math.round(maxHp * (lo + Math.random() * (hi - lo)) * Math.min(2, Math.max(0.5, eff))));
    const px = +(w._info.px ?? w._info.x), pz = +(w._info.pz ?? w._info.z);
    b.giro = +Math.atan2(px - b.x, pz - b.z).toFixed(3);
    const sala = b.sala, id = b.id, ainda = () => salas.get(sala)?.id === id;
    for (const o of naSala(sala)) send(o, { t: 'spos', id, x: b.x, z: b.z, giro: b.giro, anim: golpe.anim || 'Attack' });
    setTimeout(() => { if (ainda()) for (const o of naSala(sala)) send(o, { t: 'pdano', id, alvo: w._id, golpe: golpe.id, dano, eff }); }, Math.round((+golpe.atraso || 0.3) * 1000) + 250);
    setTimeout(() => { if (ainda()) for (const o of naSala(sala)) send(o, { t: 'spos', id, x: b.x, z: b.z, giro: b.giro, anim: 'Idle' }); }, 1400);
    void e;
  }
  setInterval(() => {
    try {
      const vivas = new Set();
      for (const w of connections.values()) { const s = String(w._mapa || ''); if (w.readyState === 1 && s.startsWith('casa#')) vivas.add(s); }
      for (const s of salas.keys()) if (!vivas.has(s)) salas.delete(s);
      for (const s of vivas) {
        const b = bossDa(s); if (!b) continue;
        if (Date.now() >= b.proxGolpe) golpear(b);
      }
    } catch (e) { console.warn('guild boss tick:', e.message); }
  }, 500).unref?.();

  /** After the welcome in a base room: my own window and tier, for the boss bar. */
  function aoEntrar(ws) {
    const u = ws._usuario, b = u && bossDa(String(ws._mapa || ''), u); if (!b) return;
    const g = livro.guildaDe(u); if (!g || g.id !== b.gid) return;
    const c = livro._chefeDe(g), v = vida(b), meu = c.contrib[u] || 0, j = c.janelas[u];
    send(ws, { t: 'gchefe', janelaAte: j && j.fim > Date.now() ? j.fim : 0, acabou: !!(j && j.fim <= Date.now() && !ehGm(u)), meu, total: v.total, alvo: v.alvo, metaOk: v.total >= v.alvo });
  }
  return { lista, ataque, aoEntrar, _test: { salas, bossDa, vida } };
}
