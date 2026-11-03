/** The move catalog is the PokéAPI list, and the old 3D moves still look the same. */
import fs from 'node:fs';

const moves = JSON.parse(fs.readFileSync('public/data/moves.json', 'utf8'));
const learn = JSON.parse(fs.readFileSync('public/data/learnset.json', 'utf8'));
const ids = Object.keys(moves);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(ids.length > 800, 'catalog stayed at the old 194: ' + ids.length);
assert(moves.tackle.efeito === '00033' && moves.tackle.poder === 40, 'tackle stats');
assert(moves.tackle.alcance === 1.3 && moves.tackle.recarga === 1.6 && moves.tackle.contato === true, 'tackle presentation');
assert(moves.tackle.anim === 'Attack' && moves.tackle.som === 'Take Down', 'tackle animation');
assert(moves.pound.nome === 'Pound' && moves.pound.efeito === '00001', 'pound');
assert(moves.visegrip && moves.visegrip.nome === 'Vise Grip' && moves.visegrip.poder === 55, 'vise grip');
assert(moves.visegrip.pp === 30 && moves.visegrip.nomePt === 'Garras' && moves.visegrip.efeito === '00011', 'vise grip kept its effect');
assert(moves.infernooverdrive && moves.infernooverdrive.nome === 'Inferno Overdrive', 'old inferno overdrive was dropped');
assert(moves.infernooverdrivephysical && moves.infernooverdrivespecial, 'official z-moves');
assert(moves.infernooverdrivespecial.efeito === '00641' && moves.infernooverdrivespecial.cat === 'especial', 'inferno overdrive special');
assert(moves.growl.cat === 'status' && moves.growl.nomePt === 'Rosnado' && moves.growl.som === 'growl' && moves.growl.inicio === true, 'growl presentation');
assert(moves.swordsdance.alcance === 0 && moves.swordsdance.anim === 'Buff' && moves.swordsdance.proprio === true, 'swords dance');
assert(moves.shadowstorm.tipo === 'Shadow' && moves.shadowstorm.pp === 20, 'shadow storm pp/type ' + moves.shadowstorm.pp + ' ' + moves.shadowstorm.tipo);

const bulba = learn.learnset['1'];
assert(bulba.some(([id]) => id === 'tackle') && bulba.some(([id]) => id === 'growl'), 'bulbasaur learnset ' + JSON.stringify(bulba.slice(0, 4)));
assert(learn.pp.tackle === 35 && learn.pp.visegrip === 30 && learn.pp.vicegrip == null, 'pp map');
assert(learn.learnset['10']?.length, 'caterpie fell back to an older learnset');

let empty = 0;
for (const [dex, rows] of Object.entries(learn.learnset)) {
  if (!rows.length) empty++;
  assert(rows.length <= 120, dex + ' has ' + rows.length + ' moves');
  for (const [id, lv] of rows) {
    assert(moves[id], dex + ' learns unknown move ' + id);
    assert(lv >= 1 && lv <= 120, dex + ' ' + id + ' level ' + lv);
  }
}
assert(empty === 0, empty + ' species have an empty learnset');
assert(Object.keys(learn.learnset).length >= 996, 'species dropped: ' + Object.keys(learn.learnset).length);
assert(Object.keys(learn.pp).length === ids.length, 'pp map does not cover the catalog');

console.log('moves ok (' + ids.length + ' moves, ' + Object.keys(learn.learnset).length + ' species)');
