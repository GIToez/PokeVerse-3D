/**
 * Party moves reported by the client (level-up learning, Relearn, forgetting a move for a new one).
 *
 * The client learns level-up moves on its own and sends the party record with `movs`. Before this
 * module the server dropped that list, so the account kept the moves the Pokémon was created with.
 * Any server reply that carries `vidas` (a Potion in battle, a held item, a TM) then sent that old
 * list back and the client replaced its moves with it: moves 3 and 4 vanished from the skill bar.
 *
 * Accepted only when every move is one the record already knows or one its species learns by
 * level up at or below the record's level (the server owns `lv`). Up to 4 distinct moves.
 * PP is clamped to 0..ppMax; ppMax comes from the record or the learnset table, never the client.
 */
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Ind from './individual.mjs';

const root = nodePath.dirname(fileURLToPath(import.meta.url));

function ensureLearnset() {
  if (Ind.learnsetDe(1).length) return;
  try { Ind.carregarLearnset(JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/learnset.json'), 'utf8'))); } catch {}
}

/** True when the record's species can have learned `id` by its current level. */
function learnable(record, id) {
  ensureLearnset();
  const lv = Math.max(1, record.lv | 0 || 1);
  return Ind.learnsetDe(record.dex).some(([k, n]) => k === id && n <= lv);
}

/** Merges `item.movs` into `record.movs`. Returns true when the record changed. Invalid lists are ignored whole. */
export function mergeMovs(record, item) {
  if (!record || !item || typeof item !== 'object' || !Array.isArray(item.movs)) return false;
  const list = item.movs;
  if (!list.length || list.length > 4) return false;
  const known = new Map((Array.isArray(record.movs) ? record.movs : []).filter(m => m && m.id).map(m => [String(m.id), m]));
  const seen = new Set(), next = [];
  for (const m of list) {
    const id = typeof m?.id === 'string' ? m.id : null;
    if (!id || id.length > 40 || seen.has(id)) return false;
    seen.add(id);
    const had = known.get(id);
    if (!had && !learnable(record, id)) return false;
    const ppMax = Number.isInteger(had?.ppMax) && had.ppMax > 0 ? had.ppMax : Ind.ppDe(id);
    const pp = Math.round(Number(m.pp));
    next.push({ id, pp: Number.isInteger(pp) ? Math.max(0, Math.min(ppMax, pp)) : (had?.pp ?? ppMax), ppMax });
  }
  const before = JSON.stringify(record.movs || []), after = JSON.stringify(next);
  if (before === after) return false;
  record.movs = next;
  return true;
}
