/* Held items that change experience (data/held.json): `expMult` (Lucky Egg) multiplies what its holder earns from a knockout;
   `expShare` (Exp. Share) gives its holder that share of the fighter's experience while it sits out. Server-side only. */
import { heldDe } from './held.mjs';

export function expEffect(mon, held){
  const h = heldDe(mon);
  return h ? held?.itens?.[String(h.id)]?.efeito || null : null;
}

/** Multiplier for the Pokémon that scored the knockout. */
export function expMultOf(mon, held){
  const e = expEffect(mon, held);
  return e?.tipo === 'expMult' && e.valor > 0 ? e.valor : 1;
}

/** Party members (not the fighter, not fainted) holding Exp. Share, with the share each gets. */
export function expSharers(party, fighter, held){
  const out = [];
  for (const p of party || []){
    if (!p || p === fighter || p.dex == null || (p.hp != null && p.hp <= 0)) continue;
    const e = expEffect(p, held);
    if (e?.tipo === 'expShare' && e.valor > 0) out.push({ mon: p, part: Math.min(1, e.valor) });
  }
  return out;
}
