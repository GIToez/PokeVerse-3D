/* Celadon Department Store 2F. Talk to the clerk (cfg 2158801) and this opens.
   TMs and the tutor moves are bought with Coins and taught straight away. */
import * as Tm from './tm.mjs';

let ctx = null;
let cat = null;
let carregando = null;
const ui = { aba: 'tm', q: '', dex: 0, chave: '', uid: '', esquecer: false };

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FAIXA = { comum: 'Common', forte: 'Strong', rara: 'Rare', tutor: 'Tutor' };
const reais = n => Math.max(0, Math.floor(+n || 0)).toLocaleString('en-US');

export function instalar(c){ ctx = c || null; }

function golpeDe(id){ return ctx?.golpe?.(id) || null; }

function carregar(){
  if (cat) return Promise.resolve(cat);
  if (carregando) return carregando;
  const pegar = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  carregando = Promise.all([
    pegar('./data/tm_beta.json'),
    pegar('./data/biblioteca/candidatos/learnset_tm_beta.json'),
    pegar('./data/tm_regras.json'),
  ]).then(([beta, learnset, regras]) => {
    cat = Tm.catalogo({ beta, learnset, regras, golpe: golpeDe });
    carregando = null;
    return cat;
  });
  return carregando;
}

function time(){ return (ctx?.time?.() || []).filter(p => p && p.uid != null && p.dex != null); }
function dinheiro(){ return Math.max(0, Math.floor(+ctx?.dinheiro?.() || 0)); }
function insignias(){ return ctx?.insignias?.() || []; }

function entradaDe(chave){
  if (!cat) return null;
  return ui.aba === 'tutor' ? cat.tutor.get(chave) : cat.porChave.get(chave);
}

function lista(){
  if (!cat) return [];
  const fonte = ui.aba === 'tutor' ? [...cat.tutor.values()] : [...cat.porChave.values()];
  const q = ui.q.trim().toLowerCase();
  const party = time().filter(p => !ui.dex || +p.dex === ui.dex);
  return fonte.filter(e => {
    if (q && !e.nome.toLowerCase().includes(q) && !e.tipo.toLowerCase().includes(q)) return false;
    if (!party.length) return true;
    return party.some(p => Tm.podeAprender(cat, p, e).ok);
  }).sort((a, b) => a.nome.localeCompare(b.nome) || a.preco - b.preco);
}

