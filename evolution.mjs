/* Evolução e XP como nos JOGOS ORIGINAIS (index.html + menus.mjs).
 *
 * Regras: data/evolutions.json (tools/evolucoes.mjs ← PokéAPI): por espécie, uma lista de { para, nome, gatilho, texto, … }
 *   gatilho 'nivel' — Lv mínimo e/ou amizade alta (≥ 160), horário (dia/noite), item segurado, golpe conhecido / golpe de
 *                     um tipo, companheiro (ou tipo) no time, Atk×Def (Tyrogue); 'muda' = Shedinja (junto do Ninjask);
 *           'item'  — usar uma pedra (consome); 'troca' — troca, que aqui vira usar o Cabo de Ligação (ou o item segurado
 *                     direto, como em Legends: Arceus); 'outro' — regras que não dá pra cumprir por aqui (torres, giros…).
 * XP: data/exp.json — as 6 curvas oficiais, base exp e amizade base por espécie; ganho pela fórmula da Gen 5+.
 * Amizade: começa na base da espécie (70), +1 por minuto seguindo, +2 por nível, −1 ao desmaiar; evolui com 160.
 *
 *   await Evolucao.carregar();
 *   Evolucao.opcoes({ dex, lv, amizade }, ctx) → [{ regra, pode, falta, consome }]   ctx = { itens, time, tiposDe, conhece, tiposConhecidos }
 *   Evolucao.expPara(dex, lv) · nivelPara(dex, exp) · expGanha(lvVencedor, dexDerrotado, lvDerrotado, { chefe })
 */
let D = null, X = null;
export async function carregar(){
  if (!D){
    [D, X] = await Promise.all([
      fetch('./data/evolutions.json').then(r => r.json()).catch(() => ({ por: {}, itens: {} })),
      fetch('./data/exp.json').then(r => r.json()).catch(() => ({ curvas: {}, especies: {} })),
    ]);
  }
  return D;
}
export const pronto = () => !!D;
export const regras = dex => D?.por?.[dex] || [];
export const itens = () => D?.itens || {};
export const ehItemDeEvolucao = id => !!D?.itens?.[id];
export const nomeItem = id => D?.itens?.[id]?.n || ('item ' + id);
/** Dia 6h–17h59, noite 18h–5h59 (relógio do aparelho — Espeon de dia, Umbreon à noite). */
export const horario = (d = new Date()) => { const h = d.getHours(); return (h >= 18 || h < 6) ? 'noite' : 'dia'; };
const TIPOS = { Normal: 'Normal', Fighting: 'Fighting', Flying: 'Flying', Poison: 'Poison', Ground: 'Ground', Rock: 'Rock', Bug: 'Bug', Ghost: 'Ghost', Steel: 'Steel', Fire: 'Fire', Water: 'Water', Grass: 'Grass', Electric: 'Electric', Psychic: 'Psychic', Ice: 'Ice', Dragon: 'Dragon', Dark: 'Dark', Fairy: 'Fairy' };
/** English rule line from the structured fields (dump `texto` is still Portuguese). */
export function textoRegra(r, nome = s => s){
  if (!r) return '';
  const item = nome(r.itemNome || '');
  const hold = nome(r.segurandoNome || '');
  if (r.gatilho === 'troca') return item ? 'trade while holding ' + item + ' — or use the item directly' : 'trade — or use a Link Cable';
  if (r.gatilho === 'item') return item ? 'use ' + item : (r.texto || 'use an evolution item');
  if (r.gatilho === 'muda') return 'appears with the other evolution';
  const bits = [];
  if (r.nivel) bits.push('Lv ' + r.nivel);
  else if (r.gatilho === 'nivel') bits.push('level up');
  if (r.amizade) bits.push('high friendship');
  if (r.horario === 'dia') bits.push('during the day');
  if (r.horario === 'noite') bits.push('at night');
  if (hold) bits.push('holding ' + hold);
  if (r.golpeNome) bits.push('knowing ' + r.golpeNome);
  if (r.tipoGolpe) bits.push('knowing a ' + (TIPOS[r.tipoGolpe] || r.tipoGolpe) + '-type move');
  if (r.noTime) bits.push('with a specific party Pokémon');
  if (r.tipoNoTime) bits.push('with a ' + (TIPOS[r.tipoNoTime] || r.tipoNoTime) + '-type in the party');
  if (r.local || r.chuva || r.beleza || r.gatilho === 'outro') return bits.length ? bits.join(', ') : (r.texto || 'special condition');
  return bits.join(', ') || r.texto || '';
}

