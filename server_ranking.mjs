/* RANKINGS on the server (the screen is ranking_ui.mjs, opened from the Trainer card's Ranking button; /ranking in chat too).
 *
 *   GET /ranking      (public)  → { total, listas: { [list]: [{ pos, nick, tag, titulo, dex, valor, texto?, mestre? }] },
 *                                   guildas: [], premios: { [list]: title }, semana: { id, fim } }
 *   GET /ranking/eu   (token)   → { eu: { [list]: { pos, valor, texto? } }, voce: { nick, tag, dex }, mestre: { nivel }, guilda: null }
 *   GET /ranking/me   (token)   → the same (older client name)
 *
 * Lists: mestre (Master level), insignias, hall (first Elite Four win, earliest first), elite (fastest Elite Four run),
 * historia (missions), treinadores, kanto, nacional, conhecimento (Pokédex knowledge points), lendarios (legendary species),
 * shiny_capturados, shiny_caixa (shinies in party + Box), shiny_especies, and the weekly ones (sem_capturas, sem_shinies,
 * sem_selvagens, sem_raid) that reset every Monday 00:00 UTC. The week's #1 of each weekly list gets that list's
 * title (public/data/ranking.json → premios) for `diasPremio` days.
 *
 * Settings: public/data/ranking.json (admin panel → Data files → Ranking): { top, cacheSegundos, diasPremio, premios,
 * ocultos: [usernames], ocultarStaff }. Admin tab: GET /admin/ranking, POST /admin/ranking/fechar-semana. */
import fs from 'node:fs';
import nodePath from 'node:path';
import { knowledgeSummary } from './server_knowledge.mjs';

const DAY = 86400e3;
const caught = v => v === 'pego' || v === 'caught';
/** Week id = the Monday (UTC) it starts on, as YYYY-MM-DD. */
export function weekOf(t = Date.now()) {
  const d = new Date(t), day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}
