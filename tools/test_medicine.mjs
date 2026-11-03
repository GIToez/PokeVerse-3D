/** Medicines the bag already listed now heal, and the bitter ones lower friendship. */
import { criarBolsa } from '../server_bag.mjs';
import * as Regras from '../item_rules.mjs';

const bag = criarBolsa({ dadosPub: 'public/data', salvar() {}, bloquearCura: () => false });
const bloqueada = criarBolsa({ dadosPub: 'public/data', salvar() {}, bloquearCura: () => true });

function mon(uid, extra = {}) {
  return { uid, nome: extra.nome || 'X', hp: 10, maxHp: 100, amizade: 70, ...extra, uid };
}
function conta(itens, time) {
  return { save: { itens: { ...itens }, time, dinheiro: 0, bolas: {} } };
}
function usar(c, item, uid, motor = bag) {
  return motor.tratar(c, 'usar', { item, uid }, {});
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

{
  const c = conta({ 2016: 1 }, [mon('a')]);
  const r = usar(c, 2016, 'a');
  assert(!r.erro, 'lemonade: ' + r.erro);
  assert(c.save.time[0].hp === 80, 'lemonade healed ' + c.save.time[0].hp);
  assert(!c.save.itens['2016'], 'lemonade was not consumed');
  assert(r.vidas[0].amizade === 70, 'lemonade changed friendship');
}

{
  const c = conta({ 2017: 1 }, [mon('a', { hp: 50 })]);
  const r = usar(c, 2017, 'a');
  assert(!r.erro, 'moomoo: ' + r.erro);
  assert(c.save.time[0].hp === 100, 'moomoo milk healed ' + c.save.time[0].hp);
}

{
  const c = conta({ 2018: 1 }, [mon('a')]);
  const r = usar(c, 2018, 'a');
  assert(!r.erro, 'energy powder: ' + r.erro);
  assert(c.save.time[0].hp === 70, 'energy powder hp ' + c.save.time[0].hp);
  assert(c.save.time[0].amizade === 65, 'energy powder friendship ' + c.save.time[0].amizade);
  assert(r.vidas[0].amizade === 65, 'energy powder reply omitted friendship');
}

{
  const c = conta({ 2019: 1 }, [mon('a', { hp: 90 })]);
  usar(c, 2019, 'a');
  assert(c.save.time[0].hp === 100, 'energy root did not cap at full');
  assert(c.save.time[0].amizade === 60, 'energy root friendship ' + c.save.time[0].amizade);
}

{
  const c = conta({ 2039: 1 }, [mon('a', { amizade: 3 })]);
  usar(c, 2039, 'a');
  assert(c.save.time[0].hp === 70, 'heal powder mix hp');
  assert(c.save.time[0].amizade === 0, 'friendship went below 0');
}

{
  const c = conta({ 2040: 1 }, [mon('a')]);
  usar(c, 2040, 'a');
  assert(c.save.time[0].hp === 100, 'energy root mix hp ' + c.save.time[0].hp);
  assert(c.save.time[0].amizade === 60, 'energy root mix friendship');
}

{
  const c = conta({ 2041: 1 }, [mon('a', { hp: 10, maxHp: 200 })]);
  usar(c, 2041, 'a');
  assert(c.save.time[0].hp === 160, 'revival mix hp ' + c.save.time[0].hp);
  assert(c.save.time[0].amizade === 55, 'revival mix friendship');
}

{
  const c = conta({ 2021: 1 }, [mon('a', { hp: 0, amizade: 70 })]);
  const r = usar(c, 2021, 'a');
  assert(!r.erro, 'revival herb: ' + r.erro);
  assert(c.save.time[0].hp === 100, 'revival herb hp ' + c.save.time[0].hp);
  assert(c.save.time[0].amizade === 55, 'revival herb friendship ' + c.save.time[0].amizade);
  assert(!c.save.itens['2021'], 'revival herb was not consumed');
}

{
  const c = conta({ 2038: 1 }, [mon('a', { hp: 0 })]);
  const r = usar(c, 2038, 'a');
  assert(!r.erro, 'max honey: ' + r.erro);
  assert(c.save.time[0].hp === 100, 'max honey hp');
  assert(c.save.time[0].amizade === 70, 'max honey dropped friendship');
}

{
  const c = conta({ 2037: 1 }, [
    mon('a', { hp: 0 }),
    mon('b', { hp: 0, maxHp: 50 }),
    mon('c', { hp: 40, maxHp: 80 }),
  ]);
  const r = usar(c, 2037, 'a');
  assert(!r.erro, 'sacred ash: ' + r.erro);
  assert(c.save.time[0].hp === 100 && c.save.time[1].hp === 50, 'sacred ash left a fainted mon');
  assert(c.save.time[2].hp === 40, 'sacred ash healed a healthy mon');
  assert(!c.save.itens['2037'], 'sacred ash was not consumed');
  assert(r.vidas.length === 2, 'sacred ash reported ' + r.vidas.length);
}

{
  const c = conta({ 2037: 1 }, [mon('a', { hp: 40 })]);
  const r = usar(c, 2037, 'a');
  assert(r.erro, 'sacred ash worked with nobody fainted');
  assert(c.save.itens['2037'] === 1, 'sacred ash was consumed anyway');
}

{
  const c = conta({ 2016: 1 }, [mon('a', { hp: 0 })]);
  const r = usar(c, 2016, 'a');
  assert(r.erro, 'lemonade revived');
  assert(c.save.time[0].hp === 0, 'lemonade changed a fainted mon');
  assert(c.save.itens['2016'] === 1, 'lemonade was consumed on a fainted mon');
}

{
  const c = conta({ 2012: 1 }, [mon('a', { hp: 0, maxHp: 100 })]);
  usar(c, 2012, 'a');
  assert(c.save.time[0].hp === 50, 'revive hp ' + c.save.time[0].hp);
}

{
  const c = conta({ 2005: 1 }, [mon('a', { hp: 1 })]);
  usar(c, 2005, 'a');
  assert(c.save.time[0].hp === 100, 'full restore hp ' + c.save.time[0].hp);
}

{
  const c = conta({ 2003: 1 }, [mon('a', { hp: 10 })]);
  usar(c, 2003, 'a');
  assert(c.save.time[0].hp === 100, 'hyper potion capped at ' + c.save.time[0].hp);
}

{
  const c = conta({ 2016: 1 }, [mon('a')]);
  const r = usar(c, 2016, 'a', bloqueada);
  assert(r.erro, 'elite four allowed a lemonade');
  assert(c.save.time[0].hp === 10, 'elite four healed');
  assert(c.save.itens['2016'] === 1, 'elite four consumed the item');
}

{
  const c = conta({ 2006: 1 }, [mon('a')]);
  const r = usar(c, 2006, 'a');
  assert(r.erro, 'antidote healed');
  assert(c.save.itens['2006'] === 1, 'antidote was consumed');
  assert(c.save.time[0].hp === 10, 'antidote changed hp');
}

assert(Regras.ehCura(2016) && Regras.ehReanima(2021) && Regras.ehReanimaTime(2037), 'rules missed a medicine');
assert(Regras.amizadeDe(2018) === -5 && Regras.amizadeDe(2041) === -15, 'friendship table');
assert(!Regras.ehReanima(2037), 'sacred ash was treated as a single revive');

console.log('medicine ok');
