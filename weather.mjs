/* Overworld + battle weather. Damage rules from Bulbapedia “Weather”
   (Gen III–IX, the ones that still apply in current games):
   Sun: Fire ×1.5, Water ×0.5, Solar Beam full power.
   Rain: Water ×1.5, Fire ×0.5, Thunder / Hurricane cannot miss, Solar Beam ×0.5.
   Sand: Rock Sp. Def ×1.5, Solar Beam ×0.5.
   Snow: Ice Defense ×1.5. Hail: residual damage is not applied in real-time yet.
   Fog: accuracy ×0.6 (turn battles only).
   Weather Ball becomes 100 power and the weather’s type (not in the live 194-move list). */
export const NOMES = {
  chuva: 'Rain',
  chuva_forte: 'Heavy rain',
  sol: 'Harsh sunlight',
  areia: 'Sandstorm',
  granizo: 'Hail',
  neve: 'Snow',
  nevoeiro: 'Fog',
};
export const rotulo = nome => NOMES[nome] || '';

const ALIAS = {
  rain: 'chuva',
  chuva: 'chuva',
  shower: 'chuva',
  storm: 'chuva_forte',
  heavy: 'chuva_forte',
  heavyrain: 'chuva_forte',
  'heavy rain': 'chuva_forte',
  'chuva forte': 'chuva_forte',
  chuva_forte: 'chuva_forte',
  sun: 'sol',
  sunny: 'sol',
  sunlight: 'sol',
  sol: 'sol',
  sand: 'areia',
  sandstorm: 'areia',
  areia: 'areia',
  hail: 'granizo',
  granizo: 'granizo',
  snow: 'neve',
  neve: 'neve',
  fog: 'nevoeiro',
  mist: 'nevoeiro',
  nevoeiro: 'nevoeiro',
};

/** Chat / URL alias → internal weather id. `off`/`clear` → null. Unknown → undefined. */
export function ler(v){
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!s || s === 'off' || s === 'clear' || s === 'none' || s === 'auto' || s === 'real') return null;
  return Object.prototype.hasOwnProperty.call(ALIAS, s) ? ALIAS[s] : undefined;
}

const CHUVA = nome => nome === 'chuva' || nome === 'chuva_forte';

export function poderTipo(clima, tipo){
  if (!clima || !tipo) return 1;
  if (CHUVA(clima)) return tipo === 'Water' ? 1.5 : tipo === 'Fire' ? 0.5 : 1;
  if (clima === 'sol') return tipo === 'Fire' ? 1.5 : tipo === 'Water' ? 0.5 : 1;
  return 1;
}

export function poderGolpe(clima, golpe, poder){
  const id = String(golpe?.id || '');
  const p = Math.max(0, +poder || 0);
  if (id === 'solarbeam' || id === 'solarblade'){
    if (clima === 'sol') return p;
    if (clima && clima !== 'nevoeiro') return Math.floor(p * 0.5);
  }
  if (id === 'weatherball' && clima && clima !== 'nevoeiro') return Math.max(p, 100);
  return p;
}

export function tipoGolpe(clima, golpe){
  const id = String(golpe?.id || '');
  if (id === 'weatherball'){
    if (CHUVA(clima)) return 'Water';
    if (clima === 'sol') return 'Fire';
    if (clima === 'areia') return 'Rock';
    if (clima === 'granizo' || clima === 'neve') return 'Ice';
  }
  return golpe?.tipo || 'Normal';
}

/** Extra accuracy 0–1, or null to keep the move’s own accuracy. */
export function precisao(clima, golpe){
  const id = String(golpe?.id || '');
  if (CHUVA(clima) && (id === 'thunder' || id === 'hurricane')) return 1;
  if (clima === 'sol' && (id === 'thunder' || id === 'hurricane')) return 0.5;
  if (clima === 'nevoeiro') return 0.6;
  return null;
}

export function defesa(clima, types, i, valor){
  const t = types || [];
  if (i === 4 && clima === 'areia' && t.includes('Rock')) return Math.floor(valor * 1.5);
  if (i === 2 && clima === 'neve' && t.includes('Ice')) return Math.floor(valor * 1.5);
  return valor;
}

