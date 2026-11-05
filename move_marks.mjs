/* MOVE MARKS + INFO CARDS (the approved mockups, canvas "Move & Weather Icons").
 *
 * On each v2 move slot (#sk1–#sk4, PC bar and phone column), drawn over the slot — the layout itself does not move:
 *   • matchup badge on the slot's top-right edge, vs the CURRENT target only: ×4 / ×2 green, ×½ / ×¼ red, "No effect" grey;
 *     neutral (×1) shows nothing, and with no target there is no badge.
 *   • weather dot on the corner of the type icon: green ↑ boosted, red ↓ weakened, lilac ◎ never misses, pink ∿ the
 *     weather changes the move (Weather Ball, healing moves).
 * Info cards (one floating card at a time), after resting the mouse 0.5 s or pressing and holding 0.5 s on a phone:
 *   • a move slot → the move's details (category, power, accuracy, cooldown / PP, description, effect) + the marks explained;
 *   • the minimap date pill → the weather's good and bad effects. A tap / click on the pill still opens the calendar.
 * Once a card is open, moving onto the next slot switches it at once. Holding never fires the move.
 *
 *   install({ state }) — state() → { pika, golpes, porDex, chart, alvo, clima, turno, indoors }
 *   paint()            — every HUD frame (cheap: only touches the DOM when something changed) */
import * as Weather from './weather.mjs';
import * as R from './rules.mjs';
import * as I18n from './i18n.mjs';

const t = (s, v) => I18n.t(s, v);
const HOLD_MS = 500;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── marks ────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const SVG = {
  up2: '<path d="M6 13l6-6 6 6M6 20l6-6 6 6"/>', up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>', down2: '<path d="M6 4l6 6 6-6M6 11l6 6 6-6"/>',
  none: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>',
  arrowUp: '<path d="M12 20V4M5 11l7-7 7 7"/>', arrowDown: '<path d="M12 4v16M5 13l7 7 7-7"/>',
  sure: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/>', change: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
};
const icon = (k, w = 3.6) => `<svg viewBox="0 0 24 24" fill="none" stroke="#0A1A33" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[k]}</svg>`;
const MATCH = {
  4: { cor: '#43D17C', ic: 'up2', txt: '×4', nome: 'Extremely effective' },
  2: { cor: '#8FE3AE', ic: 'up', txt: '×2', nome: 'Super effective' },
  0.5: { cor: '#FF8A8A', ic: 'down', txt: '×½', nome: 'Not very effective' },
  0.25: { cor: '#FF5A5A', ic: 'down2', txt: '×¼', nome: 'Barely effective' },
  0: { cor: '#B1B9CB', ic: 'none', txt: 'No effect', nome: 'No effect' },
};
const DOT = { up: { cor: '#43D17C', ic: 'arrowUp' }, down: { cor: '#FF8A8A', ic: 'arrowDown' }, sure: { cor: '#C9C6F6', ic: 'sure' }, change: { cor: '#F2C6CF', ic: 'change' } };
const matchKey = (e) => (e >= 4 ? 4 : e >= 2 ? 2 : e === 0 ? 0 : e <= 0.25 ? 0.25 : e <= 0.5 ? 0.5 : null);
const HEAL = new Set(['moonlight', 'synthesis', 'morningsun', 'morning-sun']);
const SOLAR = new Set(['solarbeam', 'solarblade']);
const real = (c) => !!c && c !== 'nevoeiro';
const wName = (c) => t(Weather.rotulo(c) || 'Clear sky');

