/* COSMETIC EFFECTS (Nov 2) — auras around the trainer (`peito`) and trails left on the ground while walking (`rastro`).
   The newer build drew these with particle prefabs that are not in the project, so they are drawn here: one THREE.Points
   per effect in world space (a trail stays where it was dropped), sprites painted on a canvas, a small shader for
   per-particle size and fade. The catalog (data/cosmeticos.json `efeitos[].fx`) names the kind below.

   instalar({ THREE, cena, toque })
   vestir(chave, corpo, { peito, rastro })   corpo = { pivo, altura, x, z }; kinds by name (null = off)
   tirar(chave)
   quadro(dt, cam, alturaPx, perto)          perto(chave) → distance to the camera target (effects past DIST_MAX sleep)
*/
let THREE = null, cena = null, toque = false;
const REG = new Map();                                                     // chave → { corpo, peito: Fx|null, rastro: Fx|null, ultimo: {x,z} }
const MAX_OUTROS = () => (toque ? 2 : 3);                                  // other players' effects drawn at once (mine always)
const DIST_MAX = 30;

export function instalar(c){ THREE = c.THREE; cena = c.cena; toque = !!c.toque; }

/* ---- sprites: 64×64 canvas, white-ish so `cor` can tint ---- */
const TEX = new Map();
function textura(nome){
  if (TEX.has(nome)) return TEX.get(nome);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.translate(32, 32);
  const brilho = (r, cor) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); };
  switch (nome){
    case 'estrela':                                                        // 4-point twinkle
      brilho(14, 'rgba(255,255,255,0.9)');
      g.fillStyle = '#fff';
      for (let i = 0; i < 4; i++){ g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(3, -3, 0, 0); g.quadraticCurveTo(-3, -3, 0, -30); g.fill(); }
      break;
    case 'coracao':
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-34, -2, -18, -30, 0, -12); g.bezierCurveTo(18, -30, 34, -2, 0, 22); g.fill();
      break;
    case 'floco':
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 6; i++){ g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.moveTo(0, -15); g.lineTo(-7, -21); g.moveTo(0, -15); g.lineTo(7, -21); g.stroke(); }
      break;
    case 'petala':
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 13, 24, 0.5, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,170,200,0.6)'; g.beginPath(); g.ellipse(-3, 6, 4, 9, 0.5, 0, 7); g.fill();
      break;
    case 'brasa': brilho(30, 'rgba(255,255,255,1)'); break;
    case 'bolha':
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-9, -10, 6, 3.5, -0.7, 0, 7); g.fill();
      break;
    case 'flor':
      g.fillStyle = '#fff';
      for (let i = 0; i < 5; i++){ g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(0, -14, 9, 14, 0, 0, 7); g.fill(); }
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
      break;
    case 'faisca':
      brilho(18, 'rgba(255,255,255,0.8)');
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-6, -28); g.lineTo(6, -6); g.lineTo(-4, 2); g.lineTo(8, 28); g.stroke();
      break;
    case 'folha':
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -28); g.quadraticCurveTo(24, 0, 0, 28); g.quadraticCurveTo(-24, 0, 0, -28); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 24); g.stroke();
      break;
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  TEX.set(nome, t);
  return t;
}

