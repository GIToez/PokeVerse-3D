import { t as tr } from './i18n.mjs';
import * as I18n from './i18n.mjs';
import * as Catalogo from './cosmetics_catalog.mjs';
import * as ConquistasUI from './achievements_ui.mjs';
let ctx = {},
  vista = null,
  aberto = null,
  ultimoPedido = 0,
  pendente = null,
  escolhido = null;
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (v, p = 0) => (Number.isFinite(+v) ? +v : p);
const LOCAL = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const fmt = (n) => num(n).toLocaleString(LOCAL[I18n.idioma?.()] || 'pt-BR');
const NOME_DEGRAU = { bronze: 'Bronze', prata: 'Silver', ouro: 'Gold', platina: 'Platina', diamante: 'Diamante' };
const COR_DEGRAU = { bronze: '#d08c4a', prata: '#c9d3e3', ouro: '#F8C237', platina: '#8fe3d9', diamante: '#9fd3ff' };
const ICONE_REC = { titulo: '🏷️', montaria: '🐎', cosmetico: '🎨', moldura: '🖼️' };
const ORIGEM = {
  conquista: 'conquista',
  existente: 'conquista',
  mestre: 'Master Level',
  semana: 'weekly ranking',
  guilda: 'guilda',
  hall: 'Hall of Fame',
  fundador: 'Founder Pack',
};
const nomeDegrau = (d) => tr(NOME_DEGRAU[d] || d || '');
export function instalar(c) {
  ctx = c || {};
}
ConquistasUI.instalar({
  vista: () => vista,
  enviar: (m) => ctx.enviar?.(m),
  comConta: () => !!ctx.comConta?.(),
  pedirVista: () => pedirVista(),
  som: () => ctx.Som,
  segurar: (a) => ctx.segurar?.(a),
  tituloAutomatico: () => ctx.tituloAutomatico?.() || '',
  nick: () => ctx.nick?.() || '',
  montariaSemLicenca: (m) => montariaSemLicenca(m),
});
const algumAberto = () => !!aberto || ConquistasUI.aberto();
const ouvintes = new Set();
export function aoMudarVista(a) {
  if (typeof a === 'function') ouvintes.add(a);
}
function vistaMudou() {
  pintarPonto();
  for (const f of ouvintes)
    try {
      f(vista);
    } catch (e) {
      console.warn('progressao_ui:', e);
    }
}
export const aResgatar = () =>
  num(vista?.resumo?.aResgatar, (vista?.conquistas || []).filter((x) => x && x.podeResgatar).length);