/** What the weather does to one move: { kind: up|down|sure|change|null, lines: [{kind, txt}] } */
export function weatherEffect(g, clima) {
  const out = { kind: null, lines: [] };
  if (!g || !clima) return out;
  const id = String(g.id || ''), W = wName(clima);
  const add = (kind, txt) => { out.lines.push({ kind, txt }); if (!out.kind) out.kind = kind; };   // the dot shows the first (main) effect
  if (id === 'weatherball' && real(clima)) add('change', t('{w}: becomes {type} type, 100 power', { w: W, type: t(Weather.tipoGolpe(clima, g)) }));
  else if (HEAL.has(id) && real(clima)) clima === 'sol' ? add('up', t('{w}: heals ⅔ of max HP', { w: W })) : add('down', t('{w}: heals only ¼ of max HP', { w: W }));
  else {
    const tipo = Weather.tipoGolpe(clima, g), mul = g.cat === 'status' ? 1 : Weather.poderTipo(clima, tipo);
    if (mul > 1) add('up', t('{w} powers up {type} moves (×1.5)', { w: W, type: t(tipo) }));
    if (mul < 1) add('down', t('{w} weakens {type} moves (×0.5)', { w: W, type: t(tipo) }));
    if (SOLAR.has(id) && real(clima) && clima !== 'sol') add('down', t('{w}: half power', { w: W }));
    const acc = Weather.precisao(clima, g);
    if (acc === 1 && g.precisao != null && g.precisao < 100) add('sure', t('{w}: never misses', { w: W }));
    else if (acc === 0.5) add('down', t('{w}: only 50% accuracy', { w: W }));
  }
  if (clima === 'nevoeiro' && g.precisao != null) out.lines.push({ kind: 'down', txt: t('Fog: accuracy ×0.6') });   // every move: card only, no dot
  return out;
}

/* ── weather cards ────────────────────────────────────────────────────────────────────────────────────────────────── */
const CLIMA_INFO = {
  chuva: { up: ['Water moves ×1.5 power', 'Thunder and Hurricane never miss'], down: ['Fire moves ×0.5 power', 'Solar Beam ×0.5 · Synthesis, Moonlight, Morning Sun heal ¼'], ball: 'Water' },
  sol: { up: ['Fire moves ×1.5 power', 'Synthesis, Moonlight, Morning Sun heal ⅔', 'Nothing can be frozen'], down: ['Water moves ×0.5 power', 'Thunder and Hurricane only 50% accuracy'], ball: 'Fire' },
  areia: { up: ['Rock-types get ×1.5 Sp. Def'], down: ['Lose 1/16 HP each turn (not Rock, Ground or Steel)', 'Solar Beam ×0.5 · healing moves heal ¼'], ball: 'Rock' },
  neve: { up: ['Ice-types get ×1.5 Defense', 'Blizzard never misses'], down: ['Solar Beam ×0.5 · healing moves heal ¼'], ball: 'Ice' },
  granizo: { up: ['Blizzard never misses'], down: ['Lose 1/16 HP each turn (not Ice-types)', 'Solar Beam ×0.5 · healing moves heal ¼'], ball: 'Ice' },
  nevoeiro: { up: [], down: ["Every move's accuracy ×0.6"], ball: null },
};
CLIMA_INFO.chuva_forte = CLIMA_INFO.chuva;
export const ICONE_CLIMA = { chuva: 'icone-clima', chuva_forte: 'icone-clima', sol: 'icone-clima-2', neve: 'icone-clima-3', granizo: 'icone-clima-3', areia: 'icone-clima-4' };
export const iconeClima = (c) => (ICONE_CLIMA[c] ? './ui/figma_webp/ui2-v2/celular-atalhos-refs/clima/clima/' + ICONE_CLIMA[c] + '.webp' : null);

