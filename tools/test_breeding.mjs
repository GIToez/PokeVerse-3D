/* Day Care rules (server_breeding.mjs): who can breed, what the Egg inherits, hatching by walking.  node tools/test_breeding.mjs */
import { createBreeding } from '../server_breeding.mjs';
import * as Ind from '../individual.mjs';
import fs from 'node:fs';
Ind.carregarLearnset(JSON.parse(fs.readFileSync(new URL('../public/data/learnset.json', import.meta.url))));
const moves = JSON.parse(fs.readFileSync(new URL('../public/data/moves.json', import.meta.url)));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const mon = (uid, dex, nome, extra = {}) => ({ uid, dex, nome, lv: 30, ivs: [31, 31, 31, 31, 31, 31], natureza: 'Adamant', movs: [{ id: 'tackle' }], ...extra });
const contas = { ash: { save: { time: [], caixa: [] }, rev: 0 } };
const sent = [];
const B = createBreeding({ dataDir: new URL('../public/data', import.meta.url).pathname, accounts: contas, saveAccounts() {}, send: (w, o) => sent.push(o), socketsOf: () => [{}],
  newIndividual: b => ({ ...b, uid: 'n' + Math.random(), ivs: [0, 0, 0, 0, 0, 0], natureza: 'Hardy', shiny: false }), markCaught() {}, gameConfig: () => ({}), Ind, moveExists: id => !!moves[id],
  grantExp: (p, save, n) => { const a = p.lv; p.exp = (p.exp || 0) + n; p.lv = Math.min(100, a + Math.floor(p.exp / 1000) - Math.floor((p.exp - n) / 1000)); return { gained: n, levels: p.lv - a }; } });   // 1 level per 1,000 EXP
const T = B._test;
// gender comes from the uid, same answer every time
const g1 = T.sexoDe(mon('x1', 25, 'Pikachu')); ok(g1 === T.sexoDe(mon('x1', 25, 'Pikachu')) && (g1 === 'm' || g1 === 'f'), 'gender is stable: ' + g1);
ok(T.sexoDe(mon('x', 81, 'Magnemite')) === null, 'Magnemite is genderless');
ok(T.sexoDe(mon('x', 113, 'Chansey')) === 'f', 'Chansey is always female');
const m = mon('m', 4, 'Charmander', { sexo: 'm' }), f = mon('f', 4, 'Charmander', { sexo: 'f' });
ok(T.compat(m, f).ok, 'male + female Charmander');
ok(!T.compat(m, { ...m, uid: 'm2' }).ok, 'two males can\'t');
ok(T.compat(mon('d', 132, 'Ditto'), mon('mg', 81, 'Magnemite')).ok, 'Ditto + Magnemite');
ok(!T.compat(mon('d', 132, 'Ditto'), mon('d2', 132, 'Ditto')).ok, 'two Ditto can\'t');
ok(!T.compat(mon('l', 144, 'Articuno'), mon('d', 132, 'Ditto')).ok, 'Articuno (Undiscovered) can\'t');
ok(T.compat(mon('m', 1, 'Bulbasaur', { sexo: 'm' }), mon('f', 4, 'Charmander', { sexo: 'f' })).ok, 'Bulbasaur ♂ + Charmander ♀ share Monster');
ok(T.especieDoOvo(mon('r', 26, 'Raichu', { sexo: 'f' })) === 172, 'Raichu mother → Pichu egg');
ok(T.especieDoOvo(mon('r', 184, 'Azumarill', { sexo: 'f' })) === 183, 'Azumarill mother → Marill egg (no incense)');
ok(T.compat(mon('g1', 443, 'Gible', { sexo: 'm' }), mon('g2', 445, 'Garchomp', { sexo: 'f' })).ok && T.especieDoOvo(mon('g2', 445, 'Garchomp')) === 443, 'Gen 4: Garchomp ♀ + Gible ♂ → Gible');
ok(T.compat(mon('s1', 906, 'Sprigatito', { sexo: 'f' }), mon('d', 132, 'Ditto')).ok, 'Gen 9: Sprigatito + Ditto');
// inheritance
const pai = mon('p', 1, 'Bulbasaur', { sexo: 'm', ivs: [31, 31, 31, 31, 31, 31], held: { id: 950002 }, movs: [{ id: 'petaldance' }, { id: 'gigadrain' }] });
const mae = mon('q', 1, 'Bulbasaur', { sexo: 'f', ivs: [0, 0, 0, 0, 0, 0], held: { id: 950001 }, natureza: 'Timid' });
let perfeitos = 0, natOk = 0, eggMove = 0;
for (let i = 0; i < 200; i++) { const o = T.montarOvo(pai, mae, T.compat(pai, mae)); perfeitos += o.dentro.herdou.length === 5 ? 1 : 0; natOk += o.dentro.natureza === 'Timid' ? 1 : 0; eggMove += o.dentro.movs.includes('petaldance') ? 1 : 0; }
ok(perfeitos === 200, 'Destiny Knot passes 5 IVs (' + perfeitos + '/200)');
ok(natOk === 200, 'Everstone passes the nature (' + natOk + '/200)');
ok(eggMove === 200, 'egg move Petal Dance from the father (' + eggMove + '/200)');
const pw = mon('w', 1, 'Bulbasaur', { sexo: 'm', ivs: [0, 0, 0, 0, 0, 31], held: { id: 950008 } });
let spe = 0; for (let i = 0; i < 200; i++) { const o = T.montarOvo(pw, mae, T.compat(pw, mae)); spe += o.dentro.herdou.includes(5) && o.dentro.ivs[5] === 31 ? 1 : 0; }
ok(spe === 200, 'Power Anklet always passes Speed (' + spe + '/200)');
// the Day Care: leave two, wait, take the Egg, walk, hatch
const s = contas.ash.save; s.time = [mon('c1', 4, 'Charmander', { sexo: 'm' }), mon('c2', 4, 'Charmander', { sexo: 'f' }), mon('c3', 25, 'Pikachu')];
ok(B.operar('ash', { op: 'deixar', uid: 'c1' }).ok && B.operar('ash', { op: 'deixar', uid: 'c2' }).ok, 'left two Charmander');
ok(B.operar('ash', { op: 'deixar', uid: 'c3' }).erro, 'a third is refused');
ok(s.time.length === 1, 'party keeps Pikachu');
const k = T.creche(contas.ash); k.tentativa = Date.now() - 10 * 24 * 3600e3;   // ten days later (enough rolls that an Egg always comes)
const v = B.operar('ash', { op: 'ver' }).vista;
ok(v.ovosEsperando >= 1, 'eggs after ten days: ' + v.ovosEsperando + ' (' + v.compat.linha + ')');
ok(B.operar('ash', { op: 'pegar' }).ok && s.ovos.length >= 1 && s.ovos.every(o => !o.prontoEm && !o.incubadora), 'took ' + s.ovos.length + ' egg(s): no timer until an incubator');
ok(+s.presos?.['900030'] === 1, 'the first Incubator is free');
const antes = s.time.length + s.caixa.length, nOvos = s.ovos.length;
ok(B.chocarProntos('ash') === 0, 'nothing hatches before its time');
ok(B.chocarProntos('ash') === 0, 'an Egg in the Bag never hatches');
s.ovos.forEach((o, i) => { o.incubadora = 'incubadora#' + (i + 1); o.prontoEm = Date.now() - 1; });   // in incubators, time up
ok(B.chocarProntos('ash') === nOvos && s.ovos.length === 0 && s.time.length + s.caixa.length === antes + nOvos, 'they hatch when the time is up');
const bebe = sent.find(o => o.t === 'ovo_chocou')?.mon;
ok(bebe?.dex === 4 && bebe.lv === 1 && bebe.sexo, 'hatched ' + bebe?.nome + ' Lv' + bebe?.lv + ' ' + bebe?.sexo + ' moves ' + (bebe?.movs || []).map(x => x.id).join(','));
s.medalhaoAte = Date.now() + 864e5; k.tentativa = Date.now() - 2 * 24 * 3600e3; B.operar('ash', { op: 'ver' });

