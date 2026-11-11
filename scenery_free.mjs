/* FREE SCENERY (Nov 8) — shared by the game (the module inside index.html) and the new 3D editor (/admin/scenery2).
 *
 * Three things the legacy pipeline could not do:
 *  1. FREE TRANSFORM. A placement may carry rotation (rx / r / rz, degrees, Euler XYZ in world, r = Y — the fields the old editor
 *     already wrote) and scale (sx / sy / sz, 1 = omitted). World matrix = T(flipX·x, y, z) · R · S · prefab-local.
 *  2. PRECISE COLLISION. The legacy grid turns every prop into whole 1 m cells from its unrotated box. A "free" placement (one with
 *     rotation, scale or an explicit `col`) skips that grid and goes here instead:
 *       col 'caixa'  the prefab box, rotated/scaled, as a convex footprint (default for a rotated/scaled prop)
 *       col 'malha'  the real triangles: steep ones become wall segments, so arches, fences and L-shaped houses block exactly
 *       col 'nada'   no collision at all
 *     `pi` (walkable) = its upward-facing triangles are floor (ramps, platforms, scaled ground tiles). Floor-named prefabs default to it.
 *     Everything is tested against the body band [floor + PASSO, floor + ALTURA], so a low step or a ceiling never blocks.
 *  3. PATHS. `dados.caminhos` = [{ pts:[[x,y,z]…] (file coords), w, est, irr, pi, f }] — smooth irregular ribbons (Catmull-Rom),
 *     soft faded edges, procedural textures, following the floor. Not tiles: they go anywhere at any angle.
 */
import * as THREE from 'three';
import { semRepeticao } from './ground_tiling.mjs';

export const PASSO = 0.4;        // obstacles lower than this above the floor are stepped over
export const ALTURA = 1.7;       // body height: anything wholly above floor + this is a ceiling, not a wall
const G2R = Math.PI / 180;
const num = (v, d = 0) => { const n = +v; return Number.isFinite(n) ? n : d; };

// ── transform ─────────────────────────────────────────────────────────────────
export const escalaDe = o => ({ x: num(o?.sx, 1) || 1, y: num(o?.sy, 1) || 1, z: num(o?.sz, 1) || 1 });
export const temRotacao = o => !!(num(o?.rx) || num(o?.r) || num(o?.rz));
export const temEscala = o => { const s = escalaDe(o); return s.x !== 1 || s.y !== 1 || s.z !== 1; };
/** A placement that leaves the legacy 1 m grid. Escalators keep the old rule (they rotate, but their collision was tuned as is). */
export const ehLivre = o => !!o && (o.col != null || o.pi != null || temEscala(o) || (temRotacao(o) && !/escalator/i.test(String(o.n || ''))));
const _E = new THREE.Euler(), _Q = new THREE.Quaternion(), _P = new THREE.Vector3(), _S = new THREE.Vector3();
/** T · R · S of a placement (no prefab-local part), written into `out`. */
export function matrizColocacao(o, flipX = -1, out = new THREE.Matrix4()) {
  _P.set(flipX * num(o.x), num(o.y), num(o.z));
  _Q.setFromEuler(_E.set(num(o.rx) * G2R, num(o.r) * G2R, num(o.rz) * G2R, 'XYZ'));
  const s = escalaDe(o); _S.set(s.x, s.y, s.z);
  return out.compose(_P, _Q, _S);
}

// ── precise collision ─────────────────────────────────────────────────────────
/** Collision mode the game uses for a free placement. `info` = { piso, agua, atravessa } from the legacy name rules. */
export function modoColisao(o, info = {}) {
  if (o.col === 'caixa' || o.col === 'malha' || o.col === 'nada') return o.col;
  return info.piso || info.agua || info.atravessa ? 'nada' : 'caixa';
}
export const ehAndavel = (o, info = {}) => o.pi != null ? !!+o.pi : !!info.piso && !info.agua;