/* ── the floating card ────────────────────────────────────────────────────────────────────────────────────────────── */
let card = null, cardFor = null, hoverTimer = 0, dep = null, pinned = false;   // pinned: opened by a press-and-hold — stays until the next tap
function ensureCss() {
  if (document.getElementById('pv-marks-css')) return;
  const css = document.createElement('style');
  css.id = 'pv-marks-css';
  const ch = (n) => `polygon(${n}px 0,calc(100% - ${n}px) 0,100% ${n}px,100% calc(100% - ${n}px),calc(100% - ${n}px) 100%,${n}px 100%,0 calc(100% - ${n}px),0 ${n}px)`;
  css.textContent = `
.pv-mk-badge{position:absolute;z-index:5;display:inline-flex;align-items:center;gap:1px;box-sizing:border-box;border-style:solid;border-color:#0A1A33;border-radius:999px;color:#0A1A33;font-family:'Nunito Sans',sans-serif;font-weight:900;white-space:nowrap;pointer-events:none;line-height:1}
.pv-mk-badge svg,.pv-mk-dot svg{flex:none}
.pv-mk-dot{position:absolute;z-index:5;box-sizing:border-box;border-style:solid;border-color:#0A1A33;border-radius:999px;display:flex;align-items:center;justify-content:center;pointer-events:none}
#pv-card{position:fixed;z-index:9000;max-width:min(300px,calc(100vw - 16px));background:#35C6E8;padding:1.5px;clip-path:${ch(9)};pointer-events:none;font-family:'Nunito Sans',sans-serif;color:#EAF6FB;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
#pv-card>div{background:#0D2242;padding:10px 12px 11px;display:flex;flex-direction:column;gap:7px;clip-path:${ch(8)}}
#pv-card .top{height:2px;background:#F5B93B;margin:-6px 16px 1px;border-radius:2px}
#pv-card .hd{display:flex;align-items:center;justify-content:space-between;gap:8px}
#pv-card .nm{font-family:'Baloo 2',sans-serif;font-weight:800;font-size:17px;line-height:1;display:flex;align-items:center;gap:6px}
#pv-card .nm img{width:20px;height:20px;object-fit:contain}
#pv-card .ty{color:#0A1A33;font-weight:900;font-size:10px;border-radius:999px;padding:2px 8px}
#pv-card .st{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
#pv-card .st>div{background:#13305A;border-radius:6px;padding:3px 6px;display:flex;flex-direction:column;gap:1px}
#pv-card .st span{font-size:8.5px;font-weight:800;color:#A9CFE0;letter-spacing:.04em}
#pv-card .st b{font-size:12px;font-weight:900}
#pv-card p{margin:0;font-size:12px;font-weight:700;line-height:1.35;color:#D6E4EC}
#pv-card .mt{display:flex;flex-wrap:wrap;gap:4px 8px;font-size:11px;font-weight:800;color:#A9CFE0}
#pv-card hr{border:0;height:1px;background:#1E3C66;margin:0}
#pv-card .ln{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;line-height:1.3}
#pv-card .chip{flex:none;display:inline-flex;align-items:center;gap:1px;color:#0A1A33;border-radius:999px;padding:0 6px 0 3px;font-weight:900;height:16px;font-size:11px}
#pv-card .chip svg{width:10px;height:10px}
#pv-card .dot{flex:none;width:15px;height:15px;box-sizing:border-box;border:2px solid #0A1A33;border-radius:999px;display:inline-flex;align-items:center;justify-content:center}
#pv-card .dot svg{width:8px;height:8px}
#pv-card .lb{font-size:10px;font-weight:900;letter-spacing:.08em}
#pv-card .dim{color:#A9CFE0}
@media (pointer:coarse){#pv-card{max-width:min(250px,calc(100vw - 16px))}#pv-card .st span{font-size:7.5px;letter-spacing:0}#pv-card p,#pv-card .ln{font-size:11px}#pv-card .nm{font-size:15px}}
`;
  document.head.appendChild(css);
}
function showCard(html, anchor, key) {
  ensureCss();
  if (!card) { card = document.createElement('div'); card.id = 'pv-card'; card.setAttribute('role', 'tooltip'); document.body.appendChild(card); }
  card.innerHTML = '<div><div class="top"></div>' + html + '</div>';
  card.style.display = 'block';
  cardFor = key;
  const r = anchor.getBoundingClientRect(), cw = card.offsetWidth, chh = card.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 10;
  let x = r.left + r.width / 2 - cw / 2, y = r.top - chh - gap;          // above the slot (the PC bar sits at the bottom)
  if (y < 8) {
    if (r.height > r.width) { x = r.left - cw - gap; y = r.top + r.height / 2 - chh / 2; }   // the phone's move column (tall slots): beside it, on the left
    else y = r.bottom + gap;                                             // the minimap pill at the top: below it
  }
  card.style.left = Math.round(Math.max(8, Math.min(vw - cw - 8, x))) + 'px';
  card.style.top = Math.round(Math.max(8, Math.min(vh - chh - 8, y))) + 'px';
}
export function hideCard() { if (card) card.style.display = 'none'; cardFor = null; pinned = false; clearTimeout(hoverTimer); }
const cardOpen = () => !!cardFor;

