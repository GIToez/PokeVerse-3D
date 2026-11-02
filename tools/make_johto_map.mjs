/* Build public/data/2000001.json — one Johto overworld like kanto.json.
   Prefabs come from scenery/kanto.glb. Layout matches the HGSS Town Map.

   Same axis as Kanto: +Z south, −Z north, +X west, −X east (the scene flips X).
   Town Map (east right, north up) is converted with x = −east, z = −north. */
import fs from 'node:fs';

const doors = JSON.parse(fs.readFileSync('public/data/doors.json', 'utf8'));
const scenes = JSON.parse(fs.readFileSync('public/data/scenes.json', 'utf8'));
const johto = scenes.cenas.find(c => c.id === 2000001);
if (!johto) throw new Error('scenes.json is missing Johto 2000001');

const G = (east, north) => ({ x: -east, z: -north });

/* HGSS Town Map centers, east/north in meters (Kanto-sized). */
const TOWN = {
  2101: { ...G(210, -95), sx: 44, sz: 32, name: 'New Bark Town' },
  2102: { ...G(85, -95), sx: 48, sz: 36, name: 'Cherrygrove City' },
  2103: { ...G(25, 85), sx: 54, sz: 48, name: 'Violet City' },
  2104: { ...G(-70, -85), sx: 46, sz: 36, name: 'Azalea Town' },
  2105: { ...G(-155, 15), sx: 68, sz: 56, name: 'Goldenrod City' },
  2106: { ...G(-35, 165), sx: 54, sz: 48, name: 'Ecruteak City' },
  2107: { ...G(-200, 145), sx: 50, sz: 44, name: 'Olivine City' },
  2108: { ...G(-245, 15), sx: 44, sz: 40, name: 'Cianwood City' },
  2109: { ...G(45, 195), sx: 42, sz: 36, name: 'Mahogany Town' },
  2110: { ...G(150, 155), sx: 50, sz: 44, name: 'Blackthorn City' },
  2111: { ...G(-95, 95), sx: 56, sz: 40, name: 'National Park' },
  2112: { ...G(5, 15), sx: 40, sz: 32, name: 'Ruins of Alph' },
  2113: { ...G(45, 265), sx: 48, sz: 40, name: 'Lake of Rage' },
  2114: { ...G(200, 75), sx: 52, sz: 48, name: 'Mt. Silver' },
  2115: { ...G(-305, 25), sx: 56, sz: 44, name: 'Johto Safari Zone' },
  2116: { ...G(-265, 165), sx: 52, sz: 40, name: 'Battle Frontier' },
};

function ew(a, b, z, sz = 28) {
  const x0 = Math.min(a, b), x1 = Math.max(a, b);
  return { x: (x0 + x1) / 2, z, sx: x1 - x0, sz };
}
function ns(x, a, b, sx = 32) {
  const z0 = Math.min(a, b), z1 = Math.max(a, b);
  return { x, z: (z0 + z1) / 2, sx, sz: z1 - z0 };
}
function edge(id, dir, pad = -6) {
  const t = TOWN[id];
  if (dir === 'e') return t.x - t.sx / 2 - pad;
  if (dir === 'w') return t.x + t.sx / 2 + pad;
  if (dir === 'n') return t.z - t.sz / 2 - pad;
  return t.z + t.sz / 2 + pad;
}

