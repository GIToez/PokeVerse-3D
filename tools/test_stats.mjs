import assert from 'node:assert/strict';
import * as Ind from '../individual.mjs';
import * as Ev from '../ev.mjs';
import * as Weather from '../weather.mjs';
import { readFileSync } from 'node:fs';

const yields = JSON.parse(readFileSync(new URL('../public/data/ev_yields.json', import.meta.url), 'utf8'));
Ev.usarYields(yields);

const S = { bs: [35, 55, 40, 50, 50, 90] }; // Pikachu-ish
const p = Ind.garantir({ dex: 25, lv: 50, ivs: [31, 31, 31, 31, 31, 31], natureza: 'Hardy', evs: [0, 0, 0, 0, 0, 0] });
const spe0 = Ind.statDe(S, p, 5);
p.evs = [0, 0, 0, 0, 0, 252];
const spe252 = Ind.statDe(S, p, 5);
assert.ok(spe252 - spe0 >= 31, '252 Spe EVs add about 31 at lv 50, got ' + (spe252 - spe0));

const lv100 = { ...p, lv: 100, evs: [0, 0, 0, 0, 0, 252], natureza: 'Hardy' };
const base100 = Ind.statDe(S, { ...p, lv: 100, evs: [0, 0, 0, 0, 0, 0], natureza: 'Hardy' }, 5);
assert.equal(Ind.statDe(S, lv100, 5) - base100, 63, '252 Spe EVs add 63 at lv 100');

const ko = Ev.ganharPorKo({ evs: [0, 0, 0, 0, 0, 0] }, 16); // Pidgey: 1 Spe
assert.deepEqual(yields.rende['16'], [0, 0, 0, 0, 0, 1]);
assert.equal(ko.ganhou[5], 1);

const vit = Ev.usarItem({ evs: [0, 0, 0, 0, 0, 0] }, 50222);
assert.equal(vit.ok, true);
assert.equal(vit.evs[1], 10);

assert.equal(Weather.poderTipo('chuva', 'Water'), 1.5);
assert.equal(Weather.poderTipo('chuva', 'Fire'), 0.5);
assert.equal(Weather.poderTipo('sol', 'Fire'), 1.5);
assert.equal(Weather.poderGolpe('areia', { id: 'solarbeam' }, 120), 60);
assert.equal(Weather.precisao('chuva', { id: 'thunder' }), 1);
assert.equal(Weather.defesa('areia', ['Rock'], 4, 100), 150);

console.log('ok stats + weather');
