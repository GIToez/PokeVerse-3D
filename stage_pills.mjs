/* RIVAL STAGES (Nov 5): a foe's stat stages as the v2 pills (layout situacao.pc['estagios-rival']: green "Atk ▲2" when a stat
 * went up, red "Spe ▼1" when it went down) instead of the old plain "Atk+2 Spe−1" text on its label.
 *   html(estagios) → '<span class="stg-pills">…</span>' | ''   (empty when nothing changed or the layout has no pills)
 * Falls back to the plain text when the layout piece is missing. */
import * as Hud from './hud.mjs';
import * as Stg from './stages.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let estilo = false;
function css() {
  if (estilo) return;
  estilo = true;
  const st = document.createElement('style');
  st.textContent = '.stg-pills{display:flex;justify-content:center;gap:3px;margin:2px 0 1px}'
    + '.stg-pills>b{display:inline-flex;align-items:center;justify-content:center;background-repeat:no-repeat;font:800 10px/1 "Baloo 2",system-ui,sans-serif;white-space:nowrap;padding:0 6px}';
  document.head.appendChild(st);
}
function moldes() {
  const m = Hud.layoutAtual?.()?.situacao?.pc?.['estagios-rival']?.celulas?.estagio?.moldes;
  return m?.sobe && m?.desce ? m : null;
}
function pilula(m, texto) {
  const p = +m.imgPad || 0, t = (m.filhos || []).find((f) => f.tipo === 'txt') || {};
  const url = String(m.img || '').replace(/^\.\//, './');
  return `<b style="min-width:${m.w}px;height:${m.h}px;color:${t.cor || '#fff'};background-image:url('${url}');`
    + `background-size:calc(100% + ${2 * p}px) calc(100% + ${2 * p}px);background-position:-${p}px -${p}px">${esc(texto)}</b>`;
}
export function html(est) {
  if (!est) return '';
  const lista = Stg.ATRIBUTOS.filter((a) => est[a]);
  if (!lista.length) return '';
  const M = moldes();
  if (!M) return '<small>' + esc(Stg.resumo(est)) + '</small>';
  css();
  return '<span class="stg-pills">' + lista.map((a) => pilula(est[a] > 0 ? M.sobe : M.desce, Stg.sigla(a) + ' ' + (est[a] > 0 ? '▲' : '▼') + Math.abs(est[a]))).join('') + '</span>';
}
