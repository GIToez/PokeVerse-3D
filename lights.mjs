/* Night-only lamp glow: placeable prop/lamppost plus the existing Kanto streetlights. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BRILHO_ACENDE = 0.9, BRILHO_NOITE = 0.3;
const MAX_LUZ = 16;
const EH_POSTE = /streetlight|lamppost/i;
const CABECA = {
  'prop/lamppost': 3.13,
  'sm_t_007_streetlight_01': 4.15,
  'sm_c_001_streetlight_01': 3.95,
  'sm_c_001_streetlight_01_g_2': 3.95,
};

export function fatorNoite(ceu){
  const b = ceu && Number.isFinite(ceu.brilho) ? ceu.brilho : 1;
  return Math.max(0, Math.min(1, (BRILHO_ACENDE - b) / (BRILHO_ACENDE - BRILHO_NOITE)));
}

function haloMat(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,244,208,.95)');
  grd.addColorStop(0.35, 'rgba(255,220,140,.35)');
  grd.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
}

function ehVidro(mesh, mat){
  return /glass/i.test(mesh.name || '') || /glass/i.test(mat.name || '');
}

function prepararVidro(mat){
  mat.transparent = true;
  mat.opacity = mat.opacity > 0 && mat.opacity < 1 ? mat.opacity : 0.58;
  mat.depthWrite = false;
  mat.side = THREE.DoubleSide;
  if (!mat.emissive) mat.emissive = new THREE.Color(0xffe7a0);
  else if (mat.emissive.getHex() === 0) mat.emissive.setHex(0xffe7a0);
  if (!(mat.emissiveIntensity > 0)) mat.emissiveIntensity = 0.08;
  mat.needsUpdate = true;
  return mat;
}

export async function ligar({ cena, dados, flipX = -1, chaoEm = null, bloqueio = null }){
  const list = [...(dados?.areaEnv || []), ...(dados?.ambiente || []), ...(dados?.objetos || [])]
    .filter(o => EH_POSTE.test(o.n || ''));
  const grupo = new THREE.Group(); grupo.name = 'luzes-postes';
  let proto = null;
  try {
    proto = (await new GLTFLoader().loadAsync('./scenery/prop/lamppost.glb')).scene;
  } catch (e){ console.warn('lamppost glb:', e); }
  const haloM = haloMat();
  const posts = [];
  const jaDesenhou = new Set();
  cena.traverse(o => {
    if (!o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh) return;
    if (/lamppost/i.test(o.name || '')) jaDesenhou.add(o);
  });
  const bibJaTem = jaDesenhou.size > 0;
  for (const o of list){
    const x = flipX * o.x, z = o.z;
    const yChao = chaoEm?.(x, z);
    const y = yChao != null ? yChao : (+o.y || 0);
    const cabeca = CABECA[o.n] || 3.9;
    const glass = [];
    if (/lamppost/i.test(o.n) && proto && !bibJaTem){
      const clone = proto.clone(true);
      clone.position.set(x, y, z);
      clone.traverse(m => {
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const k of mats) if (ehVidro(m, k)) glass.push(prepararVidro(k));
        m.castShadow = /post/i.test(m.name);
      });
      grupo.add(clone);
      if (bloqueio) bloqueio.add(Math.floor(x) + ',' + Math.floor(z));
    }
    const spr = new THREE.Sprite(haloM.clone());
    spr.scale.set(7.2, 7.2, 1);
    spr.position.set(x, y + cabeca, z);
    spr.visible = false;
    grupo.add(spr);
    posts.push({ x, y: y + cabeca, z, glass, halo: spr });
  }
  if (bibJaTem){
    const seen = new Set();
    cena.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const k of mats){
        if (!k || seen.has(k) || !ehVidro(o, k)) continue;
        seen.add(k);
        prepararVidro(k);
        for (const p of posts) p.glass.push(k);
      }
    });
  }
  cena.add(grupo);
  const luzes = [];
  for (let i = 0; i < MAX_LUZ; i++){
    const L = new THREE.PointLight(0xfff6d8, 0, 44, 1.05);
    L.castShadow = false;
    cena.add(L);
    luzes.push(L);
  }
  return {
    n: posts.length,
    quadro(_dt, ash, ceu){
      const n = fatorNoite(ceu);
      const aceso = n > 0.04;
      for (const p of posts){
        for (const m of p.glass){ m.emissiveIntensity = 0.2 + n * 6.2; m.needsUpdate = true; }
        p.halo.visible = aceso;
        p.halo.material.opacity = 0.95 * n;
      }
      const ax = ash?.x ?? ash?.vx ?? 0, az = ash?.z ?? ash?.vz ?? 0;
      const near = posts.length <= MAX_LUZ ? posts
        : posts.map(p => ({ p, d: (p.x - ax) ** 2 + (p.z - az) ** 2 })).sort((a, b) => a.d - b.d).slice(0, MAX_LUZ).map(x => x.p);
      for (let i = 0; i < luzes.length; i++){
        const p = near[i], L = luzes[i];
        if (!p || !aceso){ L.intensity = 0; continue; }
        L.position.set(p.x, p.y, p.z);
        L.intensity = 16 * n;
      }
    },
  };
}
