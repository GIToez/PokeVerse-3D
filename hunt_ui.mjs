/* HUNT BONUS on screen (Nov 5): the "+N · hunting bonus" line that floats up from a knocked-out wild Pokémon (v2 `linha-bonus-caca`)
 * and the pool the Trainer card's bar shows. The server (server_hunt.mjs) pays and sends { t: 'caca', ganho, saldo, cap, x, z }.
 *   definir({ saldo, cap })  ·  vista() → { saldo, cap } | null  ·  ganho(m, chaoEm) */
import * as Hud from './hud.mjs';
import { t as tr } from './i18n.mjs';

let estado = null;
export function definir(v) { if (v && Number.isFinite(+v.saldo)) estado = { saldo: +v.saldo, cap: +v.cap || 0 }; }
export const vista = () => estado;

const vivos = [];
export function ganho(m, chaoEm = null) {
  definir(m);
  if (!(+m.ganho > 0)) return;
  const def = Hud.sitDef('linha-bonus-caca');
  if (!def) return;
  /* one element per line (several KOs in a row stack): built from the same layout piece */
  linha(m, chaoEm, '+' + Number(m.ganho).toLocaleString('en-US') + ' · ' + tr('hunting bonus'), null, 0);
  if (+m.saldo === 0) linha(m, chaoEm, tr("today's hunting bonus is used up · XP keeps coming"), 'acabou', 700);   // the pool just ran dry
}
function linha(m, chaoEm, texto, estadoArte, atraso) {
  const el = Hud.sit('linha-bonus-caca');
  if (!el) return;
  Hud.sitEstado(el, estadoArte);
  const c = el.cloneNode(true);
  Hud.sitEstado(el, null); c.id = ''; c.hidden = false; c.className = 'hud-sit-linha'; delete c.dataset.sit;   // the HUD sweeps stray .hud-sit pieces: the copies have their own class c.style.pointerEvents = 'none'; c.style.zIndex = '33';
  document.body.appendChild(c);
  const t = c.querySelector('[data-fig="txt/bonus"],[data-fig^="txt/"]');
  if (t) t.textContent = texto;
  c.style.visibility = 'hidden';
  const x = +m.x, z = +m.z, y = (chaoEm?.(x, z) ?? 0) + 1.4 + (atraso ? 0.5 : 0), t0 = performance.now() + atraso;
  const it = { c, x, y, z, t0 }; vivos.push(it);
  const passo = () => {
    const k = (performance.now() - t0) / (atraso ? 2600 : 1800);
    if (k < 0) { requestAnimationFrame(passo); return; }
    if (k >= 1 || !c.isConnected) { c.remove(); vivos.splice(vivos.indexOf(it), 1); return; }
    const sobe = k * 0.9;
    if (Number.isFinite(x) && Number.isFinite(z)) Hud.sitSeguir(c, { x, y: y + sobe, z, altura: 0 }, 0); else c.style.visibility = 'hidden';
    c.style.opacity = String(k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25);
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
