/** Water habitat rows are the rod table. The overworld roll does not place them. */
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarWilds } from '../server_wild.mjs';

const root = nodePath.join(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const habitats = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/habitats.json'), 'utf8'));
const pesca = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/pesca.json'), 'utf8'));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function waterOf(area) {
  return (habitats.areas[String(area)] || []).filter(e => e.agua).map(e => e.dex);
}

const areas = Object.keys(habitats.areas || {}).filter(a => waterOf(a).length);
assert(areas.length === Object.keys(pesca.areas).length, 'area count ' + areas.length + ' vs ' + Object.keys(pesca.areas).length);
for (const a of areas) {
  const want = waterOf(a);
  const got = (pesca.areas[a] || []).map(e => e.dex);
  assert(JSON.stringify(got) === JSON.stringify(want), 'area ' + a + ' catch ' + got + ' habitat ' + want);
}
assert(pesca.varas.find(v => v.item === 3101)?.soMagikarp === true, 'old rod still magikarp only');
assert(pesca.varas.find(v => v.item === 3102)?.magikarp === 0.35, 'good rod magikarp rate');
assert(Array.isArray(pesca.generico) && pesca.generico.length > 0, 'generic fallback');

const wilds = criarWilds({
  dir: root,
  contas: {},
  enviar() {},
  salvarContas() {},
  expMult: () => 1,
  modelos: () => new Set(),
});
const water = wilds._test.rowsFor(1102, true, 'day');
assert(Array.isArray(water) && water.length === 0, 'water roll returned ' + water.length);
const land = wilds._test.rowsFor(1102, false, 'day');
assert(land.length === 0, 'water-only area still rolled ' + land.length + ' land rows');
const route = wilds._test.rowsFor(1201, false, 'day');
assert(route.length > 0 && route.every(e => !e.agua), 'route 1 roll');

console.log('fishing ok (' + areas.length + ' water areas)');
