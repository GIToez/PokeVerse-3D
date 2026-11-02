/* Build public/data/2000001.json — one Johto overworld like kanto.json.
   Prefabs come from scenery/kanto.glb. Land follows the HGSS Town Map
   (New Bark SE, corridors between towns, water on the west). Towns are
   stamped clips of real Kanto cities — not a 1 m grass carpet.

   Axis: +Z south, −Z north, +X west, −X east (scene flipX = −1).
   Town Map (east right, north up) → x = −east, z = −north. */
import fs from 'node:fs';

const doors = JSON.parse(fs.readFileSync('public/data/doors.json', 'utf8'));
const scenes = JSON.parse(fs.readFileSync('public/data/scenes.json', 'utf8'));
const kanto = JSON.parse(fs.readFileSync('public/data/kanto.json', 'utf8'));
const johto = scenes.cenas.find(c => c.id === 2000001);
if (!johto) throw new Error('scenes.json is missing Johto 2000001');

const G = (east, north) => ({ x: -east, z: -north });

/* HGSS Town Map centers. Box size comes from the stamped Kanto clip. */
const TOWN = {
  2101: { ...G(210, -95), name: 'New Bark Town' },
  2102: { ...G(85, -95), name: 'Cherrygrove City' },
  2103: { ...G(20, 90), name: 'Violet City' },
  2104: { ...G(-75, -85), name: 'Azalea Town' },
  2105: { ...G(-160, 20), name: 'Goldenrod City' },
  2106: { ...G(-35, 175), name: 'Ecruteak City' },
  2107: { ...G(-210, 155), name: 'Olivine City' },
  2108: { ...G(-255, 20), name: 'Cianwood City' },
  2109: { ...G(50, 205), name: 'Mahogany Town' },
  2110: { ...G(155, 165), name: 'Blackthorn City' },
  2111: { ...G(-95, 100), name: 'National Park' },
  2112: { ...G(5, 20), name: 'Ruins of Alph' },
  2113: { ...G(50, 275), name: 'Lake of Rage' },
  2114: { ...G(210, 80), name: 'Mt. Silver' },
  2115: { ...G(-315, 30), name: 'Johto Safari Zone' },
  2116: { ...G(-275, 170), name: 'Battle Frontier' },
  2117: { ...G(70, -70), name: 'Ilex Forest' },
  2118: { ...G(-30, -70), name: 'Union Cave' },
  2119: { ...G(-50, 45), name: 'Dark Cave' },
  2120: { ...G(-5, 185), name: 'Mt. Mortar' },
  2121: { ...G(-100, 175), name: 'Ice Path' },
  2122: { ...G(230, -70), name: 'Whirl Islands' },
  2123: { ...G(250, -95), name: 'Tohjo Falls' },
  2124: { ...G(-290, 20), name: 'Safari Zone Gate' },
  2125: { ...G(-250, 170), name: 'Frontier Access' },
  2126: { ...G(-140, 55), name: 'Pokéathlon Dome' },
  2127: { ...G(-275, 15), name: 'Cliff Cave' },
  2128: { ...G(-265, 15), name: 'Cliff Edge Gate' },
  2129: { ...G(-20, 185), name: 'Bellchime Trail' },
  2130: { ...G(-280, -5), name: 'Embedded Tower' },
};

/* Kanto area id stamped at each Johto town. */
const CLIP_OF = {
  2101: 1101, // Pallet
  2102: 1102, // Viridian
  2103: 1103, // Pewter
  2104: 1106, // Lavender
  2105: 1107, // Celadon
  2106: 1103, // Pewter
  2107: 1105, // Vermilion
  2108: 1110, // Cinnabar
  2109: 1101, // Pallet
  2110: 1103, // Pewter
  2111: 1191, // Viridian Forest (center crop)
  2112: 1106, // Lavender
  2113: 1110, // Cinnabar (lake island)
  2114: 1110, // Cinnabar / mountain island
  2115: 1192, // Safari (center crop)
  2116: 1108, // Saffron
};

function inBox(o, box, pad = 0) {
  return o.x >= box.x - box.sx / 2 - pad && o.x <= box.x + box.sx / 2 + pad
    && o.z >= box.z - box.sz / 2 - pad && o.z <= box.z + box.sz / 2 + pad;
}

