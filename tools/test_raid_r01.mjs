/* The Articuno raid's fight on the server (server_raid_r01.mjs), on a fake clock. Run: node tools/test_raid_r01.mjs */
import fs from 'node:fs';
import { createR01 } from '../server_raid_r01.mjs';

let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const D = JSON.parse(fs.readFileSync(new URL('../public/data/raid_r01.json', import.meta.url), 'utf8'));
let T = 1e12, tick = null;
const out = [];
const players = [1, 2, 3].map((id) => ({ _id: id, _info: { px: -2 + id * 2, pz: 8, x: 0, z: 17 } }));
const R = createR01({ dados: () => D, paraArena: (o) => out.push(o), naArena: () => players, idDe: (w) => w._id, maxHpDe: () => 200,
  clock: () => T, every: (fn) => { tick = fn; return 0; } });
const run = (s) => { for (let i = 0; i < s * 10; i++) { T += 100; tick(); } };
const evs = (ev) => out.filter((m) => m.t === 'r01' && m.ev === ev);

R.iniciar({ id: 77, hp: 10000, maxHp: 10000 });
ok('the fight opens with the entrance', evs('entrada').length === 1);
run(60);
const ids = new Set(evs('golpe').map((g) => g.id));
ok('phase 1 casts only Ice Beam / Icy Wind / Hail', [...ids].every((i) => ['icebeam', 'icywind', 'hail'].includes(i)) && ids.size >= 2, [...ids].join(','));
ok('attacks hurt players (pdano with a share of max HP)', out.some((m) => m.t === 'pdano' && m.dano > 0 && m.dano <= 200 * 0.45), String(out.filter((m) => m.t === 'pdano').length));

/* pillars: a player straight behind pillar 1 (x 13, z 0) seen from the centre */
out.length = 0;
players[0]._info.px = 17; players[0]._info.pz = 0; players[1]._info.px = 17; players[1]._info.pz = 0.2; players[2]._info.px = 17.2; players[2]._info.pz = -0.2;
run(60);
ok('a pillar takes Ice Beam for whoever hides behind it', evs('raio').some((r) => r.sub === 'pilar'), JSON.stringify(evs('pilar').map((p) => p.estado)));

/* phase 2 at 70 % and Blizzard; heat of a lit brazier protects */
out.length = 0;
R.aoDano(6900, 10000);
ok('phase 2 at 70 %', evs('fase').some((f) => f.fase === 2));
const NE = D.braseiros.find((b) => b.id === 'NE');
players[0]._info.px = NE.x + 1; players[0]._info.pz = NE.z;   // next to a lit brazier
players[1]._info.px = 0; players[1]._info.pz = 10; players[2]._info.px = -3; players[2]._info.pz = 10;
run(15);
const nv = evs('nevasca')[0];
ok('phase 2 opens with Blizzard', evs('golpe')[0]?.id === 'blizzard');
ok('Blizzard spares the player in a brazier\'s heat', nv && nv.seguros.includes(1) && !nv.seguros.includes(2), JSON.stringify(nv?.seguros));
ok('Blizzard puts out braziers', evs('braseiro').filter((b) => b.estado === 'apagado' && b.motivo === 'nevasca').length >= 1);
ok('after Blizzard Articuno lands, tired, then takes off', evs('repouso').length === 1 && (run(8), evs('decolagem').length === 1));

/* relighting a brazier by holding F */
out.length = 0;
const off = D.braseiros.find((b) => R.retrato().braseiros[b.id] === 'apagado');
if (off) {
  players[2]._info.px = off.x + 1; players[2]._info.pz = off.z;
  R.receber(players[2], { op: 'f_inicio', braseiro: off.id });
  run(3.5);
  ok('holding F for 3 s relights a brazier', evs('braseiro').some((b) => b.id === off.id && b.estado === 'aceso' && b.motivo === 'f'));
}

/* phase 3: Glacial Dive into a lit brazier stuns Articuno */
out.length = 0;
R.aoDano(3400, 10000);
ok('phase 3 at 35 %', evs('fase').some((f) => f.fase === 3));
for (const w of players) { w._info.px = NE.x + 0.5; w._info.pz = NE.z; }
if (R.retrato().braseiros.NE !== 'aceso') { R.receber(players[0], { op: 'f_inicio', braseiro: 'NE' }); run(3.5); }
run(14);
ok('phase 3 opens with Glacial Dive', evs('golpe').some((g) => g.id === 'glacialdive'));
const imp = evs('mergulho').find((m) => m.sub === 'impacto');
ok('the dive into a lit brazier makes steam and Articuno is vulnerable', imp?.vapor === true && evs('vulneravel').length === 1, JSON.stringify(imp));
ok('vulnerable: hits do 1.5×', R.multiplicador() === 1.5);

/* the end */
R.morte();
ok('death is announced', evs('morte').length === 1);
const before = out.length; run(5);
ok('no attacks after death', !out.slice(before).some((m) => m.ev === 'golpe'));
R.fim();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
