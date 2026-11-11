/* ROLLER SKATES ON THE BODY (Nov 10): the inline skates you see on a trainer's feet and the skating motion. Used for the player
   (index.html animarCorpos) and for other players (network.mjs, the `pt` flag in `pos`).

   The skates are plain meshes parented to the foot bones ("Bip001 L/R Foot"), so they follow every clip. They are built in the
   foot's own space: in the Biped rig the foot's local −X is "up" when the foot stands flat and the Toe0Nub child marks the tip of
   the shoe, so the size and place come from the bones themselves (every trainer model, any scale). The body is lifted by the
   skate height while they are on.

   The motion is procedural, there is no skating clip in the models: on top of the clip (Idle) the legs push out to the side and
   back in turn, the body leans forward and sways over the gliding leg, and leans into turns. Coasting (no input) keeps the
   forward lean with both feet together. */
import * as THREE from 'three';

const COR = { bota: 0xe03c48, trilho: 0x9aa0b4, roda: 0xffd23c, cubo: 0xf4f4f4, freio: 0x2a2a35 };
const mats = {};
const mat = nome => mats[nome] || (mats[nome] = new THREE.MeshStandardMaterial({ color: COR[nome], roughness: nome === 'trilho' ? 0.35 : 0.6, metalness: nome === 'trilho' ? 0.6 : 0.05 }));

/** One skate in its own space: x = side, y = up (0 = shoe sole), z = forward; `u` = ankle→toe tip distance. Returns the height
 *  from the sole to the bottom of the wheels. */
function montarPatim(u){
  const g = new THREE.Group(), L = 1.45 * u, r = 0.11 * u;
  const caixa = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(m)); o.position.set(x, y, z); g.add(o); return o; };
  caixa(0.38 * u, 0.06 * u, L, 'bota', 0, -0.03 * u, 0);                          // plate under the shoe
  caixa(0.045 * u, 0.12 * u, L * 0.92, 'trilho', 0.105 * u, -0.11 * u, 0);       // frame rails
  caixa(0.045 * u, 0.12 * u, L * 0.92, 'trilho', -0.105 * u, -0.11 * u, 0);
  const geoRoda = new THREE.CylinderGeometry(r, r, 0.13 * u, 16).rotateZ(Math.PI / 2);
  const geoCubo = new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.15 * u, 10).rotateZ(Math.PI / 2);
  const yRoda = -(0.06 * u + r) + 0.02 * u;
  for (let i = 0; i < 4; i++){
    const z = -L / 2 + r * 1.15 + i * (L - r * 2.3) / 3;
    const roda = new THREE.Mesh(geoRoda, mat('roda')); roda.position.set(0, yRoda, z); g.add(roda);
    const cubo = new THREE.Mesh(geoCubo, mat('cubo')); cubo.position.set(0, yRoda, z); g.add(cubo);
    g.userData.rodas = (g.userData.rodas || []).concat(roda, cubo);
  }
  caixa(0.16 * u, 0.12 * u, 0.12 * u, 'freio', 0, -0.15 * u, -L / 2 - 0.03 * u);   // heel brake
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = false; } });
  g.userData.raio = r;
  return { g, altura: -(yRoda - r) };
}

const achar = (raiz, re) => { let a = null; raiz.traverse(o => { if (!a && re.test(o.name || '')) a = o; }); return a; };

/* GLTFLoader renames the bones ("Bip001 L Foot" → "Bip001_L_Foot", PropertyBinding.sanitizeNodeName). `_` is a word character,
   so the side letter is matched after a space, a `_` or the start of the name — never with \b. */
const osso = (L, parte) => new RegExp('(^|[ _])' + L + '[ _]?' + parte + '$', 'i');

/** Puts the skates on `e` (once per body). Returns false when the model has no Biped feet (yet: the body may still be loading,
 *  so it tries again every couple of seconds). */
function vestir(e){
  if (e.__patins) return true;
  const agora = performance.now();
  if (e.__patinsTentou && agora - e.__patinsTentou < 2000) return false;
  e.__patinsTentou = agora;
  const achados = [];
  for (const L of ['L', 'R']){
    const pe = achar(e.pivo, osso(L, 'Foot'));
    const ponta = pe && (achar(pe, osso(L, 'Toe0Nub')) || achar(pe, osso(L, 'Toe0')));
    if (!pe || !ponta) return false;
    achados.push([L, pe, ponta]);
  }
  const lados = [];
  for (const [L, pe, ponta] of achados){
    /* the tip in foot space: walk up from the tip to the foot multiplying local matrices (bone locals of Toe0/Nub are fixed) */
    const m = new THREE.Matrix4();
    for (let o = ponta; o && o !== pe; o = o.parent){ o.updateMatrix(); m.premultiply(o.matrix); }
    const tip = new THREE.Vector3().setFromMatrixPosition(m);
    const cima = new THREE.Vector3(-1, 0, 0);                                     // Biped: the foot's −X is up when it stands flat
    const altura = tip.dot(cima);                                                 // < 0: the sole is below the ankle
    const frente = tip.clone().addScaledVector(cima, -altura);
    const u = frente.length(); if (u < 1e-4) return false;
    frente.normalize();
    const lado = new THREE.Vector3().crossVectors(cima, frente).normalize();
    const { g, altura: h } = montarPatim(u);
    const base = new THREE.Matrix4().makeBasis(lado, cima, frente);
    base.setPosition(cima.clone().multiplyScalar(altura).addScaledVector(frente, 0.36 * u));
    base.decompose(g.position, g.quaternion, g.scale);
    g.name = 'patins_' + L;
    g.visible = false;
    pe.add(g);
    lados.push({ g, pe, h });
  }
  /* skate height in world metres (foot scale relative to the body pivot) → how much the body goes up */
  e.pivo.updateMatrixWorld(true);
  const s = new THREE.Vector3(); lados[0].pe.getWorldScale(s);
  const sp = new THREE.Vector3(); e.pivo.getWorldScale(sp);
  const coxas = ['L', 'R'].map(L => achar(e.pivo, osso(L, 'Thigh')));
  e.__patins = { lados, ergue: lados[0].h * s.y / (sp.y || 1), coxas: coxas[0] && coxas[1] ? coxas : null, fase: 0, k: 0, inc: 0, rol: 0, ligado: false };
  return true;
}

