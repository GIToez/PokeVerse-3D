/* Player Market window (v2 layout `mercado`). Ported from PokeFable's menus.mjs market section; the server side is
 * server_market.mjs. The city Pokémart stays on the menu key `mercado` in menus.mjs; this window is `feira`.
 * Buy / Sell / My listings / Prices, each with an items and a Pokémon variant. */
import * as Popup from './popup.mjs';
import * as Mercado from './market.mjs';
import * as I18n from './i18n.mjs';
import * as Chat from './chat.mjs';
import { t as tr } from './i18n.mjs';

let ctx = {};
let D = null;
let aberta = null, abaAtual = null;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const IC_MOEDA = '<img alt="" src="./ui/itens/ic_1.png" style="width:1.35em;height:1.35em;vertical-align:-0.35em;margin-right:2px">';
const dinheiro = () => ctx.lerLS?.('dinheiro', 0) ?? 0;
const defPopup = n => ctx.defPopup?.(n) || null;
const iconesTipo = (pop, raiz, tipos) => ctx.iconesTipo?.(pop, raiz, tipos);
const caberPilulasIvEv = a => { for (const b of a?.querySelectorAll('[data-fig^="tag-"] > .pf-rotulo') || []) ctx.caberTexto?.(b, 0.8); };
const abas = () => abaAtual;
function render(){ if (aberta === 'mercado' && popMc && Popup.aberto(popMc)) encherMercado(popMc); }

export function avisoDoServidor(a){
  const t = Mercado.textoAviso(a, tr, I18n.locale());
  if (t) Chat.sistema(tr('Market: {x}', { x: t }));
  try { ctx.Som?.tocar?.('ui/sound_click', { volume: 0.6 }); } catch {}
  mercadoAviso();
}
export function instalar(c){ ctx = { ...ctx, ...(c || {}) }; }
export const aberto = () => !!(popMc && Popup.aberto(popMc));
export function fechar(){ if (popMc && Popup.aberto(popMc)) Popup.fechar(popMc); }
export async function abrir(aba = null){
  try { D = await ctx.dados?.(); } catch {}
  aberta = 'mercado';
  abaAtual = aba || abaAtual || 'comprar';
  const p = popupMc();
  if (!p) { aberta = null; return false; }
  try { ctx.fecharMenu?.(); } catch {}
  aberta = 'mercado';
  Popup.abrir(p);
  ctx.Som?.tocar?.('ui/sound_click', { volume: 0.5 });
  if (!Mercado.catalogo()) await Mercado.carregar('./data/mercado.json').catch(e => console.warn('market:', e));
  render();
  return true;
}

const MC_CATS = [
  ['todas', 'All'],
  ['pokemon', 'Pokémon'],
  ['pokebolas', 'Poké Balls'],
  ['medicina', 'Medicine'],
  ['tms', 'TMs'],
  ['outros', 'Other'],
];
const MC_ORDENS = [
  ['preco-asc', 'price ↑'],
  ['preco-desc', 'price ↓'],
  ['expira', 'expiring soon'],
  ['nome', 'name'],
  ['nivel', 'level ↓'],
  ['iv', 'IV ↓'],
];
let mc = {
  cat: 'todas',
  busca: '',
  ordem: 'preco-asc',
  shiny: false,
  lvMin: 0,
  ivMin: 0,
  lvMax: 0,
  ivSomaMin: 0,
  evSomaMin: 0,
  txtNivel: '',
  txtIv: '',
  txtEv: '',
  pagina: 0,
  lista: null,
  minhas: null,
  precoItem: null,
  precos: null,
  ocupado: false,
  aviso: '',
};
const mcMoedas = (n) => Math.round(+n || 0).toLocaleString(I18n.locale()) + ' ₽';
const mcNumero = (n) => Math.round(+n || 0).toLocaleString(I18n.locale());
const mcIconeItem = (a) => {
  const i = D?.itens?.[a]?.i;
  return './ui/itens/' + (i || 'ic_' + a) + '.png';
};
const mcIconeMon = (m) => ctx.iconeMon?.(m?.glb) || '';
const mcEspecie = (d) => String(ctx.porDex?.get(+d)?.name || '').replace(/^(Nidoran)-[FM]$/, '$1');
function mcMon(m) {
  return Mercado.cartaoMon(m, mcEspecie);
}
const mcIvPerfeitos = (n) =>
  n === 0 ? tr('no perfect IVs') : n === 1 ? tr('1 perfect IV') : tr('{n} perfect IVs', { n });
