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
      return responder({ ok: true, vista: vista(u), bolsa: { dinheiro: s.dinheiro } });
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
      return responder({ ok: true, vista: vista(u), ...(r.debitar || r.devolver ? { bolsa: { itens: s.itens, presos: s.presos } } : {}) });
    }
    return responder({ ok: false, texto: 'Invalid request.' });
  }

  return { operar, salaAoEntrar, salaDe, vista, estado, podeVisitar, donoDaSala: sala => donoDaSala.get(sala) || null, CENA };
}
