/* MASS OUTBREAKS (Nov 7) — every so often one route fills up with a single species for a while, with better shiny odds, and the
 * whole map is told where. Settings: public/data/outbreaks.json (admin → Data files → Mass outbreaks); the admin page
 * "🌟 Mass outbreaks" shows the current one and can start or end one by hand.
 *  - one at a time, `esperaMin` minutes after the last one ends (only while someone is on the map), lasting `duracaoMin`;
 *  - the area: a route (or `areas`) with land species; the species: one of that area's own (or `especies`, if listed);
 *  - in that area `parte` of the wild spawns are the outbreak species (the area's own level range), and each one's shiny odds
 *    are multiplied by `shinyMult`.
 * Hooks: server_world.mjs asks `rolar(map, area, water)` on every spawn roll there; `bonusShiny()` for the extra shiny chance. */
import fs from 'node:fs';
import nodePath from 'node:path';

export const PADRAO = { ligado: true, mapa: 'kanto', esperaMin: 90, duracaoMin: 45, parte: 0.6, shinyMult: 8, areas: [], especies: [], anunciar: true };

export function createOutbreaks({ dataDir, habitats, onMap, send, taxaShiny, areaName, nomeDe = () => null, clearArea = () => 0, log = () => {} }) {
  let cache = { t: 0, d: PADRAO };
  const cfg = () => {
    if (Date.now() - cache.t > 20e3) { let d = {}; try { d = JSON.parse(fs.readFileSync(nodePath.join(dataDir, 'outbreaks.json'), 'utf8')); } catch {} cache = { t: Date.now(), d: { ...PADRAO, ...d } }; }
    return cache.d;
  };
  let atual = null, ultimoFim = Date.now() - 60e3 * 60;   // the first one can come an hour after a restart at the earliest… unless the wait is shorter

  const linhasDe = area => (habitats()?.areas?.[String(area)] || []).filter(e => !e.agua && +e.dex > 0);
  function areasPossiveis() {
    const C = cfg(), H = habitats()?.areas || {};
    const base = (Array.isArray(C.areas) && C.areas.length ? C.areas : Object.keys(H).filter(a => +a >= 1200 && +a < 1300 || +a === 1191)).map(Number);
    return base.filter(a => linhasDe(a).length || (C.especies || []).length);
  }
  function anunciar(texto, vars) {
    if (!cfg().anunciar) return;
    for (const ws of onMap(cfg().mapa || 'kanto')) send(ws, { t: 'sistema', texto, vars });
  }
  /** Starts one now. `area` / `dex` pick it (admin); otherwise random. */
  function comecar({ area = null, dex = null, minutos = null } = {}) {
    const C = cfg(), L = areasPossiveis();
    const a = area && (linhasDe(area).length || (C.especies || []).length) ? +area : L[Math.floor(Math.random() * L.length)];
    if (!a) return { erro: 'No area with wild Pokémon to fill.' };
    const proprias = linhasDe(a);
    const lista = (C.especies || []).length ? (C.especies || []).map(d => proprias.find(e => +e.dex === +d) || { dex: +d, nome: null, glb: 'pm' + String(d).padStart(4, '0') + '_00.glb' }) : proprias;
    const linha = dex ? lista.find(e => +e.dex === +dex) || proprias.find(e => +e.dex === +dex) || { dex: +dex, nome: null, glb: 'pm' + String(dex).padStart(4, '0') + '_00.glb' } : lista[Math.floor(Math.random() * lista.length)];
    if (!linha) return { erro: 'No species for that area.' };
    const dur = (Number.isFinite(+minutos) && +minutos > 0 ? +minutos : C.duracaoMin || 45) * 60e3;
    atual = { area: a, areaNome: areaName(a), dex: +linha.dex, nome: linha.nome || nomeDe(+linha.dex) || ('#' + linha.dex), glb: linha.glb, linha, inicio: Date.now(), fim: Date.now() + dur, mapa: C.mapa || 'kanto' };
    const limpos = clearArea(atual.mapa, a);   // the area's idle wilds leave, so it refills with the outbreak right away
    log('outbreak', atual.nome, 'on', atual.areaNome, Math.round(dur / 60e3), 'min', limpos ? '(cleared ' + limpos + ')' : '');
    anunciar('🌟 Mass outbreak! Lots of {nome} are appearing on {area} for the next {min} minutes, and shinies are {mult}× as likely!', { nome: atual.nome, area: atual.areaNome, min: Math.round(dur / 60e3), mult: C.shinyMult || 8 });
    return { ok: true, atual: estado().atual };
  }
  function encerrar(motivo = 'fim') {
    if (!atual) return { ok: true };
    const a = atual; atual = null; ultimoFim = Date.now();
    log('outbreak', 'ended', a.nome, motivo);
    anunciar('The {nome} outbreak on {area} has ended.', { nome: a.nome, area: a.areaNome });
    return { ok: true };
  }
  setInterval(() => {
    const C = cfg();
    if (atual && Date.now() > atual.fim) encerrar();
    if (!atual && C.ligado && Date.now() - ultimoFim > (C.esperaMin || 90) * 60e3 && onMap(C.mapa || 'kanto').length) comecar();
  }, 15e3).unref?.();

  /** On a spawn roll in an area: the outbreak species instead, `parte` of the time. Returns the habitat row to use, or null. */
  function rolar(map, area, water) {
    if (!atual || water || String(map || 'kanto') !== String(atual.mapa) || +area !== +atual.area || Date.now() > atual.fim) return null;
    return Math.random() < (+cfg().parte || 0.6) ? { ...atual.linha, nome: atual.linha.nome || atual.nome, surto: true } : null;
  }
  /** Extra shiny chance for an outbreak Pokémon, on top of the normal roll: (mult − 1) / rate. */
  const bonusShiny = () => Math.max(0, ((+cfg().shinyMult || 8) - 1) / Math.max(1, taxaShiny()));
  function estado() {
    const C = cfg();
    return { config: C, atual: atual ? { area: atual.area, areaNome: atual.areaNome, dex: atual.dex, nome: atual.nome, inicio: atual.inicio, fim: atual.fim } : null,
      proximoEm: atual ? null : ultimoFim + (C.esperaMin || 90) * 60e3, agora: Date.now(),
      areas: areasPossiveis().map(a => ({ a, nome: areaName(a), especies: linhasDe(a).map(e => ({ dex: +e.dex, nome: e.nome })) })) };
  }
  function adminRoute(rota, method, d, gm, json) {
    if (rota === '/admin/surtos' && method === 'GET') return json(200, { ok: true, ...estado() }), true;
    if (rota === '/admin/surtos/comecar' && method === 'POST') {
      if (atual) encerrar('trocado');
      const r = comecar({ area: d.area ? +d.area : null, dex: d.dex ? +d.dex : null, minutos: d.minutos });
      if (r.erro) return json(400, r), true;
      log('outbreak', 'started by', gm);
      return json(200, { ok: true, ...estado() }), true;
    }
    if (rota === '/admin/surtos/encerrar' && method === 'POST') { encerrar('admin'); return json(200, { ok: true, ...estado() }), true; }
    return false;
  }
  /** What a player joining the map is told (an outbreak in progress). */
  function aoEntrar(ws) {
    if (!atual || String(ws._mapa || 'kanto') !== String(atual.mapa)) return;
    send(ws, { t: 'sistema', texto: '🌟 Mass outbreak on {area}: lots of {nome} for {min} more minutes!', vars: { area: atual.areaNome, nome: atual.nome, min: Math.max(1, Math.round((atual.fim - Date.now()) / 60e3)) } });
  }
  return { rolar, bonusShiny, adminRoute, estado, aoEntrar, comecar, encerrar };
}
