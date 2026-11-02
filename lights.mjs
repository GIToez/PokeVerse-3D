/* Night-only lamp glow: placeable prop/lamppost plus the existing Kanto streetlights. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EH_FOGO, EH_MALHA_FOGO } from './fire.mjs';

const BRILHO_ACENDE = 0.9, BRILHO_NOITE = 0.4;
const _fogoP = new THREE.Vector3();
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

/** Species that throw their own light (flame tail, lava body, etc.). */
export const LUZ_MON = {
  4: { cor: 0xff6a1c, i: 3.6, r: 5.2, y: 0.52 },
  5: { cor: 0xff7024, i: 4.4, r: 6.2, y: 0.72 },
  6: { cor: 0xff7a30, i: 5.6, r: 7.8, y: 1.05 },
  37: { cor: 0xff8a28, i: 2.8, r: 4.4, y: 0.4 },
  38: { cor: 0xffb040, i: 4.2, r: 6.4, y: 0.55 },
  58: { cor: 0xff8020, i: 3.2, r: 5.0, y: 0.45 },
  59: { cor: 0xff9028, i: 4.8, r: 7.0, y: 0.7 },
  77: { cor: 0xff8822, i: 3.8, r: 5.6, y: 0.7 },
  78: { cor: 0xff9028, i: 4.8, r: 6.8, y: 0.9 },
  126: { cor: 0xff5010, i: 4.6, r: 6.4, y: 0.75 },
  136: { cor: 0xff7018, i: 3.4, r: 5.0, y: 0.45 },
  146: { cor: 0xffb030, i: 6.2, r: 9.0, y: 1.2 },
  155: { cor: 0xff7a22, i: 3.2, r: 4.8, y: 0.38 },
  156: { cor: 0xff8028, i: 4.0, r: 6.0, y: 0.55 },
  157: { cor: 0xff8a30, i: 5.2, r: 7.4, y: 0.85 },
  244: { cor: 0xff6a18, i: 5.8, r: 8.2, y: 0.95 },
};

function dexDe(e){
  if (e?.dex) return e.dex;
  const m = String(e?.glb || '').match(/pm(\d{4})/);
  return m ? +m[1] : 0;
}

function posMon(e){
  const p = e?.pivo?.position;
  return {
    x: e?.vx ?? e?.x ?? p?.x ?? 0,
    y: e?.vy ?? e?.y ?? p?.y ?? 0,
    z: e?.vz ?? e?.z ?? p?.z ?? 0,
  };
}

function acharFogo(e){
  if (e._luzFogo && e._luzFogo.parent) return e._luzFogo;
  const raiz = e.pivo || e.corpo;
  if (!raiz?.traverse) return null;
  let core = null, any = null;
  raiz.traverse(o => {
    if (!o.isMesh || (core && any)) return;
    const nome = o.name || '';
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const fogo = EH_MALHA_FOGO.test(nome) || mats.some(m => EH_FOGO.test(m?.name || ''));
    if (!fogo) return;
    if (!any) any = o;
    if (/core/i.test(nome) || mats.some(m => /core/i.test(m?.name || ''))) core = o;
  });
  e._luzFogo = core || any || null;
  return e._luzFogo;
}

function glowTex(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,244,208,.95)');
  grd.addColorStop(0.35, 'rgba(255,220,140,.45)');
  grd.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function haloMat(tex){
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 });
}

function lampadaMat(){
  return new THREE.MeshBasicMaterial({ color: 0xffe29a, transparent: true, opacity: 0, depthWrite: false });
}