/* Route AABBs overlap the towns they connect (HGSS Town Map). */
const RTE = {
  2229: ew(edge(2101, 'w'), edge(2102, 'e'), TOWN[2101].z, 30),
  2230: ns(TOWN[2102].x, edge(2102, 'n'), edge(2103, 's'), 34),
  2231: ew(TOWN[2102].x, TOWN[2103].x, edge(2103, 's'), 32),
  2232: { x: (TOWN[2103].x + TOWN[2104].x) / 2, z: (edge(2103, 's') + edge(2104, 'n')) / 2,
    sx: Math.abs(TOWN[2104].x - TOWN[2103].x) + 24, sz: Math.abs(edge(2104, 'n') - edge(2103, 's')) + 8 },
  2233: ew(edge(2104, 'w'), edge(2105, 'e'), TOWN[2104].z, 30),
  2234: ns(TOWN[2105].x, edge(2104, 'n'), edge(2105, 's'), 34),
  2235: ns((TOWN[2105].x + TOWN[2111].x) / 2, edge(2105, 'n'), edge(2111, 's'), 48),
  2236: ew(edge(2111, 'e'), edge(2103, 'w'), TOWN[2111].z, 30),
  2237: ns((TOWN[2103].x + TOWN[2106].x) / 2, edge(2103, 'n'), edge(2106, 's'), 40),
  2238: ew(edge(2106, 'w'), edge(2107, 'e'), TOWN[2106].z, 30),
  2239: ns(TOWN[2107].x, TOWN[2106].z, edge(2107, 'n'), 30),
  2240: ns(TOWN[2107].x, edge(2107, 's'), edge(2108, 'n'), 40),
  2241: { x: (TOWN[2107].x + TOWN[2108].x) / 2, z: (TOWN[2107].z + TOWN[2108].z) / 2,
    sx: Math.abs(TOWN[2108].x - TOWN[2107].x) + 16, sz: Math.abs(TOWN[2108].z - TOWN[2107].z) + 16 },
  2242: { x: (TOWN[2106].x + TOWN[2109].x) / 2, z: (TOWN[2106].z + TOWN[2109].z) / 2,
    sx: Math.abs(TOWN[2109].x - TOWN[2106].x) + 20, sz: Math.abs(TOWN[2109].z - TOWN[2106].z) + 20 },
  2243: ns(TOWN[2109].x, edge(2109, 'n'), edge(2113, 's'), 30),
  2244: { x: (TOWN[2109].x + TOWN[2110].x) / 2, z: (TOWN[2109].z + TOWN[2110].z) / 2,
    sx: Math.abs(TOWN[2110].x - TOWN[2109].x) + 20, sz: Math.abs(TOWN[2110].z - TOWN[2109].z) + 20 },
  2245: ns(TOWN[2110].x, edge(2110, 's'), TOWN[2101].z - 8, 30),
  2246: ns((TOWN[2101].x + TOWN[2102].x) / 2, edge(2101, 'n'), TOWN[2110].z + 20, 30),
  2247: ew(edge(2108, 'w'), edge(2115, 'e'), TOWN[2108].z, 30),
  2248: ns(TOWN[2115].x, edge(2115, 's'), TOWN[2108].z, 30),
  2227: ew(edge(2101, 'e'), -280, TOWN[2101].z, 30),
  2226: ns(-280, TOWN[2101].z, TOWN[2114].z, 40),
  2228: ew(-280, TOWN[2114].x + 10, TOWN[2114].z, 30),
};

const LAY = { ...TOWN, ...RTE };

const nomes = Object.fromEntries(johto.areas.map(a => [a.id, a.nome]));
const areas = johto.areas.map(a => a.id);
const caixas = johto.areas.map(a => {
  const L = LAY[a.id] || { x: 0, z: 0, sx: 40, sz: 40 };
  return { a: a.id, x: +L.x.toFixed(1), y: 0, z: +L.z.toFixed(1), sx: +L.sx.toFixed(1), sy: 8, sz: +L.sz.toFixed(1) };
});

const objetos = [];
function add(n, x, z, a = 0) {
  objetos.push({ n, x: +x.toFixed(1), y: 0, z: +z.toFixed(1), a });
}

function fillGrass(box, step, tile) {
  const x0 = box.x - box.sx / 2 + 3, x1 = box.x + box.sx / 2 - 3;
  const z0 = box.z - box.sz / 2 + 3, z1 = box.z + box.sz / 2 - 3;
  for (let x = x0; x <= x1 + 0.01; x += step)
    for (let z = z0; z <= z1 + 0.01; z += step) add(tile, x, z);
}

function roadEW(x0, x1, z, step = 6) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a; x <= b + 0.01; x += step) add('grass_road_h_1', x, z);
}
function roadNS(x, z0, z1, step = 6) {
  const a = Math.min(z0, z1), b = Math.max(z0, z1);
  for (let z = a; z <= b + 0.01; z += step) add('grass_road_n', x, z);
}

