/* PLAYER CARD (Nov 6): tap or click another trainer → a card over them with the four permanent buttons:
 *   Party (invite · or Remove / Leave when you share one) · Add Friend (or "Friends ✓" / "Requested") · Inspect (their party) · Duel.
 * Party invites arrive as a small Accept / Decline card. No v2 art for these yet: drawn here in the HUD's colours.
 *   instalar({ tr, enviar(m), social() → Promise<{ friends, requests }|null>, duelo(nome), projetar({x,y,z}) → {x,y}|null,
 *              grupo() → { lider, membros } | null, eu() → my account name, outro(id) → { id, nome, x, y, z } | null })
 *   abrir(outro) · fechar() · aberto() · receber(m)  (m: 'grupo_convite' | 'inspecao' | 'grupo') */
let ctx = {}, card = null, alvo = null, raf = 0, social = null, socialEm = 0, pedidos = new Set(), convite = null, inspecao = null;
const tr = (s, v) => ctx.tr?.(s, v) ?? s;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icone = (dex) => './ui/mon/pm' + String(+dex || 0).padStart(4, '0') + '.png';
let css = false;
function estilo() {
  if (css) return; css = true;
  const s = document.createElement('style');
  s.textContent = `.pcard{position:fixed;z-index:46;transform:translate(-50%,-100%);min-width:236px;max-width:300px;background:linear-gradient(#152647,#0F1A2E);border:2px solid #F8C237;border-radius:14px;box-shadow:0 6px 18px #0009;padding:10px 10px 9px;color:#E6ECFF;font:700 12px/1.3 "Nunito Sans",system-ui,sans-serif;pointer-events:auto;user-select:none}
.pcard::after{content:"";position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);border:8px solid transparent;border-top-color:#F8C237;border-bottom:0}
.pcard h4{margin:0 22px 6px 2px;font:800 16px/1.1 "Baloo 2",system-ui,sans-serif;color:#F8C237;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcard .x{position:absolute;right:6px;top:5px;width:22px;height:22px;border:0;border-radius:50%;background:#0B1220;color:#B8C2D9;font:800 13px system-ui;cursor:pointer}
.pcard .bts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.pcard button.b{display:flex;align-items:center;gap:6px;justify-content:center;min-height:34px;padding:4px 8px;border-radius:10px;border:1px solid #2E4A80;background:#13254A;color:#fff;font:800 12px "Nunito Sans",system-ui;cursor:pointer}
.pcard button.b:hover{border-color:#F8C237}.pcard button.b[disabled]{opacity:.55;cursor:default}
.pcard button.b i{font-style:normal;font-size:15px}
.pcard button.duel{background:linear-gradient(#F8C237,#E0A21B);color:#0F1A2E;border-color:#F8C237}
.pcard .sub{margin-top:7px;color:#B8C2D9;font-weight:600;font-size:11px}
.pcard .time{display:flex;gap:4px;margin-top:7px;flex-wrap:wrap}
.pcard .time span{position:relative;width:38px;height:38px;border-radius:9px;background:#0B1220;border:1px solid #2E4A80;background-size:contain;background-position:center;background-repeat:no-repeat}
.pcard .time b{position:absolute;right:1px;bottom:0;font:800 9px system-ui;color:#fff;text-shadow:0 1px 2px #000}
.pcard .time span.sh{border-color:#F8C237}
.pconv{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:47;background:linear-gradient(#152647,#0F1A2E);border:2px solid #F8C237;border-radius:14px;padding:12px 14px;color:#E6ECFF;font:700 13px "Nunito Sans",system-ui;box-shadow:0 6px 18px #0009;text-align:center;pointer-events:auto}
.pconv b{color:#F8C237}.pconv .bts{display:flex;gap:8px;justify-content:center;margin-top:10px}
.pconv button{min-width:96px;min-height:34px;border-radius:10px;border:1px solid #2E4A80;background:#13254A;color:#fff;font:800 12px "Nunito Sans",system-ui;cursor:pointer}
.pconv button.sim{background:linear-gradient(#F8C237,#E0A21B);color:#0F1A2E;border-color:#F8C237}`;
  document.head.appendChild(s);
}
export function instalar(c) { ctx = c || {}; }
export const aberto = () => !!card;
async function carregarSocial(forcar = false) {
  if (!forcar && social && Date.now() - socialEm < 30000) return social;
  try { social = await ctx.social?.(); socialEm = Date.now(); } catch { social = null; }
  return social;
}
const minhaParty = () => ctx.grupo?.() || null;
function pintar() {
  if (!card || !alvo) return;
  const o = ctx.outro?.(alvo.id) || alvo, g = minhaParty(), eu = ctx.eu?.();
  const user = g?.membros.find((m) => String(m.id) === String(o.id) || m.nick === o.nome)?.user || null;
  const naParty = !!user;
  const souLider = !!(g && g.lider === eu);
  const amigo = !!(user && social?.friends?.some((f) => f.user === user)) || !!(social?.friends?.some((f) => f.nick === o.nome));
  const pedi = pedidos.has(o.nome);
  let party;
  if (naParty && souLider) party = `<button class="b" data-a="expulsar"><i>👥</i>${esc(tr('Remove'))}</button>`;
  else if (naParty) party = `<button class="b" data-a="sair"><i>👥</i>${esc(tr('Leave party'))}</button>`;
  else party = `<button class="b" data-a="party"${g && !souLider ? ' disabled title="' + esc(tr('Only the party leader can invite')) + '"' : ''}><i>👥</i>${esc(tr('Party'))}</button>`;
  card.innerHTML = `<button class="x" data-a="fechar" aria-label="${esc(tr('Close'))}">✕</button><h4>${esc(o.nome || '?')}</h4>
    <div class="bts">${party}
      <button class="b" data-a="amigo"${amigo || pedi ? ' disabled' : ''}><i>🤝</i>${esc(amigo ? tr('Friends ✓') : pedi ? tr('Requested') : tr('Add Friend'))}</button>
      <button class="b" data-a="inspecionar"><i>🔍</i>${esc(tr('Inspect'))}</button>
      <button class="b duel" data-a="duelo"><i>⚔</i>${esc(tr('Duel'))}</button></div>
    ${inspecao && String(inspecao.id) === String(o.id) ? vistaInspecao(inspecao) : ''}`;
}
function vistaInspecao(v) {
  if (v.erro) return `<div class="sub">${esc(tr(v.erro))}</div>`;
  const bits = [tr(v.insignias === 1 ? '{n} Badge' : '{n} Badges', { n: v.insignias || 0 })];
  if (v.campeao) bits.push(tr('Kanto Champion'));
  return `<div class="time">${(v.time || []).map((p) => `<span class="${p.shiny ? 'sh' : ''}" title="${esc(p.nome)} · Lv ${p.lv}" style="background-image:url('${icone(p.dex)}')"><b>${p.lv}</b></span>`).join('') || '<em class="sub">' + esc(tr('No Pokémon')) + '</em>'}</div>
    <div class="sub">${esc(bits.join(' · '))}</div>`;
}
function seguir() {
  raf = 0;
  if (!card || !alvo) return;
  const o = ctx.outro?.(alvo.id);
  if (!o) { fechar(); return; }
  const p = ctx.projetar?.({ x: o.x, y: (o.y ?? 0) + 2.1, z: o.z });
  if (p) { card.style.left = Math.max(130, Math.min(innerWidth - 130, p.x)) + 'px'; card.style.top = Math.max(card.offsetHeight + 8, p.y) + 'px'; card.style.visibility = ''; }
  else card.style.visibility = 'hidden';
  raf = requestAnimationFrame(seguir);
}
export function abrir(o) {
  if (!o?.id) return false;
  estilo();
  if (!card) {
    card = document.createElement('div'); card.className = 'pcard';
    card.addEventListener('pointerdown', (e) => e.stopPropagation());
    card.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) acao(b.dataset.a); });
    document.body.appendChild(card);
  }
  if (!alvo || String(alvo.id) !== String(o.id)) inspecao = null;
  alvo = { id: o.id, nome: o.nome };
  pintar();
  carregarSocial().then(pintar);
  if (!raf) raf = requestAnimationFrame(seguir);
  return true;
}
export function fechar() { card?.remove(); card = null; alvo = null; inspecao = null; if (raf) cancelAnimationFrame(raf); raf = 0; }
function acao(a) {
  const o = alvo && (ctx.outro?.(alvo.id) || alvo);
  if (a === 'fechar' || !o) { fechar(); return; }
  if (a === 'party') ctx.enviar?.({ t: 'grupo_convidar', id: o.id });
  else if (a === 'sair') { ctx.enviar?.({ t: 'grupo_sair' }); fechar(); }
  else if (a === 'expulsar') { const g = minhaParty(), m = g?.membros.find((x) => String(x.id) === String(o.id) || x.nick === o.nome); if (m) ctx.enviar?.({ t: 'grupo_expulsar', user: m.user }); fechar(); }
  else if (a === 'amigo') { ctx.enviar?.({ t: 'social_pedir', to: o.nome }); pedidos.add(o.nome); socialEm = 0; pintar(); }
  else if (a === 'inspecionar') { ctx.enviar?.({ t: 'inspecionar', id: o.id }); }
  else if (a === 'duelo') { ctx.duelo?.(o.nome); fechar(); }
}
function mostrarConvite(m) {
  estilo();
  convite?.el.remove();
  const el = document.createElement('div'); el.className = 'pconv';
  el.innerHTML = `<div>👥 ${tr('{x} invites you to a party.', { x: '<b>' + esc(m.nick || m.de) + '</b>' })}</div><div class="bts"><button class="sim" data-a="sim">${esc(tr('Join'))}</button><button data-a="nao">${esc(tr('Decline'))}</button></div>`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    ctx.enviar?.({ t: b.dataset.a === 'sim' ? 'grupo_aceitar' : 'grupo_recusar', de: m.de });
    el.remove(); convite = null;
  });
  document.body.appendChild(el);
  const t = setTimeout(() => { if (convite?.el === el) { el.remove(); convite = null; } }, 60000);
  convite = { el, t };
}
export function receber(m) {
  if (!m) return;
  if (m.t === 'grupo_convite') mostrarConvite(m);
  else if (m.t === 'inspecao') { inspecao = m; pintar(); }
  else if (m.t === 'grupo') pintar();
}
