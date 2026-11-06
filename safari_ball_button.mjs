/* SAFARI BALL BUTTON (Nov 5, v2 `btn-pokebola`, state `safari`): during a Safari visit the ball button becomes the Safari one —
 * the Safari Ball, how many are left and the throw key — laid over the normal button (which hides) until the visit ends.
 *   pintar({ visita, restantes, tecla, icone, jogar })   — call it whenever the bar repaints */
import * as Hud from './hud.mjs';

let el = null, ligado = false;
{ const st = document.createElement('style'); st.textContent = 'body.bola-safari #bola-btn{visibility:hidden}'; document.head.appendChild(st); }
export function pintar({ visita = false, restantes = 0, tecla = 'F', icone = './ui/itens/ic_1005.png', jogar = null } = {}) {
  const base = document.getElementById('bola-btn');
  const rb = base?.getBoundingClientRect();
  if (!visita || !base || !rb?.width) {
    if (ligado) { ligado = false; if (el) Hud.sitMostrar(el, false); document.body.classList.remove('bola-safari'); }
    return false;
  }
  el = Hud.sit('btn-pokebola', { ocultos: true });
  if (!el) return false;
  Hud.sitEstado(el, 'safari');
  Hud.escrever(el, 'qtd-ball', restantes + 'x');
  Hud.escrever(el, 'tecla', tecla);
  Hud.figImagem?.(el, 'pokebola', icone);
  const troca = el.querySelector('[data-fig="btn-troca-ball"]'); if (troca) troca.style.display = 'none';   // only Safari Balls in the Zone: nothing to switch to
  el.style.zIndex = '30';
  el.style.cursor = 'pointer';
  if (!el.__clique) { el.__clique = true; el.addEventListener('click', (e) => { e.stopPropagation(); jogar?.(); }); }
  Hud.sitEm(el, rb.left + rb.width / 2, rb.top + rb.height / 2, 'meio');
  Hud.sitMostrar(el, true);
  if (!ligado) { ligado = true; document.body.classList.add('bola-safari'); }
  return true;
}
