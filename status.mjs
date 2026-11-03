/**
 * Major status conditions, shared by the real-time wild battle and the turn battle.
 * The move catalog (public/data/moves.json) names the ailment: `status`, `statusChance`
 * (0–100), optional `statusTurns` for sleep, `statusEm: 'eu'` when it lands on the user,
 * and `statusPool` when one roll picks among several (Tri Attack).
 *
 * One major status at a time. Fainting clears it. A Pokémon Center clears it.
 */

export const IDS = ['burn', 'poison', 'toxic', 'paralysis', 'sleep', 'freeze'];

const NOME = {
  burn: 'burned',
  poison: 'poisoned',
  toxic: 'badly poisoned',
  paralysis: 'paralyzed',
  sleep: 'asleep',
  freeze: 'frozen',
};

const SIGLA = {
  burn: 'BRN',
  poison: 'PSN',
  toxic: 'TOX',
  paralysis: 'PAR',
  sleep: 'SLP',
  freeze: 'FRZ',
};

const COR = {
  burn: '#f58e4a',
  poison: '#c060d0',
  toxic: '#a020c0',
  paralysis: '#e6d24a',
  sleep: '#9ec4e0',
  freeze: '#9ad8f5',
};

/** Types that cannot receive this status. Electric-into-Ground is the type chart, not this list. */
const IMUNE = {
  burn: ['Fire'],
  poison: ['Poison', 'Steel'],
  toxic: ['Poison', 'Steel'],
  paralysis: ['Electric'],
  freeze: ['Ice'],
};

export const nome = (id) => NOME[id] || '';
export const sigla = (id) => SIGLA[id] || '';
export const cor = (id) => COR[id] || '#ffffff';

export function aviso(porque) {
  if (porque === 'asleep') return 'is fast asleep';
  if (porque === 'frozen') return 'is frozen solid';
  if (porque === 'paralyzed') return "can't move";
  return porque || '';
}

/** A clean `{ id, n }` or null. `n` is sleep turns left, or the bad-poison counter. */
export function limpo(s) {
  if (!s || typeof s !== 'object') return null;
  const id = String(s.id || '');
  if (!NOME[id]) return null;
  const n = Math.max(0, Math.min(16, s.n | 0));
  return { id, n };
}

export const exportar = (s) => limpo(s);

export function podeSofrer(id, types) {
  if (!NOME[id]) return false;
  const im = IMUNE[id];
  if (!im) return true;
  return !(types || []).some((t) => im.includes(t));
}

/**
 * Roll the move's ailment onto `mon`. Returns the status now on it, or null
 * (immune, already statused, or the chance missed). Does not touch HP.
 */
export function doGolpe(mon, golpe, types, rng = Math.random) {
  if (!mon || !golpe) return null;
  const pool = Array.isArray(golpe.statusPool) && golpe.statusPool.length
    ? golpe.statusPool.filter((id) => NOME[id])
    : (NOME[golpe.status] ? [golpe.status] : []);
  if (!pool.length) return null;
  if (!(mon.hp > 0)) return null;
  if (limpo(mon.status)) return null;
  const chance = golpe.statusChance == null ? 100 : +golpe.statusChance;
  if (!(chance > 0) || (chance < 100 && rng() * 100 >= chance)) return null;
  const id = pool[Math.floor(rng() * pool.length)];
  if (!podeSofrer(id, types)) return null;
  let n = 0;
  if (id === 'sleep') {
    const lo = Math.max(1, golpe.statusTurns?.[0] | 0 || 2);
    const hi = Math.max(lo, golpe.statusTurns?.[1] | 0 || lo);
    n = lo + Math.floor(rng() * (hi - lo + 1));
  } else if (id === 'toxic') n = 1;
  mon.status = { id, n };
  return mon.status;
}

/** True when `quais` (null = every status) would clear what `mon` has. */
export function curavel(mon, quais) {
  const s = limpo(mon?.status);
  if (!s) return false;
  if (quais == null) return true;
  return quais.includes(s.id);
}

