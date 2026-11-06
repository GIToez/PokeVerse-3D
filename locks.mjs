/* DOOR LOCKS (Nov 5, `travas` from PokeFable's missions file → public/data/locks.json, editable in the admin's "Door locks"):
 * a door stays shut until a story mission is done, enough Badges, an item, or the Champion title, and the v2 lock bubble
 * (`balao-trava`) says why above the player's head instead of the door working. GM accounts walk through everything.
 * Leaving a locked place always works (only going IN is blocked).
 *   carregar()                                  → loads the list (once)
 *   travaDaPorta(portaId, areaDestino, areaAqui) → { titulo, motivo } | null
 *   mostrar(trava, ondeSeguir)                   → the bubble for ~3.5 s
 * ctx (instalar): { feita(id), nomeMissao(id), insignias(), temItem(id), campeao(), gm() , tr(s, v) } */
import * as Hud from './hud.mjs';

let ctx = null, lista = [], carga = null, mostrando = null;
export function instalar(c) { ctx = c; carregar(); }
const tr = (s, v) => ctx?.tr?.(s, v) ?? s;
export function carregar() {
  return (carga ||= fetch('./data/locks.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).then((l) => { lista = Array.isArray(l) ? l : []; return lista; }).catch(() => (lista = [])));
}
/** Why this lock is still shut (null = open now). */
function motivo(t) {
  if (t.ate != null && !ctx.feita(t.ate)) return tr('Opens after the mission “{x}”.', { x: tr(ctx.nomeMissao(t.ate) || '#' + t.ate) });
  if (t.insignias != null && ctx.insignias() < +t.insignias) return tr('Opens with {n} Badges ({t} so far).', { n: t.insignias, t: ctx.insignias() });
  if (t.item != null && !ctx.temItem(t.item)) return tr('You need a key to open it.');
  if (t.campeao && !ctx.campeao()) return tr('Only the Kanto Champion may enter.');
  return null;
}
export function travaDaPorta(portaId, areaDestino, areaAqui) {
  if (!ctx || ctx.gm?.()) return null;
  for (const t of lista) {
    if (!t || t.ligada === false) continue;
    const areas = (t.areas || []).map(Number);
    if (areaAqui != null && areas.includes(+areaAqui)) continue;            // already inside: the way out is never locked
    const porta = (t.portas || []).map(Number).includes(+portaId), dentro = areaDestino != null && areas.includes(+areaDestino);
    if (!porta && !dentro) continue;
    const m = motivo(t);
    if (m) return { titulo: tr(t.titulo || 'Door locked'), motivo: m, fala: t.fala ? tr(t.fala) : '' };
  }
  return null;
}
/** The bubble above whoever (`seguir` = { x, y, z, altura } getter) for a few seconds. */
export function mostrar(trava, seguir) {
  const el = Hud.sit('balao-trava');
  if (!el || !trava) return false;
  Hud.escrever(el, 'trava-titulo', trava.titulo);
  Hud.escrever(el, 'trava-motivo', trava.motivo);
  el.style.pointerEvents = 'none';
  el.style.zIndex = '45';
  Hud.sitMostrar(el, true);
  const id = (mostrando = {});
  const fim = performance.now() + 3500;
  const passo = () => {
    if (mostrando !== id) return;
    if (performance.now() > fim) { Hud.sitMostrar(el, false); mostrando = null; return; }
    const p = seguir?.();
    if (p) Hud.sitSeguir(el, { x: p.x, y: p.y, z: p.z, altura: (p.altura || 1.6) + 0.5 }, 0);
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
  return true;
}
