/* English display names for map files and dump prefab nodes.
 * File IDs stay as-is: interiors are original scene numbers (4110001.json / .glb),
 * and doors / the game load those IDs. This module only labels them in the admin UI. */

const FIXOS = {
  kanto: 'Kanto',
  pallet_route1: 'Pallet Town & Route 1',
  pallet_rota1: 'Pallet Town & Route 1',
  2000001: 'Johto',
  johto: 'Johto',
};

const TOKENS = {
  comgrass: 'common grass',
  gimegrass: 'gimmick grass',
  gimigrass: 'gimmick grass',
  comfloor: 'common floor',
  shufloor: 'wood floor',
  sinkfloor: 'sunken floor',
  sinkgrass: 'sunken grass',
  ground: 'ground',
  plane: 'plane',
  rock: 'rock',
  face: 'face',
  fence: 'fence',
  grass: 'grass',
  floor: 'floor',
  sink: 'sink',
  tree: 'tree',
  house: 'house',
  roof: 'roof',
  wall: 'wall',
  door: 'door',
  window: 'window',
  water: 'water',
  path: 'path',
  road: 'road',
  flower: 'flower',
  bush: 'bush',
  sign: 'sign',
  box: 'box',
  crate: 'crate',
  pot: 'pot',
  chair: 'chair',
  table: 'table',
  bed: 'bed',
  lamp: 'lamp',
  lamppost: 'lamppost',
  streetlight: 'streetlight',
  stair: 'stair',
  stairs: 'stairs',
  step: 'step',
  building: 'building',
  bridge: 'bridge',
  cliff: 'cliff',
  hill: 'hill',
  mountain: 'mountain',
  cave: 'cave',
  pond: 'pond',
  river: 'river',
  sand: 'sand',
  dirt: 'dirt',
  stone: 'stone',
  brick: 'brick',
  wood: 'wood',
  metal: 'metal',
};

let pronto = false;
let exatas = new Map();
let padroes = [];
const cenasPorId = Object.create(null);
const apelidosPorId = Object.create(null);

function nomesUnicos(lista) {
  const visto = new Set();
  const out = [];
  for (const raw of lista) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const n = traduzNome(raw.trim());
    const k = n.toLowerCase();
    if (visto.has(k)) continue;
    visto.add(k);
    out.push(n);
  }
  return out;
}

function compilar(chave, valor) {
  const partes = chave.split(/(\{\w+\})/);
  let re = '^';
  const vars = [];
  for (const p of partes) {
    const m = /^\{(\w+)\}$/.exec(p);
    if (m) { vars.push(m[1]); re += '([\\s\\S]+?)'; }
    else re += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return { re: new RegExp(re + '$'), saida: valor, vars, tam: chave.length };
}

function montar(dic) {
  const ex = new Map(), pa = [];
  for (const [k, v] of Object.entries(dic || {})) {
    if (typeof v !== 'string' || !k) continue;
    if (/\{\w+\}/.test(k) && !/^\{\w+\}$/.test(k.trim())) pa.push(compilar(k, v));
    else ex.set(k, v);
  }
  pa.sort((a, b) => b.tam - a.tam);
  exatas = ex;
  padroes = pa;
}

/** Admin labels for every area in scenes.json: { id → name }. Areas that share a name inside one scene
    (Trial Path ×18, the Elite Four rooms ×2…) get "#2", "#3" in id order so the GM can tell them apart;
    the game keeps showing the plain name. */
export function rotulosAreas(ce) {
  const out = {};
  for (const c of ce?.cenas || []) {
    const conta = {}, vistos = {};
    for (const a of c.areas || []) conta[a.nome] = (conta[a.nome] || 0) + 1;
    for (const a of [...(c.areas || [])].sort((x, y) => x.id - y.id)) {
      if (a.id in out) continue;
      const nome = traduzNome(a.nome);
      vistos[a.nome] = (vistos[a.nome] || 0) + 1;
      out[a.id] = conta[a.nome] > 1 && vistos[a.nome] > 1 ? nome + ' #' + vistos[a.nome] : nome;
    }
  }
  return out;
}

/** Translate a Portuguese (or already-English) place name from scenes.json. */
export function traduzNome(s) {
  if (typeof s !== 'string' || !s) return s;
  const k = s.trim();
  const e = exatas.get(k);
  if (e != null) return k === s ? e : s.replace(k, e);
  for (const p of padroes) {
    const m = p.re.exec(s);
    if (m) {
      return p.saida.replace(/\{(\w+)\}/g, (tudo, nome) => {
        const i = p.vars.indexOf(nome);
        return i >= 0 ? traduzNome(m[i + 1]) : tudo;
      });
    }
  }
  return s;
}

/** English label for a map file id (`kanto`, `pallet_route1`, `4110001`). */
export function nomeMapa(id) {
  const k = String(id ?? '');
  if (FIXOS[k]) return FIXOS[k];
  const pt = cenasPorId[k];
  if (pt) return traduzNome(pt);
  if (/^\d+$/.test(k)) return 'Scene ' + k;
  return k.replace(/_/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase());
}

/** Label plus the original file id so numbered interiors stay findable. */
export function nomeMapaComId(id) {
  const k = String(id ?? '');
  const n = nomeMapa(k);
  if (!k || n === k || FIXOS[k]) return n;
  return n + ' (' + k + ')';
}

/** Every English place name that uses this map file (shared interiors list each city). */
export function apelidosMapa(id) {
  const k = String(id ?? '');
  return apelidosPorId[k] ? apelidosPorId[k].slice() : [];
}

/** Dropdown rows for one GLB: one option per city/area that shares the room. */
export function opcoesMapa(id) {
  const k = String(id ?? '');
  const nomes = apelidosMapa(k);
  if (nomes.length) return nomes.map(n => ({ value: k, label: n + ' (' + k + ')' }));
  return [{ value: k, label: nomeMapaComId(k) }];
}

/** Human English for dump node names like `sm_c_001_comgrass_01_1`. */
export function rotuloPrefab(raw) {
  let s = String(raw || '').replace(/^lib:?/i, '').trim();
  if (!s) return '(unnamed)';
  s = s.replace(/[\[\]\.:\/]/g, '_');
  const parts = s.split(/_+/).filter(Boolean);
  while (parts.length && /^(sm|lib|obj|mesh|n|mdl)$/i.test(parts[0])) parts.shift();
  while (parts.length > 1 && /^(c|s|g|n|l|r)$/i.test(parts[0])) parts.shift();
  while (parts.length > 1 && /^\d+$/.test(parts[0])) parts.shift();
  while (parts.length > 1 && /^[sglrn]$/i.test(parts[parts.length - 1])) parts.pop();
  const cleaned = parts.filter(p => p.length > 1 || /^\d+$/.test(p));
  const use = cleaned.length ? cleaned : parts;
  const words = use.map(p => TOKENS[p.toLowerCase()] || p.toLowerCase()).join(' ').replace(/\s+/g, ' ').trim();
  const out = words || s.replace(/_/g, ' ');
  return out.replace(/\b[a-z]/g, c => c.toUpperCase());
}

export async function carregar() {
  if (pronto) return;
  const [ce, nomes] = await Promise.all([
    fetch('/data/scenes.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/data/locale/names_en.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ]);
  montar(nomes);
  for (const c of ce?.cenas || []) {
    const id = String(c.id);
    cenasPorId[id] = c.nome;
    apelidosPorId[id] = nomesUnicos([c.nome, ...(c.areas || []).map(a => a?.nome)]);
  }
  pronto = true;
}
