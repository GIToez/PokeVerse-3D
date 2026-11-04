const num = (v, p = 0) => (Number.isFinite(+v) ? +v : p);
export const SAIDAS = ['doar', 'soltar', 'troca', 'mercado', 'creche'];
export const LIVRES = [
  'evoluir',
  'golpes',
  'doce',
  'time',
  'apelido',
  'curar',
  'segurar',
  'ev',
  'transformar',
  'lutar',
  'montar',
];
export const LIMITE = { lista: 100 };
export const MOTIVOS = {
  pedidoInvalido: 'Invalid request.',
  naoEhSeu: "That Pokémon isn't yours.",
  travado: 'This Pokémon is locked: unlock it before giving it away.',
  shiny: "Shiny Pokémon can't be handed in for missions.",
  lendario: "Legendary Pokémon can't be delivered for missions.",
  ultimo: 'You need to keep at least one Pokémon.',
  especie: "That's not the Pokémon they asked for.",
  passo: "This mission isn't asking for a Pokémon right now.",
  demais: "That's more than they asked for.",
  repetido: 'The same Pokémon was sent twice.',
  longe: 'Get closer to whoever asked.',
  elite: "Can't hand in Pokémon in the middle of an Elite Four run.",
  luta: 'Finish the battle first.',
  ocupado: 'This Pokémon is in a trade.',
  semDados: 'Delivery is unavailable right now. Try again later.',
  motivo: "That exit doesn't exist.",
};
export const TEXTO_TRAVADO = {
  doar: 'This Pokémon is locked: unlock it before delivering.',
  soltar: 'This Pokémon is locked: unlock it before releasing.',
  troca: 'This Pokémon is locked: unlock it before trading.',
  mercado: 'This Pokémon is locked: unlock it before listing.',
  creche: 'This Pokémon is locked: unlock it before taking it to the Daycare.',
};
const recusa = (a, b = {}) => ({ ok: false, erro: a, motivo: MOTIVOS[a] || a, ...b });
let LENDARIOS = null;
export function usarDados(d) {
  const l = Array.isArray(d?.lendarios) ? d.lendarios : null;
  if (!l || !l.length || !l.every((x) => Number.isInteger(x) && x > 0)) {
    LENDARIOS = null;
    return 0;
  }
  LENDARIOS = new Set(l);
  return LENDARIOS.size;
}
export const lendario = (a) => (LENDARIOS ? LENDARIOS.has(num(a)) : null);
export const uidOk = (u) => (typeof u === 'string' || typeof u === 'number') && /^\d{1,12}$/.test(String(u));
function registro(c, a, b) {
  if (!c || typeof c !== 'object' || !uidOk(a)) return null;
  const u = String(a);
  if (typeof b?.mon === 'function') {
    const r = b.mon(c, u);
    return r && typeof r === 'object' && r !== Object.prototype ? r : null;
  }
  const d = c.posse?.mons;
  if (!d || typeof d !== 'object' || !Object.prototype.hasOwnProperty.call(d, u)) return null;
  const r = d[u];
  return r && typeof r === 'object' ? r : null;
}
const contar = (c, a) =>
  typeof a?.contar === 'function' ? num(a.contar(c)) : Object.keys(c?.posse?.mons || {}).length;
export const travado = (a) => !!(a && typeof a === 'object' && a.travado);
export const shiny = (a) =>
  !!(a && typeof a === 'object' && (a.shiny || (a.ficha && typeof a.ficha === 'object' && a.ficha.shiny)));
export const bloqueia = (a) => (SAIDAS.includes(a) ? true : LIVRES.includes(a) ? false : null);
export function travar(c, a, b, d = {}) {
  if (!c || typeof c !== 'object' || !uidOk(a) || typeof b !== 'boolean') return recusa('pedidoInvalido');
  const e = registro(c, a, d);
  if (!e) return recusa('naoEhSeu');
  const f = travado(e);
  if (b) e.travado = true;
  else delete e.travado;
  return { ok: true, uid: String(a), travado: b, mudou: f !== b };
}
export function podeSair(a, b) {
  if (!SAIDAS.includes(b)) return recusa('motivo');
  if (!a || typeof a !== 'object' || a === Object.prototype) return recusa('naoEhSeu');
  if (b === 'doar') {
    if (!LENDARIOS) return recusa('semDados');
    if (LENDARIOS.has(num(a.dex))) return recusa('lendario');
    if (shiny(a)) return recusa('shiny');
  }
  if (travado(a)) return recusa('travado', { motivo: TEXTO_TRAVADO[b] });
  return { ok: true };
}
export function conferirDoacao(c, a, b, d = {}) {
  if (!c || typeof c !== 'object') return recusa('pedidoInvalido');
  const e = a?.passo;
  if (!e || typeof e !== 'object' || e.tipo !== 'doar' || !Array.isArray(e.dex) || !e.dex.length)
    return recusa('passo');
  const n = Math.max(1, Math.floor(num(e.n, 1))),
    f = Math.max(0, Math.floor(num(a.feitos, 0)));
  if (f >= n) return recusa('passo');
  if (!LENDARIOS) return recusa('semDados');
  const g = Array.isArray(b) ? b : [b];
  if (!g.length || g.length > LIMITE.lista || !g.every(uidOk)) return recusa('pedidoInvalido');
  const h = [];
  for (const u of g) {
    const s = String(u);
    if (h.includes(s)) return recusa('repetido', { uid: s });
    h.push(s);
  }
  if (h.length > n - f) return recusa('demais', { falta: n - f });
  const i = typeof d.perto === 'function' ? d.perto(e.cfg) : false;
  if (i !== true) return recusa('longe');
  if (typeof d.timeTravado === 'function' && d.timeTravado(c)) return recusa('elite');
  if (typeof d.lutaAberta === 'function' && d.lutaAberta(c)) return recusa('luta');
  const j = new Set(e.dex.map((x) => num(x)));
  for (const u of h) {
    const k = registro(c, u, d);
    if (!k) return recusa('naoEhSeu', { uid: u });
    if (!j.has(num(k.dex))) return recusa('especie', { uid: u });
    const s = podeSair(k, 'doar');
    if (!s.ok) return { ...s, uid: u };
    if (typeof d.naTroca === 'function' && d.naTroca(c, u)) return recusa('ocupado', { uid: u });
  }
  if (contar(c, d) - h.length < 1) return recusa('ultimo');
  return { ok: true, uids: h, falta: n - f - h.length };
}
export function candidatosDoar(a, b) {
  const c = new Set((Array.isArray(b?.dex) ? b.dex : []).map((x) => num(x)));
  return (Array.isArray(a) ? a : [])
    .filter((e) => e && uidOk(e.uid) && c.has(num(e.dex)))
    .map((e) => {
      const r = podeSair(e, 'doar');
      return r.ok
        ? { uid: String(e.uid), ok: true }
        : { uid: String(e.uid), ok: false, erro: r.erro, motivo: r.motivo };
    });
}
