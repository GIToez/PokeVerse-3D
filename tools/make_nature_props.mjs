#!/usr/bin/env node
/* NATURE PROPS (Nov 10): original procedural models for the countryside towns — a country research lab, a classic windmill,
 * a family of trees and natural lakes. Stylised low-poly with smooth shading and baked vertex colours (gradients + fake AO), no
 * textures except the lake's grass rim, which reuses the library grass so it melts into the floor tiles.
 *
 *   cc_laboratorio_campo      two-storey research house: stone plinth, timber band, slate roof, porch, observatory, greenhouse wing
 *   cc_moinho / cc_moinho_x   tower windmill (sails in + or ×)
 *   cc_arvore_carvalho_1..3   broadleaf          cc_arvore_pinheiro_1..2  pine       cc_arvore_choupo   poplar
 *   cc_arvore_betula          birch              cc_arvore_macieira       apple      cc_arvore_cerejeira  blossom
 *   cc_arvore_palmeira        palm               cc_arbusto_1, cc_arbusto_flor        bushes
 *   cc_lago_natural_1..3      lake body: bed, water (game water shader), shore and grass rim. Place with { pi: 1, col: 'nada' } and
 *                             remove the floor tiles inside the rim (outline in extras.lago); cc_lago_natural_N_detalhe = reeds,
 *                             lily pads and stones for the same spot (separate so the pads are not walkable).
 *
 * Material names follow the game's rules: 'leaf…'/'tree…'/'grass…' are plants (no ×1.8 prop light), 'water' gets the water shader.
 * Props (lab, windmill) carry baseColorFactor 1/1.8 so that, after the game's LUZ_PROPS, they show the colours written here.
 * Front of buildings = local +Z, origin = centre of the footprint on the ground.
 *
 * Output: scenery/extra/nature_props.glb (+ nature_props.json with the lake outlines). Run from the repo root:
 *     node tools/make_nature_props.mjs && node tools/build_prefab_library.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scenery/extra/nature_props.glb');
const PROP = 1 / 1.8;                                   // undo the game's LUZ_PROPS on buildings

/* ── small math ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
let semente = 1;
const rnd = () => { semente |= 0; semente = semente + 0x6D2B79F5 | 0; let t = Math.imul(semente ^ semente >>> 15, 1 | semente); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const entre = (a, b) => a + rnd() * (b - a);
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function ruido(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), f = t => t * t * (3 - 2 * t), u = f(x - i), v = f(y - j), w = f(z - k);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(i, j, k), hash3(i + 1, j, k), u), L(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), u), v),
           L(L(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), u), L(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), u), v), w) * 2 - 1;
}
const C = hex => { const c = new THREE.Color(); c.setHex(hex, THREE.SRGBColorSpace); return c; };
const mix = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

/* ── prefab assembly ────────────────────────────────────────────────────────────────────────────────────────────────── */
const MATS = {};                                         // key -> glTF material definition
function material(key, def) { MATS[key] = def; return key; }
class Peca {
  constructor(nome) { this.nome = nome; this.porMat = new Map(); this.extras = null; }
  /** geo: three geometry in its own frame; m: matrix into the prefab; cor: (p, n) => Color | [Color, alpha] (prefab space) */
  add(mat, geo, { m = null, liso = false, cor = C(0xffffff), desloc = null, uv = null } = {}) {
    let g = geo.clone();
    for (const a of Object.keys(g.attributes)) if (a !== 'position') g.deleteAttribute(a);
    if (liso) g = mergeVertices(g, 1e-4); else if (g.index) g = g.toNonIndexed();
    if (desloc) { const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); desloc(v); p.setXYZ(i, v.x, v.y, v.z); } }
    if (m) g.applyMatrix4(m);
    g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal, cols = new Float32Array(p.count * 4), P = new THREE.Vector3(), N = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      P.fromBufferAttribute(p, i); N.fromBufferAttribute(n, i);
      let c = typeof cor === 'function' ? cor(P, N) : cor, a = 1;
      if (Array.isArray(c)) { a = c[1]; c = c[0]; }
      cols.set([c.r, c.g, c.b, a], i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 4));
    if (uv) { const t = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { P.fromBufferAttribute(p, i); const [u, v] = uv(P); t[i * 2] = u; t[i * 2 + 1] = v; } g.setAttribute('uv', new THREE.BufferAttribute(t, 2)); }
    if (!this.porMat.has(mat)) this.porMat.set(mat, []);
    this.porMat.get(mat).push(g);
    return this;
  }
}
const PECAS = [];
const nova = nome => { const p = new Peca(nome); PECAS.push(p); return p; };

/* shading helpers: simple sky light + ground occlusion baked into the colour */
const sombra = (c, n, k = 0.18) => c.clone().multiplyScalar(1 - k + k * (0.5 + 0.5 * n.y));
const aoAltura = (c, y, h0 = 0, h1 = 1.2, k = 0.3) => c.clone().multiplyScalar(1 - k * (1 - Math.min(1, Math.max(0, (y - h0) / (h1 - h0)))));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/* ═════════════════════════════════════════════════════════════════════════ MATERIALS */
const mProp = (key, rough = 0.85, extra = {}) => material(key, { name: key, pbrMetallicRoughness: { baseColorFactor: [PROP, PROP, PROP, 1], metallicFactor: 0, roughnessFactor: rough }, ...extra });
mProp('lab_parede'); mProp('lab_madeira'); mProp('lab_pedra', 0.95); mProp('lab_telhado', 0.7); mProp('lab_vidro', 0.15); mProp('lab_metal', 0.35);
material('leaf_copa', { name: 'leaf_copa', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true });
material('tree_casca', { name: 'tree_casca', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.95 } });
material('leaf_fruta', { name: 'leaf_fruta', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.5 } });
material('water_lago', { name: 'water_lago', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.1 } });
material('grass_lago_fundo', { name: 'grass_lago_fundo', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } });
material('grass_lago_margem', { name: 'grass_lago_margem', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } });
material('grass_lago_borda', { name: 'grass_lago_borda', pbrMetallicRoughness: { baseColorFactor: [0.5394796, 1, 0.50888145, 1], baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 }, alphaMode: 'BLEND' });
material('leaf_junco', { name: 'leaf_junco', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true });
material('rock_pedra', { name: 'rock_pedra', pbrMetallicRoughness: { baseColorFactor: [PROP, PROP, PROP, 1], metallicFactor: 0, roughnessFactor: 0.95 } });

