/** Safari Zone visit, shared by the client and the server bag.
 *  The grass tables stay as they are: Kanto area 1192 keeps its evolved habitat.
 *  A visit is a fee, a stack of Safari Balls, and a step limit. Bait and rocks
 *  change the catch and the flee roll for the wild in front of you. */

export const BOLA = 1005;
export const PRECO = 500;
export const BOLAS = 30;
export const PASSOS = 500;
export const FUGA_CALMA = 0.12;

/** Gate the player is sent back to. Coordinates are the map's stored x/z (the client flips x).
 *  Kanto's plaza is the high-z side of the north barrier. Johto's warden stands in area 2124,
 *  so the whole of area 2115 is the paid grass. */
export const PORTAO = {
  1192: { x: 228.5, z: 199.5, lado: 'norte', linha: 196.5, cena: 1000001 },
  2115: { x: 324.5, z: 100.5, lado: 'sempre', linha: 0, cena: 2000001 },
};

export const ATENDENTE = { 9001192: 1192, 9002115: 2115 };

export const MOD = {
  isca: { captura: 0.5, fuga: 0.05 },
  pedra: { captura: 2, fuga: 0.3 },
};

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
  const x = +mundoX;
  const flip = Number.isFinite(x) && Math.abs(x - p.x) < Math.abs(x - (-p.x)) ? 1 : -1;
  return { x: +(flip * p.x).toFixed(2), z: +p.z.toFixed(2) };
}

/** Within talking range of that zone's warden, in world coordinates. */
export function perto(zona, x, z) {
  const p = PORTAO[+zona];
  if (!p || !Number.isFinite(+x) || !Number.isFinite(+z)) return false;
  const d = Math.min(Math.hypot(+x - p.x, +z - p.z), Math.hypot(+x + p.x, +z - p.z));
  return d <= 8;
}

export function normalizar(s) {
  if (!s || typeof s !== 'object') return null;
  const zona = +s.zona;
  const passos = Math.floor(+s.passos);
  const restantes = Math.floor(+s.restantes);
  if (!ehZona(zona) || !(passos > 0) || !(restantes > 0)) return null;
  return { zona, passos: Math.min(PASSOS, passos), restantes: Math.min(BOLAS, restantes) };
}

export function vivo(s) {
  return !!normalizar(s);
}

/** Start a visit. Does not mutate the caller's money or balls. Not enough Coins leaves both alone. */
export function entrar({ dinheiro, bolas, sessao, zona }) {
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
    sessao: { zona: +zona, passos: PASSOS, restantes: BOLAS },
  };
}

/** Steps walked inside the paid grass. `n` is capped so one message cannot end the visit. */
export function passo(sessao, n = 1) {
  const s0 = normalizar(sessao);
  if (!s0) return { sessao: null, fim: 'acabou' };
  const k = Math.max(1, Math.min(8, Math.floor(+n || 1)));
  const passos = s0.passos - k;
  if (passos <= 0) return { sessao: { ...s0, passos: 0 }, fim: 'passos' };
  return { sessao: { ...s0, passos }, fim: null };
}

/** One Safari Ball left the bag. The last ball ends the visit. */
export function jogou(sessao) {
  const s0 = normalizar(sessao);
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

/** `rng` returns a number in [0, 1). */
export function foge(mod, rng) {
  const p = mod && Number.isFinite(+mod.fuga) ? +mod.fuga : FUGA_CALMA;
  return rng() < p;
}

export function multCaptura(mod) {
  return mod && Number.isFinite(+mod.captura) ? +mod.captura : 1;
}
