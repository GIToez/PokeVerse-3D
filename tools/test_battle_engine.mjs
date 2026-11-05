/* Turn battles on the battle engine (battle_engine.mjs via server_battle_engine.mjs): priority, Protect, paralysis,
   confusion, PP, switching, end-of-turn damage, stat stages, and a PvP turn. Run: node tools/test_battle_engine.mjs */
import { criarBatalha } from '../server_battle.mjs';

let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const mon = (uid, dex, nome, lv, movs, extra = {}) => ({ uid, dex, nome, lv, exp: 0, hp: 999, maxHp: 999, ivs: [31, 31, 31, 31, 31, 31], natureza: 'Hardy', movs: movs.map((id) => ({ id, pp: 20, ppMax: 20 })), ...extra });
const conta = (time) => ({ save: { dinheiro: 50000, itens: { 2002: 3 }, bolas: {}, insignias: [], treinadorPago: [], time }, rev: 1 });

function setup(contas, users) {
  const sent = new Map(), conexoes = new Map(), sessoes = new Map(), sockets = {};
  users.forEach((u, i) => {
    const ws = { _id: String(i + 1), _usuario: u, _info: { token: 'tok' + u, nome: u, x: i, z: 0 }, _mapa: 'kanto', readyState: 1 };
    conexoes.set(ws._id, ws); sessoes.set('tok' + u, u); sockets[u] = ws; sent.set(ws, []);
  });
  const B = criarBatalha({ contas, sessoes, conexoes, enviar: (w, o) => sent.get(w)?.push(o), socketsDe: (u) => [sockets[u]], salvarContas() {}, aplicarEvento: () => null, enviarMissao() {} });
  const last = (u) => sent.get(sockets[u]).at(-1);
  const act = (u, m) => { B.receber(sockets[u], { t: 'bat_acao', ...m, vez: last(u)?.vez }); return last(u); };
  return { B, sockets, last, act };
}

/* ── vs a trainer ── */
{
  const contas = { ash: conta([mon('p1', 25, 'Pikachu', 50, ['quickattack', 'thunderwave', 'protect', 'confuseray']), mon('p2', 7, 'Squirtle', 40, ['tackle'])]) };
  const { B, sockets, last, act } = setup(contas, ['ash']);
  B.receber(sockets.ash, { t: 'bat_desafiar', tipo: 'ginasio', id: 102 });   // Misty
  const open = last('ash');
  ok('gym battle opens on the engine', open.t === 'bat' && !!open.dele?.length, open.nomeInimigo);
  let r = act('ash', { acao: 'golpe', golpe: 'quickattack' });
  ok('Quick Attack (priority +1) goes first', r.lances?.[0]?.de === 'eu' && r.lances[0].golpe === 'quickattack', JSON.stringify(r.lances?.map((l) => l.de + ':' + l.golpe)));
  ok('PP is spent', contas.ash.save.time[0].movs.find((m) => m.id === 'quickattack').pp === 19);
  r = act('ash', { acao: 'golpe', golpe: 'thunderwave' });
  const tw = r.lances?.find((l) => l.golpe === 'thunderwave');
  ok('Thunder Wave paralyzes the foe (or misses / is immune / the user could not move)', tw ? (tw.statusId === 'paralysis' || tw.eff === 0 || tw.errou) : r.lances.some((l) => l.de === 'eu' && !l.golpe), JSON.stringify(tw));
  ok('the foe\'s status is in the snapshot', !tw?.statusId || r.ele?.status?.id === 'paralysis', JSON.stringify(r.ele?.status));
  r = act('ash', { acao: 'golpe', golpe: 'protect' });
  const foeHit = r.lances?.find((l) => l.de === 'ele' && l.golpe), iMoved = r.lances?.some((l) => l.de === 'eu' && l.golpe === 'protect');
  ok('Protect blocks the foe\'s move this turn (when Pikachu got to use it)', !iMoved || !foeHit || foeHit.errou || foeHit.dano === 0, JSON.stringify(foeHit));
  r = act('ash', { acao: 'golpe', golpe: 'confuseray' });
  ok('Confuse Ray confuses the foe (or misses: Staryu may have used Minimize)', (r.ele?.efeitos || []).includes('confusion') || (r.log || []).some((x) => /confus/i.test(x)) || r.lances.some((l) => l.golpe === 'confuseray' && l.errou) || r.lances.some((l) => l.de === 'eu' && !l.golpe), JSON.stringify(r.ele?.efeitos));
  const hpBefore = contas.ash.save.time[0].hp;
  r = act('ash', { acao: 'trocar', uid: 'p2' });
  ok('switching: Squirtle comes in and the foe still moves', r.lances?.[0]?.troca === 'p2' && r.eu?.uid === 'p2', JSON.stringify(r.lances?.map((l) => l.troca || l.de + ':' + l.golpe)));
  ok('the Pokémon that left keeps its HP', contas.ash.save.time[0].hp === hpBefore);
  ok('battle text is English', (r.log || []).every((x) => !/[ãçõ]|subiu|caiu|vezes|queimad/.test(x)), (r.log || []).join(' | '));
  B.receber(sockets.ash, { t: 'bat_sair' });
}

