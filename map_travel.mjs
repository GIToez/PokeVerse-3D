/* Fly from the v2 world map (map_ui.mjs) on top of the live Fly rules (index.html VOAR, menus.mjs ctx.voar).
 * Stands in for the v2 travel_ui.mjs, whose list waits for a server `viagem_vista` this server doesn't send. The v2
 * Teleport button is hidden: there's no teleport on this server. */
import { t as tr } from './i18n.mjs';
import * as Popup from './popup.mjs';
import * as M from './popup_templates.mjs';

let ctx = {};
let pop = null,
  lista = null;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function instalar(c) {
  ctx = { ...ctx, ...(c || {}) };
}

export function noMapa(a) {
  if (!a) return;
  pop = a;
  const t = Popup.grupo(a, 'btn-teleporte');
  if (t) t.style.display = 'none';
  Popup.textoCru(a, 'voar', tr('Fly'));
}

function fecharLista() {
  if (!lista || lista.hidden) return false;
  lista.hidden = true;
  return true;
}

export function abrirListaV2() {
  if (!pop) return false;
  if (fecharLista()) return true;
  if (!lista) {
    lista = document.createElement('div');
    lista.className = 'mp-voar-lista';
    Object.assign(lista.style, {
      position: 'absolute', zIndex: '970', minWidth: '260px', maxHeight: '60%', overflow: 'auto', padding: '10px',
      borderRadius: '14px', border: '2px solid #3E78B5', background: 'linear-gradient(#1C3D66,#11294A)',
      boxShadow: '0 4px 0 #06101d,0 8px 20px rgba(0,0,0,.45)', color: '#EAF6FB', pointerEvents: 'auto',
      font: "700 14px 'Nunito Sans', system-ui, sans-serif",
    });
    lista.addEventListener('pointerdown', (e) => e.stopPropagation());
    pop.appendChild(lista);
    pop.addEventListener('pointerdown', (e) => {
      if (!lista.hidden && !lista.contains(e.target) && !e.target?.closest?.('[data-fig="btn-voar"]')) fecharLista();
    }, true);
  }
  const V = ctx.voar?.(),
    pode = V?.pode?.() || { ok: false, motivo: tr('Fly is not available.') },
    centros = V?.lista?.() || [];
  lista.innerHTML =
    `<div style="font:800 16px 'Baloo 2',sans-serif;color:#F5B93B;margin:0 0 6px">${esc(tr('Fly'))}</div>` +
    (pode.ok ? '' : `<div style="padding:2px 4px 8px;color:#FFD23A">${esc(pode.motivo)}</div>`) +
    (centros.length ? '' : `<div style="padding:2px 4px;color:#8FA9C4">${esc(tr('Visit a Pokémon Center to fly there later.'))}</div>`) +
    centros
      .map(
        (c) =>
          `<button type="button" data-voar="${esc(c.chegada)}" ${pode.ok ? '' : 'disabled'} style="display:block;width:100%;text-align:left;margin:3px 0;padding:8px 12px;border-radius:10px;border:1.5px solid ${pode.ok ? '#F8C237' : 'rgba(143,169,196,.4)'};background:${pode.ok ? 'rgba(14,31,51,.7)' : 'transparent'};color:${pode.ok ? '#fff' : '#7f8aa6'};font:inherit;cursor:${pode.ok ? 'pointer' : 'default'}">${esc(c.nome)}</button>`,
      )
      .join('');
  for (const e of lista.querySelectorAll('[data-voar]'))
    e.onclick = (ev) => {
      ev.stopPropagation();
      if (V.ir(e.dataset.voar)) {
        fecharLista();
        ctx.fecharMenu?.();
      }
    };
  lista.hidden = false;
  const b = Popup.grupo(pop, 'btn-voar');
  lista.style.left = (b ? M.px(b, 'left') : 24) + 'px';
  lista.style.top = Math.max(8, (b ? M.px(b, 'top') : 800) - 8 - lista.offsetHeight) + 'px';
  return true;
}

export function voarDaLinha() {
  return false;
}

export function clicouTeleporteV2() {
  return false;
}

export function fecharTopo() {
  return fecharLista();
}

export function receber() {
  return false;
}
