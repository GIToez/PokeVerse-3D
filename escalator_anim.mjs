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
    const caminho = (Array.isArray(e.caminho) ? e.caminho : []).map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(base));   // the ride, in the world
    lista.push({ peca: chave(o.n), base, malhas, caminho, dx: +e.passo[0], dy: +e.passo[1], sinal: e.dir === 'down' ? -1 : 1, fase: Math.random(), aux: new THREE.Matrix4() });
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
  passeio = null;
}

/* ── RIDING (Nov 7) ───────────────────────────────────────────────────────────────────────────────────────────────────────
 * Each escalator carries its ride (extras.escada.caminho): the floor in front of its floor-level landing → that landing → the far
 * landing → just past it (into the wall opening, or under the floor). Leaving a floor = walking that path forwards; arriving on the
 * other floor = the other escalator's path backwards, so you come up (or down) it into the room.
 *   perto(x, z, raio)          → the escalator whose ride starts within `raio` of (x, z), or null
 *   iniciar(peca, sentido)     sentido 'sair' (forwards) | 'chegar' (backwards); → false if this map has no such escalator
 *   passo(dt) → null when not riding, else { x, y, z, giro, andando, fim, pk: { x, y, z, giro } } — the rider and the partner
 *   andando() → is someone riding now */
const VEL_CHAO = 2.2, VEL_ESCADA = 1.1;   // m/s on the floor / on the steps
let passeio = null;
export const andando = () => !!passeio;
export function perto(x, z, raio = 0.6) {
  let melhor = null, dm = raio;
  for (const E of lista) { const p = E.caminho[0]; if (!p) continue; const d = Math.hypot(p.x - x, p.z - z); if (d <= dm) { dm = d; melhor = E; } }
  return melhor;
}
export const pecas = () => lista.map(E => E.peca);
export const _depurar = () => lista.map(E => ({ peca: E.peca, caminho: E.caminho.map(p => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]) }));
/** Is (x, z) on the carpet of an escalator and heading into it (giro = the walker's facing)? → that escalator, or null. */
export function entrando(x, z, giro, raio = 0.95) {
  const E = perto(x, z, raio); if (!E || E.caminho.length < 2) return null;
  const a = E.caminho[0], b = E.caminho[1], rumo = Math.atan2(b.x - a.x, b.z - a.z);
  let d = Math.abs(giro - rumo) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d;
  return d < 1.05 ? E : null;                                              // within 60° of the escalator's way in
}
export function iniciar(peca, sentido = 'sair', de = null) {
  const E = lista.find(e => e.peca === chave(peca)); if (!E || E.caminho.length < 2) return false;
  const pts = sentido === 'chegar' ? [...E.caminho].reverse() : [...E.caminho];
  if (de && sentido === 'sair') pts.unshift(pts[0].clone().set(de.x, pts[0].y, de.z));   // walk from where you are onto the start
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = a.distanceTo(b), escada = Math.abs(b.y - a.y) > 0.2; seg.push({ a, b, L, t0: total, escada }); total += L / (escada ? VEL_ESCADA : VEL_CHAO); }
  passeio = { seg, total, t: 0, sentido, peca: E.peca };
  return true;
}
function ponto(t) {
  const P = passeio; let s = P.seg[P.seg.length - 1];
  for (const g of P.seg) if (t < g.t0 + g.L / (g.escada ? VEL_ESCADA : VEL_CHAO)) { s = g; break; }
  const k = Math.min(1, Math.max(0, (t - s.t0) / (s.L / (s.escada ? VEL_ESCADA : VEL_CHAO))));
  return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k, z: s.a.z + (s.b.z - s.a.z) * k, giro: Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z), escada: s.escada };
}
export function passo(dt) {
  if (!passeio) return null;
  const P = passeio; P.t = Math.min(P.total, P.t + dt);
  const eu = ponto(P.t), pk = ponto(Math.max(0, P.t - 0.75));          // the partner one step behind
  const fim = P.t >= P.total;
  const r = { ...eu, andando: !eu.escada, fim, sentido: P.sentido, peca: P.peca, pk };
  if (fim) passeio = null;
  return r;
}
export function parar() { passeio = null; }