/* ---- the kinds. taxa = particles/s, vida = s, tam = metres, nasce(p, a) sets position/velocity around anchor a ---- */
const ale = (a, b) => a + Math.random() * (b - a);
const roda = (p, a, r0, r1, y0, y1) => { const g = Math.random() * 6.283, r = ale(r0, r1); p.x = a.x + Math.cos(g) * r; p.z = a.z + Math.sin(g) * r; p.y = a.y + ale(y0, y1); };
export const KINDS = {
  brilho:   { tipo: 'peito', tex: 'estrela', cor: '#ffe07a', n: 26, taxa: 9,  vida: [0.7, 1.3], tam: [0.12, 0.22], nasce: (p, a, h) => { roda(p, a, 0.25, 0.55, 0.2 * h, 1.1 * h); p.vy = 0.05; } , pisca: true },
  coracoes: { tipo: 'peito', tex: 'coracao', cor: '#ff7fb0', n: 18, taxa: 4,  vida: [1.6, 2.4], tam: [0.12, 0.2],  nasce: (p, a, h) => { roda(p, a, 0.2, 0.45, 0.5 * h, 0.9 * h); p.vy = ale(0.35, 0.55); p.ox = Math.random() * 6; } , balanca: 0.25 },
  neve:     { tipo: 'peito', tex: 'floco',   cor: '#ffffff', n: 34, taxa: 12, vida: [1.8, 2.6], tam: [0.08, 0.15], nasce: (p, a, h) => { roda(p, a, 0, 0.8, 1.35 * h, 1.55 * h); p.vy = ale(-0.55, -0.4); p.ox = Math.random() * 6; }, balanca: 0.2, giro: true },
  petalas:  { tipo: 'peito', tex: 'petala',  cor: '#ffb3cf', n: 28, taxa: 8,  vida: [2, 2.8],   tam: [0.09, 0.14], nasce: (p, a, h) => { roda(p, a, 0.1, 0.9, 1.2 * h, 1.5 * h); p.vy = ale(-0.4, -0.25); p.vx = ale(0.1, 0.3); p.ox = Math.random() * 6; }, balanca: 0.35, giro: true },
  brasas:   { tipo: 'peito', tex: 'brasa',   cor: '#ff9a3c', n: 30, taxa: 14, vida: [0.8, 1.4], tam: [0.05, 0.1],  nasce: (p, a, h) => { roda(p, a, 0.1, 0.4, 0.05 * h, 0.3 * h); p.vy = ale(0.6, 1.0); p.ox = Math.random() * 6; }, balanca: 0.12, aditivo: true },
  bolhas:   { tipo: 'peito', tex: 'bolha',   cor: '#bfe6ff', n: 14, taxa: 3,  vida: [1.6, 2.6], tam: [0.1, 0.2],   nasce: (p, a, h) => { roda(p, a, 0.25, 0.55, 0.3 * h, 0.8 * h); p.vy = ale(0.18, 0.3); p.ox = Math.random() * 6; }, balanca: 0.15, estoura: true },
  poeira:   { tipo: 'rastro', tex: 'estrela', cor: '#a8d4ff', n: 60, taxa: 26, vida: [0.9, 1.5], tam: [0.08, 0.16], nasce: (p, a) => { roda(p, a, 0, 0.18, 0.03, 0.18); p.vy = 0.08; }, pisca: true, aditivo: true },
  flores:   { tipo: 'rastro', tex: 'flor',    cor: '#ffffff', n: 40, taxa: 7,  vida: [2.2, 3],   tam: [0.12, 0.18], nasce: (p, a) => { roda(p, a, 0, 0.22, 0.03, 0.05); p.cresce = true; } },
  faiscas:  { tipo: 'rastro', tex: 'faisca',  cor: '#ffe24a', n: 40, taxa: 16, vida: [0.35, 0.6], tam: [0.12, 0.2], nasce: (p, a) => { roda(p, a, 0, 0.25, 0.05, 0.3); p.vy = 0.3; }, aditivo: true, pisca: true },
  folhas:   { tipo: 'rastro', tex: 'folha',   cor: '#7fd36a', n: 36, taxa: 10, vida: [1.2, 1.8], tam: [0.09, 0.14], nasce: (p, a) => { roda(p, a, 0, 0.2, 0.05, 0.25); p.vy = ale(0.2, 0.4); p.vx = ale(-0.3, 0.3); p.vz = ale(-0.3, 0.3); p.ox = Math.random() * 6; }, balanca: 0.3, giro: true },
};