function clipArea(id, maxW = Infinity, maxH = Infinity) {
  const box = kanto.caixas.find(c => c.a === id);
  if (!box) throw new Error('missing Kanto area ' + id);
  const hw = Math.min(box.sx, maxW) / 2;
  const hh = Math.min(box.sz, maxH) / 2;
  const objs = kanto.objetos.filter(o =>
    Math.abs(o.x - box.x) <= hw && Math.abs(o.z - box.z) <= hh);
  return {
    sx: Math.min(box.sx, maxW),
    sz: Math.min(box.sz, maxH),
    objs: objs.map(o => ({
      n: o.n, dx: o.x - box.x, dz: o.z - box.z, y: o.y || 0, a: o.a || 0,
    })),
  };
}

const clips = {};
for (const [jid, kid] of Object.entries(CLIP_OF)) {
  const crop = +jid === 2111 ? [52, 44] : +jid === 2115 ? [56, 44] : [Infinity, Infinity];
  clips[+jid] = clipArea(kid, crop[0], crop[1]);
  TOWN[+jid].sx = clips[+jid].sx;
  TOWN[+jid].sz = clips[+jid].sz;
}

for (const id of Object.keys(TOWN)) {
  if (!TOWN[id].sx) { TOWN[id].sx = 36; TOWN[id].sz = 28; }
}

function edge(id, dir, pad = 2) {
  const t = TOWN[id];
  if (dir === 'e') return t.x - t.sx / 2 - pad;
  if (dir === 'w') return t.x + t.sx / 2 + pad;
  if (dir === 'n') return t.z - t.sz / 2 - pad;
  return t.z + t.sz / 2 + pad;
}

const W = 16; // corridor width — matches a Kanto route lane, not a continent
function ew(x0, x1, z, sz = W) {
  return { x: (x0 + x1) / 2, z, sx: Math.abs(x1 - x0), sz };
}
function ns(x, z0, z1, sx = W) {
  return { x, z: (z0 + z1) / 2, sx, sz: Math.abs(z1 - z0) };
}

/* Narrow HGSS corridors. Extra L-arms are stamped but the caixa is the main lane. */
const RTE = {
  2229: ew(edge(2101, 'w'), edge(2102, 'e'), TOWN[2101].z),           // 29
  2230: ns(TOWN[2102].x, edge(2102, 'n'), edge(2103, 's') + 24),      // 30
  2231: ew(TOWN[2102].x - 8, edge(2103, 'e'), edge(2103, 's')),       // 31
  2232: ns(TOWN[2103].x + 10, edge(2103, 's'), edge(2104, 'n') - 8),  // 32
  2233: ew(edge(2104, 'w'), edge(2105, 'e') + 20, TOWN[2104].z),      // 33
  2234: ns(TOWN[2105].x, edge(2104, 'n') + 8, edge(2105, 's')),       // 34
  2235: ns(TOWN[2105].x + 8, edge(2105, 'n'), edge(2111, 's')),       // 35
  2236: ew(edge(2111, 'e'), edge(2103, 'w'), TOWN[2111].z),           // 36
  2237: ns((TOWN[2103].x + TOWN[2106].x) / 2, edge(2103, 'n'), edge(2106, 's')), // 37
  2238: ew(edge(2106, 'w'), edge(2107, 'e'), TOWN[2106].z),           // 38
  2239: ns(TOWN[2107].x, TOWN[2106].z, edge(2107, 'n')),              // 39
  2240: ns(TOWN[2107].x, edge(2107, 's'), (TOWN[2107].z + TOWN[2108].z) / 2, 22), // 40
  2241: ew(TOWN[2107].x, TOWN[2108].x, (TOWN[2107].z + TOWN[2108].z) / 2, 22), // 41
  2242: ew(edge(2106, 'e'), edge(2109, 'w'), TOWN[2106].z),           // 42
  2243: ns(TOWN[2109].x, edge(2109, 'n'), edge(2113, 's')),           // 43
  2244: ew(edge(2109, 'e'), edge(2110, 'w'), TOWN[2110].z),           // 44
  2245: ns(TOWN[2110].x, edge(2110, 's'), TOWN[2101].z - 10),         // 45
  2246: ns((TOWN[2101].x + TOWN[2102].x) / 2, TOWN[2101].z, TOWN[2110].z + 16), // 46
  2247: ew(edge(2108, 'w'), edge(2115, 'e'), TOWN[2108].z),           // 47
  2248: ns(TOWN[2115].x, edge(2115, 's'), TOWN[2108].z),              // 48
  2227: ew(edge(2101, 'e'), TOWN[2123].x, TOWN[2101].z),              // 27
  2226: ns(TOWN[2123].x, TOWN[2101].z, TOWN[2114].z),                 // 26
  2228: ew(TOWN[2123].x, edge(2114, 'e'), TOWN[2114].z),              // 28
};

