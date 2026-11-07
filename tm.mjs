/* TM counter rules, shared by the Celadon clerk and the account server.
   Teaching spends Coins, checks badges, and only offers a move the species can learn.
   Moves the battle engine cannot run (tm_regras.json semEfeito) stay off the counter. */

import { PP_MULT } from './individual.mjs';   // PP multiplier (individual.mjs; 1 = the original games)

const PRECO_PADRAO = { comum: 1000, forte: 5000, rara: 20000 };

export function catalogo({ beta, learnset, regras, golpe }) {
  const sem = new Set(Object.keys(regras?.semEfeito || {}));
  const bloquear = !!regras?.soComEfeito;
  const porChave = new Map();
  const aprende = new Map();
  for (const x of Array.isArray(beta?.tms) ? beta.tms : []) {
    if (!x || x.situacao !== 'beta') continue;
    const chave = String(x.golpe?.chave || '');
    if (!chave || (bloquear && sem.has(chave))) continue;
    const g = golpe?.(chave);
    if (!g) continue;
    const faixa = x.faixa || learnset?.tms?.[chave]?.faixa || 'comum';
    const preco = Math.max(0, Math.floor(+regras?.montar?.[faixa]?.dinheiro || PRECO_PADRAO[faixa] || 0));
    const trava = Math.max(0, Math.floor(+regras?.trava?.[faixa] || 0));
    porChave.set(chave, {
      chave,
      item: x.item,
      faixa,
      preco,
      trava,
      tutor: false,
      nome: g.nome || x.golpe?.en || chave,
      tipo: g.tipo || '',
      poder: g.poder ?? x.poder ?? null,
      pp: Math.max(1, Math.floor(+g.pp || +learnset?.pp?.[chave] || 20)) * PP_MULT,
    });
  }
  for (const [dex, lista] of Object.entries(learnset?.tm || {})) {
    const set = new Set();
    for (const ch of Array.isArray(lista) ? lista : []) if (porChave.has(ch)) set.add(ch);
    if (set.size) aprende.set(+dex, set);
  }
  const tutor = new Map();
  const tutorAprende = new Map();
  const precoTutor = Math.max(0, Math.floor(+regras?.tutor?.preco || 0));
  for (const ch of regras?.tutor?.golpes || []) {
    const chave = String(ch);
    if (!chave || (bloquear && sem.has(chave))) continue;
    const g = golpe?.(chave);
    if (!g) continue;
    tutor.set(chave, {
      chave, tutor: true, faixa: 'tutor', preco: precoTutor, trava: 0,
      nome: g.nome || chave, tipo: g.tipo || '', poder: g.poder ?? null,
      pp: Math.max(1, Math.floor(+g.pp || 20)) * PP_MULT,
    });
    const quem = regras?.tutor?.aprende?.[chave];
    tutorAprende.set(chave, new Set((Array.isArray(quem) ? quem : []).map(n => +n)));
  }
  return { porChave, aprende, tutor, tutorAprende };
}

export function podeAprender(cat, mon, entrada) {
  if (!mon || !entrada) return { ok: false, erro: 'That move is not taught here.' };
  if ((mon.movs || []).some(m => m && m.id === entrada.chave)) return { ok: false, erro: 'Already knows this move.' };
  const dex = +mon.dex;
  if (entrada.tutor) {
    if (!cat.tutorAprende.get(entrada.chave)?.has(dex)) return { ok: false, erro: (mon.nome || 'This Pokémon') + " can't learn " + entrada.nome + '.' };
  } else if (!cat.aprende.get(dex)?.has(entrada.chave)) {
    return { ok: false, erro: (mon.nome || 'This Pokémon') + " can't learn " + entrada.nome + '.' };
  }
  return { ok: true };
}

export function cobrar(entrada, { insignias = 0, dinheiro = 0 } = {}) {
  const n = Array.isArray(insignias) ? insignias.length : Math.max(0, Math.floor(+insignias || 0));
  const trava = Math.max(0, Math.floor(+entrada?.trava || 0));
  if (n < trava) return { ok: false, erro: (entrada?.nome || 'This TM') + ' needs ' + trava + ' badge' + (trava === 1 ? '' : 's') + '.' };
  const preco = Math.max(0, Math.floor(+entrada?.preco || 0));
  if ((+dinheiro || 0) < preco) return { ok: false, erro: 'Not enough Coins. ' + (entrada?.nome || 'This move') + ' costs ' + preco + '.' };
  return { ok: true, preco };
}

/** Writes the move onto mon.movs. When the set is full, `esquecer` is the move id to replace. */
export function aplicar(mon, entrada, esquecer) {
  if (!mon || !entrada) return { ok: false, erro: 'That move is not taught here.' };
  if (!Array.isArray(mon.movs)) mon.movs = [];
  if (mon.movs.some(m => m && m.id === entrada.chave)) return { ok: false, erro: 'Already knows this move.' };
  const golpe = { id: entrada.chave, pp: entrada.pp, ppMax: entrada.pp };
  if (mon.movs.length >= 4) {
    const i = mon.movs.findIndex(m => m && m.id === esquecer);
    if (i < 0) return { ok: false, erro: 'Pick a move to forget.', cheio: true };
    const saiu = mon.movs[i].id;
    mon.movs[i] = golpe;
    return { ok: true, esqueceu: saiu };
  }
  mon.movs.push(golpe);
  return { ok: true, esqueceu: null };
}