/* ── end-of-turn damage: a burned Pokémon loses HP every turn ── */
{
  const contas = { ash: conta([mon('p1', 25, 'Pikachu', 50, ['growl'], { status: { id: 'burn', n: 0 } })]) };
  const { B, sockets, last, act } = setup(contas, ['ash']);
  B.receber(sockets.ash, { t: 'bat_desafiar', tipo: 'treinador', id: '4120102@1,1' });
  const hp0 = contas.ash.save.time[0].hp;
  const r = act('ash', { acao: 'golpe', golpe: 'growl' });
  ok('a burn hurts at the end of the turn', contas.ash.save.time[0].hp < hp0 && (r.log || []).some((x) => /burn/i.test(x)), hp0 + ' → ' + contas.ash.save.time[0].hp);
  const g = r.lances?.find((l) => l.golpe === 'growl');
  ok('Growl lowers the foe\'s Attack', g?.estagios?.quem === 'ele' && g.estagios.mudancas[0]?.atributo === 'atk', JSON.stringify(g?.estagios));
  B.receber(sockets.ash, { t: 'bat_sair' });
}

/* ── PvP: one engine turn for both players ── */
{
  const contas = {
    red: conta([mon('r1', 6, 'Charizard', 50, ['flamethrower', 'swordsdance'])]),
    blue: conta([mon('b1', 3, 'Venusaur', 50, ['tackle', 'growl'])]),
  };
  const { B, sockets, last, act } = setup(contas, ['red', 'blue']);
  B.receber(sockets.red, { t: 'bat_desafiar', tipo: 'jogador', id: 'blue' });
  B.receber(sockets.blue, { t: 'bat_desafiar', tipo: 'jogador', id: 'red', aceitar: true });
  ok('PvP battle opens', last('blue')?.t === 'bat' && last('blue')?.pvp, JSON.stringify(last('blue')).slice(0, 120));
  const w = act('red', { acao: 'golpe', golpe: 'flamethrower' });
  ok('the first player waits for the other', w?.espera === true);
  const rb = act('blue', { acao: 'golpe', golpe: 'growl' });
  const ra = last('red');
  const fl = ra.lances?.find((l) => l.golpe === 'flamethrower');
  ok('Flamethrower is super effective on Venusaur', fl?.de === 'eu' && fl.eff === 2 && fl.dano > 0, JSON.stringify(fl));
  const flB = rb.lances?.find((l) => l.golpe === 'flamethrower');
  ok('the other player sees it from their side', flB?.de === 'ele', JSON.stringify(flB));
  ok('both get the same battle text', JSON.stringify(ra.log) === JSON.stringify(rb.log));
  ok('HP went to the save', contas.blue.save.time[0].hp < 999 || ra.fim, contas.blue.save.time[0].hp);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
