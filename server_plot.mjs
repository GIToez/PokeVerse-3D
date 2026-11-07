/* PERSONAL PLOTS (Nov 7). Every account owns a private copy of the Habitat map (scene 1000002): its room is `habitat#<16 hex>`,
 * so only the owner and their visitors are in it. The buildings and the items placed on it follow public/data/colocacao.json
 * (lugar `casa`), checked by placement.mjs — the same rules the client's arrange screens use.
 *   socket { t: 'terreno', op, rid, ... }:
 *     ir { dono? }   go to my plot, or visit someone's (dono = their trainer name) → terreno_ir { mapa, sala, dono }
 *     sair           back where I was before → terreno_voltar { mapa, chegada? }
 *     vista          the plot's view (placement.mjs vista + sala, dono, minha, nivel, construidas, visitas)
 *     colocar / mover / remover { vaga|id, x, z, giro, item? }   owner only, inside the plot
 *     construir { vaga }   build the next building (Coins; needs the home level)  ·  visitas { quem }   who may visit
 *   the plot (stored on the account): save.terreno = { lugar: 'casa', colocacoes, guardadas, construidas, nivel, visitas }
 *   home level = 1 + buildings built (the nest comes free; each building needs the level in colocacao.json and costs its Coins).
 * Joining the scene: server.mjs asks salaDe(u) when an account enters 1000002 — the plot they were heading to, else their own. */
import fs from 'node:fs';
import nodePath from 'node:path';
import crypto from 'node:crypto';
import * as C from './placement.mjs';

export const CENA = '1000002';
export const RE_SALA = /^habitat#[0-9a-f]{16}$/;

