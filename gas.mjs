/* GHOST GAS (Nov 5): Gastly's purple gas cloud. In the original games the cloud is a shader/particle effect on the model, and
 * the exported GLB only has the ball, so the gas is rebuilt here.
 * Look (the user's references: the anime / Pokémon GO Gastly): a thick, billowy lavender cloud that rings the ball's silhouette,
 * bigger than the ball, plus a plume that rises off the top. The puffs are laid out in the CAMERA's plane and pushed behind the
 * ball, so the cloud frames the face from any angle without covering the eyes. They move on their own clock (onBeforeRender).
 *   Gas.aplicarGas(corpo, 'pm0092_00')   // after cloning the GLB, like Fogo.aplicarFogo / Lodo.aplicarLodo
 * The recipe is per model number, so Haunter / others can be added to RECEITAS. */
import * as THREE from 'three';

const RECEITAS = {
  pm0092: { anel: 34, fios: 12, cor: 0xb58ae0, cor2: 0x7d4fc0, op: 0.88, raio: [0.78, 1.45], tam: [0.75, 1.15], pluma: 2.4 },   // Gastly
};

let textura = null;
function tex() {                                                          // a cartoon puff: solid middle, soft but short edge
  if (textura) return textura;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,.95)'); r.addColorStop(0.8, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'source-atop';                             // a slightly darker lower half gives each puff some volume
  const s = g.createLinearGradient(0, 30, 0, 128); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(40,0,70,.28)');
  g.fillStyle = s; g.fillRect(0, 0, 128, 128);
  textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
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
  const cx = new THREE.Box3().setFromObject(corpo), tamanho = cx.getSize(new THREE.Vector3());
  /* body radius in the body's own units (montarCorpo scales the body afterwards; the radius is re-scaled every frame) */
  const raioLocal = (Math.max(tamanho.x, tamanho.y, tamanho.z) / 2 || 0.5) / (corpo.matrixWorld.getMaxScaleOnAxis() || 1);
  const osso = corpo.getObjectByName(R.osso || 'Waist');                 // the floating ball's bone: the cloud follows every animation
  const pai = osso || corpo;
  const grupo = new THREE.Group();
  grupo.name = 'gas-fantasma';
  if (!osso) grupo.position.copy(cx.getCenter(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(corpo.matrixWorld).invert()));
  const base = new THREE.Color(R.cor), fundo = new THREE.Color(R.cor2);
  const total = R.anel + R.fios, t0 = performance.now() / 1000;
  for (let i = 0; i < total; i++) {
    const fio = i >= R.anel;
    const mat = new THREE.SpriteMaterial({ map: tex(), color: base.clone().lerp(fundo, Math.random() * (fio ? 0.35 : 0.7)), transparent: true, opacity: R.op, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 4;
    /* ring puffs: evenly round the silhouette, radius and size jittered; plume puffs start at the top */
    const ang = fio ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : (i / R.anel) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const dist = R.raio[0] + Math.random() * (R.raio[1] - R.raio[0]);
    const tam = R.tam[0] + Math.random() * (R.tam[1] - R.tam[0]);
    const fase = Math.random() * Math.PI * 2, ciclo = 1.8 + Math.random() * 1.6, atraso = Math.random() * ciclo;
    s.onBeforeRender = (_renderer, _scene, camera) => {
      const t = performance.now() / 1000 - t0;
      grupo.getWorldPosition(_c);
      const R0 = raioLocal * (corpo.matrixWorld.getMaxScaleOnAxis() || 1);   // body radius in world units now
      camera.getWorldDirection(_d);
      _r.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      _u.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      let ox, oy, atras, e, op;
      if (fio) {                                                          // plume: leaves the top of the cloud, rises, swells and fades
        const k = ((t + atraso) % ciclo) / ciclo;
        ox = Math.cos(-Math.PI / 2 - ang) * R0 * 0.6 + Math.sin(t * 0.8 + fase) * R0 * 0.25;
        oy = R0 * (0.7 + k * R.pluma);
        atras = R0 * 0.9; e = R0 * tam * (0.55 + 0.75 * k); op = R.op * Math.sin(Math.PI * Math.min(1, k * 1.15));
      } else {                                                            // ring: breathes in and out, drifts slowly round
        const a = ang + Math.sin(t * 0.45 + fase) * 0.12 + t * 0.06;
        const rr = R0 * dist * (0.94 + 0.1 * Math.sin(t * 1.3 + fase));
        ox = Math.cos(a) * rr; oy = Math.sin(a) * rr * 0.95 + R0 * 0.08;
        atras = R0 * 0.75; e = R0 * tam * (0.9 + 0.14 * Math.sin(t * 1.7 + fase * 2)); op = R.op * (0.8 + 0.2 * Math.sin(t * 1.1 + fase));
      }
      _p.copy(_c).addScaledVector(_r, ox).addScaledVector(_u, oy).addScaledVector(_d, atras);   // behind the ball, seen from the camera
      grupo.worldToLocal(_p);
      s.position.copy(_p);
      const kLocal = 1 / (grupo.matrixWorld.getMaxScaleOnAxis() || 1);
      s.scale.set(e * kLocal, e * kLocal, 1);
      mat.opacity = op;
      s.updateMatrixWorld();                                              // this frame's matrix (onBeforeRender runs after the scene's update)
    };
    grupo.add(s);
  }
  pai.add(grupo);
  corpo.__gas = grupo;
  return total;
}
