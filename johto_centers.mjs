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
