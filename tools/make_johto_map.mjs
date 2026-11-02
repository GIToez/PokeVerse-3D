/* Build public/data/2000001.json — one Johto overworld like kanto.json.
   Pieces come from the Kanto prefab library (index loads scenery/kanto.glb for this map).
   Layout follows HGSS: New Bark on the east, Cherrygrove west, Violet north, Mt. Silver northeast. */
import fs from 'node:fs';

const doors = JSON.parse(fs.readFileSync('public/data/doors.json', 'utf8'));
const scenes = JSON.parse(fs.readFileSync('public/data/scenes.json', 'utf8'));
const johto = scenes.cenas.find(c => c.id === 2000001);
if (!johto) throw new Error('scenes.json is missing Johto 2000001');

/* dump coords: +z is south (same as Kanto). Positions are town centers. */
const LAY = {
  2101: { x: 160, z: 50, sx: 48, sz: 36 },   // New Bark
  2102: { x: 20, z: 50, sx: 50, sz: 40 },    // Cherrygrove
  2103: { x: 20, z: -90, sx: 54, sz: 48 },   // Violet
  2104: { x: 20, z: 160, sx: 48, sz: 36 },   // Azalea
  2105: { x: 20, z: 100, sx: 62, sz: 56 },   // Goldenrod
  2106: { x: 20, z: -170, sx: 54, sz: 48 },  // Ecruteak
  2107: { x: -80, z: -170, sx: 50, sz: 44 }, // Olivine
  2108: { x: -160, z: -80, sx: 44, sz: 40 }, // Cianwood
  2109: { x: 100, z: -170, sx: 44, sz: 36 }, // Mahogany
  2110: { x: 180, z: -170, sx: 50, sz: 44 }, // Blackthorn
  2111: { x: 20, z: -130, sx: 56, sz: 40 },  // National Park
  2112: { x: 70, z: -50, sx: 40, sz: 32 },   // Ruins of Alph
  2113: { x: 100, z: -230, sx: 48, sz: 40 }, // Lake of Rage
  2114: { x: 220, z: -80, sx: 52, sz: 48 },  // Mt. Silver
  2115: { x: -40, z: 100, sx: 60, sz: 48 },  // Safari
  2116: { x: -80, z: 160, sx: 56, sz: 44 },  // Frontier
  2226: { x: 180, z: -20, sx: 40, sz: 56 },  // Route 26
  2227: { x: 140, z: -20, sx: 48, sz: 28 },  // Route 27
  2228: { x: 220, z: -20, sx: 40, sz: 56 },  // Route 28 (Mt. Silver road)
  2229: { x: 90, z: 50, sx: 80, sz: 28 },    // Route 29
  2230: { x: 20, z: -20, sx: 36, sz: 60 },   // Route 30
  2231: { x: 20, z: -55, sx: 36, sz: 28 },   // Route 31
  2232: { x: 20, z: -20, sx: 28, sz: 40 },   // overlap ok — R32 south of Violet
  2233: { x: 20, z: 130, sx: 36, sz: 28 },   // Route 33
  2234: { x: 20, z: 75, sx: 36, sz: 28 },    // Route 34
  2235: { x: 20, z: 20, sx: 36, sz: 36 },    // Route 35
  2236: { x: 55, z: -90, sx: 48, sz: 28 },   // Route 36
  2237: { x: 20, z: -150, sx: 28, sz: 28 },  // Route 37
  2238: { x: -30, z: -170, sx: 48, sz: 28 }, // Route 38
  2239: { x: -80, z: -140, sx: 28, sz: 40 }, // Route 39
  2240: { x: -120, z: -140, sx: 40, sz: 28 },
  2241: { x: -160, z: -130, sx: 40, sz: 48 },
  2242: { x: 60, z: -170, sx: 48, sz: 28 },
  2243: { x: 100, z: -200, sx: 28, sz: 36 },
  2244: { x: 140, z: -170, sx: 48, sz: 28 },
  2245: { x: 180, z: -120, sx: 28, sz: 56 },
  2246: { x: 180, z: 20, sx: 28, sz: 48 },
  2247: { x: -40, z: 130, sx: 48, sz: 28 },
  2248: { x: -40, z: 70, sx: 36, sz: 28 },
};
LAY[2232] = { x: 20, z: 10, sx: 28, sz: 70 };

const nomes = Object.fromEntries(johto.areas.map(a => [a.id, a.nome]));
const areas = johto.areas.map(a => a.id);
const caixas = johto.areas.map(a => {
  const L = LAY[a.id] || { x: 0, z: 0, sx: 40, sz: 40 };
  return { a: a.id, x: L.x, y: 0, z: L.z, sx: L.sx, sy: 8, sz: L.sz };
});