function cascaConvexa(pts) {   // monotone chain, pts = [[x,z]…]
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  hi.pop(); lo.pop(); return lo.concat(hi);
}
function distSeg2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 > 1e-12 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - px, ez = az + dz * t - pz; return ex * ex + ez * ez;
}
function dentroConvexo(px, pz, h) {   // h counter-clockwise
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) if ((h[i][0] - h[j][0]) * (pz - h[j][1]) - (h[i][1] - h[j][1]) * (px - h[j][0]) < 0) return false;
  return true;
}
const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], _M = new THREE.Matrix4(), _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
/** Calls fn(a, b, c) with the world triangles of `partes` ([{geo, local}]) under placement matrix `M0`. */
export function cadaTriangulo(partes, M0, fn) {
  for (const pt of partes) {
    const pos = pt.geo?.attributes?.position; if (!pos) continue;
    _M.multiplyMatrices(M0, pt.local);
    const idx = pt.geo.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < n; i += 3) {
      for (let k = 0; k < 3; k++) _v[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(_M);
      fn(_v[0], _v[1], _v[2]);
    }
  }
}
/** Box (local, prefab space) of [{geo, local}]. */
export function caixaLocal(partes) {
  const cx = new THREE.Box3(), b = new THREE.Box3();
  for (const pt of partes) { if (!pt.geo.boundingBox) pt.geo.computeBoundingBox(); b.copy(pt.geo.boundingBox).applyMatrix4(pt.local); cx.union(b); }
  return cx;
}

