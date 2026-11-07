#!/usr/bin/env node
/* MIRRORED PREFABS (Nov 7): left-right mirror copies of map prefabs, for rooms that need the same piece the other way round
 * (a rotation can't do it). First use: the Pokémon Center 2F, whose floor needs the escalator opening on the other side.
 *
 *   sm_ro_005_floor_01 → sm_ro_005_floor_01_mirror     (the Center floor: the escalator pit moves to the other wall)
 *   sm_ro_005_wall_01  → sm_ro_005_wall_01_mirror      (its walls: the side opening for the up escalator moves to the other wall;
 *                                                       the strip under the floor that lines the pit stays put)
 *
 * Mirror = x → −x in the prefab's own frame (positions, normals, tangents; triangle winding reversed so faces still point out).
 * Output: scenery/extra/mirrored_prefabs.glb (picked up by tools/build_prefab_library.mjs). Run from the repo root:
 *     node tools/make_mirrored_prefabs.mjs && node tools/build_prefab_library.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'scenery/4110001.glb');
const OUT = path.join(ROOT, 'scenery/extra/mirrored_prefabs.glb');
/* [prefab, parts kept as they are]: the wall's below-floor strip lines the floor's escalator pit, so it stays where the pit is */
const LISTA = [['sm_ro_005_floor_01', null], ['sm_ro_005_wall_01', /_Wall_01_2$/]];

