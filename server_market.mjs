/* PLAYER MARKET (Nov 4). Listings between players, run on the server with the rules in market.mjs and the catalog in
   data/mercado.json (5% listing fee, 48 h listings, 20 per player, price inside the item's floor/ceiling, 1 badge).

   The client (market_ui.mjs) sends `mercado_<op>` and waits for `mercado` / `mercado_erro` with the same `op`:
     listar      { cat, busca, ordem, shiny, lvMin, ivMin, lvMax, ivSomaMin, evSomaMin, pagina }
     minhas      {}                        my open listings, plus notices that piled up while offline
     precos      { item } | { dex }        price summary and the latest sales
     anunciar    { item, qtd, preco }      the items leave the bag, the fee is paid now
     anunciar_mon{ uid, preco }            the Pokémon leaves the party/Box
     comprar     { oferta, qtd }           Coins go to the seller right away, online or not
     cancelar    { oferta }                the goods come back, the fee does not
   Expired listings go back to the seller on their own. Every change pushes the new save to the accounts involved. */
import fs from 'node:fs';
import nodePath from 'node:path';
import * as Mercado from './market.mjs';
import * as Med from './medallion.mjs';

const POR_PAGINA = 40, HISTORICO_MAX = 3000, AVISOS_MAX = 50, VARRER_MS = 60000;

