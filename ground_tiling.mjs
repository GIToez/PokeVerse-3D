/* GROUND WITHOUT VISIBLE TILING (Nov 10) — shared by the game (index.html) and the Scenery Studio (via scenery_free.mjs).
 *
 * The library grass tile (`floor_grass2`, 1 × 1 m) maps one QUARTER of its 512 px texture onto every tile, so the same square
 * repeats every metre. Here the material samples the WHOLE texture in WORLD space instead (`metros` metres per copy — 2 m keeps
 * the original 256 px per metre, so nothing gets blurrier) and hides the repetition with Inigo Quilez's "texture repetition"
 * technique 3: a smooth noise picks, per region, an offset into the texture and blends two offset lookups (textureGrad, so the
 * mip level stays right across the offsets). On top, a very low-frequency tint (lighter / darker / drier patches) breaks the
 * uniform colour the eye reads as a pattern from far away. World coordinates also make adjacent tiles seamless.
 *
 * Only for FLAT ground (the xz projection would smear on walls). The material's own UVs/texture transform are ignored.
 */
import * as THREE from 'three';

const GLSL_FUNCS = /* glsl */`
uniform float uMetrosNT;
uniform float uMacroNT;
varying vec3 vMundoNT;
float hashNT(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float ruidoNT(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashNT(i), hashNT(i + vec2(1.0, 0.0)), f.x), mix(hashNT(i + vec2(0.0, 1.0)), hashNT(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec4 semRepeticaoNT(sampler2D s, vec2 x){
  vec2 dx = dFdx(x), dy = dFdy(x);
  float k = ruidoNT(x * 0.55) * 0.7 + ruidoNT(x * 1.7 + 4.1) * 0.3;
  float l = k * 8.0, i = floor(l), f = fract(l);
  vec2 oa = sin(vec2(3.0, 7.0) * i), ob = sin(vec2(3.0, 7.0) * (i + 1.0));
  vec4 ca = textureGrad(s, x + oa, dx, dy), cb = textureGrad(s, x + ob, dx, dy);
  vec3 d = ca.rgb - cb.rgb;
  return mix(ca, cb, smoothstep(0.2, 0.8, f - 0.1 * (d.x + d.y + d.z)));
}
`;

const MAP_FRAG = /* glsl */`
#ifdef USE_MAP
  vec4 sampledDiffuseColor = semRepeticaoNT(map, vMundoNT.xz / uMetrosNT);
  if (uMacroNT > 0.0){
    vec2 pm = vMundoNT.xz;
    float m = ruidoNT(pm / 19.0) * 0.65 + ruidoNT(pm / 6.5 + 7.3) * 0.35;                 // lighter / darker patches
    sampledDiffuseColor.rgb *= mix(1.0 - 0.16 * uMacroNT, 1.0 + 0.12 * uMacroNT, m);
    float tom = ruidoNT(pm / 41.0 - 3.1);                                                 // fresh (blue-green) vs warm (yellow-green) meadow
    sampledDiffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.94, 1.0, 1.04), vec3(1.07, 1.03, 0.9), tom), 0.8 * uMacroNT);
    float seco = smoothstep(0.6, 0.92, ruidoNT(pm / 29.0 + 13.7));                        // a few sun-dried patches
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.rgb * vec3(1.12, 1.05, 0.78), seco * 0.5 * uMacroNT);
  }
  diffuseColor *= sampledDiffuseColor;
#endif
`;

/**
 * Patches `mat` (MeshStandard/Lambert/Phong with a `map`) to sample its texture in world space without visible tiling.
 * @param {number} metros  metres covered by one full copy of the texture
 * @param {number} macro   0..1 strength of the large-scale tint variation
 */
export function semRepeticao(mat, { metros = 2, macro = 1 } = {}) {
  if (!mat || !mat.map || mat.userData?.semRepeticao) return mat;
  mat.userData.semRepeticao = { metros, macro };
  const t = mat.map;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = Math.max(t.anisotropy || 1, 8);
  t.needsUpdate = true;
  const antes = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (antes) antes.call(mat, sh, r);
    sh.uniforms.uMetrosNT = { value: metros };
    sh.uniforms.uMacroNT = { value: macro };
    sh.vertexShader = 'varying vec3 vMundoNT;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vMundoNT = (inverse(viewMatrix) * mvPosition).xyz;');
    sh.fragmentShader = GLSL_FUNCS + sh.fragmentShader.replace('#include <map_fragment>', MAP_FRAG);
  };
  const chave = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => chave() + '|semRep' + metros + ',' + macro;
  mat.needsUpdate = true;
  return mat;
}

/** Flat ground tiles of the shared library that get the treatment, with metres per texture copy. */
export const TILES_CHAO = [
  [/^floor_grass[12]$/, { metros: 2, macro: 1 }],
  [/^grass_p_64$/, { metros: 2, macro: 1 }],
  [/^ground_soil$/, { metros: 2.5, macro: 0.6 }],
];
export function tileDeChao(nome) { for (const [re, o] of TILES_CHAO) if (re.test(nome)) return o; return null; }