const b0 = fs.readFileSync(SRC), jl = b0.readUInt32LE(12), J = JSON.parse(b0.subarray(20, 20 + jl).toString('utf8'));
const B = b0.subarray(20 + jl + 8, 20 + jl + 8 + b0.readUInt32LE(20 + jl));
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, SZ = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 };
function ler(i) {
  const a = J.accessors[i], bv = J.bufferViews[a.bufferView], n = NC[a.type], s = SZ[a.componentType], st = bv.byteStride || n * s, o0 = (bv.byteOffset || 0) + (a.byteOffset || 0), out = [];
  for (let k = 0; k < a.count; k++) { const e = []; for (let c = 0; c < n; c++) { const o = o0 + k * st + c * s; e.push(a.componentType === 5126 ? B.readFloatLE(o) : a.componentType === 5123 ? B.readUInt16LE(o) : a.componentType === 5121 ? B.readUInt8(o) : B.readUInt32LE(o)); } out.push(e); }
  return out;
}
const out = { asset: { version: '2.0', generator: 'PokeVerse make_mirrored_prefabs' }, extensionsUsed: J.extensionsUsed || [], scene: 0, scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Mapa', children: [] }], meshes: [], accessors: [], bufferViews: [], materials: [], textures: [], images: [], samplers: J.samplers || [{ minFilter: 9729 }], buffers: [] };
const partes = []; let tam = 0;
function blob(buf, target) { const pad = (4 - tam % 4) % 4; if (pad) { partes.push(Buffer.alloc(pad)); tam += pad; } out.bufferViews.push({ buffer: 0, byteOffset: tam, byteLength: buf.length, ...(target ? { target } : {}) }); partes.push(buf); tam += buf.length; return out.bufferViews.length - 1; }
function accFloat(arr, type) {
  const n = NC[type], b = Buffer.alloc(arr.length * n * 4), mn = Array(n).fill(Infinity), mx = Array(n).fill(-Infinity);
  arr.forEach((e, k) => e.forEach((v, c) => { b.writeFloatLE(v, (k * n + c) * 4); mn[c] = Math.min(mn[c], v); mx[c] = Math.max(mx[c], v); }));
  out.accessors.push({ bufferView: blob(b, 34962), componentType: 5126, count: arr.length, type, ...(type === 'VEC3' ? { min: mn, max: mx } : {}) });
  return out.accessors.length - 1;
}
function accIdx(arr) { const b = Buffer.alloc(arr.length * 4); arr.forEach((v, k) => b.writeUInt32LE(v, k * 4)); out.accessors.push({ bufferView: blob(b, 34963), componentType: 5125, count: arr.length, type: 'SCALAR', min: [Math.min(...arr)], max: [Math.max(...arr)] }); return out.accessors.length - 1; }
const mats = new Map(), texs = new Map();
function textura(ti) {
  if (texs.has(ti)) return texs.get(ti);
  const t = J.textures[ti], im = J.images[t.source], bv = J.bufferViews[im.bufferView];
  out.images.push({ name: im.name, mimeType: im.mimeType, bufferView: blob(B.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)) });
  out.textures.push({ sampler: 0, source: out.images.length - 1, name: t.name });
  texs.set(ti, out.textures.length - 1); return out.textures.length - 1;
}
function material(mi) {
  if (mats.has(mi)) return mats.get(mi);
  const m = JSON.parse(JSON.stringify(J.materials[mi])), pb = m.pbrMetallicRoughness || {};
  for (const k of ['baseColorTexture', 'metallicRoughnessTexture']) if (pb[k]) pb[k].index = textura(pb[k].index);
  for (const k of ['normalTexture', 'emissiveTexture', 'occlusionTexture']) if (m[k]) m[k].index = textura(m[k].index);
  out.materials.push(m); mats.set(mi, out.materials.length - 1); return out.materials.length - 1;
}
function malha(mi, esp = true) {
  const M = J.meshes[mi];
  const prims = M.primitives.map(pr => {
    const at = {};
    for (const [k, i] of Object.entries(pr.attributes)) {
      let d = ler(i);
      if (esp && (k === 'POSITION' || k === 'NORMAL')) d = d.map(([x, y, z]) => [-x, y, z]);
      if (esp && k === 'TANGENT') d = d.map(([x, y, z, w]) => [-x, y, z, -w]);
      at[k] = accFloat(d, J.accessors[i].type);
    }
    const I = ler(pr.indices).map(e => e[0]);
    if (esp) for (let t = 0; t < I.length; t += 3) [I[t + 1], I[t + 2]] = [I[t + 2], I[t + 1]];   // mirrored: reverse the winding
    return { attributes: at, indices: accIdx(I), ...(pr.material != null ? { material: material(pr.material) } : {}) };
  });
  out.meshes.push({ name: M.name + (esp ? '_mirror' : ''), primitives: prims }); return out.meshes.length - 1;
}
function copiar(ni, manter = null, esp = true) {
  const n = J.nodes[ni], c = { name: n.name };
  if (esp && manter && manter.test(n.name || '')) esp = false;            // this part (and what hangs under it) is not mirrored
  if (n.translation) c.translation = esp ? [-n.translation[0], n.translation[1], n.translation[2]] : n.translation;
  if (n.rotation) c.rotation = esp ? [n.rotation[0], -n.rotation[1], -n.rotation[2], n.rotation[3]] : n.rotation;   // mirror across the YZ plane
  if (n.scale) c.scale = n.scale;
  if (n.mesh != null) c.mesh = malha(n.mesh, esp);
  const idx = out.nodes.push(c) - 1;
  if (n.children?.length) c.children = n.children.map(k => copiar(k, manter, esp));
  return idx;
}
for (const [nome, manter] of LISTA) {
  const li = J.nodes.findIndex(n => n.name === 'lib:' + nome);
  if (li < 0) throw new Error('no lib:' + nome);
  const i = copiar(li, manter); out.nodes[i].name = 'lib:' + nome + '_mirror';
  out.nodes[0].children.push(i);
  console.log(nome + '_mirror');
}
const bin = Buffer.concat(partes), pad = (4 - bin.length % 4) % 4, binP = Buffer.concat([bin, Buffer.alloc(pad)]);
out.buffers = [{ byteLength: binP.length }];
if (!out.extensionsUsed.length) delete out.extensionsUsed;
let js = Buffer.from(JSON.stringify(out)); if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - js.length % 4, 0x20)]);
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binP.length, 8);
jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4); bh.writeUInt32LE(binP.length, 0); bh.writeUInt32LE(0x004E4942, 4);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([head, jh, js, bh, binP]));
console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + Math.round(binP.length / 1024) + ' KB)');