function root(){
  let el = document.getElementById('pv-tm');
  if (el) return el;
  const css = document.createElement('style');
  css.id = 'pv-tm-css';
  css.textContent = `
#pv-tm{position:fixed;inset:0;z-index:80;background:#070d18cc;display:flex;align-items:center;justify-content:center;padding:12px}
#pv-tm[hidden]{display:none}
.pv-tm-card{width:min(560px,100%);max-height:min(640px,100%);display:flex;flex-direction:column;gap:8px;background:#13254A;color:#e8eefc;border:2px solid #F8C237;border-radius:16px;padding:14px;box-shadow:0 16px 40px #000a;font:700 14px/1.3 "Nunito Sans",system-ui,sans-serif}
.pv-tm-card header{display:flex;align-items:center;gap:8px}
.pv-tm-card header b{font-size:18px;color:#F8C237}
.pv-tm-card header span{margin-left:auto;color:#9fb0d0;font-size:12px}
.pv-tm-card header button,.pv-tm-card .pv-tm-tabs button,.pv-tm-row button,.pv-tm-party button,.pv-tm-forget button{border:1px solid #F8C237;background:#0e1c38;color:#F8C237;border-radius:10px;padding:8px 10px;font:800 13px/1.2 inherit;cursor:pointer}
.pv-tm-card header button{padding:6px 10px}
.pv-tm-sub{margin:0;color:#9fb0d0;font-size:12px}
.pv-tm-tabs,.pv-tm-party{display:flex;gap:6px;flex-wrap:wrap}
.pv-tm-tabs button.on,.pv-tm-party button.on{background:#F8C237;color:#13254A}
.pv-tm-card input{width:100%;box-sizing:border-box;border:1px solid #F8C23788;background:#0b1730;color:#fff;border-radius:10px;padding:8px 10px;font:inherit}
.pv-tm-lista{overflow:auto;display:flex;flex-direction:column;gap:6px;min-height:120px}
.pv-tm-row{display:flex;align-items:center;gap:8px;background:#0e1c38;border-radius:10px;padding:8px}
.pv-tm-row b{display:block}
.pv-tm-row small{color:#9fb0d0;font-weight:700}
.pv-tm-row button{margin-left:auto;white-space:nowrap}
.pv-tm-forget{display:flex;flex-direction:column;gap:6px}
.pv-tm-vazio{color:#9fb0d0;text-align:center;padding:18px 8px}
`;
  document.head.appendChild(css);
  el = document.createElement('div');
  el.id = 'pv-tm';
  el.hidden = true;
  el.className = 'notranslate';
  el.setAttribute('translate', 'no');
  el.lang = 'en';
  el.innerHTML = `<div class="pv-tm-card" role="dialog" aria-label="TM Counter">
    <header><b>TM Counter</b><span data-tm="coins"></span><button type="button" data-tm="x" aria-label="Close">✕</button></header>
    <p class="pv-tm-sub">Celadon Department Store, 2nd floor. A lesson is paid in Coins and taught once.</p>
    <div class="pv-tm-tabs">
      <button type="button" data-tm-aba="tm">TMs</button>
      <button type="button" data-tm-aba="tutor">Tutor</button>
    </div>
    <input data-tm="q" type="search" placeholder="Search moves" autocomplete="off">
    <div class="pv-tm-party" data-tm="party"></div>
    <div class="pv-tm-lista" data-tm="lista"></div>
    <div class="pv-tm-forget" data-tm="forget" hidden></div>
  </div>`;
  el.addEventListener('click', ev => {
    if (ev.target === el) fechar();
    const x = ev.target.closest('[data-tm="x"]');
    if (x){ fechar(); return; }
    const aba = ev.target.closest('[data-tm-aba]');
    if (aba){ ui.aba = aba.dataset.tmAba; ui.chave = ''; ui.uid = ''; ui.esquecer = false; pintar(); return; }
    const pk = ev.target.closest('[data-tm-dex]');
    if (pk){ ui.dex = +pk.dataset.tmDex || 0; ui.chave = ''; ui.uid = ''; ui.esquecer = false; pintar(); return; }
    const teach = ev.target.closest('[data-tm-teach]');
    if (teach){ escolher(teach.dataset.tmTeach); return; }
    const quem = ev.target.closest('[data-tm-uid]');
    if (quem){ ui.uid = quem.dataset.tmUid; ui.esquecer = false; seguir(entradaDe(ui.chave), time().find(p => String(p.uid) === ui.uid)); return; }
    const esq = ev.target.closest('[data-tm-esq]');
    if (esq){ ensinar(ui.uid, ui.chave, esq.dataset.tmEsq); }
    const back = ev.target.closest('[data-tm-back]');
    if (back){ ui.chave = ''; ui.uid = ''; ui.esquecer = false; pintar(); }
  });
  el.querySelector('[data-tm="q"]').addEventListener('input', e => { ui.q = e.target.value || ''; pintar(); });
  document.body.appendChild(el);
  return el;
}

function pintar(){
  const el = root();
  el.querySelector('[data-tm="coins"]').textContent = reais(dinheiro()) + ' Coins';
  for (const b of el.querySelectorAll('[data-tm-aba]')) b.classList.toggle('on', b.dataset.tmAba === ui.aba);
  const party = time();
  el.querySelector('[data-tm="party"]').innerHTML = `<button type="button" data-tm-dex="0" class="${ui.dex ? '' : 'on'}">Party</button>`
    + party.map(p => `<button type="button" data-tm-dex="${+p.dex}" class="${ui.dex === +p.dex ? 'on' : ''}">${esc(p.nome || '#' + p.dex)}</button>`).join('');
  const listaEl = el.querySelector('[data-tm="lista"]');
  const forget = el.querySelector('[data-tm="forget"]');
  if (ui.esquecer && ui.chave && ui.uid){
    listaEl.hidden = true;
    forget.hidden = false;
    const p = party.find(x => String(x.uid) === String(ui.uid));
    const e = entradaDe(ui.chave);
    forget.innerHTML = `<b>${esc(p?.nome || 'This Pokémon')} already knows 4 moves.</b><small>Which one should it forget to learn ${esc(e?.nome || 'this move')}?</small>`
      + (p?.movs || []).map(m => `<button type="button" data-tm-esq="${esc(m.id)}">${esc(golpeDe(m.id)?.nome || m.id)}</button>`).join('')
      + `<button type="button" data-tm-back="1">Back</button>`;
    return;
  }
  listaEl.hidden = false;
  forget.hidden = true;
  forget.innerHTML = '';
  const rows = lista();
  const alvo = ui.dex ? party.find(p => +p.dex === ui.dex) : null;
  listaEl.innerHTML = rows.length ? rows.map(e => {
    const quem = alvo || party.find(p => Tm.podeAprender(cat, p, e).ok);
    const cob = quem ? Tm.cobrar(e, { insignias: insignias(), dinheiro: dinheiro() }) : { ok: false, erro: '' };
    const nota = !quem ? '' : cob.ok ? '' : cob.erro;
    return `<div class="pv-tm-row"><span><b>${esc(e.nome)}</b><small>${esc(e.tipo)}${e.poder ? ' · ' + e.poder : ''} · ${esc(FAIXA[e.faixa] || e.faixa)}${nota ? ' · ' + esc(nota) : ''}</small></span><button type="button" data-tm-teach="${esc(e.chave)}" ${cob.ok && quem ? '' : 'disabled'}>Teach · ${reais(e.preco)}</button></div>`;
  }).join('') : `<div class="pv-tm-vazio">${ui.q ? 'No moves match that search.' : 'Nobody in the party can learn a move from this list.'}</div>`;
}