/* ═════════════════════════════════════════════════════════════════════════ COUNTRY RESEARCH LAB */
function janela(pc, x, y, z, face, w = 1.1, h = 1.3) {
  // face: 'z+' 'z-' 'x+' 'x-' — a framed window flush with the wall at (x,y,z)
  const ry = { 'z+': 0, 'z-': Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 }[face];
  const branco = C(0xf7f4ec), vidro = (p, n) => mix(C(0x8fc3dc), C(0xd8f0fa), (p.y - y + h / 2) / h);
  const at = (dx, dy, dz) => { const v = new THREE.Vector3(dx, dy, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); return [x + v.x, y + v.y, z + v.z]; };
  pc.add('lab_vidro', box(w, h, 0.06), { m: M(...at(0, 0, 0.02), 0, ry), cor: vidro });
  for (const [dx, dy, ww, hh] of [[0, h / 2 + 0.05, w + 0.2, 0.1], [0, -h / 2 - 0.06, w + 0.3, 0.12], [-w / 2 - 0.05, 0, 0.1, h + 0.2], [w / 2 + 0.05, 0, 0.1, h + 0.2], [0, 0, 0.06, h], [0, h * 0.1, w, 0.06]])
    pc.add('lab_madeira', box(ww, hh, 0.12), { m: M(...at(dx, dy, 0.06), 0, ry), cor: branco });
  pc.add('lab_madeira', box(w + 0.35, 0.08, 0.3), { m: M(...at(0, -h / 2 - 0.14, 0.13), 0, ry), cor: C(0xd9d2c3) });   // sill
}
function telhadoDuasAguas(pc, mat, cx, y0, cz, comp, larg, alt, eixo, cor, beiral = 0.45) {
  // gable roof: ridge along `eixo` ('x' or 'z'), covering comp × larg, ridge `alt` above y0
  const meia = larg / 2 + beiral, tg = alt / (larg / 2), ang = Math.atan(tg), L = Math.hypot(meia, tg * meia);
  const yc = y0 + alt - tg * meia / 2 + 0.11;                            // slab centre: half-way down the slope (+ half its thickness)
  for (const s of [-1, 1]) {
    if (eixo === 'x') pc.add(mat, box(comp + beiral * 2, 0.22, L), { m: M(cx, yc, cz + s * meia / 2, s * ang), cor: (p, n) => sombra(cor, n, 0.25) });
    else pc.add(mat, box(L, 0.22, comp + beiral * 2), { m: M(cx + s * meia / 2, yc, cz, 0, 0, -s * ang), cor: (p, n) => sombra(cor, n, 0.25) });
  }
  const cume = new THREE.CylinderGeometry(0.16, 0.16, comp + beiral * 2 + 0.1, 8);
  pc.add(mat, cume, { m: eixo === 'x' ? M(cx, y0 + alt + 0.14, cz, 0, 0, Math.PI / 2) : M(cx, y0 + alt + 0.14, cz, Math.PI / 2), cor: mix(cor, C(0x000000), 0.25), liso: true });
}
function empena(pc, mat, cx, y0, cz, larg, alt, face, cor) {
  // triangular gable wall in the plane facing `face` ('x' → wall normal along X, 'z' → along Z)
  const s = new THREE.Shape(); s.moveTo(-larg / 2, 0); s.lineTo(larg / 2, 0); s.lineTo(0, alt); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false }); g.translate(0, 0, -0.125);
  pc.add(mat, g, { m: face === 'z' ? M(cx, y0, cz) : M(cx, y0, cz, 0, Math.PI / 2), cor });
}
function laboratorio() {
  const pc = nova('cc_laboratorio_campo');
  const creme = C(0xf1e8d4), madeira = C(0x5b3d2a), pedra = C(0x8f8b83), telha = C(0x3e6870), W = 13, D = 8;
  const parede = (p, n) => aoAltura(sombra(creme, n, 0.1), p.y, 0.4, 1.6, 0.18);
  // plinth + walls
  pc.add('lab_pedra', box(W + 0.6, 0.5, D + 0.6), { m: M(0, 0.25, 0), cor: (p, n) => sombra(mix(pedra, C(0x6f6b64), ruido(p.x * 2, p.y * 4, p.z * 2) * 0.5 + 0.5), n) });
  pc.add('lab_parede', box(W, 3.2, D), { m: M(0, 0.5 + 1.6, 0), cor: parede });
  pc.add('lab_madeira', box(W + 0.16, 0.28, D + 0.16), { m: M(0, 3.7 + 0.14, 0), cor: madeira });
  pc.add('lab_parede', box(W, 2.8, D), { m: M(0, 3.98 + 1.4, 0), cor: parede });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pc.add('lab_madeira', box(0.32, 6.3, 0.32), { m: M(sx * W / 2, 0.5 + 3.15, sz * D / 2), cor: madeira });
  for (const x of [-W / 4, W / 4]) for (const sz of [-1, 1]) pc.add('lab_madeira', box(0.22, 2.8, 0.18), { m: M(x, 5.38, sz * (D / 2 + 0.02)), cor: madeira });
  // roof (ridge along X) + gable walls
  telhadoDuasAguas(pc, 'lab_telhado', 0, 6.78, 0, W, D, 3.0, 'x', telha);
  for (const sx of [-1, 1]) empena(pc, 'lab_parede', sx * W / 2, 6.78, 0, D, 3.0, 'x', creme);
  janela(pc, -W / 2 - 0.02, 7.7, 0, 'x-', 0.9, 0.9); janela(pc, W / 2 + 0.02, 7.7, 0, 'x+', 0.9, 0.9);
  // front porch bay with its own gable (ridge along Z)
  const zf = D / 2;
  pc.add('lab_parede', box(4.4, 6.3, 1.5), { m: M(0, 0.5 + 3.15, zf + 0.75), cor: parede });
  pc.add('lab_madeira', box(4.56, 0.28, 1.6), { m: M(0, 3.84, zf + 0.78), cor: madeira });
  telhadoDuasAguas(pc, 'lab_telhado', 0, 6.8, zf + 0.55, 1.9, 4.4, 2.0, 'z', telha, 0.4);
  empena(pc, 'lab_parede', 0, 6.8, zf + 1.5, 4.4, 2.0, 'z', creme);
  janela(pc, 0, 7.55, zf + 1.66, 'z+', 0.8, 0.8);
  // double door, frame, steps, lanterns
  pc.add('lab_madeira', box(1.9, 2.55, 0.12), { m: M(0, 0.5 + 1.27, zf + 1.52), cor: C(0xf7f4ec) });
  for (const s of [-1, 1]) pc.add('lab_madeira', box(0.78, 2.3, 0.1), { m: M(s * 0.41, 0.5 + 1.15, zf + 1.6), cor: (p, n) => mix(C(0x6b3a26), C(0x8a4e32), (p.y - 0.5) / 2.3) });
  for (const s of [-1, 1]) pc.add('lab_metal', new THREE.SphereGeometry(0.06, 8, 6), { m: M(s * 0.12, 1.65, zf + 1.68), cor: C(0xd8b04a) });
  pc.add('lab_pedra', box(2.8, 0.25, 0.7), { m: M(0, 0.12, zf + 1.85), cor: pedra });
  pc.add('lab_pedra', box(2.4, 0.25, 0.5), { m: M(0, 0.37, zf + 1.65), cor: C(0x9b978f) });
  for (const s of [-1, 1]) {
    pc.add('lab_metal', box(0.42, 0.1, 0.42), { m: M(s * 1.35, 2.93, zf + 1.68), cor: C(0x2d2d2d) }); pc.add('lab_metal', box(0.4, 0.06, 0.4), { m: M(s * 1.35, 2.54, zf + 1.68), cor: C(0x2d2d2d) });
    pc.add('lab_vidro', box(0.36, 0.3, 0.36), { m: M(s * 1.35, 2.72, zf + 1.68), cor: C(0xffe08a) });   // glass sticks out of the frame
  }
  // windows
  for (const x of [-5, -3, 3, 5]) { janela(pc, x, 2.15, zf + 0.02, 'z+'); janela(pc, x, 5.35, zf + 0.02, 'z+'); }
  janela(pc, 0, 5.35, zf + 1.52, 'z+', 1.2, 1.2);
  for (const x of [-5, -2.5, 0, 2.5, 5]) { janela(pc, x, 2.15, -zf - 0.02, 'z-'); janela(pc, x, 5.35, -zf - 0.02, 'z-'); }
  for (const z of [-2, 2]) for (const y of [2.15, 5.35]) janela(pc, W / 2 + 0.02, y, z, 'x+');
  janela(pc, -W / 2 - 0.02, 5.35, -2, 'x-'); janela(pc, -W / 2 - 0.02, 5.35, 2, 'x-');
  // chimney + weather vane
  pc.add('lab_pedra', box(0.9, 2.4, 0.9), { m: M(-4.2, 8.6, -1.6), cor: (p, n) => sombra(mix(C(0x9a5a45), C(0x7d4536), ruido(p.x * 3, p.y * 3, p.z * 3) * 0.5 + 0.5), n) });
  pc.add('lab_pedra', box(1.1, 0.2, 1.1), { m: M(-4.2, 9.85, -1.6), cor: C(0x6f6b64) });
  pc.add('lab_metal', new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), { m: M(1.8, 10.5, 0), cor: C(0x3a3a3a) });
  pc.add('lab_metal', box(0.7, 0.25, 0.03), { m: M(2.05, 11.1, 0), cor: C(0x3a3a3a) });
  pc.add('lab_metal', new THREE.ConeGeometry(0.1, 0.3, 6), { m: M(1.8, 11.4, 0), cor: C(0xc9a24a) });
  // observatory tower (back-right) with a dome
  const tx = W / 2 + 1.1, tz = -D / 2 + 1.2;
  pc.add('lab_pedra', new THREE.CylinderGeometry(2.05, 2.15, 0.5, 20), { m: M(tx, 0.25, tz), cor: pedra });
  pc.add('lab_parede', new THREE.CylinderGeometry(1.85, 1.95, 8.4, 20), { m: M(tx, 0.5 + 4.2, tz), cor: parede, liso: true });
  pc.add('lab_madeira', new THREE.CylinderGeometry(2.02, 2.02, 0.3, 20), { m: M(tx, 3.84, tz), cor: madeira });
  pc.add('lab_madeira', new THREE.CylinderGeometry(2.1, 2.1, 0.32, 20), { m: M(tx, 8.95, tz), cor: madeira });
  pc.add('lab_metal', new THREE.SphereGeometry(1.95, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), { m: M(tx, 9.1, tz), cor: (p, n) => sombra(mix(C(0x8aa3b5), C(0xc8d6df), n.y), n, 0.2), liso: true });
  pc.add('lab_madeira', box(0.5, 1.6, 2.2), { m: M(tx + 0.9, 10.0, tz, 0, 0, -0.75), cor: C(0x2a3440) });   // dome slit
  for (const [y, a] of [[2.2, 0.5], [6.3, 0.2], [6.3, 1.2]]) janela(pc, tx + Math.sin(a) * 1.92, y, tz + Math.cos(a) * 1.92, 'z+', 0.6, 0.9);
  // greenhouse wing (left), glass with white ribs and a barrel roof
  const gx0 = -W / 2 - 4.6, gx1 = -W / 2, gz = 2.8, gh = 2.6;
  pc.add('lab_pedra', box(gx1 - gx0 + 0.3, 0.45, gz * 2 + 0.3), { m: M((gx0 + gx1) / 2, 0.22, 0), cor: pedra });
  pc.add('lab_vidro', box(gx1 - gx0, gh, gz * 2), { m: M((gx0 + gx1) / 2, 0.45 + gh / 2, 0), cor: (p, n) => mix(C(0x9fd3c8), C(0xe2f5f0), (p.y - 0.45) / gh) });
  const arco = new THREE.CylinderGeometry(gz, gz, gx1 - gx0, 20, 1, false, 0, Math.PI);
  pc.add('lab_vidro', arco, { m: M((gx0 + gx1) / 2, 0.45 + gh, 0, 0, 0, Math.PI / 2).multiply(M(0, 0, 0, 0, -Math.PI / 2)), cor: (p, n) => mix(C(0xa9dcd0), C(0xeefaf6), n.y), liso: true });
  for (let x = gx0; x <= gx1 + 0.01; x += (gx1 - gx0) / 4) {
    for (const s of [-1, 1]) pc.add('lab_madeira', box(0.1, gh, 0.1), { m: M(x, 0.45 + gh / 2, s * gz), cor: C(0xf7f4ec) });
    pc.add('lab_madeira', new THREE.TorusGeometry(gz, 0.05, 4, 16, Math.PI), { m: M(x, 0.45 + gh, 0, 0, Math.PI / 2), cor: C(0xf7f4ec) });
  }
  for (const s of [-1, 1]) pc.add('lab_madeira', box(gx1 - gx0, 0.1, 0.1), { m: M((gx0 + gx1) / 2, 0.45 + gh, s * gz), cor: C(0xf7f4ec) });
  pc.add('lab_madeira', box(0.9, 2.0, 0.08), { m: M(gx0 + 1.2, 1.45, gz + 0.03), cor: C(0xf7f4ec) });
  for (let i = 0; i < 9; i++) pc.add('leaf_copa', new THREE.IcosahedronGeometry(entre(0.35, 0.6), 1), { m: M(entre(gx0 + 0.6, gx1 - 0.6), 0.9, entre(-gz + 0.6, gz - 0.6)), cor: (p, n) => sombra(mix(C(0x2f6b2a), C(0x8acb55), n.y), n), liso: true });
  return pc;
}

