/**
 * Johto minimap and world map use one baked aerial. The ruler covers the
 * street, town pins land on land, and the HUD / world map no longer assume Kanto.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function ok(cond, msg){ if (!cond) throw new Error(msg); }

const regua = JSON.parse(fs.readFileSync('ui/minimapa_johto.json', 'utf8'));
const map = JSON.parse(fs.readFileSync('public/data/2000001.json', 'utf8'));
const marks = JSON.parse(fs.readFileSync('public/data/johto_map_markers.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const menus = fs.readFileSync('menus.mjs', 'utf8');

ok(regua.esc === 4 && regua.w === 3380 && regua.h === 1564, 'ruler ' + JSON.stringify(regua));
const b = map.bbox;
const mundoX0 = -b.x1, mundoX1 = -b.x0;
ok(regua.x0 <= mundoX0 && regua.x0 + regua.w / regua.esc >= mundoX1, 'ruler covers world x');
ok(regua.z0 <= b.z0 && regua.z0 + regua.h / regua.esc >= b.z1, 'ruler covers world z');

const tipos = {};
for (const m of marks.marcadores){
  tipos[m.tipo] = (tipos[m.tipo] || 0) + 1;
  ok(m.area >= 2101 && m.area <= 2114, 'marker area ' + m.nome);
  const px = (-m.x - regua.x0) * regua.esc, pz = (m.z - regua.z0) * regua.esc;
  ok(px >= 0 && pz >= 0 && px < regua.w && pz < regua.h, 'marker inside photo ' + m.nome);
}
ok(tipos.centro === 10 && tipos.loja === 6 && tipos.ginasio === 8, 'pin counts ' + JSON.stringify(tipos));

function maior(id){
  const cs = map.caixas.filter(c => c.a === id && c.sx > 0 && c.sz > 0);
  return cs.sort((a, c) => c.sx * c.sz - a.sx * a.sz)[0];
}
const bark = maior(2101), gold = maior(2105), cian = maior(2108), rage = maior(2113);
ok(-bark.x > -gold.x, 'New Bark is east of Goldenrod');
ok(-cian.x < -gold.x, 'Cianwood is west of Goldenrod');
ok(rage.z < gold.z, 'Lake of Rage is north of Goldenrod');

ok(html.includes("+NOME === 2000001 ? './ui/minimapa_johto' : './ui/minimapa_kanto'"), 'hud photo follows the street');
ok(/function naRuaKanto\(\)\{ return !INTERIOR && \(NOME === 'kanto' \|\| NOME === 'pallet_route1' \|\| \+NOME === 1000001\); \}/.test(html), 'live stitch stays on Kanto');
ok(menus.includes('data-regiao="johto"') && menus.includes('./ui/minimapa_johto.jpg'), 'world map has a Johto sheet');
ok(menus.includes('n >= 2101 && n <= 2110') && menus.includes('n >= 2226 && n <= 2248'), 'Johto towns and routes are labeled');
ok(menus.includes('+dd?.mapa !== 2000001'), 'opening the map in Johto does not paint Johto boxes on Kanto');

const py = execFileSync('python3', ['-c', `
from PIL import Image
import json
im = Image.open('ui/minimapa_johto.jpg').convert('RGB')
regua = json.load(open('ui/minimapa_johto.json'))
marks = json.load(open('public/data/johto_map_markers.json'))['marcadores']
assert im.size == (regua['w'], regua['h'])
ocean = (121, 183, 224)
bad = []
for m in marks:
    if m['tipo'] != 'centro':
        continue
    px = int(round((-m['x'] - regua['x0']) * regua['esc']))
    pz = int(round((m['z'] - regua['z0']) * regua['esc']))
    px = min(im.width - 1, max(0, px))
    pz = min(im.height - 1, max(0, pz))
    c = im.getpixel((px, pz))
    if all(abs(c[i] - ocean[i]) < 12 for i in range(3)):
        bad.append(m['nome'])
print('centers_on_land', 10 - len(bad), 'ocean', bad)
assert not bad
`], { encoding: 'utf8' });
process.stdout.write(py);
console.log('test_johto_map: ok');
