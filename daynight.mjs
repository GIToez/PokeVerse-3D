/* DAY AND NIGHT LIGHT. What the light does at each hour; the hour itself comes from clock.mjs (server-synced, /time, ?time=).
 *
 * Noon is exactly the calibrated day light (white sun 1.55, hemi e8e8e8/dcecff 1.9, sky a7c3ad) — the day does not change.
 * Night is MOONLIGHT: a weak, cold (blue) directional light, a navy hemisphere above and near-black below, dark blue sky/fog.
 * Dawn and dusk are orange with a low sun and long shadows. The sun MOVES: east in the morning, nearly overhead at noon (the
 * old fixed MainLight direction), west at dusk; the moon has its own arc from the camera side so the faces you see stay lit.
 * Lamps, door lights and lit windows are driven by `postes` (0..1); index.html applies everything to the scene.
 */
import * as THREE from 'three';
import * as Relogio from './clock.mjs';

const norm = h => ((h % 24) + 24) % 24;

/* Keyframes per hour. luz = directional light (sun or moon) color/strength, hc/hg/hi = hemisphere sky/ground/strength,
   ceu = background and fog, agua = water color multiplier (the water shader has no scene light). sRGB; mixed in linear. */
const K = [
  { h: 0,    luz: '#8fa6e6', li: 0.42, hc: '#2b3d6b', hg: '#0b1020', hi: 0.62, ceu: '#0a1222', agua: '#2a3a5e' },
  { h: 4.6,  luz: '#8fa6e6', li: 0.40, hc: '#2b3d6b', hg: '#0b1020', hi: 0.62, ceu: '#0c1526', agua: '#2a3a5e' },
  { h: 5.6,  luz: '#9c9ccc', li: 0.18, hc: '#4a4f80', hg: '#1a1a2c', hi: 0.75, ceu: '#2b2f4f', agua: '#3e4870' },
  { h: 6.3,  luz: '#ff9a62', li: 0.55, hc: '#a08aa8', hg: '#3c3550', hi: 1.00, ceu: '#c98d7c', agua: '#6c6886' },
  { h: 7.3,  luz: '#ffd2a8', li: 1.10, hc: '#d6d0d2', hg: '#b4c2dc', hi: 1.55, ceu: '#bcbba6', agua: '#b8b6c2' },
  { h: 9.0,  luz: '#ffffff', li: 1.55, hc: '#e8e8e8', hg: '#dcecff', hi: 1.90, ceu: '#a7c3ad', agua: '#ffffff' },
  { h: 16.0, luz: '#ffffff', li: 1.55, hc: '#e8e8e8', hg: '#dcecff', hi: 1.90, ceu: '#a7c3ad', agua: '#ffffff' },
  { h: 17.3, luz: '#ffdcb0', li: 1.30, hc: '#e2d6c8', hg: '#c6cede', hi: 1.65, ceu: '#c2bc9c', agua: '#e6dcd0' },
  { h: 18.3, luz: '#ff8a4c', li: 0.75, hc: '#a8849a', hg: '#4a3c58', hi: 1.10, ceu: '#d4875e', agua: '#a08090' },
  { h: 19.0, luz: '#c27a7a', li: 0.20, hc: '#5a4f7a', hg: '#1e1a2e', hi: 0.80, ceu: '#3b3558', agua: '#4a4a72' },
  { h: 19.8, luz: '#8fa6e6', li: 0.36, hc: '#2f4070', hg: '#0d1224', hi: 0.66, ceu: '#111a30', agua: '#2c3c62' },
  { h: 24,   luz: '#8fa6e6', li: 0.42, hc: '#2b3d6b', hg: '#0b1020', hi: 0.62, ceu: '#0a1222', agua: '#2a3a5e' },
].map(k => ({ ...k, luz: new THREE.Color(k.luz), hc: new THREE.Color(k.hc), hg: new THREE.Color(k.hg), ceu: new THREE.Color(k.ceu), agua: new THREE.Color(k.agua) }));

const suave = t => t * t * (3 - 2 * t);
const passo = (a, b, x) => suave(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** Reused state (no per-frame allocation). */
const E = {
  hora: 12, luzCor: new THREE.Color(), luzInt: 1, hemiCeu: new THREE.Color(), hemiChao: new THREE.Color(), hemiInt: 1,
  ceu: new THREE.Color(), agua: new THREE.Color(), dir: new THREE.Vector3(0, 1, 0), lua: false,
  noite: 0,        // 0 = full day, 1 = full night
  postes: 0,       // 0..1: how lit lamps/windows are (on at dusk, off at dawn)
  sombra: 1,       // directional shadow strength (the moon's is weaker; fades out around the sun↔moon swap)
};

/** Light for hour `h` (default: the clock's hour). Always returns the same object. */
export function estado(h = Relogio.hora()){
  h = norm(h); E.hora = h;
  let i = 0; while (i < K.length - 2 && K[i + 1].h <= h) i++;
  const a = K[i], b = K[i + 1], t = suave((h - a.h) / (b.h - a.h));
  E.luzCor.copy(a.luz).lerp(b.luz, t); E.luzInt = a.li + (b.li - a.li) * t;
  E.hemiCeu.copy(a.hc).lerp(b.hc, t); E.hemiChao.copy(a.hg).lerp(b.hg, t); E.hemiInt = a.hi + (b.hi - a.hi) * t;
  E.ceu.copy(a.ceu).lerp(b.ceu, t); E.agua.copy(a.agua).lerp(b.agua, t);
  /* Direction. Elevation never drops below ~22° so shadows don't cross the whole map (color/strength already say "late").
     The sun↔moon swap happens at 19:00 and 05:36, when the light is almost off. */
  const lua = h >= 19.0 || h < 5.6;
  const fase = lua ? (h >= 19 ? h - 19 : h + 5) / 10.6 : (h - 5.6) / (19.0 - 5.6);   // 0..1 across the night / the day
  const elev = lua ? THREE.MathUtils.lerp(0.6, 1.05, Math.sin(fase * Math.PI)) : THREE.MathUtils.lerp(0.38, 1.392, Math.sin(fase * Math.PI));
  /* azimuth: at noon −0.658 rad = exactly the old MainLight direction (−3.7, 33.5, −4.8). The moon comes from the camera
     side (+z): it lights the faces the player sees and shadows fall away — at night readability beats the sun's angle. */
  const azim = lua ? Math.PI - 0.5 + (fase - 0.5) * 1.6 : -0.658 + (fase - 0.5) * 2.4;
  E.dir.set(Math.sin(azim) * Math.cos(elev), Math.sin(elev), -Math.cos(azim) * Math.cos(elev)).normalize();
  E.lua = lua;
  E.noite = 1 - passo(5.4, 7.4, h) * (1 - passo(17.6, 19.8, h));
  E.postes = 1 - passo(6.0, 7.0, h) * (1 - passo(17.9, 18.9, h));
  const troca = Math.min(Math.abs(h - 19.0), Math.abs(h - 5.6));
  E.sombra = (lua ? 0.55 : 1) * passo(0, 0.35, troca);
  return E;
}