function pintarPonto() {
  try {
    if (!document.getElementById('prog-ponto-css')) {
      const a = document.createElement('style');
      a.id = 'prog-ponto-css';
      a.textContent =
        'body[data-conq-resgatar] [data-j="treinador"]{position:relative}' +
        'body[data-conq-resgatar] [data-j="treinador"]::after,body[data-conq-resgatar] #menu-btn::after{content:"";position:absolute;top:6%;right:6%;width:22%;max-width:12px;min-width:7px;aspect-ratio:1;border-radius:50%;background:#ff4d4d;box-shadow:0 0 0 2px #0B1220;pointer-events:none;z-index:5}' +
        'body[data-conq-resgatar] .tr-conq::after{content:"";display:inline-block;width:8px;height:8px;margin-left:5px;border-radius:50%;background:#ff4d4d;vertical-align:middle}';
      document.head.appendChild(a);
    }
    const n = aResgatar();
    if (n > 0) document.body.dataset.conqResgatar = String(n);
    else delete document.body.dataset.conqResgatar;
  } catch {}
}
export const montariaDaVista = (a) => (vista?.montarias?.lista || []).find((m) => m && m.id === a) || null;
export const temVista = () => !!vista;
export const nivelMestre = () => (Number.isFinite(+vista?.mestre?.nivel) ? +vista.mestre.nivel : null);
export function pedirVista() {
  if (!ctx.comConta?.()) return;
  const a = 2100 - (Date.now() - ultimoPedido);
  if (a > 0) {
    if (!pendente)
      pendente = setTimeout(() => {
        pendente = null;
        pedirVista();
      }, a);
    return;
  }
  ultimoPedido = Date.now();
  ctx.enviar?.({ t: 'progressao_vista' });
}
export const limiteDaPosse = () => (Number.isFinite(vista?.caixa?.limitePosse) ? vista.caixa.limitePosse : null);
export const vagasDaCaixa = () => (Number.isFinite(vista?.caixa?.total) ? vista.caixa.total : null);
export const vistaDaCaixa = () => vista?.caixa || null;
export const tituloEscolhido = () => escolhido;
function acertarEscolhido() {
  const a = vista?.titulos?.escolhido || null;
  const t = a ? (vista.titulos.ativos || []).find((x) => x.id === a) : null;
  const b = escolhido;
  escolhido = t ? t.nome : null;
  if (b !== escolhido)
    try {
      ctx.aoTitulo?.();
    } catch {}
}
const compacto = () => innerHeight < 520;
function dialogo(a) {
  document.querySelector('.' + a)?.remove();
  const k = compacto(),
    d = document.createElement('div');
  d.className = a;
  Object.assign(d.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%,-50%)',
    width: 'min(620px, calc(100% - 32px))',
    boxSizing: 'border-box',
    maxHeight: 'calc(100% - 16px)',
    overflowY: 'auto',
    background: '#0F1A2E',
    border: '2px solid #F8C237',
    borderRadius: k ? '12px' : '16px',
    padding: k ? '8px 12px' : '16px',
    zIndex: '600',
    font: (k ? '700 12px' : '700 13px') + ' "Nunito Sans", system-ui, sans-serif',
    color: '#B8C2D9',
    display: 'grid',
    gap: k ? '5px' : '8px',
  });
  document.body.appendChild(d);
  ctx.segurar?.(d);
  d.addEventListener('wheel', (a) => a.stopPropagation(), { passive: true });
  return d;
}
const botao = (a, b, c = true, d = '') =>
  '<button type="button" class="' +
  a +
  '"' +
  d +
  (c ? '' : ' disabled') +
  ' style="background:' +
  (c ? '#13254A' : '#0B1220') +
  ';border:1px solid ' +
  (c ? '#F8C237' : '#2a3550') +
  ';color:' +
  (c ? '#F8C237' : '#56607a') +
  ';border-radius:8px;padding:5px 10px;font:inherit;cursor:' +
  (c ? 'pointer' : 'default') +
  '">' +
  b +
  '</button>';
const chip = (a, b, c, d) =>
  '<button type="button" class="' +
  a +
  '" data-id="' +
  esc(b) +
  '" style="flex:0 0 auto;background:' +
  (d ? '#F8C237' : 'transparent') +
  ';border:1px solid ' +
  (d ? '#F8C237' : '#2a3550') +
  ';color:' +
  (d ? '#1A1A1A' : '#B8C2D9') +
  ';border-radius:999px;padding:3px 10px;font:inherit;font-size:11px;cursor:pointer">' +
  esc(c) +
  '</button>';
const titulo = (t, a = '') =>
  '<div style="font:800 ' +
  (compacto() ? '15px' : '18px') +
  " 'Baloo 2', system-ui;color:#F8C237;text-align:center\">" +
  esc(t) +
  (a ? ' <small style="font:700 12px \'Nunito Sans\', system-ui;color:#B8C2D9">' + esc(a) + '</small>' : '') +
  '</div>';