for (const box of caixas) {
  const sea = box.a === 2240 || box.a === 2241;
  const route = box.a >= 2226;
  fillGrass(box, route ? 10 : 8, sea ? 'floor_w' : route ? 'floor_grass2' : 'sm_c_001_comgrass_01_1');
}

/* HGSS road spine. */
roadEW(TOWN[2101].x, TOWN[2102].x, TOWN[2101].z);
roadNS(TOWN[2102].x, TOWN[2102].z, TOWN[2103].z + 20);
roadEW(TOWN[2102].x, TOWN[2103].x, (TOWN[2102].z + TOWN[2103].z) / 2 + 20);
roadNS(TOWN[2103].x + 8, TOWN[2103].z, TOWN[2104].z);
roadEW(TOWN[2104].x, TOWN[2105].x, TOWN[2104].z);
roadNS(TOWN[2105].x, TOWN[2104].z, TOWN[2105].z);
roadNS(TOWN[2105].x, TOWN[2105].z, TOWN[2111].z);
roadEW(TOWN[2111].x, TOWN[2103].x, TOWN[2111].z);
roadNS(TOWN[2106].x, TOWN[2103].z, TOWN[2106].z);
roadEW(TOWN[2106].x, TOWN[2107].x, TOWN[2106].z);
roadNS(TOWN[2107].x, TOWN[2106].z, TOWN[2107].z);
roadNS(TOWN[2107].x, TOWN[2107].z, TOWN[2108].z);
roadEW(TOWN[2107].x, TOWN[2108].x, (TOWN[2107].z + TOWN[2108].z) / 2);
roadEW(TOWN[2106].x, TOWN[2109].x, TOWN[2106].z);
roadNS(TOWN[2109].x, TOWN[2109].z, TOWN[2113].z);
roadEW(TOWN[2109].x, TOWN[2110].x, TOWN[2110].z);
roadNS(TOWN[2110].x, TOWN[2110].z, TOWN[2101].z - 20);
roadNS((TOWN[2101].x + TOWN[2102].x) / 2, TOWN[2101].z, TOWN[2110].z + 40);
roadEW(TOWN[2101].x, -280, TOWN[2101].z);
roadNS(-280, TOWN[2101].z, -40);
roadEW(-280, TOWN[2114].x, TOWN[2114].z);
roadEW(TOWN[2108].x, TOWN[2115].x, TOWN[2108].z);

