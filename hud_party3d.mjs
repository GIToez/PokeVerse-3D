/* Tiny 3D party portraits on #time-hud. One shared stage (same trick as character creation).
   Flat png stays underneath until the GLB is ready, then hides. */
import { criarPalco } from './character.mjs';

let P = null, caixa = null;

function stemDe(glb){ return String(glb || '').replace(/\.glb$/i, ''); }

export function ligar(el){
  if (!el) return;
  caixa = el;
  if (!P) P = criarPalco(el, () => ({}));
  else P.usar(el);
  const vivos = new Set();
  for (const slot of el.querySelectorAll('.tpalco[data-id]')){
    const id = stemDe(slot.dataset.id); if (!id) continue;
    vivos.add(id);
    slot.classList.add('palco');
    slot.dataset.id = id;
    P.montar({ id, glb: '../mon/' + id, nome: id }).then(it => {
      if (!it?.pronto || !slot.isConnected) return;
      slot.classList.add('pronto');
      slot.closest('.tslot')?.classList.add('t3d');
    }).catch(() => { slot.closest('.tslot')?.classList.add('t3d-off'); });
  }
  for (const id of [...(P.itens?.keys?.() || [])]) if (!vivos.has(id)) P.descartar(id);
}
