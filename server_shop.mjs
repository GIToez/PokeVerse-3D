/* Diamond shop on the server: the wallet (save.carteira), the cosmetics for sale and buying them with Diamonds.
 *   {t:'loja_ver', rid}                    → {t:'loja', rid, ok, vitrine}
 *   {t:'loja_comprar', rid, produto, ref}  buy 'peca:roupa:<id>' or 'peca:mochila:<glb>'; `ref` makes a retry safe
 * Diamonds only come in from the Battle Pass, staff grants (/givediamonds) and, later, real-money packs. Prices live in
 * public/data/cosmeticos.json (`diamantes`); a seasonal outfit (`estacao`) is only for sale during its season. */
import fs from 'fs';
import nodePath from 'path';
import { estacaoAgora } from './calendar.mjs';

const ORIGENS = ['pagamento', 'passe', 'evento', 'staff'];
const MAX_REFS = 40;
export { estacaoAgora };

export function criarCarteira() {
  function de(c) {
    if (!c.save) c.save = {};
    let w = c.save.carteira;
    if (!w || typeof w !== 'object') w = c.save.carteira = { total: 0, porOrigem: {} };
    if (!Number.isSafeInteger(w.total) || w.total < 0) w.total = 0;
    if (!w.porOrigem || typeof w.porOrigem !== 'object') w.porOrigem = {};
    for (const o of ORIGENS) if (!Number.isSafeInteger(w.porOrigem[o])) w.porOrigem[o] = 0;
    return { total: w.total, porOrigem: { ...w.porOrigem }, bloqueada: false, comprados: w.porOrigem.pagamento };
  }
  function creditar(c, n, origem) {
    de(c);
    const q = Math.max(0, Math.floor(+n || 0));
    const w = c.save.carteira;
    w.total += q;
    w.porOrigem[ORIGENS.includes(origem) ? origem : 'evento'] += q;
    return w.total;
  }
  function debitar(c, n) {
    de(c);
    const q = Math.max(0, Math.floor(+n || 0)), w = c.save.carteira;
    if (w.total < q) return false;
    w.total -= q;
    return true;
  }
  return { de, creditar, debitar };
}