/* ═════════════════════════════════════════════════════════════════════════ WINDMILL */
function moinho(nome, giro) {
  const pc = nova(nome);
  const cal = C(0xf2ede2), pedra = C(0x8f8b83), mad = C(0x5e3f2b), tecido = C(0xeadcc0);
  const oito = (r0, r1, h, y) => new THREE.CylinderGeometry(r1, r0, h, 8).rotateY(Math.PI / 8).translate(0, y + h / 2, 0);
  pc.add('lab_pedra', oito(3.15, 2.95, 1.3, 0), { cor: (p, n) => sombra(mix(pedra, C(0x6f6b64), ruido(p.x * 2, p.y * 3, p.z * 2) * 0.5 + 0.5), n) });
  pc.add('lab_parede', oito(2.85, 1.95, 7.9, 1.3), { cor: (p, n) => aoAltura(sombra(cal, n, 0.12), p.y, 1.3, 3, 0.15) });
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; pc.add('lab_madeira', box(0.16, 7.95, 0.16), { m: M(Math.sin(a) * 2.4, 1.3 + 3.95, Math.cos(a) * 2.4, 0, a, 0).multiply(M(0, 0, 0, -0.115)), cor: mad }); }
  // gallery
  pc.add('lab_madeira', new THREE.CylinderGeometry(3.35, 3.35, 0.18, 16), { m: M(0, 3.6, 0), cor: mad });
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; pc.add('lab_madeira', box(0.08, 0.9, 0.08), { m: M(Math.sin(a) * 3.25, 4.1, Math.cos(a) * 3.25), cor: mad }); }
  pc.add('lab_madeira', new THREE.TorusGeometry(3.25, 0.05, 4, 32), { m: M(0, 4.55, 0, Math.PI / 2), cor: mad });
  // door + windows on the front face
  const ap = h => (2.85 - (2.85 - 1.95) * (h - 1.3) / 7.9) * Math.cos(Math.PI / 8);
  pc.add('lab_madeira', box(1.15, 2.1, 0.12), { m: M(0, 1.35 + 1.05, ap(2.4) + 0.06, -0.115), cor: (p, n) => mix(C(0x5a3020), C(0x7e4a2e), (p.y - 1.3) / 2) });
  for (const y of [5.6, 7.6]) janela(pc, 0, y, ap(y) + 0.04, 'z+', 0.6, 0.85);
  janela(pc, ap(6.6) + 0.04, 6.6, 0, 'x+', 0.5, 0.8); janela(pc, -ap(6.6) - 0.04, 6.6, 0, 'x-', 0.5, 0.8);
  // cap
  pc.add('lab_telhado', new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), { m: M(0, 9.15, -0.1, 0, 0, 0, 2.25, 1.9, 2.6), cor: (p, n) => sombra(mix(C(0x6b4a33), C(0x8a6a4a), n.y), n, 0.3), liso: true });
  pc.add('lab_madeira', new THREE.CylinderGeometry(2.3, 2.3, 0.25, 16), { m: M(0, 9.2, -0.1), cor: mad });
  pc.add('lab_metal', new THREE.SphereGeometry(0.18, 8, 6), { m: M(0, 11.1, -0.1), cor: C(0xc9a24a) });
  // windshaft + sails (tilted 8° up, facing +Z)
  const hub = new THREE.Vector3(0, 10.05, 2.35), tilt = -0.14;
  pc.add('lab_madeira', new THREE.CylinderGeometry(0.32, 0.36, 1.5, 10), { m: M(hub.x, hub.y, hub.z - 0.55, Math.PI / 2 + tilt), cor: mad, liso: true });
  pc.add('lab_metal', new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10), { m: M(hub.x, hub.y, hub.z + 0.15, Math.PI / 2 + tilt), cor: C(0x3a3a3a), liso: true });
  const base = M(hub.x, hub.y, hub.z + 0.3, tilt);
  for (let k = 0; k < 4; k++) {
    const a = giro + k * Math.PI / 2, R = M(0, 0, 0, 0, 0, a), at = m => base.clone().multiply(R).multiply(m);
    pc.add('lab_madeira', box(0.24, 6.6, 0.2), { m: at(M(0, 3.3, 0)), cor: mad });
    const L0 = 1.4, L1 = 6.4, w = 1.65;
    for (const [x, y, ww, hh] of [[w / 2 + 0.12, (L0 + L1) / 2, 0.08, L1 - L0], [0.12, (L0 + L1) / 2, 0.06, L1 - L0]]) pc.add('lab_madeira', box(ww, hh, 0.08), { m: at(M(x, y, 0.05)), cor: mad });
    for (let y = L0; y <= L1 + 0.01; y += (L1 - L0) / 7) pc.add('lab_madeira', box(w + 0.1, 0.06, 0.08), { m: at(M(w / 2 + 0.12, y, 0.06)), cor: mad });
    pc.add('lab_parede', box(w - 0.1, L1 - L0 - 0.15, 0.03), { m: at(M(w / 2 + 0.12, (L0 + L1) / 2, -0.04)), cor: (p, n) => mix(tecido, C(0xd8c6a4), ruido(p.x * 1.5, p.y * 1.5, p.z * 1.5) * 0.5 + 0.5) });
  }
  return pc;
}

