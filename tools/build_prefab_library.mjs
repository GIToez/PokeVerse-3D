#!/usr/bin/env node
/* Shared prefab library: every "lib:<name>" prefab of every library map GLB, one small GLB each, so any map can use any model.

   Each map GLB (scenery/<id>.glb, public/scenery/<id>.glb) carries only the prefabs that map places. This tool copies each prefab
   (its node tree plus the meshes, accessors, materials, textures and images it uses) into scenery/lib/<file>.glb, under a "Mapa"
   node exactly like the map GLBs, and writes scenery/lib/index.json:

     { "prefabs": { "<chave>": { "n": "<original name>", "f": "<file>.glb", "de": "<source map>", "kb": 123 } } }

   <chave> is the same key the game and the editor use (chaveNome: lower case, no "lib:", spaces → "_", no []./: characters).
   The game loads only the prefabs a map places but its own GLB lacks; the 3D editor lists them all in the palette and loads one
   when it is used. The first map that has a prefab wins (kanto first); a map's own copy always wins over the shared one.

   Run from the repo root after adding or changing map GLBs:
       node tools/build_prefab_library.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scenery/lib');
const DIRS = [path.join(ROOT, 'scenery'), path.join(ROOT, 'public/scenery')];
const chaveNome = n => n.toLowerCase().replace(/^lib:?/, '').replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');

function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546C67) return null;
  const jlen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jlen).toString('utf8'));
  const off = 20 + jlen;
  const bin = off + 8 <= b.length ? b.subarray(off + 8, off + 8 + b.readUInt32LE(off)) : Buffer.alloc(0);
  return { json, bin };
}

function writeGlb(file, json, blob) {
  let js = Buffer.from(JSON.stringify(json));
  if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - js.length % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + blob.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  bh.writeUInt32LE(blob.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, blob]));
}

const clone = o => JSON.parse(JSON.stringify(o));
const TEX = path.join(OUT, 'tex');
const texturasGravadas = new Set();
let texBytes = 0;
/** Writes a texture once by content hash; returns its file name. */
function guardarTextura(buf, mime) {
  const ext = /jpe?g/i.test(mime || '') ? 'jpg' : /webp/i.test(mime || '') ? 'webp' : /ktx2/i.test(mime || '') ? 'ktx2' : 'png';
  const nome = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20) + '.' + ext;
  if (!texturasGravadas.has(nome)) { texturasGravadas.add(nome); fs.writeFileSync(path.join(TEX, nome), buf); texBytes += buf.length; }
  return nome;
}

/** One prefab (node index `lib` of `src`) as a standalone GLB: { json, blob }. */
function extrair(src, bin, lib) {
  const out = { asset: { version: '2.0', generator: 'tools/build_prefab_library.mjs' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Mapa', children: [] }], meshes: [], accessors: [], bufferViews: [], materials: [], textures: [], images: [], samplers: [] };
  const partes = [];
  let tam = 0;
  const remap = {};
  const take = (kind, i, build) => {
    const m = remap[kind] || (remap[kind] = new Map());
    if (!m.has(i)) { m.set(i, out[kind].length); out[kind].push(null); out[kind][m.get(i)] = build(i); }
    return m.get(i);
  };
  const bview = i => {
    const bv = clone(src.bufferViews[i]);
    const start = bv.byteOffset || 0;
    const pad = (4 - tam % 4) % 4;
    if (pad) { partes.push(Buffer.alloc(pad)); tam += pad; }
    bv.byteOffset = tam; bv.buffer = 0;
    partes.push(bin.subarray(start, start + bv.byteLength)); tam += bv.byteLength;
    return bv;
  };
  const accessor = i => {
    const a = clone(src.accessors[i]);
    if (a.bufferView != null) a.bufferView = take('bufferViews', a.bufferView, bview);
    if (a.sparse) {
      a.sparse.indices.bufferView = take('bufferViews', a.sparse.indices.bufferView, bview);
      a.sparse.values.bufferView = take('bufferViews', a.sparse.values.bufferView, bview);
    }
    return a;
  };
  /* Images go to scenery/lib/tex/<sha1>.<ext>, shared by every prefab that uses them (the same grass or brick texture sits in dozens
     of prefabs: embedded, the library was 290 MB). The ground mask stays embedded: index.html reads its raw PNG bytes from the
     bufferView (mascaraCrua, the Safari premultiplied-alpha fix). */
  const mascaras = new Set();
  const image = i => {
    const im = clone(src.images[i]);
    if (im.bufferView == null) return im;
    if (mascaras.has(i)) { im.bufferView = take('bufferViews', im.bufferView, bview); return im; }
    const bv = src.bufferViews[im.bufferView], start = bv.byteOffset || 0;
    im.uri = 'tex/' + guardarTextura(bin.subarray(start, start + bv.byteLength), im.mimeType);
    delete im.bufferView; delete im.mimeType;
    return im;
  };
  const texture = i => {
    const t = clone(src.textures[i]);
    if (t.source != null) t.source = take('images', t.source, image);
    if (t.sampler != null) t.sampler = take('samplers', t.sampler, s => clone(src.samplers[s]));
    return t;
  };
  const texInfo = ti => { if (ti && ti.index != null) ti.index = take('textures', ti.index, texture); };
  const material = i => {
    const m = clone(src.materials[i]);
    const gb = m.extras?.groundBlend4;                                    // the game's ground shader: texture indices live in extras
    const tm = gb && src.textures?.[gb.mask]; if (tm?.source != null) mascaras.add(tm.source);   // before baseColor: it may be the mask too
    const pbr = m.pbrMetallicRoughness || {};
    texInfo(pbr.baseColorTexture); texInfo(pbr.metallicRoughnessTexture);
    texInfo(m.normalTexture); texInfo(m.occlusionTexture); texInfo(m.emissiveTexture);
    if (gb) {
      if (gb.mask != null) gb.mask = take('textures', gb.mask, texture);
      for (const c of gb.camadas || []) if (c.tex != null) c.tex = take('textures', c.tex, texture);
    }
    return m;
  };
  const mesh = i => {
    const me = clone(src.meshes[i]);
    for (const p of me.primitives) {
      p.attributes = Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, take('accessors', v, accessor)]));
      if (p.indices != null) p.indices = take('accessors', p.indices, accessor);
      if (p.material != null) p.material = take('materials', p.material, material);
      if (p.targets) p.targets = p.targets.map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, take('accessors', v, accessor)])));
    }
    return me;
  };
  const copiar = i => {
    const n = clone(src.nodes[i]);
    delete n.skin; delete n.camera;
    if (n.mesh != null) n.mesh = take('meshes', n.mesh, mesh);
    const kids = n.children || [];
    delete n.children;
    const idx = out.nodes.length;
    out.nodes.push(n);
    if (kids.length) n.children = kids.map(copiar);
    return idx;
  };
  out.nodes[0].children.push(copiar(lib));
  for (const k of ['meshes', 'accessors', 'bufferViews', 'materials', 'textures', 'images', 'samplers']) if (!out[k].length) delete out[k];
  const texto = JSON.stringify(out);                                       // an extension stays declared only if something copied uses it
  const ext = (src.extensionsUsed || []).filter(e => texto.includes('"' + e + '"'));
  if (ext.length) out.extensionsUsed = ext;
  const req = (src.extensionsRequired || []).filter(e => ext.includes(e));
  if (req.length) out.extensionsRequired = req;
  const pad = (4 - tam % 4) % 4; if (pad) { partes.push(Buffer.alloc(pad)); tam += pad; }
  out.buffers = [{ byteLength: tam }];
  return { json: out, blob: Buffer.concat(partes) };
}

