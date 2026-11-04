/* Celadon TM counter: learnset, badge gate, coins, a full moveset, and the account bag op. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Tm from '../tm.mjs';
import { criarBolsa } from '../server_bag.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = nome => JSON.parse(readFileSync(join(root, 'public/data', nome), 'utf8'));
const beta = ler('tm_beta.json');
const learn = ler('biblioteca/candidatos/learnset_tm_beta.json');
const regras = ler('tm_regras.json');
const moves = ler('moves.json');
const cat = Tm.catalogo({ beta, learnset: learn, regras, golpe: id => moves[id] || null });

const charm = cat.porChave.get('charm');
const take = cat.porChave.get('takedown');
assert.ok(charm && charm.faixa === 'comum' && charm.preco === 1000 && charm.trava === 0, 'Charm is a free-badge TM');
assert.ok(take && take.faixa === 'forte' && take.preco === 5000 && take.trava === 3, 'Take Down needs 3 badges');
assert.equal(cat.porChave.has('substitute'), false, 'a move the battle engine cannot run stays off the counter');
for (const fora of ['snatch', 'embargo', 'quash', 'auroraveil']) assert.equal(cat.tutor.has(fora), false, fora + ' is not taught');
assert.ok(cat.tutor.has('frostbreath') || cat.tutor.has('healbell') || cat.tutor.has('volttackle'), 'a tutor move the engine can run is on the counter');

const bulba = { uid: 'b', dex: 1, nome: 'Bulbasaur', movs: [{ id: 'tackle', pp: 35, ppMax: 35 }] };
assert.equal(Tm.podeAprender(cat, bulba, charm).ok, true);
assert.equal(Tm.podeAprender(cat, { dex: 19, nome: 'Rattata', movs: [] }, charm).ok, false);
assert.match(Tm.cobrar(take, { insignias: [], dinheiro: 99999 }).erro, /3 badges/);
assert.match(Tm.cobrar(charm, { insignias: 0, dinheiro: 10 }).erro, /Not enough Coins/);
assert.equal(Tm.cobrar(charm, { insignias: ['a', 'b', 'c'], dinheiro: 1000 }).ok, true);

const cheio = { dex: 1, nome: 'Bulbasaur', movs: ['tackle', 'growl', 'leechseed', 'vinewhip'].map(id => ({ id, pp: 10, ppMax: 10 })) };
const recusa = Tm.aplicar(cheio, charm, null);
assert.equal(recusa.ok, false);
assert.equal(recusa.cheio, true);
const trocou = Tm.aplicar(cheio, charm, 'growl');
assert.equal(trocou.ok, true);
assert.equal(trocou.esqueceu, 'growl');
assert.deepEqual(cheio.movs.map(m => m.id), ['tackle', 'charm', 'leechseed', 'vinewhip']);
assert.equal(cheio.movs[1].pp, charm.pp);

const bag = criarBolsa({ dadosPub: join(root, 'public/data'), salvar(){} });
const mon = { uid: 'b1', dex: 1, nome: 'Bulbasaur', hp: 20, maxHp: 20, movs: [{ id: 'tackle', pp: 35, ppMax: 35 }] };
const c = { save: { time: [mon], caixa: [], dinheiro: 1000, insignias: [], itens: {}, bolas: {} } };
const ensinou = bag.tratar(c, 'tm', { uid: 'b1', chave: 'charm' });
assert.equal(ensinou.erro, undefined);
assert.equal(ensinou.aprendeu, 'Charm');
assert.equal(c.save.dinheiro, 0);
assert.ok(mon.movs.some(m => m.id === 'charm' && m.pp === charm.pp));
assert.ok(ensinou.vidas?.[0]?.movs?.some(m => m.id === 'charm'), 'the reply carries the new moves');
const semGrana = bag.tratar(c, 'tm', { uid: 'b1', chave: 'protect' });
assert.match(semGrana.erro || '', /Not enough Coins|can't learn|not taught/);
const semBadge = bag.tratar({ save: { time: [mon], dinheiro: 99999, insignias: [], itens: {}, bolas: {} } }, 'tm', { uid: 'b1', chave: 'takedown' });
assert.match(semBadge.erro, /3 badges/);
const fora = bag.tratar(c, 'tm', { uid: 'b1', chave: 'snatch', tutor: true });
assert.match(fora.erro, /not taught/);

const npc = JSON.parse(readFileSync(join(root, 'public/data/npcs_glb.json'), 'utf8'))['2158801'];
assert.equal(npc.falas[0], 'I teach TMs. Pick a move and a Pokémon.');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert.match(index, /\+n\.cfg === 2158801\) TmCounter\.abrir/);
assert.match(index, /if \(Array\.isArray\(v\.movs\)\) e\.movs/);
const bagSrc = readFileSync(join(root, 'server_bag.mjs'), 'utf8');
assert.match(bagSrc, /tm: tmOp/);

console.log('tm ok', cat.porChave.size, 'tms', cat.tutor.size, 'tutor');