/* ── card contents ────────────────────────────────────────────────────────────────────────────────────────────────── */
const CAT = { fisico: 'Physical', especial: 'Special', status: 'Status' };
const STAT = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', vel: 'Speed', prec: 'accuracy', eva: 'evasion' };
const STATUS = { paralysis: 'paralyze', burn: 'burn', poison: 'poison', 'bad-poison': 'badly poison', toxic: 'badly poison', sleep: 'put to sleep', freeze: 'freeze', confusion: 'confuse', flinch: 'make flinch' };
function effectLine(g) {
  const parts = [];
  if (g.status) {
    const who = g.statusEm === 'eu' ? t('the user') : t('the target'), ch = +g.statusChance || (g.cat === 'status' ? 100 : 0);
    parts.push((ch && ch < 100 ? ch + '% ' + t('chance') + ': ' : '') + t(STATUS[g.status] || g.status) + ' ' + who);
  }
  if (Array.isArray(g.estagios) && g.estagios.length) {
    const who = g.estagiosEm === 'eu' || g.proprio ? t("user's") : t("target's"), ch = +g.estagiosChance || 0;
    parts.push((ch && ch < 100 ? ch + '% ' + t('chance') + ': ' : '') + g.estagios.map(([a, n]) => who + ' ' + t(STAT[a] || a) + ' ' + (n > 0 ? '+' : '−') + Math.abs(n)).join(', '));
  }
  return parts;
}
function moveCard(g, slotMov, s) {
  const tipo = s.clima ? Weather.tipoGolpe(s.clima, g) : g.tipo;
  const cor = R.COR_TIPO?.[tipo] || '#C6C6A7';
  const acc = g.precisao == null || g.cat === 'status' && !g.precisao ? '—' : g.precisao + '%';
  const stats = [
    [t('CATEGORY'), t(CAT[g.cat] || g.cat || '—')],
    [t('POWER'), g.cat === 'status' || !g.poder ? '—' : String(g.poder)],
    [t('ACCURACY'), acc],
    s.turno ? [t('PP'), slotMov ? slotMov.pp + '/' + slotMov.ppMax : '—'] : [t('COOLDOWN'), (+g.recarga || 0) + ' s'],
  ];
  const meta = [];
  if (!s.turno && g.alcance) meta.push(t('Range {n} m', { n: g.alcance }));
  if (g.contato) meta.push(t('Contact'));
  if (+g.prioridade) meta.push(t('Priority {n}', { n: (g.prioridade > 0 ? '+' : '') + g.prioridade }));
  const eff = effectLine(g);
  let h = `<div class="hd"><span class="nm">${esc(t(g.nome || g.id))}</span><span class="ty" style="background:${cor}">${esc(t(tipo).toUpperCase())}</span></div>`;
  h += '<div class="st">' + stats.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('') + '</div>';
  if (g.descricao) h += `<p>${esc(t(g.descricao))}</p>`;
  if (eff.length || meta.length) h += `<div class="mt">${[...eff, ...meta].map((x) => '<span>' + esc(x) + '</span>').join('<span>·</span>')}</div>`;
  /* the marks, explained */
  const rows = [];
  const alvo = s.alvo, AS = alvo ? s.porDex.get(+alvo.dex) : null;
  if (AS && g.cat !== 'status') {
    const tipos = AS.types || ['Normal'], e = R.efetividade(s.chart, tipo, tipos), k = matchKey(e);
    const det = tipos.map((x) => t(x) + ' ×' + fmt(R.efetividade(s.chart, tipo, [x]))).join(', ');
    rows.push(`<div class="ln">${k != null ? `<span class="chip" style="background:${MATCH[k].cor}">${icon(MATCH[k].ic)}${esc(t(MATCH[k].txt))}</span>` : `<span class="chip" style="background:#2A4166;color:#A9CFE0;padding:0 6px">×1</span>`}<span>${esc(t('vs {name}', { name: alvo.nome || AS.name }))}: ${esc(det)}</span></div>`);
  }
  for (const l of weatherEffect(g, s.clima).lines) rows.push(`<div class="ln"><span class="dot" style="background:${DOT[l.kind].cor}">${icon(DOT[l.kind].ic, 4)}</span><span>${esc(l.txt)}</span></div>`);
  const pikaTipos = s.pikaTipos || s.porDex.get(+s.pika?.dex)?.types || [];
  if (g.cat !== 'status' && pikaTipos.length) {
    const stab = pikaTipos.includes(tipo);
    rows.push(`<div class="ln${stab ? '' : ' dim'}"><span class="chip" style="background:${stab ? '#C9C6F6' : '#2A4166'};${stab ? '' : 'color:#A9CFE0;'}padding:0 6px">STAB</span><span>${esc(stab ? t('Same-type bonus ×1.5') : t('No same-type bonus'))}</span></div>`);
  }
  if (rows.length) h += '<hr>' + rows.join('');
  return h;
}
const fmt = (e) => (e === 0.5 ? '½' : e === 0.25 ? '¼' : String(e));
function weatherCard(s) {
  const c = s.indoors ? null : s.clima, ic = iconeClima(c);
  let h = `<div class="hd"><span class="nm">${ic ? `<img alt="" src="${ic}">` : ''}${esc(c ? wName(c) : s.indoors ? t('Indoors') : t('Clear sky'))}</span></div>`;
  const I = c && CLIMA_INFO[c];
  if (!I) return h + `<p class="dim">${esc(s.indoors ? t('No weather indoors. Every move works normally.') : t('No weather effects. Every move works normally.'))}</p>`;
  const row = (k, x) => `<div class="ln"><span class="dot" style="background:${DOT[k].cor}">${icon(DOT[k].ic, 4)}</span><span>${esc(t(x))}</span></div>`;
  if (I.up.length) h += `<span class="lb" style="color:#43D17C">${esc(t('HELPS'))}</span>` + I.up.map((x) => row('up', x)).join('');
  if (I.down.length) h += `<span class="lb" style="color:#FF8A8A">${esc(t('HURTS'))}</span>` + I.down.map((x) => row('down', x)).join('');
  if (I.ball) h += `<hr><p class="dim">${esc(t('Weather Ball: {type} type, 100 power', { type: t(I.ball) }))}</p>`;
  return h;
}