// EXP and the fee: a day at the Day Care
const e0 = k.estadia[0], lv0 = k.pais[0].lv; e0.ultimo -= 1440 * 60e3;
const v2 = B.operar('ash', { op: 'ver' }).vista;
ok(v2.estadia[0].exp === 14400 && k.pais[0].lv === lv0 + 14 && v2.estadia[0].cresceu === 14, 'a day: 14400 EXP, +' + v2.estadia[0].cresceu + ' levels');
const taxa = v2.estadia[0].taxa;
let esperado = 0; for (let m = 0, lv = lv0, xp = 0; m < 1440; m += 5) { esperado += 5 * lv * 0.1; xp += 50; lv = lv0 + Math.floor(xp / 1000); }
ok(taxa === Math.ceil(esperado) && taxa > Math.ceil(1440 * lv0 * 0.1), 'fee ' + taxa + ' Coins, rising with each level (flat Lv ' + lv0 + ' would be ' + Math.ceil(1440 * lv0 * 0.1) + ')');
e0.ultimo -= 2 * 1440 * 60e3; const v3 = B.operar('ash', { op: 'ver' }).vista;
ok(v3.estadia[0].exp === 14400 && v3.estadia[0].taxa === taxa && v3.estadia[0].cheio, 'two more days: EXP and fee stay maxed at one day');
s.dinheiro = taxa - 1;
ok(B.operar('ash', { op: 'retirar', i: 0 }).erro, 'not enough Coins: refused');
s.dinheiro = taxa + 5;
const r0 = B.operar('ash', { op: 'retirar', i: 0 });
ok(r0.ok && s.dinheiro === 5, 'paid: ' + r0.aviso);
ok(B.operar('ash', { op: 'retirar', i: 1 }).ok, 'took the other back');
contas.ash.gm = true; const d0 = [...s.time, ...s.caixa][0];
B.operar('ash', { op: 'deixar', uid: d0.uid }); k.estadia[0].ultimo -= 600 * 60e3;
ok(B.operar('ash', { op: 'ver' }).vista.estadia[0].taxa === 0 && B.operar('ash', { op: 'retirar', i: 0 }).ok, 'GM: free');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