const objetos = [];
function add(n, x, z, a = 0) { objetos.push({ n, x: +x.toFixed(1), y: 0, z: +z.toFixed(1), a }); }

for (const box of caixas) {
  const step = 8;
  const x0 = box.x - box.sx / 2 + 4, x1 = box.x + box.sx / 2 - 4;
  const z0 = box.z - box.sz / 2 + 4, z1 = box.z + box.sz / 2 - 4;
  const grass = box.a >= 2226 ? 'floor_grass2' : 'sm_c_001_comgrass_01_1';
  for (let x = x0; x <= x1 + 0.01; x += step)
    for (let z = z0; z <= z1 + 0.01; z += step) add(grass, x, z);
}

const TOWN = {
  2101: ['sm_c_001_pokecen_01', 'sm_t_001_house_01', 'sm_t_001_house_01_red'],
  2102: ['sm_c_001_pokecen_01', 'sm_c_001_house_02_blue', 'sm_t_007_house_01'],
  2103: ['sm_c_001_pokecen_01', 'sm_c_001_gym_01', 'sm_t_011_house_02'],
  2104: ['sm_c_001_pokecen_01', 'sm_c_001_gym_02', 'sm_t_005_house_01_1'],
  2105: ['sm_c_001_pokecen_01', 'sm_c_001_gym_01', 'sm_t_003_pokecompany_01_1', 'sm_t_007_house_01_2'],
  2106: ['sm_c_001_pokecen_01', 'sm_c_001_gym_01', 'sm_t_009_house_01'],
  2107: ['sm_c_001_pokecen_01', 'sm_c_001_gym_02', 'sm_t_007_house_01_3'],
  2108: ['sm_c_001_pokecen_01', 'sm_c_001_gym_01', 'sm_c_001_house_02_purple'],
  2109: ['sm_c_001_pokecen_01', 'sm_c_001_gym_02', 'sm_t_005_house_01_1'],
  2110: ['sm_c_001_pokecen_01', 'sm_c_001_gym_01', 'sm_t_011_house_02_1'],
  2114: ['sm_c_001_pokecen_01', 'sm_t_011_house_02'],
};
for (const [id, list] of Object.entries(TOWN)) {
  const L = LAY[+id]; if (!L) continue;
  list.forEach((n, i) => add(n, L.x - 10 + i * 10, L.z - 6));
}

for (const box of caixas) {
  if (box.a < 2101 || box.a > 2116) continue;
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    add('tree', box.x + Math.cos(ang) * (box.sx / 2 - 3), box.z + Math.sin(ang) * (box.sz / 2 - 3));
  }
}

const byArea = new Map();
for (const [id, p] of Object.entries(doors)) {
  if (p.c !== 2000001) continue;
  if (!byArea.has(p.a)) byArea.set(p.a, []);
  byArea.get(p.a).push({ cfg: +id, t: p.t });
}

const npcs = [];
function putNpc(cfg, modelo, x, z, a) {
  npcs.push({ cfg, modelo, face: 0, x: +x.toFixed(2), y: 0, z: +z.toFixed(2), a });
}

for (const box of caixas) {
  const list = (byArea.get(box.a) || []).sort((u, v) => u.cfg - v.cfg);
  const cols = Math.max(3, Math.ceil(Math.sqrt(list.length || 1)));
  list.forEach((pt, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = box.x - 12 + col * 4;
    const z = box.z + 4 + row * 3;
    const door = pt.t === 6;
    putNpc(pt.cfg, door ? 162 : 171, x, z, box.a);
  });
}

/* Extra markers on New Bark / Mt. Silver. Connection Center itself
   lands on Routes 26 (south) and 28 (west), matching HGSS. */
putNpc(7210199, 171, LAY[2101].x, LAY[2101].z + 10, 2101);
putNpc(7211499, 171, LAY[2114].x, LAY[2114].z + 10, 2114);

const seen = new Set();
const npcsU = [];
for (const n of npcs) {
  if (seen.has(n.cfg)) {
    const i = npcsU.findIndex(q => q.cfg === n.cfg);
    if (i >= 0 && (n.cfg === 7210199 || n.cfg === 7211499 || n.cfg === 6210198 || n.cfg === 6211498)) npcsU[i] = n;
    continue;
  }
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
  agua: [],
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
console.log('Johto map', out.objetos.length, 'pieces', out.npcs.length, 'points', 'bbox', out.bbox);
