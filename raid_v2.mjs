/* RAID v2 pieces (Nov 5): the boss bar on top (`barra-chefe`: portrait, name · level, HP bar and %, time left) and the end-of-raid
 * card (`aviso-fim-raid`: the boss portrait, "<Boss> defeated!", your prize tier and what you got). Raid tickets aren't used here,
 * so the ticket line carries the prize instead.
 *   barra(info | null, segundosRestantes)   info = { nome, lv, hp, maxHp, dex }  → false when the layout has no bar
 *   fim({ venceu, nome, dex, parte, premioTxt, motivo })  → false when the layout has no card */
import * as Hud from './hud.mjs';
import { t as tr } from './i18n.mjs';

const cabeca = (dex) => (+dex > 0 ? './ui/mon/pm' + String(Math.round(+dex)).padStart(4, '0') + '.png' : null);
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
let bar = null;
export function barra(info, segundos = 0) {
  bar = Hud.sit('barra-chefe', { ocultos: true });
  if (!bar) return false;
  if (!info) { Hud.sitMostrar(bar, false); return true; }
  const maxHp = Math.max(1, Math.round(+info.maxHp || +info.hp || 1)), hp = Math.max(0, Math.min(maxHp, Math.round(+info.hp || 0))), k = hp / maxHp;
  Hud.escrever(bar, 'chefe-nome', (info.nome || '?') + (info.lv ? ' · Lv ' + info.lv : ''));
  Hud.escrever(bar, 'chefe-vida', (hp > 0 ? Math.max(1, Math.ceil(k * 100)) : 0) + '%');
  Hud.fill(bar.querySelector('[data-fig="fill/vida-chefe"]'), k, k <= 0.2 ? '#F55B5B' : k <= 0.5 ? '#F5B93B' : '#43D17C');
  const acaba = bar.querySelector('[data-fig="rotulo-acaba"]'); if (acaba) acaba.textContent = tr('ends in');
  Hud.escrever(bar, 'chefe-tempo', segundos > 0 ? mmss(segundos) : '');
  for (const n of ['icone-relogio', 'rotulo-acaba']) { const e = bar.querySelector('[data-fig="' + n + '"]'); if (e) e.style.visibility = segundos > 0 ? '' : 'hidden'; }
  Hud.figImagem(bar, 'boss', cabeca(info.dex));
  bar.style.pointerEvents = 'none';
  Hud.sitEm(bar, innerWidth / 2, 10, 'topo-meio');
  Hud.sitMostrar(bar, true);
  return true;
}
let fimEl = null, tFim = 0;
export function fim({ venceu = false, nome = '', dex = 0, parte = 0, premioTxt = '', motivo = '' } = {}) {
  fimEl = Hud.sit('aviso-fim-raid', { ocultos: true });
  if (!fimEl) return false;
  const estado = venceu && premioTxt ? 'premio' : 'ja-pago';                // ja-pago = the card with a title and one line of reason
  Hud.sitEstado(fimEl, estado);
  Hud.escrever(fimEl, 'fim-titulo', venceu ? tr('{x} defeated!', { x: nome }) : tr('{x} got away', { x: nome }));
  if (estado === 'premio') {
    Hud.escrever(fimEl, 'faixa', parte >= 1 ? tr('GOLD') : parte >= 0.25 ? tr('SILVER') : tr('BRONZE'));
  } else Hud.escrever(fimEl, 'fim-motivo', motivo);
  /* the designer's ticket line is a hidden-by-default node (our raids have no tickets): the prize gets its own line in its place */
  let linha = fimEl.querySelector(':scope > .fim-premio');
  if (!linha) { linha = document.createElement('div'); linha.className = 'fim-premio'; Object.assign(linha.style, { position: 'absolute', left: '128px', top: '64px', width: '496px', minHeight: '32px', font: '800 17px/1.25 "Baloo 2", system-ui, sans-serif', color: '#FFD9C9', display: 'flex', alignItems: 'center' }); fimEl.appendChild(linha); }
  linha.textContent = estado === 'premio' ? tr('Prize: {x}', { x: premioTxt }) : '';
  linha.style.display = estado === 'premio' ? 'flex' : 'none';
  Hud.figImagem(fimEl, 'boss', cabeca(dex));
  Hud.estado(fimEl, 'premio', estado === 'premio' ? 1 : 0);
  fimEl.style.pointerEvents = 'none';
  fimEl.style.zIndex = '40';
  Hud.sitEm(fimEl, innerWidth / 2, 96, 'topo-meio');
  Hud.sitMostrar(fimEl, true);
  clearTimeout(tFim);
  tFim = setTimeout(() => Hud.sitMostrar(fimEl, false), 8000);
  return true;
}