function chaoMat(tex){
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
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

export async function ligar({ cena, dados, flipX = -1, chaoEm = null, bloqueio = null, soMons = false }){
  const list = soMons ? [] : [...(dados?.areaEnv || []), ...(dados?.ambiente || []), ...(dados?.objetos || [])]
    .filter(o => EH_POSTE.test(o.n || ''));
  const grupo = new THREE.Group(); grupo.name = 'luzes-postes';
  let proto = null;
  if (!soMons) try {
    proto = (await new GLTFLoader().loadAsync('./scenery/prop/lamppost.glb')).scene;
  } catch (e){ console.warn('lamppost glb:', e); }
  const tex = glowTex();
  const posts = [];
  const jaTem = (x, z) => posts.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 2.2);
  const addGlow = (x, y, z, glass) => {
    const halo = new THREE.Sprite(haloMat(tex));
    halo.scale.set(3.4, 3.4, 1);
    halo.position.set(x, y + 0.08, z);
    halo.visible = false;
    const lampada = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), lampadaMat());
    lampada.position.set(x, y, z);
    lampada.visible = false;
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), chaoMat(tex));
    chao.rotation.x = -Math.PI / 2;
    chao.scale.set(5.6, 5.6, 1);
    chao.position.set(x, (chaoEm?.(x, z) ?? (y - 3.1)) + 0.05, z);
    chao.visible = false;
    grupo.add(halo, lampada, chao);
    posts.push({ x, y, z, glass, halo, lampada, chao });
  };
  const jaDesenhou = new Set();
  if (!soMons) cena.traverse(o => {
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
    addGlow(x, y + cabeca, z, glass);
  }
  if (!soMons) cena.traverse(o => {
    if (!/lamppost/i.test(o.name || '')) return;
    if (o.parent && /lamppost/i.test(o.parent.name || '')) return;
    const wp = new THREE.Vector3();
    o.getWorldPosition(wp);
    if (jaTem(wp.x, wp.z)) return;
    const glass = [];
    o.traverse(m => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const k of mats) if (k && ehVidro(m, k)) glass.push(prepararVidro(k));
    });
    addGlow(wp.x, wp.y + 3.13, wp.z, glass);
  });
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
  const cabecas = [];
  if (!soMons) for (let i = 0; i < MAX_LUZ; i++){
    const L = new THREE.SpotLight(0xfff1c4, 0, 26, 1.22, 0.62, 1.05);
    L.castShadow = false;
    L.shadow.mapSize.set(512, 512);
    L.shadow.camera.near = 0.35;
    L.shadow.camera.far = 24;
    L.shadow.bias = -0.0009;
    L.shadow.normalBias = 0.035;
    const H = new THREE.PointLight(0xffe7a8, 0, 3.4, 1.6);
    H.castShadow = false;
    cena.add(L, L.target, H);
    luzes.push(L);
    cabecas.push(H);
  }
  const monLuz = [];
  for (let i = 0; i < 8; i++){
    const M = new THREE.PointLight(0xff6a1c, 0, 5.2, 1.35);
    M.castShadow = false;
    cena.add(M);
    monLuz.push(M);
  }
  return {
    n: posts.length,
    quadro(_dt, ash, ceu, mons = []){
      const n = fatorNoite(ceu);
      const aceso = n > 0.04;
      for (const p of posts){
        for (const m of p.glass){ m.emissiveIntensity = 0.35 + n * 4.2; m.needsUpdate = true; }
        p.halo.visible = aceso;
        p.halo.material.opacity = 0.82 * n;
        if (p.lampada){
          p.lampada.visible = aceso;
          p.lampada.material.opacity = 0.92 * n;
        }
        if (p.chao){ p.chao.visible = aceso; p.chao.material.opacity = 0.16 * n; }
      }
      const ax = ash?.vx ?? ash?.x ?? 0, az = ash?.vz ?? ash?.z ?? 0;
      const near = posts.length <= MAX_LUZ ? posts
        : posts.map(p => ({ p, d: (p.x - ax) ** 2 + (p.z - az) ** 2 })).sort((a, b) => a.d - b.d).slice(0, MAX_LUZ).map(x => x.p);
      for (let i = 0; i < luzes.length; i++){
        const p = near[i], L = luzes[i], H = cabecas[i];
        if (!p || !aceso){ L.intensity = 0; L.castShadow = false; if (H) H.intensity = 0; continue; }
        L.position.set(p.x, p.y - 0.15, p.z);
        L.target.position.set(p.x, p.y - 3.5, p.z);
        L.target.updateMatrixWorld();
        L.intensity = 6.6 * n;
        L.castShadow = i === 0;
        if (H){ H.position.set(p.x, p.y, p.z); H.intensity = 2.8 * n; }
      }
      const vivos = (mons || []).filter(e => e && (e.pivo || e.x != null) && LUZ_MON[dexDe(e)]);
      const ranked = vivos.map(e => {
        const p = posMon(e);
        return { e, p, d: (p.x - ax) ** 2 + (p.z - az) ** 2 };
      }).sort((a, b) => a.d - b.d).slice(0, monLuz.length);
      for (let i = 0; i < monLuz.length; i++){
        const L = monLuz[i], hit = ranked[i];
        if (!hit){ L.intensity = 0; continue; }
        const cfg = LUZ_MON[dexDe(hit.e)];
        const fogo = acharFogo(hit.e);
        L.color.setHex(cfg.cor);
        L.distance = cfg.r;
        if (fogo){
          fogo.getWorldPosition(_fogoP);
          L.position.copy(_fogoP);
        } else {
          L.position.set(hit.p.x, hit.p.y + (cfg.y || 0.5), hit.p.z);
        }
        L.intensity = cfg.i * (0.42 + n * 0.7);
      }
    },
  };
}
