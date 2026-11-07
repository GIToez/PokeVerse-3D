/* BOSS UI (Nov 6): what marks a boss in the world and the catch panel after a Pokémon boss falls.
 *   emblema(THREE, opts)  → a Sprite (desenharEmblema(opts) → the same as a plain canvas): a tag above the boss — crown, "BOSS", the tier color and name, the level it will have
 *                           against YOUR party, and the boss's name under it. Redraw it with the same call when the level changes.
 *   anel(THREE, cor)      → a flat ring on the ground in the tier color; pulsar(anel, t) animates it.
 *   abrirCaptura(opts)    → the catch panel: one button per ball you own, the throws left and the time left.
 * Rules (levels, prizes, catch) are in boss_rules.mjs; the server decides everything that matters. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  const n = m ? parseInt(m[1], 16) : 0xa7adb5;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };

function pill(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
function coroa(c, cx, cy, s, cor) {
  c.beginPath();
  c.moveTo(cx - s, cy + s * 0.55);
  c.lineTo(cx - s, cy - s * 0.35); c.lineTo(cx - s * 0.5, cy + s * 0.05);
  c.lineTo(cx, cy - s * 0.7); c.lineTo(cx + s * 0.5, cy + s * 0.05);
  c.lineTo(cx + s, cy - s * 0.35); c.lineTo(cx + s, cy + s * 0.55);
  c.closePath();
  c.fillStyle = cor; c.fill();
  c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.55)'; c.stroke();
}

/**
 * @param THREE  the three.js namespace
 * @param o { nome, nivel: { nome, cor }, lv, tipo: 'npc'|'pokemon', shiny, estado: null|'vencido'|'descanso'|'capturado', larg }
 */
export function emblema(THREE, o) {
  const cv = desenharEmblema(o);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false }));
  const larg = o.larg || 3.2;
  sp.scale.set(larg, larg * cv.height / cv.width, 1); sp.renderOrder = 21;
  sp.userData.bossChave = chaveEmblema(o);
  return sp;
}
/** The badge as a 640×210 canvas (the admin preview shows it as is). */
export function desenharEmblema(o) {
  const cor = o.nivel?.cor || '#a7adb5';
  const apagado = !!o.estado;
  const W = 640, H = 210;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // the tag: [crown BOSS | Tier · Lv N]
  const linha1 = (o.nivel?.nome || 'Boss').toUpperCase() + (o.lv ? '  ·  Lv ' + o.lv : '');
  c.font = 'bold 46px Segoe UI, Arial';
  const wTxt = c.measureText(linha1).width;
  c.font = '900 46px Segoe UI, Arial';
  const wBoss = c.measureText('BOSS').width;
  const wTag = Math.min(W - 20, 70 + wBoss + 30 + wTxt + 40), x0 = (W - wTag) / 2, y0 = 18, hTag = 84;
  c.shadowColor = rgba(cor, apagado ? 0.2 : 0.9); c.shadowBlur = apagado ? 6 : 26;
  pill(c, x0, y0, wTag, hTag, 42);
  c.fillStyle = 'rgba(12,14,22,.88)'; c.fill();
  c.shadowBlur = 0;
  c.lineWidth = 6; c.strokeStyle = apagado ? rgba(cor, 0.45) : cor; c.stroke();
  // the colored left block with the crown and BOSS
  const wBloco = 70 + wBoss + 20;
  c.save(); pill(c, x0, y0, wTag, hTag, 42); c.clip();
  const grad = c.createLinearGradient(x0, 0, x0 + wBloco, 0);
  grad.addColorStop(0, rgba(cor, apagado ? 0.35 : 1)); grad.addColorStop(1, rgba(cor, apagado ? 0.25 : 0.75));
  c.fillStyle = grad; c.fillRect(x0, y0, wBloco, hTag);
  c.restore();
  coroa(c, x0 + 42, y0 + hTag / 2 - 2, 20, '#fff6c8');
  c.font = '900 46px Segoe UI, Arial'; c.lineWidth = 7; c.strokeStyle = 'rgba(0,0,0,.6)';
  c.strokeText('BOSS', x0 + 70 + wBoss / 2, y0 + hTag / 2 + 2); c.fillStyle = '#ffffff'; c.fillText('BOSS', x0 + 70 + wBoss / 2, y0 + hTag / 2 + 2);
  c.font = 'bold 46px Segoe UI, Arial';
  c.fillStyle = apagado ? '#9aa3b2' : cor; c.fillText(linha1, x0 + wBloco + (wTag - wBloco) / 2, y0 + hTag / 2 + 2);
  // the name (and the state) under the tag
  const marca = o.estado === 'capturado' ? '✔ ' : o.estado === 'vencido' ? '✔ ' : o.estado === 'descanso' ? '⏳ ' : '';
  const nome = marca + (o.shiny ? '✨ ' : '') + (o.nome || '');
  c.font = 'bold 44px Segoe UI, Arial'; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.85)';
  c.strokeText(nome, W / 2, 160, W - 20); c.fillStyle = apagado ? '#c3cad6' : '#ffffff'; c.fillText(nome, W / 2, 160, W - 20);
  return cv;
}
export const chaveEmblema = (o) => [o.nome, o.nivel?.nome, o.nivel?.cor || '#a7adb5', o.lv, o.estado, o.shiny].join('|');

