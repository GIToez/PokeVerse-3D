/** Safari Zone visit, shared by the client and the server bag.
 *  Nov 5: the upcoming/ version's rules (public/data/safari.json) without its battles: a visit is a fee, 30 Safari Balls and
 *  20 minutes (it was 500 steps); your Pokémon stay in their Balls and you throw at wild Pokémon that are awake, the classic way.
 *  Bait and rocks are on, with that file's numbers: bait ×0.5 catch and ×⅓ flee, a rock ×2 catch and ×2.5 flee, and the flee
 *  chance grows with the species' Speed. In Kanto (area 1192) the wild Pokémon come from that file's four sub-areas. */

export const BOLA = 1005;
export const PRECO = 500;
export const BOLAS = 30;
export const PASSOS = 500;          // old step limit (kept so old saves still read)
export const DURACAO_MS = 20 * 60000;   // a visit lasts 20 minutes
export const FUGA_CALMA = 0.12;

/** Gate the player is sent back to. Coordinates are the map's stored x/z (the client flips x).
 *  Kanto's plaza is the high-z side of the north barrier. Johto's warden stands in area 2124,
 *  so the whole of area 2115 is the paid grass. */
export const PORTAO = {
  /* Kanto (Nov 5, the upcoming/ design, public/data/safari.json `entrada`): the Safari grass is not walkable from Fuchsia on this map,
     so the warden stands at the Safari door in Fuchsia City; paying takes you inside (`entrada`) and the visit ending brings you back
     out to the door (`saida`). These three are GAME coordinates (no flip). x/z stay the old gate for anything that still reads them. */
  1192: { x: 228.5, z: 199.5, lado: 'norte', linha: 196.5, cena: 1000001,
    atendente: { x: 170, z: 86.7 }, saida: { x: 170, z: 88.9 }, entrada: { x: -230, z: 185 } },   /* 6 m north of the gate house, in the open (190.7 hid you behind the roof) */
  2115: { x: 324.5, z: 100.5, lado: 'sempre', linha: 0, cena: 2000001 },
};

export const ATENDENTE = { 9001192: 1192, 9002115: 2115 };

export const MOD = {
  isca: { captura: 0.5, fuga: 0.3333 },   // multipliers (safari.json regras.captura / regras.fuga)
  pedra: { captura: 2, fuga: 2.5 },
};
/** Flee chance per bait / rock / ball (safari.json regras.fuga): min(15%, 3% + 0.09% × Speed) × the bait/rock multiplier, at most 50%. */
export function chanceFuga(vel, mod) {
  const base = Math.min(0.15, 0.03 + 0.0009 * Math.max(0, num(vel, 50)));
  return mod && Number.isFinite(+mod.fuga) ? Math.min(0.5, base * +mod.fuga) : base;
}

const num = (v, p = 0) => (Number.isFinite(+v) ? +v : p);

export function ehZona(area) {
  return Object.prototype.hasOwnProperty.call(PORTAO, String(+area));
}

export function zonaDoAtendente(cfg) {
  const z = ATENDENTE[+cfg];
  return z || null;
}

/** Paid grass. The Kanto plaza north of the barrier is still area 1192, and it is free to stand on. */
export function naZonaPaga(area, z) {
  const p = PORTAO[+area];
  if (!p || !Number.isFinite(+z)) return false;
  if (p.lado === 'norte') return +z < p.linha;
  if (p.lado === 'sul') return +z > p.linha;
  return true;
}

/** World position of the gate. `mundoX` picks the map flip (the exporter mirrors x). */
export function pouso(zona, mundoX) {
  const p = PORTAO[+zona];
  if (!p) return null;
  if (p.saida) return { x: p.saida.x, z: p.saida.z };
  const x = +mundoX;
  const flip = Number.isFinite(x) && Math.abs(x - p.x) < Math.abs(x - (-p.x)) ? 1 : -1;
  return { x: +(flip * p.x).toFixed(2), z: +p.z.toFixed(2) };
}

