/* GHOST GAS (Nov 5): Gastly's purple gas cloud. In the original games the cloud is a shader/particle effect on the model, and
 * the exported GLB only has the ball, so the gas is rebuilt here.
 * Look (the user's references: the anime / Pokémon GO Gastly): a thick, billowy lavender cloud that rings the ball's silhouette,
 * bigger than the ball, plus a plume that rises off the top. The puffs are laid out in the CAMERA's plane and pushed behind the
 * ball, so the cloud frames the face from any angle without covering the eyes. They move on their own clock (onBeforeRender).
 *   Gas.aplicarGas(corpo, 'pm0092_00')   // after cloning the GLB, like Fogo.aplicarFogo / Lodo.aplicarLodo
 * The recipe is per model number, so Haunter / others can be added to RECEITAS. */
import * as THREE from 'three';

export const RECEITAS = {
  /* massa: puffs filling an ellipse behind the ball (in ball radii): w × h, centre lifted by `sobe`; coroa: big puffs billowing on
     top; tam: puff size range; cor (light, top) → cor2 (dark folds, inside / low). Tuned on the bench (tools/gas_bench). */
  pm0092: { massa: 64, coroa: 5, w: 1.4, h: 1.35, sobe: 0.45, tam: [0.42, 0.75], cor: 0xcfa6f0, cor2: 0x6a3aa8, op: 0.95, halo: 0xb48ae0 },   // Gastly
};

let textura = null;
function tex() {                                                          // a cartoon puff: solid middle, soft but short edge
  if (textura) return textura;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.7, 'rgba(255,255,255,1)'); r.addColorStop(0.86, 'rgba(255,255,255,.6)'); r.addColorStop(0.97, 'rgba(255,255,255,0)');   // firm, lumpy edge (cartoon gas)
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'source-atop';                             // a slightly darker lower half gives each puff some volume
  const s = g.createLinearGradient(0, 30, 0, 128); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(40,0,70,.28)');
  g.fillStyle = s; g.fillRect(0, 0, 128, 128);
  textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** The bone with the most skin weight on the biggest skinned mesh (Gastly: the ball's bone; Waist alone let the ball drop out of the
    cloud in the Run clip). */
function ossoDoCorpo(corpo) {
  let malha = null, n = 0;
  corpo.traverse(o => { if (o.isSkinnedMesh && o.geometry?.attributes?.skinWeight && o.geometry.attributes.position.count > n) { malha = o; n = o.geometry.attributes.position.count; } });
  if (!malha?.skeleton) return null;
  const idx = malha.geometry.attributes.skinIndex, pw = malha.geometry.attributes.skinWeight, soma = new Float64Array(malha.skeleton.bones.length);
  for (let i = 0; i < idx.count; i++) for (let k = 0; k < 4; k++) soma[idx.getComponent(i, k)] += pw.getComponent(i, k);
  let m = 0; for (let i = 1; i < soma.length; i++) if (soma[i] > soma[m]) m = i;
  return malha.skeleton.bones[m] || null;
}
const _c = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3();

