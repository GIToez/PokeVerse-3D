/**
 * Johto Centers and Marts share the Kanto rooms. Each street door lands in
 * that city's copy, the exit returns to the step outside, and a wipe on the
 * Johto street picks the nearest Center.
 */
import fs from 'node:fs';
import { estoque } from '../item_rules.mjs';
import {
  CENTROS_JOHTO, LOJAS_JOHTO, LOJA_PADRAO,
  CASA_JOHTO, cenaCasaJohto, cenaSalaCompartilhada, centroJohtoMaisPerto, centroPelaChegadaJohto,
  ehChegadaCentroJohto, ehChegadaLojaJohto,
} from '../johto_centers.mjs';

function ok(cond, msg){ if (!cond) throw new Error(msg); }

const doors = JSON.parse(fs.readFileSync('public/data/doors.json', 'utf8'));
const scenes = JSON.parse(fs.readFileSync('public/data/scenes.json', 'utf8'));
const glb = JSON.parse(fs.readFileSync('public/data/npcs_glb.json', 'utf8'));
const map = JSON.parse(fs.readFileSync('public/data/2000001.json', 'utf8'));
const centerRoom = JSON.parse(fs.readFileSync('public/data/4110001.json', 'utf8'));
const martRoom = JSON.parse(fs.readFileSync('public/data/4110007.json', 'utf8'));
const menu = JSON.parse(fs.readFileSync('public/data/menu_data.json', 'utf8'));
const interiores = new Set(fs.readFileSync('public/data/interior_maps.txt', 'utf8').split(/\s+/).filter(Boolean));
const npc = new Map((map.npcs || []).map(n => [n.cfg, n]));
const cena = id => scenes.cenas.find(c => c.id === id);

ok(interiores.has('4110001') && interiores.has('4110007'), 'shared rooms are exported');
ok(cena(4110001).areas[0].id === 1401, 'Center room still owned by Viridian');
ok(cena(4110007).areas[0].id === 1501, 'Mart room still owned by Viridian');

function conferir(lugar, cenaId, pessoas){
  const street = doors[String(lugar.porta)];
  const landingId = lugar.porta + 1000000;
  const saida = lugar.chegada - 1000000;
  ok(street?.t === 6 && street.c === 2000001 && street.a === lugar.rua, `street door ${lugar.porta}`);
  ok(street.n === lugar.chegada, `${lugar.nome} door opens on ${lugar.chegada}, got ${street.n}`);
  const arrival = doors[String(lugar.chegada)];
  ok(arrival?.t === 7 && arrival.c === lugar.a && arrival.a === lugar.a, `arrival ${lugar.chegada}`);
  const exit = doors[String(saida)];
  ok(exit?.t === 6 && exit.c === lugar.a && exit.n === landingId, `exit ${saida} returns to ${landingId}`);
  const back = doors[String(landingId)];
  ok(back?.t === 7 && back.c === 2000001 && back.a === lugar.rua, `street landing ${landingId} is Johto`);
  const de = npc.get(lugar.porta), para = npc.get(landingId);
  ok(de && para, `markers for ${lugar.porta}`);
  ok(de.x === para.x && Math.abs((para.z - de.z) - 1.8) < 0.05, `${lugar.nome} landing is the step outside the door`);
  const area = cena(cenaId).areas.find(a => a.id === lugar.a);
  ok(area?.nome === lugar.nome && area.tipo === 2, `area ${lugar.a} on scene ${cenaId}`);
  for (const [id, papel] of pessoas){
    ok(glb[id]?.papel === papel, `${lugar.nome} npc ${id} is ${papel}`);
  }
}

for (const c of CENTROS_JOHTO){
  const joy = String(c.chegada - 5000000);
  conferir(c, 4110001, [[joy, 'cura'], [String(+joy + 1), 'caixa']]);
}
for (const c of LOJAS_JOHTO){
  conferir(c, 4110007, [[String(c.chegada - 5000000), 'loja']]);
}

/** Same city-digit swap the shared room applies when the arrival is not in the JSON. */
function remap(npcs, chegada){
  const ch = String(chegada).match(/^(\d)(14|15)(\d\d)(\d\d)$/);
  ok(ch && !npcs.some(q => q.cfg === +chegada), `template does not already contain ${chegada}`);
  return npcs.map(q => {
    const m = String(q.cfg).match(/^(\d)(14|15)(\d\d)(\d\d)$/);
    if (m && m[2] === ch[2] && m[3] !== ch[3]) return { ...q, cfg: +(m[1] + m[2] + ch[3] + m[4]) };
    return q;
  });
}
const pewter = remap(centerRoom.npcs, 7142101).map(n => n.cfg);
ok(pewter.includes(7142101) && pewter.includes(6142101) && pewter.includes(2142101) && pewter.includes(2142102), 'Cherrygrove Center roster');
const cinnabar = remap(martRoom.npcs, 7152901).map(n => n.cfg);
ok(cinnabar.includes(7152901) && cinnabar.includes(6152901) && cinnabar.includes(2152901), 'Blackthorn Mart roster');