/** Within talking range of that zone's warden, in world coordinates. */
/** Where paying puts you (inside the grass), or null when you just walk in. */
export function entrada(zona) {
  const e = PORTAO[+zona]?.entrada;
  return e ? { x: e.x, z: e.z } : null;
}
export const temSaida = zona => !!PORTAO[+zona]?.saida;

export function perto(zona, x, z) {
  const p = PORTAO[+zona];
  if (!p || !Number.isFinite(+x) || !Number.isFinite(+z)) return false;
  if (p.atendente) return Math.hypot(+x - p.atendente.x, +z - p.atendente.z) <= 8;
  const d = Math.min(Math.hypot(+x - p.x, +z - p.z), Math.hypot(+x + p.x, +z - p.z));
  return d <= 8;
}

/** A live visit ({ zona, fim, restantes }), or null. `agora` lets the server and tests pass their clock. A visit from before the
 *  timer (it only had `passos`) gets 20 minutes from now the first time it is read. */
export function normalizar(s, agora = Date.now()) {
  if (!s || typeof s !== 'object') return null;
  const zona = +s.zona;
  const restantes = Math.floor(+s.restantes);
  const fim = Number.isFinite(+s.fim) && +s.fim > 0 ? +s.fim : (Math.floor(+s.passos) > 0 ? agora + DURACAO_MS : 0);
  if (!ehZona(zona) || !(restantes > 0) || !(fim > agora)) return null;
  return { zona, fim, restantes: Math.min(BOLAS, restantes) };
}
/** The visit ran out of time (it was live, now it is not, and it still had balls). */
export const acabouOTempo = (s, agora = Date.now()) => !!s && typeof s === 'object' && +s.restantes > 0 && Number.isFinite(+s.fim) && +s.fim > 0 && agora >= +s.fim;

export function vivo(s, agora = Date.now()) {
  return !!normalizar(s, agora);
}

/** Start a visit. Does not mutate the caller's money or balls. Not enough Coins leaves both alone. */
export function entrar({ dinheiro, bolas, sessao, zona, agora = Date.now() }) {
  if (vivo(sessao)) return { ok: false, erro: 'You already have a Safari visit going.' };
  const d = Math.floor(num(dinheiro, 0));
  if (!ehZona(zona)) return { ok: false, erro: 'There is no Safari Zone here.' };
  if (d < PRECO) return { ok: false, erro: 'not enough Coins' };
  const b = { ...(bolas && typeof bolas === 'object' ? bolas : {}) };
  const k = String(BOLA);
  b[k] = Math.max(0, Math.floor(+b[k] || 0)) + BOLAS;
  return {
    ok: true,
    dinheiro: d - PRECO,
    bolas: b,
    sessao: { zona: +zona, fim: agora + DURACAO_MS, restantes: BOLAS },
  };
}

/** The clock check (it was the step counter): a visit past its 20 minutes ends with 'tempo'. */
export function passo(sessao, n = 1, agora = Date.now()) {
  if (acabouOTempo(sessao, agora)) return { sessao: { ...sessao }, fim: 'tempo' };
  const s0 = normalizar(sessao, agora);
  if (!s0) return { sessao: null, fim: 'acabou' };
  return { sessao: s0, fim: null };
}

/** One Safari Ball left the bag. The last ball ends the visit. */
export function jogou(sessao, agora = Date.now()) {
  const s0 = normalizar(sessao, agora);
  if (!s0) return { sessao: null, fim: 'acabou' };
  const restantes = s0.restantes - 1;
  const s = { ...s0, restantes };
  if (restantes <= 0) return { sessao: s, fim: 'bolas' };
  return { sessao: s, fim: null };
}