/** Spatial hash of precise colliders. One per scene. */
export function criarColisao({ celula = 2 } = {}) {
  const C = celula, chave = (i, j) => (i + 50000) * 100000 + (j + 50000);
  const formas = [];               // { t:'casca', h:[[x,z]…], y0, y1 } | { t:'seg', a:[x,z], b:[x,z], y0, y1 }
  const pisos = [];                // [ax,ay,az, bx,by,bz, cx,cy,cz]
  const hF = new Map(), hP = new Map();
  const vaos = [];                 // door gaps: [x, z, r] where precise colliders never block (the door trigger must stay reachable)
  const inserir = (h, item, x0, z0, x1, z1) => {
    const i0 = Math.floor(x0 / C), i1 = Math.floor(x1 / C), j0 = Math.floor(z0 / C), j1 = Math.floor(z1 / C);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) return;                     // a 400 m collider is a mistake, not a wall
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = chave(i, j); let l = h.get(k); if (!l) h.set(k, l = []); l.push(item); }
  };
  const addForma = f => {
    formas.push(f);
    if (f.t === 'casca') { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of f.h) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } inserir(hF, f, x0, z0, x1, z1); }
    else inserir(hF, f, Math.min(f.a[0], f.b[0]), Math.min(f.a[1], f.b[1]), Math.max(f.a[0], f.b[0]), Math.max(f.a[1], f.b[1]));
  };
  const addPiso = (a, b, c) => {
    const t = [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z];
    if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) < 1e-6) return;   // degenerate in XZ
    pisos.push(t);
    inserir(hP, t, Math.min(a.x, b.x, c.x), Math.min(a.z, b.z, c.z), Math.max(a.x, b.x, c.x), Math.max(a.z, b.z, c.z));
  };
  return {
    formas, pisos,
    get vazio() { return !formas.length && !pisos.length; },
    /** A door gap (the game's abrirVao): precise colliders do not block within r of (x,z). */
    liberar(x, z, r = 1.5) { vaos.push([x, z, r]); },
    get temPiso() { return pisos.length > 0; },
    /** One free placement. partes = [{geo, local}], M = matrizColocacao(o). modo: 'caixa'|'malha'|'nada'; andavel: floors. */
    adicionar(partes, M, modo, andavel) {
      if (modo === 'caixa') {
        const b = caixaLocal(partes); if (b.isEmpty()) return;
        const pts = [], v = new THREE.Vector3(); let y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < 8; i++) { v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(M); pts.push([v.x, v.z]); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
        const h = cascaConvexa(pts); if (h.length >= 3) addForma({ t: 'casca', h, y0, y1 });
      }
      if (modo !== 'malha' && !andavel) return;
      cadaTriangulo(partes, M, (a, b, c) => {
        _n.crossVectors(_e1.subVectors(b, a), _e2.subVectors(c, a)); const L = _n.length(); if (L < 1e-9) return;
        const ny = _n.y / L;
        if (andavel && ny > 0.6) { addPiso(a, b, c); return; }
        if (modo !== 'malha' || Math.abs(ny) >= 0.75) return;               // flat-ish faces (roof, ceiling, table top) never block by themselves
        const y0 = Math.min(a.y, b.y, c.y), y1 = Math.max(a.y, b.y, c.y);
        for (const [p, q] of [[a, b], [b, c], [c, a]]) if (Math.abs(p.x - q.x) + Math.abs(p.z - q.z) > 1e-4) addForma({ t: 'seg', a: [p.x, p.z], b: [q.x, q.z], y0, y1 });
      });
    },
    /** Floor triangles of a mesh already in world space (paths). */
    adicionarPisoMalha(geo, M = null) { cadaTriangulo([{ geo, local: new THREE.Matrix4() }], M || new THREE.Matrix4(), (a, b, c) => addPiso(a, b, c)); },
    /** Does a body of radius r standing at (x,z) on floor height `chao` touch a precise collider? */
    bloqueia(x, z, chao, r = 0.28) {
      if (!formas.length) return false;
      for (const [vx, vz, vr] of vaos) if ((x - vx) * (x - vx) + (z - vz) * (z - vz) < vr * vr) return false;
      const lo = (chao ?? 0) + PASSO, hi = (chao ?? 0) + ALTURA, r2 = r * r, vistos = new Set();
      for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
        const l = hF.get(chave(i, j)); if (!l) continue;
        for (const f of l) {
          if (vistos.has(f)) continue; vistos.add(f);
          if (f.y1 < lo || f.y0 > hi) continue;
          if (f.t === 'seg') { if (distSeg2(x, z, f.a[0], f.a[1], f.b[0], f.b[1]) < r2) return true; continue; }
          if (dentroConvexo(x, z, f.h)) return true;
          for (let a = 0, b = f.h.length - 1; a < f.h.length; b = a++) if (distSeg2(x, z, f.h[b][0], f.h[b][1], f.h[a][0], f.h[a][1]) < r2) return true;
        }
      }
      return false;
    },
    /** Highest walkable precise surface at (x,z), or null. */
    chao(x, z) {
      if (!pisos.length) return null;
      const l = hP.get(chave(Math.floor(x / C), Math.floor(z / C))); if (!l) return null;
      let melhor = null;
      for (const t of l) {
        const [ax, ay, az, bx, by, bz, cx, cy, cz] = t;
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
        if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
        const y = u * ay + v * by + w * cy;
        if (melhor === null || y > melhor) melhor = y;
      }
      return melhor;
    },
  };
}

// ── paths ─────────────────────────────────────────────────────────────────────
export const ESTILOS = {
  terra:    { nome: 'Dirt',        base: [139, 108, 72],  var: 28, pedrinhas: 0.5, cor2: [112, 86, 58] },
  areia:    { nome: 'Sand',        base: [214, 192, 146], var: 16, pedrinhas: 0.15, cor2: [196, 172, 124] },
  pedra:    { nome: 'Cobblestone', base: [128, 126, 120], var: 18, pedras: true,    cor2: [92, 90, 86] },
  cascalho: { nome: 'Gravel',      base: [150, 146, 138], var: 34, pedrinhas: 1.6,  cor2: [104, 100, 94] },
  grama:    { nome: 'Worn grass',  base: [106, 128, 64],  var: 22, pedrinhas: 0.1,  cor2: [128, 116, 70] },
  lama:     { nome: 'Mud',         base: [92, 72, 52],    var: 14, pedrinhas: 0.2,  cor2: [70, 54, 40] },
};
function aleatorio(seed) { let s = (seed >>> 0) || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296); }
const texturas = new Map();
/* Path textures (Nov 10): 512 px covering METROS_CAMINHO m of ground in WORLD space (ground_tiling.mjs), ≈128 px/m — sharper than the
   old 256 px per 2.5 m — and the anti-tiling shader hides the repeat. Sizes below were tuned for 256 px / 2.5 m: K scales lengths
   (px per old px), K2 the counts (area). */
