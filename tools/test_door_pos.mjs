/**
 * Long same-map gates (Johto routes, Kanto underground) must be stored when the
 * landing is the real arrival, and ignored when the client names that arrival
 * from somewhere else.
 */
import fs from 'node:fs';
import { aceitarPos, POS_PULO_M } from '../server_pos.mjs';
import { chegadaConfere } from '../server_doors.mjs';

function ok(cond, msg){ if (!cond) throw new Error(msg); }

function aceitar(prev, next, porta){
  const mesmo = !!(prev && String(prev.mapa) === String(next.mapa));
  const portaOk = !!porta && !!next.chegada && (!mesmo || chegadaConfere(next.mapa, next.x, next.z, next.chegada));
  return aceitarPos(prev, next, { porta: portaOk });
}

const doors = JSON.parse(fs.readFileSync('public/data/doors.json', 'utf8'));
let longas = 0;
for (const [mapa, cena] of [['kanto', 1000001], ['2000001', 2000001]]){
  const dados = JSON.parse(fs.readFileSync(`public/data/${mapa}.json`, 'utf8'));
  const npc = new Map((dados.npcs || []).map(n => [n.cfg, n]));
  for (const [id, p] of Object.entries(doors)){
    if (p.t !== 6 || p.c !== cena) continue;
    const dest = doors[p.n];
    if (!dest || dest.t !== 7 || dest.c !== cena) continue;
    const de = npc.get(+id), para = npc.get(+p.n);
    if (!de || !para) continue;
    const dist = Math.hypot(de.x - para.x, de.z - para.z);
    if (dist <= POS_PULO_M) continue;
    longas++;
    const from = { mapa, x: -de.x, y: 0, z: de.z };
    const land = { mapa, x: -para.x, y: 0, z: para.z, chegada: +p.n };
    ok(chegadaConfere(mapa, land.x, land.z, land.chegada), `arrival ${p.n} on ${mapa}`);
    ok(chegadaConfere(mapa, land.x + 6, land.z - 2, land.chegada), `step off ${p.n} still counts`);
    const salvo = aceitar(from, land, true);
    ok(salvo.mudou && Math.abs(salvo.pos.x - land.x) < 0.02, `gate ${id}→${p.n} (${dist.toFixed(0)} m) is stored`);
    const sem = aceitar(from, land, false);
    ok(!sem.mudou && Math.abs(sem.pos.x - from.x) < 0.02, `gate ${id} without a door is ignored`);
    ok(!chegadaConfere(mapa, land.x, land.z + 80, land.chegada), `80 m off arrival ${p.n} is not that door`);
    const longe = { mapa, x: from.x + 200, z: from.z + 200, chegada: land.chegada };
    ok(!chegadaConfere(mapa, longe.x, longe.z, land.chegada), `a spot away from gate ${id} is not the arrival`);
    const falso = aceitar(from, longe, true);
    ok(!falso.mudou && Math.abs(falso.pos.x - from.x) < 0.02, `naming ${p.n} from elsewhere is ignored`);
    const anda = aceitar(salvo.pos, { mapa, x: salvo.pos.x + 10, z: salvo.pos.z + 1 }, false);
    ok(anda.mudou && Math.abs(anda.pos.x - (salvo.pos.x + 10)) < 0.02, `walk after gate ${id}`);
  }
}
ok(longas >= 30, `expected the long gates, found ${longas}`);
ok(!chegadaConfere('2000001', 0, 0, 1), 'unknown arrival is not a door');
ok(!chegadaConfere('kanto', 0, 0, 7223601), 'a Johto arrival is not a Kanto door');

const centro = aceitar({ mapa: 'kanto', x: 10, z: 20 }, { mapa: '4110001', x: 3, z: 4, chegada: 7140101 }, true);
ok(centro.mudou && centro.pos.mapa === '4110001', 'a door into a center still changes map');
const url = aceitar({ mapa: 'kanto', x: 10, z: 20 }, { mapa: '4110001', x: 3, z: 4, chegada: 7140101 }, false);
ok(!url.mudou && url.pos.mapa === 'kanto', 'a refresh cannot pick the center by itself');

console.log('test_door_pos: ok (' + longas + ' long gates)');
