// /giveitem (GM chat command): name, id, amount, @player, the "held" bundle, Poké Balls in their own pocket, and GM-only.
import assert from 'node:assert/strict';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarModeracao } from '../server_moderation.mjs';

const root = nodePath.dirname(nodePath.dirname(fileURLToPath(import.meta.url)));
const contas = { gm: { gm: true, save: {} }, bob: { save: {} } };
const sessoes = new Map([['tk-gm', 'gm'], ['tk-bob', 'bob']]);
const sent = [];
const mod = criarModeracao({
  contas, sessoes, conexoes: new Map(), dadosPub: nodePath.join(root, 'public/data'),
  socketsDe: () => [], banidoAteDe: () => 0, derrubar: () => 0, logAdmin: () => {}, salvarContasJa: () => {}, avisar: () => ({ n: 0 }),
  enviar: (ws, m) => sent.push(m),
});
const run = (texto, token = 'tk-gm') => { sent.length = 0; mod.comando({ _info: { token } }, { t: 'mod_item', texto }); return sent[0]; };

let r = run('leftovers');
assert.equal(r.op, 'item'); assert.equal(contas.gm.save.itens['20009'], 1);
r = run('20009 4');
assert.equal(contas.gm.save.itens['20009'], 5, 'id + amount stacks');
r = run('choice scarf x2 @bob');
assert.equal(r.usuario, 'bob'); assert.equal(contas.bob.save.itens['20035'], 2);
r = run('held');
assert.ok(Object.keys(contas.gm.save.itens).length >= 30, 'every held item');
r = run('poke ball 10');
const ballIds = Object.keys(contas.gm.save.bolas || {});
assert.ok(ballIds.length === 1 && contas.gm.save.bolas[ballIds[0]] === 10, 'balls go to the ball pocket');
r = run('choice');
assert.equal(r.t, 'mod_erro'); assert.match(r.erro, /Which one\?/);
r = run('no such thing');
assert.equal(r.t, 'mod_erro');
r = run('leftovers', 'tk-bob');
assert.equal(r.t, 'mod_erro'); assert.equal(contas.bob.save.itens['20009'], undefined, 'GM only');
console.log('giveitem ok');