/** A ring on the ground in the tier color, under the boss. */
export function anel(THREE, cor, raio = 1.4) {
  const g = new THREE.RingGeometry(raio * 0.82, raio, 48);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(cor || '#a7adb5'), transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const r = new THREE.Mesh(g, m);
  r.rotation.x = -Math.PI / 2; r.position.y = 0.04; r.renderOrder = 5;
  return r;
}
export function pulsar(r, t, apagado = false) {
  if (!r) return;
  const k = 0.5 + 0.5 * Math.sin(t * 3);
  r.material.opacity = apagado ? 0.18 : 0.35 + 0.45 * k;
  const s = apagado ? 1 : 1 + 0.08 * k; r.scale.set(s, s, 1);
}

// ── Catch panel ────────────────────────────────────────────────────────────────────────────────────────────────────────
let painel = null;
function css() {
  if (document.getElementById('boss-css')) return;
  const st = document.createElement('style'); st.id = 'boss-css';
  st.textContent = `
  #boss-capt{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:60;min-width:300px;max-width:min(92vw,460px);
    background:rgba(12,14,22,.94);border:3px solid var(--bc,#a7adb5);border-radius:14px;padding:12px 14px;color:#fff;
    font:14px Segoe UI,Arial,sans-serif;box-shadow:0 0 24px var(--bg,rgba(0,0,0,.4))}
  #boss-capt .bc-t{font-weight:800;font-size:16px;margin-bottom:4px}
  #boss-capt .bc-s{color:#bcd3ff;font-size:12px;margin-bottom:8px}
  #boss-capt .bc-b{display:flex;flex-wrap:wrap;gap:6px}
  #boss-capt button{background:#232838;color:#fff;border:1px solid #445;border-radius:8px;padding:6px 10px;cursor:pointer;font:600 13px Segoe UI,Arial}
  #boss-capt button:hover:not(:disabled){border-color:var(--bc,#fff)}
  #boss-capt button:disabled{opacity:.45;cursor:default}
  #boss-capt .bc-x{margin-top:8px;background:transparent;border-color:#555}
  #boss-capt .bc-r{margin-top:6px;min-height:18px;font-weight:700}`;
  document.head.append(st);
}
export function fecharCaptura() { if (painel) { clearInterval(painel.timer); painel.el.remove(); painel = null; } }

/**
 * @param o { nome, cor, tentativas, ate, garantida, bolas: { id: qtd }, nomeBola(id), tr(s, v), aoLancar(id) → Promise<{ fim, texto, cor }>, aoSair() }
 */
export function abrirCaptura(o) {
  fecharCaptura(); css();
  const tr = o.tr || ((s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? ''));
  const el = document.createElement('div'); el.id = 'boss-capt';
  el.style.setProperty('--bc', o.cor || '#a7adb5'); el.style.setProperty('--bg', rgba(o.cor || '#a7adb5', 0.45));
  document.body.append(el);
  painel = { el, timer: 0, restam: o.tentativas, ocupado: false, bolas: { ...(o.bolas || {}) } };
  const desenhar = (res = '') => {
    const seg = Math.max(0, Math.ceil((o.ate - Date.now()) / 1000));
    const ids = Object.keys(painel.bolas).filter((k) => painel.bolas[k] > 0).sort((a, b) => a - b);
    el.innerHTML = `<div class="bc-t">👑 ${esc(o.nome)}</div>
      <div class="bc-s">${esc(o.garantida ? tr('Throw a ball: this boss is yours.') : tr('{n} throws left · {s} s', { n: painel.restam, s: seg }))}</div>
      <div class="bc-b">${ids.length ? ids.map((id) => `<button type="button" data-b="${id}" ${painel.ocupado ? 'disabled' : ''}>${esc(o.nomeBola(id))} ×${painel.bolas[id]}</button>`).join('') : `<span>${esc(tr('You have no Poké Balls.'))}</span>`}</div>
      <div class="bc-r">${res}</div>
      <button type="button" class="bc-x" ${painel.ocupado ? 'disabled' : ''}>${esc(tr('Let it go'))}</button>`;
    el.querySelectorAll('[data-b]').forEach((b) => (b.onclick = () => lancar(b.dataset.b)));
    el.querySelector('.bc-x').onclick = () => { fecharCaptura(); o.aoSair?.(); };
  };
  const lancar = async (id) => {
    if (!painel || painel.ocupado) return;
    painel.ocupado = true; painel.bolas[id] = Math.max(0, (painel.bolas[id] || 0) - 1); desenhar('…');
    let r = null;
    try { r = await o.aoLancar(id); } catch (e) { r = { fim: false, texto: String(e?.message || e), cor: '#f58e8e' }; }
    if (!painel) return;
    painel.ocupado = false;
    if (r?.restam != null) painel.restam = r.restam;
    if (r?.bolas) painel.bolas = { ...r.bolas };
    if (r?.fim) { desenhar(`<span style="color:${r.cor || '#fff'}">${esc(r.texto || '')}</span>`); setTimeout(fecharCaptura, 2200); clearInterval(painel.timer); return; }
    desenhar(`<span style="color:${r?.cor || '#fff'}">${esc(r?.texto || '')}</span>`);
  };
  desenhar();
  painel.timer = setInterval(() => {
    if (!painel || painel.ocupado) return;
    if (Date.now() > o.ate) { fecharCaptura(); o.aoSair?.(true); return; }
    const s = el.querySelector('.bc-s'); if (s && !o.garantida) s.textContent = tr('{n} throws left · {s} s', { n: painel.restam, s: Math.max(0, Math.ceil((o.ate - Date.now()) / 1000)) });
  }, 1000);
  return true;
}
