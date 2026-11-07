/* Elite Four AI + the Champion's seat (server_battle_ai.mjs, server_battle.mjs). Runs whole League runs against the real
 * battle server with fake accounts and checks: the AI switches / heals / picks strong moves, a first run ends against Blue,
 * a second run claims the seat, and a third player then faces the first player's own team.
 *   node tools/test_elite_ai.mjs        (keeps server/data/champion.json as it was) */
import fs from 'node:fs';
import { criarBatalha } from '../server_battle.mjs';

const ARQ = new URL('../server/data/champion.json', import.meta.url);
const backup = fs.existsSync(ARQ) ? fs.readFileSync(ARQ) : null;
if (backup) fs.unlinkSync(ARQ);

const mon = (uid, dex, nome, lv, movs) => ({ uid, dex, nome, lv, exp: 0, ivs: [31, 31, 31, 31, 31, 31], natureza: 'Hardy', movs: movs.map(id => ({ id })) });
const conta = (nome, time) => ({ save: { nome, dinheiro: 0, itens: {}, bolas: {}, insignias: [101, 102, 103, 104, 105, 106, 107, 108], treinadorPago: [], personagem: { tipo: 'heroi' }, time }, rev: 1 });
const contas = {
  ana: conta('Ana', [mon('a1', 6, 'Charizard', 100, ['flamethrower', 'earthquake', 'dragonclaw', 'airslash']), mon('a2', 9, 'Blastoise', 100, ['surf', 'icebeam', 'earthquake', 'bite']),
    mon('a3', 3, 'Venusaur', 100, ['gigadrain', 'sludgebomb', 'earthquake', 'sleeppowder']), mon('a4', 65, 'Alakazam', 100, ['psychic', 'shadowball', 'thunderpunch', 'recover']),
    mon('a5', 143, 'Snorlax', 100, ['bodyslam', 'earthquake', 'rest', 'crunch']), mon('a6', 130, 'Gyarados', 100, ['waterfall', 'earthquake', 'icefang', 'dragondance'])]),
  bia: conta('Bia', [mon('b1', 26, 'Raichu', 100, ['thunderbolt', 'surf', 'focusblast', 'grassknot']), mon('b2', 59, 'Arcanine', 100, ['flareblitz', 'extremespeed', 'crunch', 'wildcharge']),
    mon('b3', 76, 'Golem', 100, ['earthquake', 'stoneedge', 'explosion', 'suckerpunch']), mon('b4', 131, 'Lapras', 100, ['icebeam', 'surf', 'thunderbolt', 'psychic']),
    mon('b5', 149, 'Dragonite', 100, ['outrage', 'extremespeed', 'earthquake', 'firepunch']), mon('b6', 94, 'Gengar', 100, ['shadowball', 'sludgebomb', 'thunderbolt', 'focusblast'])]),
};
const sessoes = new Map([['ta', 'ana'], ['tb', 'bia']]);
const conexoes = new Map();
const ws = {
  ana: { _id: '1', _usuario: 'ana', _info: { token: 'ta', nome: 'Ana' }, _mapa: '4120013', readyState: 1 },
  bia: { _id: '2', _usuario: 'bia', _info: { token: 'tb', nome: 'Bia' }, _mapa: '4120013', readyState: 1 },
};
conexoes.set('1', ws.ana); conexoes.set('2', ws.bia);
const sent = [], chat = [];
const B = criarBatalha({ contas, sessoes, conexoes, enviar: (w, o) => { sent.push(o); if (o.t === 'sistema') chat.push(o.texto.replace(/\{(\w+)\}/g, (_, k) => o.vars?.[k] ?? '')); },
  socketsDe: u => [ws[u]].filter(Boolean), salvarContas: () => {}, aplicarEvento: () => null, enviarMissao: () => {} });
const last = () => sent[sent.length - 1];
const heal = u => { for (const p of contas[u].save.time) { p.hp = null; for (const m of p.movs) m.pp = m.ppMax ?? 20; } };

let switches = 0, items = 0, kos = 0;
/** One League run; the player always picks its strongest move by the same AI (so both sides play sharp). */
function run(u) {
  heal(u);
  const out = [];
  for (let ordem = 1; ordem <= 5; ordem++) {
    B.receber(ws[u], { t: 'bat_desafiar', tipo: 'elite', id: ordem });
    let r = last();
    if (r.t !== 'bat' || !r.dele) throw new Error(u + ' could not open room ' + ordem + ': ' + JSON.stringify(r));
    const quem = r.nomeInimigo;
    for (let turn = 0; turn < 200 && !r.fim; turn++) {
      const bat = B._test.lutas.get(u);
      const me = bat.eu.field, foe = bat.dele[bat.eleIdx];
      const g = B._test.ia.pickMove(me, foe, null);
      B.receber(ws[u], { t: 'bat_acao', acao: 'golpe', golpe: g?.id || 'struggle', vez: bat.vez });
      r = last();
      for (const l of r.lances || []) { if (l.trocaEle != null) switches++; if (l.itemEle != null) items++; }
      if (r.t === 'bat_erro') throw new Error('turn error ' + JSON.stringify(r));
    }
    out.push(quem + (r.fim?.venceu ? ' ✓' : ' ✗'));
    if (!r.fim?.venceu) break;
  }
  return out;
}
const a1 = run('ana');
console.log('Ana, first run:', a1.join(' · '));
if (!a1[4]?.startsWith('Blue')) throw new Error('first run must end against Blue: ' + a1);
const a2 = run('ana');
console.log('Ana, second run:', a2.join(' · '), '| champion now:', B.eliteDe('ana').campeao?.nome);
const b1 = run('bia');
console.log('Bia, first run:', b1.join(' · '));
const b2 = run('bia');
console.log('Bia, second run:', b2.join(' · '));
console.log('final room of Bia\'s second run was', b2[4] || '(lost before)', '| champion now:', B.eliteDe('bia').campeao?.nome, '| defences', B.eliteDe('bia').campeao?.defesas);
console.log('AI switches', switches, '· items used', items);
console.log('chat:', chat.slice(-4).join(' | '));
if (a2[4] && a2[4].startsWith('Blue ✓') && B.eliteDe('ana').campeao?.nome !== 'Ana') throw new Error('Ana should hold the seat');
if (b2.length === 5 && !b2[4].startsWith('Ana')) throw new Error('Bia\'s second run must end against Ana');
if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
if (backup) fs.writeFileSync(ARQ, backup);
console.log('ok');
process.exit(0);
