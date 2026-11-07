/* DAY CARE PANEL (Nov 7) — the client side of server_breeding.mjs. Talking to the Day Care Lady (NPC role "daycare") opens it:
 * the two Pokémon in care (leave one from the party or the Box, take one back), how well they get along and what hatches, the
 * Eggs waiting at the counter, the Eggs you carry with how far is left to walk, and her shop of breeding items.
 *   instalar({ enviar, tr, Chat, Som, iconeMon, nomeItem, aplicarSave(save, rev), abrirLoja(), lerTime(), lerCaixa(), flutuar(txt) })
 *   abrir() · receber(m)  ({ t: 'creche' } replies and { t: 'ovo_chocou' }) · aberto() */
let ctx = {}, el = null, vista = null, seletor = null, aviso = '', avisoErro = false;
const tr = (s, v) => ctx.tr?.(s, v) ?? (v ? String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '') : s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SEXO = { m: '<b style="color:#6fb3ff">♂</b>', f: '<b style="color:#ff8fb6">♀</b>' };
const STATS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

export function instalar(c) { ctx = c || {}; }
export const aberto = () => !!el;

function estilo() {
  if (document.getElementById('creche-css')) return;
  const st = document.createElement('style'); st.id = 'creche-css';
  st.textContent = `
#creche{position:fixed;inset:0;z-index:900;display:grid;place-items:center;background:rgba(4,7,16,.6);font:14px/1.4 "Nunito Sans",system-ui,sans-serif;color:#e8eefc}
#creche .cx{width:min(560px,94vw);max-height:92vh;overflow:auto;background:#111834;border:1px solid #2a3350;border-radius:14px;padding:16px 18px;box-shadow:0 18px 60px #000a}
#creche h3{margin:0 0 2px;color:#ffe07a;font-size:18px} #creche .sub{color:#98a4c0;font-size:13px;margin-bottom:12px}
#creche .pais{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#creche .slot{background:#0d142c;border:1px solid #2a3350;border-radius:12px;padding:10px;min-height:128px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
#creche .slot img{width:56px;height:56px;object-fit:contain} #creche .slot .nm{font-weight:800} #creche .slot .iv{font-size:11px;color:#98a4c0}
#creche .slot .held{font-size:12px;color:#cfe3ff}
#creche .btn{padding:7px 12px;border:1px solid #2a3350;border-radius:10px;background:#151e30;color:#e8eefc;font:700 13px system-ui,sans-serif;cursor:pointer}
#creche .btn.ouro{border-color:#f8c237;background:#13254a;color:#f8c237} #creche .btn:disabled{opacity:.45;cursor:default}
#creche .linha{margin:12px 0;padding:10px 12px;border-radius:10px;background:#0d142c;border:1px solid #2a3350}
#creche .ok{color:#8ef58e} #creche .nao{color:#ffb3b3}
#creche .ovo{display:flex;align-items:center;gap:10px;margin:6px 0} #creche .ovo .bar{flex:1;height:8px;border-radius:5px;background:#24304f;overflow:hidden}
#creche .ovo .bar i{display:block;height:100%;background:linear-gradient(90deg,#f8c237,#ffe07a)}
#creche .rod{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px} #creche .aviso{min-height:18px;margin-top:8px;font-weight:700}
#creche .lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;max-height:46vh;overflow:auto;margin:8px 0}
#creche .lista button{display:flex;gap:6px;align-items:center;text-align:left;padding:6px;border:1px solid #2a3350;border-radius:10px;background:#0d142c;color:#e8eefc;cursor:pointer;font:600 12px system-ui,sans-serif}
#creche .lista button img{width:36px;height:36px;object-fit:contain} #creche .lista button:hover{border-color:#f8c237}
#creche .ttl{font-weight:800;margin:10px 0 4px} #creche .dica{font-size:12px;color:#98a4c0}`;
  document.head.appendChild(st);
}

export function abrir() {
  estilo();
  if (!el) {
    el = document.createElement('div'); el.id = 'creche';
    el.addEventListener('click', e => { if (e.target === el) fechar(); });
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') fechar(); }, true);
    document.body.appendChild(el);
  }
  seletor = null; aviso = ''; pintar();
  ctx.enviar?.({ t: 'creche', op: 'ver' });
  ctx.Som?.tocar?.('ui/sound_click', { volume: 0.5 });
  return true;
}
export function fechar() { el?.remove(); el = null; seletor = null; }