function mcCartaoHtml(m) {
  const c = mcMon(m);
  if (!c) return '';
  const a = (a) =>
    `<i style="display:inline-block;width:62px;height:6px;background:#2a3550;border-radius:3px;vertical-align:middle;margin:0 6px"><b style="display:block;height:100%;width:${Math.round((a.valor / 31) * 100)}%;background:${a.maximo ? '#ffd23a' : '#86ef5f'};border-radius:3px"></b></i>`;
  return `<div class="mc-cartao"><div style="display:flex;align-items:center;gap:8px"><img src="${mcIconeMon(m)}" alt="" style="width:36px;height:36px">
    <div><b>${esc(c.nome)}${c.temApelido ? ` <small style="color:var(--muted)">(${esc(c.especie)})</small>` : ''}${c.shiny ? ' ✨' : ''}</b><br><small>Lv ${c.lv}${c.sexo ? ' · ' + (c.sexo === 'f' || c.sexo === 2 ? '♀' : '♂') : ''} · ${esc(tr(c.natureza))} <span style="color:var(--muted)">${esc(tr(c.naturezaDesc || ''))}</span></small></div></div>
    <div style="margin-top:6px;font-size:11px;line-height:16px">${c.ivs.map((b) => `<div><span style="display:inline-block;width:52px;color:var(--muted)">${esc(tr(b.nome))}</span>${a(b)}<b>${b.valor}</b></div>`).join('')}
    <div style="margin-top:4px">IV total <b>${c.ivSoma}/${c.ivTotal}</b> (${c.ivPorCento}%) · ${esc(mcIvPerfeitos(c.ivMaximos))}</div>${c.movs.length ? `<div style="color:var(--muted)">${c.movs.map((g) => esc(ctx.golpe?.(String(g))?.nome || String(g))).join(' · ')}</div>` : ''}</div></div>`;
}
function mcPodeAbrir() {
  if (!ctx.comConta?.())
    return ctx.conta?.estado?.().modo === 'conta'
      ? 'No connection to the server. Retrying…'
      : 'The Market is between players: sign in to an account.';
  if (ctx.jogo?.turno) return "You can't use the Market in the middle of a battle.";
  if (ctx.emTroca?.()) return 'Close the trade before opening the Market.';
  if (ctx.jogo?.raidArena || ctx.jogo?.raid) return "You can't use the Market during a raid.";
  return null;
}
const MC_MEXE = new Set(['anunciar', 'anunciar_mon', 'comprar', 'cancelar']);
async function mcPedir(a, b) {
  if (MC_MEXE.has(a)) {
    if (mc.ocupado) return { erro: 'wait for the previous request' };
    mc.ocupado = true;
    try {
      return await ctx.mercado(a, b);
    } finally {
      mc.ocupado = false;
    }
  }
  return ctx.mercado(a, b);
}
function mcAviso(a, b = '#f58e8e') {
  mc.aviso = a ? `<div style="margin:6px 0;color:${b};font-size:12px">${esc(tr(a))}</div>` : '';
}
function rMercado(a) {
  const b = mcPodeAbrir();
  if (b) {
    abas([]);
    a.innerHTML = `<div class="vazio">${esc(b)}</div>`;
    return;
  }
  if (!Mercado.catalogo()) {
    a.innerHTML = `<div class="vazio">${esc(tr('loading…'))}</div>`;
    Mercado.carregar('./data/mercado.json')
      .then(() => {
        if (aberta === 'mercado') render();
      })
      .catch((e) => {
        console.warn('mercado:', e);
        a.innerHTML = `<div class="vazio">${esc(tr("The Market didn't load. Try again."))}</div>`;
      });
    return;
  }
  const c = abas([
    { id: 'comprar', nome: 'Buy' },
    { id: 'vender', nome: 'Sell' },
    { id: 'minhas', nome: 'My listings' },
    { id: 'precos', nome: 'Prices' },
  ]);
  const R = Mercado.regras() || {};
  const d = `<div style="margin-top:10px;color:var(--muted);font-size:11px">market fee: ${Math.round((R.taxa || 0) * 100)}% when listing (non-refundable) · listings last ${R.validadeHoras || 48} h · up to ${mc.minhas?.limite || R.ofertasPorJogador || 8} listings per account · key items can't be sold</div>`;
  if (c === 'comprar') rComprar(a, d);
  else if (c === 'vender') rVender(a, d);
  else if (c === 'minhas') rMinhas(a, d);
  else rPrecos(a, d);
}
function mcLinhaOferta(o, a) {
  const b = Mercado.faltaPra(o, mc.agora || Date.now());
  if (o.tipo === 'pokemon') {
    const m = o.mon,
      c = mcMon(m);
    return `<div class="linha mc-linha" data-cartao="${o.id}" style="cursor:default"><img src="${mcIconeMon(m)}" alt="" style="width:34px;height:34px"><span class="nome"><b>${esc(c.nome)}${c.shiny ? ' ✨' : ''} <small>Lv ${c.lv} · IV ${c.ivPorCento}%</small></b><small>${esc(tr(c.natureza))} · ${esc(o.vendedor)} · ${esc(tr('expires in'))} ${b}</small></span><span style="text-align:right"><b>${mcMoedas(o.precoUnit)}</b></span>${a ? `<button type="button" class="btn ouro" data-acao="${a}" data-id="${o.id}">${esc(tr(a === 'comprar' ? 'Buy' : 'Cancel'))}</button>` : ''}<div class="mc-flutua" hidden>${mcCartaoHtml(m)}</div></div>`;
  }
  const d = Mercado.item(o.item) || { nome: 'item ' + o.item };
  return `<div class="linha" style="cursor:default"><img src="${mcIconeItem(o.item)}" alt="" style="width:34px;height:34px" onerror="this.style.visibility='hidden'"><span class="nome"><b>${esc(tr(d.nome))} <small>×${o.quantidade}</small></b><small>${esc(o.vendedor)} · ${esc(tr('expires in'))} ${b}</small></span><span style="text-align:right"><b>${mcMoedas(o.precoUnit)}</b><br><small style="color:var(--muted)">${esc(tr('each'))}</small></span>${a ? `<button type="button" class="btn ouro" data-acao="${a}" data-id="${o.id}" data-max="${o.quantidade}">${esc(tr(a === 'comprar' ? 'Buy' : 'Cancel'))}</button>` : ''}</div>`;
}
function mcLigarCartoes(a) {
  document.querySelectorAll('body > .mc-flutua').forEach((f) => f.remove());
  a.querySelectorAll('.mc-linha').forEach((l) => {
    const f = l.querySelector('.mc-flutua');
    if (!f) return;
    const a = () => {
      const r = l.getBoundingClientRect();
      document.body.appendChild(f);
      f.hidden = false;
      Object.assign(f.style, {
        position: 'fixed',
        left: Math.max(8, Math.min(innerWidth - 270, r.left + 44)) + 'px',
        top: '0px',
        zIndex: '60',
      });
      const h = f.offsetHeight;
      f.style.top = (r.bottom + h + 8 < innerHeight ? r.bottom + 2 : Math.max(8, r.top - h - 2)) + 'px';
    };
    const b = () => {
      f.hidden = true;
      if (f.parentElement !== l) l.appendChild(f);
    };
    l.addEventListener('mouseenter', a);
    l.addEventListener('mouseleave', b);
    l.addEventListener('click', (c) => {
      if (c.target.closest('button, input')) return;
      if (f.hidden) a();
      else b();
    });
  });
}
function mcFiltros(a) {
  return {
    cat: mc.cat,
    busca: mc.busca,
    ordem: mc.ordem,
    shiny: mc.shiny,
    lvMin: mc.lvMin,
    ivMin: mc.ivMin,
    lvMax: mc.lvMax,
    ivSomaMin: mc.ivSomaMin,
    evSomaMin: mc.evSomaMin,
    pagina: a,
  };
}
async function mcCarregarLista(a, b = 0) {
  const c = mc.pagina,
    r = await mcPedir('listar', mcFiltros(c));
  if (r.erro === 'pedido repetido') return;
  if (!r.erro && r.pagina !== c) {
    if (b < 2) mcCarregarLista(a, b + 1);
    return;
  }
  if (r.erro) {
    mcAviso(r.erro);
    mc.lista = { ofertas: [], total: 0, paginas: 1, erro: r.erro };
  } else {
    r.porPagina = Mercado.porPaginaDe(r);
    mc.lista = r;
    mc.agora = r.agora;
  }
  if (aberta === 'mercado' && abaAtual === 'comprar') render();
}
function rComprar(a, c) {
  const L = mc.lista;
  const d = mc.cat === 'pokemon';
  a.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">
    <select id="mc-cat">${MC_CATS.map(([a, n]) => `<option value="${a}"${mc.cat === a ? ' selected' : ''}>${esc(tr(n))}</option>`).join('')}</select>
    <input id="mc-busca" type="text" placeholder="${esc(tr('search'))}" value="${esc(mc.busca)}" style="width:130px">
    <select id="mc-ordem">${MC_ORDENS.filter(([a]) => d || !['nivel', 'iv'].includes(a))
      .map(([a, n]) => `<option value="${a}"${mc.ordem === a ? ' selected' : ''}>${esc(tr(n))}</option>`)
      .join('')}</select>
    ${d ? `<label style="font-size:12px"><input id="mc-shiny" type="checkbox"${mc.shiny ? ' checked' : ''}> shiny</label><label style="font-size:12px">Lv ≥ <input id="mc-lv" type="number" min="0" max="100" value="${mc.lvMin || ''}" style="width:52px"></label><label style="font-size:12px">IV ≥ <input id="mc-iv" type="number" min="0" max="100" value="${mc.ivMin || ''}" style="width:52px">%</label>` : ''}
    <button type="button" class="btn" id="mc-atualizar">↻</button><span style="flex:1"></span><span style="color:var(--muted);font-size:12px">${IC_MOEDA}${mcNumero(dinheiro())}</span></div>
    ${mc.aviso}<div class="lista" id="mc-lista">${!L ? `<div class="vazio">${esc(tr('loading…'))}</div>` : !L.ofertas.length ? `<div class="vazio">${esc(tr('No offers here yet. Be the first to list one!'))}</div>` : L.ofertas.map((o) => mcLinhaOferta(o, 'comprar')).join('')}</div>
    ${L && L.paginas > 1 ? `<div style="display:flex;gap:6px;justify-content:center;margin-top:8px"><button type="button" class="btn" id="mc-ant"${mc.pagina <= 0 ? ' disabled' : ''}>‹</button><span style="font-size:12px;line-height:28px">${mc.pagina + 1} / ${L.paginas}</span><button type="button" class="btn" id="mc-prox"${mc.pagina >= L.paginas - 1 ? ' disabled' : ''}>›</button></div>` : ''}${c}`;
  const e = (b = true) => {
    mc.lista = null;
    if (b) mc.aviso = '';
    render();
    mcCarregarLista(a);
  };
  a.querySelector('#mc-cat').onchange = (a) => {
    mc.cat = a.target.value;
    mc.pagina = 0;
    if (mc.cat !== 'pokemon' && ['nivel', 'iv'].includes(mc.ordem)) mc.ordem = 'preco-asc';
    e();
  };
  a.querySelector('#mc-ordem').onchange = (a) => {
    mc.ordem = a.target.value;
    e();
  };
  a.querySelector('#mc-busca').onchange = (a) => {
    mc.busca = a.target.value.trim();
    mc.pagina = 0;
    e();
  };
  a.querySelector('#mc-atualizar').onclick = e;
  a.querySelector('#mc-shiny')?.addEventListener('change', (a) => {
    mc.shiny = a.target.checked;
    e();
  });
  a.querySelector('#mc-lv')?.addEventListener('change', (a) => {
    mc.lvMin = +a.target.value || 0;
    e();
  });
  a.querySelector('#mc-iv')?.addEventListener('change', (a) => {
    mc.ivMin = +a.target.value || 0;
    e();
  });
  a.querySelector('#mc-ant')?.addEventListener('click', () => {
    mc.pagina--;
    e();
  });
  a.querySelector('#mc-prox')?.addEventListener('click', () => {
    mc.pagina++;
    e();
  });
  a.querySelectorAll('[data-acao="comprar"]').forEach(
    (b) =>
      (b.onclick = async () => {
        const o = L.ofertas.find((x) => x.id === b.dataset.id);
        if (!o) return;
        let a = 1;
        if (o.tipo === 'item' && o.quantidade > 1) {
          const v = prompt(tr('How many? (up to') + ' ' + o.quantidade + ')', String(o.quantidade));
          if (v == null) return;
          a = Math.max(1, Math.min(o.quantidade, Math.round(+v) || 0));
        }
        const c = a * o.precoUnit;
        if (
          !confirm(
            `${tr('Buy')} ${o.tipo === 'pokemon' ? mcMon(o.mon).nome + ' Lv' + o.mon.lv : a + '× ' + tr(Mercado.item(o.item)?.nome || 'item')} ${tr('for')} ${mcMoedas(c)}?`,
          )
        )
          return;
        b.disabled = true;
        const r = await mcPedir('comprar', { oferta: o.id, qtd: a });
        if (r.erro) {
          mcAviso(r.erro);
          render();
          return;
        }
        ctx.Som?.tocar?.('ui/sound_itemget', { volume: 0.6 });
        mcAviso(
          tr('Bought!') +
            ' ' +
            (r.comprou?.mon
              ? mcMon(r.comprou.mon).nome + ' ' + tr('is already with you.')
              : a + '× ' + tr(Mercado.item(o.item)?.nome || 'item') + ' ' + tr('in the bag.')),
          '#8fe08f',
        );
        e(false);
      }),
  );
  mcLigarCartoes(a);
  if (!L) mcCarregarLista(a);
}
function bolasAnunciaveis() {
  const a = ctx.lerLS('bolasPresas', {}) || {},
    b = {};
  for (const [c, n] of Object.entries(ctx.lerLS('bolas', {}) || {}))
    b[c] = Math.max(0, (+n || 0) - Math.max(0, +a[c] || 0));
  return b;
}
function rVender(d, e) {
  const g = { ...(ctx.lerLS('itens', {}) || {}), ...bolasAnunciaveis() };
  const h = Object.entries(g)
    .map(([a, n]) => ({ id: +a, n: +n, it: Mercado.item(a) }))
    .filter((x) => x.n > 0 && x.it)
    .sort((a, b) => a.it.nome.localeCompare(b.it.nome));
  const j = ctx.jogo?.time || [],
    k = ctx.lerLS('caixa', []) || [];
  const l = [...j.map((p, i) => ({ p, onde: 'time', i })), ...k.map((p, i) => ({ p, onde: 'caixa', i }))].filter(
    (x) => x.p && x.p.uid,
  );
  d.innerHTML = `${mc.aviso}<h3 style="margin:4px 0 6px;font-size:13px">${esc(tr('Items'))}</h3><div class="lista">${
    !h.length
      ? `<div class="vazio">${esc(tr('Nothing listable in your Bag.'))}</div>`
      : h
          .map((x) => {
            const f = Mercado.faixa(x.id);
            return `<div class="linha" style="cursor:default;flex-wrap:wrap"><img src="${mcIconeItem(x.id)}" alt="" style="width:30px;height:30px" onerror="this.style.visibility='hidden'"><span class="nome"><b>${esc(tr(x.it.nome))} <small>×${x.n}</small></b><small>${esc(tr('from'))} ${mcMoedas(f.piso)} ${esc(tr('to'))} ${mcMoedas(f.teto)}${f.naLoja ? ` · ${esc(tr('the shop sells it for'))} ${mcMoedas(f.naLoja)}` : ''}</small></span><label style="font-size:12px">qty <input type="number" min="1" max="${x.n}" value="${Math.min(x.n, 1)}" data-qtd="${x.id}" style="width:56px"></label><label style="font-size:12px">${esc(tr('each'))} <input type="number" min="${f.piso}" max="${f.teto}" value="${Math.min(f.teto, f.ref)}" data-preco="${x.id}" style="width:80px"></label><button type="button" class="btn ouro" data-anunciar="${x.id}">${esc(tr('List'))}</button></div>`;
          })
          .join('')
  }</div>
    <h3 style="margin:12px 0 6px;font-size:13px">${esc(tr('Pokémon'))} <small style="color:var(--muted);font-weight:400">${esc(tr('set your own price; buyers see the full details'))}</small></h3><div class="lista">${
      !l.length
        ? `<div class="vazio">${esc(tr('No Pokémon registered.'))}</div>`
        : l
            .map((x) => {
              const c = mcMon(x.p);
              return `<div class="linha mc-linha" style="cursor:default;flex-wrap:wrap"><img src="${mcIconeMon(x.p)}" alt="" style="width:30px;height:30px"><span class="nome"><b>${esc(c.nome)}${c.shiny ? ' ✨' : ''} <small>Lv ${c.lv} · IV ${c.ivPorCento}%</small></b><small>${esc(tr(x.onde === 'time' ? 'on team' : 'in the Box'))} · ${esc(tr(c.natureza))}</small></span><label style="font-size:12px">${esc(tr('price'))} <input type="number" min="1" value="" placeholder="₽" data-preco-mon="${x.p.uid}" style="width:96px"></label><button type="button" class="btn ouro" data-anunciar-mon="${x.p.uid}">${esc(tr('List'))}</button><div class="mc-flutua" hidden>${mcCartaoHtml(x.p)}</div></div>`;
            })
            .join('')
    }</div>${e}`;
  d.querySelectorAll('[data-anunciar]').forEach(
    (b) =>
      (b.onclick = async () => {
        const a = +b.dataset.anunciar,
          c = Math.round(+d.querySelector(`[data-qtd="${a}"]`).value) || 1,
          e = Math.round(+d.querySelector(`[data-preco="${a}"]`).value) || 0;
        const { taxa: f, total: g } = Mercado.custoDeAnunciar(e, c);
        if (
          !confirm(
            `${tr('List')} ${c}× ${tr(Mercado.item(a)?.nome || 'item')} ${tr('for')} ${mcMoedas(e)} ${tr('each')} (${mcMoedas(g)})?\n${tr('Fee now')}: ${mcMoedas(f)} — ${tr("it's not refunded, even if you cancel.")}`,
          )
        )
          return;
        b.disabled = true;
        const r = await mcPedir('anunciar', { item: a, qtd: c, preco: e });
        if (r.erro) {
          mcAviso(r.erro);
          render();
          return;
        }
        ctx.Som?.tocar?.('ui/sound_click', { volume: 0.6 });
        mcAviso(tr("Listed! It's in the My Offers tab."), '#8fe08f');
        mc.minhas = null;
        render();
      }),
  );
  d.querySelectorAll('[data-anunciar-mon]').forEach(
    (b) =>
      (b.onclick = async () => {
        const a = b.dataset.anunciarMon,
          c = Math.round(+d.querySelector(`[data-preco-mon="${a}"]`).value) || 0;
        const x = l.find((y) => String(y.p.uid) === String(a));
        if (!x) return;
        if (!(c > 0)) {
          mcAviso(tr('Name a price.'));
          render();
          return;
        }
        const { taxa: e } = Mercado.custoDeAnunciar(c, 1);
        if (
          !confirm(
            `${tr('List')} ${mcMon(x.p).nome} Lv${x.p.lv} ${tr('for')} ${mcMoedas(c)}?\n${tr('Fee now')}: ${mcMoedas(e)} — ${tr("won't be refunded, even if you cancel. It leaves your team until it sells or is canceled.")}`,
          )
        )
          return;
        b.disabled = true;
        const r = await mcPedir('anunciar_mon', { uid: a, preco: c });
        if (r.erro) {
          mcAviso(r.erro);
          render();
          return;
        }
        ctx.Som?.tocar?.('ui/sound_click', { volume: 0.6 });
        mcAviso(tr("Listed! It's in the My Offers tab."), '#8fe08f');
        mc.minhas = null;
        render();
      }),
  );
  mcLigarCartoes(d);
}
async function mcCarregarMinhas() {
  const r = await mcPedir('minhas', {});
  if (r.erro === 'pedido repetido') return;
  if (r.erro) {
    mcAviso(r.erro);
    mc.minhas = { ofertas: [], avisos: [] };
  } else {
    mc.minhas = r;
    mc.agora = r.agora;
    for (const a of r.avisos || []) {
      const t = Mercado.textoAviso(a.aviso, tr, I18n.locale());
      if (t) Chat.sistema(tr('Market: {x}', { x: t }));
      else Chat.sistema('Market: ' + a.texto);
    }
  }
  if (aberta === 'mercado' && (abaAtual === 'minhas' || abaAtual === 'minhas-ofertas' || abaAtual === 'vender'))
    render();
}
function rMinhas(c, d) {
  const M = mc.minhas;
  c.innerHTML = `${mc.aviso}${M?.avisos?.length ? `<div style="margin-bottom:8px;font-size:12px;color:#8fe08f">${M.avisos.map((a) => '• ' + esc(Mercado.textoAviso(a.aviso, tr, I18n.locale()) || tr(a.texto))).join('<br>')}</div>` : ''}<div class="lista">${!M ? `<div class="vazio">${esc(tr('loading…'))}</div>` : !M.ofertas.length ? `<div class="vazio">${esc(tr('You have no active listings.'))}</div>` : M.ofertas.map((o) => mcLinhaOferta(o, 'cancelar')).join('')}</div>${d}`;
  c.querySelectorAll('[data-acao="cancelar"]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm(tr("Cancel this listing? Its contents return to you; the fee doesn't."))) return;
        b.disabled = true;
        const r = await mcPedir('cancelar', { oferta: b.dataset.id });
        if (r.erro) {
          mcAviso(r.erro);
          render();
          return;
        }
        mcAviso(tr('Canceled.'), '#8fe08f');
        mc.minhas = null;
        render();
        mcCarregarMinhas();
      }),
  );
  mcLigarCartoes(c);
  if (!M) mcCarregarMinhas();
}
function rPrecos(a, c) {
  const P = mc.precos;
  a.innerHTML = `${mc.aviso}<div style="display:flex;gap:6px;margin-bottom:8px"><input id="mc-pbusca" type="text" placeholder="${esc(tr('item name'))}" value="${esc(mc.precoItem?.nome || '')}" style="flex:1"><button type="button" class="btn" id="mc-pver">${esc(tr('View'))}</button></div>
    <div id="mc-psug"></div>
    ${
      P
        ? `<div class="linha" style="cursor:default;flex-wrap:wrap"><img src="${mcIconeItem(P.item)}" alt="" style="width:34px;height:34px" onerror="this.style.visibility='hidden'"><span class="nome"><b>${esc(tr(P.estatistica.nome))}</b><small>${esc(tr('reference'))} ${mcMoedas(P.estatistica.referencia)}${P.estatistica.naLoja ? ` · ${esc(tr('the shop sells it for'))} ${mcMoedas(P.estatistica.naLoja)}` : ''}</small></span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-top:8px;font-size:12px">${[
      [tr('sales'), P.estatistica.vendas],
      [tr('median'), P.estatistica.mediana != null ? mcMoedas(P.estatistica.mediana) : '—'],
      [tr('lowest'), P.estatistica.menor != null ? mcMoedas(P.estatistica.menor) : '—'],
      [tr('highest'), P.estatistica.maior != null ? mcMoedas(P.estatistica.maior) : '—'],
      [tr('cheapest now'), P.estatistica.aberta != null ? mcMoedas(P.estatistica.aberta) : '—'],
      [tr('in stock'), P.estatistica.emEstoque],
    ]
      .map(
        ([k, v]) =>
          `<div class="linha" style="cursor:default;justify-content:space-between"><small style="color:var(--muted)">${esc(k)}</small><b>${esc(String(v))}</b></div>`,
      )
      .join('')}</div>`
        : `<div class="vazio">${esc(tr("Search for an item to see what it's going for on the market (median, not average: one odd sale doesn't move the number)."))}</div>`
    }${c}`;
  const d = Mercado.catalogo()?.itens || {};
  const e = () => {
    const q = a.querySelector('#mc-pbusca').value.trim().toLowerCase();
    const s = a.querySelector('#mc-psug');
    if (q.length < 2) {
      s.innerHTML = '';
      return;
    }
    const c = Object.entries(d)
      .filter(([, a]) => (a.nome + ' ' + (a.busca || '')).toLowerCase().includes(q))
      .slice(0, 8);
    s.innerHTML = c
      .map(
        ([a, b]) =>
          `<button type="button" class="btn" data-pitem="${a}" style="margin:0 4px 4px 0">${esc(tr(b.nome))}</button>`,
      )
      .join('');
    s.querySelectorAll('[data-pitem]').forEach((b) => (b.onclick = () => f(+b.dataset.pitem)));
  };
  const f = async (a) => {
    const r = await mcPedir('precos', { item: a });
    if (r.erro) {
      mcAviso(r.erro);
      render();
      return;
    }
    mc.precoItem = { id: a, nome: d[a]?.nome || '' };
    mc.precos = r;
    mc.aviso = '';
    render();
  };
  a.querySelector('#mc-pbusca').oninput = e;
  a.querySelector('#mc-pver').onclick = () => {
    const q = a.querySelector('#mc-pbusca').value.trim().toLowerCase();
    const b = mcAcharItem(q);
    if (b) f(+b[0]);
    else e();
  };
}
export function mercadoAviso() {
  mc.minhas = null;
  if (!(mc.lista?.ofertas?.length > (mc.lista?.porPagina || 40))) mc.lista = null;
  if (aberta === 'mercado') render();
}
let popMc = null,
  mcv = { sel: 0, qtd: 1, preco: 0, uidMon: null, precoMon: 0 },
  mcd = { oferta: null, qtd: 1 },
  mcp = { item: null, dados: null, q: '' };
const MC_CAT_MAQUETE = {
  'cat-todas': 'todas',
  'cat-pokemon': 'pokemon',
  'cat-pokebolas': 'pokebolas',
  'cat-medicina': 'medicina',
  'cat-tms': 'tms',
  'cat-bagas': 'bagas',
  'cat-outros': 'outros',
};
const MC_ABA_MAQUETE = {
  comprar: 'comprar',
  vender: 'vender',
  minhas: 'minhas-ofertas',
  'minhas-ofertas': 'minhas-ofertas',
  precos: 'precos',
};
const MC_IV_COMO = 'total';
const MC_FAIXAS_IV = 'amanda';
const MC_PRECO_MON = 'media';
const MC_RECEBE = 'liquido';
const MC_FAIXAS = {
  amanda: (v) => (v >= 31 ? { cor: '#F5B93B', fio: '#FFE7A0', num: '#F5B93B' } : { cor: '#C77DFF', num: '#E2B8FF' }),
  bancada: (v) =>
    v >= 31 ? { cor: '#F5B93B' } : v >= 25 ? { cor: '#43D17C' } : v >= 15 ? { cor: '#E9D46B' } : { cor: '#8C9BB0' },
};
const MC_VARIANTES = ['comprar', 'vender', 'precos'];
const MC_IVS = ['iv-hp', 'iv-ataque', 'iv-defesa', 'iv-at-esp', 'iv-def-esp', 'iv-velocidade'];
let mcpm = { dex: null, dados: null, q: '' };
const mcEhMon = () => mc.cat === 'pokemon';
const mcSimples = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
const mcCabeca = (a) => (+a > 0 ? './ui/mon/pm' + String(Math.round(+a)).padStart(4, '0') + '.png' : null);
const mcNv = (n) => tr('Lv {n}', { n });
const mcIvCurto = (k) => (MC_IV_COMO === 'porcento' ? 'IV ' + k.ivPorCento + '%' : 'IV ' + k.ivSoma);
const mcIvTotal = (k) => (MC_IV_COMO === 'porcento' ? k.ivPorCento + '%' : k.ivSoma + '/' + k.ivTotal);
const mcIvVenda = (a) => (MC_IV_COMO === 'porcento' ? 'IV ' + Math.round((a / 186) * 100) + '%' : 'IV ' + a);
const mcNomeMon = (k) => (k.temApelido ? k.nome + ' (' + k.especie + ')' : k.nome);
const mcNoDe = (a, b) => a?.querySelector(':scope > [data-fig="' + b + '"]') || null;
const mcSelo = (c) => mcNoDe(c, 'selo-shiny') || c?.querySelector(':scope > [data-fig^="camada-"]') || null;
function mcCelsDe(d, e) {
  const n = (c) => +c.dataset.fig.slice(e.length + 1);
  return [...(d?.querySelectorAll(':scope > [data-fig^="' + e + '-"]') || [])]
    .filter((c) => /^\d+$/.test(c.dataset.fig.slice(e.length + 1)))
    .sort((a, b) => n(a) - n(b));
}
function mcMolde(a, d = []) {
  if (!a) return null;
  const b = a.cloneNode(true);
  for (const c of d)
    for (const f of c.children) {
      const n = f.dataset.fig;
      if (n && !mcNoDe(b, n)) b.appendChild(f.cloneNode(true));
    }
  return { arte: a.style.backgroundImage, html: b.innerHTML };
}
function mcVestir(c, M, a) {
  const e = M?.[a] ? a : 'normal';
  if (!c || !M?.[e] || c.dataset.estado === e) return;
  c.innerHTML = M[e].html;
  c.style.backgroundImage = M[e].arte;
  c.dataset.estado = e;
}
function mcCampo(a, b, c) {
  const i = a?.querySelector('[data-fig="' + b + '"] input');
  if (i && document.activeElement !== i && i.value !== String(c ?? '')) i.value = String(c ?? '');
  return i;
}
function mcMarcar(a, b) {
  for (const g of a?.querySelectorAll('[data-tag="filtro"]') || []) {
    const c = g.dataset.tagval === b;
    for (const m of g.querySelectorAll(':scope > [data-sobre="ativa"], :scope > [data-fig="marca-ativa"]'))
      m.style.display = c ? 'block' : 'none';
    for (const t of g.querySelectorAll('[data-txt]')) t.style.color = c ? '#1D2B45' : '#EAF6FB';
    g.dataset.filtro = c ? 'ativo' : '';
  }
}
function mcModos(a) {
  for (const g of a?.querySelectorAll('[data-fig^="modo-"]') || [])
    Popup.texto(popMc, 'modo', g.dataset.tagval === 'pokemon' ? 'Pokémon' : 'Items', g);
  mcMarcar(a, mcEhMon() ? 'pokemon' : 'itens');
}
function mcTrocarCat(c) {
  if (!c || mc.cat === c) return false;
  const a = mcEhMon();
  mc.cat = c;
  mc.pagina = 0;
  mc.lista = null;
  mc.aviso = '';
  if (c !== 'pokemon' && ['nivel', 'iv'].includes(mc.ordem)) mc.ordem = 'preco-asc';
  if (a !== mcEhMon()) {
    mc.busca = '';
    mc.shiny = false;
    mc.lvMin = mc.lvMax = mc.ivMin = mc.ivSomaMin = mc.evSomaMin = 0;
    mc.txtNivel = mc.txtIv = mc.txtEv = '';
    if (popMc) {
      Popup.mostrarExtra(popMc, 'dialogo-comprar', false);
      Popup.mostrarExtra(popMc, 'dialogo-comprar-mon', false);
    }
  }
  return true;
}
function mcVariante(a, b) {
  const c = a.querySelector(':scope > [data-variante="' + b + '"]');
  if (c) return c;
  const R = a.__refs?.['conteudo-' + b]?.pokemon;
  if (!R?.filhos?.length) return null;
  const d = a.querySelector(':scope > [data-fig="conteudo-comprar"]');
  const e = {
    nome: 'mc-mon-' + b,
    w: R.w,
    h: R.h,
    img: R.img || null,
    imgPad: R.imgPad || 0,
    filhos: R.filhos,
    refs: a.__def?.refs || {},
    tipos: a.__def?.tipos || {},
    v2: true,
  };
  const v = Popup.montar(e, { ...a.__cb, fechar: () => Popup.fechar(a) }, a);
  if (!v) return null;
  v.className = 'pf-grupo';
  v.removeAttribute('id');
  v.dataset.variante = b;
  Object.assign(v.style, {
    position: 'absolute',
    left: d?.style.left || '0px',
    top: d?.style.top || '0px',
    transform: 'none',
    zIndex: '900',
    display: 'none',
  });
  mcCamposDaMaquete(v);
  if (b === 'comprar') mcPrepararComprarMon(a, v);
  else if (b === 'vender') mcPrepararVenderMon(a, v);
  else mcPrepararPrecosMon(a, v);
  return v;
}
function mcCamposDaMaquete(a) {
  for (const b of a.querySelectorAll('input[data-busca]')) {
    b.style.color = '#EAF6FB';
    const t = b.parentElement;
    if (t?.tagName !== 'SPAN' || !t.dataset.fs) continue;
    Object.assign(b.style, {
      fontSize: t.dataset.fs + 'px',
      fontWeight: t.style.fontWeight || b.style.fontWeight,
      textAlign: t.style.textAlign || 'left',
      left: '0px',
      width: '100%',
    });
  }
}
function mcMostrarVariante(b, c, d = true) {
  const e = d && mcEhMon() && MC_VARIANTES.includes(c) && !!mcVariante(b, c);
  for (const a of MC_VARIANTES) {
    const v = b.querySelector(':scope > [data-variante="' + a + '"]');
    if (v) v.style.display = e && a === c ? 'block' : 'none';
  }
  if (!e) return false;
  if (c === 'comprar') {
    const f = b.querySelector(':scope > [data-fig="conteudo-comprar"]');
    if (f) f.style.display = 'none';
  } else Popup.mostrarExtra(b, 'conteudo-' + c, false);
  return true;
}
let defMcV2 = null,
  defMcPedindo = false;
function defMercado() {
  const d = defPopup('mercado');
  if (d?.v2) return d;
  if (defMcV2) return defMcV2;
  if (!defMcPedindo) {
    defMcPedindo = true;
    fetch('./ui/hud_layout_v2.json')
      .then((r) => r.json())
      .then((j) => {
        const a = ctx.MOBILE ? 'deitado' : 'pc';
        defMcV2 = j?.popups?.[a]?.mercado || null;
        if (defMcV2 && aberta === 'mercado') abrir(abaAtual);
      })
      .catch((e) => console.warn('market: layout v2:', e));
  }
  return null;
}
function popupMc() {
  if (popMc) return popMc;
  const a = defMercado();
  if (new URLSearchParams(location.search).get('popup') === '0' || !a) return null;
  popMc = Popup.montar(a, {
    aba: (a) => {
      if (MC_CAT_MAQUETE[a]) {
        mcTrocarCat(MC_CAT_MAQUETE[a]);
        render();
        return;
      }
      if (MC_ABA_MAQUETE[a] && abaAtual !== MC_ABA_MAQUETE[a]) {
        abaAtual = MC_ABA_MAQUETE[a];
        mc.aviso = '';
        render();
      }
    },
    filtro: (a) => {
      const c = a === 'itens' ? (mcEhMon() ? 'todas' : null) : Object.values(MC_CAT_MAQUETE).includes(a) ? a : null;
      if (c) mcTrocarCat(c);
      render();
    },
    acao: (a, b) => mcAcaoPopup(popMc, a, b),
    abrir: () => {
      if (mc.lista?.erro) mc.lista = null;
    },
    abre: (a, b) => {
      if (a === 'dialogo-comprar') return mcAbrirDialogo(popMc, b);
      if (a === 'dialogo-comprar-mon') return mcAbrirDialogoMon(popMc, b);
      return false;
    },
    digita: (v, a) => mcDigitou(popMc, v, a),
    fechar: () => {
      if (aberta === 'mercado') aberta = null;
      try { ctx.aoFecharJanela?.(); } catch {}
      document.querySelectorAll('body > .mc-flutua').forEach((f) => f.remove());
      Popup.mostrarExtra(popMc, 'dialogo-comprar', false);
      Popup.mostrarExtra(popMc, 'dialogo-comprar-mon', false);
      mcd.oferta = null;
      mcMarcarSelecionada(popMc);
      clearTimeout(mc.__tTrava);
    },
  });
  for (const g of popMc.querySelectorAll('[data-fig^="cat-"][data-tag="aba"]')) g.dataset.tag = 'cat';
  popMc.addEventListener(
    'click',
    (a) => {
      if (a.target.closest?.('[data-tag="fecha"][data-tagval="dialogo-comprar-mon"]'))
        setTimeout(() => {
          mcd.oferta = null;
          mcMarcarSelecionada(popMc);
        }, 0);
    },
    true,
  );
  mcCamposDaMaquete(popMc);
  popMc.addEventListener(
    'scroll',
    (a) => {
      if (a.target?.dataset?.fig === 'lista-ofertas') mcPertoDoFim(a.target);
    },
    true,
  );
  return popMc;
}
function mcMostrarAba(a, b) {
  const c = a.querySelector('[data-fig="conteudo-comprar"]');
  const e = parseFloat(c?.style.left) || 0,
    f = parseFloat(c?.style.top) || 0;
  for (const g of ['conteudo-vender', 'conteudo-minhas-ofertas', 'conteudo-precos']) {
    const d = Popup.extra(a, g);
    if (!d) continue;
    d.style.transform = '';
    if (g !== 'conteudo-' + b) {
      Popup.mostrarExtra(a, g, false);
      continue;
    }
    Popup.mostrarExtra(a, g, true, { x: e, y: f });
    d.style.pointerEvents = 'auto';
  }
}
function mcRotulos(a) {
  for (const [b, c] of [
    ['aba-comprar', 'Buy'],
    ['aba-vender', 'Sell'],
    ['aba-minhas-ofertas', 'My listings'],
    ['aba-precos', 'Prices'],
  ]) {
    const g = Popup.grupo(a, b);
    if (!g) continue;
    const t = g.querySelector('[data-txt="aba"]');
    if (t) t.textContent = tr(c);
    else {
      const r = g.querySelector('.pf-rotulo');
      if (r && !r.textContent.trim()) r.textContent = tr(c);
    }
  }
  for (const g of a.querySelectorAll('[data-fig^="cat-"]')) {
    const d = MC_CAT_MAQUETE[g.dataset.fig];
    if (!d) continue;
    const t = g.querySelector('[data-txt="cat"], .pf-rotulo');
    if (t) t.textContent = tr(d === 'pokemon' ? 'Pokémon' : t.dataset.exemplo || t.textContent || d);
  }
}
function mcCatMarcar(a) {
  const b = !Object.values(Mercado.catalogo()?.itens || {}).some((x) => x.cat === 'bagas');
  for (const g of a.querySelectorAll('[data-fig^="cat-"]')) {
    const c = MC_CAT_MAQUETE[g.dataset.fig];
    if (!c) continue;
    const d = mc.cat === c;
    if (c === 'bagas') {
      g.style.pointerEvents = b ? 'none' : '';
      g.title = b ? tr('Berries: arrive with the garden') : '';
      if (b) {
        g.style.opacity = '0.35';
        const f = g.querySelector(':scope > [data-fig="marca-ativa"]');
        if (f) f.style.display = 'none';
        continue;
      }
    }
    const e = g.querySelector(':scope > [data-fig="marca-ativa"]');
    if (e) e.style.display = d ? 'block' : 'none';
    g.style.opacity = d || e ? '1' : '0.62';
    const t = g.querySelector('[data-txt="cat"]');
    if (t && e) t.style.color = d ? '#1D2B45' : '#EAF6FB';
  }
}
function encherMercado(a) {
  const b = mcPodeAbrir();
  const d = MC_ABA_MAQUETE[abaAtual] || 'comprar';
  abaAtual = d;
  Popup.trocarAba(a, d);
  mcMostrarAba(a, d);
  Popup.rotulo(a, 'titulo');
  Popup.texto(a, 'titulo', tr('Market'));
  mcRotulos(a);
  {
    const c = a.querySelector(':scope > .mc-contagem');
    if (c) c.style.display = 'none';
  }
  if (b) {
    mcTravado(a, d, b);
    return;
  }
  mcVeu(a, false);
  if (!Mercado.catalogo()) {
    mcMostrarVariante(a, d, false);
    Mercado.carregar('./data/mercado.json')
      .then(() => {
        if (aberta === 'mercado') render();
      })
      .catch((e) => console.warn('mercado:', e));
    mcVazio(a, tr('loading…'));
    return;
  }
  mcVazio(a, null);
  const f = mcMostrarVariante(a, d);
  if (d === 'comprar') (f ? mcEncherComprarMon : mcEncherComprar)(a);
  else if (d === 'vender') (f ? mcEncherVenderMon : mcEncherVender)(a);
  else if (d === 'minhas-ofertas') mcEncherMinhas(a);
  else (f ? mcEncherPrecosMon : mcEncherPrecos)(a);
}
function mcTravado(a, b, c) {
  mcMostrarVariante(a, b);
  Popup.mostrarExtra(a, 'dialogo-comprar', false);
  Popup.mostrarExtra(a, 'dialogo-comprar-mon', false);
  mcd.oferta = null;
  mcVeu(a, true);
  mcVazio(a, c, '#EAF6FB', true);
  clearTimeout(mc.__tTrava);
  mc.__tTrava = setTimeout(function a() {
    if (aberta !== 'mercado' || !popMc || !Popup.aberto(popMc)) return;
    if (mcPodeAbrir()) {
      mc.__tTrava = setTimeout(a, 1500);
      return;
    }
    mc.lista = null;
    mc.minhas = null;
    render();
  }, 1500);
}
function mcVeu(a, b) {
  let v = a.querySelector(':scope > .mc-veu');
  if (!b) {
    if (v) v.style.display = 'none';
    return;
  }
  const c = a.querySelector(':scope > [data-fig="conteudo-comprar"]');
  if (!c) return;
  if (!v) {
    v = document.createElement('div');
    v.className = 'mc-veu';
    Object.assign(v.style, {
      position: 'absolute',
      zIndex: '955',
      background: 'rgba(8, 14, 30, 0.72)',
      borderRadius: Math.round(12 * Math.min(1, (a.__def?.w || 1400) / 1400)) + 'px',
      pointerEvents: 'auto',
    });
    for (const t of ['click', 'pointerdown', 'mousedown', 'touchstart', 'wheel'])
      v.addEventListener(t, (a) => a.stopPropagation());
    a.appendChild(v);
  }
  Object.assign(v.style, {
    left: c.style.left,
    top: c.style.top,
    width: c.style.width,
    height: c.style.height,
    display: 'block',
  });
}
const mcDireto = (a) => ({ querySelector: (s) => a.querySelector(':scope > ' + s) });
function mcVazio(a, b, c = '#EAF6FB', e = false) {
  let f = a.querySelector(':scope > .mc-aviso');
  if (!f) {
    const k = Math.min(1, (a.__def?.w || 1400) / 1400),
      h = Math.max(9, Math.round(14 * (k < 1 ? k * 1.3 : 1)));
    f = document.createElement('div');
    f.className = 'mc-aviso';
    Object.assign(f.style, {
      position: 'absolute',
      left: '50%',
      bottom: Math.round(8 * k) + 'px',
      transform: 'translateX(-50%)',
      zIndex: '80',
      padding: Math.round(6 * k) + 'px ' + Math.round(14 * k) + 'px',
      borderRadius: Math.round(10 * k) + 'px',
      background: '#0b1020e6',
      border: '1px solid #f8c237',
      font: '700 ' + h + 'px "Nunito Sans", system-ui, sans-serif',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    });
    a.appendChild(f);
    f.__bottom = f.style.bottom;
  }
  const g = !b || c === '#EAF6FB';
  if (g && !e && f.__ate > Date.now()) {
    f.__depois = b || null;
    return;
  }
  clearTimeout(f.__t);
  f.__ate = 0;
  f.__depois = null;
  f.style.zIndex = e ? '961' : '80';
  f.style.display = b ? 'block' : 'none';
  f.style.color = c;
  if (b) f.textContent = tr(b);
  mcLugarDoAviso(a, f, !!b && g && !e);
  if (b && !g) {
    f.__ate = Date.now() + 3500;
    f.__t = setTimeout(() => {
      f.__ate = 0;
      const d = f.__depois;
      f.__depois = null;
      f.style.display = d ? 'block' : 'none';
      f.style.color = '#EAF6FB';
      if (d) f.textContent = tr(d);
      mcLugarDoAviso(a, f, !!d);
    }, 3500);
  }
}
function mcLugarDoAviso(a, b, c) {
  let d = null,
    e = 0;
  if (c)
    for (const l of a.querySelectorAll('[data-fig^="lista-"]')) {
      if (!l.offsetParent) continue;
      const r = l.getBoundingClientRect();
      if (r.width * r.height > e) {
        e = r.width * r.height;
        d = r;
      }
    }
  if (d) {
    const k = a.__escala || 1,
      f = a.getBoundingClientRect();
    Object.assign(b.style, {
      left: (d.left + d.width / 2 - f.left) / k + 'px',
      top: (d.top + d.height / 2 - f.top) / k + 'px',
      bottom: 'auto',
      transform: 'translate(-50%, -50%)',
      background: 'none',
      border: '0',
      whiteSpace: 'normal',
      textAlign: 'center',
      width: Math.round((d.width / k) * 0.9) + 'px',
    });
  } else
    Object.assign(b.style, {
      left: '50%',
      top: 'auto',
      bottom: b.__bottom || '8px',
      transform: 'translateX(-50%)',
      background: '#0b1020e6',
      border: '1px solid #f8c237',
      whiteSpace: 'nowrap',
      textAlign: '',
      width: '',
    });
}
function mcLinhaMaquete(a, c, o) {
  for (const f of c.children) {
    if (f.dataset.fig === 'selo-shiny-jogo') continue;
    f.style.display = f.dataset.txt ? f.dataset.display || 'flex' : 'block';
  }
  {
    const d = c.querySelector(':scope > [data-fig="marca-selecionado"]');
    if (d) d.style.display = 'none';
  }
  const b = Mercado.faltaPra(o, mc.agora || Date.now());
  if (o.tipo === 'pokemon') {
    const m = o.mon,
      k = mcMon(m);
    Popup.imagem(a, 'item', mcIconeMon(m), c);
    Popup.textoCru(a, 'item-nome', `${k.nome} · ${mcNv(k.lv)} · ${mcIvCurto(k)}`, c);
    Popup.texto(a, 'qtd', '1', c);
    mcEstrelaJunto(a, c, c.querySelector(':scope > [data-var="item"]'), k.shiny);
  } else {
    const e = Mercado.item(o.item) || { nome: 'item ' + o.item };
    Popup.imagem(a, 'item', mcIconeItem(o.item), c);
    Popup.textoCru(a, 'item-nome', tr(e.nome), c);
    Popup.texto(a, 'qtd', String(o.quantidade), c);
    mcEstrelaJunto(a, c, null, false);
  }
  Popup.texto(a, 'preco-unit', mcMoedas(o.precoUnit), c);
  Popup.texto(a, 'preco-total', mcMoedas(o.precoUnit * o.quantidade), c);
  Popup.textoCru(a, 'vendedor', o.vendedor, c);
  Popup.texto(a, 'expira', b, c);
  c.dataset.oferta = o.id;
}
const mcListaVisivel = (a) =>
  [...(a?.querySelectorAll('[data-fig="lista-ofertas"]') || [])].find((l) => l.offsetParent && l.clientHeight) || null;
function mcListaDoVisualNovo() {
  if (mc.lista && !mc.lista.erro && mc.lista.pagina > 0) mc.lista = null;
  if (!mc.lista) mc.pagina = 0;
  return mc.lista;
}
function mcPertoDoFim(l) {
  if (!l || aberta !== 'mercado' || abaAtual !== 'comprar' || !l.offsetParent || !l.clientHeight) return;
  if (l.scrollTop + l.clientHeight * 2 >= l.scrollHeight) mcCarregarMais();
}
async function mcCarregarMais() {
  const L = mc.lista;
  if (!Mercado.temMais(L) || L.__pedindo || Date.now() < (L.__espera || 0) || (L.__vazias || 0) >= 3) return;
  L.__pedindo = true;
  mcPintarContagem(popMc);
  let r;
  try {
    r = await Mercado.maisOfertas(L, (p) => mcPedir('listar', mcFiltros(p)), { valendo: () => mc.lista === L });
  } catch (e) {
    r = { erro: String(e?.message || e) };
  } finally {
    L.__pedindo = false;
  }
  if (r.velha || mc.lista !== L) return;
  if (!r.erro) {
    L.ofertas = r.ofertas;
    L.total = r.total;
    L.paginas = r.paginas;
    L.prox = r.prox;
    L.fim = r.fim;
    if (r.agora) mc.agora = r.agora;
  }
  if (r.erro || !r.novas) {
    L.__espera = Date.now() + 3000;
    if (!r.erro) L.__vazias = (L.__vazias || 0) + 1;
    setTimeout(() => {
      if (mc.lista === L && popMc && Popup.aberto(popMc)) mcPertoDoFim(mcListaVisivel(popMc));
    }, 3100);
  } else L.__vazias = 0;
  if (aberta === 'mercado' && abaAtual === 'comprar') render();
  else mcPintarContagem(popMc);
}
function mcPintarContagem(c) {
  if (!c) return;
  let d = c.querySelector(':scope > .mc-contagem');
  const L = mc.lista,
    l = abaAtual === 'comprar' ? mcListaVisivel(c) : null;
  if (!(l && L && !L.erro && L.ofertas?.length && (L.paginas > 1 || L.total > L.ofertas.length))) {
    if (d) d.style.display = 'none';
    return;
  }
  if (!d) {
    const k = Math.min(1, (c.__def?.w || 1400) / 1400),
      f = Math.max(8, Math.round(12 * (k < 1 ? k * 1.1 : 1)));
    d = document.createElement('div');
    d.className = 'mc-contagem';
    Object.assign(d.style, {
      position: 'absolute',
      zIndex: '950',
      transform: 'translateX(-100%)',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      color: '#9FB3C8',
      font: '600 ' + f + 'px "Nunito Sans", system-ui, sans-serif',
      lineHeight: '1.2',
    });
    c.appendChild(d);
  }
  const k = c.__escala || 1,
    e = c.getBoundingClientRect(),
    r = l.getBoundingClientRect();
  d.textContent = L.__pedindo
    ? tr('loading…')
    : tr('{a} of {b}', { a: mcNumero(Math.min(L.ofertas.length, L.total)), b: mcNumero(L.total) });
  Object.assign(d.style, {
    display: 'block',
    left: (r.right - e.left) / k + 'px',
    top: (r.bottom - e.top) / k + 2 + 'px',
  });
}
function mcEncherComprar(a) {
  Popup.texto(a, 'saldo', mcNumero(dinheiro()));
  Popup.texto(a, 'busca', mc.busca);
  mcCatMarcar(a);
  const L = mcListaDoVisualNovo();
  const b = Popup.celulas(a, 'lista-ofertas', Math.max(1, L?.ofertas.length || 0), 'oferta');
  b.forEach((c, i) => {
    const o = L?.ofertas[i];
    c.style.visibility = o ? 'visible' : 'hidden';
    if (!o) {
      for (const f of c.children) f.style.display = 'none';
      return;
    }
    mcLinhaMaquete(a, c, o);
  });
  if (!L) mcCarregarLista(a);
  else if (L.erro) mcVazio(a, L.erro, '#f58e8e');
  else if (!L.ofertas.length) mcVazio(a, tr('No offers here yet. Be the first to list one!'));
  mcPintarContagem(a);
  if (L) mcPertoDoFim(mcListaVisivel(a));
}
function mcAbrirDialogo(a, b) {
  const c = b?.closest?.('[data-fig^="oferta-"]');
  const o = c && mc.lista?.ofertas.find((x) => x.id === c.dataset.oferta);
  if (!o) return false;
  if (o.tipo === 'pokemon' && mcAbrirDialogoMon(a, o)) return true;
  mcd = { oferta: o, qtd: o.tipo === 'pokemon' ? 1 : Math.min(o.quantidade, 1) };
  Popup.mostrarExtra(a, 'dialogo-comprar-mon', false);
  Popup.mostrarExtra(a, 'dialogo-comprar', true);
  mcPintarDialogo(a);
  return true;
}
function mcPintarDialogo(a) {
  const d = Popup.extra(a, 'dialogo-comprar'),
    o = mcd.oferta;
  if (!d || !o) return;
  const b = o.tipo === 'pokemon';
  Popup.imagem(a, 'item', b ? mcIconeMon(o.mon) : mcIconeItem(o.item), d);
  Popup.textoCru(
    a,
    'item-nome',
    b ? `${mcMon(o.mon).nome} Lv ${o.mon.lv}` : tr(Mercado.item(o.item)?.nome || 'item'),
    d,
  );
  Popup.textoCru(
    a,
    'vendedor-info',
    tr('seller') + ': ' + o.vendedor + (b ? '' : ' · ' + mcMoedas(o.precoUnit) + ' ' + tr('each')),
    d,
  );
  const c = d.querySelector('[data-fig="campo-qtd"] input');
  if (c) {
    c.value = String(mcd.qtd);
    c.disabled = b;
  }
  Popup.texto(a, 'total-compra', '= ' + mcMoedas(o.precoUnit * mcd.qtd), d);
}
function mcDigitou(c, v, d) {
  const e = d?.closest?.('[data-fig^="campo-"]')?.dataset.fig || '';
  const g = !!d?.closest?.('[data-variante]');
  if (e === 'campo-busca') {
    clearTimeout(mc.__tBusca);
    mc.__tBusca = setTimeout(() => {
      mc.busca = String(v).trim();
      mc.pagina = 0;
      mc.lista = null;
      render();
    }, 350);
    return;
  }
  if (e === 'campo-nivel') {
    mc.txtNivel = String(v);
    clearTimeout(mc.__tNivel);
    mc.__tNivel = setTimeout(() => {
      const [a, b] = mcFaixaNivel(v);
      if (a === mc.lvMin && b === mc.lvMax) return;
      mc.lvMin = a;
      mc.lvMax = b;
      mc.pagina = 0;
      mc.lista = null;
      render();
    }, 450);
    return;
  }
  if (e === 'campo-iv') {
    mc.txtIv = String(v);
    clearTimeout(mc.__tIv);
    mc.__tIv = setTimeout(() => {
      const f = mcIvMinimo(v);
      if (f.ivMin === mc.ivMin && f.ivSomaMin === mc.ivSomaMin) return;
      mc.ivMin = f.ivMin;
      mc.ivSomaMin = f.ivSomaMin;
      mc.pagina = 0;
      mc.lista = null;
      render();
    }, 450);
    return;
  }
  if (e === 'campo-ev') {
    mc.txtEv = String(v);
    clearTimeout(mc.__tEv);
    mc.__tEv = setTimeout(() => {
      const n = mcEvMinimo(v);
      if (n === mc.evSomaMin) return;
      mc.evSomaMin = n;
      mc.pagina = 0;
      mc.lista = null;
      render();
    }, 450);
    return;
  }
  if (e === 'campo-preco-venda' && g) {
    mcv.precoMon = Math.max(0, Math.round(+String(v).replace(/[^\d]/g, '')) || 0);
    mcResumoVendaMon(c);
    return;
  }
  if (e === 'campo-busca-preco' && g) {
    mcpm.q = String(v).trim();
    clearTimeout(mc.__tPreco);
    mc.__tPreco = setTimeout(() => mcBuscarPrecoMon(c, mcpm.q), 400);
    return;
  }
  if (e === 'campo-busca-preco') mcp.q = String(v).trim();
  if (e === 'campo-qtd') {
    const o = mcd.oferta;
    if (!o) return;
    mcd.qtd = Math.max(1, Math.min(o.tipo === 'pokemon' ? 1 : o.quantidade, Math.round(+v) || 1));
    Popup.texto(c, 'total-compra', '= ' + mcMoedas(o.precoUnit * mcd.qtd), Popup.extra(c, 'dialogo-comprar'));
    return;
  }
  if (e === 'campo-qtd-venda') {
    mcv.qtd = Math.max(1, Math.round(+v) || 1);
    mcResumoVenda(c);
    return;
  }
  if (e === 'campo-preco-venda') {
    mcv.preco = Math.max(0, Math.round(+String(v).replace(/[^\d]/g, '')) || 0);
    mcResumoVenda(c);
    return;
  }
  if (e === 'campo-busca-preco') {
    clearTimeout(mc.__tPreco);
    mc.__tPreco = setTimeout(() => mcBuscarPreco(c, String(v).trim()), 400);
  }
}
async function mcAcaoPopup(a, b, d) {
  if (b === 'ordenar-preco') {
    mc.ordem = mc.ordem === 'preco-asc' ? 'preco-desc' : 'preco-asc';
    mc.lista = null;
    render();
    return;
  }
  if (b === 'ordenar-iv') {
    if (mc.ordem !== 'iv') {
      mc.ordem = 'iv';
      mc.lista = null;
      render();
    }
    return;
  }
  if (b === 'filtro-shiny') {
    mc.shiny = !mc.shiny;
    mc.pagina = 0;
    mc.lista = null;
    render();
    return;
  }
  if (b === 'comprar-pokemon') return mcComprarMon(a);
  if (b === 'anunciar-pokemon') return mcAnunciarMon(a);
  if (b === 'menos' || b === 'mais') {
    const o = mcd.oferta;
    if (!o) return;
    mcd.qtd = Math.max(1, Math.min(o.tipo === 'pokemon' ? 1 : o.quantidade, mcd.qtd + (b === 'mais' ? 1 : -1)));
    mcPintarDialogo(a);
    return;
  }
  if (b === 'comprar') {
    const o = mcd.oferta;
    if (!o) return;
    const r = await mcPedir('comprar', { oferta: o.id, qtd: mcd.qtd });
    Popup.mostrarExtra(a, 'dialogo-comprar', false);
    if (r.erro) {
      mcVazio(a, r.erro, '#f58e8e');
      return;
    }
    ctx.Som?.tocar?.('ui/sound_itemget', { volume: 0.6 });
    mcVazio(
      a,
      tr('Bought!') +
        ' ' +
        (r.comprou?.mon
          ? mcMon(r.comprou.mon).nome + ' ' + tr('is already with you.')
          : mcd.qtd + '× ' + tr(Mercado.item(o.item)?.nome || 'item') + ' ' + tr('in the bag.')),
      '#8fe08f',
    );
    Mercado.tirarDaLista(mc.lista, o.id, r.comprou?.mon ? Infinity : (r.comprou?.qtd ?? mcd.qtd));
    mc.minhas = null;
    render();
    return;
  }
  if (b === 'anunciar') {
    const e = mcEntradasVenda()[mcv.sel];
    if (!e) return;
    if (!(mcv.preco > 0)) {
      mcVazio(a, tr('Name a price.'), '#f58e8e');
      return;
    }
    const { taxa: f } = Mercado.custoDeAnunciar(mcv.preco, mcv.qtd);
    const g = `${tr('List')} ${mcv.qtd}× ${e.nome} ${tr('for')} ${mcMoedas(mcv.preco)} ${tr('each')}?\n${tr('Fee now')}: ${mcMoedas(f)} — ${tr("it's not refunded, even if you cancel.")}`;
    if (!confirm(g)) return;
    const r = await mcPedir('anunciar', { item: e.id, qtd: mcv.qtd, preco: mcv.preco });
    if (r.erro) {
      mcVazio(a, r.erro, '#f58e8e');
      return;
    }
    ctx.Som?.tocar?.('ui/sound_click', { volume: 0.6 });
    mcVazio(a, tr("Listed! It's in the My Offers tab."), '#8fe08f');
    mc.minhas = null;
    mcv.sel = 0;
    mcv.preco = 0;
    mcv.qtd = 1;
    render();
    return;
  }
  if (b === 'cancelar-oferta' || b === 'coletar' || b === 'recuperar') {
    const c = d?.closest?.('[data-fig^="minha-oferta-"]');
    const h = c?.dataset.oferta;
    if (!h) return;
    if (!confirm(tr("Cancel this listing? Its contents return to you; the fee doesn't."))) return;
    const r = await mcPedir('cancelar', { oferta: h });
    if (r.erro) {
      mcVazio(a, r.erro, '#f58e8e');
      return;
    }
    mcVazio(a, tr('Canceled.'), '#8fe08f');
    mc.minhas = null;
    render();
  }
}
function mcEntradasVenda() {
  const c = { ...(ctx.lerLS('itens', {}) || {}), ...bolasAnunciaveis() };
  return Object.entries(c)
    .map(([a, n]) => ({ id: +a, n: +n, it: Mercado.item(a) }))
    .filter((x) => x.n > 0 && x.it)
    .sort((a, b) => a.it.nome.localeCompare(b.it.nome))
    .map((x) => ({
      tipo: 'item',
      id: x.id,
      n: x.n,
      nome: tr(x.it.nome),
      img: mcIconeItem(x.id),
      faixa: Mercado.faixa(x.id),
    }));
}
function mcEncherVender(g) {
  const d = Popup.extra(g, 'conteudo-vender');
  if (!d) return;
  mcModos(d);
  const h = mcEntradasVenda();
  if (mcv.sel >= h.length) mcv.sel = 0;
  const j = Popup.grupo(g, 'lista-itens') ? 'lista-itens' : 'conteudo-vender';
  const k = Popup.celulas(g, j, Math.max(1, h.length), 'item');
  k.forEach((c, i) => {
    const e = h[i];
    for (const f of c.children) f.style.display = e ? (f.dataset.txt ? f.dataset.display || 'flex' : 'block') : 'none';
    c.style.visibility = e ? 'visible' : 'hidden';
    if (!e) return;
    Popup.imagem(g, 'item', e.img, c);
    Popup.textoCru(
      g,
      'item-nome',
      e.tipo === 'item' ? e.nome : `${e.nome}${e.p.shiny ? ' ✨' : ''} · IV ${mcMon(e.p).ivPorCento}%`,
      c,
    );
    Popup.texto(g, 'qtd', e.tipo === 'item' ? 'x' + e.n : 'Lv' + e.p.lv, c);
    c.style.cursor = 'pointer';
    c.style.pointerEvents = 'auto';
    const a = c.querySelector(':scope > [data-fig="marca-selecionado"]');
    if (a) a.style.display = i === mcv.sel ? 'block' : 'none';
    else {
      c.style.opacity = i === mcv.sel ? '1' : '0.7';
      c.style.outline = i === mcv.sel ? '2px solid #f8c237' : '';
      c.style.borderRadius = '10px';
    }
    if (!c.__mcClique) {
      c.__mcClique = true;
      c.addEventListener('click', () => {
        mcv.sel = +c.dataset.fig.split('-').pop() - 1;
        mcv.qtd = 1;
        mcv.preco = 0;
        render();
      });
    }
  });
  Popup.texto(
    g,
    'slots-venda',
    tr('listings: {a} of {b}', {
      a: mc.minhas?.ofertas?.length ?? '…',
      b: mc.minhas?.limite || Mercado.regras()?.ofertasPorJogador || 8,
    }),
    d,
  );
  if (!mc.minhas) mcCarregarMinhas();
  const e = h[mcv.sel];
  const l = [
    'img/item',
    'item-nome',
    'em-estoque',
    'campo-qtd-venda',
    'campo-preco-venda',
    'divisor',
    'total-venda',
    'taxa',
    'liquido',
    'btn-anunciar',
  ];
  for (const f of d.children)
    if (
      l.some((p) => f.dataset.fig === p || f.dataset.txt === p) ||
      (f.classList.contains('pf-rotulo') && /total|taxa|recebe/.test(f.textContent))
    )
      f.style.display = e ? '' : 'none';
  if (!e) {
    mcVazio(g, tr('Nothing listable in your Bag.'));
    return;
  }
  const m = mcDireto(d);
  Popup.imagem(g, 'item', e.img, m);
  Popup.textoCru(g, 'item-nome', e.nome, m);
  Popup.texto(
    g,
    'em-estoque',
    e.tipo === 'item'
      ? `${tr('you have')} ${e.n} · ${tr('from')} ${mcMoedas(e.faixa.piso)} ${tr('to')} ${mcMoedas(e.faixa.teto)}`
      : `${e.sub} · ${tr(e.onde === 'time' ? 'on team' : 'in the Box')} · ${tr('any price')}`,
    d,
  );
  const o = d.querySelector('[data-fig="campo-qtd-venda"] input'),
    q = d.querySelector('[data-fig="campo-preco-venda"] input');
  if (e.tipo === 'pokemon') {
    mcv.qtd = 1;
    if (o) {
      o.value = '1';
      o.disabled = true;
    }
  } else {
    if (o) {
      o.disabled = false;
      if (document.activeElement !== o) o.value = String(Math.min(mcv.qtd, e.n));
    }
    mcv.qtd = Math.min(mcv.qtd, e.n);
  }
  if (q) {
    if (!mcv.preco && e.tipo === 'item') mcv.preco = Math.min(e.faixa.teto, e.faixa.ref);
    if (document.activeElement !== q) q.value = mcv.preco ? String(mcv.preco) : '';
    q.placeholder = e.tipo === 'item' ? mcMoedas(e.faixa.ref) : '₽';
  }
  mcResumoVenda(g);
}
function mcResumoVenda(a) {
  const d = Popup.extra(a, 'conteudo-vender');
  if (!d) return;
  const e = mcEntradasVenda()[mcv.sel];
  if (!e) return;
  const b = e.tipo === 'pokemon' ? 1 : mcv.qtd,
    { total: c, taxa: f } = Mercado.custoDeAnunciar(mcv.preco, b);
  Popup.texto(a, 'total-venda', mcMoedas(c), d);
  Popup.texto(a, 'taxa', '− ' + mcMoedas(f), d);
  Popup.texto(a, 'liquido', mcMoedas(MC_RECEBE === 'liquido' ? Math.max(0, c - f) : c), d);
}
function mcCaixaDef(a, b, c) {
  return (a.__def?.extras?.[b]?.filhos || []).find((f) => f.nome === c) || null;
}
function mcListaMinhas(a, d) {
  const b = d.querySelector(':scope > [data-fig="lista-minhas-ofertas"]');
  if (b) return b;
  const c = a.__def?.extras?.['conteudo-minhas-ofertas']?.filhos || [],
    e = mcCaixaDef(a, 'conteudo-minhas-ofertas', 'minha-oferta-1');
  if (!e) return null;
  const g = c.filter((f) => f !== e && f.y > e.y + 0.5 && f.h > 0).map((f) => f.y);
  const i = g.length ? Math.max(2, Math.min(...g) - (e.y + e.h)) : 6;
  const j = mcCaixaDef(a, 'conteudo-minhas-ofertas', 'nota'),
    k = d.querySelector(':scope > [data-fig="nota"]');
  const l = j && k && k.style.display !== 'none';
  const m = Popup.rolagemDasCelulas(a, d, 'lista-minhas-ofertas', 'minha-oferta', { ate: l ? j.y - i : null });
  if (m) {
    m.__passo = e.h + i;
    m.__vao = i;
  }
  return m;
}
function mcListaVendas(a, d) {
  const b = d.querySelector(':scope > [data-fig="lista-vendas"]');
  if (b) return b;
  const c = mcCaixaDef(a, 'conteudo-precos', 'venda-1'),
    e = mcCaixaDef(a, 'conteudo-precos', 'venda-2'),
    f = mcCaixaDef(a, 'conteudo-precos', 'nota');
  if (!c) return null;
  const g = e ? Math.max(0, e.y - (c.y + c.h)) : 6;
  return Popup.rolagemDasCelulas(a, d, 'lista-vendas', 'venda', { ate: f && f.y > c.y ? f.y - g : null });
}
function mcEncherMinhas(a) {
  const d = Popup.extra(a, 'conteudo-minhas-ofertas');
  if (!d) return;
  const M = mc.minhas;
  for (const f of d.children) {
    if (f.classList.contains('pf-rotulo') && /coletar|recuperar/i.test(f.textContent)) f.style.display = 'none';
    if (f.classList.contains('pf-rotulo') && /vendido vira moedas/i.test(f.textContent))
      f.textContent = tr(
        "what sells turns into Coins instantly, whether you're online or not · expired listings return to your bag automatically",
      );
  }
  const b = mcListaMinhas(a, d);
  const e = Popup.celulas(
    a,
    b ? 'lista-minhas-ofertas' : 'conteudo-minhas-ofertas',
    Math.max(1, M?.ofertas.length || 0),
    'minha-oferta',
  );
  const g = parseFloat(e[0]?.style.top) || 0,
    h = b?.__passo || (e[1] ? parseFloat(e[1].style.top) - g || 80 : 80);
  const j = e[0],
    l = j?.style.backgroundImage || '',
    m = j?.querySelector('[data-fig="etiqueta"]')?.textContent || tr('for sale'),
    n = j?.querySelector('[data-fig="etiqueta"]')?.style.color || '';
  const p = j?.querySelector('[data-fig="btn-acao"]'),
    q = p?.style.backgroundImage || '',
    r = p?.querySelector('[data-fig="txt-btn"]')?.textContent || tr('Cancel'),
    t = p?.querySelector('[data-fig="txt-btn"]')?.style.color || '';
  const u = Popup.extra(a, 'conteudo-minhas-ofertas');
  if (u)
    [...u.querySelectorAll(':scope > [data-fig="subtitulo"]')].forEach((s, k) => {
      if (k > 0) s.style.display = 'none';
    });
  e.forEach((c, i) => {
    c.style.top = g + i * h + 'px';
    if (l) c.style.backgroundImage = l;
    const b = c.querySelector('[data-fig="etiqueta"]');
    if (b) {
      b.textContent = m;
      if (n) b.style.color = n;
    }
    const d = c.querySelector('[data-fig="btn-acao"]');
    if (d) {
      if (q) d.style.backgroundImage = q;
      const j = d.querySelector('[data-fig="txt-btn"]');
      if (j) {
        j.textContent = r;
        if (t) j.style.color = t;
      }
    }
    const o = M?.ofertas[i];
    for (const f of c.children) f.style.display = o ? (f.dataset.txt ? f.dataset.display || 'flex' : 'block') : 'none';
    if (!o) return;
    const e = o.tipo === 'pokemon',
      k = e ? mcMon(o.mon) : null;
    Popup.imagem(a, 'item', e ? mcIconeMon(o.mon) : mcIconeItem(o.item), c);
    Popup.textoCru(
      a,
      'item-nome',
      e ? `${k.nome}${k.shiny ? ' ✨' : ''} Lv ${k.lv}` : tr(Mercado.item(o.item)?.nome || 'item'),
      c,
    );
    Popup.texto(
      a,
      'oferta-info',
      (e ? '' : `${o.quantidade} ${tr('pcs')} · `) +
        mcMoedas(o.precoUnit) +
        (e ? '' : ' ' + tr('each')) +
        ' · ' +
        tr('expires in') +
        ' ' +
        Mercado.faltaPra(o, mc.agora || Date.now()),
      c,
    );
    c.dataset.oferta = o.id;
  });
  if (b) Popup.alturaRolagem(a, 'lista-minhas-ofertas', Math.max(1, M?.ofertas.length || 0) * h - (b.__vao || 0));
  if (!M) mcCarregarMinhas();
  else if (!M.ofertas.length) mcVazio(a, tr('You have no active listings.'));
}
const mcNomesItem = (a) => {
  const n = String(a?.nome || '').toLowerCase(),
    g = n.replace(/^(?:fragmento de )?tm /, '');
  const b = String(a?.busca || '')
    .toLowerCase()
    .split(' · ')
    .map((x) => x.trim())
    .filter(Boolean)
    .flatMap((x) => {
      const h = x.replace(/^(?:fragmento de )?(?:tm|mt) /, '').replace(/^tm (.+) shard$/, '$1');
      return h === x ? [x] : [x, h];
    });
  return [...new Set([n, ...(g === n ? [] : [g]), ...b])];
};
function mcAcharItem(q) {
  const a = Mercado.catalogo()?.itens || {};
  q = String(q || '')
    .toLowerCase()
    .trim();
  if (q.length < 2) return null;
  const e = Object.entries(a);
  return (
    e.find(([, a]) => mcNomesItem(a).some((n) => n === q)) ||
    e.find(([, a]) => mcNomesItem(a).some((n) => n.startsWith(q))) ||
    e.find(([, a]) => a.nome.toLowerCase().includes(q)) ||
    e.find(([, a]) =>
      String(a.busca || '')
        .toLowerCase()
        .includes(q),
    ) ||
    null
  );
}
function mcLadoDaBusca(q, a) {
  const s = mcSimples(q);
  if (s.length < 2) return null;
  const b = (a) => {
    const n = mcSimples(a);
    return !n ? Infinity : n === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 2 : Infinity;
  };
  const c = mcAcharItem(q),
    d = mcAcharEspecie(q);
  const e = c ? Math.min(...mcNomesItem(c[1]).map(b), mcSimples(c[1].busca).includes(s) ? 3 : Infinity) : Infinity,
    f = d ? b(ctx.porDex?.get(d)?.name) : Infinity;
  const g = a === 'mon' ? f : e,
    h = a === 'mon' ? e : f;
  if (h < g && s.length >= 3) return a === 'mon' ? 'item' : 'mon';
  return g < Infinity ? a : null;
}
function mcBuscaComFoco(b) {
  const a = document.activeElement;
  return !!(a && a.tagName === 'INPUT' && b?.contains(a) && a.closest('[data-fig="campo-busca-preco"]'));
}
function mcFocarBusca(a, b) {
  const c = b === 'mon' ? mcVariante(a, 'precos') : Popup.extra(a, 'conteudo-precos');
  const i = c?.querySelector('[data-fig="campo-busca-preco"] input');
  if (!i || !i.getClientRects().length) return;
  try {
    i.focus({ preventScroll: true });
    const n = i.value.length;
    i.setSelectionRange(n, n);
  } catch {}
}
async function mcBuscarPreco(a, q) {
  q = String(q || '').toLowerCase();
  if (q.length < 2) return;
  const b = mcLadoDaBusca(q, 'item');
  if (b === 'mon') {
    const d = mcBuscaComFoco(a);
    mcTrocarCat('pokemon');
    mcp.q = '';
    mcpm.q = q;
    mcBuscarPrecoMon(a, q);
    render();
    if (d) mcFocarBusca(a, 'mon');
    return;
  }
  const c = b === 'item' ? mcAcharItem(q) : null;
  if (!c) return;
  const r = await mcPedir('precos', { item: +c[0] });
  if (r.erro) {
    mcVazio(a, r.erro, '#f58e8e');
    return;
  }
  mcp = { item: +c[0], dados: r, q: mcp.q };
  if (aberta === 'mercado') render();
}
function mcCaixaGrafico(a) {
  const b = a.__def?.extras?.['conteudo-precos'],
    c = (b?.w || 1272) / 1272,
    d = (b?.h || 441) / 441;
  const e = mcCaixaDef(a, 'conteudo-precos', 'subtitulo'),
    f = 14 * c,
    g = e ? e.x - 37.6 * c : 894 * c;
  return { left: f + 'px', top: 66 * d + 'px', width: Math.max(40, g - f) + 'px', height: 356 * d + 'px' };
}
function mcEncherPrecos(a) {
  const d = Popup.extra(a, 'conteudo-precos');
  if (!d) return;
  const P = mcp.dados,
    E = P?.estatistica;
  const b = mcDireto(d);
  mcCampo(d, 'campo-busca-preco', mcp.q || '');
  Popup.imagem(a, 'item', mcp.item ? mcIconeItem(mcp.item) : null, b);
  Popup.textoCru(a, 'item-nome', E ? tr(E.nome) : tr('search for an item'), b);
  Popup.textoCru(
    a,
    'preco-medio',
    E
      ? E.mediana != null
        ? tr('median: {x}', { x: mcMoedas(E.mediana) }) +
          (document.body.classList.contains('mobile') ? '' : ' · ' + E.vendas + ' ' + tr('sales'))
        : E.aberta != null
          ? tr('for sale: {x}', { x: mcMoedas(E.aberta) })
          : tr('no sales yet')
      : '',
    d,
  );
  const e = P?.vendas || [];
  const g = mcNoDe(d, 'nota');
  if (g) {
    g.textContent = tr("this item's latest sales, newest to oldest");
    g.style.whiteSpace = 'normal';
  }
  const h = Popup.celulas(a, mcListaVendas(a, d) ? 'lista-vendas' : 'conteudo-precos', Math.max(1, e.length), 'venda');
  h.forEach((c, i) => {
    const v = e[i];
    for (const f of c.children) f.style.display = v ? (f.dataset.txt ? f.dataset.display || 'flex' : 'block') : 'none';
    if (!v) return;
    const b = new Date(v.em),
      d = new Date().toDateString() === b.toDateString();
    Popup.texto(
      a,
      'venda-quando',
      (d ? tr('today') : b.toLocaleDateString(I18n.locale(), { day: '2-digit', month: '2-digit' })) +
        ' ' +
        b.toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' }),
      c,
    );
    Popup.texto(a, 'venda-qtd', v.quantidade + ' ' + tr('pcs'), c);
    Popup.texto(a, 'venda-preco', mcMoedas(v.precoUnit), c);
  });
  let j = d.querySelector('[data-fig="grafico-precos"]');
  if (!j && a.__def?.v2) {
    j = d.querySelector(':scope > .mc-grafico');
    if (!j) {
      j = document.createElement('div');
      j.className = 'mc-grafico';
      Object.assign(j.style, mcCaixaGrafico(a), { position: 'absolute', pointerEvents: 'none' });
      d.appendChild(j);
    }
  }
  mcGrafico(j, e, E ? tr('not enough sales yet to draw a chart') : tr('search for an item to see its history'));
}
function mcGrafico(a, b, c) {
  if (!a) return;
  let d = a.querySelector('canvas');
  if (!d) {
    d = document.createElement('canvas');
    Object.assign(d.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' });
    a.appendChild(d);
  }
  const w = Math.round(parseFloat(a.style.width) || 1000),
    h = Math.round(parseFloat(a.style.height) || 280),
    e = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  d.width = Math.round(w * e);
  d.height = Math.round(h * e);
  const g = d.getContext('2d');
  g.setTransform(e, 0, 0, e, 0, 0);
  g.clearRect(0, 0, w, h);
  const f = Math.max(12, Math.round(h * 0.08)),
    j = Math.max(9, Math.min(15, Math.round(h / 22)));
  g.strokeStyle = 'rgba(74, 120, 170, 0.35)';
  g.lineWidth = 1;
  for (let k = 1; k <= 3; k++) {
    const y = Math.round((h * k) / 4) + 0.5;
    g.beginPath();
    g.moveTo(f, y);
    g.lineTo(w - f, y);
    g.stroke();
  }
  const l = [...(b || [])].reverse();
  if (l.length >= 2) {
    const m = Math.min(...l.map((v) => v.precoUnit)),
      n = Math.max(...l.map((v) => v.precoUnit));
    const X = (i) => f + (i / (l.length - 1)) * (w - f * 2),
      Y = (p) => h - f - (n === m ? 0.5 : (p - m) / (n - m)) * (h - f * 2);
    g.strokeStyle = '#f8c237';
    g.lineWidth = 2;
    g.beginPath();
    l.forEach((v, i) => (i ? g.lineTo(X(i), Y(v.precoUnit)) : g.moveTo(X(i), Y(v.precoUnit))));
    g.stroke();
    g.fillStyle = '#ffffff';
    l.forEach((v, i) => {
      g.beginPath();
      g.arc(X(i), Y(v.precoUnit), 3, 0, 6.29);
      g.fill();
    });
    g.fillStyle = '#EAF6FB';
    g.font = '700 ' + (j - 2) + 'px "Nunito Sans", system-ui';
    g.fillText(mcMoedas(n), 6, j);
    g.fillText(mcMoedas(m), 6, h - 6);
  } else {
    g.fillStyle = '#9fb0d0';
    g.font = '700 ' + j + 'px "Nunito Sans", system-ui';
    g.textAlign = 'center';
    g.fillText(c || '', w / 2, h / 2);
  }
}
function mcFaixaNivel(s) {
  const t = String(s || ''),
    n = (t.match(/\d+/g) || []).map((x) => Math.max(0, Math.min(100, +x)));
  if (!n.length) return [0, 0];
  if (n.length >= 2) return [Math.min(n[0], n[1]), Math.max(n[0], n[1])];
  return /[≤<]|at[eé]/i.test(t) ? [0, n[0]] : [n[0], 0];
}
function mcEvMinimo(s) {
  const n = +(String(s || '').match(/\d+/) || [0])[0] || 0;
  return Math.min(Mercado.EV_TOTAL || 510, n);
}
function mcIvMinimo(s) {
  const t = String(s || ''),
    n = +(t.match(/\d+/) || [0])[0] || 0;
  if (!n) return { ivMin: 0, ivSomaMin: 0 };
  return /%/.test(t) || MC_IV_COMO === 'porcento'
    ? { ivMin: Math.min(100, n), ivSomaMin: 0 }
    : { ivMin: 0, ivSomaMin: Math.min(186, n) };
}
function mcPrepararComprarMon(d, v) {
  const e = v.querySelector('[data-fig="lista-ofertas"]'),
    f = mcCelsDe(e, 'oferta-mon');
  const g = f.reduce((a, b) => (b.querySelectorAll('*').length > a.querySelectorAll('*').length ? b : a), f[0]);
  v.__moldes = { normal: mcMolde(g, f) };
  for (const c of f) mcVestir(c, v.__moldes, 'normal');
  v.addEventListener(
    'click',
    (a) => {
      const c = a.target.closest?.('[data-fig^="oferta-mon-"]');
      if (!c || !v.contains(c)) return;
      a.stopPropagation();
      if (c.dataset.oferta) mcAbrirDialogoMon(d, c);
    },
    true,
  );
  const h = (a, t) => {
    const i = v.querySelector('[data-fig="' + a + '"] input');
    if (i) i.placeholder = tr(t);
  };
  h('campo-nivel', 'Nv 1–100');
  h('campo-iv', MC_IV_COMO === 'porcento' ? 'IV ≥ 0%' : 'IV ≥ 0');
  h('campo-ev', 'EV ≥ 0');
}
const MC_ESTRELAS = new Map();
function mcEstrelaDaArte(a) {
  if (!MC_ESTRELAS.has(a))
    MC_ESTRELAS.set(
      a,
      new Promise((b) => {
        const c = new Image();
        c.onload = () => {
          try {
            const a = document.createElement('canvas');
            a.width = c.naturalWidth;
            a.height = c.naturalHeight;
            const g = a.getContext('2d');
            g.drawImage(c, 0, 0);
            const D = g.getImageData(0, 0, a.width, a.height),
              p = D.data;
            for (let i = 0; i < p.length; i += 4)
              p[i + 3] = Math.round(p[i + 3] * Math.max(0, Math.min(1, (p[i] - p[i + 2] - 20) / 60)));
            g.putImageData(D, 0, 0);
            b(a.toDataURL('image/png'));
          } catch {
            b(null);
          }
        };
        c.onerror = () => b(null);
        c.src = a;
      }),
    );
  return MC_ESTRELAS.get(a);
}
function mcEstrelaDoFiltro(g, a) {
  if (!g || !a || !g.dataset.arte) return null;
  let s = mcNoDe(g, 'estrela-filtro-jogo');
  if (s) return s;
  s = document.createElement('div');
  s.dataset.fig = 'estrela-filtro-jogo';
  Object.assign(s.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    display: 'none',
    zIndex: String((parseInt(a.style.zIndex) || 10) + 1),
    backgroundRepeat: 'no-repeat',
    backgroundSize: g.style.backgroundSize || '100% 100%',
    backgroundPosition: g.style.backgroundPosition || '0px 0px',
  });
  a.after(s);
  mcEstrelaDaArte(g.dataset.arte).then((u) => {
    if (u) s.style.backgroundImage = 'url(' + u + ')';
  });
  return s;
}
function mcEncherComprarMon(a) {
  const v = mcVariante(a, 'comprar');
  if (!v) return mcEncherComprar(a);
  Popup.textoCru(v, 'saldo', mcNumero(dinheiro()));
  mcCampo(v, 'campo-busca', mc.busca);
  mcCampo(v, 'campo-nivel', mc.txtNivel);
  mcCampo(v, 'campo-iv', mc.txtIv);
  mcCampo(v, 'campo-ev', mc.txtEv);
  {
    const g = mcNoDe(v, 'filtro-shiny'),
      f = mcNoDe(g, 'marca-ativa'),
      t = g?.querySelector('[data-txt="filtro"]');
    if (f) f.style.display = mc.shiny ? 'block' : 'none';
    const h = mcEstrelaDoFiltro(g, f);
    if (h) h.style.display = mc.shiny ? 'block' : 'none';
    if (t) {
      Popup.texto(v, 'filtro', 'Shiny', g);
      t.style.color = mc.shiny ? '#1D2B45' : '#EAF6FB';
    }
  }
  {
    const j = (a, c, d) => {
      const b = v.querySelector('[data-fig="' + a + '"]'),
        r = b?.querySelector('.pf-rotulo, [data-txt]');
      if (r) r.textContent = c;
      if (b) b.style.opacity = d ? '1' : '0.6';
    };
    j('btn-ordenar-iv', 'IV ▾', mc.ordem === 'iv');
    j(
      'btn-ordenar',
      tr('price') + (mc.ordem === 'preco-desc' ? ' ▾' : ' ▴'),
      mc.ordem === 'preco-asc' || mc.ordem === 'preco-desc',
    );
  }
  mcCatMarcar(a);
  const L = mcListaDoVisualNovo(),
    d = (L?.ofertas || []).filter((o) => o.tipo === 'pokemon');
  const e = Popup.celulas(v, 'lista-ofertas', Math.max(1, d.length), 'oferta-mon');
  e.forEach((c, i) => {
    const o = d[i];
    mcVestir(c, v.__moldes, 'normal');
    c.style.visibility = o ? 'visible' : 'hidden';
    if (o) mcLinhaMon(a, v, c, o);
    else delete c.dataset.oferta;
  });
  if (!L) mcCarregarLista(a);
  else if (L.erro) mcVazio(a, L.erro, '#f58e8e');
  else if (!d.length)
    mcVazio(
      a,
      mc.shiny || mc.lvMin || mc.lvMax || mc.ivMin || mc.ivSomaMin || mc.evSomaMin || mc.busca
        ? 'No Pokémon for sale with these filters.'
        : 'No Pokémon for sale yet. Be the first to list one!',
    );
  mcPintarContagem(a);
  if (L) mcPertoDoFim(mcListaVisivel(a));
}
function mcLinhaMon(a, v, c, o) {
  const m = o.mon,
    k = mcMon(m);
  Popup.imagem(v, 'pokemon', mcIconeMon(m), c);
  Popup.textoCru(v, 'pokemon-nome', mcNomeMon(k), c);
  Popup.textoCru(v, 'nivel', mcNv(k.lv), c);
  iconesTipo(a, c, ctx.porDex?.get(+m.dex)?.types || []);
  const b = Popup.textoCru(v, 'iv-total', mcIvCurto(k), c);
  if (b) b.style.color = k.ivSoma >= k.ivTotal ? '#F5B93B' : '#EAF6FB';
  Popup.textoCru(v, 'preco', mcMoedas(o.precoUnit), c);
  Popup.textoCru(v, 'vendedor', o.vendedor, c);
  Popup.texto(v, 'expira', Mercado.faltaPra(o, mc.agora || Date.now()), c);
  const s = mcSelo(c);
  if (s) s.style.display = k.shiny ? 'block' : 'none';
  c.dataset.oferta = o.id;
  c.style.pointerEvents = 'auto';
  c.style.cursor = 'pointer';
  const d = mcNoDe(c, 'marca-selecionado');
  if (d) d.style.display = mcDialogoMonDe(a) === o.id ? 'block' : 'none';
}
function mcDialogoMonDe(a) {
  const d = Popup.extra(a, 'dialogo-comprar-mon');
  return d && d.style.display !== 'none' ? (mcd.oferta?.id ?? null) : null;
}
function mcMarcarSelecionada(a) {
  const v = a?.querySelector(':scope > [data-variante="comprar"]'),
    b = mcDialogoMonDe(a);
  if (!v) return;
  for (const c of v.querySelectorAll('[data-fig^="oferta-mon-"]')) {
    const d = mcNoDe(c, 'marca-selecionado');
    if (d) d.style.display = b != null && c.dataset.oferta === b ? 'block' : 'none';
  }
}
function mcEstrelaJunto(a, b, c, d) {
  let s = mcNoDe(b, 'selo-shiny-jogo');
  if (!d || !c) {
    if (s) s.style.display = 'none';
    return;
  }
  const { est: e, ic: f } = mcEstrelaDaMaquete(a);
  if (!e || !f) return;
  if (!s) {
    s = document.createElement('div');
    s.className = 'pf-img';
    s.dataset.fig = 'selo-shiny-jogo';
    Object.assign(s.style, {
      position: 'absolute',
      backgroundImage: 'url(' + e.img + ')',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '100% 100%',
      pointerEvents: 'none',
      zIndex: '300',
    });
    b.appendChild(s);
  }
  const k = Math.min(1.4, (parseFloat(c.style.width) || f.w) / f.w),
    x = parseFloat(c.style.left) || 0,
    y = parseFloat(c.style.top) || 0;
  Object.assign(s.style, {
    left: x + (e.x - f.x) * k + 'px',
    top: y + (e.y - f.y) * k + 'px',
    width: e.w * k + 'px',
    height: e.h * k + 'px',
    display: 'block',
  });
}
function mcEstrelaDaMaquete(a) {
  const b = a.__refs?.['oferta-mon']?.normal?.filhos;
  if (b)
    return {
      est: b.find((f) => /^camada-/.test(f.nome || '') && f.img) || null,
      ic: b.find((f) => f.id === 'pokemon') || null,
    };
  const d = (l) => {
    for (const f of l || []) {
      if (f?.nome === 'casa-1') return f;
      const r = d(f?.filhos);
      if (r) return r;
    }
    return null;
  };
  const c = d(a.__def?.filhos)?.filhos || [];
  return {
    est: c.find((f) => f.nome === 'selo-shiny' && f.img) || null,
    ic: c.find((f) => f.id === 'pokemon') || null,
  };
}
function mcAbrirDialogoMon(a, b) {
  const o =
    b?.tipo === 'pokemon' ? b : mc.lista?.ofertas.find((x) => x.id === b?.closest?.('[data-oferta]')?.dataset.oferta);
  if (!o || o.tipo !== 'pokemon' || !Popup.extra(a, 'dialogo-comprar-mon')) return false;
  mcd = { oferta: o, qtd: 1 };
  Popup.mostrarExtra(a, 'dialogo-comprar', false);
  Popup.mostrarExtra(a, 'dialogo-comprar-mon', true);
  mcPintarDialogoMon(a);
  mcMarcarSelecionada(a);
  return true;
}
function mcPintarDialogoMon(a) {
  const d = Popup.extra(a, 'dialogo-comprar-mon'),
    o = mcd.oferta;
  if (!d || o?.tipo !== 'pokemon') return;
  pintarFichaMon(a, d, o.mon);
  const D = mcDireto(d);
  Popup.textoCru(a, 'preco', mcMoedas(o.precoUnit), D);
  Popup.textoCru(a, 'vendedor-info', tr('seller') + ': ' + o.vendedor, D);
}
function pintarFichaMon(c, d, m) {
  if (!d || !m) return;
  const k = mcMon(m),
    D = mcDireto(d),
    S = ctx.porDex?.get(+m.dex);
  const e = Popup.imagem(c, 'pokemon', mcIconeMon(m), D);
  mcEstrelaJunto(c, d, e, k.shiny);
  Popup.textoCru(c, 'pokemon-nome', mcNomeMon(k), D);
  const h = k.sexo === 'f' || k.sexo === 2 ? '♀' : k.sexo === 'm' || k.sexo === 1 ? '♂' : '';
  Popup.textoCru(
    c,
    'pokemon-info',
    [mcNv(k.lv), h, tr('nature {x}', { x: tr(k.natureza) }) + mcNatSobeDesce(k.natureza)].filter(Boolean).join(' · '),
    D,
  );
  if (!mcNoDe(d, 'tipo-2')) {
    const o = mcNoDe(d, 'tipo-1');
    if (o) {
      const p = o.cloneNode(true),
        w = parseFloat(o.style.width) || 22;
      p.dataset.fig = 'tipo-2';
      p.style.left = (parseFloat(o.style.left) || 0) + w + Math.max(3, Math.round(w * 0.2)) + 'px';
      o.after(p);
    }
  }
  iconesTipo(c, d, S?.types || []);
  const j = mcNoDe(d, 'coluna-iv'),
    l = mcNoDe(d, 'coluna-ev'),
    n = Array.isArray(m.evs) && m.evs.length === 6 ? m.evs.map((v) => Math.max(0, +v || 0)) : null;
  Popup.textoCru(c, 'iv-total', mcIvTotal(k), j || D);
  if (l) {
    l.style.display = n ? 'block' : 'none';
    const q = n ? n.reduce((a, b) => a + b, 0) : 0,
      t = n && Popup.textoCru(c, 'ev-total', q + '/510', l);
    if (t) t.style.color = q >= 510 ? '#F5B93B' : '#9FE9FB';
  }
  MC_IVS.forEach((a, i) => {
    const g = mcNoDe(d, a);
    if (!g) return;
    const e = Math.max(0, Math.min(31, k.ivs[i]?.valor ?? 0)),
      f = (MC_FAIXAS[MC_FAIXAS_IV] || MC_FAIXAS.amanda)(e);
    const b = Popup.barra(c, 'iv', e / 31, f.cor, g);
    if (b) b.style.boxShadow = f.fio ? '0 0 0 1px ' + f.fio : 'none';
    const t = Popup.textoCru(c, 'iv-valor', String(e), g);
    if (t) t.style.color = f.num || (e >= 31 ? '#F5B93B' : '#EAF6FB');
    const h = g.querySelector(':scope > [data-fill="ev"]'),
      j = g.querySelector(':scope > [data-txt="ev-valor"]'),
      l = n ? Math.min(252, n[i]) : 0;
    if (h) {
      h.style.display = n ? '' : 'none';
      if (n) Popup.barra(c, 'ev', l / 252, l >= 252 ? '#F5B93B' : '#6FD0FF', g);
    }
    if (j) {
      j.style.display = n ? j.dataset.display || 'flex' : 'none';
      if (n) {
        Popup.textoCru(c, 'ev-valor', String(l), g);
        j.style.color = l >= 252 ? '#F5B93B' : '#9FE9FB';
      }
    }
  });
  caberPilulasIvEv(d);
  for (let i = 0; i < 4; i++) {
    const g = mcNoDe(d, 'golpe-' + (i + 1));
    if (!g) continue;
    const r = k.movs[i];
    g.style.display = r ? '' : 'none';
    if (r) Popup.texto(c, 'golpe', ctx.golpe?.(String(r))?.nome || String(r), g);
  }
}
function mcNatSobeDesce(a) {
  const n = ctx.Ind?.natureza?.(a),
    S = ctx.Ind?.STATS;
  return !n || !S || n[1] === n[2] ? '' : ' (+' + tr(S[n[1]]) + ' −' + tr(S[n[2]]) + ')';
}
async function mcComprarMon(a) {
  const o = mcd.oferta;
  if (!o || o.tipo !== 'pokemon') return;
  const r = await mcPedir('comprar', { oferta: o.id, qtd: 1 });
  Popup.mostrarExtra(a, 'dialogo-comprar-mon', false);
  mcd.oferta = null;
  if (r.erro) {
    if (r.erro !== 'wait for the previous request') {
      mc.lista = null;
      render();
    }
    mcVazio(a, r.erro, '#f58e8e');
    return;
  }
  ctx.Som?.tocar?.('ui/sound_itemget', { volume: 0.6 });
  Mercado.tirarDaLista(mc.lista, o.id);
  mc.minhas = null;
  render();
  mcVazio(a, tr('Purchased! {x} is now yours.', { x: mcNomeMon(mcMon(r.comprou?.mon || o.mon)) }), '#8fe08f');
}
function mcEntradasMon() {
  const a = ctx.jogo?.time || [],
    b = ctx.lerLS('caixa', []) || [];
  return [...a.map((p) => ({ p, onde: 'time' })), ...b.map((p) => ({ p, onde: 'caixa' }))]
    .filter((x) => x.p && x.p.uid != null)
    .map((x) => ({ uid: String(x.p.uid), p: x.p, k: mcMon(x.p), onde: x.onde, travado: !!x.p.travado }));
}
function mcPrepararVenderMon(a, v) {
  const b = v.querySelector('[data-fig="lista-pokemon"]'),
    d = mcCelsDe(b, 'pokemon');
  const e = d.find((c) => mcNoDe(c, 'fx/escurecer')),
    f = d.filter((c) => c !== e);
  v.__moldes = { normal: mcMolde(f[0], f), travado: e ? mcMolde(e, f) : null };
  for (const c of d) mcVestir(c, v.__moldes, 'normal');
  b?.addEventListener(
    'click',
    (d) => {
      const c = d.target.closest?.('[data-fig^="pokemon-"]');
      if (!c || !b.contains(c) || !c.dataset.uid) return;
      d.stopPropagation();
      if (c.dataset.travado === '1') {
        mcVazio(a, Mercado.MOTIVOS_MON.travado, '#f58e8e');
        return;
      }
      if (mcv.uidMon !== c.dataset.uid) {
        mcv.uidMon = c.dataset.uid;
        mcv.precoMon = 0;
        render();
      }
    },
    true,
  );
  const g = v.querySelector('[data-fig="campo-preco-venda"] input');
  if (g) g.placeholder = '₽';
}
function mcEncherVenderMon(d) {
  const v = mcVariante(d, 'vender');
  if (!v) return mcEncherVender(d);
  mcModos(v);
  Popup.textoCru(
    v,
    'slots-venda',
    tr('listings: {a} of {b}', {
      a: mc.minhas?.ofertas?.length ?? '…',
      b: mc.minhas?.limite || Mercado.regras()?.ofertasPorJogador || 8,
    }),
  );
  if (!mc.minhas) mcCarregarMinhas();
  const E = mcEntradasMon();
  if (!E.some((e) => e.uid === mcv.uidMon && !e.travado)) {
    mcv.uidMon = E.find((e) => !e.travado)?.uid ?? null;
    mcv.precoMon = 0;
  }
  const g = Popup.celulas(v, 'lista-pokemon', Math.max(1, E.length), 'pokemon');
  g.forEach((c, i) => {
    const e = E[i];
    mcVestir(c, v.__moldes, e?.travado ? 'travado' : 'normal');
    c.style.visibility = e ? 'visible' : 'hidden';
    if (!e) {
      delete c.dataset.uid;
      return;
    }
    Popup.imagem(v, 'pokemon', mcIconeMon(e.p), c);
    Popup.textoCru(v, 'pokemon-nome', e.k.nome, c);
    const a = Popup.textoCru(v, 'pokemon-info', e.travado ? tr('locked') : mcNv(e.k.lv) + ' · ' + mcIvCurto(e.k), c);
    const b = e.travado && !v.__moldes.travado;
    if (a && b) a.style.color = '#FF8A80';
    c.style.opacity = b ? '0.55' : '';
    const s = mcSelo(c);
    if (s) s.style.display = e.k.shiny ? 'block' : 'none';
    const d = mcNoDe(c, 'marca-selecionado');
    if (d) d.style.display = e.uid === mcv.uidMon ? 'block' : 'none';
    c.dataset.uid = e.uid;
    c.dataset.travado = e.travado ? '1' : '0';
    c.style.pointerEvents = 'auto';
    c.style.cursor = e.travado ? 'not-allowed' : 'pointer';
    c.title = e.travado ? tr(Mercado.MOTIVOS_MON.travado) : '';
  });
  const h = v.querySelector('[data-fig="lista-pokemon"]'),
    j = (parseFloat(h?.style.left) || 0) + (parseFloat(h?.style.width) || 0);
  const e = E.find((x) => x.uid === mcv.uidMon) || null,
    P = mcDireto(v);
  for (const f of v.children)
    if (!f.classList.contains('pf-sb') && (parseFloat(f.style.left) || 0) >= j) f.style.visibility = e ? '' : 'hidden';
  if (!e) {
    mcVazio(d, E.length ? 'Your Pokémon are locked: unlock one to list it.' : 'No Pokémon to list.');
    return;
  }
  Popup.imagem(v, 'pokemon', mcIconeMon(e.p), P);
  Popup.textoCru(v, 'pokemon-nome', mcNomeMon(e.k), P);
  Popup.textoCru(v, 'pokemon-info', [mcNv(e.k.lv), mcIvCurto(e.k), tr(e.k.natureza)].join(' · '), P);
  mcCampo(v, 'campo-preco-venda', mcv.precoMon ? String(mcv.precoMon) : '');
  Popup.textoCru(v, 'duracao', (Mercado.regras()?.validadeHoras || 48) + ' h', P);
  mcResumoVendaMon(d, v);
}
function mcResumoVendaMon(a, v = a?.querySelector(':scope > [data-variante="vender"]')) {
  if (!v) return;
  const p = mcv.precoMon || 0,
    { total: b, taxa: c } = Mercado.custoDeAnunciar(p, 1),
    P = mcDireto(v);
  Popup.textoCru(v, 'total-venda', mcMoedas(b), P);
  Popup.textoCru(v, 'taxa', '− ' + mcMoedas(c), P);
  Popup.textoCru(v, 'liquido', mcMoedas(MC_RECEBE === 'liquido' ? Math.max(0, b - c) : b), P);
}
async function mcAnunciarMon(a) {
  const e = mcEntradasMon().find((x) => x.uid === mcv.uidMon);
  if (!e) {
    mcVazio(a, 'Choose a Pokémon from the list.', '#f58e8e');
    return;
  }
  if (e.travado) {
    mcVazio(a, Mercado.MOTIVOS_MON.travado, '#f58e8e');
    return;
  }
  if (!(mcv.precoMon > 0)) {
    mcVazio(a, 'Name a price.', '#f58e8e');
    return;
  }
  const { taxa: b } = Mercado.custoDeAnunciar(mcv.precoMon, 1);
  if (
    !confirm(
      `${tr('List')} ${e.k.nome} ${tr('for')} ${mcMoedas(mcv.precoMon)}?\n${tr('Fee now')}: ${mcMoedas(b)} — ${tr("won't be refunded, even if you cancel. It leaves your team until it sells or is canceled.")}`,
    )
  )
    return;
  const r = await mcPedir('anunciar_mon', { uid: e.uid, preco: mcv.precoMon });
  if (r.erro) {
    mcVazio(a, r.erro, '#f58e8e');
    return;
  }
  ctx.Som?.tocar?.('ui/sound_click', { volume: 0.6 });
  mc.minhas = null;
  mc.lista = null;
  mcv.uidMon = null;
  mcv.precoMon = 0;
  render();
  mcVazio(a, "Listed! It's in the My Offers tab.", '#8fe08f');
}
function mcAcharEspecie(q) {
  const s = mcSimples(q);
  if (s.length < 2) return null;
  let a = null,
    b = null;
  for (const [c, S] of ctx.porDex || []) {
    const n = mcSimples(S?.name);
    if (!n) continue;
    if (n === s) return +c;
    if (a == null && n.startsWith(s)) a = +c;
    else if (b == null && n.includes(s)) b = +c;
  }
  return a ?? b;
}
function mcPrepararPrecosMon(a, v) {
  const b = a.__refs?.['conteudo-precos']?.pokemon?.filhos || [];
  const d = mcNoDe(v, 'venda-1'),
    e = mcNoDe(v, 'venda-2');
  v.__moldes = { normal: mcMolde(d), shiny: e ? mcMolde(e) : null };
  const g = b.find((f) => f.nome === 'venda-1'),
    i = b.find((f) => f.nome === 'venda-2'),
    j = b.find((f) => f.nome === 'nota');
  const k = g && i ? Math.max(0, i.y - (g.y + g.h)) : 6;
  const l = Popup.rolagemDasCelulas(v, v, 'lista-vendas', 'venda', { ate: j && g && j.y > g.y ? j.y - k : null });
  for (const c of mcCelsDe(l, 'venda')) mcVestir(c, v.__moldes, 'normal');
  const m = mcNoDe(v, 'nota');
  if (m) {
    m.textContent = tr('the latest sales of this species, newest to oldest');
    m.style.whiteSpace = 'normal';
  }
}
function mcQuando(a) {
  const b = new Date(a),
    c = new Date(),
    d = new Date(c.getTime() - 864e5);
  const e =
    c.toDateString() === b.toDateString()
      ? tr('today')
      : d.toDateString() === b.toDateString()
        ? tr('yesterday')
        : b.toLocaleDateString(I18n.locale(), { day: '2-digit', month: '2-digit' });
  return e + ' ' + b.toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' });
}
function mcPrecoTopoMon(v, E) {
  if (!E) return '';
  const a = v.querySelector(':scope > [data-txt="preco-medio"]'),
    b = (parseFloat(a?.style.width) || 999) < 160;
  if (MC_PRECO_MON === 'mediana' && E.mediana != null) return tr('median: {x}', { x: mcMoedas(E.mediana) });
  if (MC_PRECO_MON !== 'mediana' && E.mediaPeriodo != null)
    return b
      ? tr('average: {x}', { x: mcMoedas(E.mediaPeriodo) })
      : tr('{d}-day average: {x}', { d: E.dias, x: mcMoedas(E.mediaPeriodo) });
  if (E.aberta != null) return tr('for sale: {x}', { x: mcMoedas(E.aberta) });
  return tr(E.vendas ? (b ? 'no sales this week' : 'no sales in the last {d} days') : 'no sales yet', {
    d: E.dias,
  });
}
function mcEncherPrecosMon(a) {
  const v = mcVariante(a, 'precos');
  if (!v) return mcEncherPrecos(a);
  const P = mcpm.dados,
    E = P?.estatistica,
    D = mcDireto(v);
  mcCampo(v, 'campo-busca-preco', mcpm.q);
  Popup.imagem(v, 'pokemon', mcpm.dex ? mcCabeca(mcpm.dex) : null, D);
  Popup.textoCru(v, 'pokemon-nome', mcpm.dex ? mcEspecie(mcpm.dex) : tr('search for a Pokémon'), D);
  Popup.textoCru(v, 'preco-medio', mcPrecoTopoMon(v, E), D);
  const b = P?.vendas || [],
    d = mcNoDe(v, 'lista-vendas');
  if (d)
    Popup.celulas(v, 'lista-vendas', Math.max(1, b.length), 'venda').forEach((c, i) => {
      const s = b[i];
      mcVestir(c, v.__moldes, s?.shiny ? 'shiny' : 'normal');
      c.style.visibility = s ? 'visible' : 'hidden';
      if (!s) return;
      Popup.textoCru(v, 'venda-quando', mcQuando(s.em), c);
      Popup.textoCru(
        v,
        'venda-info',
        [s.lv != null ? mcNv(s.lv) : null, s.iv != null ? mcIvVenda(s.iv) : null].filter(Boolean).join(' · ') || '—',
        c,
      );
      Popup.textoCru(v, 'venda-preco', mcMoedas(s.precoUnit), c);
    });
  mcGrafico(
    mcNoDe(v, 'grafico-precos'),
    b,
    !mcpm.dex ? tr('search for a Pokémon to see its history') : tr('not enough sales yet to draw a chart'),
  );
}
async function mcBuscarPrecoMon(a, q) {
  q = String(q || '').trim();
  mcpm.q = q;
  const b = mcLadoDaBusca(q, 'mon');
  if (b === 'item') {
    const d = mcBuscaComFoco(a);
    mcTrocarCat('todas');
    mcpm.q = '';
    mcp.q = q;
    mcBuscarPreco(a, q);
    render();
    if (d) mcFocarBusca(a, 'item');
    return;
  }
  const c = b === 'mon' ? mcAcharEspecie(q) : null;
  if (!c) return;
  const r = await mcPedir('precos', { dex: c });
  if (r.erro === 'pedido repetido') return;
  if (r.erro) {
    mcVazio(a, r.erro, '#f58e8e');
    return;
  }
  mcpm = { dex: c, dados: r, q: mcpm.q };
  if (aberta === 'mercado') render();
}
