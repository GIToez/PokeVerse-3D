/* Effort values — Gen III+ / current main-series rules
   (Bulbapedia “Effort values”, PokéAPI pokemon_stats.effort):
   252 per stat, 510 total; +1 stat point per 4 EVs at any level (floor(EV/4) in the stat formula).
   KO yield is 1–3 points in the species’ effort stats. Vitamins +10, wings +1, EV berries −10. */
import * as Ind from './individual.mjs';

export const STAT_MAX = Ind.EV_STAT_MAX;
export const TOTAL_MAX = Ind.EV_TOTAL_MAX;
export const STATS = Ind.STATS;

let YIELD = {};
export function usarYields(d){
  YIELD = d?.rende || d || {};
  return YIELD;
}
export async function carregar(url = './data/ev_yields.json'){
  const d = await fetch(url).then(r => r.ok ? r.json() : { rende: {} }).catch(() => ({ rende: {} }));
  return usarYields(d);
}

export const evsDe = Ind.evsDe;
export const garantir = e => { Ind.garantir(e); return e; };
export const soma = Ind.somaEV;
export const rendeDe = dex => {
  const r = YIELD[String(dex)];
  return Array.isArray(r) && r.length === 6 ? r.map(n => Math.max(0, n | 0)) : [0, 0, 0, 0, 0, 0];
};

const Z = () => [0, 0, 0, 0, 0, 0];
function aplicar(e, delta){
  const evs = evsDe(e);
  let tot = evs.reduce((a, b) => a + b, 0);
  const ganhou = Z();
  for (let i = 0; i < 6; i++){
    const want = delta[i] | 0;
    if (!want) continue;
    if (want < 0){
      const tira = Math.min(evs[i], -want);
      evs[i] -= tira;
      tot -= tira;
      ganhou[i] = -tira;
      continue;
    }
    const cabem = Math.max(0, Math.min(STAT_MAX - evs[i], TOTAL_MAX - tot, want));
    evs[i] += cabem;
    tot += cabem;
    ganhou[i] = cabem;
  }
  e.evs = evs;
  return { evs, ganhou, total: tot, cheio: tot >= TOTAL_MAX };
}

export function ganharPorKo(e, dex, { mult = 1 } = {}){
  if (!e) return { ganhou: Z(), total: 0, cheio: false };
  const m = Math.max(1, Math.min(4, mult | 0));
  return aplicar(e, rendeDe(dex).map(n => n * m));
}

/* item id → { stat, delta }  (stat index 0–5) */
export const ITENS = {
  50221: { stat: 0, delta: 10, nome: 'HP Up' },
  50222: { stat: 1, delta: 10, nome: 'Protein' },
  50223: { stat: 2, delta: 10, nome: 'Iron' },
  50224: { stat: 3, delta: 10, nome: 'Calcium' },
  50225: { stat: 4, delta: 10, nome: 'Zinc' },
  50226: { stat: 5, delta: 10, nome: 'Carbos' },
  50211: { stat: 0, delta: 1, nome: 'Health Wing' },
  50212: { stat: 1, delta: 1, nome: 'Muscle Wing' },
  50213: { stat: 2, delta: 1, nome: 'Resist Wing' },
  50214: { stat: 3, delta: 1, nome: 'Genius Wing' },
  50215: { stat: 4, delta: 1, nome: 'Clever Wing' },
  50216: { stat: 5, nome: 'Swift Wing', delta: 1 },
  50201: { stat: 0, delta: -10, nome: 'Pomeg Berry' },
  50202: { stat: 1, delta: -10, nome: 'Kelpsy Berry' },
  50203: { stat: 2, delta: -10, nome: 'Qualot Berry' },
  50204: { stat: 3, delta: -10, nome: 'Hondew Berry' },
  50205: { stat: 4, delta: -10, nome: 'Grepa Berry' },
  50206: { stat: 5, delta: -10, nome: 'Tamato Berry' },
};
export const itemDe = id => ITENS[+id] || null;

export function usarItem(e, id){
  const it = itemDe(id);
  if (!e || !it) return { ok: false, motivo: 'not an EV item' };
  const antes = evsDe(e)[it.stat];
  const r = aplicar(e, Z().map((_, i) => i === it.stat ? it.delta : 0));
  if (r.ganhou[it.stat] === 0) return { ok: false, motivo: it.delta < 0 ? 'nothing to remove' : (r.cheio ? 'EV total is full' : 'that stat is full'), ...r };
  return { ok: true, stat: it.stat, delta: r.ganhou[it.stat], antes, ...r };
}

export function textoGanho(ganhou){
  return (ganhou || []).map((v, i) => v ? ((v > 0 ? '+' : '') + v + ' ' + STATS[i]) : '').filter(Boolean).join(', ');
}