function monCard(p, i, papel, mae, est = null) {
  if (!p) return `<div class="slot"><div style="flex:1;display:grid;place-items:center;color:#7f8db0">${esc(tr('Empty'))}</div><button class="btn ouro" data-a="deixar">${esc(tr('Leave a Pokémon'))}</button></div>`;
  const held = p.held ? `<div class="held">🎒 ${esc(ctx.nomeItem?.(p.held) || tr('item'))}</div>` : '';
  const ivs = Array.isArray(p.ivs) ? `<div class="iv">IVs ${p.ivs.map((v, k) => `${STATS[k]} ${v}`).join(' · ')}</div>` : '';
  const papelTxt = +p.dex === 132 && (papel === 'm' || papel === 'f') ? `<div class="iv">${esc(tr(papel === 'f' ? 'Acts as the female copy' : 'Acts as the male copy'))} ${SEXO[papel]}</div>` : '';
  return `<div class="slot"${mae ? ' style="border-color:#ff8fb6"' : ''}><img src="${esc(ctx.iconeMon?.(p.dex) || '')}" alt=""><div class="nm">${p.shiny ? '✨ ' : ''}${esc(p.nome)} ${SEXO[p.sexo] || ''}</div>${papelTxt}${mae ? `<div class="iv" style="color:#ff8fb6">${esc(tr('The Egg comes from this one'))}</div>` : ''}
    <div class="iv">Lv ${p.lv}${est?.cresceu ? ' <span style="color:#8ef58e">(+' + est.cresceu + ')</span>' : ''}${p.natureza ? ' · ' + esc(tr(p.natureza)) : ''}</div>${ivs}${held}${est && vista?.exp?.ligado !== false ? `<div class="iv">${esc(tr('EXP gained here: {n}', { n: (est.exp || 0).toLocaleString('en-US') }))}</div>` : ''}<button class="btn" data-a="retirar" data-i="${i}">${esc(tr('Take back'))}${est?.taxa ? ' · ' + est.taxa.toLocaleString('en-US') + ' ' + esc(tr('Coins')) : ''}</button></div>`;
}
function tempo(ms) { const m = Math.ceil(ms / 60000); if (m <= 1) return tr('within a minute'); if (m < 60) return tr('in {n} min', { n: m }); const h = Math.floor(m / 60), r = m % 60; return r ? tr('in {h} h {m} min', { h, m: r }) : tr('in {h} h', { h }); }
const resta = ms => { const m = Math.ceil(ms / 60000); return m <= 0 ? tr('hatching…') : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; };

