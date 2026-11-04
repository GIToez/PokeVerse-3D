/* The v2 HUD file is the whole kit: overworld pieces plus the window and screen defs. Every image it names has to be on disk. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(readFileSync(join(root, 'ui/hud_layout_v2.json'), 'utf8'));
const fig = layout._figma || {};
const phone = layout.celular_deitado;

assert.ok(fig.v2, 'v2 layout is marked');
assert.ok(fig.geradoEmV2, 'v2 layout has a kit stamp');
assert.equal(layout.popups?.pc?.mochila?.v2, true, 'bag window is the v2 def');
assert.ok(layout.popups?.pc?.pokemon, 'party window def is in the v2 file');
assert.ok(layout.telas?.pc?.login, 'login screen def is in the v2 file');
assert.ok(phone?.skills, 'phone landscape has the move strip');
assert.ok(phone?.['bola-btn'], 'phone landscape has the ball');
assert.ok(phone?.atalhos, 'phone landscape has the plus buttons');
assert.ok(phone?.['time-hud'], 'phone landscape has the party');

/* Screenshot: move strip on the far right, ball just left of it, plus buttons further left in a diamond, party as two columns. */
assert.equal(phone.skills.ax, 'right');
assert.ok(phone.skills.w <= 70, 'move strip stays narrow');
assert.equal(phone['bola-btn'].ax, 'right');
assert.equal(phone.atalhos.ax, 'right');
assert.ok(phone.skills.x < phone['bola-btn'].x && phone['bola-btn'].x < phone.atalhos.x, 'right inset grows from the move strip to the ball to the plus buttons');
const slots = Object.fromEntries((phone.atalhos.figma?.filhos || []).filter(f => f.nome?.startsWith('slot-item')).map(f => [f.nome, f]));
assert.ok(slots['slot-item-2'].x < slots['slot-item-1'].x, 'plus buttons are a diamond, not a column on the edge');
const party = (phone['time-hud'].figma?.filhos || []).filter(f => /^slot-poke-/.test(f.nome || ''));
assert.equal(party.length, 6);
assert.ok(party.some(f => f.x === 0) && party.some(f => f.x > 0), 'party is two columns');

const imgs = new Set();
const ext = /\.(webp|png|jpe?g|gif)(\?.*)?$/i;
function walk(o){
  if (!o || typeof o !== 'object'){
    if (typeof o === 'string' && ext.test(o)) imgs.add(o.split('?')[0].replace(/^\.\//, ''));
    return;
  }
  for (const v of Object.values(o)) walk(v);
}
walk(layout);
assert.ok(imgs.size >= 1000, 'the full kit names its art (' + imgs.size + ')');
const missing = [...imgs].filter(p => !existsSync(join(root, p)));
assert.deepEqual(missing, [], 'missing hud images');

const hud = readFileSync(join(root, 'hud.mjs'), 'utf8');
assert.match(hud, /fig\.v2 \|\| fig\.geradoEmV2/, 'the command island steps aside for the v2 kit');
assert.match(hud, /celular_deitado/, 'the command island steps aside on the phone mockup');
assert.doesNotMatch(hud, /j\.popups = base\.popups/, 'v2 windows are not replaced with the classic ones');
assert.match(hud, /classList\.toggle\('hud-v2'/, 'v2 layouts mark the page so older phone CSS stays off');
assert.match(hud, /setProperty\('--chat-w'/, 'the phone chat size comes from the layout record');
const css = readFileSync(join(root, 'hud.css'), 'utf8');
assert.match(css, /body\.mobile:not\(\.hud-v2\) #time-hud/, 'the old party grid does not restack the v2 phone party');
assert.match(css, /body\.tela-baixa\.pele-amanda:not\(\.hud-v2\) #barra #skills/, 'the Amanda phone cluster does not move the v2 move strip');
const menus = readFileSync(join(root, 'menus.mjs'), 'utf8');
assert.match(menus, /defPopup\('pokemon'\)/, 'the party looks up the v2 window');
assert.match(menus, /defPopup\('caixa'\)/, 'the PC looks up the v2 box');
assert.match(menus, /if \(def\)\{\s*popPk = Popup\.montar\(def/, 'the party opens the v2 window');
assert.match(menus, /if \(def\)\{\s*popBx = Popup\.montar\(def/, 'the PC opens the v2 box');
assert.match(menus, /encherPokemonV2/, 'the party fills the Figma sheet');
assert.match(menus, /item-segurado/, 'the party paints the held-item slot');
assert.match(menus, /tirar-item/, 'the party can take a held item');
assert.match(menus, /function mudarHeld/, 'give and take share one path');
const heldCat = JSON.parse(readFileSync(join(root, 'public/data/held.json'), 'utf8'));
const menuCat = JSON.parse(readFileSync(join(root, 'public/data/menu_data.json'), 'utf8'));
for (const [id, it] of Object.entries(heldCat.itens)){
  assert.equal(menuCat.itens[id]?.t, 14, id + ' is a held item in the bag catalog');
  assert.equal(menuCat.itens[id]?.d, it.texto, id + ' uses the in-game effect text');
  assert.ok(existsSync(join(root, 'ui/itens/' + it.icone + '.png')), 'icon for ' + it.nome);
}
const mart = menuCat.lojas['2150101'] || [];
for (const id of [20004, 20008, 20010, 20011, 20012, 20014, 20015, 20016, 20017, 20018, 20019, 20020, 20021, 20022, 20023, 20026]){
  const linha = mart.find(l => +l.item === id);
  assert.ok(linha, 'Pokémart sells item ' + id);
  assert.equal(linha.preco, 8000);
}
assert.match(menus, /porPagina/, 'each box page uses the cells drawn in that layout');
assert.match(menus, /rotulo-time', 'My party'/, 'the phone box says My party');
assert.match(menus, /function toqueTimeCaixa/, 'a tap on a party Pokémon stores it');
assert.match(menus, /pointerup/, 'a phone tap does not wait for a click');
assert.match(menus, /ficha-anterior/, 'the summary has a previous button');
assert.match(menus, /Clear filters/, 'the filter sheet is in English');
assert.match(menus, /icone-filtro/, 'a chosen type shows its icon');
assert.match(menus, /function toqueCasaCaixa/, 'a tap on a box Pokémon brings it back');
assert.match(menus, /Pokémon summary/, 'the summary sheet is in English');
assert.match(menus, /COMING SOON/, 'the shop banner is in English');
const popup = readFileSync(join(root, 'popup.mjs'), 'utf8');
assert.match(popup, /data-fig\^="encaixe-"/, 'party slots in the box receive taps');
assert.match(popup, /data-fig\^="casa-"/, 'box cells receive taps');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert.match(index, /Hud\.carregarV2\(\)/, 'the page loads the v2 kit');
assert.match(index, /hud\.v2'\) === '0'/, 'Settings can still pick the classic HUD');
assert.match(index, /TmCounter\.instalar/, 'the TM counter is installed with the party drag');

console.log('hud v2 ok', imgs.size, 'images');
