import * as Relogio from './clock.mjs';
let D = null,
  X = null;
export async function carregar(a = null) {
  if (!D) {
    const b =
      a ||
      ((a, b) =>
        fetch(a)
          .then((r) => r.json())
          .catch(() => b));
    [D, X] = await Promise.all([
      b('./data/evolucoes.json', { por: {}, itens: {} }),
      b('./data/exp.json', { curvas: {}, especies: {} }),
    ]);
  }
  return D;
}
export const pronto = () => !!D;
export const regras = (a) => D?.por?.[a] || [];
export const itens = () => D?.itens || {};
export const ehItemDeEvolucao = (a) => !!D?.itens?.[a];
export const nomeItem = (a) => D?.itens?.[a]?.n || 'item ' + a;
let PRE = null;
export function familiaAbaixo(a) {
  if (!PRE && D) {
    PRE = {};
    for (const [b, c] of Object.entries(D.por || {}))
      for (const r of c || []) if (+r?.para && !PRE[r.para]) PRE[r.para] = +b;
  }
  const f = [+a];
  let d = +a,
    g = 0;
  while (PRE && Object.hasOwn(PRE, d) && g++ < 4) {
    d = PRE[d];
    f.push(d);
  }
  return f;
}
export const horario = () => Relogio.diaOuNoite();
const TIPOS_PT = {
  Normal: 'Normal',
  Fighting: 'Fighting',
  Flying: 'Flying',
  Poison: 'Poison',
  Ground: 'Terra',
  Rock: 'Pedra',
  Bug: 'Bug',
  Ghost: 'Ghost',
  Steel: 'Steel',
  Fire: 'Fogo',
  Water: 'Água',
  Grass: 'Planta',
  Electric: 'Elétrico',
  Psychic: 'Psíquico',
  Ice: 'Ice',
  Dragon: 'Dragon',
  Dark: 'Dark',
  Fairy: 'Fairy',
};
const curva = (a) => X?.curvas?.[X?.especies?.[a]?.c || 'medium'] || [];
export function expPara(a, b) {
  const c = curva(a);
  return c[Math.max(1, Math.min(100, b | 0))] || 0;
}
export function nivelPara(a, b) {
  const c = curva(a);
  let d = 1;
  while (d < 100 && (c[d + 1] ?? Infinity) <= b) d++;
  return d;
}
export function expGanha(a, c, d, { chefe: e = false } = {}) {
  const b = X?.especies?.[c]?.b || 60,
    L = Math.max(1, d | 0),
    f = Math.max(1, a | 0);
  const g = ((b * L) / 5) * Math.pow((2 * L + 10) / (L + f + 10), 2.5) + 1;
  return Math.max(1, Math.floor(g * (e ? 3 : 1)));
}
export const amizadeBase = (b) => X?.especies?.[b]?.a ?? 70;
export const AMIZADE_EVOLUI = 160;
export function avaliar(r, m, a = {}) {
  const b = m.lv || 1,
    c = m.amizade ?? amizadeBase(m.dex),
    d = (b) => (a.itens?.[b] || 0) > 0;
  if (r.gatilho === 'outro' || r.local || r.chuva || r.beleza)
    return { pode: false, falta: "can't happen here (" + r.texto + ')', consome: null };
  if (r.gatilho === 'item' || r.gatilho === 'troca') {
    if (!r.item) return { pode: false, falta: 'needs ' + r.itemNome + ' (not in the game yet)', consome: null };
    return d(r.item)
      ? { pode: true, falta: '', consome: r.item }
      : { pode: false, falta: 'falta ' + nomeItem(r.item) + ' in the bag (Poké Mart)', consome: null };
  }
  if (r.gatilho === 'muda')
    return { pode: false, falta: 'comes along with the other evolution', consome: null, muda: true };
  const e = [];
  let f = null;
  if (r.nivel && b < r.nivel) e.push(`Lv ${r.nivel} (it's in ${b})`);
  if (r.amizade && c < r.amizade) e.push(`amizade ${r.amizade} (currently ${c})`);
  if (r.horario && r.horario !== horario()) e.push(r.horario === 'dia' ? 'day only' : 'night only');
  if ('segurando' in r) {
    if (!r.segurando) e.push('needs ' + r.segurandoNome + ' (not in the game yet)');
    else if (!d(r.segurando)) e.push('falta ' + nomeItem(r.segurando) + ' in the bag');
    else f = r.segurando;
  }
  if (r.golpe && !a.conhece?.(m.dex, b)?.has(r.golpe)) e.push('must know ' + r.golpeNome);
  if (r.tipoGolpe && !a.tiposConhecidos?.(m.dex, b)?.has(r.tipoGolpe))
    e.push('needs to know a move of type ' + (TIPOS_PT[r.tipoGolpe] || r.tipoGolpe));
  if (r.noTime && !(a.time || []).some((t) => t.dex === r.noTime)) e.push('needs another specific Pokémon in the team');
  if (r.tipoNoTime && !(a.time || []).some((t) => t.dex !== m.dex && (a.tiposDe?.(t.dex) || []).includes(r.tipoNoTime)))
    e.push('needs a Pokémon of type ' + (TIPOS_PT[r.tipoNoTime] || r.tipoNoTime) + ' on the team');
  return { pode: !e.length, falta: e.join(' · '), consome: f };
}
export function opcoes(m, a = {}) {
  return regras(m.dex).map((r) => ({ regra: r, ...avaliar(r, m, a) }));
}
