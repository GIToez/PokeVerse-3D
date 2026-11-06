/* FOCUS THIS ONE (Nov 5, v2 `foca-neste`): "<name>: focus this one!" and a green ring on the target a raid member pinged
 * (V by default). Only the people in that raid get the ping (server_raid.mjs `raid_foco` → { t: 'foco', de, alvo }).
 *   mostrar(nome, alvo, tr)   // alvo = the entity in the field (x, y, z); ~4 s, a new ping replaces the old */
import * as Hud from './hud.mjs';

let vivo = null;
export function mostrar(nome, alvo, tr = (s, v) => s) {
  const el = Hud.sit('foca-neste');
  if (!el || !alvo) return false;
  Hud.escrever(el, 'foca-neste', tr('{x}: focus this one!', { x: nome }));
  el.style.pointerEvents = 'none';
  el.style.zIndex = '33';
  Hud.estado(el, 'selecionado', 1);                                    // the green ring only shows in this state
  Hud.sitMostrar(el, true);
  const id = (vivo = {}), fim = performance.now() + 4000;
  const passo = () => {
    if (vivo !== id) return;
    const morto = !alvo.pivo?.parent || alvo.hp <= 0;
    if (performance.now() > fim || morto) { Hud.sitMostrar(el, false); vivo = null; return; }
    /* the ring (marca-foca, centre 177,120 in the piece) goes round the target's middle; the banner rides above it */
    if (Hud.sitSeguir(el, { x: alvo.vx ?? alvo.x, y: alvo.vy ?? alvo.y ?? 0, z: alvo.vz ?? alvo.z, altura: (alvo.altura || 1) * 0.5 }, 0)) {
      const k = (Hud.escalaAtual?.() || 1) * (el.__sitEscala || 1), x = parseFloat(el.style.left), y = parseFloat(el.style.top);
      Hud.sitEm(el, x - 177 * k, y - 120 * k, 'topo');
    }
    el.style.opacity = String(Math.min(1, (fim - performance.now()) / 600));
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
  return true;
}