export function criarLoja({ dadosPub, contas, socketsDe, enviar, salvarContas, carteira }) {
  let cache = null, mtime = 0;
  function cosmeticos() {
    const a = nodePath.join(dadosPub, 'cosmeticos.json');
    try { const st = fs.statSync(a); if (!cache || st.mtimeMs !== mtime) { cache = JSON.parse(fs.readFileSync(a, 'utf8')); mtime = st.mtimeMs; } } catch (e) { console.warn('shop: cosmeticos.json', e.message); }
    return cache || { roupas: [], efeitos: [], mochilas: [] };
  }
  function meus(c) {
    if (!c.save) c.save = {};
    const s = c.save;
    if (!s.cosmeticos || typeof s.cosmeticos !== 'object' || Array.isArray(s.cosmeticos)) s.cosmeticos = {};
    for (const k of ['roupas', 'efeitos', 'mochilas']) if (!Array.isArray(s.cosmeticos[k])) s.cosmeticos[k] = [];
    return s.cosmeticos;
  }
  function aVenda() {
    const C = cosmeticos(), est = estacaoAgora(), out = [];
    for (const r of C.roupas || []) {
      if (!(r.diamantes > 0) || r.oculto || r.fundador || r.feriado || r.passe) continue;
      if (r.estacao && r.estacao !== est) continue;
      out.push({ tipo: 'roupa', id: r.id, nome: r.nome, preco: r.diamantes, sexo: r.sexo, estacao: r.estacao || null });
    }
    for (const b of C.mochilas || []) if (b.diamantes > 0 && !b.oculto && !b.feriado) out.push({ tipo: 'mochila', id: b.id, nome: b.nome, preco: b.diamantes, sexo: null });
    return out;
  }
  function vitrine(c) {
    const M = meus(c);
    const pecas = aVenda().map(p => ({
      id: 'peca:' + p.tipo + ':' + p.id,
      preco: p.preco,
      preso: true,
      tem: (p.tipo === 'roupa' ? M.roupas : M.mochilas).includes(p.id),
      peca: {
        tipo: p.tipo, id: p.id, nome: p.nome, nomes: { en: p.nome },
        icone: 'ui/amanda/skins/pecas/' + p.tipo + '-' + p.id + '@2x.png', qualidade: p.preco >= 700 ? 4 : 3,
        ...(p.sexo ? { sexo: p.sexo } : {}), ...(p.estacao ? { estacao: p.estacao } : {}),
      },
    }));
    return { aberta: true, saldo: carteira.de(c), produtos: [], pecas, montarias: [], skinsMon: [] };
  }
  function empurrarSave(u) {
    const c = contas[u]; c.rev = (c.rev || 0) + 1;
    for (const w of socketsDe(u)) enviar(w, { t: 'save', save: c.save, rev: c.rev });
  }

  function receber(ws, u, m) {
    const rid = m.rid;
    const c = u ? contas[u] : null;
    const resp = o => enviar(ws, { t: 'loja', rid, ...o });
    if (!c) return resp({ ok: false, erro: 'sem-conta', mensagem: 'Log in with an account to use the shop.' });
    if (m.t === 'loja_ver') return resp({ ok: true, vitrine: vitrine(c) });
    if (m.t !== 'loja_comprar') return resp({ ok: false, erro: 'recusado', mensagem: 'Unknown shop request.' });
    const s = c.save || (c.save = {});
    if (!Array.isArray(s.lojaRefs)) s.lojaRefs = [];
    const ref = String(m.ref || '').slice(0, 40);
    if (ref && s.lojaRefs.includes(ref)) return resp({ ok: true, repetido: true, vitrine: vitrine(c) });
    const mt = /^peca:(roupa|mochila):([\w-]{1,40})$/.exec(String(m.produto || ''));
    const p = mt && aVenda().find(x => x.tipo === mt[1] && x.id === mt[2]);
    if (!p) return resp({ ok: false, erro: 'recusado', mensagem: "That isn't for sale right now.", vitrine: vitrine(c) });
    const lista = meus(c)[p.tipo === 'roupa' ? 'roupas' : 'mochilas'];
    if (lista.includes(p.id)) return resp({ ok: false, erro: 'recusado', mensagem: 'You already have ' + p.nome + '.', vitrine: vitrine(c) });
    if (m.preco != null && +m.preco !== p.preco) return resp({ ok: false, erro: 'preco-mudou', mensagem: 'The price changed: review and confirm again.', vitrine: vitrine(c) });
    const falta = p.preco - carteira.de(c).total;
    if (falta > 0) return resp({ ok: false, erro: 'saldo-insuficiente', falta, mensagem: 'Not enough Diamonds.', vitrine: vitrine(c) });
    carteira.debitar(c, p.preco);
    lista.push(p.id);
    if (ref) { s.lojaRefs.push(ref); if (s.lojaRefs.length > MAX_REFS) s.lojaRefs.splice(0, s.lojaRefs.length - MAX_REFS); }
    salvarContas(); empurrarSave(u);
    return resp({ ok: true, comprou: { tipo: p.tipo, id: p.id, preco: p.preco }, vitrine: vitrine(c) });
  }

  /** GET /loja: the real-money side. Payments are not set up yet, so the counter is closed but the packs still show. */
  function info() {
    return {
      aberta: false, modo: 'desligado', checkout: 'embutido',
      pacotes: [
        { id: 'd100', diamantes: 100, brl: 1000, usd: 200 },
        { id: 'd250', diamantes: 250, brl: 2500, usd: 500 },
        { id: 'd500', diamantes: 500, brl: 4750, usd: 950 },
        { id: 'd1000', diamantes: 1000, brl: 9000, usd: 1800 },
      ],
      valorLivre: { ligado: false, min: 100, max: 10000, passo: 10 },
      metodos: { usd: ['card'] },
      ofertas: [],
    };
  }

  /** Staff grant (/givediamonds). Returns the new balance. */
  function darDiamantes(u, n) {
    const c = contas[u];
    if (!c) return null;
    const total = carteira.creditar(c, n, 'staff');
    salvarContas(); empurrarSave(u);
    return total;
  }

  return { receber, vitrine, info, darDiamantes, meus };
}
