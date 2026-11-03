/** Pokédex seen/caught records survive a save, and a legacy level number still counts. */
import * as K from '../knowledge.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rich = { v: 1, p: 0, ar: [], sx: '', gl: [], ev: 0, lu: 0, sh: 0 };
assert(Number.isNaN(+rich), 'a record is not a level number');
assert(Math.round(+rich || 0) === 0, 'the old merge turned a record into 0');

{
  const saved = K.fundirSave(null, { esp: { '16': rich }, titulos: [], v: 1 });
  assert(saved.esp['16'].v === 1 && saved.esp['16'].p === 0, 'merge keeps seen: ' + JSON.stringify(saved.esp['16']));
  const lower = K.fundirSave(saved, { esp: { '16': { v: 0, p: 0, ar: [], sx: '', gl: [], ev: 0, lu: 0, sh: 0 } }, titulos: [] });
  assert(lower.esp['16'].v === 1, 'a later 0 does not erase seen');
  const leg = K.fundirSave({ esp: { '7': 2 }, titulos: ['observador'] }, { esp: { '7': { v: 1, p: 0, ar: [3], sx: 'f', gl: ['tackle'], ev: 0, lu: 2, sh: 1, shp: 0 } }, titulos: ['shiny'] });
  assert(leg.esp['7'].v === 1 && leg.esp['7'].p === 1 && leg.esp['7'].sh === 1 && leg.esp['7'].ar.includes(3), 'legacy 2 stays caught: ' + JSON.stringify(leg.esp['7']));
  assert(leg.esp['7'].sx.includes('f') && leg.esp['7'].gl.includes('tackle') && leg.esp['7'].lu === 2, 'fields union');
  assert(leg.titulos.includes('observador') && leg.titulos.includes('shiny'), 'titles union');
  const areas = Array.from({ length: 12 }, (_, i) => i + 1);
  const moves = Array.from({ length: 30 }, (_, i) => 'move-' + i + '-extra-text-that-is-way-too-long-for-an-id');
  const capped = K.fundirSave(null, { esp: { '1': { v: 1, p: 1, ar: areas, sx: 'mf-', gl: moves, ev: 0, lu: 0, sh: 0 } }, titulos: [] });
  assert(capped.esp['1'].ar.length === 8, 'areas cap ' + capped.esp['1'].ar.length);
  assert(capped.esp['1'].gl.length === 24, 'moves cap ' + capped.esp['1'].gl.length);
  assert(capped.esp['1'].gl.every(g => g.length <= 40), 'move id length');
  assert(!K.fundirSave({ esp: { '9': 0 }, titulos: [] }, null).esp['9'], 'empty legacy is dropped');
}

{
  const pac = K.pacoteConhecimento({ conhecimento: { dex: { '16': 'visto' }, conhecimento: { esp: { '16': rich }, titulos: [], v: 1 } } });
  assert(pac.dex['16'] === 'visto', 'nested pagehide keeps dex');
  assert(K.fundirSave(null, pac.conhecimento).esp['16'].v === 1, 'nested pagehide keeps the record');
  const flat = K.pacoteConhecimento({ dex: { '16': 'visto' }, conhecimento: { esp: { '16': rich }, titulos: [], v: 1 } });
  assert(flat.dex['16'] === 'visto' && flat.conhecimento.esp['16'].v === 1, 'flat websocket shape');
}

const store = new Map();
const dex = {};
const avisos = [];
let pintou = 0;
store.set('conhecimento', JSON.stringify({ esp: { '25': 2 }, titulos: [], v: 1 }));
const porDex = new Map([[16, { name: 'Pidgey', n: 16 }], [17, { name: 'Pidgeotto', n: 17 }], [25, { name: 'Pikachu', n: 25 }]]);
K.instalar({
  lerLS: (k, pad) => { const v = store.get(k); return v ? JSON.parse(v) : (pad ?? null); },
  gravarLS: (k, v) => store.set(k, JSON.stringify(v)),
  porDex,
  sexos: { 16: 50, 25: 50 },
  avisar: t => avisos.push(t),
  marcarDex: (n, st) => {
    const k = String(+n);
    const prox = st === 'pego' ? 'pego' : 'visto';
    if (dex[k] === 'pego' || dex[k] === prox) return;
    dex[k] = prox;
  },
  mudou: () => { pintou++; },
  alfa: () => false,
});

assert(K.estadoAntigo()['25'] === 'pego', 'legacy level 2 counts as caught');
assert(dex['25'] === 'pego', 'legacy level wrote the dex');
assert(K.registro(25).v >= 1 && K.registro(25).p >= 1, 'legacy number became a record');
assert(!avisos.some(a => a.includes('Pikachu') && a.includes('Seen')), 'reloading a known species does not chat');

const seen = K.evento('visto', { dex: 16 });
assert(seen === 1, 'first sight is Seen, got ' + seen);
assert(avisos.filter(a => a.includes('Pidgey') && a.includes('Seen')).length === 1, 'one Seen line');
assert(K.estadoAntigo()['16'] === 'visto' && dex['16'] === 'visto', 'sighting fills the dex');
assert(pintou >= 1, 'the open dex repaints');
const chats = avisos.length;
K.evento('visto', { dex: 16 });
assert(avisos.length === chats, 'a second sight does not chat again');
assert(K.nivel(16) === 1, 'still Seen');

const reg = K.evento('pego', { dex: 16, sexo: 'm', area: 1201 });
assert(reg === 2, 'catch reaches Registered, got ' + reg);
assert(avisos.filter(a => a.includes('Pidgey') && a.includes('Registered')).length === 1, 'one Registered line');
assert(K.estadoAntigo()['16'] === 'pego' && dex['16'] === 'pego', 'catch registers in the dex');
K.evento('pego', { dex: 16, sexo: 'f', area: 1202 });
assert(avisos.filter(a => a.includes('Pidgey') && a.includes('Registered')).length === 1, 'another catch does not repeat Registered');

K.evento('visto', { dex: 16, shiny: true });
assert(K.registro(16).sh === 1, 'a shiny sight is remembered');

K.evento('evoluiu', { de: 16, para: 17 });
assert(K.estadoAntigo()['17'] === 'visto' && dex['17'] === 'visto', 'evolution opens the next entry');

K.recarregar();
assert(K.estadoAntigo()['16'] === 'pego', 'reload keeps the catch');
assert(K.registro(16).ar.includes(1201) && K.registro(16).sx.includes('m') && K.registro(16).sh === 1, 'reload keeps areas, gender and shiny');
const quiet = avisos.length;
K.evento('visto', { dex: 16 });
assert(avisos.length === quiet, 'reload does not chat Seen again');
assert(K.nivel(16) >= 1, 'reloaded species stays known');

console.log('dex ok');
