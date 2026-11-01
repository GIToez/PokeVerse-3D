import { criarBatalha } from '../server_battle.mjs';

const sent = [];
const contas = {
  ash: {
    save: {
      dinheiro: 50000,
      itens: {},
      bolas: {},
      insignias: [101, 102, 103, 104, 105, 106, 107, 108],
      treinadorPago: [],
      time: [
        {
          uid: 'p1',
          dex: 25,
          nome: 'Pikachu',
          lv: 50,
          exp: 0,
          hp: 200,
          maxHp: 200,
          ivs: [31, 31, 31, 31, 31, 31],
          natureza: 'Jolly',
          movs: [
            { id: 'thunderbolt', pp: 15, ppMax: 15 },
            { id: 'tackle', pp: 35, ppMax: 35 },
          ],
        },
      ],
    },
    rev: 1,
  },
};
const sessoes = new Map([['tok', 'ash']]);
const conexoes = new Map();
const ws = { _id: '1', _usuario: 'ash', _info: { token: 'tok', nome: 'Ash', x: 0, z: 0 }, _mapa: 'kanto', readyState: 1 };
conexoes.set('1', ws);

const batalha = criarBatalha({
  contas,
  sessoes,
  conexoes,
  enviar: (_w, obj) => sent.push(obj),
  socketsDe: () => [ws],
  salvarContas: () => {},
  aplicarEvento: () => null,
  enviarMissao: () => {},
});

function last() {
  return sent[sent.length - 1];
}

batalha.receber(ws, { t: 'bat_desafiar', tipo: 'treinador', id: '4120102@1,1' });
const open = last();
if (open.t !== 'bat' || !open.dele?.length) throw new Error('trainer challenge failed: ' + JSON.stringify(open));
if (open.nomeInimigo !== 'Camper-Keiji') throw new Error('wrong trainer name ' + open.nomeInimigo);

batalha.receber(ws, { t: 'bat_sair' });
const quit = last();
if (!quit.fim?.desistiu) throw new Error('forfeit should set desistiu');

batalha.receber(ws, { t: 'bat_desafiar', tipo: 'ginasio', id: 101 });
const gym = last();
if (gym.t !== 'bat' || gym.nomeInimigo !== 'Brock') throw new Error('gym failed: ' + JSON.stringify(gym));
batalha.receber(ws, { t: 'bat_sair' });

batalha.receber(ws, { t: 'bat_desafiar', tipo: 'elite', id: 2 });
const skip = last();
if (skip.t !== 'bat_erro' || skip.code !== 'order') throw new Error('E4 should require room 1 first: ' + JSON.stringify(skip));

batalha.receber(ws, { t: 'bat_desafiar', tipo: 'elite', id: 1 });
const e4 = last();
if (e4.t !== 'bat' || e4.nomeInimigo !== 'Lorelei') throw new Error('E4 Lorelei failed: ' + JSON.stringify(e4));
if (!batalha.bloquearCura('ash')) throw new Error('E4 run should block healing');

const { dano, eff } = batalha._test.calcularDano(
  { dex: 25, lv: 50, ivs: [31, 31, 31, 31, 31, 31], natureza: 'Timid' },
  { dex: 7, lv: 10, ivs: [0, 0, 0, 0, 0, 0], natureza: 'Hardy' },
  { id: 'thunderbolt', tipo: 'Electric', poder: 90, cat: 'especial' },
  () => 1,
);
if (!(dano > 10) || eff !== 2) throw new Error('damage/STAB/type math looks wrong ' + dano + ' ' + eff);

if (!batalha._test.treinadorPorId('4120102@9,9')) throw new Error('spotKey should resolve by cfg');
if (!batalha._test.ginasioPorId(101)) throw new Error('gym 101 missing');

batalha.receber(ws, { t: 'bat_sair' });
contas.ash.save.elite.corrida = null;
batalha.receber(ws, { t: 'bat_desafiar', tipo: 'treinador', id: '4120102' });
let rounds = 0, end = null;
while (rounds++ < 20) {
  batalha.receber(ws, { t: 'bat_acao', acao: 'golpe', golpe: 'thunderbolt', vez: last().vez });
  end = last();
  if (end.t === 'bat_erro') throw new Error('action failed: ' + JSON.stringify(end));
  if (end.fim) break;
}
if (!end?.fim?.venceu) throw new Error('expected to beat Camper-Keiji: ' + JSON.stringify(end));
if (!contas.ash.save.treinadorPago.length) throw new Error('trainer payout missing');
if (!(contas.ash.save.dinheiro > 50000)) throw new Error('prize money missing');

batalha.receber(ws, { t: 'bat_desafiar', tipo: 'treinador', id: '4120102' });
const again = last();
if (again.code !== 'beaten') throw new Error('already-beaten trainer must use English code beaten, not vencido: ' + JSON.stringify(again));
if (again.codigo) throw new Error('protocol field is code, not codigo: ' + JSON.stringify(again));

console.log('battle tests ok', { trainer: open.nomeInimigo, gym: gym.nomeInimigo, e4: e4.nomeInimigo, thunderbolt: dano, eff, winRounds: rounds });
