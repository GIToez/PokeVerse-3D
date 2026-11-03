/** Major status comes from the PokéAPI stamp on moves.json, and the medicines clear it. */
import { criarBolsa } from '../server_bag.mjs';
import * as Status from '../status.mjs';
import { readFileSync } from 'node:fs';

const moves = JSON.parse(readFileSync(new URL('../public/data/moves.json', import.meta.url), 'utf8'));
const bag = criarBolsa({ dadosPub: 'public/data', salvar() {}, bloquearCura: () => false });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function mon(uid, extra = {}) {
  return { uid, nome: extra.nome || 'X', hp: 10, maxHp: 100, amizade: 70, ...extra, uid };
}
function conta(itens, time) {
  return { save: { itens: { ...itens }, time, dinheiro: 0, bolas: {} } };
}
function usar(c, item, uid) {
  return bag.tratar(c, 'usar', { item, uid }, {});
}

const tw = moves.thunderwave;
assert(tw.status === 'paralysis' && tw.statusChance === 100, 'thunder wave ' + JSON.stringify({ s: tw.status, c: tw.statusChance }));
assert(moves.willowisp.status === 'burn' && moves.willowisp.statusChance === 100, 'will-o-wisp');
assert(moves.toxic.status === 'toxic' && moves.toxic.statusChance === 100, 'toxic is bad poison');
assert(moves.poisonpowder.status === 'poison' && moves.poisonpowder.statusChance === 100, 'poison powder');
assert(moves.ember.status === 'burn' && moves.ember.statusChance === 10, 'ember chance');
assert(moves.flamethrower.status === 'burn' && moves.flamethrower.statusChance === 10, 'flamethrower');
assert(moves.thunderbolt.status === 'paralysis' && moves.thunderbolt.statusChance === 10, 'thunderbolt');
assert(moves.nuzzle.status === 'paralysis' && moves.nuzzle.statusChance === 100, 'nuzzle');
assert(moves.sleeppowder.status === 'sleep' && moves.sleeppowder.statusChance === 100 && moves.sleeppowder.statusTurns?.[0] === 2 && moves.sleeppowder.statusTurns?.[1] === 4, 'sleep powder turns');
assert(moves.poisonfang.status === 'toxic' && moves.poisonfang.statusChance === 50, 'poison fang');
const rest = moves.rest;
assert(rest.status === 'sleep' && rest.statusChance === 100 && rest.statusTurns?.[0] === 2 && rest.statusTurns?.[1] === 2, 'rest sleep ' + JSON.stringify(rest.statusTurns));
assert(rest.statusCura === 'cheio' && rest.statusEm === 'eu', 'rest heals the user');
assert(rest.nomePt === 'Descanso' && rest.pp === 5 && rest.proprio === true, 'rest presentation');
const tri = moves.triattack;
assert(tri.statusChance === 20 && Array.isArray(tri.statusPool) && ['paralysis', 'burn', 'freeze'].every(id => tri.statusPool.includes(id)), 'tri attack pool');
assert(!moves.growl.status && !moves.growl.statusPool, 'growl has no status');
assert(!moves.tackle.status && !moves.tackle.statusPool, 'tackle has no status');
assert(!moves.yawn?.status && !moves.beakblast?.status && !moves.refresh?.status, 'yawn, beak blast, and refresh are not major statuses');
assert(moves.tackle.alcance === 1.3 && moves.growl.nomePt === 'Rosnado', 'presentation survived the stamp');

{
  const m = { hp: 40, maxHp: 40, status: null };
  assert(Status.doGolpe(m, moves.thunderwave, ['Normal'], () => 0)?.id === 'paralysis', 'thunder wave lands');
  assert(Status.doGolpe(m, moves.willowisp, ['Normal'], () => 0) === null, 'already statused');
}
{
  const m = { hp: 40, maxHp: 40, status: null };
  assert(Status.doGolpe(m, moves.ember, ['Normal'], () => 0.05)?.id === 'burn', 'ember 10% hits');
  const miss = { hp: 40, maxHp: 40, status: null };
  assert(Status.doGolpe(miss, moves.ember, ['Normal'], () => 0.5) === null, 'ember 10% misses');
}
assert(Status.doGolpe({ hp: 40, maxHp: 40 }, moves.willowisp, ['Fire'], () => 0) === null, 'fire immune to burn');
assert(Status.doGolpe({ hp: 40, maxHp: 40 }, moves.poisonpowder, ['Poison'], () => 0) === null, 'poison immune to poison');
assert(Status.doGolpe({ hp: 40, maxHp: 40 }, moves.poisonpowder, ['Steel'], () => 0) === null, 'steel immune to poison');