function escolher(chave){
  const e = entradaDe(chave);
  if (!e) return;
  const quem = time().filter(p => (!ui.dex || +p.dex === ui.dex) && Tm.podeAprender(cat, p, e).ok);
  if (!quem.length){ ctx?.chat?.("Nobody in the party can learn " + e.nome + '.'); return; }
  ui.chave = chave;
  if (quem.length === 1){ ui.uid = String(quem[0].uid); seguir(e, quem[0]); return; }
  const el = root();
  const forget = el.querySelector('[data-tm="forget"]');
  el.querySelector('[data-tm="lista"]').hidden = true;
  forget.hidden = false;
  ui.esquecer = false;
  forget.innerHTML = `<b>Who should learn ${esc(e.nome)}?</b>`
    + quem.map(p => `<button type="button" data-tm-uid="${esc(p.uid)}">${esc(p.nome)} · Lv ${p.lv || 1}</button>`).join('')
    + `<button type="button" data-tm-back="1">Back</button>`;
}

function seguir(e, p){
  if (!e || !p) return;
  const cob = Tm.cobrar(e, { insignias: insignias(), dinheiro: dinheiro() });
  if (!cob.ok){ ctx?.chat?.('⚠ ' + cob.erro); pintar(); return; }
  if ((p.movs || []).length >= 4){ ui.uid = String(p.uid); ui.esquecer = true; pintar(); return; }
  ensinar(p.uid, e.chave, null);
}

async function ensinar(uid, chave, esquecer){
  const e = entradaDe(chave);
  const p = time().find(x => String(x.uid) === String(uid));
  if (!e || !p) return;
  const apr = Tm.podeAprender(cat, p, e);
  if (!apr.ok){ ctx?.chat?.('⚠ ' + apr.erro); return; }
  const cob = Tm.cobrar(e, { insignias: insignias(), dinheiro: dinheiro() });
  if (!cob.ok){ ctx?.chat?.('⚠ ' + cob.erro); return; }
  if (ctx?.comConta?.()){
    const r = await ctx.bolsaOp?.('tm', { uid, chave, esquecer, tutor: !!e.tutor });
    if (!r || r.erro){ pintar(); return; }
    ctx.chat?.((p.nome || 'Your Pokémon') + ' learned ' + (r.aprendeu || e.nome) + '!' + (r.esqueceu ? ' Forgot ' + (golpeDe(r.esqueceu)?.nome || r.esqueceu) + '.' : ''));
    ctx.som?.();
    ui.chave = ''; ui.uid = ''; ui.esquecer = false;
    pintar();
    ctx.pintar?.();
    return;
  }
  const fez = Tm.aplicar(p, e, esquecer);
  if (!fez.ok){ ctx?.chat?.('⚠ ' + fez.erro); if (fez.cheio){ ui.esquecer = true; pintar(); } return; }
  ctx.gravarDinheiro?.(dinheiro() - cob.preco);
  ctx.gravarTime?.(ctx.time());
  ctx.aplicarNoParceiro?.(p.uid, p.movs);
  ctx.chat?.((p.nome || 'Your Pokémon') + ' learned ' + e.nome + '!' + (fez.esqueceu ? ' Forgot ' + (golpeDe(fez.esqueceu)?.nome || fez.esqueceu) + '.' : ''));
  ctx.som?.();
  ui.chave = ''; ui.uid = ''; ui.esquecer = false;
  pintar();
  ctx.pintar?.();
}

export function aberto(){ const el = document.getElementById('pv-tm'); return !!el && !el.hidden; }
export function fechar(){ const el = document.getElementById('pv-tm'); if (el) el.hidden = true; }

export async function abrir(){
  const el = root();
  el.hidden = false;
  ui.aba = 'tm'; ui.q = ''; ui.dex = 0; ui.chave = ''; ui.uid = ''; ui.esquecer = false;
  el.querySelector('[data-tm="q"]').value = '';
  el.querySelector('[data-tm="lista"]').innerHTML = '<div class="pv-tm-vazio">Loading the TM list…</div>';
  await carregar();
  if (!cat || (!cat.porChave.size && !cat.tutor.size)){
    el.querySelector('[data-tm="lista"]').innerHTML = '<div class="pv-tm-vazio">The TM list did not load.</div>';
    return;
  }
  pintar();
}