function pintar() {
  if (!el) return;
  const v = vista;
  if (seletor) return pintarSeletor();
  const c = v?.compat;
  const linha = !v ? tr('Asking the Day Care…')
    : !v.ligado ? tr('The Day Care is closed for now.')
    : !v.pais[0] && !v.pais[1] ? tr('Leave two Pokémon with me. If they get along, there\'s a chance of an Egg every 24 hours!')
    : !c ? tr('Leave one more Pokémon.')
    : c.ok ? `<span class="ok">${esc(tr(c.linha || 'The two get along.'))}</span>${c.especie ? ' ' + esc(tr('Their Eggs hatch into {x}.', { x: c.especie })) : ''}${v.proximaMs != null && v.ovosEsperando < v.maxEsperando ? '<br><span class="dica">' + esc(tr('Next check {t}.', { t: tempo(v.proximaMs) })) + '</span>' : ''}`
    : `<span class="nao">${esc(tr(c.motivo || 'They can\'t have Eggs.'))}</span>`;
  const agora = Date.now();
  const ovos = (v?.carregados || []).map(o => { const tot = Math.max(1, (o.prontoEm || 0) - (o.inicio || 0)), falta = Math.max(0, (o.prontoEm || 0) - agora);
    return `<div class="ovo">🥚 <span style="min-width:110px">${esc(tr('Egg'))} <span class="dica">(${esc(o.nome)})</span></span><span class="bar"><i style="width:${Math.round(100 * (1 - falta / tot))}%"></i></span><span class="dica">${esc(resta(falta))}</span></div>`; }).join('');
  el.innerHTML = `<div class="cx"><h3>${esc(tr('Day Care'))}</h3><div class="sub">${esc(tr('Route 5 · I raise Pokémon for you. Two of them together may leave an Egg.'))}</div>
    <div class="pais">${monCard(v?.pais?.[0], 0, v?.papeis?.[0], v?.mae === 0, v?.estadia?.[0])}${monCard(v?.pais?.[1], 1, v?.papeis?.[1], v?.mae === 1, v?.estadia?.[1])}</div>${v?.exp?.ligado !== false && v ? `<div class="dica">${esc(v.exp.gratis ? tr('They gain {n} EXP a minute while they stay. Free for staff.', { n: v.exp.porMinuto }) : tr('They gain {n} EXP a minute while they stay. The fee is {c} Coins a minute per level, paid when you take one back.', { n: v.exp.porMinuto, c: v.exp.taxaPorNivelMin }))}</div>` : ''}
    <div class="linha">${linha}</div>
    <div class="linha">🥚 <b>${esc(tr('Eggs at the counter: {n} of {m}', { n: v?.ovosEsperando || 0, m: v?.maxEsperando || 3 }))}</b>
      <button class="btn ouro" data-a="pegar" style="float:right" ${v?.ovosEsperando ? '' : 'disabled'}>${esc(tr('Take the Eggs'))}</button>
      <div class="ttl">${esc(tr('Your Eggs ({n}/{m}): they hatch by themselves in {h} h', { n: v?.carregados?.length || 0, m: v?.maxCarregados || 6, h: v?.horasChocar || 2 }))}${v ? ' <span class="dica">· ' + esc(v.medalhao ? tr('Medallion active: {h} h', { h: v.horasChocarMedalhao || 1 }) : tr('{h} h with the Medallion', { h: v.horasChocarMedalhao || 1 })) + '</span>' : ''}</div>${ovos || `<div class="dica">${esc(tr('None yet.'))}</div>`}</div>
    <div class="dica">${esc(tr('Breeding items, held by a parent: Everstone passes its nature, Destiny Knot passes 5 IVs instead of 3, a Power item always passes one stat. Egg moves a parent knows are passed on too.'))}</div>
    <div class="aviso" style="color:${avisoErro ? '#ffb3b3' : '#8ef58e'}">${esc(aviso)}</div>
    <div class="rod"><button class="btn" data-a="loja">🛒 ${esc(tr('Breeding items'))}</button><span style="flex:1"></span><button class="btn" data-a="fechar">${esc(tr('Close'))}</button></div></div>`;
  for (const b of el.querySelectorAll('[data-a]')) b.onclick = () => acao(b.dataset.a, b.dataset);
}
function pintarSeletor() {
  const todos = [...(ctx.lerTime?.() || []).map(p => ({ ...p, onde: 'time' })), ...(ctx.lerCaixa?.() || []).map(p => ({ ...p, onde: 'caixa' }))].filter(p => p && p.uid != null && !p.travado);
  el.innerHTML = `<div class="cx"><h3>${esc(tr('Which Pokémon?'))}</h3><div class="sub">${esc(tr('From your party or your Box.'))}</div>
    <div class="lista">${todos.map(p => `<button data-uid="${esc(p.uid)}"><img src="${esc(ctx.iconeMon?.(p.dex) || '')}" alt=""><span>${p.shiny ? '✨ ' : ''}${esc(p.nome)}<br><span class="dica">Lv ${p.lv} · ${p.onde === 'time' ? esc(tr('party')) : esc(tr('Box'))}</span></span></button>`).join('') || `<div class="dica">${esc(tr('No Pokémon to leave.'))}</div>`}</div>
    <div class="rod"><button class="btn" data-a="voltar">${esc(tr('Back'))}</button></div></div>`;
  for (const b of el.querySelectorAll('[data-uid]')) b.onclick = () => { seletor = null; aviso = tr('Sending…'); avisoErro = false; pintar(); ctx.enviar?.({ t: 'creche', op: 'deixar', uid: b.dataset.uid }); };
  el.querySelector('[data-a="voltar"]').onclick = () => { seletor = null; pintar(); };
}
function acao(a, d) {
  ctx.Som?.tocar?.('ui/sound_click', { volume: 0.4 });
  if (a === 'fechar') return fechar();
  if (a === 'deixar') { seletor = true; return pintar(); }
  if (a === 'loja') { fechar(); ctx.abrirLoja?.(); return; }
  if (a === 'retirar') { aviso = tr('Sending…'); avisoErro = false; pintar(); return ctx.enviar?.({ t: 'creche', op: 'retirar', i: +d.i }); }
  if (a === 'pegar') { aviso = tr('Sending…'); avisoErro = false; pintar(); return ctx.enviar?.({ t: 'creche', op: 'pegar' }); }
}

export function receber(m) {
  if (m.t === 'ovo_chocou') {
    if (m.save) ctx.aplicarSave?.(m.save, m.rev);
    const p = m.mon || {};
    ctx.Chat?.sistema?.('🥚 ' + tr('Oh? Your Egg hatched! {x} joined {onde}.', { x: (p.shiny ? '✨ ' : '') + (p.nome || 'A Pokémon'), onde: m.caixa ? tr('your Box') : tr('your party') }));
    ctx.flutuar?.('🥚 ' + tr('{x} hatched!', { x: p.nome || 'Pokémon' }));
    ctx.Som?.tocar?.('ui/sound_successful', { volume: 0.7, prio: true });
    if (el) ctx.enviar?.({ t: 'creche', op: 'ver' });
    return;
  }
  if (m.t !== 'creche') return;
  if (m.save) ctx.aplicarSave?.(m.save, m.rev);
  if (m.vista) vista = m.vista;
  if (m.erro) { aviso = tr(m.erro); avisoErro = true; }
  else if (m.aviso) { aviso = tr(m.aviso); avisoErro = false; }
  else if (m.op !== 'ver') aviso = '';
  pintar();
}