const BLD = {
  2101: [
    { n: 'sm_t_001_house_01', dx: -8, dz: 4, door: 6210101, arrive: 7210101 },
    { n: 'sm_t_001_house_01_red', dx: 8, dz: 4, door: 6210102, arrive: 7210102 },
    { n: 'sm_t_011_house_02', dx: 0, dz: -8, door: 6210103, arrive: 7210103 },
    { n: 'sm_t_007_house_01', dx: 10, dz: -8, door: 6210104, arrive: 7210104 },
  ],
  2102: [
    { n: 'sm_c_001_pokecen_01', dx: -10, dz: -6, door: 6210204, arrive: 7210204 },
    { n: 'sm_c_001_shop_01', dx: 10, dz: -6, door: 6210205, arrive: 7210205 },
    { n: 'sm_c_001_house_02_blue', dx: -8, dz: 8, door: 6210201, arrive: 7210201 },
    { n: 'sm_t_007_house_01', dx: 8, dz: 8, door: 6210202, arrive: 7210202 },
  ],
  2103: [
    { n: 'sm_c_001_pokecen_01', dx: -16, dz: -8, door: 6210307, arrive: 7210307 },
    { n: 'sm_c_001_shop_01', dx: -4, dz: -8, door: 6210306, arrive: 7210306 },
    { n: 'sm_c_001_gym_01', dx: 14, dz: -6, door: 6210304, arrive: 7210304 },
    { n: 'sm_t_011_house_02', dx: 0, dz: 10, door: 6210305, arrive: 7210305 },
    { n: 'sm_t_007_house_01', dx: -14, dz: 10, door: 6210301, arrive: 7210301 },
  ],
  2104: [
    { n: 'sm_c_001_pokecen_01', dx: -12, dz: -6, door: 6210405, arrive: 7210405 },
    { n: 'sm_c_001_shop_01', dx: 0, dz: -6, door: 6210404, arrive: 7210404 },
    { n: 'sm_c_001_gym_02', dx: 12, dz: -6, door: 6210403, arrive: 7210403 },
    { n: 'sm_t_005_house_01_1', dx: -8, dz: 8, door: 6210401, arrive: 7210401 },
  ],
  2105: [
    { n: 'sm_c_001_pokecen_01', dx: -22, dz: -10, door: 6210510, arrive: 7210510 },
    { n: 'sm_c_001_shop_01', dx: -6, dz: -12, door: 6210509, arrive: 7210509 },
    { n: 'sm_c_001_gym_01', dx: 18, dz: -8, door: 6210511, arrive: 7210511 },
    { n: 'sm_t_006_bicycleshop_01', dx: 8, dz: 10, door: 6210502, arrive: 7210502 },
    { n: 'sm_t_007_house_01_2', dx: -16, dz: 12, door: 6210501, arrive: 7210501 },
  ],
  2106: [
    { n: 'sm_c_001_pokecen_01', dx: -16, dz: -8, door: 6210604, arrive: 7210604 },
    { n: 'sm_c_001_shop_01', dx: -4, dz: -8, door: 6210605, arrive: 7210605 },
    { n: 'sm_c_001_gym_01', dx: 14, dz: -6, door: 6210606, arrive: 7210606 },
    { n: 'sm_t_009_house_01', dx: -10, dz: 12, door: 6210601, arrive: 7210601 },
    { n: 'sm_t_011_house_02', dx: 10, dz: 12, door: 6210602, arrive: 7210602 },
  ],
  2107: [
    { n: 'sm_c_001_pokecen_01', dx: -14, dz: -8, door: 6210706, arrive: 7210706 },
    { n: 'sm_c_001_shop_01', dx: -2, dz: -8, door: 6210707, arrive: 7210707 },
    { n: 'sm_c_001_gym_02', dx: 14, dz: -6, door: 6210708, arrive: 7210708 },
    { n: 'sm_t_007_house_01_3', dx: -8, dz: 10, door: 6210701, arrive: 7210701 },
  ],
  2108: [
    { n: 'sm_c_001_pokecen_01', dx: -10, dz: -6, door: 6210805, arrive: 7210805 },
    { n: 'sm_c_001_shop_01', dx: 2, dz: -6, door: 6210806, arrive: 7210806 },
    { n: 'sm_c_001_gym_01', dx: 14, dz: 8, door: 6210807, arrive: 7210807 },
    { n: 'sm_c_001_house_02_purple', dx: -8, dz: 10, door: 6210801, arrive: 7210801 },
  ],
  2109: [
    { n: 'sm_c_001_pokecen_01', dx: -10, dz: -6, door: 6210902, arrive: 7210902 },
    { n: 'sm_c_001_gym_02', dx: 10, dz: -6, door: 6210903, arrive: 7210903 },
    { n: 'sm_t_005_house_01_1', dx: 0, dz: 8, door: 6210901, arrive: 7210901 },
  ],
  2110: [
    { n: 'sm_c_001_pokecen_01', dx: -14, dz: -8, door: 6211005, arrive: 7211005 },
    { n: 'sm_c_001_shop_01', dx: -2, dz: -8, door: 6211004, arrive: 7211004 },
    { n: 'sm_c_001_gym_01', dx: 14, dz: -6, door: 6211008, arrive: 7211008 },
    { n: 'sm_t_011_house_02_1', dx: 0, dz: 12, door: 6211001, arrive: 7211001 },
  ],
  2114: [
    { n: 'sm_c_001_pokecen_01', dx: -8, dz: 0, door: 6211402, arrive: 7211402 },
    { n: 'sm_t_011_house_02', dx: 8, dz: 0, door: 6211401, arrive: 7211401 },
  ],
};

const used = new Set();
const npcs = [];
function putNpc(cfg, modelo, x, z, a) {
  if (!cfg) return;
  npcs.push({ cfg, modelo, face: 0, x: +x.toFixed(2), y: 0, z: +z.toFixed(2), a });
  used.add(cfg);
}

