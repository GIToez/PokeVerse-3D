/* Boss system tests (boss_rules.mjs + server_battle.mjs tipo 'boss'): levels follow the party, tier prizes, repeat rules, and the
   catch of a Pokémon boss (an ordinary Pokémon afterwards, shiny kept). Uses an in-memory account; nothing is written to disk. */
import assert from 'node:assert/strict';
import * as BossR from '../boss_rules.mjs';
import { criarBatalha } from '../server_battle.mjs';

// ── rules ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const dados = {
  niveis: { vermelho: { bonus: 5, multDinheiro: 2, multItens: 3, ivs: 20, recompensas: [{ item: 1003, qtd: 1 }] } },
  bosses: {
    1: { tipo: 'npc', nome: 'A', nivel: 'vermelho', time: [{ dex: 24, delta: -3 }, { dex: 42 }], dinheiro: 100, recompensas: [{ item: 2013, qtd: 2 }], repeticao: 'umaVez' },
    2: { tipo: 'pokemon', nome: 'B', nivel: 'roxo', shiny: true, time: [{ dex: 130 }], lvMin: 30, captura: { ativa: true, modo: 'garantida' } },
    3: { tipo: 'pokemon', nome: 'C', nivel: 'cinza', time: [{ dex: 129 }], lvMax: 10, cooldownMin: 60, captura: { ativa: true } },
  },
};
assert.equal(BossR.maiorNivel([{ lv: 12 }, { lv: 40 }, null, { lv: 3 }]), 40);
assert.deepEqual(BossR.montarTime(dados, dados.bosses[1], 20).map(p => p.lv), [22, 25]);          // 20 + 5, ace 25, the other −3
assert.equal(BossR.montarTime(dados, dados.bosses[1], 20)[0].ivs, 20);
assert.equal(BossR.montarTime(dados, dados.bosses[2], 70)[0].lv, 100);                              // purple +50, clamped to 100
assert.equal(BossR.montarTime(dados, dados.bosses[2], 5)[0].lv, 55);                                // 5 + 50 ≥ lvMin
assert.equal(BossR.montarTime(dados, dados.bosses[3], 50)[0].lv, 10);                               // lvMax
assert.equal(BossR.montarTime(dados, dados.bosses[2], 5)[0].shiny, true);
const R = BossR.recompensa(dados, dados.bosses[1]);
assert.equal(R.dinheiro, 200);
assert.deepEqual(R.itens.map(i => [i.item, i.qtd]), [[2013, 6], [1003, 1]]);                       // boss items × 3, tier extra as is
assert.equal(BossR.disponivel(dados.bosses[1], { vitorias: 1 }).code, 'once');
assert.equal(BossR.disponivel(dados.bosses[3], { ultimaVitoria: Date.now() - 30 * 60e3 }).code, 'wait');
assert.equal(BossR.disponivel(dados.bosses[3], { ultimaVitoria: Date.now() - 61 * 60e3 }).ok, true);
assert.equal(BossR.disponivel(dados.bosses[2], { capturado: Date.now() }).code, 'once');
assert.equal(BossR.sacudidas(45, 255), 4);
const caught = BossR.monCapturado({}, { dex: 130, lv: 55, glb: 'pm0130_00', shiny: true, ivs: 31 });
assert.deepEqual(caught, { dex: 130, lv: 55, glb: 'pm0130_00', shiny: true });                       // no boss IVs carried over

// ── server flow, with the real bosses.json ───────────────────────────────────────────────────────────────────────────
const contas = { ana: { save: { time: [{ dex: 25, lv: 22, uid: 'a1', nome: 'Pikachu' }, { dex: 1, lv: 12, uid: 'a2', nome: 'Bulbasaur' }], dinheiro: 100, itens: {}, bolas: { 1001: 3, 1004: 1 } } } };
const ctx = {
  contas, sessoes: new Map([['tk', 'ana']]), conexoes: new Map(), enviar() {}, socketsDe: () => [], salvarContas() {}, gameConfig: () => ({}),
  novoIndividuo: b => ({ ...b, ivs: [1, 2, 3, 4, 5, 6], natureza: 'Bold', shiny: false, uid: 'novo' }), marcarPego() {}, bolaBonus: () => 1,
};
const B = criarBatalha(ctx);
const ws = { _usuario: 'ana', _info: { token: 'tk' }, _id: 1 }, acc = { u: 'ana', c: contas.ana };
const D = B._test.bossPorId('8800002');
assert.ok(D, 'public/data/bosses.json has the example Pokémon boss 8800002');
const r = B._test.abrirNpc(ws, acc, 'boss', '8800002');
assert.ok(!r.erro, r.erro);
const tier = BossR.nivelDe(D.d, D.b);
assert.equal(r.dele[0].lv, Math.max(22 + tier.bonus, D.b.lvMin || 1));
assert.equal(r.boss.id, '8800002');
const bat = B._test.lutas.get('ana');
const fim = B._test.pagar(acc, bat, true, {});
B._test.lutas.delete('ana');
assert.ok(fim.captura, 'a catchable Pokémon boss opens a catch window');
assert.equal(B._test.abrirNpc(ws, acc, 'boss', 'nope').code, 'target');
const t = B._test.capturarBoss(ws, { bola: 1004 });                                                // Master Ball
assert.equal(t.ok, true);
assert.equal(t.mon.shiny, !!D.b.shiny);                                                            // shiny kept, never rerolled
assert.deepEqual(t.mon.ivs, [1, 2, 3, 4, 5, 6]);                                                   // fresh individual, not the boss's IVs
assert.equal(t.mon.origem, 'boss');
assert.equal(contas.ana.save.time.at(-1).dex, 130);
assert.equal(contas.ana.save.bolas[1004], undefined);
assert.equal(B._test.capturarBoss(ws, { bola: 1001 }).code, 'gone');                               // the window is closed
assert.equal(B._test.estadoBosses(ws).estado['8800002'].capturado, true);
assert.equal(B._test.abrirNpc(ws, acc, 'boss', '8800002').code, 'beaten');                         // caught once: gone for this account
console.log('boss tests ok', { tierLv: r.dele[0].lv, premio: fim.premio, pego: t.mon.nome + (t.mon.shiny ? ' ✨' : '') });
process.exit(0);
