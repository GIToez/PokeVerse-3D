/* ACTIVE EFFECTS (Nov 5, v2 `efeitos-ativos` + `dica-efeito`): round timers under the minimap for what is boosting you right now,
 * and a tooltip on hover:
 *   evento   = the live event / scheduled bonus (event.mjs: EXP ×N, shiny ×N), for everyone, until it ends
 *   medalhao = the Medallion membership (account.mjs meuMedalhaoAte; sold in the shop later), with its perks
 *   perfume  = Silver Perfume (account.mjs meuPerfume: shiny ×N for a while; sold in the shop later)
 * The ring empties as the time runs out. Nothing active = nothing on screen.
 *   instalar({ Conta, Evento, tr })  — then it repaints itself every second */
import * as Hud from './hud.mjs';

let ctx = null, el = null, dica = null, vistoDesde = {}, timer = null, sobre = -1, lista = [];
export function instalar(c) {
  ctx = c;
  clearInterval(timer);
  timer = setInterval(pintar, 1000);
  setTimeout(pintar, 1500);
}
const tr = (s, v) => ctx?.tr?.(s, v) ?? s;
function curto(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600), m = Math.floor(s / 60);
  if (d >= 1) return d + ' d';
  if (h >= 1) return h + ' h';
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function longo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d >= 1) return d + ' d ' + h + ' h';
  if (h >= 1) return h + ' h ' + m + ' min';
  return m + ' min ' + (s % 60) + ' s';
}
const quando = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
/** What is active now → [{ tipo, nome, fim, ini, linha, xp, mult, beneficios }] */
function ativos() {
  const out = [], agora = Date.now();
  const med = +ctx?.Conta?.meuMedalhaoAte?.() || 0;
  if (med > agora) out.push({ tipo: 'medalhao', chave: 'medalhao', nome: tr('Medallion'), fim: med, ini: med - 30 * 86400e3,
    linha: tr('Ends in {t} ({d})', { t: longo(med - agora), d: quando(med) }),
    beneficios: { xp: tr('XP +20%'), caixa: tr('+100 Box space'), mercado: tr('+10 listings'), viagem: tr('Travel −50%'), selo: tr('Chat badge') } });
  const pf = ctx?.Conta?.meuPerfume?.();
  if (pf && pf.ate > agora) out.push({ tipo: 'perfume', chave: 'perfume', nome: tr('Silver Perfume'), fim: pf.ate, ini: pf.ate - 3600e3,
    linha: tr('Shiny ×{n} · ends in {t}', { n: pf.mult, t: longo(pf.ate - agora) }) });
  const ev = ctx?.Evento?.agora?.() || {};
  const fimEv = ev.fim ? Date.parse(ev.fim) : 0;
  for (const [k, mult, rot, nome] of [['xp', ev.expMult, 'XP', 'XP Bonus ×{n}'], ['shiny', ev.shinyMult, '✨', 'Shiny Bonus ×{n}']]) {
    if (!(+mult > 1)) continue;
    const chave = 'evento-' + k + '-' + (ev.fim || '');
    vistoDesde[chave] ||= agora;                                      // the event's start isn't sent: the ring counts from when we first saw it
    out.push({ tipo: 'evento', chave, nome: tr(nome, { n: mult }), fim: fimEv || 0, ini: vistoDesde[chave], xp: rot, mult: '×' + mult,
      linha: fimEv ? tr('For everyone · ends in {t}', { t: longo(fimEv - agora) }) : tr('For everyone · while the event lasts') });
  }
  return out;
}
function anel(fig, k, cor, molde) {
  if (!fig) return;
  const p = Math.round(Math.max(0, Math.min(1, k)) * 360), esp = +molde?.espessura || 4.5;
  Object.assign(fig.style, { width: (molde?.w || 49) + 'px', height: (molde?.h || 49) + 'px', display: 'block', borderRadius: '50%', backgroundColor: 'transparent',
    background: `conic-gradient(${cor || '#F5B93B'} ${p}deg, transparent ${p}deg)`,
    WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${esp}px), #000 calc(100% - ${esp - 0.5}px))`,
    mask: `radial-gradient(farthest-side, transparent calc(100% - ${esp}px), #000 calc(100% - ${esp - 0.5}px))` });
}
/* Under the Mail / Events / Shop buttons, left of the minimap (the space under the minimap is the raid card's). */
function posicionar() {
  const mm = document.getElementById('minimapa');
  const r = mm && !mm.hidden && getComputedStyle(mm).display !== 'none' ? mm.getBoundingClientRect() : null;   // (fixed elements have no offsetParent)
  if (r && r.width) Hud.sitEm(el, r.left - 14, r.top + 66, 'topo-dir');
  else Hud.sitEm(el, innerWidth - 12, 210, 'topo-dir');
}
export function pintar() {
  if (!ctx) return;
  lista = ativos();
  el = Hud.sit('efeitos-ativos');
  if (!el) return;
  if (!lista.length) { Hud.sitMostrar(el, false); mostrarDica(-1); return; }
  const linhas = Hud.sitCelulas(el, 'efeito', lista.map((e) => e.tipo));
  const agora = Date.now();
  linhas.forEach((r, i) => {
    const e = lista[i];
    Hud.escrever(r, 'tempo', e.fim ? curto(e.fim - agora) : '∞');
    if (e.tipo === 'evento') { Hud.escrever(r, 'xp', e.xp); Hud.escrever(r, 'mult', e.mult); }
    const f = r.querySelector('[data-fig="fill/anel-tempo"]');
    const molde = r.__molde?.filhos?.find((x) => x.nome === 'fill/anel-tempo');
    anel(f, e.fim && e.fim > e.ini ? (e.fim - agora) / (e.fim - e.ini) : 1, molde?.cor, molde);
    if (!r.__hover) {
      r.__hover = true;
      r.addEventListener('pointerenter', () => mostrarDica(+r.dataset.i));
      r.addEventListener('pointerleave', () => mostrarDica(-1));
    }
  });
  el.style.pointerEvents = 'auto';
  Hud.sitMostrar(el, true);
  posicionar();
  if (sobre >= 0) mostrarDica(sobre);
}
function mostrarDica(i) {
  sobre = i;
  dica = Hud.sit('dica-efeito');
  if (!dica) return;
  const e = lista[i];
  if (!e) { Hud.sitMostrar(dica, false); return; }
  const est = e.tipo === 'medalhao' ? 'medalhao-beneficios' : e.tipo;
  Hud.sitEstado(dica, est);
  Hud.escrever(dica, 'dica-nome', e.nome);
  Hud.escrever(dica, 'dica-falta', e.linha);
  for (const [k, v] of Object.entries(e.beneficios || {})) Hud.escrever(dica, 'beneficio-' + k, v);
  dica.style.pointerEvents = 'none';
  dica.style.zIndex = '60';
  Hud.sitMostrar(dica, true);
  const r = el?.querySelector('[data-sit-linha="' + i + '"]')?.getBoundingClientRect();
  if (r) Hud.sitEm(dica, r.right, r.bottom + 6, 'topo-dir');
}
