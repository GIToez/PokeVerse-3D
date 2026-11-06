/* POKÉMON FORMS (Nov 6): a Pokémon's form is the last two digits of its model (pm0026_61 → 61), or its `forma` field when set.
 * Recommended numbers: 51 = Mega (or Mega X) · 52 = Mega Y · 61 = Alolan · 62 = Galarian · 63 = Hisuian · 64 = Paldean ·
 * 81 = Gigantamax. Anything else (31–50 costumes and colours…) is the normal form.
 * public/data/forms.json (admin → Forms) holds one entry per form, keyed "<dex>_<form>" (26_61 = Alolan Raichu):
 *   { nome, glb (its model), tipos, bs (6 base stats), golpes? (learnset key, default the same key), nota? }
 * A form's moveset is the learnset entry with its key ("26_61"); without one it uses the normal moveset.
 * Shared by the client and the server (no imports):
 *   usar(dados)              — loads forms.json
 *   numeroDe(p)              — '61' | '00'
 *   chaveDe(p)               — '26_61' when that form exists in the table, else null
 *   formaDe(p)               — the table entry or null
 *   especie(S, p)            — the species with the form's types and stats (S itself for the normal form)
 *   learnsetChave(dex, glb)  — the learnset key to read ('26_61' or '26') */
export const NUMEROS = Object.freeze({ '51': 'Mega', '52': 'Mega Y', '61': 'Alolan', '62': 'Galarian', '63': 'Hisuian', '64': 'Paldean', '81': 'Gigantamax' });
let TAB = {};
export function usar(d) { TAB = d && typeof d.formas === 'object' && d.formas ? d.formas : {}; }
export const tabela = () => TAB;
export function numeroDe(p) {
  if (p?.forma != null && /^\d{2}$/.test(String(p.forma))) return String(p.forma);
  const m = /_(\d{2})(?:\.glb)?$/.exec(String(p?.glb || ''));
  return m ? m[1] : '00';
}
export function chaveDe(p) {
  if (!p || !(+p.dex > 0)) return null;
  const n = numeroDe(p);
  if (n === '00') return null;
  const k = +p.dex + '_' + n;
  return TAB[k] ? k : null;
}
export const formaDe = (p) => { const k = chaveDe(p); return k ? TAB[k] : null; };
const tiposOk = (t) => Array.isArray(t) && t.length >= 1 && t.length <= 2 && t.every((x) => typeof x === 'string' && x);
const bsOk = (b) => Array.isArray(b) && b.length === 6 && b.every((x) => Number.isFinite(+x) && +x >= 1 && +x <= 255);
export function especie(S, p) {
  const k = chaveDe(p), f = k && TAB[k];
  if (!S || !f) return S;
  const t = tiposOk(f.tipos), b = bsOk(f.bs);
  if (!t && !b) return S;
  return { ...S, types: t ? f.tipos.slice() : S.types, bs: b ? f.bs.map(Number) : S.bs, forma: k, formaNome: f.nome || null };
}
export function learnsetChave(dex, glb, forma = null) {
  const k = chaveDe({ dex, glb, forma });
  return k ? String(TAB[k].golpes || k) : String(+dex);
}

/* EVOLUTION AND FORMS. An evolution rule (public/data/evolutions.json) can carry:
 *   formaDe: '61'      — the rule only applies to that form of the evolving Pokémon ('00' = only the normal one; a list works too)
 *   forma: '61'        — the form it evolves into ('00' = always the normal one)
 *   areas: [1105, …]   — it only works in those areas (an Alolan evolution in the Alola region); lugar = the place's name
 * Without `forma`, a regional form carries over when the next species has it (Alolan Rattata → Alolan Raticate). */
const dois = (v) => String(v ?? '').padStart(2, '0').slice(-2);
const REGIONAIS = new Set(['61', '62', '63', '64']);
/** Can this rule be used by this Pokémon here? → { vale, falta } (vale false + no falta = the rule isn't for this form at all). */
export function regraDaForma(r, p, area = null) {
  const minha = chaveDe(p) ? numeroDe(p) : '00';                    // a costume or colour (no entry in the table) counts as the normal form
  if (r?.formaDe != null && ![].concat(r.formaDe).map(dois).includes(minha)) return { vale: false, falta: '' };   // one form, or a list: ['00', '61']
  if (Array.isArray(r?.areas)) {
    if (!r.areas.length) return { vale: false, falta: 'only in ' + (r.lugar || 'its home region') + ' (not open yet)' };
    if (!r.areas.map(Number).includes(+area)) return { vale: false, falta: 'only in ' + (r.lugar || 'a special place') };
  }
  return { vale: true, falta: '' };
}
/** The model of the evolved Pokémon's form, or null for the normal form (the caller picks the _00 model). */
export function glbNaEvolucao(p, r) {
  const de = chaveDe(p) ? numeroDe(p) : '00', quer = r?.forma != null ? dois(r.forma) : REGIONAIS.has(de) ? de : '00';
  if (quer === '00') return null;
  const k = +r.para + '_' + quer, f = TAB[k];
  return f ? String(f.glb || 'pm' + String(+r.para).padStart(4, '0') + '_' + quer).replace(/\.glb$/, '') : null;
}
