/* GHOST GAS (Nov 5, v3): Gastly's purple gas. The exported GLB only has the ball, so the gas is rebuilt here as smoke particles
 * in a 3D shell round the ball (see RECEITAS), attached to the bone that carries the ball: it looks the same from every side and
 * follows every animation. Tuned on tools/gas_bench (front / back / both sides, Idle and Run).
 *   Gas.aplicarGas(corpo, 'pm0092_00')   // after cloning the GLB, like Fogo.aplicarFogo / Lodo.aplicarLodo
 * The recipe is per model number, so Haunter / others can be added to RECEITAS. */
import * as THREE from 'three';

export const RECEITAS = {
  /* SMOKE (Nov 5, v3): living smoke particles in a 3D SHELL round the ball, attached to the bone that carries the ball. Each puff
     is born on the shell, drifts out and UP (world up: smoke rises whatever the pose), swells and fades, then is born again.
     Puffs facing the camera fade to `opFrente`, so the face shows through a thin veil from any side; the rim stays thick.
       anel: puffs that hug the ball (the silhouette ring, little drift) · fumaca: puffs that rise and fade (wisps off the top)
       raio: shell radius in ball radii · tam: puff radius in ball radii · sobe: rise over a life (ball radii) · vida: life in s
       cor (light, top/outside) → cor2 (dark, low/inside) · op: puff opacity · halo: soft glow behind (null = none) */
  pm0092: { anel: 64, fumaca: 54, raio: [1.07, 1.5], tam: [0.62, 1.03], sobe: 1.3, vida: [2.4, 3.8], cor: 0xc9a2ee, cor2: 0x5a2a90, op: 0.8, opFrente: 0.14, halo: 0x9c74d2 },   // Gastly
};