ok(ehChegadaCentroJohto(7142101) && ehChegadaCentroJohto(7143001), 'Johto center arrivals');
ok(!ehChegadaCentroJohto(7140101) && !ehChegadaCentroJohto(7152101) && !ehChegadaCentroJohto(7142001), 'Kanto and mart arrivals are not Johto centers');
ok(ehChegadaLojaJohto(7152101) && ehChegadaLojaJohto(7152901) && !ehChegadaLojaJohto(7150101), 'Johto mart arrivals');
ok(cenaSalaCompartilhada(1421) === 4110001 && cenaSalaCompartilhada(1430) === 4110001, 'Johto Center areas share room 4110001');
ok(cenaSalaCompartilhada(1402) === 4110001 && cenaSalaCompartilhada(1521) === 4110007, 'Pewter Center and Cherrygrove Mart rooms');
ok(cenaSalaCompartilhada(1506) === 0 && cenaSalaCompartilhada(2102) === 0, 'the department store and the street are not the shared rooms');

for (const c of CENTROS_JOHTO){
  const de = npc.get(c.porta);
  const perto = centroJohtoMaisPerto(-de.x, de.z, map.npcs, -1);
  ok(perto?.chegada === c.chegada, `standing at ${c.nome} wakes there, got ${perto?.chegada}`);
  ok(centroPelaChegadaJohto(c.chegada)?.chegada === c.chegada, `inside ${c.nome}`);
}
for (const c of LOJAS_JOHTO){
  const centro = CENTROS_JOHTO.find(x => x.cidade === c.cidade);
  ok(centroPelaChegadaJohto(c.chegada)?.chegada === centro.chegada, `${c.nome} wipe goes to that city's Center`);
}
ok(centroPelaChegadaJohto(7140101) == null, 'a Kanto Center arrival is not remapped to Johto');
ok(centroJohtoMaisPerto(undefined, 0, map.npcs) == null, 'no position, no guess');

const lojas = menu.lojas || {};
const aba = id => (id && lojas[id]) ? id : LOJA_PADRAO;
for (const c of LOJAS_JOHTO){
  const clerk = String(c.chegada - 5000000);
  ok(!lojas[clerk], `clerk ${clerk} has no stock row of its own`);
  ok(aba(clerk) === LOJA_PADRAO, `clerk ${clerk} sells the Viridian mart`);
  ok(glb[clerk]?.papel === 'loja' && glb[clerk].falas?.[0] && !/isn't available/i.test(glb[clerk].falas[0]), `${c.nome} clerk invites you in`);
}
ok(estoque(lojas, LOJA_PADRAO).length > 0, 'the shared mart has stock');

/** Same order the game uses: a real room, then the shared house. */
const exportadas = interiores;
function resolver(id){
  const dest = doors[String(id)];
  if (!dest) return 0;
  const mundo = dest.c === 1000001 || dest.c === 2000001 || dest.c === 2500001 ? dest.c : 0;
  const daArea = scenes.cenas.find(c => c.areas?.some(ar => ar.id === dest.a))?.id || 0;
  return mundo || daArea || cenaSalaCompartilhada(dest.a)
    || (exportadas.has(String(dest.c)) ? dest.c : 0)
    || cenaCasaJohto(id, doors, exportadas)
    || dest.c;
}
ok(resolver(7280501) === CASA_JOHTO && resolver(7281101) === CASA_JOHTO, 'Guide Gent and the Violet Gym open the shared house');
ok(resolver(7142101) === 4110001 && resolver(7152101) === 4110007, 'Center and Mart stay in their own rooms');
ok(resolver(7170604) === 4120018 && cenaCasaJohto(7170604, doors, exportadas) === 0, 'the Connection Center keeps its own room');
ok(cenaCasaJohto(7510199, doors, exportadas) === 0 && !doors['6210504'].n, 'a door with no way back stays shut');
ok(doors['6280501'].n === 7210201 && doors['7210201'].c === 2000001, 'Guide Gent leaves onto the Cherrygrove step');
const casa = cena(CASA_JOHTO);
ok(casa.areas.find(a => a.id === 2805)?.nome === "Guide Gent's House", 'admin scene list names the Cherrygrove house');
ok(casa.areas.find(a => a.id === 2801)?.nome === "Elm's Lab", "admin scene list names Elm's Lab");
ok(casa.areas.find(a => a.id === 2811)?.nome === 'Violet Gym', 'admin scene list names the Violet Gym');
ok(!casa.areas.some(a => a.id === 1706 || a.id === 1421 || a.id === 1521 || a.id === 5101), 'Center, Mart, and the Connection Center are not filed under the house');
let casas = 0;
for (const [id, p] of Object.entries(doors)){
  if (!(p.t === 6 && p.c === 2000001 && p.n)) continue;
  if (cenaCasaJohto(p.n, doors, exportadas) !== CASA_JOHTO) continue;
  casas++;
  ok(casa.areas.some(a => a.id === doors[String(p.n)].a), `area ${doors[String(p.n)].a} is on the shared house`);
  ok(resolver(p.n) === CASA_JOHTO, `door ${id} opens the shared house`);
  const saida = doors[String(p.n - 1000000)];
  ok(saida?.n === +id + 1000000 && doors[String(saida.n)]?.c === 2000001, `door ${id} returns to its own step`);
}
ok(casas >= 90, `shared-house doors, got ${casas}`);

console.log(`test_johto_centers: ok (${CENTROS_JOHTO.length} centers, ${LOJAS_JOHTO.length} marts, ${casas} houses)`);
