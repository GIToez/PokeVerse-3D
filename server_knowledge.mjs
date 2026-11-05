/* Server copy of the Pokédex knowledge score (knowledge.mjs runs the same table in the browser).
 * The save carries `conhecimento: { esp: { [dex]: record } }`; this reads it so rankings and achievements
 * can use knowledge points and levels without trusting a number the client sends.
 *
 *   import { knowledgePoints, knowledgeLevel, knowledgeSummary } from './server_knowledge.mjs';
 *   knowledgeSummary(save) → { points, studied, masters, species } */
export const LEVEL_THRESHOLDS = [0, 1, 4, 10, 18, 28];   // minimum points for each level (must match knowledge.mjs)

/** A record is { v, p, ar, sx, gl, ev, lu, sh }; an old 0–5 number counts as seen (1) or caught (2+). */
function asRecord(raw) {
  if (raw && typeof raw === 'object') return raw;
  const n = Math.round(+raw);
  return n >= 1 && n <= 5 ? { v: 1, p: n >= 2 ? 1 : 0 } : null;
}

export function knowledgePoints(raw) {
  const r = asRecord(raw);
  if (!r) return 0;
  const areas = Array.isArray(r.ar) ? new Set(r.ar).size : 0, moves = Array.isArray(r.gl) ? new Set(r.gl).size : 0;
  const sx = typeof r.sx === 'string' ? r.sx : '';
  let p = 0;
  if (r.v > 0 || r.p > 0) p += 1;
  if (r.p > 0) p += 3;
  p += Math.min(2, Math.max(0, areas - 1)) * 2;                                          // up to 3 different areas
  if (r.p > 0 && sx.includes('-')) p += 4;                                               // genderless species, caught
  else p += (sx.includes('m') ? 2 : 0) + (sx.includes('f') ? 2 : 0);
  p += Math.min(8, moves);
  if (r.ev) p += 4;
  p += Math.min(5, Math.floor((+r.lu || 0) / 3));
  if (r.sh) p += 5;
  return p;
}

export function knowledgeLevel(raw) {
  const p = knowledgePoints(raw);
  let n = 0;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) if (p >= LEVEL_THRESHOLDS[i]) n = i;
  return n;
}

/** Totals for one save: points (all species), studied (level 3+), masters (level 5). */
export function knowledgeSummary(save) {
  const esp = save?.conhecimento?.esp;
  const out = { points: 0, studied: 0, masters: 0, species: 0 };
  if (!esp || typeof esp !== 'object') return out;
  for (const raw of Object.values(esp)) {
    const p = knowledgePoints(raw);
    if (!p) continue;
    out.species++;
    out.points += p;
    const lv = knowledgeLevel(raw);
    if (lv >= 3) out.studied++;
    if (lv >= 5) out.masters++;
  }
  return out;
}
