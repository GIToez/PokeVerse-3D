/**
 * Stat stages and Leech Seed, shared by the real-time battle, the turn battle, and the raid.
 * The move catalog (public/data/moves.json, tools/pokeapi_moves.py) names them:
 *   `estagios: [[stat, n], ...]`  stat = atk def spa spd vel prec eva, n = −3…+3
 *   `estagiosEm: 'eu'`            the change lands on the user (Growth, Close Combat), not the target (Growl)
 *   `estagiosChance`              1–99 when it is a side effect roll (Psychic 10 %); absent = always
 *   `semente: true`               Leech Seed
 *
 * Stages live only for the fight: a fresh object per Pokémon in the field, gone on faint, switch, or the end
 * of the battle. They never go into the save.
 */

export const ATRIBUTOS = ['atk', 'def', 'spa', 'spd', 'vel', 'prec', 'eva'];

const NOME = {
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  vel: 'Speed',
  prec: 'accuracy',
  eva: 'evasiveness',
};

const SIGLA = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', vel: 'Spe', prec: 'Acc', eva: 'Eva' };

/** Stat index in `Ind.statDe` (0 hp, 1 atk, 2 def, 3 spa, 4 spd, 5 speed) → stage name. */
const POR_INDICE = [null, 'atk', 'def', 'spa', 'spd', 'vel'];

export const nome = (a) => NOME[a] || a;
export const sigla = (a) => SIGLA[a] || a;

export function novo() {
  return { atk: 0, def: 0, spa: 0, spd: 0, vel: 0, prec: 0, eva: 0 };
}

const lim = (n) => Math.max(-6, Math.min(6, n | 0));

/** Attack, Defense, Sp. Atk, Sp. Def, Speed: 2/8 … 2/2 … 8/2. */
export function mult(n) {
  n = lim(n);
  return n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
}

/** Accuracy and evasion: 3/9 … 3/3 … 9/3. */
export function multPrec(n) {
  n = lim(n);
  return n >= 0 ? (3 + n) / 3 : 3 / (3 - n);
}

/** Multiplier for stat index `i` (1–5) from a stage object (null = no stages). */
export function mulStat(est, i) {
  const a = POR_INDICE[i];
  return a && est ? mult(est[a] || 0) : 1;
}

/**
 * Hit chance after stages. `base` is the chance the battle already uses (1, or the weather's).
 * Moves that land on the user never miss.
 */
export function chance(base, golpe, estAt, estDef) {
  const b = base == null ? 1 : base;
  if (golpe?.estagiosEm === 'eu' && golpe.cat === 'status') return b;
  return b * multPrec((estAt?.prec || 0) - (estDef?.eva || 0));
}

/** Apply `[[stat, n], ...]` to `est`. Returns `[{ atributo, n, real }]`; `real` 0 = already at the cap. */
export function aplicar(est, lista) {
  const out = [];
  for (const [a, n] of lista || []) {
    if (!(a in est) || !n) continue;
    const antes = est[a] || 0;
    est[a] = lim(antes + n);
    out.push({ atributo: a, n, real: est[a] - antes });
  }
  return out;
}

/**
 * Roll the move's stage change. `estEu` = the user's stages, `estEle` = the target's (null when the
 * target cannot take it: fainted, immune). Returns `{ quem: 'eu' | 'ele', mudancas }` or null.
 */
export function doGolpe(golpe, estEu, estEle, rng = Math.random) {
  const lista = golpe?.estagios;
  if (!Array.isArray(lista) || !lista.length) return null;
  const emSi = golpe.estagiosEm === 'eu';
  const est = emSi ? estEu : estEle;
  if (!est) return null;
  const c = +golpe.estagiosChance || 100;
  if (c < 100 && rng() * 100 >= c) return null;
  const mudancas = aplicar(est, lista);
  return mudancas.length ? { quem: emSi ? 'eu' : 'ele', mudancas } : null;
}

/** "Bulbasaur's Attack rose sharply!" — the line the games print. */
export function frase(quem, m) {
  const s = (quem || 'Pokémon') + "'s " + nome(m.atributo);
  if (!m.real) return s + (m.n > 0 ? " won't go any higher!" : " won't go any lower!");
  const k = Math.abs(m.real);
  if (m.real > 0) return s + (k >= 3 ? ' rose drastically!' : k === 2 ? ' rose sharply!' : ' rose!');
  return s + (k >= 3 ? ' severely fell!' : k === 2 ? ' harshly fell!' : ' fell!');
}

/** Short floating text: "Atk ↑↑", "Def ↓", "Spe max". */
export function curto(m) {
  if (!m.real) return sigla(m.atributo) + (m.n > 0 ? ' max' : ' min');
  return sigla(m.atributo) + ' ' + (m.real > 0 ? '↑' : '↓').repeat(Math.min(3, Math.abs(m.real)));
}

export const cor = (m) => (!m.real ? '#9ab' : m.real > 0 ? '#ffb54a' : '#7fb2ff');

/** "Atk+2 Def−1" for a label; empty when nothing changed. */
export function resumo(est) {
  if (!est) return '';
  return ATRIBUTOS.filter((a) => est[a]).map((a) => sigla(a) + (est[a] > 0 ? '+' : '−') + Math.abs(est[a])).join(' ');
}

/** Leech Seed: Grass types are immune. */
export const podeSemear = (types) => !(types || []).includes('Grass');

/** HP the seed drains each tick: 1/8 of the seeded Pokémon's max HP. */
export const drenoSemente = (maxHp) => Math.max(1, Math.floor((+maxHp || 0) / 8));
