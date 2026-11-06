/* Diamond shop on the server: the wallet (save.carteira), the cosmetics for sale and buying them with Diamonds.
 *   {t:'loja_ver', rid}                    → {t:'loja', rid, ok, vitrine}
 *   {t:'loja_comprar', rid, produto, ref}  buy 'peca:<roupa|mochila|peito|rastro>:<id>'; `ref` makes a retry safe
 * Diamonds only come in from the Battle Pass, staff grants (/givediamonds) and, later, real-money packs. The catalog and prices
 * are public/data/catalogo_loja.json (server_wardrobe.mjs); a seasonal outfit (`estacao`) is only for sale during its season. */
import fs from 'fs';
import nodePath from 'path';
import { estacaoAgora } from './calendar.mjs';
import * as Caixa from './box_rules.mjs';
import * as SkinMon from './skin_mon.mjs';                                 // Pokémon skins: ids, prices, showcase (from upcoming/)

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

export function criarLoja({ dadosPub, contas, socketsDe, enviar, salvarContas, carteira, guarda }) {
  /* POKÉMON SKINS (Nov 6): public/data/pokemon_skins.json (admin → Data files → Pokémon skins) = the showcase, prices and end time;
     only skins whose model exists are sold. Owned skins: save.skinsMon = [pmDDDD_NN]; the one on per species: save.skinMon = { pmDDDD: id }. */
  let modelos = null, modelosEm = 0, nomes = null;
  function modelosMon() {
    if (!modelos || Date.now() - modelosEm > 60e3) {
      try { modelos = new Set(fs.readdirSync(nodePath.join(dadosPub, '..', 'scenery', 'mon')).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4))); } catch { modelos = new Set(); }
      modelosEm = Date.now();
    }
    return modelos;
  }
  const tabelaSkins = () => { try { return { skinsPokemon: JSON.parse(fs.readFileSync(nodePath.join(dadosPub, 'pokemon_skins.json'), 'utf8')) }; } catch { return { skinsPokemon: {} }; } };
  function nomeSkin(id) {
    if (!nomes) { nomes = {}; try { const d = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, '..', 'pokedex.json'), 'utf8')); for (const e of d.species || []) if (!nomes[+e.n]) nomes[+e.n] = e.name; } catch {} }
    const dex = SkinMon.dexDe(id), base = nomes[dex] || ('No. ' + dex);
    return base + ' · costume ' + (+id.slice(-2) - 30 > 0 ? +id.slice(-2) - 30 : id.slice(-2));
  }
  const skinsDe = (save) => (Array.isArray(save.skinsMon) ? save.skinsMon.filter(SkinMon.ehSkinMon) : []);
  const skinsAVenda = () => SkinMon.aVenda(tabelaSkins(), modelosMon());
  /** What the shop sells right now (server_wardrobe.mjs reads public/data/catalogo_loja.json). */
  const aVenda = () => guarda.saleList();
  function vitrine(c) {
    const save = c.save || (c.save = {});
    const pecas = aVenda().map(p => ({
      id: 'peca:' + p.tipo + ':' + p.id,
      preco: +p.preco,
      preso: true,
      tem: guarda.has(save, p.tipo, p.id, c),
      peca: {
        tipo: p.tipo, id: p.id, nome: p.nome, nomes: { en: p.nome }, icone: p.icone || null, qualidade: p.qualidade ?? 3,
        ...(p.sexo ? { sexo: p.sexo } : {}), ...(p.estacao ? { estacao: p.estacao } : {}), ...(p.ponto ? { ponto: p.ponto } : {}),
      },
    }));
    return { aberta: true, saldo: carteira.de(c), produtos: produtosAVenda().map(p => p.id === 'boxSlots' ? vagasProduto(p, save) : ({ id: PARA_TELA[p.id] || p.id, nome: p.nome, preco: +p.preco, item: +p.item, qtd: +p.qtd || 1, preso: false, soComprados: false })), pecas, montarias: [],
      skinsMon: skinsAVenda().map(k => ({ id: SkinMon.produtoDe(k.id), preco: k.preco, preso: true, tem: skinsDe(save).includes(k.id), skin: { id: k.id, nome: nomeSkin(k.id), nomes: { en: nomeSkin(k.id) } } })) };
  }
  /* COMFORT TAB (Nov 5): items sold for Diamonds — the Medallion (30/60/90 days) and the Premium Daily Pass. They land in the Bag
     as tradable items: use them (server_bag.mjs `uso`) or sell them on the Market. Prices: public/data/shop_products.json (admin). */
  /* Product IDs in shop_products.json are English (boxSlots, medallion30…); the shop screen (shop_ui.mjs, from PokeFable) knows them
     by its own names, which are what the client sends and receives. */
  const PARA_TELA = { boxSlots: 'vagasCaixa', medallion30: 'medalhao30', medallion60: 'medalhao60', medallion90: 'medalhao90', premiumDailyPass30: 'passeDiario30' };
  const DA_TELA = Object.fromEntries(Object.entries(PARA_TELA).map(([a, b]) => [b, a]));
  const cfgJogo = () => { try { return JSON.parse(fs.readFileSync(nodePath.join(dadosPub, 'game_config.json'), 'utf8')); } catch { return {}; } };
  /** Box slots: `qtd` slots per purchase, `teto` slots bought at most (box_rules.mjs). */
  function vagasProduto(p, save) {
    const pacote = Math.max(1, +p.qtd || 50), teto = Math.max(pacote, +p.teto || 600), compradas = Math.max(0, +save.caixaCompradas || 0);
    return { id: 'vagasCaixa', nome: p.nome || 'Box slots', preco: +p.preco, pacote, compradas, teto, cabem: Math.floor((teto - compradas) / pacote), caixa: { vagas: Caixa.vagas(save, cfgJogo()) }, preso: true };
  }
  function produtosAVenda() {
    try {
      const l = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, 'shop_products.json'), 'utf8'));
      return (Array.isArray(l) ? l : []).filter(p => p && p.aVenda !== false && /^[\w-]{1,40}$/.test(String(p.id)) && Number.isSafeInteger(+p.preco) && +p.preco > 0 && (p.id === 'boxSlots' || (Number.isSafeInteger(+p.item) && +p.item > 0)));
    } catch { return []; }
  }
  function comprarProduto(c, u, m, ref, resp) {
    const s = c.save;
    const pedido = DA_TELA[m.produto] || m.produto, p = produtosAVenda().find(x => String(x.id) === String(pedido));
    if (!p) return resp({ ok: false, erro: 'recusado', mensagem: "That isn't for sale right now.", vitrine: vitrine(c) });
    if (m.preco != null && +m.preco !== +p.preco) return resp({ ok: false, erro: 'preco-mudou', mensagem: 'The price changed: review and confirm again.', vitrine: vitrine(c) });
    const falta = +p.preco - carteira.de(c).total;
    if (falta > 0) return resp({ ok: false, erro: 'saldo-insuficiente', falta, mensagem: 'Not enough Diamonds.', vitrine: vitrine(c) });
    if (p.id === 'boxSlots') {                                             // Box slots: straight onto the account, never an item
      const v = vagasProduto(p, s);
      if (v.cabem < 1) return resp({ ok: false, erro: 'recusado', mensagem: 'You already bought the most Box slots.', vitrine: vitrine(c) });
      carteira.debitar(c, +p.preco);
      s.caixaCompradas = v.compradas + v.pacote;
      if (ref) { s.lojaRefs.push(ref); if (s.lojaRefs.length > MAX_REFS) s.lojaRefs.splice(0, s.lojaRefs.length - MAX_REFS); }
      salvarContas(); empurrarSave(u);
      return resp({ ok: true, comprou: { produto: PARA_TELA[p.id] || p.id, vagas: v.pacote, preco: +p.preco }, vagas: { novas: v.pacote, total: Caixa.vagas(s, cfgJogo()) }, compra: { qtd: +p.preco }, vitrine: vitrine(c) });
    }
    carteira.debitar(c, +p.preco);
    if (!s.itens || typeof s.itens !== 'object') s.itens = {};
    s.itens[p.item] = (+s.itens[p.item] || 0) + (+p.qtd || 1);
    if (ref) { s.lojaRefs.push(ref); if (s.lojaRefs.length > MAX_REFS) s.lojaRefs.splice(0, s.lojaRefs.length - MAX_REFS); }
    salvarContas(); empurrarSave(u);
    for (const w of socketsDe(u)) enviar(w, { t: 'bolsa', op: 'loja', bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens, bolas: s.bolas } });
    return resp({ ok: true, comprou: { produto: PARA_TELA[p.id] || p.id, item: +p.item, qtd: +p.qtd || 1, preco: +p.preco }, compra: { qtd: +p.preco }, vitrine: vitrine(c) });
  }
  function empurrarSave(u) {
    const c = contas[u]; c.rev = (c.rev || 0) + 1;
    for (const w of socketsDe(u)) enviar(w, { t: 'save', save: c.save, rev: c.rev, caixaVagas: Caixa.vagas(c.save, cfgJogo()) });
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
    if (SkinMon.lerProduto(m.produto)) {                                      // a Pokémon skin
      const id = SkinMon.lerProduto(m.produto), k = skinsAVenda().find(x => x.id === id);
      if (!k) return resp({ ok: false, erro: 'recusado', mensagem: "That isn't for sale right now.", vitrine: vitrine(c) });
      if (skinsDe(s).includes(id)) return resp({ ok: false, erro: 'recusado', mensagem: 'You already have this skin.', vitrine: vitrine(c) });
      if (m.preco != null && +m.preco !== +k.preco) return resp({ ok: false, erro: 'preco-mudou', mensagem: 'The price changed: review and confirm again.', vitrine: vitrine(c) });
      const falta = +k.preco - carteira.de(c).total;
      if (falta > 0) return resp({ ok: false, erro: 'saldo-insuficiente', falta, mensagem: 'Not enough Diamonds.', vitrine: vitrine(c) });
      carteira.debitar(c, +k.preco);
      s.skinsMon = [...skinsDe(s), id];
      if (ref) { s.lojaRefs.push(ref); if (s.lojaRefs.length > MAX_REFS) s.lojaRefs.splice(0, s.lojaRefs.length - MAX_REFS); }
      salvarContas(); empurrarSave(u);
      return resp({ ok: true, comprou: { skinMon: id, preco: +k.preco }, skinsMon: s.skinsMon, vitrine: vitrine(c) });
    }
    if (!String(m.produto || '').startsWith('peca:')) return comprarProduto(c, u, m, ref, resp);
    const mt = /^peca:(roupa|mochila|peito|rastro):([\w-]{1,40})$/.exec(String(m.produto || ''));
    const p = mt && aVenda().find(x => x.tipo === mt[1] && String(x.id) === mt[2]);
    if (!p) return resp({ ok: false, erro: 'recusado', mensagem: "That isn't for sale right now.", vitrine: vitrine(c) });
    if (guarda.has(s, p.tipo, p.id)) return resp({ ok: false, erro: 'recusado', mensagem: 'You already have ' + p.nome + '.', vitrine: vitrine(c) });
    if (m.preco != null && +m.preco !== p.preco) return resp({ ok: false, erro: 'preco-mudou', mensagem: 'The price changed: review and confirm again.', vitrine: vitrine(c) });
    const falta = p.preco - carteira.de(c).total;
    if (falta > 0) return resp({ ok: false, erro: 'saldo-insuficiente', falta, mensagem: 'Not enough Diamonds.', vitrine: vitrine(c) });
    carteira.debitar(c, +p.preco);
    guarda.give(s, p.tipo, p.id);
    if (ref) { s.lojaRefs.push(ref); if (s.lojaRefs.length > MAX_REFS) s.lojaRefs.splice(0, s.lojaRefs.length - MAX_REFS); }
    salvarContas(); empurrarSave(u);
    return resp({ ok: true, comprou: { tipo: p.tipo, id: p.id, preco: +p.preco }, pecas: s.pecas, skins: s.skins, vitrine: vitrine(c) });
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

  /** The skin on per species that the client asks for: only owned skins of that very species (save.skinMon). */
  function skinMonValida(c, v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const tem = new Set(skinsDe(c.save || {})), out = {};
    for (const [k, id] of Object.entries(v)) if (/^pm\d{4}$/.test(k) && typeof id === 'string' && tem.has(id) && SkinMon.especieDe(id) === k) out[k] = id;
    return out;
  }
  return { receber, vitrine, info, darDiamantes, skinMonValida };
}