export function fecharTopo() {
  if (ConquistasUI.fecharTopo()) return true;
  if (!aberto) return false;
  aberto.d.remove();
  aberto = null;
  return true;
}
export function repintar() {
  try {
    if (aberto) pintar();
  } catch (e) {
    console.warn('progressao_ui:', e);
  }
  ConquistasUI.repintar();
}
export function abrir(a = 'conquistas') {
  if (ConquistasUI.abrir(a)) {
    if (aberto) {
      aberto.d.remove();
      aberto = null;
    }
    return true;
  }
  const d = dialogo('prog-janela');
  aberto = { d, aba: a, cat: 'todas', soResgatar: false, aviso: '', bom: false };
  if (!ctx.comConta?.()) aberto.aviso = tr('Sign in with an account to see achievements.');
  else pedirVista();
  pintar();
  return true;
}
function pintar() {
  const A = aberto;
  if (!A) return;
  const V = vista;
  const c = [
    ['conquistas', tr('Achievements') + (V?.resumo?.aResgatar ? ' (' + V.resumo.aResgatar + ')' : '')],
    ['mestre', tr('Master Level')],
    ['titulos', tr('Titles')],
    ['montarias', tr('Montarias')],
  ];
  const e = !V
    ? '<div style="text-align:center;padding:12px">' + esc(A.aviso || tr('one moment…')) + '</div>'
    : A.aba === 'mestre'
      ? pintarMestre(V)
      : A.aba === 'titulos'
        ? pintarTitulos(V)
        : A.aba === 'montarias'
          ? pintarMontarias(V)
          : pintarConquistas(V, A);
  const f = V
    ? tr('Master {n}', { n: V.mestre?.nivel ?? 1 }) +
      ' · ' +
      tr('{a} of {b} completed', { a: V.resumo?.conquistas ?? 0, b: V.resumo?.total ?? 0 })
    : '';
  A.d.innerHTML =
    '<button type="button" class="x-fechar" aria-label="' +
    esc(tr('Close')) +
    '" style="position:sticky;top:0;justify-self:end;margin-bottom:-34px;z-index:2;width:30px;height:30px;border-radius:15px;border:1px solid #F8C237;background:#13254A;color:#F8C237;font:800 15px/1 system-ui,sans-serif;cursor:pointer">✕</button>' +
    titulo(tr('Achievements'), f) +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">' +
    c.map(([a, b]) => chip('aba', a, b, A.aba === a)).join('') +
    '</div>' +
    e +
    (V
      ? '<div class="prog-av" style="min-height:16px;text-align:center;color:' +
        (A.bom ? '#8EF58E' : '#f58e8e') +
        '">' +
        esc(A.aviso) +
        '</div>'
      : '') +
    '<div style="display:flex;gap:8px">' +
    botao('nao', esc(tr('Close'))) +
    '</div>';
  A.d.querySelector('.nao').style.flex = '1';
  A.d.querySelector('.nao').onclick = () => fecharTopo();
  A.d.querySelector('.x-fechar').onclick = () => fecharTopo();
  for (const x of A.d.querySelectorAll('.aba'))
    x.onclick = () => {
      A.aba = x.dataset.id;
      A.aviso = '';
      pintar();
    };
  for (const x of A.d.querySelectorAll('.cat'))
    x.onclick = () => {
      A.cat = x.dataset.id;
      pintar();
    };
  const g = A.d.querySelector('.so-resg');
  if (g)
    g.onchange = () => {
      A.soResgatar = g.checked;
      pintar();
    };
  for (const x of A.d.querySelectorAll('.resg'))
    x.onclick = () => {
      A.aviso = tr('one moment…');
      A.bom = true;
      pintar();
      ctx.enviar?.({ t: 'progressao_resgatar', id: x.dataset.id });
    };
  for (const x of A.d.querySelectorAll('.tit'))
    x.onclick = () => {
      A.aviso = tr('one moment…');
      A.bom = true;
      pintar();
      ctx.enviar?.({ t: 'progressao_titulo', id: x.dataset.id || null });
    };
}
const DICA_KO =
  'Defeats count when the wild Pokémon is at most 10 levels below your strongest Pokémon in the battle (from Lv 60 up, they always count).';
