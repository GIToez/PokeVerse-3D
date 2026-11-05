/* GHOST GAS (Nov 5): Gastly's purple gas cloud. In the original games the cloud is a shader/particle effect on the model, and
 * the exported GLB only has the ball, so the gas is rebuilt here: a ring of soft purple billboard puffs around the body that
 * drift, swell and fade on their own clock (onBeforeRender — no hook in the game loop needed).
 *   Gas.aplicarGas(corpo, 'pm0092_00')   // after cloning the GLB, like Fogo.aplicarFogo / Lodo.aplicarLodo
 * The recipe is per model number, so Haunter / others can be added to RECEITAS. */
import * as THREE from 'three';

const RECEITAS = {
  pm0092: { puffs: 18, raio: 1.05, tam: 1.6, cor: 0x9a5ae6, cor2: 0x5a2a9e, op: 0.55 },   // Gastly
};

let textura = null;
function tex() {
  if (textura) return textura;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

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
  const cx = new THREE.Box3().setFromObject(corpo), meio = cx.getCenter(new THREE.Vector3()), tamanho = cx.getSize(new THREE.Vector3());
  const raioCorpo = Math.max(tamanho.x, tamanho.y, tamanho.z) / 2 || 0.5;
  /* The puffs hang on the body bone (Waist) so they follow the floating ball in every animation; without that bone they sit on
     the body's centre. Sizes are converted into the parent's local units. */
  const osso = corpo.getObjectByName(R.osso || 'Waist');
  const pai = osso || corpo;
  const escLocal = 1 / (pai.matrixWorld.getMaxScaleOnAxis() || 1);
  const grupo = new THREE.Group();
  grupo.name = 'gas-fantasma';
  if (!osso) grupo.position.copy(meio.clone().applyMatrix4(new THREE.Matrix4().copy(corpo.matrixWorld).invert()));
  const base = new THREE.Color(R.cor), fundo = new THREE.Color(R.cor2);
  for (let i = 0; i < R.puffs; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex(), color: base.clone().lerp(fundo, Math.random() * 0.6), transparent: true, opacity: R.op, depthWrite: false, blending: THREE.NormalBlending });
    const s = new THREE.Sprite(mat);
    const fase = Math.random() * Math.PI * 2, vel = 0.25 + Math.random() * 0.35, alt = (Math.random() - 0.5) * 0.8, dist = R.raio * (0.75 + Math.random() * 0.45);
    const t0 = performance.now() / 1000;
    s.renderOrder = 6;
    s.onBeforeRender = () => {
      const t = performance.now() / 1000 - t0, a = fase + t * vel;
      const r = raioCorpo * escLocal * dist;
      s.position.set(Math.cos(a) * r, (alt + Math.sin(t * 0.9 + fase) * 0.18) * raioCorpo * escLocal, Math.sin(a) * r);
      const k = raioCorpo * escLocal * R.tam * (0.85 + 0.25 * Math.sin(t * 1.7 + fase * 2));
      s.scale.set(k, k, 1);
      mat.opacity = R.op * (0.65 + 0.35 * Math.sin(t * 1.3 + fase));
    };
    grupo.add(s);
  }
  pai.add(grupo);
  corpo.__gas = grupo;
  return R.puffs;
}
