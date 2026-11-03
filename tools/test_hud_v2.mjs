/* The v2 HUD file only ships the overworld pieces. Every image those pieces name has to be on disk. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(readFileSync(join(root, 'ui/hud_layout_v2.json'), 'utf8'));
const fig = layout._figma || {};

assert.ok(fig.v2, 'v2 layout is marked');
assert.ok(fig.geradoEmV2, 'v2 layout has a kit stamp');
assert.equal(layout.popups, undefined, 'popup art stays on the classic layout');
assert.equal(layout.telas, undefined, 'screen art stays on the classic layout');
assert.ok(layout.pc?.skills?.img, 'move bar has art');
assert.ok(layout.pc?.['bola-btn'], 'ball has a place');
assert.ok(layout.pc?.['menu-icones'], 'menu has a place');
assert.ok(layout.celular_deitado?.skills, 'phone landscape has the move bar');

const imgs = new Set();
const ext = /\.(webp|png|jpe?g|gif)(\?.*)?$/i;
function walk(o){
  if (!o || typeof o !== 'object'){
    if (typeof o === 'string' && ext.test(o)) imgs.add(o.split('?')[0].replace(/^\.\//, ''));
    return;
  }
  for (const v of Object.values(o)) walk(v);
}
walk(layout.pc);
walk(layout.celular_deitado);
walk(layout._figma);
assert.ok(imgs.size >= 290, 'hud pieces name their art (' + imgs.size + ')');
const missing = [...imgs].filter(p => !existsSync(join(root, p)));
assert.deepEqual(missing, [], 'missing hud images');

const hud = readFileSync(join(root, 'hud.mjs'), 'utf8');
assert.match(hud, /fig\.v2 \|\| fig\.geradoEmV2/, 'the command island steps aside for the v2 kit');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert.match(index, /Hud\.carregarV2\(\)/, 'the page loads the v2 kit');
assert.match(index, /hud\.v2'\) === '0'/, 'Settings can still pick the classic HUD');

console.log('hud v2 ok', imgs.size, 'images');