/* ═════════════════════════════════════════════════════════════════════════ TREES */
const blobGeo = (r, det = 2) => new THREE.IcosahedronGeometry(r, det);
/** a canopy made of noisy blobs, shaded dark-inside → light-top */
function copa(pc, centros, { escuro, claro, ruidoK = 0.22, centro, mat = 'leaf_copa', variacao = 0.08 }) {
  for (const [x, y, z, r] of centros) {
    const tint = 1 + (rnd() - 0.5) * variacao * 2, off = rnd() * 100;
    pc.add(mat, blobGeo(r, 2), {
      m: M(x, y, z), liso: true,
      desloc: v => { const l = v.length() || 1, k = 1 + ruidoK * ruido(v.x * 1.3 + off, v.y * 1.3, v.z * 1.3) + 0.08 * ruido(v.x * 4 + off, v.y * 4, v.z * 4); v.multiplyScalar(k); },
      cor: (p, n) => {
        const dentro = Math.min(1, p.distanceTo(centro) / 3.2);                       // inner leaves darker
        const topo = 0.5 + 0.5 * n.y;
        return mix(escuro, claro, 0.15 + 0.55 * topo + 0.3 * dentro - 0.2).multiplyScalar(tint);
      },
    });
  }
}
function tronco(pc, { h, r0, r1, curva = 0.25, cor = C(0x6b4a33), cor2 = C(0x4a3222), raizes = 4, galhos = [] }) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 9, 6).translate(0, h / 2, 0);
  const dx = entre(-curva, curva), dz = entre(-curva, curva);
  pc.add('tree_casca', g, { liso: true, desloc: v => { const t = v.y / h; v.x += dx * Math.sin(t * Math.PI) + 0.05 * ruido(v.y * 3, 1, 2); v.z += dz * Math.sin(t * Math.PI); },
    cor: (p, n) => aoAltura(sombra(mix(cor2, cor, 0.5 + 0.5 * ruido(p.x * 6, p.y * 2, p.z * 6)), n, 0.3), p.y, 0, 1.0, 0.35) });
  for (let i = 0; i < raizes; i++) { const a = i / raizes * Math.PI * 2 + rnd(); pc.add('tree_casca', new THREE.ConeGeometry(r0 * 0.55, 0.9, 6), { m: M(Math.sin(a) * r0 * 0.8, 0.3, Math.cos(a) * r0 * 0.8, Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9), cor: cor2, liso: true }); }
  for (const [a, y, L, el] of galhos) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).applyQuaternion(q);
    const mid = new THREE.Vector3(dx * 0.7, y, dz * 0.7).addScaledVector(dir, L / 2);
    const m = new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1));
    pc.add('tree_casca', new THREE.CylinderGeometry(r1 * 0.45, r1 * 0.8, L, 7), { m, cor, liso: true });
  }
  return [dx, dz];
}
function carvalho(nome, s) {
  semente = s; const pc = nova(nome);
  const h = entre(2.4, 3.0);
  const [dx, dz] = tronco(pc, { h: h + 0.6, r0: 0.42, r1: 0.26, galhos: [[0.3, h - 0.3, 1.8, 0.7], [2.4, h - 0.1, 1.7, 0.65], [4.4, h - 0.5, 1.6, 0.75]] });
  const c = new THREE.Vector3(dx, h + 2.2, dz), centros = [];
  const n = 8 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, rr = entre(0.6, 2.3), y = entre(-0.9, 1.3); centros.push([c.x + Math.cos(a) * rr, c.y + y, c.z + Math.sin(a) * rr, entre(1.25, 1.85)]); }
  centros.push([c.x, c.y + 0.6, c.z, 2.0]);
  copa(pc, centros, { escuro: C(0x24542a), claro: C(0x86c24e), centro: c });
  return pc;
}
function pinheiro(nome, s) {
  semente = s; const pc = nova(nome);
  const H = entre(7.5, 9.5);
  tronco(pc, { h: 2.4, r0: 0.32, r1: 0.22, curva: 0.05, cor: C(0x6a4630), raizes: 3 });
  const camadas = 5;
  for (let i = 0; i < camadas; i++) {
    const t = i / (camadas - 1), r = 2.6 * (1 - t * 0.78), hh = 2.6 - t * 0.9, y = 1.6 + t * (H - 3.2), off = rnd() * 50;
    const g = new THREE.ConeGeometry(r, hh, 14, 3).translate(0, hh / 2, 0);
    pc.add('leaf_copa', g, { m: M(0, y, 0, 0, rnd() * 6), liso: true,
      desloc: v => { const rad = Math.hypot(v.x, v.z); if (rad > 0.05) { const a = Math.atan2(v.z, v.x), k = 1 + 0.16 * Math.sin(a * 7 + off) + 0.1 * ruido(a * 3 + off, v.y, 0); v.x *= k; v.z *= k; if (v.y < hh * 0.2) v.y -= 0.25 * (rad / r) * (0.5 + 0.5 * Math.sin(a * 7 + off)); } },
      cor: (p, n) => mix(C(0x173d2b), C(0x4f8f52), 0.25 + 0.45 * (0.5 + 0.5 * n.y) + 0.35 * (p.y / H) - 0.25 * (1 - Math.min(1, Math.hypot(p.x, p.z) / 1.5))) });
  }
  return pc;
}
function choupo() {
  semente = 7101; const pc = nova('cc_arvore_choupo');
  tronco(pc, { h: 2.6, r0: 0.3, r1: 0.2, curva: 0.06, raizes: 3 });
  const c = new THREE.Vector3(0, 6, 0), centros = [];
  for (let i = 0; i < 9; i++) { const t = i / 8; centros.push([entre(-0.4, 0.4), 2.6 + t * 6.6, entre(-0.4, 0.4), 1.25 * Math.sin(0.25 + t * 2.6) + 0.5]); }
  copa(pc, centros, { escuro: C(0x2b5a28), claro: C(0x8fc458), centro: c, ruidoK: 0.18 });
  return pc;
}
function betula() {
  semente = 7202; const pc = nova('cc_arvore_betula');
  const g = new THREE.CylinderGeometry(0.16, 0.26, 5.6, 9, 8).translate(0, 2.8, 0);
  pc.add('tree_casca', g, { liso: true, desloc: v => { v.x += 0.18 * Math.sin(v.y * 0.7); },
    cor: (p, n) => { const marca = ruido(p.y * 5.5, Math.atan2(p.z, p.x) * 2, 3) > 0.45; return sombra(marca ? C(0x2d2a28) : mix(C(0xe9e4da), C(0xd0cabc), ruido(p.y * 2, p.x * 4, 1) * 0.5 + 0.5), n, 0.25); } });
  const c = new THREE.Vector3(0.2, 5.6, 0), centros = [];
  for (let i = 0; i < 10; i++) { const a = rnd() * Math.PI * 2, rr = entre(0.3, 1.7); centros.push([c.x + Math.cos(a) * rr, c.y + entre(-1.6, 1.6), c.z + Math.sin(a) * rr, entre(0.8, 1.25)]); }
  copa(pc, centros, { escuro: C(0x4f7d2c), claro: C(0xc2df6e), centro: c, ruidoK: 0.3 });
  return pc;
}
function macieira() {
  semente = 7303; const pc = nova('cc_arvore_macieira');
  const [dx, dz] = tronco(pc, { h: 2.0, r0: 0.3, r1: 0.2, curva: 0.3, galhos: [[0.5, 1.7, 1.2, 0.6], [2.6, 1.8, 1.1, 0.7], [4.6, 1.6, 1.2, 0.6]] });
  const c = new THREE.Vector3(dx, 3.3, dz), centros = [];
  for (let i = 0; i < 8; i++) { const a = rnd() * Math.PI * 2, rr = entre(0.5, 1.6); centros.push([c.x + Math.cos(a) * rr, c.y + entre(-0.5, 0.8), c.z + Math.sin(a) * rr, entre(1.0, 1.4)]); }
  copa(pc, centros, { escuro: C(0x2f6a2c), claro: C(0x8cc957), centro: c });
  for (let i = 0; i < 26; i++) {                                   // apples on the canopy surface
    const d = new THREE.Vector3(entre(-1, 1), entre(-0.6, 1), entre(-1, 1)).normalize(), p = c.clone().addScaledVector(d, entre(1.9, 2.3)).add(new THREE.Vector3(0, -0.2, 0));
    pc.add('leaf_fruta', new THREE.SphereGeometry(0.14, 8, 6), { m: M(p.x, p.y, p.z), cor: (q, n) => sombra(mix(C(0xb81f1f), C(0xf05a3a), n.y), n), liso: true });
  }
  return pc;
}
function cerejeira() {
  semente = 7404; const pc = nova('cc_arvore_cerejeira');
  const [dx, dz] = tronco(pc, { h: 2.4, r0: 0.34, r1: 0.22, curva: 0.4, cor: C(0x5a3a35), cor2: C(0x3a2522), galhos: [[0.2, 2.1, 1.7, 0.45], [2.2, 2.2, 1.8, 0.5], [4.2, 2.0, 1.6, 0.4]] });
  const c = new THREE.Vector3(dx, 3.9, dz), centros = [];
  for (let i = 0; i < 11; i++) { const a = rnd() * Math.PI * 2, rr = entre(0.8, 2.6); centros.push([c.x + Math.cos(a) * rr, c.y + entre(-0.5, 0.9), c.z + Math.sin(a) * rr, entre(1.0, 1.5)]); }
  copa(pc, centros, { escuro: C(0xc56f93), claro: C(0xffd9e8), centro: c, ruidoK: 0.28 });
  return pc;
}
function palmeira() {
  semente = 7505; const pc = nova('cc_arvore_palmeira');
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 4, 0.9), new THREE.Vector3(1.4, 7.4, 1.2));
  const seg = 14;
  for (let i = 0; i < seg; i++) {
    const a = curva.getPoint(i / seg), b = curva.getPoint((i + 1) / seg), mid = a.clone().lerp(b, 0.5), dir = b.clone().sub(a), L = dir.length();
    const r = 0.32 - 0.12 * i / seg;
    const m = new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()), new THREE.Vector3(1, 1, 1));
    pc.add('tree_casca', new THREE.CylinderGeometry(r * 0.92, r * 1.08, L * 1.02, 9), { m, liso: true, cor: (p, n) => sombra(i % 2 ? C(0xa98a5e) : C(0x8f7350), n, 0.3) });
  }
  const topo = curva.getPoint(1);
  for (let k = 0; k < 8; k++) {                                   // fronds: drooping V-shaped ribbons
    const a = k / 8 * Math.PI * 2 + rnd() * 0.3, L = entre(3.0, 3.8), pts = [], N = 10, pos = [];
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(Math.cos(a) * L * t, 0.6 * t - 1.6 * t * t, Math.sin(a) * L * t)); }
    for (let i = 0; i < N; i++) {
      const w0 = 0.55 * Math.sin(Math.PI * Math.min(1, (i / N) * 1.1 + 0.08)), w1 = 0.55 * Math.sin(Math.PI * Math.min(1, ((i + 1) / N) * 1.1 + 0.08));
      const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      const A = pts[i], B = pts[i + 1], dip = 0.18;
      for (const s of [-1, 1]) {
        const A2 = A.clone().addScaledVector(side, s * w0).add(new THREE.Vector3(0, -dip * w0, 0)), B2 = B.clone().addScaledVector(side, s * w1).add(new THREE.Vector3(0, -dip * w1, 0));
        pos.push(...A.toArray(), ...B.toArray(), ...A2.toArray(), ...A2.toArray(), ...B.toArray(), ...B2.toArray());
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pc.add('leaf_copa', g, { m: M(topo.x, topo.y, topo.z), cor: (p, n) => mix(C(0x2a6a2c), C(0x7fc256), 0.4 + 0.4 * Math.abs(n.y)) });
  }
  for (let k = 0; k < 4; k++) pc.add('leaf_fruta', new THREE.SphereGeometry(0.2, 8, 6), { m: M(topo.x + Math.cos(k * 1.7) * 0.3, topo.y - 0.25, topo.z + Math.sin(k * 1.7) * 0.3), cor: C(0x5a3d22), liso: true });
  return pc;
}
function arbusto(nome, flores) {
  semente = flores ? 7707 : 7606; const pc = nova(nome);
  const c = new THREE.Vector3(0, 0.6, 0), centros = [];
  for (let i = 0; i < 6; i++) { const a = rnd() * Math.PI * 2, rr = entre(0.2, 0.75); centros.push([Math.cos(a) * rr, entre(0.45, 0.85), Math.sin(a) * rr, entre(0.45, 0.7)]); }
  copa(pc, centros, { escuro: C(0x24552a), claro: C(0x7cbc4c), centro: c, ruidoK: 0.25 });
  if (flores) for (let i = 0; i < 30; i++) {
    const d = new THREE.Vector3(entre(-1, 1), entre(-0.2, 1), entre(-1, 1)).normalize(), p = c.clone().addScaledVector(d, entre(0.95, 1.1));
    pc.add('leaf_fruta', new THREE.IcosahedronGeometry(0.09, 0), { m: M(p.x, p.y, p.z), cor: rnd() < 0.5 ? C(0xff8fb4) : C(0xfff3f6) });
  }
  return pc;
}

