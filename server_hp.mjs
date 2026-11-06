/**
 * Party HP lives on the account. A refresh loads this number, so a damaged
 * Pokémon stays damaged. The client may report a lower HP (a wild hit, a
 * faint). It may not raise HP. A level-up may add only the new hit points
 * from the higher max, and a Pokémon Center heal is the path that fills the bar.
 */
import * as Forms from './forms.mjs';   // Pokémon forms: types and stats of Alolan, Galarian, Mega… (public/data/forms.json)
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Ind from './individual.mjs';

const root = nodePath.join(nodePath.dirname(fileURLToPath(import.meta.url)));
let species = null;

function speciesOf(dex) {
  if (!species) {
    try {
      const pdx = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/pokedex.json'), 'utf8'));
      species = new Map((pdx.species || []).filter(s => !s.base).map(s => [+s.n, s]));   // forms share the base's number: the base wins
    } catch {
      species = new Map();
    }
  }
  return species.get(+dex) || null;
}

/** Real max HP for this record (species base, level, HP IV, HP EV). */
export function maxHpOf(mon) {
  const base = Forms.especie(speciesOf(mon?.dex), mon)?.bs?.[0];   // Alolan, Galarian… have their own HP
  if (!base) return null;
  const lv = Math.max(1, mon.lv | 0 || 1);
  const iv = Array.isArray(mon.ivs) && Number.isInteger(+mon.ivs[0]) ? (+mon.ivs[0] | 0) : 0;
  const ev = Ind.evsDe(mon)[0];
  return Ind.hp(base, lv, iv, ev);
}

/**
 * Keep a reported HP only when it does not heal the Pokémon.
 * A missing stored HP accepts the first real number (the client's current bar).
 * After that, the number can fall, or rise by at most the max-HP gained from a level.
 */
export function mergeHp(record, item) {
  const max = maxHpOf(record);
  if (!max || !item || typeof item !== 'object' || !('hp' in item)) return false;
  const reported = Math.round(Number(item.hp));
  if (!Number.isInteger(reported) || reported < 0) return false;
  const capped = Math.min(reported, max);
  const had = Number.isInteger(record.hp) && record.hp >= 0;
  if (!had) {
    record.hp = capped;
    record.maxHp = max;
    return true;
  }
  const stored = Math.min(record.hp, max);
  const storedMax = Number.isInteger(record.maxHp) && record.maxHp > 0 ? record.maxHp : null;
  const growth = storedMax == null ? 0 : Math.max(0, max - storedMax);
  record.hp = Math.min(capped, Math.min(max, stored + growth));
  record.maxHp = max;
  return true;
}

/** Pokémon Center: the whole party is full, using the real max, not a stand-in of 100. */
export function healMon(mon) {
  if (!mon) return mon;
  const max = maxHpOf(mon);
  if (max) {
    mon.hp = max;
    mon.maxHp = max;
  } else {
    const fallback = Number.isInteger(mon.maxHp) && mon.maxHp > 0 ? mon.maxHp : 100;
    mon.hp = fallback;
    mon.maxHp = fallback;
  }
  mon.status = null;
  Ind.restaurarPP(mon);   // PP of every move back to ppMax (and the forgotten-move PP memory cleared), like the client's curarTime
  return mon;
}

/** A level gained in battle adds the new hit points and nothing more. */
export function grantLevelHp(mon, levels) {
  if (!mon || !(levels > 0)) {
    const max = maxHpOf(mon);
    if (max && Number.isInteger(mon?.hp) && mon.hp > max) mon.hp = max;
    if (max) mon.maxHp = max;
    return;
  }
  const lv = mon.lv | 0;
  const after = maxHpOf(mon);
  mon.lv = Math.max(1, lv - levels);
  const before = maxHpOf(mon);
  mon.lv = lv;
  if (!after) return;
  const growth = before ? Math.max(0, after - before) : 0;
  if (Number.isInteger(mon.hp) && mon.hp > 0) mon.hp = Math.min(after, mon.hp + growth);
  mon.maxHp = after;
}
