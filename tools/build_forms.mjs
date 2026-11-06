/* Builds public/data/forms.json: one entry per regional / Mega / Gigantamax form that has a model (data/cast.json), keyed
 * "<dex>_<form number>" (Alolan Raichu = 26_61). Types and stats come from the Pokédex's form entries (Raichu-Alola…).
 * Keeps anything already in forms.json (admin edits win); only fills what is missing.   node tools/build_forms.mjs */
import fs from 'node:fs';
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const cast = rd('public/data/cast.json', []), pdx = rd('public/pokedex.json', { species: [] }), atual = rd('public/data/forms.json', {});
const NOMES = { 51: 'Mega', 52: 'Mega Y', 61: 'Alolan', 62: 'Galarian', 63: 'Hisuian', 64: 'Paldean', 81: 'Gigantamax' };
const casa = { 61: /^-Alola$/, 62: /^-Galar(-Standard)?$/, 63: /^-Hisui$/, 64: /^-Paldea(-Combat)?$/, 51: /^-Mega(-X)?$/, 52: /^-Mega-Y$/, 81: /^-Gmax$/ };
/* Galarian forms the Pokédex file doesn't carry (official Sword/Shield data). */
const EXTRA = {
  '77_62': [['Psychic'], [50, 85, 55, 65, 65, 90]], '78_62': [['Psychic', 'Fairy'], [65, 100, 70, 80, 80, 105]],
  '83_62': [['Fighting'], [52, 95, 55, 58, 62, 55]], '122_62': [['Ice', 'Psychic'], [50, 65, 65, 90, 90, 100]],
  '222_62': [['Ghost'], [60, 55, 100, 65, 100, 30]], '263_62': [['Dark', 'Normal'], [38, 30, 41, 30, 41, 60]],
  '264_62': [['Dark', 'Normal'], [78, 70, 61, 50, 61, 100]], '554_62': [['Ice'], [70, 90, 45, 15, 45, 50]],
  '555_62': [['Ice'], [105, 140, 55, 30, 55, 95]], '562_62': [['Ground', 'Ghost'], [38, 55, 85, 30, 65, 30]],
  '618_62': [['Ground', 'Steel'], [109, 81, 99, 66, 84, 32]],
};
const base = new Map(pdx.species.filter((s) => !s.base).map((s) => [+s.n, s]));
const formas = { ...(atual.formas || {}) };
const faltam = [];
for (const e of cast) {
  const m = /^pm(\d{4})_(\d{2})$/.exec(e.glb || ''), sfx = m?.[2];
  if (!m || !NOMES[sfx]) continue;
  const dex = +m[1], k = dex + '_' + sfx, B = base.get(dex);
  if (!B) continue;
  const f = pdx.species.find((s) => s.base && +s.n === dex && casa[sfx].test(s.name.slice(String(s.base).length)));
  const nome = (sfx === '51' && e.nota === 'Mega X' ? 'Mega ' + B.name + ' X' : sfx === '52' ? 'Mega ' + B.name + ' Y' : sfx === '51' ? 'Mega ' + B.name : NOMES[sfx] + ' ' + B.name);
  const velho = formas[k] || {};
  const [xt, xb] = EXTRA[k] || [];
  formas[k] = { nome: velho.nome || nome, glb: velho.glb || e.glb, tipos: velho.tipos || f?.types || xt || null, bs: velho.bs || f?.bs || xb || null, ...(velho.golpes ? { golpes: velho.golpes } : {}), ...(velho.nota ? { nota: velho.nota } : {}) };
  if (sfx === '81') { if (!velho.nota) formas[k].nota = 'Gigantamax keeps the normal types and stats.'; continue; }
  if (!formas[k].tipos || !formas[k].bs) { faltam.push(k + ' ' + nome); if (!velho.nota) formas[k].nota = 'No official types/stats in our data yet: uses the normal ones until filled in.'; }
}
const out = {
  _nota: 'Recommended form numbers (the last two digits of the model, e.g. pm0026_61): 51 = Mega (or Mega X), 52 = Mega Y, 61 = Alolan, 62 = Galarian, 63 = Hisuian, 64 = Paldean, 81 = Gigantamax. 31–50 and the rest are costumes and colours: they use the normal form. A key is "<dex>_<form>" (26_61 = Alolan Raichu); its moveset is the learnset entry with the same key, else the normal one.',
  formas: Object.fromEntries(Object.entries(formas).sort(([a], [b]) => parseInt(a) - parseInt(b) || a.localeCompare(b))),
};
fs.writeFileSync('public/data/forms.json', JSON.stringify(out, null, 1) + '\n');
console.log(Object.keys(out.formas).length, 'forms;', faltam.length, 'without types/stats:\n' + faltam.join('\n'));