function pintarConquistas(V, A) {
  const d = V.categorias || [];
  const e = [
    chip('cat', 'todas', tr('All'), A.cat === 'todas'),
    ...d.map((c) =>
      chip('cat', c.id, tr(c.nome) + ' ' + c.concluidas + '/' + c.total + (c.aResgatar ? ' •' : ''), A.cat === c.id),
    ),
  ].join('');
  let f = (V.conquistas || []).filter((x) => A.cat === 'todas' || x.categoria === A.cat);
  if (A.soResgatar) f = f.filter((x) => x.podeResgatar);
  f = [...f].sort(
    (a, b) => !!b.podeResgatar - !!a.podeResgatar || a.concluida - b.concluida || !!a.oculta - !!b.oculta,
  );
  const g = compacto()
    ? 'flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;padding-bottom:2px'
    : 'flex-wrap:wrap;justify-content:center';
  return (
    '<div style="display:flex;gap:4px;' +
    g +
    '">' +
    e +
    '</div>' +
    '<label style="display:flex;gap:6px;align-items:center;justify-content:center;font-size:11px;cursor:pointer"><input type="checkbox" class="so-resg"' +
    (A.soResgatar ? ' checked' : '') +
    '> ' +
    esc(tr('only ones with rewards to claim')) +
    '</label>' +
    (['todas', 'luta', 'shiny'].includes(A.cat)
      ? '<div style="font-size:11px;color:#7f8aa6;text-align:center">' + esc(tr(DICA_KO)) + '</div>'
      : '') +
    '<div style="display:grid;gap:6px">' +
    (f.length ? f.map(cartao).join('') : '<div style="text-align:center">' + esc(tr('Nothing here.')) + '</div>') +
    '</div>'
  );
}
function cartao(a) {
  const b = a.valor == null || !a.alvo ? 0 : Math.min(100, Math.round((100 * a.valor) / a.alvo));
  const c =
    a.valor == null
      ? ''
      : '<div style="height:6px;background:#0B1220;border-radius:3px;overflow:hidden"><i style="display:block;height:100%;width:' +
        b +
        '%;background:' +
        (a.concluida ? '#8EF58E' : '#F8C237') +
        '"></i></div>' +
        '<div style="font-size:11px;color:#7f8aa6">' +
        esc(a.concluida ? tr('completa') : fmt(a.valor) + ' / ' + fmt(a.alvo)) +
        '</div>';
  return (
    '<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:6px 8px;display:grid;gap:3px">' +
    '<div style="display:flex;align-items:center;gap:6px"><span style="color:#fff;flex:1;min-width:0">' +
    esc(tr(a.nome)) +
    (a.concluida ? ' <span style="color:#8EF58E">✓</span>' : '') +
    '</span>' +
    (a.podeResgatar ? botao('resg', esc(tr('Redeem')), true, ' data-id="' + esc(a.id) + '"') : '') +
    '</div>' +
    '<div style="font-size:11px">' +
    esc(tr(a.descricao || '')) +
    '</div>' +
    c +
    ((a.degraus || []).length
      ? '<div style="display:flex;gap:4px;flex-wrap:wrap">' + a.degraus.map(pilula).join('') + '</div>'
      : '') +
    '</div>'
  );
}
function pilula(d) {
  const r = d.recompensa,
    a = r ? (ICONE_REC[r.tipo] || '') + ' ' + tr(r.nome || '') : '';
  const b = d.resgatado ? '✓ ' : d.concluido ? '🎁 ' : '';
  return (
    '<span title="' +
    esc(tr(d.descricao || '')) +
    '" style="font-size:10px;padding:1px 7px;border-radius:9px;border:1px solid ' +
    (COR_DEGRAU[d.degrau] || '#7f8aa6') +
    ';color:' +
    (d.concluido ? '#fff' : '#7f8aa6') +
    ';background:' +
    (d.concluido && !d.resgatado ? 'rgba(248,194,55,.18)' : 'transparent') +
    '">' +
    b +
    esc(nomeDegrau(d.degrau)) +
    ' ' +
    fmt(d.min) +
    (a ? ' · ' + esc(a) : '') +
    '</span>'
  );
}
function pintarMestre(V) {
  const M = V.mestre || {},
    a = num(M.proximo) - num(M.base),
    b = a > 0 ? Math.max(0, Math.min(100, Math.round((100 * (num(M.xp) - num(M.base))) / a))) : 100;
  const c = (M.partes || [])
    .map(
      (p) =>
        '<tr><td style="padding:2px 4px">' +
        esc(tr(p.nome)) +
        '</td><td style="padding:2px 4px;text-align:right">' +
        (p.q == null ? '—' : fmt(p.q)) +
        '</td><td style="padding:2px 4px;text-align:right;color:#fff">' +
        fmt(p.xp) +
        '</td></tr>',
    )
    .join('');
  const d = (V.titulos?.ativos || []).filter((t) => t.origem === 'mestre').map((t) => tr(t.nome));
  const e = (M.proximoDestrave?.destrava || []).find((x) => x.titulo);
  return (
    '<div style="display:flex;align-items:baseline;justify-content:center;gap:10px"><span style="font:800 32px \'Baloo 2\', system-ui;color:#F8C237">' +
    fmt(M.nivel ?? 1) +
    '</span>' +
    '<span>' +
    esc(tr('{x} Master XP', { x: fmt(M.xp) })) +
    '</span></div>' +
    '<div style="height:8px;background:#0B1220;border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:' +
    b +
    '%;background:#F8C237"></i></div>' +
    '<div style="text-align:center;font-size:11px">' +
    esc(tr('{x} XP to Master {n}', { x: fmt(M.falta), n: num(M.nivel, 1) + 1 })) +
    '</div>' +
    (d.length
      ? '<div style="text-align:center;font-size:11px">' + esc(tr('Master Titles: {x}', { x: d.join(', ') })) + '</div>'
      : '') +
    (e && M.proximoDestrave
      ? '<div style="text-align:center;font-size:11px">' +
        esc(tr('At Master {n}: a new title', { n: M.proximoDestrave.nivel })) +
        '</div>'
      : '') +
    pintarCaixa(V) +
    '<div style="font-size:11px;color:#7f8aa6;text-align:center">' +
    esc(tr('Where XP comes from:')) +
    '</div>' +
    (c
      ? '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="color:#7f8aa6"><td style="padding:2px 4px"></td><td style="padding:2px 4px;text-align:right">' +
        esc(tr('quantos')) +
        '</td><td style="padding:2px 4px;text-align:right">XP</td></tr>' +
        c +
        '</table>'
      : '<div style="text-align:center">' +
        esc(tr('Nothing yet: Badges, Pokédex species, story chapters, raids and achievements give Master XP.')) +
        '</div>')
  );
}
export function pintarCaixa(V) {
  const K = V?.caixa;
  if (!K || !Number.isFinite(K.total)) return '';
  const d = K.proximoMestre
    ? ' · ' + tr('at Master {n}: +{x} slots', { n: K.proximoMestre.nivel, x: K.proximoMestre.mais })
    : '';
  const e = (n, a) => (Number.isSafeInteger(n) && n > 0 ? tr(a, { n: fmt(n) }) : '');
  const f = [e(K.medalhao, '+{n} from the Medallion'), e(K.fundador, '+{n} from the Founder Pack')].filter(Boolean);
  return (
    '<div style="text-align:center;font-size:12px;background:rgba(0,0,0,.25);border-radius:8px;padding:6px 8px"><span style="color:#fff">' +
    esc(tr('Box: {n} slots', { n: fmt(K.total) })) +
    '</span><br>' +
    '<small>' +
    esc(
      tr("{a} base + {b} from Master + {c} bought; the team doesn't count", {
        a: fmt(K.base),
        b: fmt(K.mestre),
        c: fmt(K.compradas),
      }),
    ) +
    esc(d) +
    '</small>' +
    (f.length ? '<br><small class="caixa-extras" style="color:#F8C237">' + esc(f.join(' · ')) + '</small>' : '') +
    '</div>'
  );
}
function pintarTitulos(V) {
  const T = V.titulos || {},
    a = T.ativos || [],
    b = ctx.tituloAutomatico?.() || '';
  const c = (a, b, c, d) =>
    '<button type="button" class="tit" data-id="' +
    esc(a || '') +
    '" style="display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;padding:7px 10px;border-radius:8px;border:0;font:inherit;cursor:' +
    (d ? 'default' : 'pointer') +
    ';background:' +
    (d ? '#F8C237' : 'rgba(0,0,0,.25)') +
    ';color:' +
    (d ? '#1A1A1A' : '#fff') +
    '"' +
    (d ? ' disabled' : '') +
    '>' +
    '<span style="flex:1">' +
    esc(b) +
    '</span><small style="opacity:.75">' +
    esc(c) +
    '</small></button>';
  const d = (a) => new Date(a).toLocaleDateString(LOCAL[I18n.idioma?.()] || 'pt-BR');
  return (
    '<div style="text-align:center;font-size:11px">' +
    esc(tr('The title shows under your name for everyone.')) +
    '</div>' +
    '<div style="display:grid;gap:4px">' +
    c(
      '',
      tr('Automatic'),
      b ? tr('the last one you earned: {x}', { x: tr(b) }) : tr('no title for now'),
      !T.escolhido,
    ) +
    a
      .map((t) =>
        c(
          t.id,
          tr(t.nome),
          tr(ORIGEM[t.origem] || t.origem || '') + (t.ate ? ' · ' + tr('until {x}', { x: d(t.ate) }) : ''),
          T.escolhido === t.id,
        ),
      )
      .join('') +
    '</div>' +
    (a.length
      ? ''
      : '<div style="text-align:center;font-size:11px">' +
        esc(tr('Claim achievements that grant titles to pick them here.')) +
        '</div>')
  );
}
const NOME_LICENCA = {
  bicicleta: 'Bike license',
  terra: 'Land mount license',
  agua: 'Water mount license',
  voo: 'Fly license',
};
const NOME_CARTAO = { pm0078: 'Rapidash', pm0211: 'Qwilfish', pm0018: 'Pidgeot' };
const ORDEM_LIC = ['bicicleta', 'terra', 'agua', 'voo'];
const ONDE_LICENCA = {
  bicicleta: 'the Cerulean mission',
  terra: '3rd badge',
  agua: 'story chapter 10',
  voo: 'after the League',
};
function montariaSemLicenca(m) {
  if (!m || m.pode || !m.cartao || m.motivo !== 'sem_licenca') return null;
  const a = (Array.isArray(m.precisa) && m.precisa.length ? m.precisa : []).filter((e) =>
    Object.hasOwn(NOME_LICENCA, e),
  );
  if (!a.length) return tr('its license');
  return a
    .map((e) => tr(vista?.montarias?.licencas?.[e]?.nome || NOME_LICENCA[e]) + ' (' + tr(ONDE_LICENCA[e]) + ')')
    .join(' + ');
}
const ICONE_MEIO = { terra: '🐾', agua: '🌊', ar: '🕊️' };
const fmtVel = (v) =>
  (Number.isFinite(+v) ? (+v).toLocaleString(LOCAL[I18n.idioma?.()] || 'pt-BR', { maximumFractionDigits: 2 }) : '?') +
  ' m/s';