/** Stable weather for this in-game hour + calendar day. Clear most of the time. */
export function paraHora(hora, agoraMs = Date.now()){
  const h = ((+hora % 24) + 24) % 24;
  const dia = Math.floor(agoraMs / (60 * 60000));
  const roll = ((dia * 17) + (h | 0)) % 10;
  if (h >= 11 && h < 15){
    if (roll < 3) return 'chuva';
    if (roll === 3) return 'chuva_forte';
    if (roll === 4) return 'sol';
  }
  if (h >= 15 && h < 17 && roll < 2) return 'sol';
  if ((h >= 19 || h < 6) && roll < 2) return 'nevoeiro';
  if (h >= 1 && h < 5 && roll === 2) return 'neve';
  return null;
}

export function aplicarDano({ clima, tipo, poder, golpe, typesDef, defStat, defI }){
  const tipo2 = tipoGolpe(clima, { id: golpe, tipo });
  const poder2 = poderGolpe(clima, { id: golpe, tipo: tipo2 }, poder);
  const mul = poderTipo(clima, tipo2);
  const def2 = defesa(clima, typesDef, defI, defStat);
  return { tipo: tipo2, poder: poder2, mul, def: def2 };
}

/* Screen-space weather. The play camera is high and almost top-down, so 3D rain
   collapses to dots. These streaks sit on the canvas and stay readable. */
const TELA = {
  chuva:        { n: 220, vel: 980, len: 22, larg: 1.4, vento: 90,  cor: 'rgba(186,214,236,.72)' },
  chuva_forte:  { n: 420, vel: 1400, len: 34, larg: 1.8, vento: 220, cor: 'rgba(210,228,242,.88)' },
  granizo:      { n: 180, vel: 1600, len: 10, larg: 2.4, vento: 40,  cor: 'rgba(236,242,248,.9)' },
  neve:         { n: 160, vel: 90,  len: 3,  larg: 3.2, vento: 40,  cor: 'rgba(255,255,255,.85)', ponto: true },
  areia:        { n: 200, vel: 220, len: 6,  larg: 2.2, vento: 340, cor: 'rgba(214,176,96,.55)', ponto: true },
};

let tela = null;

function garantirTela(){
  if (tela?.cv?.isConnected) return tela;
  const cv = document.createElement('canvas');
  cv.id = 'clima-tela';
  cv.setAttribute('aria-hidden', 'true');
  (document.getElementById('sobre') || document.body).appendChild(cv);
  tela = { cv, g: cv.getContext('2d'), drops: [], kind: null, w: 0, h: 0 };
  return tela;
}

function encher(kind){
  const t = garantirTela(), c = TELA[kind];
  t.kind = kind;
  t.w = t.cv.width = innerWidth;
  t.h = t.cv.height = innerHeight;
  t.drops = [];
  if (!c) return;
  for (let i = 0; i < c.n; i++){
    t.drops.push({
      x: Math.random() * t.w,
      y: Math.random() * t.h,
      v: c.vel * (0.7 + Math.random() * 0.6),
      l: c.len * (0.6 + Math.random() * 0.7),
    });
  }
}

export function ligarTela(kind){
  if (typeof document === 'undefined') return;
  if (!TELA[kind]){ desligarTela(); return; }
  encher(kind);
}

export function desligarTela(){
  if (!tela) return;
  tela.g.clearRect(0, 0, tela.cv.width, tela.cv.height);
  tela.kind = null;
  tela.drops = [];
}

export function passoTela(dt){
  if (!tela?.kind) return;
  const c = TELA[tela.kind];
  if (!c) return;
  if (tela.w !== innerWidth || tela.h !== innerHeight) encher(tela.kind);
  const g = tela.g, w = tela.w, h = tela.h;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = c.cor;
  g.fillStyle = c.cor;
  g.lineWidth = c.larg;
  g.lineCap = 'round';
  const vx = c.vento * dt, fall = dt;
  for (const q of tela.drops){
    q.y += q.v * fall;
    q.x += vx;
    if (q.y > h + 20 || q.x > w + 40){
      q.y = -20;
      q.x = (q.x % (w + 80)) - 40;
      if (q.x < -40) q.x += w + 80;
    }
    if (c.ponto){
      g.beginPath();
      g.arc(q.x, q.y, q.l * 0.35, 0, 6.28);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(q.x, q.y);
      g.lineTo(q.x - c.vento * 0.02, q.y - q.l);
      g.stroke();
    }
  }
}