const LAY = { ...TOWN, ...RTE };

const nomes = Object.fromEntries(johto.areas.map(a => [a.id, a.nome]));
const areas = johto.areas.map(a => a.id);
const caixas = johto.areas.map(a => {
  const L = LAY[a.id] || { x: 0, z: 0, sx: 32, sz: 24 };
  return {
    a: a.id, x: +L.x.toFixed(1), y: 0, z: +L.z.toFixed(1),
    sx: +(+L.sx || 32).toFixed(1), sy: 8, sz: +(+L.sz || 24).toFixed(1),
  };
});

const objetos = [];
const landAt = new Set();
function add(n, x, z, a = 0, y = 0) {
  const k = n + '|' + Math.round(x * 2) + '|' + Math.round(z * 2);
  if (landAt.has(k)) return;
  landAt.add(k);
  const o = { n, x: +(+x).toFixed(1), y: +(+y).toFixed(2), z: +(+z).toFixed(1) };
  if (a) o.a = +(+a).toFixed(3);
  objetos.push(o);
}

function stampClip(clip, cx, cz) {
  for (const o of clip.objs) add(o.n, cx + o.dx, cz + o.dz, o.a, o.y);
}

/* Repeating 16 m slices of Route 1 (NS) and Route 3 (EW). */
function sliceNS(areaId, halfW = 8, len = 16) {
  const box = kanto.caixas.find(c => c.a === areaId);
  return kanto.objetos
    .filter(o => Math.abs(o.x - box.x) <= halfW
      && o.z >= box.z - len / 2 && o.z <= box.z + len / 2)
    .map(o => ({ n: o.n, dx: o.x - box.x, dz: o.z - box.z, y: o.y || 0, a: o.a || 0 }));
}
function sliceEW(areaId, halfH = 8, len = 16) {
  const box = kanto.caixas.find(c => c.a === areaId);
  return kanto.objetos
    .filter(o => Math.abs(o.z - box.z) <= halfH
      && o.x >= box.x - len / 2 && o.x <= box.x + len / 2)
    .map(o => ({ n: o.n, dx: o.x - box.x, dz: o.z - box.z, y: o.y || 0, a: o.a || 0 }));
}

const TILE_NS = sliceNS(1201, 8, 18);
const TILE_EW = sliceEW(1203, 8, 18);
const TILE_LEN = 18;

function stampNS(x, z0, z1, tile = TILE_NS) {
  const a = Math.min(z0, z1), b = Math.max(z0, z1);
  for (let z = a; z < b - 0.5; z += TILE_LEN) {
    for (const o of tile) {
      const zz = z + TILE_LEN / 2 + o.dz;
      if (zz >= a - 1 && zz <= b + 1) add(o.n, x + o.dx, zz, o.a, o.y);
    }
  }
}
function stampEW(x0, x1, z, tile = TILE_EW) {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a; x < b - 0.5; x += TILE_LEN) {
    for (const o of tile) {
      const xx = x + TILE_LEN / 2 + o.dx;
      if (xx >= a - 1 && xx <= b + 1) add(o.n, xx, z + o.dz, o.a, o.y);
    }
  }
}

/* Town clips first so they win the landAt lock against route tiles. */
for (const [id, clip] of Object.entries(clips)) {
  const T = TOWN[+id];
  if (T) stampClip(clip, T.x, T.z);
}

/* Landmark props (no full-box fill). */
function grove(cx, cz, n = 16, step = 5) {
  for (let i = 0; i < n; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    add('tree', cx + (col - 1.5) * step, cz + (row - 1.5) * step);
  }
}
grove(TOWN[2117].x, TOWN[2117].z, 20, 5);
add('floor_cliff_obj', TOWN[2118].x, TOWN[2118].z);
add('floor_cliff_obj', TOWN[2119].x, TOWN[2119].z);
add('floor_cliff_obj', TOWN[2120].x, TOWN[2120].z);
add('floor_cliff_obj', TOWN[2121].x, TOWN[2121].z);
add('floor_cliff_obj', TOWN[2123].x, TOWN[2123].z);
add('floor_cliff_obj', TOWN[2127].x, TOWN[2127].z);
add('sm_t_003_pokecompany_01_1', TOWN[2126].x, TOWN[2126].z);
add('sea_rock', TOWN[2122].x, TOWN[2122].z);
add('sea_rock', TOWN[2122].x + 8, TOWN[2122].z - 6);
add('sea_rock', TOWN[2122].x - 6, TOWN[2122].z + 5);

