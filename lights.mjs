/* Lamppost prop + flame-Pokémon light. The night lighting itself (moon, lamps, door lights, lit windows) lives in
   daynight.mjs + index.html: this module only builds the placeable prop/lamppost model, hands back where its lantern is
   (so index can light it like any streetlight) and moves the light of fire Pokémon. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EH_FOGO, EH_MALHA_FOGO } from './fire.mjs';

const _fogoP = new THREE.Vector3();
const CABECA_LAMPPOST = 3.13;                                          // lantern height of scenery/prop/lamppost.glb

/** Species that throw their own light (flame tail, lava body, etc.). */
export const LUZ_MON = {
  4: { cor: 0xff6a1c, i: 5.4, r: 6.6, y: 0.52, h: 2.1 },
  5: { cor: 0xff7024, i: 6.2, r: 7.4, y: 0.72, h: 2.5 },
  6: { cor: 0xff7a30, i: 7.2, r: 8.8, y: 1.05, h: 3.2 },
  37: { cor: 0xff8a28, i: 2.8, r: 4.4, y: 0.4, h: 1.6 },
  38: { cor: 0xffb040, i: 4.2, r: 6.4, y: 0.55, h: 2.2 },
  58: { cor: 0xff8020, i: 3.2, r: 5.0, y: 0.45, h: 1.7 },
  59: { cor: 0xff9028, i: 4.8, r: 7.0, y: 0.7, h: 2.4 },
  77: { cor: 0xff8822, i: 3.8, r: 5.6, y: 0.7, h: 2.0 },
  78: { cor: 0xff9028, i: 4.8, r: 6.8, y: 0.9, h: 2.4 },
  126: { cor: 0xff5010, i: 4.6, r: 6.4, y: 0.75, h: 2.2 },
  136: { cor: 0xff7018, i: 3.4, r: 5.0, y: 0.45, h: 1.7 },
  146: { cor: 0xffb030, i: 6.2, r: 9.0, y: 1.2, h: 3.4 },
  155: { cor: 0xff7a22, i: 3.2, r: 4.8, y: 0.38, h: 1.7 },
  156: { cor: 0xff8028, i: 4.0, r: 6.0, y: 0.55, h: 2.1 },
  157: { cor: 0xff8a30, i: 5.2, r: 7.4, y: 0.85, h: 2.6 },
  244: { cor: 0xff6a18, i: 5.8, r: 8.2, y: 0.95, h: 2.8 },
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
  let ponta = null, core = null, any = null;
  raiz.traverse(o => {
    const nome = o.name || '';
    if (/^Tail/i.test(nome) && !o.children.some(c => /^Tail/i.test(c.name || ''))) ponta = o;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const fogo = EH_MALHA_FOGO.test(nome) || mats.some(m => EH_FOGO.test(m?.name || ''));
    if (!fogo) return;
    if (!any) any = o;
    if (/core/i.test(nome) || mats.some(m => /core/i.test(m?.name || ''))) core = o;
  });
  e._luzFogo = ponta || core || any || null;
  return e._luzFogo;
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
    .filter(o => /lamppost/i.test(o.n || ''));
  const grupo = new THREE.Group(); grupo.name = 'lampposts';
  let proto = null;
  if (list.length) try {
    proto = (await new GLTFLoader().loadAsync('./scenery/prop/lamppost.glb')).scene;
  } catch (e){ console.warn('lamppost glb:', e); }
  const posts = [];
  const jaTem = (x, z) => posts.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 2.2);
  let bibJaTem = false;
  if (!soMons) cena.traverse(o => { if ((o.isMesh || o.isInstancedMesh || o.isBatchedMesh) && /lamppost/i.test(o.name || '')) bibJaTem = true; });
  for (const o of list){
    const x = flipX * o.x, z = o.z;
    const yChao = chaoEm?.(x, z);
    const y = yChao != null ? yChao : (+o.y || 0);
    const glass = [];
    if (proto && !bibJaTem){
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
    posts.push({ x, y: y + CABECA_LAMPPOST, z, glass });
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
    posts.push({ x: wp.x, y: wp.y + CABECA_LAMPPOST, z: wp.z, glass });
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
  const monLuz = [];
  for (let i = 0; i < 3; i++){
    const M = new THREE.PointLight(0xff6a1c, 0, 5.2, 1.25);
    M.castShadow = false;
    cena.add(M);
    monLuz.push(M);
  }
  return {
    posts,
    /** `n` = how dark it is (0 day .. 1 night): flames glow a bit by day, fully at night. */
    quadro(_dt, ash, n, mons = []){
      const ax = ash?.vx ?? ash?.x ?? 0, az = ash?.vz ?? ash?.z ?? 0;
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
        if (fogo){
          fogo.getWorldPosition(_fogoP);
          _fogoP.y += 0.07;
        } else {
          _fogoP.set(hit.p.x, hit.p.y + (cfg.y || 0.5), hit.p.z);
        }
        L.color.setHex(cfg.cor);
        L.distance = cfg.r;
        L.position.copy(_fogoP);
        L.intensity = cfg.i * (0.55 + n * 0.7);
      }
    },
  };
}
