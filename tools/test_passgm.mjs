// Season pass GM test tools (/givepass, /givepasslevel, /resetpass): unlock, levels as points, cap, @player, reset, GM-only.
import assert from 'node:assert/strict';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarModeracao } from '../server_moderation.mjs';
import { criarTemporada } from '../server_season.mjs';

const root = nodePath.dirname(nodePath.dirname(fileURLToPath(import.meta.url)));
const dadosPub = nodePath.join(root, 'public/data');
const contas = { gm: { gm: true, save: {} }, bob: { save: {} } };
const sessoes = new Map([['tk-gm', 'gm'], ['tk-bob', 'bob']]);
const sent = [];
const carteira = { de: () => ({ total: 0 }), creditar: () => 0, debitar: () => {} };
const temporada = criarTemporada({ dadosPub, contas, socketsDe: () => [], enviar: () => {}, salvarContas: () => {}, carteira, itemCatalog: () => ({ items: {} }), nomeItem: String });
const mod = criarModeracao({
  contas, sessoes, conexoes: new Map(), dadosPub,
  socketsDe: () => [], banidoAteDe: () => 0, derrubar: () => 0, logAdmin: () => {}, salvarContasJa: () => {}, avisar: () => ({ n: 0 }),
  enviar: (ws, m) => sent.push(m), temporadaGm: (u, op, n) => temporada.gm(u, op, n),
});
const run = (t, texto = '', token = 'tk-gm') => { sent.length = 0; mod.comando({ _info: { token } }, { t, texto }); return sent[0]; };
const S = temporada.def();

let r = run('mod_passe');
assert.equal(r.op, 'passe'); assert.equal(contas.gm.save.temporada.pago, true);
r = run('mod_passe');
assert.equal(r.t, 'mod_erro', 'already paid');
r = run('mod_passenivel', '3');
assert.equal(r.nivel, 3); assert.equal(temporada.vista(contas.gm).jogando, 3, 'levels count as played');
assert.ok(temporada.vista(contas.gm).trilhas.paga.find(l => l.nivel === 3).premios.every(p => p.estado === 'pronto'));
r = run('mod_passenivel');
assert.equal(r.nivel, 4, 'default 1 level');
r = run('mod_passenivel', '999');
assert.equal(r.nivel, S.maxNivel, 'capped');
r = run('mod_passenivel', '1');
assert.equal(r.t, 'mod_erro', 'already max');
r = run('mod_passenivel', '5 @bob');
assert.equal(r.usuario, 'bob'); assert.equal(r.nivel, 5); assert.equal(r.pago, false);
r = run('mod_passereset');
assert.equal(r.nivel, 0); assert.equal(contas.gm.save.temporada.pago, false);
r = run('mod_passe', '@nobody');
assert.equal(r.t, 'mod_erro');
r = run('mod_passe', '', 'tk-bob');
assert.equal(r.t, 'mod_erro'); assert.equal(contas.bob.save.temporada.pago, false, 'GM only');
console.log('passgm ok');
