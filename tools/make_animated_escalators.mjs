#!/usr/bin/env node
/* ANIMATED ESCALATORS (Nov 7): copies of the Pokémon Center's two escalators that the game animates, without touching the originals.
 *
 *   sm_ro_005_escalator_01 (rises from the floor: steps going UP)    → animated_escalator_up
 *   sm_ro_005_escalator_04 (sinks into a pit: steps going DOWN)       → animated_escalator_down
 *
 * Each copy is split in two meshes: the body (sides, handrails, the top and bottom landings) and `anim_steps`, ONE moving step
 * (tread + edge + riser). The map loader instances the body like any prefab and skips `anim_*` meshes; escalator_anim.mjs lines up
 * copies of the step along the slope and slides them, clipped between the two landings. The lib node carries the numbers it needs
 * in extras.escada: { dir, passo: [dx, dy] (one step up the slope, in the mesh's own frame), n (steps), x0, x1 (the moving band) }.
 *
 * Output: scenery/extra/animated_escalators.glb (a prefab library GLB, "Mapa" → "lib:<name>"), picked up by
 * tools/build_prefab_library.mjs as a low-priority source. Run from the repo root:
 *     node tools/make_animated_escalators.mjs && node tools/build_prefab_library.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'scenery/4110001.glb');
const OUT = path.join(ROOT, 'scenery/extra/animated_escalators.glb');
const PARES = [['sm_ro_005_escalator_01', 'animated_escalator_up', 'up'], ['sm_ro_005_escalator_04', 'animated_escalator_down', 'down']];

function readGlb(file) {
  const b = fs.readFileSync(file), jlen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jlen).toString('utf8')), off = 20 + jlen;
  return { json, bin: b.subarray(off + 8, off + 8 + b.readUInt32LE(off)) };
}
const { json: J, bin: B } = readGlb(SRC);
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, SZ = { 5126: 4, 5123: 2, 5125: 4 };
/** An accessor's elements as plain arrays. */
function ler(i) {
  const a = J.accessors[i], bv = J.bufferViews[a.bufferView], n = NC[a.type], s = SZ[a.componentType], st = bv.byteStride || n * s;
  const o0 = (bv.byteOffset || 0) + (a.byteOffset || 0), out = [];
  for (let k = 0; k < a.count; k++) {
    const e = [];
    for (let c = 0; c < n; c++) {
      const o = o0 + k * st + c * s;
      e.push(a.componentType === 5126 ? B.readFloatLE(o) : a.componentType === 5123 ? B.readUInt16LE(o) : B.readUInt32LE(o));
    }
    out.push(e);
  }
  return out;
}

// ── the new GLB ────────────────────────────────────────────────────────────────────────────────────────────────────────
const out = { asset: { version: '2.0', generator: 'PokeVerse make_animated_escalators' }, extensionsUsed: ['KHR_texture_transform'], scene: 0, scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Mapa', children: [] }], meshes: [], accessors: [], bufferViews: [], materials: [], textures: [], images: [], samplers: [{ minFilter: 9729 }], buffers: [] };
const partes = []; let tam = 0;
function blob(buf, target) {
  const pad = (4 - tam % 4) % 4; if (pad) { partes.push(Buffer.alloc(pad)); tam += pad; }
  out.bufferViews.push({ buffer: 0, byteOffset: tam, byteLength: buf.length, ...(target ? { target } : {}) });
  partes.push(buf); tam += buf.length;
  return out.bufferViews.length - 1;
}
function accFloat(arr, type) {
  const n = NC[type], b = Buffer.alloc(arr.length * n * 4), mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity);
  arr.forEach((e, k) => e.forEach((v, c) => { b.writeFloatLE(v, (k * n + c) * 4); mn[c] = Math.min(mn[c], v); mx[c] = Math.max(mx[c], v); }));
  out.accessors.push({ bufferView: blob(b, 34962), componentType: 5126, count: arr.length, type, ...(type === 'VEC3' ? { min: mn, max: mx } : {}) });
  return out.accessors.length - 1;
}
function accIdx(arr) {
  const b = Buffer.alloc(arr.length * 4); arr.forEach((v, k) => b.writeUInt32LE(v, k * 4));
  out.accessors.push({ bufferView: blob(b, 34963), componentType: 5125, count: arr.length, type: 'SCALAR', min: [Math.min(...arr)], max: [Math.max(...arr)] });
  return out.accessors.length - 1;
}
const matCopiado = new Map();
function material(mi) {
  if (matCopiado.has(mi)) return matCopiado.get(mi);
  const m = JSON.parse(JSON.stringify(J.materials[mi])), t = J.textures[m.pbrMetallicRoughness.baseColorTexture.index], im = J.images[t.source], bv = J.bufferViews[im.bufferView];
  out.images.push({ name: im.name, mimeType: im.mimeType, bufferView: blob(B.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)) });
  out.textures.push({ sampler: 0, source: out.images.length - 1, name: t.name });
  m.pbrMetallicRoughness.baseColorTexture.index = out.textures.length - 1;
  out.materials.push(m);
  matCopiado.set(mi, out.materials.length - 1);
  return out.materials.length - 1;
}