for (const [id, list] of Object.entries(BLD)) {
  const T = TOWN[+id];
  if (!T) continue;
  for (const b of list) {
    add(b.n, T.x + b.dx, T.z + b.dz);
    putNpc(b.door, 162, T.x + b.dx, T.z + b.dz + 5.2, +id);
    putNpc(b.arrive, 171, T.x + b.dx, T.z + b.dz + 6.6, +id);
  }
}

for (const box of caixas) {
  if (box.a < 2101 || box.a > 2116) continue;
  const ring = box.a >= 2226 ? 0 : 10;
  for (let i = 0; i < ring; i++) {
    const ang = (i / ring) * Math.PI * 2;
    const x = box.x + Math.cos(ang) * (box.sx / 2 - 4);
    const z = box.z + Math.sin(ang) * (box.sz / 2 - 4);
    add('tree', x, z);
  }
}

/* Ilex Forest sits on Route 34, west of Azalea. */
for (let i = 0; i < 14; i++) {
  const x = TOWN[2105].x + ((i % 5) - 2) * 6;
  const z = (TOWN[2104].z + TOWN[2105].z) / 2 + Math.floor(i / 5) * 6 - 6;
  add('tree', x, z);
}

const byArea = new Map();
for (const [id, p] of Object.entries(doors)) {
  if (p.c !== 2000001) continue;
  if (!byArea.has(p.a)) byArea.set(p.a, []);
  byArea.get(p.a).push({ cfg: +id, t: p.t, n: p.n });
}

/* Connection Center landings on the HGSS Reception Gate sides. */
const r26 = LAY[2226], r28 = LAY[2228];
putNpc(6222603, 162, r26.x, r26.z - r26.sz / 2 + 6, 2226);
putNpc(7222699, 171, r26.x, r26.z - r26.sz / 2 + 8, 2226);
putNpc(6222801, 162, r28.x - r28.sx / 2 + 8, r28.z, 2228);
putNpc(7222801, 171, r28.x - r28.sx / 2 + 10, r28.z, 2228);

for (const box of caixas) {
  const list = (byArea.get(box.a) || []).sort((u, v) => u.cfg - v.cfg);
  const leftover = list.filter(p => !used.has(p.cfg));
  const cols = Math.max(3, Math.ceil(Math.sqrt(leftover.length || 1)));
  leftover.forEach((pt, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = box.x - Math.min(14, box.sx / 2 - 4) + col * 3.5;
    const z = box.z + Math.min(10, box.sz / 2 - 4) - row * 3;
    putNpc(pt.cfg, pt.t === 6 ? 162 : 171, x, z, box.a);
  });
}

const seen = new Set();
const npcsU = [];
for (const n of npcs) {
  if (seen.has(n.cfg)) continue;
  seen.add(n.cfg);
  npcsU.push(n);
}

const out = {
  mapa: 2000001,
  nome: 'johto',
  areas,
  nomes,
  caixas,
  objetos,
  ambiente: [],
  areaEnv: [],
  grama: [],
  agua: caixas.filter(c => c.a === 2240 || c.a === 2241).map(c => ({ a: c.a, x: c.x, z: c.z, sx: c.sx, sz: c.sz })),
  portas: [],
  treinadores: [],
  historias: [],
  npcs: npcsU,
  nav: [],
  prefabs: [...new Set(objetos.map(o => o.n))],
  bbox: {
    x0: Math.min(...caixas.map(c => c.x - c.sx / 2)),
    x1: Math.max(...caixas.map(c => c.x + c.sx / 2)),
    z0: Math.min(...caixas.map(c => c.z - c.sz / 2)),
    z1: Math.max(...caixas.map(c => c.z + c.sz / 2)),
  },
};

fs.writeFileSync('public/data/2000001.json', JSON.stringify(out));
const order = [2101, 2102, 2103, 2104, 2105, 2106, 2107, 2108, 2109, 2110, 2114];
console.log('Johto', out.objetos.length, 'pieces', out.npcs.length, 'points');
console.log('bbox', out.bbox);
for (const id of order) {
  const t = TOWN[id];
  console.log(String(id), nomes[id], 'x', t.x.toFixed(0), 'z', t.z.toFixed(0));
}