export function criarMercado({ dados, dadosPub, contas, socketsDe, enviar, salvarContas, marcarPego, emLuta = () => false, logAdmin = null, anunciosExtra = () => 0 }) {
  const arq = nodePath.join(dados, 'mercado.json');
  let E = { prox: 1, ofertas: [], historico: [], avisos: {} };
  try { const j = JSON.parse(fs.readFileSync(arq, 'utf8')); if (j && Array.isArray(j.ofertas)) E = { ...E, ...j }; } catch {}

  let catMt = -1, menu = null, menuMt = -1;
  const catalogo = () => {
    const p = nodePath.join(dadosPub, 'mercado.json');
    try { const mt = fs.statSync(p).mtimeMs; if (mt !== catMt) { Mercado.usarCatalogo(JSON.parse(fs.readFileSync(p, 'utf8'))); catMt = mt; } } catch {}
    return Mercado.catalogo();
  };
  const itens = () => {
    const p = nodePath.join(dadosPub, 'menu_data.json');
    try { const mt = fs.statSync(p).mtimeMs; if (mt !== menuMt) { menu = JSON.parse(fs.readFileSync(p, 'utf8')).itens || {}; menuMt = mt; } } catch {}
    return menu || {};
  };
  const nomeItem = id => itens()[String(id)]?.n || Mercado.item(id)?.nome || 'item';

  let gravarPend = null;
  const gravar = () => {
    if (gravarPend) return;
    gravarPend = setTimeout(() => {
      gravarPend = null;
      try { fs.writeFileSync(arq + '.tmp', JSON.stringify(E)); fs.renameSync(arq + '.tmp', arq); }
      catch (e) { console.error('[market] save failed:', e.message); }
    }, 300);
  };

  const saveDe = c => {
    if (!c.save) c.save = {};
    const s = c.save;
    for (const k of ['itens', 'bolas']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    for (const k of ['time', 'caixa']) if (!Array.isArray(s[k])) s[k] = [];
    if (!Number.isFinite(+s.dinheiro)) s.dinheiro = 0;
    return s;
  };
  const cofre = (c, id) => itens()[String(id)]?.t === 7 ? saveDe(c).bolas : saveDe(c).itens;
  const quantos = (c, id) => Math.max(0, Math.floor(+cofre(c, id)[String(id)] || 0));
  const mexerItem = (c, id, n) => {
    const k = cofre(c, id), v = quantos(c, id) + n;
    if (v > 0) k[String(id)] = v; else delete k[String(id)];
  };
  const insignias = s => Array.isArray(s.insignias) ? s.insignias.length : Math.max(0, Math.floor(+s.insignias || 0));
  const nomeDe = u => contas[u]?.save?.nome || u;
  const abertasDe = u => E.ofertas.filter(o => o.vendedor === u).length;

  const empurrar = u => {
    const c = contas[u];
    if (!c) return;
    c.rev = (c.rev || 0) + 1;
    salvarContas();
    for (const w of socketsDe(u)) enviar(w, { t: 'save', save: c.save, rev: c.rev });
  };
  const avisar = (u, aviso) => {
    const online = [...socketsDe(u)];
    if (online.length) { for (const w of online) enviar(w, { t: 'mercado_aviso', aviso }); return; }
    const l = E.avisos[u] || (E.avisos[u] = []);
    l.push({ aviso, em: Date.now() });
    if (l.length > AVISOS_MAX) l.splice(0, l.length - AVISOS_MAX);
  };

  /* What the client sees: the seller's display name instead of the account key, and only the Pokémon fields a buyer
     needs to judge it (IVs, EVs, nature, moves are part of the deal). */
  const publica = (o, u) => ({
    id: String(o.id), tipo: o.tipo, item: o.item, quantidade: o.quantidade, precoUnit: o.precoUnit,
    vendedor: o.vendedor === u ? (contas[u]?.save?.nome || u) : nomeDe(o.vendedor), minha: o.vendedor === u,
    criadaEm: o.criadaEm, expiraEm: o.expiraEm,
    ...(o.mon ? { mon: monPublico(o.mon) } : {}),
  });
  const monPublico = m => ({
    uid: String(m.uid), dex: m.dex, glb: m.glb, nome: m.nome, apelido: m.apelido, lv: m.lv, shiny: !!m.shiny, sexo: m.sexo ?? null,
    natureza: m.natureza, ivs: m.ivs, evs: m.evs, movs: m.movs, habilidade: m.habilidade, item: m.item ?? m.held ?? null,
  });

  function devolver(o, motivo) {
    const c = contas[o.vendedor];
    if (!c) return;
    const s = saveDe(c);
    if (o.tipo === 'pokemon') (s.time.length < 6 ? s.time : s.caixa).push(o.mon);
    else mexerItem(c, o.item, o.quantidade);
    empurrar(o.vendedor);
    if (motivo) avisar(o.vendedor, o.tipo === 'pokemon'
      ? { k: motivo.k, tipo: 'pokemon', mon: { nome: o.mon.nome, lv: o.mon.lv }, motivo: motivo.texto }
      : { k: motivo.k, tipo: 'item', qtd: o.quantidade, itemNome: nomeItem(o.item), motivo: motivo.texto });
  }
  function varrer() {
    const t = Date.now(), vencidas = E.ofertas.filter(o => o.expiraEm <= t);
    if (!vencidas.length) return;
    E.ofertas = E.ofertas.filter(o => o.expiraEm > t);
    for (const o of vencidas) devolver(o, { k: 'expirou' });
    gravar();
  }
  const timer = setInterval(varrer, VARRER_MS);
  timer.unref?.();

  const erro = (texto) => ({ erro: texto });
  const limiteDe = (s, u = null) => (Mercado.regras()?.ofertasPorJogador ?? 20) + Med.anunciosExtra(s) + (u ? Math.max(0, +anunciosExtra(u) || 0) : 0);   // + the Medallion's listings while it runs, + the guild level's
  function contexto(u, c) {
    const s = saveDe(c);
    return {
      nome: u, insignias: insignias(s), moedas: Math.floor(+s.dinheiro || 0), ofertasAbertas: abertasDe(u), limiteOfertas: limiteDe(s, u),
      temItem: id => quantos(c, id),
      temMon: uid => s.time.find(p => String(p.uid) === String(uid)) || s.caixa.find(p => String(p.uid) === String(uid)) || null,
      seguidorUid: s.seguidorUid ?? null,
      monsTotal: s.time.length + s.caixa.length,
    };
  }

  const ops = {
    listar(u, c, m) {
      varrer();
      const f = {
        cat: typeof m.cat === 'string' ? m.cat : 'todas', busca: String(m.busca || '').slice(0, 40), ordem: String(m.ordem || 'preco-asc'),
        shiny: m.shiny === true, lvMin: +m.lvMin || 0, ivMin: +m.ivMin || 0, lvMax: +m.lvMax || 0, ivSomaMin: +m.ivSomaMin || 0, evSomaMin: +m.evSomaMin || 0,
      };
      const todas = Mercado.filtrar(E.ofertas, f);
      const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
      const pagina = Math.max(0, Math.min(paginas - 1, Math.floor(+m.pagina || 0)));
      const ofertas = todas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map(o => publica(o, u));
      return { ofertas, total: todas.length, paginas, pagina, porPagina: POR_PAGINA,
        fim: pagina >= paginas - 1, agora: Date.now() };
    },
    minhas(u) {
      varrer();
      const avisos = (E.avisos[u] || []).map(a => ({ aviso: a.aviso, em: a.em }));
      if (E.avisos[u]) { delete E.avisos[u]; gravar(); }
      const vendas = E.historico.filter(h => h.vendedor === u).slice(-20).reverse().map(h => ({ ...h, vendedor: undefined, comprador: nomeDe(h.comprador) }));
      return { ofertas: E.ofertas.filter(o => o.vendedor === u).map(o => publica(o, u)), avisos, vendas, limite: limiteDe(contas[u]?.save, u), agora: Date.now() };
    },
    precos(u, c, m) {
      if (m.dex != null) {
        const dex = Math.round(+m.dex);
        const vendas = E.historico.filter(h => h.tipo === 'pokemon' && +h.dex === dex);
        return { dex, estatistica: Mercado.estatisticaMon(dex, vendas, E.ofertas), vendas: vendas.slice(-30).reverse().map(h => ({ em: h.em, precoUnit: h.precoUnit, lv: h.lv, iv: h.iv, shiny: !!h.shiny })), agora: Date.now() };
      }
      const id = String(m.item ?? '');
      const est = Mercado.estatistica(id, E.historico, E.ofertas);
      if (!est) return erro(Mercado.MOTIVOS.naoVende);
      est.nome = nomeItem(id);
      const vendas = E.historico.filter(h => (h.tipo || 'item') === 'item' && String(h.item) === id);
      return { item: +id, estatistica: est, vendas: vendas.slice(-30).reverse().map(h => ({ em: h.em, precoUnit: h.precoUnit, quantidade: h.quantidade })), agora: Date.now() };
    },
    anunciar(u, c, m) {
      const id = String(m.item ?? '');
      const r = Mercado.podeAnunciar(contexto(u, c), id, m.qtd, m.preco);
      if (!r.ok) return erro(r.motivo);
      const s = saveDe(c), t = Date.now();
      mexerItem(c, id, -r.quantidade);
      s.dinheiro = Math.floor(+s.dinheiro || 0) - r.taxa;
      const o = { id: E.prox++, tipo: 'item', item: id, quantidade: r.quantidade, precoUnit: r.precoUnit, vendedor: u, criadaEm: t,
        expiraEm: t + Mercado.regras().validadeHoras * 3600000 };
      E.ofertas.push(o);
      gravar(); empurrar(u);
      return { oferta: publica(o, u), taxa: r.taxa, total: r.total };
    },
    anunciar_mon(u, c, m) {
      if (emLuta(u)) return erro("You can't list a Pokémon in the middle of a battle.");
      const s = saveDe(c), uid = String(m.uid ?? '');
      const ctxV = contexto(u, c);
      const r = Mercado.podeAnunciarMon(ctxV, uid, m.preco, E.ofertas);
      if (!r.ok) return erro(r.motivo);
      const naParty = s.time.findIndex(p => String(p.uid) === uid);
      if (naParty >= 0 && s.time.length <= 1) return erro(Mercado.MOTIVOS_MON.ultimo);
      if (naParty >= 0) s.time.splice(naParty, 1);
      else s.caixa = s.caixa.filter(p => String(p.uid) !== uid);
      s.dinheiro = Math.floor(+s.dinheiro || 0) - r.taxa;
      const t = Date.now();
      const o = { id: E.prox++, tipo: 'pokemon', mon: r.mon, quantidade: 1, precoUnit: r.precoUnit, vendedor: u, criadaEm: t,
        expiraEm: t + Mercado.regras().validadeHoras * 3600000 };
      E.ofertas.push(o);
      gravar(); empurrar(u);
      return { oferta: publica(o, u), taxa: r.taxa, total: r.total };
    },
    comprar(u, c, m) {
      varrer();
      const o = E.ofertas.find(x => String(x.id) === String(m.oferta));
      const r = Mercado.podeComprar(contexto(u, c), o, o?.tipo === 'pokemon' ? 1 : (m.qtd ?? o?.quantidade));
      if (!r.ok) return erro(r.motivo);
      const s = saveDe(c), vend = contas[o.vendedor];
      s.dinheiro = Math.floor(+s.dinheiro || 0) - r.total;
      if (o.tipo === 'pokemon') {
        (s.time.length < 6 ? s.time : s.caixa).push(o.mon);
        marcarPego?.(c, o.mon.dex);
      } else mexerItem(c, o.item, r.quantidade);
      o.quantidade -= r.quantidade;
      if (o.quantidade <= 0 || o.tipo === 'pokemon') E.ofertas = E.ofertas.filter(x => x !== o);
      if (vend) { const sv = saveDe(vend); sv.dinheiro = Math.floor(+sv.dinheiro || 0) + r.total; }
      const ivs = Array.isArray(o.mon?.ivs) ? o.mon.ivs.reduce((a, b) => a + (+b || 0), 0) : null;
      E.historico.push({ tipo: o.tipo, item: o.item, dex: o.mon?.dex, lv: o.mon?.lv, iv: ivs, shiny: !!o.mon?.shiny,
        precoUnit: o.precoUnit, quantidade: r.quantidade, em: Date.now(), vendedor: o.vendedor, comprador: u });
      if (E.historico.length > HISTORICO_MAX) E.historico.splice(0, E.historico.length - HISTORICO_MAX);
      gravar(); empurrar(u);
      if (vend) {
        empurrar(o.vendedor);
        avisar(o.vendedor, o.tipo === 'pokemon'
          ? { k: 'vendeu', tipo: 'pokemon', mon: { nome: o.mon.nome, lv: o.mon.lv }, total: r.total, quem: nomeDe(u) }
          : { k: 'vendeu', tipo: 'item', qtd: r.quantidade, itemNome: nomeItem(o.item), total: r.total, quem: nomeDe(u) });
      }
      return { comprou: o.tipo === 'pokemon' ? { mon: monPublico(o.mon) } : { item: o.item, qtd: r.quantidade }, total: r.total };
    },
    cancelar(u, c, m) {
      const o = E.ofertas.find(x => String(x.id) === String(m.oferta));
      if (!o || o.vendedor !== u) return erro(Mercado.MOTIVOS.sumiu);
      E.ofertas = E.ofertas.filter(x => x !== o);
      devolver(o, null);
      gravar();
      return { cancelada: String(o.id), devolve: o.tipo === 'pokemon' ? { mon: monPublico(o.mon) } : { item: o.item, quantidade: o.quantidade } };
    },
  };

  return {
    receber(ws, u, m) {
      const op = String(m.t || '').slice(8);
      const c = u ? contas[u] : null;
      const responder = r => enviar(ws, r.erro ? { t: 'mercado_erro', op, erro: r.erro } : { t: 'mercado', op, ...r });
      if (!c) return responder(erro('The Market is between players: sign in to an account.'));
      if (!catalogo()) return responder(erro(Mercado.MOTIVOS.semCatalogo));
      const f = Object.hasOwn(ops, op) ? ops[op] : null;
      if (!f) return responder(erro('unknown market request'));
      try { responder(f(u, c, m || {})); }
      catch (e) { console.error('[market]', op, e); responder(erro('The Market had a problem. Try again.')); }
    },
    /* GM removal: the goods go back, the fee does not. */
    retirar(id, motivo = '') {
      const o = E.ofertas.find(x => String(x.id) === String(id));
      if (!o) return false;
      E.ofertas = E.ofertas.filter(x => x !== o);
      devolver(o, { k: 'retirada', texto: String(motivo).slice(0, 120) });
      gravar();
      return true;
    },
    ofertas: () => E.ofertas.map(o => ({ ...publica(o, null), conta: o.vendedor })),
    varrer,
  };
}