export const METROS_CAMINHO = 4;
const N_CAMINHO = 512, K = N_CAMINHO / METROS_CAMINHO / (256 / 2.5), K2 = (METROS_CAMINHO / 2.5) ** 2;
/** Procedural tiling texture of a path style (cached). Works in the game and in the editor (needs a DOM canvas). */
export function texturaCaminho(est) {
  est = ESTILOS[est] ? est : 'terra';
  if (texturas.has(est)) return texturas.get(est);
  const E = ESTILOS[est], N = N_CAMINHO, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), rnd = aleatorio(est.length * 7919 + est.charCodeAt(0));
  const rgb = (c, k = 0) => `rgb(${c.map(v => Math.max(0, Math.min(255, v + k)) | 0).join(',')})`;
  g.fillStyle = rgb(E.base); g.fillRect(0, 0, N, N);
  const mancha = (x, y, r, cor, a) => {   // wrap-around blob, so the texture tiles
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, cor.replace('rgb', 'rgba').replace(')', ',' + a + ')')); gr.addColorStop(1, cor.replace('rgb', 'rgba').replace(')', ',0)'));
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  };
  for (let i = 0; i < Math.round(70 * K2); i++) mancha(rnd() * N, rnd() * N, (18 + rnd() * 50) * K, rgb(rnd() < 0.5 ? E.cor2 : E.base, (rnd() - 0.5) * E.var * 2), 0.35);
  if (E.pedras) {
    const cel = N / Math.round(N / (32 * K));                                   // a whole number of stones per row, so it tiles
    for (let cy = 0; cy < N / cel; cy++) for (let cx = 0; cx < N / cel; cx++) {
      const x = cx * cel + (cy % 2 ? cel / 2 : 0) + (rnd() - 0.5) * 6 * K, y = cy * cel + (rnd() - 0.5) * 6 * K, w = cel * (0.78 + rnd() * 0.12), h = cel * (0.74 + rnd() * 0.14);
      for (const dx of [-N, 0, N]) {
        g.fillStyle = rgb(E.cor2, -18); g.beginPath(); g.ellipse(x + dx + 1, y + 2, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgb(E.base, (rnd() - 0.5) * E.var * 2); g.beginPath(); g.ellipse(x + dx, y, w / 2 - 1, h / 2 - 1, (rnd() - 0.5) * 0.4, 0, Math.PI * 2); g.fill();
      }
    }
  }
  const nPed = Math.round((E.pedrinhas || 0) * 900 * K2);
  for (let i = 0; i < nPed; i++) { const x = rnd() * N, y = rnd() * N, r = (0.6 + rnd() * 2.2) * K; g.fillStyle = rgb(rnd() < 0.5 ? E.cor2 : E.base, (rnd() - 0.3) * E.var * 2.5); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  for (let i = 0, nGrao = Math.round(9000 * K2 * K * K); i < nGrao; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + rnd() * 0.05})`; g.fillRect(rnd() * N, rnd() * N, 1, 1); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texturas.set(est, t); return t;
}
/** Sanitized path (also what the server keeps). */
export function limparCaminho(c) {
  const pts = (Array.isArray(c?.pts) ? c.pts : []).slice(0, 2000).map(p => Array.isArray(p) ? p.slice(0, 3).map(v => +num(v).toFixed(3)) : null).filter(p => p && p.length === 3);
  if (pts.length < 2) return null;
  const r = { pts, w: +Math.min(40, Math.max(0.2, num(c.w, 2))).toFixed(2), est: ESTILOS[c.est] ? c.est : 'terra', irr: +Math.min(1, Math.max(0, num(c.irr, 0.35))).toFixed(2) };
  if (+c.pi) r.pi = 1;
  if (+c.f && pts.length >= 3) r.f = 1;
  if (c.nome) r.nome = String(c.nome).replace(/[^\w .\-À-ú]/g, '').slice(0, 40);
  return r;
}
function ruido1(t, seed) {   // smooth 1D value noise, -1..1
  const h = i => { let s = Math.imul((i | 0) ^ seed, 0x27d4eb2d); s ^= s >>> 15; s = Math.imul(s, 0x85ebca6b); s ^= s >>> 13; return ((s >>> 0) / 4294967296) * 2 - 1; };
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}
const COLUNAS = [[0, 0], [0.1, 0.75], [0.3, 1], [0.7, 1], [0.9, 0.75], [1, 0]];   // across the ribbon: [u, alpha]
/** Ribbon mesh of a path. alturaEm(xWorld, zWorld, yGuess) → floor y or null (null/far = keep the curve's own height). */
export function construirCaminho(c, { flipX = -1, alturaEm = null, seed = 1, passo = 0.4 } = {}) {
  const pts = c.pts.map(p => new THREE.Vector3(flipX * p[0], p[1], p[2]));
  const curva = new THREE.CatmullRomCurve3(pts, !!c.f, 'centripetal', 0.5);
  const L = curva.getLength(), n = Math.max(2, Math.ceil(L / passo)), w = c.w || 2, irr = c.irr ?? 0.35, seedL = seed * 977 + 13, seedR = seed * 613 + 71;
  const pos = [], uv = [], cor = [], idx = [], P = new THREE.Vector3(), T = new THREE.Vector3();
  const nc = COLUNAS.length, fim = c.f ? n : n + 1;
  for (let i = 0; i < fim; i++) {
    const s = i / n, d = s * L;
    curva.getPointAt(s, P); curva.getTangentAt(s, T);
    const tx = T.x, tz = T.z, tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl;
    const freq = 0.45;
    const meiaE = w / 2 * (1 + irr * 0.55 * ruido1(d * freq, seedL) + irr * 0.2 * ruido1(d * freq * 3.1, seedL + 5));
    const meiaD = w / 2 * (1 + irr * 0.55 * ruido1(d * freq, seedR) + irr * 0.2 * ruido1(d * freq * 3.1, seedR + 5));
    const desvio = irr * w * 0.08 * ruido1(d * 0.2, seed + 99);           // the whole ribbon wanders a little
    const ponta = c.f ? 1 : Math.min(1, d / Math.min(1.2, w * 0.6), (L - d) / Math.min(1.2, w * 0.6));   // ends fade out
    for (const [u, a] of COLUNAS) {
      const off = (u - 0.5) * 2, lado = off < 0 ? meiaE : meiaD, k = off * lado + desvio;
      const x = P.x + nx * k, z = P.z + nz * k;
      let y = P.y;
      if (alturaEm) { const h = alturaEm(x, z, P.y); if (h != null && Math.abs(h - P.y) < 1.2) y = h; }
      pos.push(x, y + 0.035, z); uv.push(u * w / 2.5, d / 2.5); cor.push(1, 1, 1, a * Math.max(0, ponta));
    }
  }
  const linhas = c.f ? n : n;
  for (let i = 0; i < linhas; i++) {
    const a = i * nc, b = ((i + 1) % (c.f ? n : n + 1)) * nc;
    for (let k = 0; k < nc - 1; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // winding: the ribbon must face up
  if (geo.attributes.normal.count && geo.attributes.normal.getY(nc + 2) < 0) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } geo.computeVertexNormals(); }
  const mat = semRepeticao(new THREE.MeshStandardMaterial({ map: texturaCaminho(c.est), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { metros: METROS_CAMINHO, macro: 0.5 });   // world-space, no visible tiling
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2; m.receiveShadow = true; m.name = 'caminho';
  return m;
}