/* ═════════════════════════════════════════════════════════════════════════ NATURAL LAKES */
const LAGOS = {};
function lago(nome, s, rx, rz) {
  semente = s; const pc = nova(nome), det = nova(nome + '_detalhe');
  const harm = [1, 2, 3, 4, 5].map(k => [entre(-0.12, 0.12) / Math.sqrt(k), rnd() * Math.PI * 2, k + 1]);
  const R = a => { let f = 1; for (const [amp, ph, k] of harm) f += amp * Math.sin(k * a + ph); return f; };   // shoreline
  const borda = (a, d) => [Math.cos(a) * (rx * R(a) + d), Math.sin(a) * (rz * R(a) + d)];
  const NA = 96, AGUA = -0.12;
  // radial profile: [offset from shoreline (m, negative = inside), height, material key, colour, alpha]
  const lama = C(0x4a4032), areia = C(0xb9a27a), molhado = C(0x7d6a4c);
  const anel = (mat, perfis, uv) => {
    const pos = [], col = [];
    for (let i = 0; i < NA; i++) {
      const a0 = i / NA * Math.PI * 2, a1 = (i + 1) / NA * Math.PI * 2;
      for (let j = 0; j < perfis.length - 1; j++) {
        const q = [[a0, perfis[j]], [a1, perfis[j]], [a1, perfis[j + 1]], [a0, perfis[j + 1]]].map(([a, [d, y, c, al]]) => { const [x, z] = d === null ? [0, 0] : borda(a, d); return [x, y, z, c, al]; });
        for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); col.push(q[k][3], q[k][4]); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    let i = 0;
    pc.add(mat, g, { cor: () => { const c = col[i * 2], al = col[i * 2 + 1]; i++; return [c, al]; }, uv });
  };
  const fundo = d => [d, AGUA - 0.35 - 0.9 * Math.min(1, -d / Math.min(rx, rz)) ** 0.6, mix(lama, C(0x2c2a22), Math.min(1, -d / 3)), 1];
  anel('grass_lago_fundo', [[null, AGUA - 1.25, C(0x2a281f), 1], fundo(-Math.min(rx, rz) * 0.6), fundo(-2.5), fundo(-1.2), [-0.45, AGUA - 0.3, lama, 1], [-0.05, AGUA + 0.02, molhado, 1], [0.12, 0.03, areia, 1], [0.42, 0.034, mix(areia, C(0x8a8a50), 0.5), 1]]);
  // grass rim (library grass texture, same tint as floor_grass2): fades in over the sand, opaque, then fades out over the tiles
  const verde = C(0xffffff), uvMundo = p => [p.x / 2, p.z / 2];
  anel('grass_lago_borda', [[0.25, 0.04, mix(C(0x9c8f55), verde, 0.2), 0], [0.55, 0.04, C(0xc9d9b0), 1], [1.0, 0.04, verde, 1], [1.7, 0.04, verde, 1], [2.6, 0.04, verde, 0]], uvMundo);
  // water: a disc a bit past the shoreline (the shore slope covers the joint)
  { const pos = [];
    for (let i = 0; i < NA; i++) { const a0 = i / NA * Math.PI * 2, a1 = (i + 1) / NA * Math.PI * 2, [x0, z0] = borda(a0, 0.18), [x1, z1] = borda(a1, 0.18); pos.push(0, AGUA, 0, x1, AGUA, z1, x0, AGUA, z0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pc.add('water_lago', g, { cor: C(0x3d78b8) }); }
  pc.extras = { lago: { rx, rz, agua: AGUA, contorno: Array.from({ length: 48 }, (_, i) => borda(i / 48 * Math.PI * 2, 0).map(v => +v.toFixed(3))), aro: 1.6 } };
  LAGOS[nome] = pc.extras.lago;
  // dressing: reed clumps, lily pads, stones (the "_detalhe" prefab, placed at the same spot without `pi`)
  const juncos = Math.round((rx + rz) * 0.9);
  for (let k = 0; k < juncos; k++) {
    const a = rnd() * Math.PI * 2, [cx, cz] = borda(a, entre(-0.35, 0.25));
    for (let i = 0; i < 9; i++) {
      const h = entre(0.7, 1.5), x = cx + entre(-0.35, 0.35), z = cz + entre(-0.35, 0.35), incl = entre(-0.18, 0.18);
      det.add('leaf_junco', new THREE.CylinderGeometry(0.012, 0.03, h, 4).translate(0, h / 2, 0), { m: M(x, AGUA, z, incl, rnd() * 6, incl), cor: (p, n) => mix(C(0x3f6b2a), C(0x9cc061), (p.y - AGUA) / h) });
      if (rnd() < 0.35) det.add('leaf_junco', new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), { m: M(x + incl * h * 0.9, AGUA + h * 0.86, z, incl, 0, incl), cor: C(0x6b4426) });
    }
  }
  const nenufares = Math.round(rx * rz * 0.35);
  for (let k = 0; k < nenufares; k++) {
    const a = rnd() * Math.PI * 2, f = entre(0.25, 0.8), x = Math.cos(a) * rx * R(a) * f, z = Math.sin(a) * rz * R(a) * f, r = entre(0.22, 0.42);
    det.add('leaf_junco', new THREE.CircleGeometry(r, 10, 0.5, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2), { m: M(x, AGUA + 0.015, z, 0, rnd() * 6), cor: (p, n) => mix(C(0x3d7a2e), C(0x6fae45), rnd()) });
    if (rnd() < 0.3) det.add('leaf_fruta', new THREE.ConeGeometry(0.09, 0.12, 6), { m: M(x, AGUA + 0.07, z), cor: C(0xffb3cf) });
  }
  for (let k = 0; k < Math.round((rx + rz) * 0.4); k++) {
    const a = rnd() * Math.PI * 2, [x, z] = borda(a, entre(0.1, 0.9)), r = entre(0.25, 0.6), off = rnd() * 50;
    det.add('rock_pedra', new THREE.IcosahedronGeometry(r, 1), { m: M(x, r * 0.25, z, 0, rnd() * 6, 0, 1, 0.6, 1), liso: true,
      desloc: v => v.multiplyScalar(1 + 0.25 * ruido(v.x * 3 + off, v.y * 3, v.z * 3)), cor: (p, n) => sombra(mix(C(0x6f6c66), C(0xa8a49a), 0.5 + 0.5 * n.y), n) });
  }
  return pc;
}

/* ═════════════════════════════════════════════════════════════════════════ BUILD */
laboratorio();
moinho('cc_moinho', 0.12); moinho('cc_moinho_x', Math.PI / 4 + 0.12);
carvalho('cc_arvore_carvalho_1', 101); carvalho('cc_arvore_carvalho_2', 202); carvalho('cc_arvore_carvalho_3', 303);
pinheiro('cc_arvore_pinheiro_1', 404); pinheiro('cc_arvore_pinheiro_2', 505);
choupo(); betula(); macieira(); cerejeira(); palmeira(); arbusto('cc_arbusto_1', false); arbusto('cc_arbusto_flor', true);
lago('cc_lago_natural_1', 901, 5, 3.6); lago('cc_lago_natural_2', 902, 8, 5.5); lago('cc_lago_natural_3', 903, 12, 7.5);

/* ── GLB writer ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
const gltf = { asset: { version: '2.0', generator: 'PokeVerse make_nature_props' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Mapa', children: [] }],
  meshes: [], accessors: [], bufferViews: [], materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], buffers: [] };
const partes = []; let tam = 0;
function bv(buf, target) { const pad = (4 - tam % 4) % 4; if (pad) { partes.push(Buffer.alloc(pad)); tam += pad; } gltf.bufferViews.push({ buffer: 0, byteOffset: tam, byteLength: buf.length, ...(target ? { target } : {}) }); partes.push(buf); tam += buf.length; return gltf.bufferViews.length - 1; }
function acc(arr, type, comp = 5126, minmax = false, target = 34962) {
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type], buf = comp === 5125 ? Buffer.from(new Uint32Array(arr).buffer) : Buffer.from(new Float32Array(arr).buffer);
  const a = { bufferView: bv(buf, target), componentType: comp, count: arr.length / n, type };
  if (minmax) { const mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity); for (let i = 0; i < arr.length; i++) { mn[i % n] = Math.min(mn[i % n], arr[i]); mx[i % n] = Math.max(mx[i % n], arr[i]); } a.min = mn; a.max = mx; }
  gltf.accessors.push(a); return gltf.accessors.length - 1;
}
// the grass rim texture = the library grass (embedded; build_prefab_library moves it to scenery/lib/tex)
const capim = fs.readFileSync(path.join(ROOT, 'scenery/lib/tex/31295b921f074be7de41.png'));
gltf.images.push({ name: 'T_G_001_Grass_01_C', bufferView: bv(capim), mimeType: 'image/png' });
gltf.textures.push({ sampler: 0, source: 0, name: 'T_G_001_Grass_01_C' });
const idxMat = {};
for (const [k, def] of Object.entries(MATS)) { idxMat[k] = gltf.materials.length; gltf.materials.push(def); }
for (const pc of PECAS) {
  const filhos = [];
  for (const [mat, geos] of pc.porMat) {
    const temUv = MATS[mat].pbrMetallicRoughness?.baseColorTexture != null;
    const g = mergeGeometries(geos.map(x => { if (!temUv && x.attributes.uv) x.deleteAttribute('uv'); return x; }));
    const P = g.attributes.position.array, N = g.attributes.normal.array, Cc = g.attributes.color.array;
    const prim = { attributes: { POSITION: acc(Array.from(P), 'VEC3', 5126, true), NORMAL: acc(Array.from(N), 'VEC3'), COLOR_0: acc(Array.from(Cc), 'VEC4') },
      indices: acc(Array.from({ length: P.length / 3 }, (_, i) => i), 'SCALAR', 5125, false, 34963), material: idxMat[mat] };
    if (temUv) prim.attributes.TEXCOORD_0 = acc(Array.from(g.attributes.uv.array), 'VEC2');
    gltf.meshes.push({ name: pc.nome + '_' + mat, primitives: [prim] });
    gltf.nodes.push({ name: pc.nome + '_' + mat, mesh: gltf.meshes.length - 1 });
    filhos.push(gltf.nodes.length - 1);
  }
  gltf.nodes.push({ name: 'lib:' + pc.nome, children: filhos, ...(pc.extras ? { extras: pc.extras } : {}) });
  gltf.nodes[0].children.push(gltf.nodes.length - 1);
}
const pad = (4 - tam % 4) % 4; if (pad) { partes.push(Buffer.alloc(pad)); tam += pad; }
gltf.buffers.push({ byteLength: tam });
let js = Buffer.from(JSON.stringify(gltf)); if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - js.length % 4, 0x20)]);
const bin = Buffer.concat(partes), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([head, jh, js, bh, bin]));
fs.writeFileSync(OUT.replace(/\.glb$/, '.json'), JSON.stringify({ lagos: LAGOS }, null, 1));
console.log(path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB,', PECAS.length, 'prefabs:', PECAS.map(p => p.nome).join(' '));