/* HGSS road spine — Route 1 / Route 3 slices, not a grass carpet. */
stampEW(TOWN[2101].x, TOWN[2102].x, TOWN[2101].z);
stampNS(TOWN[2102].x, TOWN[2102].z, TOWN[2103].z + 16);
stampEW(TOWN[2102].x, TOWN[2103].x, edge(2103, 's'));
stampNS(TOWN[2103].x + 10, TOWN[2103].z, TOWN[2104].z);
stampEW(TOWN[2104].x, TOWN[2105].x, TOWN[2104].z);
stampNS(TOWN[2105].x, TOWN[2104].z, TOWN[2105].z);
stampNS(TOWN[2105].x + 8, TOWN[2105].z, TOWN[2111].z);
stampEW(TOWN[2111].x, TOWN[2103].x, TOWN[2111].z);
stampNS((TOWN[2103].x + TOWN[2106].x) / 2, TOWN[2103].z, TOWN[2106].z);
stampEW(TOWN[2106].x, TOWN[2107].x, TOWN[2106].z);
stampNS(TOWN[2107].x, TOWN[2106].z, TOWN[2107].z);
stampNS(TOWN[2107].x, TOWN[2107].z, (TOWN[2107].z + TOWN[2108].z) / 2);
stampEW(TOWN[2107].x, TOWN[2108].x, (TOWN[2107].z + TOWN[2108].z) / 2);
stampEW(TOWN[2106].x, TOWN[2109].x, TOWN[2106].z);
stampNS(TOWN[2109].x, TOWN[2109].z, TOWN[2113].z);
stampEW(TOWN[2109].x, TOWN[2110].x, TOWN[2110].z);
stampNS(TOWN[2110].x, TOWN[2110].z, TOWN[2101].z - 8);
stampNS((TOWN[2101].x + TOWN[2102].x) / 2, TOWN[2101].z, TOWN[2110].z + 12);
stampEW(TOWN[2101].x, TOWN[2123].x, TOWN[2101].z);
stampNS(TOWN[2123].x, TOWN[2101].z, TOWN[2114].z);
stampEW(TOWN[2123].x, TOWN[2114].x, TOWN[2114].z);
stampEW(TOWN[2108].x, TOWN[2115].x, TOWN[2108].z);
stampNS(TOWN[2115].x, TOWN[2115].z, TOWN[2108].z);
stampEW(TOWN[2107].x, TOWN[2116].x, TOWN[2116].z);

const SEA = new Set([2240, 2241, 2122, 2113]);
const grama = [];
const agua = [];

function waterBand(x0, x1, z0, z1, area) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
  const az = Math.min(z0, z1), bz = Math.max(z0, z1);
  for (let x = Math.round(ax); x <= Math.round(bx); x += 2) {
    for (let z = Math.round(az); z <= Math.round(bz); z += 2) {
      agua.push({ tipo: 33, x: x + 0.5, y: 0, z: z + 0.5, a: area });
    }
  }
}
waterBand(TOWN[2107].x - 10, TOWN[2107].x + 10,
  TOWN[2107].z + 20, (TOWN[2107].z + TOWN[2108].z) / 2, 2240);
waterBand(TOWN[2107].x, TOWN[2108].x,
  (TOWN[2107].z + TOWN[2108].z) / 2 - 10, (TOWN[2107].z + TOWN[2108].z) / 2 + 10, 2241);
waterBand(TOWN[2122].x - 16, TOWN[2122].x + 16, TOWN[2122].z - 12, TOWN[2122].z + 12, 2122);
waterBand(TOWN[2113].x - 14, TOWN[2113].x + 14, TOWN[2113].z - 10, TOWN[2113].z + 10, 2113);

