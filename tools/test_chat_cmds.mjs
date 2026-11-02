import assert from 'node:assert/strict';
import * as Chat from '../chat.mjs';

globalThis.localStorage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
const seen = [];
Chat.instalar({
  lerLS: () => [],
  gravarLS(){},
  clima: resto => seen.push('w:' + resto),
  hora: resto => seen.push('t:' + resto),
});
assert.equal(Chat.enviar('local', '/weather rain'), 'sistema');
assert.equal(Chat.enviar('local', '/clima storm'), 'sistema');
assert.equal(Chat.enviar('local', '/weather'), 'sistema');
assert.equal(Chat.enviar('local', '/time night'), 'sistema');
assert.deepEqual(seen, ['w:rain', 'w:storm', 'w:', 't:night']);
console.log('ok chat weather');