for (const [orig, novo, dir] of PARES) {
  const li = J.nodes.findIndex(n => n.name === 'lib:' + orig);
  if (li < 0) throw new Error('no lib:' + orig + ' in ' + SRC);
  const mn = J.nodes[J.nodes[li].children[0]], pr = J.meshes[mn.mesh].primitives[0];
  const P = ler(pr.attributes.POSITION), N = ler(pr.attributes.NORMAL), T = ler(pr.attributes.TANGENT), U = ler(pr.attributes.TEXCOORD_0), I = ler(pr.indices).map(e => e[0]);
  // the steps: the grooved strip of the atlas (u 0.8–0.95, v < 0.13)
  const tris = [];
  for (let t = 0; t < I.length; t += 3) {
    const k = I.slice(t, t + 3), u = k.reduce((s, i) => s + U[i][0], 0) / 3, v = k.reduce((s, i) => s + U[i][1], 0) / 3;
    tris.push({ k, degrau: u > 0.8 && u < 0.95 && v < 0.13, plano: v < 0.07, ys: k.map(i => P[i][1]), xs: k.map(i => P[i][0]) });
  }
  const treads = [...new Set(tris.filter(t => t.degrau && t.plano).map(t => Math.round(t.ys[0] * 100) / 100))].sort((a, b) => a - b);
  const deTread = t => { const y = Math.max(...t.ys); return treads.reduce((m, ty) => Math.abs(ty - y) < Math.abs(m - y) ? ty : m, treads[0]); };
  const caixaX = y => { const L = tris.filter(t => t.degrau && t.plano && Math.abs(t.ys[0] - y) < 0.02).flatMap(t => t.xs); return [Math.min(...L), Math.max(...L)]; };
  const baixo = treads[0], alto = treads[treads.length - 1], meio = treads[1];
  const xb = caixaX(baixo), xa = caixaX(alto), xm = caixaX(meio);
  const passo = [((xa[0] + xa[1]) / 2 - (xb[0] + xb[1]) / 2) / (treads.length - 1), (alto - baixo) / (treads.length - 1)];   // one step up the slope (the average)
  const x0 = xa[0] < xb[0] ? xa[1] : xb[1], x1 = xa[0] < xb[0] ? xb[0] : xa[0];        // the band between the landings
  const corpo = [], unidade = [];
  for (const t of tris) {
    if (!t.degrau) { corpo.push(...t.k); continue; }
    const ty = deTread(t);
    if (ty === baixo || ty === alto) corpo.push(...t.k);                              // the landings stay put
    else if (ty === meio) unidade.push(...t.k);                                        // one moving step (the rest are its copies)
  }
  // compact vertex sets per mesh
  const malha = (idx, nome) => {
    const mapa = new Map(), p = [], n = [], tg = [], uv = [];
    const ii = idx.map(i => { if (!mapa.has(i)) { mapa.set(i, p.length); p.push(P[i]); n.push(N[i]); tg.push(T[i]); uv.push(U[i]); } return mapa.get(i); });
    out.meshes.push({ name: nome, primitives: [{ attributes: { POSITION: accFloat(p, 'VEC3'), NORMAL: accFloat(n, 'VEC3'), TANGENT: accFloat(tg, 'VEC4'), TEXCOORD_0: accFloat(uv, 'VEC2') }, indices: accIdx(ii), material: material(pr.material) }] });
    return out.meshes.length - 1;
  };
  const tr = {}; for (const k of ['translation', 'rotation', 'scale']) if (mn[k]) tr[k] = mn[k];
  const nCorpo = out.nodes.push({ name: novo + '_body', mesh: malha(corpo, novo + '_body'), ...tr }) - 1;
  const nPasso = out.nodes.push({ name: 'anim_steps', mesh: malha(unidade, 'anim_steps'), ...tr }) - 1;
  const nLib = out.nodes.push({ name: 'lib:' + novo, children: [nCorpo, nPasso],
    extras: { escada: { dir, passo: passo.map(v => +v.toFixed(4)), n: treads.length - 2, x0: +x0.toFixed(4), x1: +x1.toFixed(4) } } }) - 1;
  out.nodes[0].children.push(nLib);
  console.log(novo + ': ' + corpo.length / 3 + ' body triangles, ' + unidade.length / 3 + ' in the moving step; treads at y ' + treads.join(', ') + '; step ' + passo.map(v => v.toFixed(3)) + '; band x ' + x0.toFixed(2) + '…' + x1.toFixed(2));
}

const bin = Buffer.concat(partes); const pad = (4 - bin.length % 4) % 4;
const binP = Buffer.concat([bin, Buffer.alloc(pad)]);
out.buffers = [{ byteLength: binP.length }];
let js = Buffer.from(JSON.stringify(out)); if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - js.length % 4, 0x20)]);
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binP.length, 8);
jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4); bh.writeUInt32LE(binP.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([head, jh, js, bh, binP]));
console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + Math.round((12 + 16 + js.length + binP.length) / 1024) + ' KB)');