/* Encounter grass only on the stamped route lanes, not a field. */
function grassLane(x0, z0, x1, z1, area) {
  const steps = Math.max(4, Math.round(Math.hypot(x1 - x0, z1 - z0) / 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    grama.push({
      cfg: area * 100 + (i % 97), tipo: 41,
      x: +(x + 1.5).toFixed(1), y: 0, z: +z.toFixed(1), a: area,
    });
  }
}
const lanes = [
  [2229, TOWN[2101].x, TOWN[2101].z, TOWN[2102].x, TOWN[2102].z],
  [2230, TOWN[2102].x, TOWN[2102].z, TOWN[2102].x, TOWN[2103].z],
  [2232, TOWN[2103].x + 10, TOWN[2103].z, TOWN[2104].x, TOWN[2104].z],
  [2234, TOWN[2105].x, TOWN[2104].z, TOWN[2105].x, TOWN[2105].z],
  [2237, TOWN[2103].x, TOWN[2103].z, TOWN[2106].x, TOWN[2106].z],
  [2245, TOWN[2110].x, TOWN[2110].z, TOWN[2110].x, TOWN[2101].z],
  [2226, TOWN[2123].x, TOWN[2101].z, TOWN[2123].x, TOWN[2114].z],
];
for (const [a, x0, z0, x1, z1] of lanes) grassLane(x0, z0, x1, z1, a);

const used = new Set();
const npcs = [];
function putNpc(cfg, modelo, x, z, a) {
  if (!cfg || used.has(cfg)) return;
  used.add(cfg);
  npcs.push({ cfg, modelo, face: 0, x: +x.toFixed(2), y: 0, z: +z.toFixed(2), a });
}

const BUILDING = /house|pokecen|shop|gym|lab|school|bicycl|pokecompany|guide_03|sm_c_yjs/i;
function buildingsOf(clip, cx, cz) {
  return clip.objs
    .filter(o => BUILDING.test(o.n) && !/fence|grass|flower|tree|lamp|sign|outer/i.test(o.n))
    .map(o => ({ n: o.n, x: cx + o.dx, z: cz + o.dz }))
    .sort((u, v) => u.x - v.x || u.z - v.z);
}

const byArea = new Map();
for (const [id, p] of Object.entries(doors)) {
  if (p.c !== 2000001) continue;
  if (!byArea.has(p.a)) byArea.set(p.a, []);
  byArea.get(p.a).push({ cfg: +id, t: p.t, n: p.n });
}

for (const [id, clip] of Object.entries(clips)) {
  const T = TOWN[+id];
  if (!T) continue;
  const list = (byArea.get(+id) || []).sort((u, v) => u.cfg - v.cfg);
  const doorIds = list.filter(p => p.t === 6);
  const arriveIds = list.filter(p => p.t === 7);
  const blds = buildingsOf(clip, T.x, T.z);
  const n = Math.min(blds.length, doorIds.length, arriveIds.length);
  for (let i = 0; i < n; i++) {
    const b = blds[i];
    putNpc(doorIds[i].cfg, 162, b.x, b.z + 5.2, +id);
    putNpc(arriveIds[i].cfg, 171, b.x, b.z + 6.5, +id);
  }
  const extraA = arriveIds.find(p => !used.has(p.cfg) && String(p.cfg).endsWith('99'));
  if (extraA) putNpc(extraA.cfg, 171, T.x, T.z + T.sz / 2 - 4, +id);
}

/* Connection Center landings on Route 26 (south) and Route 28 (west). */
putNpc(6222603, 162, TOWN[2123].x, TOWN[2101].z - 8, 2226);
putNpc(7222699, 171, TOWN[2123].x, TOWN[2101].z - 10, 2226);
putNpc(6222801, 162, TOWN[2114].x + 8, TOWN[2114].z, 2228);
putNpc(7222801, 171, TOWN[2114].x + 10, TOWN[2114].z, 2228);
putNpc(7210199, 171, TOWN[2101].x, TOWN[2101].z + 8, 2101);

/* Leftover doors sit next to a building, never a town-wide grid. */
for (const box of caixas) {
  const leftover = (byArea.get(box.a) || []).filter(p => !used.has(p.cfg));
  leftover.forEach((pt, i) => {
    const ang = (i / Math.max(1, leftover.length)) * Math.PI * 2;
    putNpc(pt.cfg, pt.t === 6 ? 162 : 171,
      box.x + Math.cos(ang) * 6, box.z + Math.sin(ang) * 6, box.a);
  });
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
  grama,
  agua,
  portas: [],
  treinadores: [],
  historias: [],
  npcs,
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
console.log('Johto', out.objetos.length, 'pieces', out.npcs.length, 'points', 'prefabs', out.prefabs.length);
console.log('bbox', out.bbox);
for (const id of [2101, 2102, 2103, 2104, 2105, 2106, 2107, 2108, 2109, 2110, 2114]) {
  const t = TOWN[id];
  const c = clips[id];
  console.log(id, nomes[id], 'x', t.x.toFixed(0), 'z', t.z.toFixed(0),
    (c?.objs.length || 0) + ' clip');
}
