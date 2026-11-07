/* ANIMATED ESCALATORS (Nov 7). The map places `animated_escalator_up` / `animated_escalator_down` like any prefab (copies of the
 * Pokémon Center's escalators made by tools/make_animated_escalators.mjs). The map loader draws their body (sides, handrails and
 * the two landings) and skips the `anim_steps` mesh; this module lines copies of that one step up along the slope and slides them,
 * up or down, clipped to the band between the landings so the steps come out of one landing and go into the other.
 *
 *   Escadas.montar({ THREE, mapa, objetos, flipX, cena, renderer })   after the map is built (mapa = the GLB's "Mapa" node)
 *   Escadas.atualizar(dt)                                             every frame
 * The numbers come from the lib node's extras.escada: { dir: 'up'|'down', passo: [dx, dy] one step up the slope, n, x0, x1 }. */
const VELOCIDADE = 0.55;   // steps per second (~0.33 m/s along the slope)
let lista = [];

const chave = n => String(n || '').toLowerCase().replace(/^lib:?/, '').replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
export const ehEscada = n => /^animated_escalator_(up|down|down_upper)$/.test(chave(n));

export function montar({ THREE, mapa, objetos, flipX = -1, cena, renderer }) {
  desmontar();
  if (!mapa || !Array.isArray(objetos)) return 0;
  const libs = new Map();
  for (const p of mapa.children) {
    const k = chave(p.name); if (!ehEscada(k)) continue;
    const e = p.userData?.escada; let passo = null;
    p.updateMatrixWorld(true);
    p.traverse(o => { if (o.isMesh && /^anim_/.test(o.name)) passo = o; });
    if (e && passo) libs.set(k, { e, passo });
  }
  if (!libs.size) return 0;
  if (renderer) renderer.localClippingEnabled = true;
  const D = THREE.MathUtils.degToRad, R = new THREE.Matrix4(), T = new THREE.Matrix4(), Er = new THREE.Euler();
  for (const o of objetos) {
    const L = libs.get(chave(o.n)); if (!L) continue;
    const { e, passo: m } = L;
    /* placement × the step mesh's own matrix in the GLB, the same as instanciarBiblioteca (translation mirrored, free rotation in world) */
    R.makeRotationFromEuler(Er.set(D(+o.rx || 0), D(+o.r || 0), D(+o.rz || 0)));
    T.makeTranslation(flipX * (+o.x || 0), +o.y || 0, +o.z || 0);
    const base = new THREE.Matrix4().multiplyMatrices(T, R).multiply(m.matrixWorld);
    const x0 = Math.min(e.x0, e.x1), x1 = Math.max(e.x0, e.x1);
    const planos = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), x1)].map(p => p.applyMatrix4(base));
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material).clone();
    mat.clippingPlanes = planos; mat.side = THREE.DoubleSide;
    const n = (e.n | 0) + 3, malhas = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(m.geometry, mat);
      s.matrixAutoUpdate = false; s.castShadow = false; s.receiveShadow = true; s.frustumCulled = false;
      cena.add(s); malhas.push(s);
    }
    lista.push({ base, malhas, dx: +e.passo[0], dy: +e.passo[1], sinal: e.dir === 'down' ? -1 : 1, fase: Math.random(), aux: new THREE.Matrix4() });
  }
  atualizar(0);
  return lista.length;
}
export function atualizar(dt) {
  for (const E of lista) {
    E.fase = (E.fase + dt * VELOCIDADE) % 1;
    const f = E.sinal * E.fase;
    E.malhas.forEach((s, i) => {
      const k = i - 1 + f;                                                  // copies from one step below the band to one above it
      s.matrix.multiplyMatrices(E.base, E.aux.makeTranslation(k * E.dx, k * E.dy, 0));
      s.matrixWorldNeedsUpdate = true;
    });
  }
}
export function desmontar() {
  for (const E of lista) for (const s of E.malhas) s.parent?.remove(s);
  lista = [];
}