const VERT = `attribute float tam; attribute float alfa; attribute float giro; varying float vAlfa; varying float vGiro; uniform float escala;
void main(){ vAlfa = alfa; vGiro = giro; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = tam * escala / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = `uniform sampler2D mapa; uniform vec3 cor; varying float vAlfa; varying float vGiro;
void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vGiro), k = cos(vGiro); vec2 r = vec2(c.x * k - c.y * s, c.x * s + c.y * k) + 0.5;
  vec4 t = texture2D(mapa, r); if (t.a * vAlfa < 0.02) discard; gl_FragColor = vec4(t.rgb * cor, t.a * vAlfa); }`;

class Fx {
  constructor(kind){
    const K = KINDS[kind]; this.K = K; this.kind = kind; this.acum = 0; this.t = 0;
    this.ps = Array.from({ length: K.n }, () => ({ vivo: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, idade: 0, vida: 1, tam: 0.1, g: 0, vg: 0, ox: 0 }));
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(K.n * 3); this.tam = new Float32Array(K.n); this.alfa = new Float32Array(K.n); this.giro = new Float32Array(K.n);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('tam', new THREE.BufferAttribute(this.tam, 1));
    geo.setAttribute('alfa', new THREE.BufferAttribute(this.alfa, 1));
    geo.setAttribute('giro', new THREE.BufferAttribute(this.giro, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: textura(K.tex) }, cor: { value: new THREE.Color(K.cor) }, escala: { value: 400 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: K.aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(geo, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 14;
    cena.add(this.pts);
  }
  passo(dt, ancora, altura, emite){
    const K = this.K; this.t += dt;
    if (emite){ this.acum += dt * K.taxa; while (this.acum >= 1){ this.acum--; this.nascer(ancora, altura); } } else this.acum = 0;
    for (let i = 0; i < K.n; i++){
      const p = this.ps[i], o = i * 3;
      if (p.vivo){
        p.idade += dt;
        if (p.idade >= p.vida) p.vivo = false;
        else {
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.g += p.vg * dt;
          if (K.balanca) { p.x += Math.sin(this.t * 2 + p.ox) * K.balanca * dt; p.z += Math.cos(this.t * 1.7 + p.ox) * K.balanca * dt; }
        }
      }
      if (!p.vivo){ this.alfa[i] = 0; this.pos[o + 1] = -999; continue; }
      const k = p.idade / p.vida, entra = Math.min(1, p.idade / 0.15), sai = Math.min(1, (1 - k) / 0.35);
      let a = entra * sai; if (K.pisca) a *= 0.55 + 0.45 * Math.sin(this.t * 14 + p.ox * 9);
      this.alfa[i] = a;
      this.tam[i] = p.tam * (K.cresce ? Math.min(1, p.idade / 0.4) : K.estoura && k > 0.92 ? 1.4 : 1);
      this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z; this.giro[i] = p.g;
    }
    const g = this.pts.geometry.attributes;
    g.position.needsUpdate = g.alfa.needsUpdate = g.tam.needsUpdate = g.giro.needsUpdate = true;
  }
  nascer(a, h){
    const p = this.ps.find(q => !q.vivo); if (!p) return;
    p.vivo = true; p.idade = 0; p.vx = p.vy = p.vz = 0; p.ox = Math.random() * 6;
    p.vida = ale(...this.K.vida); p.tam = ale(...this.K.tam); p.g = Math.random() * 6.283; p.vg = this.K.giro ? ale(-2, 2) : 0;
    this.K.nasce(p, a, h);
  }
  limpo(){ return !this.ps.some(p => p.vivo); }
  descartar(){ cena.remove(this.pts); this.pts.geometry.dispose(); this.mat.dispose(); }
}

/** Puts the chosen kinds on a body (null = none). Same kinds again = nothing changes. */
export function vestir(chave, corpo, { peito = null, rastro = null } = {}){
  if (!THREE || !cena) return;
  let r = REG.get(chave);
  if (!peito && !rastro){ if (r) tirar(chave); return; }
  if (!r){ r = { corpo, peito: null, rastro: null, ultimo: null }; REG.set(chave, r); }
  r.corpo = corpo;
  for (const [slot, kind] of [['peito', peito], ['rastro', rastro]]){
    const ok = kind && KINDS[kind] && KINDS[kind].tipo === slot ? kind : null;
    if (r[slot]?.kind === ok) continue;
    r[slot]?.descartar(); r[slot] = ok ? new Fx(ok) : null;
  }
}
export function tirar(chave){
  const r = REG.get(chave); if (!r) return;
  r.peito?.descartar(); r.rastro?.descartar(); REG.delete(chave);
}
export const estado = () => ({ corpos: REG.size, efeitos: [...REG.values()].reduce((n, r) => n + (r.peito ? 1 : 0) + (r.rastro ? 1 : 0), 0) });

const _a = { x: 0, y: 0, z: 0 };
/** Every frame. `perto(chave)` gives the distance from the camera target; mine (chave 'eu') is always drawn. */
export function quadro(dt, cam, alturaPx, perto = () => 0){
  if (!REG.size || !cam) return;
  const escala = alturaPx * cam.projectionMatrix.elements[5] * 0.5;    // world size → pixels at distance 1
  const outros = [...REG.keys()].filter(k => k !== 'eu').map(k => [k, perto(k)]).filter(([, d]) => d <= DIST_MAX).sort((a, b) => a[1] - b[1]).slice(0, MAX_OUTROS()).map(([k]) => k);
  const ativos = new Set(['eu', ...outros]);
  for (const [chave, r] of REG){
    const c = r.corpo, pv = c?.pivo; if (!pv) continue;
    const vis = ativos.has(chave) && pv.visible !== false && !c.montado;
    pv.getWorldPosition?.(_v ||= new THREE.Vector3());
    _a.x = _v.x; _a.y = _v.y; _a.z = _v.z;
    const anda = r.ultimo ? Math.hypot(_a.x - r.ultimo.x, _a.z - r.ultimo.z) / Math.max(dt, 1e-3) > 0.6 : false;
    r.ultimo = { x: _a.x, z: _a.z };
    for (const fx of [r.peito, r.rastro]){
      if (!fx) continue;
      fx.mat.uniforms.escala.value = escala;
      fx.pts.visible = vis || !fx.limpo();
      fx.passo(dt, _a, c.altura || 1.6, vis && (fx === r.peito || anda));
    }
  }
}
let _v = null;