// kanto first (the biggest, most complete library), then everything else in name order
const arquivos = [];
for (const d of DIRS) { try { for (const f of fs.readdirSync(d)) if (f.endsWith('.glb')) arquivos.push(path.join(d, f)); } catch {} }
arquivos.sort((a, b) => (path.basename(b) === 'kanto.glb') - (path.basename(a) === 'kanto.glb') || path.basename(a).localeCompare(path.basename(b)));
/* Extra sources, last (lowest priority): GLBs outside the map folders that carry prefabs no map has yet, e.g. PokeFable's
   cenario/habitat.glb with the plot and guild-base buildings (Nov 7). PREFAB_EXTRA=path1.glb:path2.glb node tools/build_prefab_library.mjs */
for (const f of String(process.env.PREFAB_EXTRA || '').split(':').filter(Boolean)) arquivos.push(path.resolve(f));

fs.rmSync(OUT, { recursive: true, force: true });                         // rebuild from scratch: no orphans
fs.mkdirSync(TEX, { recursive: true });
const indice = {}, arquivosUsados = new Set();
let total = 0, mapas = 0;
for (const arq of arquivos) {
  let g;
  try { g = readGlb(arq); } catch (e) { console.warn('skip (unreadable):', path.relative(ROOT, arq), e.message); continue; }
  if (!g) { console.warn('skip (not a GLB):', path.relative(ROOT, arq)); continue; }
  const { json: src, bin } = g;
  const mapa = (src.nodes || []).findIndex(n => n.name === 'Mapa');
  if (mapa < 0) continue;
  const libs = (src.nodes[mapa].children || []).filter(i => /^lib/i.test(src.nodes[i].name || ''));
  if (!libs.length) continue;                                            // assembled map (pallet_route1): no prefab library
  mapas++;
  const de = path.basename(arq, '.glb');
  for (const i of libs) {
    const nome = src.nodes[i].name.replace(/^lib:?/i, '');
    const k = chaveNome(src.nodes[i].name);
    if (!k || indice[k]) continue;
    let base = k.replace(/[^a-z0-9_-]/g, '_').slice(0, 90) || 'prefab', file = base + '.glb', n = 2;
    while (arquivosUsados.has(file)) file = base + '_' + n++ + '.glb';
    arquivosUsados.add(file);
    const { json, blob } = extrair(src, bin, i);
    writeGlb(path.join(OUT, file), json, blob);
    const kb = Math.ceil((blob.length + 2000) / 1024);
    total += kb;
    indice[k] = { n: nome, f: file, de, kb };
  }
}
const ordenado = Object.fromEntries(Object.keys(indice).sort().map(k => [k, indice[k]]));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ gerado: new Date().toISOString(), prefabs: ordenado }));
console.log(`prefab library: ${Object.keys(indice).length} prefabs from ${mapas} maps, ~${(total / 1024).toFixed(1)} MB of meshes + ${texturasGravadas.size} shared textures (${(texBytes / 1048576).toFixed(1)} MB) → ${path.relative(ROOT, OUT)}`);
