/* Species admin: one shared 3D stage for the models of the open dex (drag to rotate). */
import { criarPalco } from '/character.mjs';

let raiz = null, P = null, ids = [];

function montarRaiz() {
  raiz = document.createElement('div');
  raiz.className = 'previa-skin previa-especies';
  raiz.innerHTML = '<div class="grade-previa"></div><div class="previa-info"></div>';
  P = criarPalco(raiz, () => ({}));
  raiz.appendChild(P.canvas);
}

export function mostrar(caixa, glbs, { nome } = {}) {
  if (!raiz) montarRaiz();
  ids = (glbs || []).map(g => String(g).replace(/\.glb$/, '')).filter(Boolean);
  const grade = raiz.querySelector('.grade-previa');
  grade.innerHTML = ids.length
    ? ids.map(id => `<div class="palco" data-id="${id}" title="${id}"></div>`).join('')
    : '<div class="fraco">No .glb on disk for this number yet.</div>';
  raiz.querySelector('.previa-info').textContent = ids.length
    ? (nome ? nome + ' · ' : '') + ids.length + ' model(s) · drag to rotate'
    : 'Put pmXXXX_00.glb in public/scenery/mon/ and reload this page.';
  caixa.prepend(raiz);
  for (const id of [...P.itens.keys()]) if (!ids.includes(id)) P.descartar(id);
  for (const id of ids) {
    P.montar({ id, glb: '../../../scenery/mon/' + id, nome: id }).then(it => {
      if (!it?.pronto) return;
      const el = grade.querySelector(`.palco[data-id="${id}"]`);
      if (el){ el.classList.add('pronto'); P.arrastavel(el, id); }
    }).catch(() => {
      const el = grade.querySelector(`.palco[data-id="${id}"]`);
      if (el) el.classList.add('falhou');
    });
  }
  if (ids[0]) P.selecionar(ids[0]);
}