/* ------------------------------------------------------------------ XP */
const curva = dex => X?.curvas?.[X?.especies?.[dex]?.c || 'medium'] || [];
/** XP total no começo do nível lv (curva da espécie). */
export function expPara(dex, lv){ const c = curva(dex); return c[Math.max(1, Math.min(100, lv | 0))] || 0; }
export function nivelPara(dex, exp){ const c = curva(dex); let lv = 1; while (lv < 100 && (c[lv + 1] ?? Infinity) <= exp) lv++; return lv; }
/** Fórmula da Gen 5+: b·L/5 · ((2L+10)/(L+Lp+10))^2.5 + 1 — b = base exp da espécie derrotada, L nível dela, Lp o do vencedor. */
export function expGanha(lvVencedor, dexDerrotado, lvDerrotado, { chefe = false } = {}){
  const b = X?.especies?.[dexDerrotado]?.b || 60, L = Math.max(1, lvDerrotado | 0), Lp = Math.max(1, lvVencedor | 0);
  const base = (b * L / 5) * Math.pow((2 * L + 10) / (L + Lp + 10), 2.5) + 1;
  return Math.max(1, Math.floor(base * (chefe ? 3 : 1)));
}
export const amizadeBase = dex => X?.especies?.[dex]?.a ?? 70;
export const AMIZADE_EVOLUI = 160;

/* ------------------------------------------------------------------ regras */
/** Avalia uma regra pro Pokémon m ({ dex, lv, amizade }) com o contexto do jogo. Devolve { pode, falta, consome }. */
export function avaliar(r, m, ctx = {}){
  const lv = m.lv || 1, amizade = m.amizade ?? amizadeBase(m.dex), tem = id => (ctx.itens?.[id] || 0) > 0;
  if (r.gatilho === 'outro' || r.local || r.chuva || r.beleza) return { pode: false, falta: 'not available here (' + textoRegra(r) + ')', consome: null };
  if (r.gatilho === 'item' || r.gatilho === 'troca'){
    if (!r.item) return { pode: false, falta: 'needs ' + r.itemNome + ' (not in the game yet)', consome: null };
    return tem(r.item) ? { pode: true, falta: '', consome: r.item } : { pode: false, falta: 'need ' + nomeItem(r.item) + ' in the Bag (Poké Mart)', consome: null };
  }
  if (r.gatilho === 'muda') return { pode: false, falta: 'comes with the other evolution', consome: null, muda: true };
  const faltas = []; let consome = null;
  if (r.nivel && lv < r.nivel) faltas.push(`Lv ${r.nivel} (now ${lv})`);
  if (r.amizade && amizade < r.amizade) faltas.push(`friendship ${r.amizade} (now ${amizade})`);
  if (r.horario && r.horario !== horario()) faltas.push(r.horario === 'dia' ? 'only during the day' : 'only at night');
  if ('segurando' in r){
    if (!r.segurando) faltas.push('needs ' + r.segurandoNome + ' (not in the game yet)');
    else if (!tem(r.segurando)) faltas.push('need ' + nomeItem(r.segurando) + ' in the Bag');
    else consome = r.segurando;
  }
  if (r.golpe && !ctx.conhece?.(m.dex, lv)?.has(r.golpe)) faltas.push('must know ' + r.golpeNome);
  if (r.tipoGolpe && !ctx.tiposConhecidos?.(m.dex, lv)?.has(r.tipoGolpe)) faltas.push('must know a ' + (TIPOS[r.tipoGolpe] || r.tipoGolpe) + '-type move');
  if (r.noTime && !(ctx.time || []).some(t => t.dex === r.noTime)) faltas.push('needs a specific Pokémon in the party');
  if (r.tipoNoTime && !(ctx.time || []).some(t => t.dex !== m.dex && (ctx.tiposDe?.(t.dex) || []).includes(r.tipoNoTime))) faltas.push('needs a ' + (TIPOS[r.tipoNoTime] || r.tipoNoTime) + '-type in the party');
  return { pode: !faltas.length, falta: faltas.join(' · '), consome };
}
/** Todas as regras da espécie avaliadas: [{ regra, pode, falta, consome, muda }]. Quem tem modelo é o chamador que decide. */
export function opcoes(m, ctx = {}){ return regras(m.dex).map(r => ({ regra: r, ...avaliar(r, m, ctx) })); }