{
  const m = { hp: 20, maxHp: 80, status: null };
  const got = Status.doGolpe(m, rest, ['Normal'], () => 0);
  assert(got?.id === 'sleep' && got.n === 2, 'rest sleeps for 2, got ' + JSON.stringify(got));
  assert(Status.podeAgir(m).age === false && m.status?.n === 1, 'first sleep turn');
  assert(Status.podeAgir(m).age === false && m.status == null, 'second sleep turn clears');
  assert(Status.podeAgir(m).age === true, 'awake on the next try');
}

{
  const seq = [0, 0, 0, 1 / 3, 0, 2 / 3];
  let i = 0;
  const picks = new Set();
  for (let n = 0; n < 3; n++) {
    const m = { hp: 40, maxHp: 40, status: null };
    picks.add(Status.doGolpe(m, tri, ['Normal'], () => seq[i++])?.id);
  }
  assert(picks.size === 3, 'tri attack rolls the pool ' + [...picks]);
}

{
  const burned = mon('a', { hp: 100, maxHp: 100, status: { id: 'burn', n: 0 } });
  const full = conta({ 2005: 1 }, [burned]);
  const r = usar(full, 2005, 'a');
  assert(!r.erro, 'full restore at full hp with burn: ' + r.erro);
  assert(full.save.time[0].status == null, 'full restore cleared burn');
  assert(full.save.time[0].hp === 100, 'full restore kept full hp');
  assert(!full.save.itens['2005'], 'full restore was consumed');
}
{
  const healthy = mon('a', { hp: 100, maxHp: 100 });
  const c = conta({ 2005: 1 }, [healthy]);
  const r = usar(c, 2005, 'a');
  assert(r.erro, 'full restore at full hp with no status should fail');
  assert(c.save.itens['2005'] === 1, 'full restore was consumed at full hp');
  assert(c.save.time[0].hp === 100, 'full restore changed hp');
}
{
  const burned = mon('a', { hp: 40, maxHp: 100, status: { id: 'burn', n: 0 } });
  const c = conta({ 2005: 1 }, [burned]);
  usar(c, 2005, 'a');
  assert(c.save.time[0].hp === 100 && c.save.time[0].status == null, 'full restore filled hp and cleared burn');
}
{
  const poisoned = mon('a', { hp: 40, status: { id: 'poison', n: 0 } });
  const c = conta({ 2006: 1 }, [poisoned]);
  const r = usar(c, 2006, 'a');
  assert(!r.erro && c.save.time[0].status == null && c.save.time[0].hp === 40, 'antidote cleared poison');
  assert(!c.save.itens['2006'], 'antidote was not consumed');
}
{
  const burned = mon('a', { hp: 40, status: { id: 'burn', n: 0 } });
  const c = conta({ 2006: 1 }, [burned]);
  const r = usar(c, 2006, 'a');
  assert(r.erro, 'antidote cured a burn');
  assert(c.save.itens['2006'] === 1 && c.save.time[0].status.id === 'burn', 'antidote on burn was consumed');
}
{
  const healthy = mon('a');
  const c = conta({ 2006: 1 }, [healthy]);
  const r = usar(c, 2006, 'a');
  assert(r.erro, 'antidote on a healthy mon');
  assert(c.save.itens['2006'] === 1 && c.save.time[0].hp === 10, 'antidote on healthy was consumed or changed hp');
}
{
  const toxic = { hp: 80, maxHp: 80, status: { id: 'toxic', n: 1 } };
  const a = Status.residual(toxic);
  const b = Status.residual(toxic);
  assert(a === 5 && b === 10 && toxic.status.n === 3, 'toxic climbs ' + a + ',' + b + ' n=' + toxic.status?.n);
}
{
  const burned = { hp: 32, maxHp: 32, status: { id: 'burn', n: 0 } };
  assert(Status.residual(burned) === 2, 'burn is 1/16');
  assert(Status.mulAtaque(burned, true) === 0.5 && Status.mulAtaque(burned, false) === 1, 'burn halves physical attack');
}

{
  // real time: sleep wears off by the clock (SONO_TURNO_S per turn), and an attempt does not spend a turn
  const m = { hp: 10, maxHp: 10, status: { id: 'sleep', n: 3 } };
  for (let i = 0; i < 5; i++) assert(!Status.podeAgir(m, Math.random, { relogio: true }).age, 'asleep cannot act');
  assert(m.status.n === 3, 'a real-time attempt spent a sleep turn');
  let acordou = false, t = 0;
  while (!acordou && t < 30) { acordou = Status.sonoRelogio(m, 0.1); t += 0.1; }
  assert(acordou && !m.status, 'sleep did not wear off');
  assert(Math.abs(t - 3 * Status.SONO_TURNO_S) < 0.15, 'sleep of 3 turns lasted ' + t.toFixed(2) + ' s');
  const turno = { hp: 10, maxHp: 10, status: { id: 'sleep', n: 2 } };
  Status.podeAgir(turno);
  assert(turno.status.n === 1, 'turn battles still count turns');
}
console.log('status ok');