export function createPlots({ dataPub, accounts, send, socketsOf, saveAccounts, salaDoSocket, levar, pontoSeguro = () => null, amigos = () => [], mesmaGuilda = () => false, gm = u => !!accounts[u]?.gm, log = () => {} }) {
  let mtime = -1;
  const dados = () => {
    try {
      const arq = nodePath.join(dataPub, 'colocacao.json'), mt = fs.statSync(arq).mtimeMs;
      if (mt !== mtime) { C.usarDados(JSON.parse(fs.readFileSync(arq, 'utf8'))); mtime = mt; }
    } catch (e) { if (mtime === -1) throw e; }
    return C.dados();
  };
  dados();
  const T = () => C.terrenoDe('casa');

  const salaDe = u => 'habitat#' + crypto.createHash('sha1').update('plot:' + u).digest('hex').slice(0, 16);
  const donoDaSala = new Map();                                                // sala → account (filled as plots are used)
  const nick = u => accounts[u]?.save?.nome || u;
  function porNick(n) {
    const k = String(n || '').trim().toLowerCase(); if (!k) return null;
    for (const [u, c] of Object.entries(accounts)) if (String(c?.save?.nome || u).toLowerCase() === k || u.toLowerCase() === k) return u;
    return null;
  }

  function estado(u) {
    const s = accounts[u]?.save; if (!s) return null;
    let t = s.terreno;
    if (!t || typeof t !== 'object') t = s.terreno = { lugar: 'casa', colocacoes: [], guardadas: [], construidas: {}, visitas: 'amigos' };
    t.lugar = 'casa';
    if (!t.construidas || typeof t.construidas !== 'object') t.construidas = {};
    if (!t.construidas.ninho) t.construidas.ninho = 1;                        // the Companion nest comes with the plot (level 1, free)
    if (!Array.isArray(t.colocacoes)) t.colocacoes = [];
    if (!Array.isArray(t.guardadas)) t.guardadas = [];
    if (!['ninguem', 'amigos', 'guilda', 'todos'].includes(t.visitas)) t.visitas = 'amigos';
    t.nivel = 1 + Object.keys(t.construidas).filter(k => +t.construidas[k] >= 1).length;   // 2 with just the nest, +1 per building: each unlocks the next
    donoDaSala.set(salaDe(u), u);
    return t;
  }
  const naSala = (ws, u) => salaDoSocket(ws) === salaDe(u);

  /** Can `v` visit `u`'s plot? */
  function podeVisitar(v, u) {
    if (v === u || gm(v)) return true;
    const t = estado(u); if (!t) return false;
    if (t.visitas === 'todos') return true;
    if (t.visitas === 'ninguem') return false;
    const amigo = (amigos(u) || []).includes(v);
    if (t.visitas === 'amigos') return amigo || mesmaGuilda(u, v);
    if (t.visitas === 'guilda') return mesmaGuilda(u, v);
    return false;
  }

  function vista(u, quem = u) {
    const t = estado(u); if (!t) return null;
    const v = C.vista(t, { nick }) || {};
    const prox = Object.entries(T()?.vagas || {}).filter(([k, x]) => x.tipo === 'construcao' && !t.construidas[k])
      .map(([k, x]) => ({ vaga: k, nome: x.nome, nivel: x.niveis?.[0]?.nivel || 1, custo: x.niveis?.[0]?.custo || 0 }));
    return { ...v, sala: salaDe(u), dono: nick(u), minha: quem === u, papel: quem === u ? 'dono' : null, nivel: t.nivel, construidas: { ...t.construidas },
      visitas: quem === u ? t.visitas : undefined, construir: quem === u ? prox : undefined };
  }
  /** Everyone in that plot gets the new view (the owner arranging it while friends watch). */
  function empurrar(u, conexoes) {
    const sala = salaDe(u);
    for (const ws of conexoes()) if (salaDoSocket(ws) === sala && ws._usuario) send(ws, { t: 'terreno', vista: vista(u, ws._usuario) });
  }

  // where each account is heading (set by `ir`, read once when they enter the scene)
  const indo = new Map();
  /** A new building shows after the scene reloads: everyone in that plot reloads where they stand (and stays in it). */
  function recarregarSala(dono, conexoes, texto) {
    const sala = salaDe(dono);
    for (const w of conexoes()) {
      if (salaDoSocket(w) !== sala || !w._usuario || !Number.isFinite(+w._info?.x)) continue;
      indo.set(w._usuario, { dono, em: Date.now() });
      levar(w._usuario, { mapa: CENA, x: +w._info.x, z: +w._info.z, giro: +w._info.giro || 0 }, texto);
    }
  }
  /** The room an account gets when it enters the Habitat scene. */
  function salaAoEntrar(u) {
    const x = indo.get(u);
    if (x && Date.now() - x.em < 120e3 && accounts[x.dono] && podeVisitar(u, x.dono)) { estado(x.dono); return salaDe(x.dono); }
    estado(u);
    return salaDe(u);
  }

  function operar(ws, m, conexoes) {
    dados();
    const u = ws._usuario, rid = m.rid, op = String(m.op || '');
    const responder = o => send(ws, { t: 'terreno', rid, ...o });
    if (!u || !accounts[u]) return responder({ ok: false, texto: 'Sign in to an account to have a plot.' });
    const s = accounts[u].save;
    if (op === 'vista') {
      const sala = salaDoSocket(ws), dono = RE_SALA.test(sala || '') ? donoDaSala.get(sala) : null;
      return responder({ ok: true, vista: vista(dono || u, u) });
    }
    if (op === 'ir') {
      let dono = u;
      if (m.dono != null && String(m.dono).trim()) {
        dono = porNick(m.dono);
        if (!dono) return responder({ ok: false, texto: 'No trainer by that name.' });
        if (!podeVisitar(u, dono)) return responder({ ok: false, texto: '{x} is not taking visitors.', vars: { x: nick(dono) } });
      }
      const atual = salaDoSocket(ws);
      if (!RE_SALA.test(atual || '')) s.antesTerreno = { mapa: String(ws._cena || ws._mapa || 'kanto'), x: ws._info?.x, z: ws._info?.z, em: Date.now() };
      indo.set(u, { dono, em: Date.now() });
      estado(dono);
      saveAccounts();
      const ida = { t: 'terreno_ir', mapa: CENA, sala: salaDe(dono), dono: nick(dono), minha: dono === u };
      responder({ ok: true, mapa: ida.mapa, sala: ida.sala, dono: ida.dono, minha: ida.minha }); send(ws, ida);
      const o = T()?.origem || { x: -18.82, z: -6.13 };                     // colocacao.json coordinates are mirrored on x (world x = −x)
      levar(u, { mapa: CENA, x: -o.x, z: o.z, giro: 0 }, dono === u ? 'Going to your plot…' : 'Visiting ' + nick(dono) + "'s plot…");
      return;
    }
    if (op === 'sair') {
      const a = s.antesTerreno && !RE_SALA.test(String(s.antesTerreno.mapa)) && s.antesTerreno.mapa !== CENA ? s.antesTerreno : null;
      indo.delete(u);
      const p = a && Number.isFinite(+a.x) && Number.isFinite(+a.z) ? { mapa: a.mapa, x: +a.x, z: +a.z, giro: 0 } : pontoSeguro();   // nothing saved: Pallet Town
      const volta = { t: 'terreno_voltar', mapa: p?.mapa || 'kanto' };
      responder({ ok: true, mapa: volta.mapa }); send(ws, volta);
      if (p) levar(u, p, 'Leaving the plot…');
      return;
    }
    if (op === 'visitas') {
      const t = estado(u), q = String(m.quem || '');
      if (!['ninguem', 'amigos', 'guilda', 'todos'].includes(q)) return responder({ ok: false, texto: 'Pick who may visit.' });
      t.visitas = q; saveAccounts();
      return responder({ ok: true, vista: vista(u) });
    }
    if (op === 'construir') {
      const t = estado(u), vg = String(m.vaga || ''), v = T()?.vagas?.[vg];
      if (!v || v.tipo !== 'construcao') return responder({ ok: false, texto: "That building doesn't exist here." });
      if (t.construidas[vg]) return responder({ ok: false, texto: '{x} is already built.', vars: { x: v.nome } });
      const n1 = v.niveis?.[0] || {};
      if ((+n1.nivel || 1) > t.nivel) return responder({ ok: false, texto: '{x} needs home level {n}.', vars: { x: v.nome, n: +n1.nivel || 1 } });
      const custo = Math.max(0, Math.floor(+n1.custo || 0));
      if (!gm(u) && Math.floor(+s.dinheiro || 0) < custo) return responder({ ok: false, texto: '{x} costs {c} Coins.', vars: { x: v.nome, c: custo } });
      if (!gm(u)) s.dinheiro = Math.floor(+s.dinheiro || 0) - custo;
      t.construidas[vg] = 1;
      C.aoConstruir(t, vg, { agora: Date.now(), usuario: u, papel: 'dono', naSala: true });
      estado(u); saveAccounts(); log('plot', u, 'built', vg, custo);
      empurrar(u, conexoes);
      responder({ ok: true, vista: vista(u), bolsa: { dinheiro: s.dinheiro } });
      recarregarSala(u, conexoes, 'Building the ' + v.nome + '…');
      return;
    }
    if (op === 'colocar' || op === 'mover' || op === 'remover') {
      const t = estado(u);
      const ctx = { agora: Date.now(), usuario: u, papel: 'dono', naSala: naSala(ws, u), itens: { ...(s.itens || {}), ...(s.presos || {}) } };
      const r = C[op](t, m, ctx);
      if (!r?.ok) return responder({ ok: false, erro: r?.erro, texto: r?.msg || "That didn't work." });
      if (r.debitar) {                                                     // an item placed from the Bag (the Incubator)
        const id = String(r.debitar.item), bag = (s.presos && +s.presos[id] > 0) ? s.presos : (s.itens || (s.itens = {}));
        bag[id] = Math.max(0, (+bag[id] || 0) - (r.debitar.qtd || 1)); if (!bag[id]) delete bag[id];
      }
      if (r.devolver) {                                                    // an item picked back up
        const id = String(r.devolver.item), bag = r.devolver.preso ? (s.presos || (s.presos = {})) : (s.itens || (s.itens = {}));
        bag[id] = (+bag[id] || 0) + (r.devolver.qtd || 1);
      }
      saveAccounts(); empurrar(u, conexoes);
      responder({ ok: true, vista: vista(u), ...(r.debitar || r.devolver ? { bolsa: { itens: s.itens, presos: s.presos } } : {}) });
      return;   // the arrange screen moves the live models itself and reloads the scene when it closes
    }
    return responder({ ok: false, texto: 'Invalid request.' });
  }

  // ── THE BERRY GARDEN (Nov 7): the Berry garden building's 6 plots. Plants from public/data/ev.json → horta.plantas (EV seeds grow in
  // 8 h into 1 EV berry; held berries in 12 h into 3). Plots open with Gym Badges: badges − 1 (2 badges → 1 plot … 7 → 6; GMs all 6),
  // or horta.canteirosPorInsignia / horta.canteirosDesde in ev.json. The harvest waits in the plot (it never rots).
  //   { t: 'horta_ver' | 'horta_plantar' { canteiro, item } | 'horta_colher' { canteiro } } → { t: 'horta', op, horta, colhido? } / { t: 'horta_erro', op, canteiro, texto }
  let evCache = { t: 0, d: null };
  const evH = () => { if (Date.now() - evCache.t > 30e3) { try { evCache = { t: Date.now(), d: JSON.parse(fs.readFileSync(nodePath.join(dataPub, 'ev.json'), 'utf8')).horta || {} }; } catch { evCache = { t: Date.now(), d: evCache.d || {} }; } } return evCache.d || {}; };
  const MAXC = () => Math.max(1, Math.min(12, +evH().canteirosMax || 6));
  function abertosDe(u) {
    const c = accounts[u]; if (!c) return 0;
    if (gm(u) || !estado(u)?.construidas?.horta) return gm(u) ? MAXC() : 0;   // no Berry garden built: no plots
    const ins = Array.isArray(c.save?.insignias) ? c.save.insignias.length : 0, desde = +evH().canteirosDesde || 2, por = +evH().canteirosPorInsignia || 1;
    return Math.max(0, Math.min(MAXC(), ins >= desde ? 1 + Math.floor((ins - desde) * por) : 0));
  }
  function hortaDe(u) {
    const s = accounts[u].save;
    if (!s.horta || !Array.isArray(s.horta.plantas)) s.horta = { plantas: [] };
    while (s.horta.plantas.length < MAXC()) s.horta.plantas.push(null);
    return s.horta;
  }
  function vistaHorta(u) {
    const H = hortaDe(u), ab = abertosDe(u), agora = Date.now(), P = evH().plantas || {};
    return {
      max: MAXC(), abertos: ab, desenhados: MAXC(), semHorta: !estado(u)?.construidas?.horta,
      canteiros: H.plantas.slice(0, MAXC()).map((p, i) => {
        if (i >= ab) return { i, aberto: false, vazio: true, faltam: i + 1 - ab };
        if (!p) return { i, aberto: true, vazio: true };
        const falta = Math.max(0, p.prontoEm - agora), d = P[String(p.semente)] || {};
        return { i, aberto: true, vazio: false, semente: p.semente, fruto: p.fruto, plantadoEm: p.plantadoEm, prontoEm: p.prontoEm, faltaMs: falta, pronto: falta <= 0,
          progresso: falta <= 0 ? 1 : Math.min(1, 1 - falta / Math.max(1, p.prontoEm - p.plantadoEm)), colheita: +d.colheita || 1, preso: !!d.preso };
      }),
    };
  }
  function empurrarSave(u) {
    const c = accounts[u]; c.rev = (c.rev || 0) + 1; saveAccounts();
    for (const w of socketsOf(u)) send(w, { t: 'save', save: { itens: c.save.itens || {}, presos: c.save.presos || {}, horta: c.save.horta }, rev: c.rev });
  }
  function horta(ws, m) {
    const u = ws._usuario, op = String(m.t || '');
    const erro = (texto, extra = {}) => send(ws, { t: 'horta_erro', op, canteiro: m.canteiro, texto, ...extra });
    if (!u || !accounts[u]) return erro('Sign in to an account to have a plot.');
    const s = accounts[u].save;
    if (op === 'horta_ver') return send(ws, { t: 'horta', op, horta: vistaHorta(u) });
    if (!naSala(ws, u)) return erro('Go to your plot to tend the garden.', { erro: 'outside the plot' });
    const i = Math.floor(+m.canteiro), H = hortaDe(u);
    if (!(i >= 0 && i < abertosDe(u))) return erro('That plot is locked.');
    if (op === 'horta_plantar') {
      if (H.plantas[i]) return erro('Something is already growing there.');
      const id = String(Math.floor(+m.item)), d = (evH().plantas || {})[id];
      if (!d) return erro("That can't be planted.");
      const pilhas = (d.pilhas || ['solta']).map(k => k === 'presa' ? (s.presos || (s.presos = {})) : (s.itens || (s.itens = {})));
      const bag = pilhas.find(b => +b[id] > 0);
      if (!bag) return erro("You don't have that.");
      bag[id] = +bag[id] - 1; if (!bag[id]) delete bag[id];
      const agora = Date.now();
      H.plantas[i] = { semente: +id, fruto: +d.fruto || +id, plantadoEm: agora, prontoEm: agora + Math.max(60e3, +d.crescerMs || 8 * 3600e3) };
      log('garden', u, 'planted', id, 'in', i);
      empurrarSave(u);
      return send(ws, { t: 'horta', op, canteiro: i, horta: vistaHorta(u) });
    }
    if (op === 'horta_colher') {
      const p = H.plantas[i];
      if (!p) return erro('Nothing is growing there.');
      if (p.prontoEm > Date.now()) return erro('Not ready yet.');
      const d = (evH().plantas || {})[String(p.semente)] || {}, qtd = Math.max(1, +d.colheita || 1), id = String(p.fruto);
      const bag = d.preso ? (s.presos || (s.presos = {})) : (s.itens || (s.itens = {}));
      bag[id] = (+bag[id] || 0) + qtd;
      H.plantas[i] = null;
      log('garden', u, 'harvested', id, 'x' + qtd);
      empurrarSave(u);
      return send(ws, { t: 'horta', op, canteiro: i, horta: vistaHorta(u), colhido: { canteiro: i, id: +id, qtd } });
    }
    return erro('Invalid request.');
  }

  /** The plot's buildings as map objects (file coordinates) for the scene loader — the plot this account is entering. */
  function pecasAoEntrar(u) {
    const sala = salaAoEntrar(u), dono = donoDaSala.get(sala) || u;
    const v = vista(dono, u);
    return (v?.pecas || []).filter(p => !p.glb).map(p => ({ n: p.n, x: p.x, y: p.y || 0, z: p.z, a: p.giro || 0 }));
  }
  return { operar, horta, salaAoEntrar, pecasAoEntrar, salaDe, vista, estado, podeVisitar, donoDaSala: sala => donoDaSala.get(sala) || null, CENA };
}
