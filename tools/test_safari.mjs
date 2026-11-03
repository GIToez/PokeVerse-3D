/** Safari visit: fee, Safari Balls, steps, bait and rock. The grass table stays. */
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarBolsa } from '../server_bag.mjs';
import * as Safari from '../safari_rules.mjs';

const root = nodePath.join(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const bag = criarBolsa({ dadosPub: nodePath.join(root, 'public/data'), salvar() {}, bloquearCura: () => false });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function conta(extra = {}) {
  return { save: { dinheiro: 0, bolas: {}, itens: {}, ...extra } };
}

{
  const bolas = { '1005': 4 };
  const r = Safari.entrar({ dinheiro: 499, bolas, sessao: null, zona: 1192 });
  assert(!r.ok && r.erro === 'not enough Coins', 'poor: ' + r.erro);
  assert(!r.sessao, 'poor visit started');
  assert(bolas['1005'] === 4, 'poor mutated the bag');
}

{
  const r = Safari.entrar({ dinheiro: 500, bolas: { '1005': 4 }, sessao: null, zona: 1192 });
  assert(r.ok, r.erro);
  assert(r.dinheiro === 0, 'fee ' + r.dinheiro);
  assert(r.bolas['1005'] === 34, 'balls ' + r.bolas['1005']);
  assert(r.sessao.zona === 1192 && r.sessao.passos === 500 && r.sessao.restantes === 30, 'session');
  const again = Safari.entrar({ dinheiro: 500, bolas: r.bolas, sessao: r.sessao, zona: 1192 });
  assert(!again.ok && again.erro === 'You already have a Safari visit going.', 'second enter: ' + again.erro);
}

{
  const s = { zona: 1192, passos: 500, restantes: 30 };
  assert(!Safari.podeJogar({ sessao: null, naZona: true, bola: 1005, estado: 'vagando' }).ok, 'unpaid');
  assert(!Safari.podeJogar({ sessao: s, naZona: true, bola: 1001, estado: 'desmaiado' }).ok, 'other ball');
  assert(Safari.podeJogar({ sessao: s, naZona: true, bola: 1005, estado: 'vagando' }).ok, 'awake in the zone');
  assert(!Safari.podeJogar({ sessao: s, naZona: false, bola: 1005, estado: 'desmaiado' }).ok, 'safari ball outside');
  assert(!Safari.podeJogar({ sessao: null, naZona: false, bola: 1001, estado: 'vagando' }).ok, 'awake outside');
  assert(Safari.podeJogar({ sessao: null, naZona: false, bola: 1001, estado: 'desmaiado' }).ok, 'fainted outside');
}

{
  const isca = Safari.aplicar('isca'), pedra = Safari.aplicar('pedra');
  assert(Safari.multCaptura(isca) === 0.5 && Safari.multCaptura(pedra) === 2, 'catch mods');
  assert(Safari.foge(isca, () => 0.04) === true, 'bait 0.04 should flee');
  assert(Safari.foge(isca, () => 0.06) === false, 'bait 0.06 should stay');
  assert(Safari.foge(pedra, () => 0.29) === true && Safari.foge(pedra, () => 0.3) === false, 'rock 0.3');
  assert(Safari.foge(null, () => 0.11) === true && Safari.foge(null, () => 0.12) === false, 'calm 0.12');
}

{
  let s = { zona: 1192, passos: 8, restantes: 30 };
  const mid = Safari.passo(s, 3);
  assert(!mid.fim && mid.sessao.passos === 5, 'steps ' + mid.sessao?.passos);
  const end = Safari.passo(mid.sessao, 8);
  assert(end.fim === 'passos' && end.sessao.passos === 0, 'step end');
  const left = Safari.encerrar({ '1005': 34 }, { restantes: 30 });
  assert(left.bolas['1005'] === 4 && left.tirou === 30, 'leftover ' + JSON.stringify(left));
  const last = Safari.jogou({ zona: 1192, passos: 12, restantes: 1 });
  assert(last.fim === 'bolas' && last.sessao.restantes === 0, 'last ball');
  const none = Safari.encerrar({ '1005': 4 }, last.sessao);
  assert(none.bolas['1005'] === 4 && none.tirou === 0, 'last ball removed owned balls');
}

{
  const c = conta({ dinheiro: 500, bolas: { '1005': 4 } });
  const far = bag.tratar(c, 'safari', { acao: 'entrar', zona: 1192, x: 0, z: 0 });
  assert(far.erro, 'far enter should fail');
  assert(c.save.dinheiro === 500 && c.save.bolas['1005'] === 4 && !c.save.safari, 'far enter changed the account');
  const near = bag.tratar(c, 'safari', { acao: 'entrar', zona: 1192, x: -228.5, z: 199.5 });
  assert(!near.erro, 'gate enter: ' + near.erro);
  assert(c.save.dinheiro === 0 && c.save.bolas['1005'] === 34, 'gate fee');
  assert(c.save.safari.zona === 1192 && c.save.safari.passos === 500 && c.save.safari.restantes === 30, 'saved visit');
  const twice = bag.tratar(c, 'safari', { acao: 'entrar', zona: 1192, x: -228.5, z: 199.5 });
  assert(twice.erro, 'second gate enter charged again');
  assert(c.save.dinheiro === 0 && c.save.bolas['1005'] === 34, 'second enter mutated the bag');
  const stay = bag.tratar(c, 'safari', { acao: 'expulsar', zona: 1192, x: -200, z: 150 });
  assert(!stay.erro && stay.safari && !stay.pouso, 'expulsar cleared a live visit');
  assert(c.save.safari.passos === 500, 'expulsar wrote the save');
  let fim = null;
  for (let i = 0; i < 70 && !fim?.fim; i++) fim = bag.tratar(c, 'safari', { acao: 'passo', n: 8, x: -200, z: 150 });
  assert(fim.fim === 'passos', 'steps did not end');
  assert(!c.save.safari && c.save.bolas['1005'] === 4, 'step end balls ' + c.save.bolas['1005']);
  assert(fim.pouso && fim.pouso.z === 199.5, 'gate ' + JSON.stringify(fim.pouso));
}

{
  const habitats = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/habitats.json'), 'utf8'));
  const row = habitats.areas['1192'] || [];
  assert(row[0]?.nome === 'Pidgeot' && row.some(e => e.nome === 'Nidoking'), 'habitat 1192 was replaced');
  assert(!habitats.areas['2115'], 'Johto safari grew a habitat table');
  const npcs = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/npcs_glb.json'), 'utf8'));
  assert(npcs['9001192']?.papel === 'safari' && npcs['9001192'].cena === 1000001, 'kanto warden');
  assert(npcs['9001192'].pos.x === 228.5 && npcs['9001192'].pos.z === 199.5 && npcs['9001192'].pos.face === 180, 'kanto gate');
  assert(npcs['9001193']?.placa === true && !npcs['9001193'].papel, 'kanto sign charges a fee');
  assert(npcs['9002115']?.papel === 'safari' && npcs['9002115'].cena === 2000001, 'johto warden');
  assert(npcs['9002115'].pos.x === 324.5 && npcs['9002115'].pos.face === 0, 'johto gate');
  assert(npcs['9002116']?.placa === true && npcs['9002116'].cena === 2000001, 'johto sign');
}

{
  const dentro = Safari.podeSoltar({ naZona: true });
  assert(!dentro.ok && dentro.erro === Safari.AVISO_BOLA, 'summon inside: ' + dentro.erro);
  assert(Safari.podeSoltar({ naZona: false }).ok, 'summon outside the grass');
  assert(Safari.podeSoltar({}).ok, 'summon with no zone');
  assert(Safari.naZonaPaga(1192, 190) && !Safari.naZonaPaga(1192, 199.5), 'kanto gate is outside the paid grass');
  assert(Safari.naZonaPaga(2115, 100.5), 'johto grass is the whole area');
}

console.log('safari ok');