function pintarMontarias(V) {
  const M = V.montarias || {},
    L = M.licencas || {};
  const c = ORDEM_LIC.filter((e) => L[e])
    .map((e) => {
      const x = L[e];
      return (
        '<div style="display:flex;align-items:baseline;gap:8px;background:rgba(0,0,0,.25);border-radius:8px;padding:5px 8px">' +
        '<span style="color:' +
        (x.tem ? '#8EF58E' : '#7f8aa6') +
        '">' +
        (x.tem ? '✓' : '·') +
        '</span>' +
        '<span style="flex:1;min-width:0"><span style="color:#fff">' +
        esc(tr(x.nome)) +
        '</span><br><small>' +
        esc(tr(x.efeito || '')) +
        '</small></span>' +
        '<small style="color:' +
        (x.tem ? '#8EF58E' : '#7f8aa6') +
        '">' +
        esc(x.tem ? tr('License') + ' ✓' : tr('no license')) +
        '</small></div>'
      );
    })
    .join('');
  const d = (m) => String(m?.id).startsWith('bicicleta-');
  const f = (M.lista || []).filter((m) => m && d(m)),
    g = f.filter((m) => m.cartao || m.pode);
  const h = [...g, ...(M.lista || []).filter((m) => m && !d(m))].sort(
    (a, b) => !!b.pode - !!a.pode || !!b.cartao - !!a.cartao,
  );
  const i = (m) => {
    const a = Object.entries(m.vel || {})
      .map(([k, v]) => (ICONE_MEIO[k] || '') + ' ' + fmtVel(v))
      .join(' · ');
    const b = montariaSemLicenca(m);
    const c = m.pode
      ? tr(m.shinyLicenca ? 'the shiny can ride now' : 'ready to ride')
      : b
        ? '🔒 ' + tr('card stored')
        : m.motivo === 'so_pacote'
          ? tr('from the Founder Pack')
          : m.motivo === 'sem_cartao'
            ? tr('no card')
            : tr('no license');
    const d = b
      ? tr('rides once you have the {y}', { y: b })
      : m.pacote && !m.pago
        ? tr('comes in the Founder Pack, in the Shop')
        : !m.cartao && m.conquista
          ? tr('how to earn: {x}', {
              x: tr(m.conquista.nome) + (m.conquista.descricao ? ' — ' + tr(m.conquista.descricao) : ''),
            })
          : '';
    const e = [
      m.voa ? (m.podeVoar ? tr('voa') : tr('land only: missing the flying license')) : '',
      m.pode && m.precisaNadar ? tr('land only: missing the water license') : '',
      m.shinyLicenca && m.cartao ? tr('the normal one needs the license') : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      '<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:6px 8px;display:grid;gap:2px">' +
      '<div style="display:flex;align-items:baseline;gap:6px"><span style="color:#fff;flex:1;min-width:0">' +
      esc(tr(m.nome)) +
      (m.basica ? ' <small style="color:#F8C237">' + esc(tr('basic')) + '</small>' : '') +
      (m.shiny ? ' <small style="color:#8be9fd">' + esc(tr('Shiny')) + '</small>' : '') +
      '</span>' +
      '<small style="color:' +
      (m.pode ? '#8EF58E' : '#f5c28e') +
      '">' +
      esc(c) +
      '</small></div>' +
      '<small>' +
      esc(a) +
      (e ? ' · ' + esc(e) : '') +
      '</small>' +
      (d ? '<small style="color:#7f8aa6">' + esc(d) + '</small>' : '') +
      '</div>'
    );
  };
  const j =
    f.length && !g.length
      ? '<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:6px 8px;display:grid;gap:2px">' +
        '<div style="display:flex;align-items:baseline;gap:6px"><span style="color:#fff;flex:1;min-width:0">' +
        esc(tr('Bicycle')) +
        '</span>' +
        '<small style="color:#f5c28e">' +
        esc(tr(L.bicicleta?.tem ? 'no card' : 'no license')) +
        '</small></div>' +
        '<small style="color:#7f8aa6">' +
        esc(tr('how to get: the mission "The Cerulean Bicycle", after the 2nd Badge (you pick the color)')) +
        '</small></div>'
      : '';
  return (
    '<div style="text-align:center;font-size:11px">' +
    esc(tr('Speed comes from the license, not the species.')) +
    '</div>' +
    '<div style="display:grid;gap:4px">' +
    c +
    '</div>' +
    '<div style="display:grid;gap:6px">' +
    (h.length || j ? h.map(i).join('') + j : '<div style="text-align:center">' + esc(tr('Nothing here.')) + '</div>') +
    '</div>'
  );
}
export function receber(m) {
  if (!m) return;
  if (m.t === 'progressao_vista') {
    vista = m.vista || null;
    acertarEscolhido();
    repintar();
    vistaMudou();
    return;
  }
  if (m.t === 'progressao_resgate') {
    if (m.ok) {
      if (m.vista) {
        vista = m.vista;
        vistaMudou();
      }
      const a = m.titulo ? tr('the title {x}', { x: tr(m.nome) }) : tr(m.nome || '');
      const b = m.montaria ? montariaSemLicenca(montariaDaVista(m.montaria)) : null;
      const c = b
        ? tr('{x} card saved: ride it once you have the {y}.', { x: I18n.tNome(m.nome || ''), y: b })
        : tr('Redeemed: {x}.', { x: a }) + (m.titulo ? ' ' + tr('Pick the title in the Titles tab.') : '');
      try {
        ctx.Som?.tocar?.('ui/sound_itemget', { volume: 0.5, prio: true });
      } catch {}
      ctx.Chat?.sistemaCru?.('🎁 ' + c);
      if (typeof m.cosmetico === 'string' && /^(roupa|mochila|peito|rastro):/.test(m.cosmetico))
        Catalogo.carregar({ forcar: true }).catch(() => {});
      if (aberto) {
        aberto.aviso = c;
        aberto.bom = true;
      }
      ConquistasUI.avisar(c, true);
      acertarEscolhido();
      repintar();
    } else {
      ConquistasUI.avisar(tr(m.texto || m.erro || "That didn't work."), false);
      if (aberto) {
        aberto.aviso = tr(m.texto || m.erro || "That didn't work.");
        aberto.bom = false;
        repintar();
      }
    }
    return;
  }
  if (m.t === 'progressao_titulo') {
    if (m.ok) {
      if (vista?.titulos) vista.titulos.escolhido = m.id || null;
      acertarEscolhido();
      if (aberto) {
        aberto.aviso = m.id ? tr('Title selected: {x}.', { x: tr(m.nome || '') }) : tr('Automatic title.');
        aberto.bom = true;
      }
      ConquistasUI.avisar(m.id ? tr('Title selected: {x}.', { x: tr(m.nome || '') }) : tr('Automatic title.'), true);
      repintar();
    } else {
      ConquistasUI.avisar(tr(m.texto || m.erro || "That didn't work."), false);
      if (aberto) {
        aberto.aviso = tr(m.texto || m.erro || "That didn't work.");
        aberto.bom = false;
        repintar();
      }
    }
    return;
  }
  if (m.t === 'progressao_erro') {
    if (m.erro === 'devagar') {
      ultimoPedido = Date.now();
      pedirVista();
      return;
    }
    const d = tr(
      m.erro === 'sem_conta'
        ? 'Sign in with an account to see achievements.'
        : 'Achievements are offline right now. Try again in a bit.',
    );
    if (ConquistasUI.aberto()) {
      if (vista) ConquistasUI.avisar(d, false);
      else ConquistasUI.semVista(d);
    }
    if (aberto) {
      aberto.aviso = d;
      aberto.bom = false;
      repintar();
    }
    return;
  }
  if (m.t === 'progressao') {
    const f = Array.isArray(m.novas) ? m.novas : [];
    for (const n of f)
      ctx.Chat?.sistemaCru?.('🏅 ' + tr('Achievement: {x} ({y})', { x: tr(n.nome || ''), y: nomeDegrau(n.degrau) }));
    const g = f.filter((n) => {
      const r = n?.recompensa;
      return (
        r &&
        typeof r === 'object' &&
        (r.titulo || r.montaria || r.cosmetico || r.moldura) &&
        !(vista?.conquistas || []).find((x) => x?.id === n.id)?.existente
      );
    });
    if (g.length) ctx.Chat?.sistemaCru?.('🎁 ' + tr('Reward ready: open Achievements (under Trainer) to claim it.'));
    if (f.length && !algumAberto()) pedirVista();
    if (m.mestre?.subiu) ctx.Chat?.sistemaCru?.('⭐ ' + tr('Master Level {n}!', { n: m.mestre.nivel }));
    const h = Array.isArray(m.licencas) ? m.licencas : [],
      i = Array.isArray(m.cartoes) ? m.cartoes : [];
    for (const e of h)
      ctx.Chat?.sistemaCru?.(
        '🪪 ' + tr('New license: {x}', { x: tr(vista?.montarias?.licencas?.[e]?.nome || NOME_LICENCA[e] || e) }),
      );
    for (const k of i)
      ctx.Chat?.sistemaCru?.(
        '🐎 ' + tr('New mount: {x}', { x: I18n.tNome(montariaDaVista(k)?.nome || NOME_CARTAO[k] || k) }),
      );
    if (h.length || i.length) {
      try {
        ctx.Som?.tocar?.('ui/sound_itemget', { volume: 0.5, prio: true });
      } catch {}
      pedirVista();
    } else if (m.montariasShiny) pedirVista();
    if (m.semana?.nome) {
      ctx.Chat?.sistemaCru?.(
        '🏅 ' +
          tr('Title of the week: {x} (lasts 7 days). Pick it in the Titles tab of Achievements.', {
            x: tr(m.semana.nome),
          }),
      );
      try {
        ctx.Som?.tocar?.('ui/sound_itemget', { volume: 0.5, prio: true });
      } catch {}
      if (algumAberto()) pedirVista();
    }
    if (f.length || m.mestre?.subiu) {
      try {
        ctx.Som?.tocar?.('ui/sound_itemget', { volume: 0.5, prio: true });
      } catch {}
      if (algumAberto()) pedirVista();
    }
  }
}
