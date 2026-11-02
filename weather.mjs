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
