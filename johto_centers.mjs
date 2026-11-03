/**
 * Johto Pokémon Centers and Poké Marts use the shared Kanto rooms
 * (Center 4110001, Mart 4110007). City digits 21–30 keep them off Kanto's 01–12.
 * A Center arrival is 714CC01, its exit is that id minus 1000000, and the
 * street landing is the door id plus 1000000.
 */
export const CENTROS_JOHTO = [
  { porta: 6210204, chegada: 7142101, a: 1421, cidade: '21', rua: 2102, nome: 'Cherrygrove Pokémon Center' },
  { porta: 6210303, chegada: 7142201, a: 1422, cidade: '22', rua: 2103, nome: 'Violet Pokémon Center' },
  { porta: 6210403, chegada: 7142301, a: 1423, cidade: '23', rua: 2104, nome: 'Azalea Pokémon Center' },
  { porta: 6210502, chegada: 7142401, a: 1424, cidade: '24', rua: 2105, nome: 'Goldenrod Pokémon Center' },
  { porta: 6210604, chegada: 7142501, a: 1425, cidade: '25', rua: 2106, nome: 'Ecruteak Pokémon Center' },
  { porta: 6210702, chegada: 7142601, a: 1426, cidade: '26', rua: 2107, nome: 'Olivine Pokémon Center' },
  { porta: 6210802, chegada: 7142701, a: 1427, cidade: '27', rua: 2108, nome: 'Cianwood Pokémon Center' },
  { porta: 6210903, chegada: 7142801, a: 1428, cidade: '28', rua: 2109, nome: 'Mahogany Pokémon Center' },
  { porta: 6211002, chegada: 7142901, a: 1429, cidade: '29', rua: 2110, nome: 'Blackthorn Pokémon Center' },
  { porta: 6211402, chegada: 7143001, a: 1430, cidade: '30', rua: 2114, nome: 'Mt. Silver Pokémon Center' },
];

export const LOJAS_JOHTO = [
  { porta: 6210205, chegada: 7152101, a: 1521, cidade: '21', rua: 2102, nome: 'Cherrygrove Mart' },
  { porta: 6210304, chegada: 7152201, a: 1522, cidade: '22', rua: 2103, nome: 'Violet Mart' },
  { porta: 6210404, chegada: 7152301, a: 1523, cidade: '23', rua: 2104, nome: 'Azalea Mart' },
  { porta: 6210605, chegada: 7152501, a: 1525, cidade: '25', rua: 2106, nome: 'Ecruteak Mart' },
  { porta: 6210703, chegada: 7152601, a: 1526, cidade: '26', rua: 2107, nome: 'Olivine Mart' },
  { porta: 6211003, chegada: 7152901, a: 1529, cidade: '29', rua: 2110, nome: 'Blackthorn Mart' },
];

/** The Viridian Pokémart row. A Johto clerk id is not its own stock list; the shop window asks for this one. */
export const LOJA_PADRAO = '2150101';

const CIDADE_JOHTO = '(2[1-9]|30)';

export function ehChegadaCentroJohto(chegada){
  return new RegExp('^714' + CIDADE_JOHTO + '01$').test(String(chegada || ''));
}

/** Nearest Johto Center door. `x`/`z` are world coordinates (json x is mirrored). */
export function centroJohtoMaisPerto(x, z, npcs, flip = -1){
  if (!Number.isFinite(+x) || !Number.isFinite(+z)) return null;
  let melhor = null, md = Infinity;
  for (const c of CENTROS_JOHTO){
    const n = (npcs || []).find(q => q.cfg === c.porta);
    if (!n) continue;
    const d = Math.hypot(+x - flip * n.x, +z - n.z);
    if (d < md){ md = d; melhor = { mapa: '4110001', chegada: c.chegada, a: c.a, nome: c.nome }; }
  }
  return melhor;
}

/** Johto Mart arrival 715CC01. Goldenrod, Cianwood, and Mahogany have no Mart. */
export function ehChegadaLojaJohto(chegada){
  return new RegExp('^715' + CIDADE_JOHTO + '01$').test(String(chegada || ''));
}

/** Shared room for a Center or Mart area. scenes.json is optional and easy to
 *  cache; without this, a Johto arrival (area 1421) is treated as a scene id
 *  and the door never opens. */
const AREAS_CENTRO = new Set([
  1401, 1402, 1403, 1404, 1405, 1406, 1407, 1408, 1409, 1410, 1411,
  1421, 1422, 1423, 1424, 1425, 1426, 1427, 1428, 1429, 1430,
  2290, 2291, 2292, 2293, 2294, 2295,
]);
const AREAS_LOJA = new Set([
  1501, 1502, 1503, 1504, 1505, 1507, 1508, 1509,
  1521, 1522, 1523, 1525, 1526, 1529,
  2296, 2297, 2298, 2299,
]);
export function cenaSalaCompartilhada(area){
  const a = +area || 0;
  if (AREAS_CENTRO.has(a)) return 4110001;
  if (AREAS_LOJA.has(a)) return 4110007;
  return 0;
}

/** Lavender Name Rater's House. Kanto already reuses it for several houses.
 *  A Johto building whose own room was never exported uses it the same way. */
export const CASA_JOHTO = 4110010;

/** Street door → arrival → exit → the step outside, all in doors.json, but no
 *  exported room. Returns 4110010 so the door still opens. A Center, a Mart,
 *  a scene that already has a GLB, or a door with no way back to Johto stays
 *  out of this house. */
export function cenaCasaJohto(chegada, portas, exportadas){
  const id = +chegada || 0;
  const ch = portas?.[id];
  if (!ch || ch.t !== 7) return 0;
  if (AREAS_CENTRO.has(ch.a) || AREAS_LOJA.has(ch.a)) return 0;
  if (ch.c === 1000001 || ch.c === 2000001 || ch.c === 2500001) return 0;
  if (exportadas && (exportadas.has(ch.c) || exportadas.has(+ch.c) || exportadas.has(String(ch.c)))) return 0;
  const saida = portas[id - 1000000];
  const pouso = saida?.t === 6 ? portas[saida.n] : null;
  if (!pouso || pouso.t !== 7 || pouso.c !== 2000001) return 0;
  const entrada = portas[saida.n - 1000000];
  if (!entrada || entrada.t !== 6 || entrada.c !== 2000001 || entrada.n !== id) return 0;
  return CASA_JOHTO;
}

/** Standing in a shared Johto Center or Mart: that city's Center. */
export function centroPelaChegadaJohto(chegada){
  const ch = String(chegada || '');
  let m = ch.match(new RegExp('^714' + CIDADE_JOHTO + '01$'));
  if (m){
    const c = CENTROS_JOHTO.find(x => x.cidade === m[1]);
    return c ? { mapa: '4110001', chegada: c.chegada, a: c.a, nome: c.nome } : null;
  }
  m = ch.match(new RegExp('^715' + CIDADE_JOHTO + '01$'));
  if (!m) return null;
  const c = CENTROS_JOHTO.find(x => x.cidade === m[1]);
  return c ? { mapa: '4110001', chegada: c.chegada, a: c.a, nome: c.nome } : null;
}
