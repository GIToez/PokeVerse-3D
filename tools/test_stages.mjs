/* Stat stages and Leech Seed: the shared module, the move catalog, and the turn battle on the server. */
import fs from 'node:fs';
import * as Stg from '../stages.mjs';
import { criarBatalha } from '../server_battle.mjs';

const ok = (c, msg) => { if (!c) throw new Error(msg); };

// ── stages.mjs ──
ok(Stg.mult(0) === 1 && Stg.mult(1) === 1.5 && Stg.mult(6) === 4 && Stg.mult(-1) === 2 / 3 && Stg.mult(-6) === 0.25, 'stat multipliers');
ok(Stg.multPrec(-1) === 0.75 && Stg.multPrec(6) === 3 && Stg.multPrec(-6) === 1 / 3, 'accuracy multipliers');
{
  const e = Stg.novo();
  const r = Stg.aplicar(e, [['atk', 2], ['def', -1]]);
  ok(e.atk === 2 && e.def === -1 && r[0].real === 2, 'apply');
  e.atk = 6;
  ok(Stg.aplicar(e, [['atk', 1]])[0].real === 0, 'cap at +6');
  ok(Stg.frase('Bulbasaur', { atributo: 'atk', n: 1, real: 0 }) === "Bulbasaur's Attack won't go any higher!", 'cap text');
  ok(Stg.frase('Rattata', { atributo: 'prec', n: -1, real: -1 }) === "Rattata's accuracy fell!", 'fell text');
  ok(Stg.chance(1, { cat: 'status' }, { prec: -1 }, null) === 0.75, 'smokescreen hit chance');
  ok(Stg.chance(1, { cat: 'status', estagiosEm: 'eu' }, { prec: -6 }, null) === 1, 'self moves never miss');
}

// ── the catalog ──
const moves = JSON.parse(fs.readFileSync(new URL('../public/data/moves.json', import.meta.url), 'utf8'));
const st = (id) => JSON.stringify(moves[id].estagios);
ok(st('growth') === '[["atk",1],["spa",1]]' && moves.growth.estagiosEm === 'eu', 'growth data');
ok(st('growl') === '[["atk",-1]]' && !moves.growl.estagiosEm, 'growl data');
ok(st('smokescreen') === '[["prec",-1]]', 'smokescreen data');
ok(moves.leechseed.semente === true, 'leech seed data');
ok(moves.closecombat.estagiosEm === 'eu' && !moves.closecombat.estagiosChance, 'close combat lands on the user');
ok(moves.psychic.estagiosChance === 10 && !moves.psychic.estagiosEm, 'psychic 10% SpD drop');

// ── turn battle ──
const mon = (uid, dex, nome, movs) => ({ uid, dex, nome, lv: 60, exp: 0, hp: 999, ivs: [31, 31, 31, 31, 31, 31], natureza: 'Hardy', movs: movs.map((id) => ({ id, pp: 40, ppMax: 40 })) });
const contas = { ash: { save: { dinheiro: 0, itens: {}, bolas: {}, insignias: [], treinadorPago: [], time: [mon('p1', 1, 'Bulbasaur', ['growth', 'leechseed', 'growl', 'smokescreen'])] }, rev: 1 } };
const sent = [];
const ws = { _id: '1', _usuario: 'ash', _info: { token: 'tok', nome: 'Ash', x: 0, z: 0 }, _mapa: 'kanto', readyState: 1 };
const bat = criarBatalha({
  contas, sessoes: new Map([['tok', 'ash']]), conexoes: new Map([['1', ws]]),
  enviar: (_w, o) => sent.push(o), socketsDe: () => [ws], salvarContas: () => {}, aplicarEvento: () => null, enviarMissao: () => {},
});
const last = () => sent[sent.length - 1];
const jogar = (golpe) => { bat.receber(ws, { t: 'bat_acao', acao: 'golpe', golpe, vez: last().vez }); return last(); };

bat.receber(ws, { t: 'bat_desafiar', tipo: 'treinador', id: '4120102@1,1' });
ok(last().t === 'bat' && last().eu.estagios.atk === 0, 'battle opens with clean stages');

let r = jogar('growth');
ok(r.eu.estagios.atk === 1 && r.eu.estagios.spa === 1, 'growth raises Atk and SpA: ' + JSON.stringify(r.eu.estagios));
ok(r.lances.some((l) => l.estagios?.quem === 'eu'), 'growth lance carries the change');
ok(r.log.some((t) => /Attack rose!/.test(t)), 'growth log line');

r = jogar('growl');
ok(r.fim || r.ele.estagios.atk === -1, 'growl lowers the foe Attack: ' + JSON.stringify(r.ele));

r = jogar('leechseed');
if (!r.fim) {
  const l = r.lances.find((x) => x.golpe === 'leechseed');
  ok(l && (l.errou || l.semente === true || l.semente === 'imune'), 'leech seed lance: ' + JSON.stringify(l));
  if (l.semente === true) {
    ok(r.ele.semente === true, 'foe is seeded');
    ok(r.log.some((t) => /sapped by Leech Seed/.test(t)) || r.fim, 'seed drains at the end of the turn');
  }
}

ok(!('estagios' in contas.ash.save.time[0]) && !('semente' in contas.ash.save.time[0]), 'stages stay out of the save');
bat.receber(ws, { t: 'bat_sair' });
bat.receber(ws, { t: 'bat_desafiar', tipo: 'treinador', id: '4120102@1,1' });
ok(last().eu?.estagios?.atk === 0, 'a new battle starts clean');

console.log('stages ok');