/** Clear the status when `quais` matches. `quais` null clears whatever it is. Returns whether it cleared. */
export function curar(mon, quais = null) {
  if (!curavel(mon, quais)) return false;
  mon.status = null;
  return true;
}

/** A Fire move that connects thaws the target. */
export function descongelar(mon) {
  if (limpo(mon?.status)?.id !== 'freeze') return false;
  mon.status = null;
  return true;
}

/** Real time: one sleep turn is this many seconds of clock (Sing's 2–4 turns = 3–6 s). */
export const SONO_TURNO_S = 1.5;

/**
 * Real time: sleep wears off by the clock, in the fight or out of it, whether the Pokémon tries to act or not.
 * Returns true on the tick it wakes up.
 */
export function sonoRelogio(mon, dt) {
  const s = limpo(mon?.status);
  if (s?.id !== 'sleep') { if (mon) mon.sonoT = 0; return false; }
  mon.sonoT = (mon.sonoT || 0) + dt;
  if (mon.sonoT < SONO_TURNO_S) return false;
  mon.sonoT -= SONO_TURNO_S;
  if (s.n <= 1) { mon.status = null; mon.sonoT = 0; return true; }
  mon.status = { id: 'sleep', n: s.n - 1 };
  return false;
}

/**
 * Before an action. Sleep and freeze skip it. Paralysis skips 1 in 4.
 * The turn they wake up, or thaw, they do get to act.
 * `relogio`: real time, where sleep runs on `sonoRelogio` and an attempt does not spend a turn.
 */
export function podeAgir(mon, rng = Math.random, { relogio = false } = {}) {
  const s = limpo(mon?.status);
  if (!s) return { age: true };
  if (s.id === 'sleep' && relogio) return { age: false, porque: 'asleep' };
  if (s.id === 'sleep') {
    const left = s.n - 1;
    if (left <= 0) mon.status = null;
    else mon.status = { id: 'sleep', n: left };
    return { age: false, porque: 'asleep' };
  }
  if (s.id === 'freeze') {
    if (rng() < 0.2) { mon.status = null; return { age: true, descongelou: true }; }
    return { age: false, porque: 'frozen' };
  }
  if (s.id === 'paralysis' && rng() < 0.25) return { age: false, porque: 'paralyzed' };
  return { age: true };
}

/** Burn halves the physical attack stat. Paralysis halves Speed. */
export const mulAtaque = (mon, fisico) => (fisico && limpo(mon?.status)?.id === 'burn' ? 0.5 : 1);
export const mulVel = (mon) => (limpo(mon?.status)?.id === 'paralysis' ? 0.5 : 1);

/**
 * End of a turn, or one tick of a real-time fight. Returns HP lost.
 * Bad poison starts at 1/16 and climbs. Ordinary poison is 1/8. Burn is 1/16.
 */
export function residual(mon) {
  const s = limpo(mon?.status);
  if (!s || !(mon.hp > 0) || !(mon.maxHp > 0)) return 0;
  let frac = 0;
  if (s.id === 'burn') frac = 1 / 16;
  else if (s.id === 'poison') frac = 1 / 8;
  else if (s.id === 'toxic') {
    frac = Math.min(15, s.n || 1) / 16;
    mon.status = { id: 'toxic', n: Math.min(16, (s.n || 1) + 1) };
  }
  if (!frac) return 0;
  return Math.max(1, Math.floor(mon.maxHp * frac));
}

/**
 * Party sync. A faint (hp 0) clears the status. Otherwise the reported status
 * is kept, including a clear: the wild battle and the medicines both live on
 * the client until the server confirms them.
 */
export function fundir(record, item) {
  if (!record || !item || typeof item !== 'object') return;
  if (Number(item.hp) === 0) { record.status = null; return; }
  if (!('status' in item)) return;
  record.status = limpo(item.status);
}