/** Hides and forgets the skates of a body that is going away or changing model. */
export function tirar(e){
  const P = e?.__patins; if (!P) { if (e) delete e.__patins; return; }
  for (const { g } of P.lados) g.removeFromParent();
  delete e.__patins;
}

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _eixo = new THREE.Vector3(), _qr = new THREE.Quaternion();
/** Rotates `osso` by `ang` around a WORLD axis (on top of what the clip set this frame). */
function girarMundo(osso, eixo, ang){
  if (!ang) return;
  osso.parent.getWorldQuaternion(_qp);
  _eixo.copy(eixo).applyQuaternion(_q.copy(_qp).invert());                       // world axis → parent space
  osso.quaternion.premultiply(_qr.setFromAxisAngle(_eixo, ang));
}

/**
 * Every frame, AFTER the body's mixer update (the leg push goes on top of the clip's pose).
 *   ligado      skates on and on foot
 *   vel         ground speed (m/s), velMax the skating top speed
 *   empurrando  pushing (input held / heading to a click) — false = coasting
 *   curva       turn rate (rad/s, + = left) for the lean into turns
 * Returns how much to lift the body (add to pivo.position.y).
 */
export function animar(e, { ligado, vel = 0, velMax = 6, empurrando = false, curva = 0, dt = 0.016 }){
  if (!e?.pivo) return 0;
  if (!ligado && !e.__patins) return 0;
  if (ligado && !vestir(e)) return 0;
  const P = e.__patins; if (!P) return 0;
  if (P.ligado !== ligado){ P.ligado = ligado; for (const { g } of P.lados) g.visible = ligado; }
  const k = Math.min(1, Math.max(0, vel / (velMax || 6)));
  const suave = (a, b, t) => a + (b - a) * (1 - Math.exp(-dt / t));
  P.k = suave(P.k, ligado ? k : 0, 0.15);
  const passada = ligado && empurrando && k > 0.05;
  if (passada) P.fase += dt * Math.PI * 2 * (0.75 + 0.55 * k);                  // ~1–1.3 pushes per second per leg
  P.empurra = suave(P.empurra || 0, passada ? 1 : 0, 0.18);
  const s = Math.sin(P.fase);
  /* body: forward lean grows with speed, sway over the gliding leg, lean into turns */
  P.inc = suave(P.inc, ligado ? 0.06 + 0.16 * P.k : 0, 0.2);
  P.rol = suave(P.rol, ligado ? s * 0.07 * P.empurra * P.k + THREE.MathUtils.clamp(-curva * 0.07, -0.3, 0.3) * P.k : 0, 0.12);
  e.pivo.rotation.order = 'YXZ';
  e.pivo.rotation.x = P.inc;
  e.pivo.rotation.z = P.rol;
  /* legs: the pushing leg goes out to the side and back, the other one carries the weight. The push goes on top of the clip's
     pose; when the mixer did not touch a thigh since last frame (it skipped this frame, or the clip has no thigh track), the
     thigh still holds last frame's push — it goes back to the clip's pose first, so the push never piles up. */
  if (P.coxas){
    P.base ||= P.coxas.map(c => c.quaternion.clone()); P.ult ||= P.coxas.map(() => null);
    P.coxas.forEach((c, i) => { if (P.ult[i] && c.quaternion.equals(P.ult[i])) c.quaternion.copy(P.base[i]); else P.base[i].copy(c.quaternion); P.ult[i] = null; });
  }
  if (P.coxas && ligado && P.empurra > 0.01){
    e.pivo.updateMatrixWorld(true);
    const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(e.pivo.getWorldQuaternion(_q)), lado = new THREE.Vector3(1, 0, 0).applyQuaternion(_q);
    const [cL, cR] = P.coxas, a = P.empurra * (0.25 + 0.2 * P.k);
    const pL = Math.max(0, s), pR = Math.max(0, -s);                              // left pushes on the positive half, right on the negative
    girarMundo(cL, frente, a * pL);                                               // out (+x is the left side of the model)
    girarMundo(cL, lado, a * 0.8 * pL);                                           // and back
    girarMundo(cR, frente, -a * pR);
    girarMundo(cR, lado, a * 0.8 * pR);
    P.ult = P.coxas.map(c => c.quaternion.clone());
  }
  /* wheels spin with the speed */
  if (ligado && vel > 0.05) for (const { g } of P.lados){ const r = g.userData.raio || 0.03; for (const w of g.userData.rodas || []) w.rotation.x += vel * dt / Math.max(0.01, r * (P.ergue / (P.lados[0].h || 1))); }
  return P.ergue * (ligado ? 1 : 0);
}