/** Adds the gas to a cloned model; returns how many puffs were added (0 when the model has no recipe). */
export function aplicarGas(corpo, modelo = '') {
  let chave = (String(modelo).match(/pm\d{4}/) || [''])[0];
  if (!chave) corpo.traverse(o => {                                     /* wild Pokémon pass their name, not the file: read the pm number off the meshes/materials */
    if (chave || !o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const m = [o.name, ...ms.map(x => x?.name), ...ms.map(x => x?.map?.name)].join(' ').match(/pm\d{4}/);
    if (m) chave = m[0];
  });
  const R = RECEITAS[chave];
  if (!R || corpo.__gas) return 0;
  corpo.updateMatrixWorld(true);
  const cx = new THREE.Box3().setFromObject(corpo, true), tamanho = cx.getSize(new THREE.Vector3());
  /* body radius in the body's own units (montarCorpo scales the body afterwards; the radius is re-scaled every frame) */
  const raioLocal = (Math.max(tamanho.x, tamanho.y, tamanho.z) / 2 || 0.5) / (corpo.matrixWorld.getMaxScaleOnAxis() || 1);
  const osso = ossoDoCorpo(corpo) || corpo.getObjectByName(R.osso || 'Waist');   // the bone that carries most of the body: the cloud follows every animation
  const pai = osso || corpo;
  const grupo = new THREE.Group();
  grupo.name = 'gas-fantasma';
  /* the cloud's centre is the BALL's centre, kept in the bone's own space: the Waist bone sits off-centre, so a cloud on the bone's
     origin drifted to one side when Gastly faced left, right or away (it only lined up facing the camera) */
  const meio = cx.getCenter(new THREE.Vector3());
  if (osso) { osso.updateMatrixWorld(true); grupo.position.copy(osso.worldToLocal(meio.clone())); }
  else grupo.position.copy(meio.applyMatrix4(new THREE.Matrix4().copy(corpo.matrixWorld).invert()));
  const claro = new THREE.Color(R.cor), escuro = new THREE.Color(R.cor2), t0 = performance.now() / 1000;
  const lista = [];
  /* the mass: points in the ellipse, denser towards the rim so the outline is lumpy; inner and low ones are the dark folds */
  for (let i = 0; i < R.massa; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 0.45);
    const x = Math.cos(a) * rr * R.w, y = Math.sin(a) * rr * R.h + R.sobe;
    const tom = Math.min(1, (1 - rr) * 0.75 + (y < R.sobe ? 0.25 : 0) + Math.random() * 0.15);
    lista.push({ x, y, tam: R.tam[0] + Math.random() * (R.tam[1] - R.tam[0]), tom, coroa: false, atras: 0.6 + (1 - rr) * 0.5 });
  }
  /* the crown: a few big puffs on top that swell and fade in turn (smoke rising off the cloud, no chain of balls) */
  for (let i = 0; i < R.coroa; i++) lista.push({ x: (i / Math.max(1, R.coroa - 1) - 0.5) * R.w * 1.1, y: R.sobe + R.h * 0.85, tam: R.tam[1] * 1.15, tom: 0.05, coroa: true, atras: 0.9 });
  lista.sort((p, q) => q.atras - p.atras);                               // far ones drawn first
  lista.forEach((P, i) => {
    const mat = new THREE.SpriteMaterial({ map: tex(), color: claro.clone().lerp(escuro, P.tom), transparent: true, opacity: R.op, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 4 + i / 1000;
    const fase = Math.random() * Math.PI * 2, ciclo = 2.6 + Math.random() * 1.8, atraso = Math.random() * ciclo;
    s.onBeforeRender = (_renderer, _scene, camera) => {
      const t = performance.now() / 1000 - t0;
      grupo.getWorldPosition(_c);
      const R0 = raioLocal * (corpo.matrixWorld.getMaxScaleOnAxis() || 1);
      camera.getWorldDirection(_d);
      _r.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      _u.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      let ox = P.x + Math.sin(t * 0.7 + fase) * 0.06, oy = P.y + Math.cos(t * 0.6 + fase) * 0.06, e = P.tam * (0.93 + 0.09 * Math.sin(t * 1.3 + fase)), op = R.op;
      if (P.coroa) { const k = ((t + atraso) % ciclo) / ciclo; oy += k * 0.8; ox += Math.sin(fase) * k * 0.3; e *= 0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.1)); op = R.op * Math.min(1, k * 6, (1 - k) * 4); }   // swells, then shrinks away (a fade alone went grey over grass)
      _p.copy(_c).addScaledVector(_r, ox * R0).addScaledVector(_u, oy * R0).addScaledVector(_d, P.atras * R0);   // behind the ball, seen from the camera
      grupo.worldToLocal(_p);
      s.position.copy(_p);
      const kl = R0 / (grupo.matrixWorld.getMaxScaleOnAxis() || 1);
      s.scale.set(e * kl * 2, e * kl * 2, 1);                            // tam = puff radius in ball radii
      mat.opacity = op;
      s.updateMatrixWorld();
    };
    grupo.add(s);
  });
  if (R.halo != null) {                                                  /* soft lilac haze around the cloud (normal blending: additive turned green on grass) */
    const mh = new THREE.SpriteMaterial({ map: tex(), color: R.halo, transparent: true, opacity: 0.22, depthWrite: false });
    const h = new THREE.Sprite(mh); h.renderOrder = 3;
    h.onBeforeRender = (_r0, _s0, camera) => {
      const R0 = raioLocal * (corpo.matrixWorld.getMaxScaleOnAxis() || 1);
      grupo.getWorldPosition(_c); camera.getWorldDirection(_d); _u.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      _p.copy(_c).addScaledVector(_u, R.sobe * R0).addScaledVector(_d, R0 * 1.4); grupo.worldToLocal(_p); h.position.copy(_p);
      const e = R0 * R.w * 2.9 / (grupo.matrixWorld.getMaxScaleOnAxis() || 1); h.scale.set(e, e, 1); h.updateMatrixWorld();
    };
    grupo.add(h);
  }
  const total = lista.length;
  pai.add(grupo);
  corpo.__gas = grupo;
  return total;
}