const weekEnd = id => Date.parse(id + 'T00:00:00Z') + 7 * DAY;
const ddmm = t => { const d = new Date(t); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0'); };

export const LISTS = ['mestre', 'insignias', 'hall', 'elite', 'historia', 'treinadores', 'kanto', 'nacional', 'conhecimento', 'lendarios',
  'shiny_capturados', 'shiny_caixa', 'shiny_especies', 'sem_capturas', 'sem_shinies', 'sem_selvagens', 'sem_raid'];
const WEEKLY = { sem_capturas: 'capturas', sem_shinies: 'shinies', sem_selvagens: 'selvagens', sem_raid: 'raid' };
const LOWER_IS_BETTER = new Set(['hall', 'elite']);
const DEFAULTS = {
  top: 20, cacheSegundos: 30, diasPremio: 7, ocultos: [], ocultarStaff: false,
  premios: { sem_capturas: 'Catcher of the Week', sem_shinies: 'Shiny Hunter of the Week', sem_selvagens: 'Wild Battler of the Week', sem_raid: 'Raider of the Week' },
};

export function createRanking({ accounts, progression, dataDir, serverDir, saveAccounts, send, socketsOf, isBanned = () => false, logAdmin = () => {} }) {
  // ── Settings (public/data/ranking.json), re-read when the file changes ──
  const cfgFile = nodePath.join(dataDir, 'ranking.json');
  let cfgCache = { mtime: -1, cfg: DEFAULTS };
  function cfg() {
    let mt = -2;
    try { mt = fs.statSync(cfgFile).mtimeMs; } catch {}
    if (mt !== cfgCache.mtime) {
      let d = {};
      try { d = JSON.parse(fs.readFileSync(cfgFile, 'utf8')) || {}; } catch {}
      cfgCache = { mtime: mt, cfg: { ...DEFAULTS, ...d, premios: { ...DEFAULTS.premios, ...(d.premios || {}) } } };
    }
    return cfgCache.cfg;
  }
  // ── Legendary species (public/data/transform.json → lendarios) ──
  let legendary = null;
  const legendaries = () => {
    if (!legendary) { legendary = new Set(); try { for (const n of JSON.parse(fs.readFileSync(nodePath.join(dataDir, 'transform.json'), 'utf8')).lendarios || []) legendary.add(+n); } catch {} }
    return legendary;
  };
  // ── Weekly state (server/data/ranking_state.json): the current week, and past winners ──
  const stateFile = nodePath.join(serverDir, 'ranking_state.json');
  let state = { semana: weekOf(), vencedores: [] };
  try { state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; } catch {}
  const writeState = () => { try { fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state)); fs.renameSync(stateFile + '.tmp', stateFile); } catch (e) { console.warn('[ranking] state:', e.message); } };

  /** This week's tallies on the account (a tally from an older week reads as zero). */
  const weekly = (c, week = state.semana) => {
    const w = c.rankSemana;
    return w && w.semana === week ? w : { semana: week, capturas: 0, shinies: 0, selvagens: 0, raid: 0 };
  };
  function count(u, ev) {
    const c = accounts[u];
    if (!c || !ev?.conta) return;
    const add = (k, n = 1) => { const w = weekly(c); w[k] = (w[k] | 0) + n; c.rankSemana = w; dirty = true; };
    if (ev.conta === 'captura') { add('capturas'); if (ev.shiny) add('shinies'); }
    else if (ev.conta === 'ko') add('selvagens');
    else if (ev.conta === 'raidPontos') add('raid', Math.max(0, Math.round(+ev.n || 0)));
  }

  // ── The value each list ranks by, for one account (null = not on that list) ──
  function valuesOf(u, c) {
    const s = c.save || {}, mon = [...(s.time || []), ...(s.caixa || [])];
    const dex = Object.entries(s.dex || {}).filter(([n, v]) => +n >= 1 && caught(v)).map(([n]) => +n);   // no. 0 (MissingNo.) never counts
    const el = s.elite || {}, w = weekly(c), L = legendaries();
    const beaten = Array.isArray(s.treinadoresVencidos) ? s.treinadoresVencidos.length : Object.keys(s.treinadoresVencidos || {}).length;
    const v = {
      mestre: progression.masterLevel(u),
      insignias: Array.isArray(s.insignias) ? s.insignias.length : 0,
      hall: el.campeaoEm || (el.vencida ? +c.criadaEm || 1 : null),
      elite: el.melhor || null,
      historia: progression.valueOf(u, 'missoes'),
      treinadores: Math.max(progression.valueOf(u, 'treinador'), beaten),
      kanto: dex.filter(n => n >= 1 && n <= 151).length,
      nacional: dex.length,
      conhecimento: knowledgeSummary(s).points,
      lendarios: dex.filter(n => L.has(n)).length,
      shiny_capturados: progression.valueOf(u, 'shiny'),
      shiny_caixa: mon.filter(p => p?.shiny).length,
      shiny_especies: progression.valueOf(u, 'shinyEspecies'),
    };
    for (const [k, f] of Object.entries(WEEKLY)) v[k] = w[f] | 0;
    for (const k of Object.keys(v)) if (!LOWER_IS_BETTER.has(k) && !(v[k] > 0)) v[k] = null;   // zero = not on the list
    if (v.mestre <= 1) v.mestre = null;   // everyone starts at Master Level 1
    return v;
  }
  const visible = (u, c, C) => c && c.save && !isBanned(c) && !(C.ocultos || []).includes(u) && !(C.ocultarStaff && (c.gm || c.cargo));
  const who = (u, c) => ({ nick: c.save?.nome || u, tag: null, titulo: progression.titleOf(u) || '', dex: +(c.save?.time?.[0]?.dex) || 0 });

  // ── Built every `cacheSegundos` at most ──
  let built = null, builtAt = 0, dirty = false;
  function build(force = false) {
    const C = cfg();
    if (!force && built && Date.now() - builtAt < Math.max(5, +C.cacheSegundos || 30) * 1000) return built;
    const rows = [];
    for (const [u, c] of Object.entries(accounts)) if (visible(u, c, C)) rows.push({ u, c, v: valuesOf(u, c) });
    const full = {}, pos = {};
    for (const k of LISTS) {
      const asc = LOWER_IS_BETTER.has(k);
      const L = rows.filter(r => r.v[k] != null).sort((a, b) => (asc ? a.v[k] - b.v[k] : b.v[k] - a.v[k]) || a.u.localeCompare(b.u));
      let last = null, p = 0;
      pos[k] = new Map();
      full[k] = L.map((r, i) => { if (r.v[k] !== last) { p = i + 1; last = r.v[k]; } pos[k].set(r.u, p); return { r, pos: p }; });
    }
    const top = Math.max(1, Math.min(100, +C.top || 20));
    const listas = {};
    for (const k of LISTS) listas[k] = full[k].slice(0, top).map(({ r, pos: p }) => ({ pos: p, ...who(r.u, r.c), valor: r.v[k],
      ...(k === 'hall' ? { texto: ddmm(r.v[k]) } : {}), ...(k === 'mestre' ? { mestre: r.v.mestre } : {}) }));
    const premios = {};
    for (const k of Object.keys(WEEKLY)) if (C.premios?.[k]) premios[k] = C.premios[k];
    built = { total: rows.length, listas, guildas: [], premios, semana: { id: state.semana, fim: weekEnd(state.semana) }, _full: full, _pos: pos, _rows: new Map(rows.map(r => [r.u, r])) };
    builtAt = Date.now();
    return built;
  }
  const publicView = () => { const { _full, _pos, _rows, ...pub } = build(); return pub; };
  function mine(u) {
    const B = build(), c = accounts[u];
    if (!c) return null;
    const r = B._rows.get(u), v = r ? r.v : valuesOf(u, c), eu = {};
    for (const k of LISTS) {
      if (v[k] == null) { eu[k] = null; continue; }
      eu[k] = { pos: B._pos[k].get(u) || null, valor: v[k], ...(k === 'hall' ? { texto: ddmm(v[k]) } : {}) };
    }
    return { eu, voce: who(u, c), mestre: { nivel: v.mestre }, guilda: null, oculto: !r, total: B.total };
  }

  // ── Weekly close: the #1 of each weekly list gets its title for `diasPremio` days ──
  function closeWeek(by = 'auto') {
    const C = cfg(), ended = state.semana, B = build(true), days = Math.max(1, +C.diasPremio || 7), winners = [];
    for (const k of Object.keys(WEEKLY)) {
      const title = C.premios?.[k];
      for (const { r } of (B._full[k] || []).filter(x => x.pos === 1)) {
        const u = r.u, c = r.c;
        winners.push({ lista: k, u, nick: c.save?.nome || u, valor: r.v[k], titulo: title || null });
        if (!title) continue;
        if (!Array.isArray(c.titulosGanhos)) c.titulosGanhos = [];
        if (!c.titulosGanhos.includes(title)) c.titulosGanhos.push(title);
        c.titulosTemp = { ...(c.titulosTemp || {}), [title]: Date.now() + days * DAY };
        for (const w of socketsOf(u)) send(w, { t: 'sistema', texto: 'You were #1 of the week! Title earned for ' + days + ' days: ' + title });
      }
    }
    state.vencedores = [{ semana: ended, em: Date.now(), por: by, vencedores: winners }, ...(state.vencedores || [])].slice(0, 52);
    state.semana = weekOf();
    if (state.semana <= ended) state.semana = weekOf(Date.parse(ended + 'T00:00:00Z') + 7 * DAY);   // closed early by a GM: the next week starts now
    for (const c of Object.values(accounts)) if (c?.rankSemana && c.rankSemana.semana !== state.semana) delete c.rankSemana;
    writeState(); saveAccounts(); build(true);
    console.log('[ranking] week ' + ended + ' closed (' + by + '): ' + winners.map(w => w.lista + '=' + w.nick).join(', '));
    return winners;
  }
  /** Weekly titles that ran out are taken back. */
  function expireTitles() {
    const now = Date.now();
    let changed = false;
    for (const c of Object.values(accounts)) {
      if (!c?.titulosTemp) continue;
      for (const [t, until] of Object.entries(c.titulosTemp)) if (until <= now) {
        delete c.titulosTemp[t];
        if (Array.isArray(c.titulosGanhos)) c.titulosGanhos = c.titulosGanhos.filter(x => x !== t);
        if (c.progressao?.escolhido === t) c.progressao.escolhido = null;
        changed = true;
      }
      if (!Object.keys(c.titulosTemp).length) delete c.titulosTemp;
    }
    if (changed) saveAccounts();
  }
  function tick() {
    try {
      if (weekOf() > state.semana) closeWeek('auto');
      expireTitles();
      if (dirty) { dirty = false; saveAccounts(); }
    } catch (e) { console.warn('[ranking] tick:', e.message); }
  }
  setInterval(tick, 60e3).unref?.();
  tick();

  /** HTTP: true when the route was handled. `userOf(req)` reads the session token. */
  function route(rota, method, json, userOf, req) {
    if (method !== 'GET') return false;
    if (rota === '/ranking') return json(200, publicView()), true;
    if (rota === '/ranking/eu' || rota === '/ranking/me') {
      const u = userOf(req);
      if (!u) return json(401, { erro: 'Invalid session.' }), true;
      return json(200, mine(u)), true;
    }
    return false;
  }
  function adminRoute(rota, method, d, gm, json) {
    if (rota === '/admin/ranking' && method === 'GET') {
      const B = build(true), C = cfg();
      return json(200, { ok: true, cfg: C, semana: B.semana, total: B.total, listas: B.listas, vencedores: state.vencedores || [],
        temporarios: Object.entries(accounts).flatMap(([u, c]) => Object.entries(c?.titulosTemp || {}).map(([t, ate]) => ({ u, nick: c.save?.nome || u, titulo: t, ate }))) }), true;
    }
    if (rota === '/admin/ranking/fechar-semana' && method === 'POST') {
      const w = closeWeek('gm:' + gm);
      logAdmin?.(gm, 'week', 'ranking-close-week', { vencedores: w.length });
      return json(200, { ok: true, vencedores: w, semana: state.semana }), true;
    }
    if (rota === '/admin/ranking/zerar-semana' && method === 'POST') {
      for (const c of Object.values(accounts)) if (c?.rankSemana) delete c.rankSemana;
      saveAccounts(); build(true);
      logAdmin?.(gm, 'week', 'ranking-reset-week', {});
      return json(200, { ok: true }), true;
    }
    return false;
  }
  return { count, route, adminRoute, build, mine, closeWeek, weekOf };
}