/** Take back the balls this visit still had. Balls the player already owned stay. */
export function encerrar(bolas, sessao) {
  const b = { ...(bolas && typeof bolas === 'object' ? bolas : {}) };
  const k = String(BOLA);
  const tem = Math.max(0, Math.floor(+b[k] || 0));
  const quer = Math.max(0, Math.floor(+sessao?.restantes || 0));
  const tira = Math.min(tem, quer);
  const fica = tem - tira;
  if (fica > 0) b[k] = fica;
  else delete b[k];
  return { bolas: b, tirou: tira, sessao: null };
}

export const AVISO_BOLA = 'Your Pokémon stay in their Balls in the Safari Zone.';

/** The paid grass is catch-only. A party Pokémon, a mount, and a summoned boss stay out. */
export function podeSoltar({ naZona } = {}) {
  if (naZona) return { ok: false, erro: AVISO_BOLA };
  return { ok: true };
}

export function podeJogar({ sessao, naZona, bola, estado }) {
  const safari = +bola === BOLA;
  const visita = vivo(sessao);
  if (naZona) {
    if (!visita) return { ok: false, erro: 'Talk to the warden and pay before you catch anything here.' };
    if (!safari) return { ok: false, erro: 'Only a Safari Ball works in here.' };
    if (estado === 'morto' || estado === 'capturando' || estado === 'guardado') return { ok: false, erro: 'pick a target (Tab or click)' };
    return { ok: true, safari: true };
  }
  if (safari) return { ok: false, erro: 'A Safari Ball only works inside the Safari Zone.' };
  if (estado !== 'desmaiado') return { ok: false, erro: 'knock it out first: you only catch fainted Pokémon' };
  return { ok: true, safari: false };
}

export function aplicar(tipo) {
  const m = MOD[tipo];
  if (!m) return null;
  return { tipo, captura: m.captura, fuga: m.fuga };
}

/** `rng` returns a number in [0, 1). `vel` = the species' base Speed (faster ones flee more). */
export function foge(mod, rng, vel = 50) {
  return rng() < chanceFuga(vel, mod);
}

/* ── Kanto's Safari spawns (public/data/safari.json, the upcoming/ data): the zone polygon, its four sub-areas (east / north /
   west cut lines, the rest is the centre) and each one's land and water tables with weights and levels. World coordinates. ── */
export function dentroDe(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [b, d] = poly[i], [e, f] = poly[j];
    if (d > z !== f > z && x < ((e - b) * (z - d)) / (f - d) + b) c = !c;
  }
  return c;
}
export function subAreaSafari(D, x, z) {
  const P = D?.zona?.poligono, k = D?.cortes;
  if (!P || !k || !Number.isFinite(+x) || !Number.isFinite(+z) || !dentroDe(P, +x, +z)) return null;
  return +x >= k.lesteX ? 'leste' : +z < k.norteZ ? 'norte' : +x < k.oesteX ? 'oeste' : 'centro';
}
/** { dex, nome, glb, lv, agua, subArea } for a spawn at x,z, or null outside the zone. */
export function sortearSafari(D, x, z, agua = false, rng = Math.random) {
  const id = subAreaSafari(D, x, z); if (!id) return null;
  const sub = (D.subAreas || []).find(s => s.id === id); if (!sub) return null;
  const L = (agua ? sub.agua : sub.terra) || [];
  let tot = 0; for (const e of L) tot += Math.max(0, +e.peso || 0);
  if (!(tot > 0)) return null;
  let r = rng() * tot, g = L[L.length - 1];
  for (const e of L) { r -= Math.max(0, +e.peso || 0); if (r < 0) { g = e; break; } }
  const lv = g.lv[0] + Math.floor(rng() * (g.lv[1] - g.lv[0] + 1));
  return { dex: g.dex, nome: g.nome, glb: g.glb, lv: Math.min(g.lv[1], lv), agua: !!agua, subArea: id };
}

export function multCaptura(mod) {
  return mod && Number.isFinite(+mod.captura) ? +mod.captura : 1;
}