/* Smoke texture: a soft round puff whose edge is eaten by noise (wispy, not a balloon). A few variants so puffs differ. */
const texturas = [];
function tex(i = 0) {
  if (texturas.length) return texturas[i % texturas.length];
  for (let v = 0; v < 4; v++) {
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    let semente = 1234 + v * 977; const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
    const grades = [4, 8, 16].map(n => { const a = []; for (let k = 0; k < (n + 1) * (n + 1); k++) a.push(rnd()); return { n, a }; });
    const ruido = (x, y) => {                                   // value-noise fbm, 0..1
      let t = 0, w = 0, amp = 1;
      for (const { n, a } of grades) {
        const fx = x * n, fy = y * n, ix = Math.min(n - 1, Math.floor(fx)), iy = Math.min(n - 1, Math.floor(fy)), tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), at = (i, j) => a[j * (n + 1) + i];
        t += amp * ((at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy); w += amp; amp *= 0.5;
      }
      return t / w;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1, r = Math.hypot(dx, dy);
      const radial = Math.max(0, 1 - r); const base = radial * radial * (3 - 2 * radial);
      const a = Math.max(0, Math.min(1, base * 1.6 - (1 - ruido(x / N, y / N)) * 0.75));
      const sombra = 1 - 0.22 * Math.max(0, dy);                // a little darker underneath: volume
      const o = (y * N + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255 * sombra; img.data[o + 3] = 255 * a;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texturas.push(t);
  }
  return texturas[i % texturas.length];
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
  const dirAleatoria = () => { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u); return new THREE.Vector3(q * Math.cos(a), u, q * Math.sin(a)); };
  for (let i = 0; i < R.anel; i++) lista.push({ dir: dirAleatoria(), rr: R.raio[0] + Math.random() * (R.raio[1] - R.raio[0]) * 0.6, tam: R.tam[0] + Math.random() * (R.tam[1] - R.tam[0]), vida: 0, tom: Math.random() });
  for (let i = 0; i < R.fumaca; i++) { const d = dirAleatoria(); d.y = Math.abs(d.y) * 0.8 + 0.1; d.normalize();   // wisps start on the upper half
    lista.push({ dir: d, rr: R.raio[0] + Math.random() * (R.raio[1] - R.raio[0]), tam: R.tam[0] * 0.8 + Math.random() * (R.tam[1] - R.tam[0]), vida: R.vida[0] + Math.random() * (R.vida[1] - R.vida[0]), tom: Math.random() * 0.6 }); }
  const _w = new THREE.Vector3(), _cam = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
  lista.forEach((P, i) => {
    const mat = new THREE.SpriteMaterial({ map: tex(i), color: claro.clone().lerp(escuro, P.tom * 0.7), transparent: true, opacity: 0, depthWrite: false, rotation: Math.random() * Math.PI * 2 });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 4;                                                   // same order: three sorts the puffs back to front
    const fase = Math.random() * Math.PI * 2, atraso = Math.random() * (P.vida || 1), giro = (Math.random() - 0.5) * 0.6;
    s.onBeforeRender = (_renderer, _scene, camera) => {
      const t = performance.now() / 1000 - t0;
      grupo.getWorldPosition(_c);
      const R0 = raioLocal * (corpo.matrixWorld.getMaxScaleOnAxis() || 1);
      grupo.getWorldQuaternion(_q);
      _w.copy(P.dir).applyQuaternion(_q);                               // the puff's direction turns with the ball (bone)
      camera.getWorldPosition(_cam).sub(_c).normalize();
      let rr = P.rr, sobe = 0, e = P.tam, op = R.op;
      if (P.vida) {                                                     // wisp: born on the shell, rises and swells, fades
        const k = ((t + atraso) % P.vida) / P.vida;
        rr += k * 0.35; sobe = k * R.sobe; e *= 0.55 + 0.75 * k; op *= Math.min(1, k * 5) * (1 - k) * 1.25;
      } else {                                                          // ring: breathes in place
        rr += Math.sin(t * 0.8 + fase) * 0.05; e *= 0.92 + 0.12 * Math.sin(t * 1.1 + fase);
      }
      _p.copy(_w).multiplyScalar(rr * R0).add(_c).addScaledVector(_up, sobe * R0);
      /* facing the camera → thin veil over the face; at the rim → full; behind → full (the ball hides most of it) */
      _d.copy(_p).sub(_c).normalize();
      const frente = _d.dot(_cam);
      op *= frente > 0.25 ? Math.max(R.opFrente, 1 - (frente - 0.25) * 1.6) : 1;
      grupo.worldToLocal(_p);
      s.position.copy(_p);
      const kl = R0 / (grupo.matrixWorld.getMaxScaleOnAxis() || 1);
      s.scale.set(e * kl * 2, e * kl * 2, 1);
      mat.rotation += giro * 0.016;
      mat.opacity = op;
      s.updateMatrixWorld();
    };
    grupo.add(s);
  });
  if (R.halo != null) {                                                  /* soft lilac haze behind the cloud (normal blending: additive turned green on grass) */
    const mh = new THREE.SpriteMaterial({ map: tex(0), color: R.halo, transparent: true, opacity: 0.2, depthWrite: false });
    const h = new THREE.Sprite(mh); h.renderOrder = 3;
    h.onBeforeRender = (_r0, _s0, camera) => {
      const R0 = raioLocal * (corpo.matrixWorld.getMaxScaleOnAxis() || 1);
      grupo.getWorldPosition(_c); camera.getWorldDirection(_d);
      _p.copy(_c).addScaledVector(_up, 0.35 * R0).addScaledVector(_d, R0 * 1.5); grupo.worldToLocal(_p); h.position.copy(_p);
      const e = R0 * 4.4 / (grupo.matrixWorld.getMaxScaleOnAxis() || 1); h.scale.set(e, e, 1); h.updateMatrixWorld();
    };
    grupo.add(h);
  }
  const total = lista.length;
  pai.add(grupo);
  corpo.__gas = grupo;
  return total;
}