/* ── hover (0.5 s) / press-and-hold (0.5 s) wiring ────────────────────────────────────────────────────────────────── */
function wire(el, key, build) {
  if (el.__pvCard) return;
  el.__pvCard = true;
  let holdTimer = 0, held = false, sx = 0, sy = 0;
  const open = () => { const h = build(); if (h) showCard(h, el, key); };
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(hoverTimer);
    if (cardOpen()) open(); else hoverTimer = setTimeout(open, HOLD_MS);   // a card already open: the next one switches at once
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { if (cardFor === key) hideCard(); }, 120);   // a short grace so sliding to the next slot keeps it open
  });
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { hideCard(); return; }                 // clicking uses the move right away
    held = false; sx = e.clientX; sy = e.clientY;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { held = true; open(); }, HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clearTimeout(holdTimer); });
  const end = (e) => { if (e.pointerType === 'mouse') return; clearTimeout(holdTimer); if (held) pinned = true; };   // the card stays up: the next tap anywhere closes it
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => { if (held) e.preventDefault(); });
  el.addEventListener('click', (e) => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);   // a hold never fires the move / opens the calendar
}

/* ── per-frame paint ──────────────────────────────────────────────────────────────────────────────────────────────── */
function slotGeom(el) {
  const ti = el.querySelector('[data-fig="slot-tipo"]');
  const box = (n) => ({ x: parseFloat(n?.style.left) || 0, y: parseFloat(n?.style.top) || 0, w: parseFloat(n?.style.width) || 0, h: parseFloat(n?.style.height) || 0 });
  const tb = ti ? box(ti) : null, W = el.offsetWidth || 180, H = el.offsetHeight || 54;
  const k = (tb?.w || 25) / 25, wide = W > H * 1.6;
  return { tb, k, wide, W, H };
}
function paintSlot(el, i, s) {
  const id = s.pika?.golpesIds?.[i], g = id && s.golpes[id];
  let b = el.__pvBadge, d = el.__pvDot;
  if (!b) { b = el.__pvBadge = document.createElement('span'); b.className = 'pv-mk-badge'; el.appendChild(b); }
  if (!d) { d = el.__pvDot = document.createElement('span'); d.className = 'pv-mk-dot'; el.appendChild(d); }
  if (!b.isConnected) el.appendChild(b);
  if (!d.isConnected) el.appendChild(d);
  /* matchup */
  let mk = null;
  if (g && g.cat !== 'status' && s.alvo) {
    const AS = s.porDex.get(+s.alvo.dex);
    if (AS) mk = matchKey(R.efetividade(s.chart, s.clima ? Weather.tipoGolpe(s.clima, g) : g.tipo, AS.types || ['Normal']));
  }
  const geo = slotGeom(el), k = geo.k;
  const bKey = mk + '|' + k + '|' + geo.wide;
  if (b.__k !== bKey) {
    b.__k = bKey;
    if (mk == null) b.style.display = 'none';
    else {
      const M = MATCH[mk], hh = 15 * k;
      b.innerHTML = icon(M.ic) + esc(t(M.txt));
      Object.assign(b.style, { display: 'inline-flex', background: M.cor, height: hh + 'px', fontSize: (mk === 0 ? 8.5 : 9.5) * k + 'px', borderWidth: Math.max(1, 1.5 * k) + 'px',
        padding: `0 ${5 * k}px 0 ${3 * k}px`, top: -8 * k + 'px', right: (geo.wide ? 8 : -5) * k + 'px', left: 'auto' });
      for (const sv of b.querySelectorAll('svg')) { sv.style.width = 9 * k + 'px'; sv.style.height = 9 * k + 'px'; }
    }
  }
  /* weather dot */
  const we = g ? weatherEffect(g, s.clima).kind : null;
  const dKey = we + '|' + (geo.tb ? geo.tb.x + ',' + geo.tb.y + ',' + geo.tb.w : '-');
  if (d.__k !== dKey) {
    d.__k = dKey;
    if (!we || !geo.tb) d.style.display = 'none';
    else {
      const D = DOT[we], sz = geo.tb.w * 0.48;
      d.innerHTML = icon(D.ic, 4.4);
      Object.assign(d.style, { display: 'flex', background: D.cor, width: sz + 'px', height: sz + 'px', borderWidth: Math.max(1, 1.5 * k) + 'px',
        left: geo.tb.x + geo.tb.w * 0.66 + 'px', top: geo.tb.y + geo.tb.h * 0.62 + 'px' });
      const sv = d.querySelector('svg'); sv.style.width = sz * 0.58 + 'px'; sv.style.height = sz * 0.58 + 'px';
    }
  }
  /* the card */
  wire(el, 'sk' + i, () => {
    const st = dep.state(), gg = st.golpes[st.pika?.golpesIds?.[i]];
    return gg ? moveCard(gg, st.pika?.movs?.[i], st) : null;
  });
  if (cardFor === 'sk' + i && !g) hideCard();
}
export function paint() {
  if (!dep) return;
  let s = null;
  try { s = dep.state(); } catch { return; }   // early frames: the game's weather state may not exist yet
  if (!s?.pika) return;
  s.pikaTipos = s.porDex.get(+s.pika.dex)?.types || [];
  for (let i = 0; i < 4; i++) { const el = document.getElementById('sk' + (i + 1)); if (el) paintSlot(el, i, s); }
  for (const g of document.querySelectorAll('#minimapa [data-fig="tempo"]')) wire(g, 'clima', () => weatherCard(dep.state()));
}
export function install(d) {
  dep = d;
  ensureCss();
  /* A card opened by press-and-hold stays until the next tap. That tap only closes it when it lands on a move slot or the
     pill (so reading a card never fires a move by accident); anywhere else the tap also does its normal job. */
  let swallow = null;
  addEventListener('pointerdown', (e) => {
    if (!pinned || e.pointerType === 'mouse') return;
    const on = e.target?.closest?.('#sk1,#sk2,#sk3,#sk4,#minimapa [data-fig="tempo"]');
    hideCard();
    if (on) { swallow = on; e.stopImmediatePropagation(); }
  }, true);
  addEventListener('click', (e) => { if (swallow && swallow.contains(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); } swallow = null; }, true);
  addEventListener('blur', hideCard);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hideCard(); });
}
