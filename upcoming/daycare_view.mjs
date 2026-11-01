import { travado as estaTravado } from './pokemon_lock.mjs';
import { arteOvo, tipoDoOvo } from './incubator_view.mjs';
export const PADRAO = { taxa: 1000, eclosaoH: 24, ovosMax: 6, local: "Route 5 · Hideko's Daycare", npc: 'Hideko' };
export const FALA =
  "Caring for and raising Pokémon is the greatest joy of my life~ Bring a pair of the same species and I'll look after the egg for you.";
export const ARTE = { npc: './ui/amanda/ovos/hideko-corpo.png', ovo: arteOvo('normal') };
export const TEXTOS = {
  especieDiferente: 'Both must be the same species.',
  naoCria: "This species doesn't lay eggs.",
  foraDaCriacao: "This species can't be bred yet.",
  semModelo: "This species can't hatch yet.",
  mesmoSexo: 'Needs a male and a female.',
  ovosCheio: 'You already have too many eggs stored.',
  semMoedas: 'Not enough coins for the Daycare fee.',
  travado: 'This Pokémon is locked: unlock it before taking it to the Daycare.',
  paisIguais: 'Choose two different Pokémon.',
};
export const SELOS = {
  sexo_m: 'MACHO',
  sexo_f: 'FEMALE',
  sexo_n: 'GENDERLESS',
  especie: 'OTHER SPECIES',
  naoCria: "CAN'T BREED",
  travado: 'LOCKED',
};
const num = (v, p = 0) => (Number.isFinite(+v) ? +v : p);
const semTr = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s);
const cabeca = (a) => (num(a) > 0 ? './ui/mon/pm' + String(Math.round(num(a))).padStart(4, '0') + '.png' : null);
export function sexoDe(e) {
  const s = e?.sexo;
  if (s === 'm' || s === 'M' || s === 1 || s === '♂') return 'm';
  if (s === 'f' || s === 'F' || s === 2 || s === '♀') return 'f';
  if (s === '-' || s === 0 || s === 'n') return '-';
  return null;
}
export const simbolo = (s) => (s === 'm' ? '♂' : s === 'f' ? '♀' : '');
const nomeDe = (e, a) =>
  (typeof e?.apelido === 'string' && e.apelido) || e?.nome || a.nome?.(e?.dex) || '#' + (e?.dex ?? '?');
const especieDe = (a, b) => b.nome?.(a) || '#' + a;
const moeda = (n, a) => Math.round(num(n)).toLocaleString(a.local || 'pt-BR') + ' ₽';
const numero = (n, a) => Math.round(num(n)).toLocaleString(a.local || 'pt-BR');
const regras = (a) => ({
  taxa: Math.max(0, Math.floor(num(a?.vista?.taxa, PADRAO.taxa))),
  eclosaoH: num(a?.vista?.eclosaoH, PADRAO.eclosaoH),
  ovosMax: num(a?.vista?.limites?.ovosMax, PADRAO.ovosMax),
  guardados: num(a?.vista?.limites?.guardados, 0),
});
const criaDe = (a, b) => {
  const r = b.cria?.(a);
  return r == null ? { ok: true } : typeof r === 'boolean' ? (r ? { ok: true } : { ok: false, erro: 'naoCria' }) : r;
};
export function avisoDaCreche(a, b = {}) {
  const d = b.tr || semTr,
    E = a || {},
    R = regras(E);
  if (E.erro?.erro) {
    if (E.erro.erro === 'semMoedas' && E.moedas != null && num(E.moedas) < R.taxa)
      return { erro: 'semMoedas', texto: d('{n} short of the fee.', { n: moeda(R.taxa - num(E.moedas), b) }) };
    return {
      erro: E.erro.erro,
      texto: d(
        E.erro.motivo || TEXTOS[E.erro.erro] || "That didn't work.",
        E.erro.vars && typeof E.erro.vars === 'object' ? E.erro.vars : null,
      ),
    };
  }
  const M = E.macho,
    F = E.femea;
  if (M && F && String(M.uid) === String(F.uid)) return { erro: 'paisIguais', texto: d(TEXTOS.paisIguais) };
  if (M && F && num(M.dex) !== num(F.dex)) return { erro: 'especieDiferente', texto: d(TEXTOS.especieDiferente) };
  const f = M || F;
  if (f) {
    const c = criaDe(f.dex, b);
    if (!c.ok) return { erro: c.erro || 'naoCria', texto: d(TEXTOS[c.erro] || TEXTOS.naoCria) };
  }
  for (const e of [M, F]) if (e && estaTravado(e)) return { erro: 'travado', texto: d(TEXTOS.travado) };
  if (!(M && F)) return null;
  if (R.guardados >= R.ovosMax) return { erro: 'ovosCheio', texto: d(TEXTOS.ovosCheio) };
  if (E.moedas != null && num(E.moedas) < R.taxa)
    return { erro: 'semMoedas', texto: d('{n} short of the fee.', { n: moeda(R.taxa - num(E.moedas), b) }) };
  return null;
}
function slot(e, a, b) {
  const c = b.tr || semTr;
  if (!e)
    return {
      vazio: true,
      nome: c(a === 'm' ? 'Choose a male' : 'Choose a female'),
      ivs: c('from the team or the Box'),
      img: null,
      botao: c('Choose'),
      uid: null,
    };
  const d =
    Array.isArray(e.ivs) && e.ivs.length === 6
      ? 'IV ' + e.ivs.map((v) => Math.max(0, Math.min(31, Math.floor(num(v))))).join(' · ')
      : '';
  return {
    vazio: false,
    uid: String(e.uid),
    dex: num(e.dex),
    nome: nomeDe(e, b) + '  ·  Lv ' + (e.lv ?? '?'),
    ivs: d,
    img: cabeca(e.dex),
    shiny: !!e.shiny,
    botao: c('Swap'),
  };
}
export function vistaCreche(c, d = {}) {
  const e = d.tr || semTr,
    E = c || {},
    R = regras(E);
  const M = E.macho || null,
    F = E.femea || null,
    f = M || F;
  const g = avisoDaCreche(E, d);
  const i = g && ['especieDiferente', 'naoCria', 'foraDaCriacao', 'semModelo', 'paisIguais'].includes(g.erro);
  const j = f && !i ? num(d.choca?.(num(f.dex)) ?? f.dex) : null;
  const k = {
    img: arteOvo(tipoDoOvo(j, d.tipos)),
    titulo: !f
      ? e('Choose a male and a female')
      : i
        ? e("This pair can't make an egg")
        : e('A {x} Egg', { x: especieDe(j, d) }),
    regras: e(
      "Hatches in {h} h in an Incubator. Each IV comes from the father or mother and may drop or rise a little. The nature is random (with an Everstone, 50% chance to pass on the holder's). Both parents stay with Hideko.",
      { h: R.eclosaoH },
    ),
    aviso: g,
  };
  let l = null;
  if (E.dialogo === 'confirmar' && M && F && !g) {
    l = {
      tipo: 'confirmar',
      titulo: e('Breed the egg?'),
      texto: e("The {a} ♂ and the {b} ♀ stay with Hideko and become an egg. Fee: {t}. This can't be undone.", {
        a: nomeDe(M, d),
        b: nomeDe(F, d),
        t: moeda(R.taxa, d),
      }),
    };
  } else if (E.dialogo === 'recebido' || E.recebido) {
    const o = E.recebido?.ovo || E.recebido || {},
      m = num(o.especie ?? o.pais?.[0]?.dex ?? j, 0);
    l = {
      tipo: 'recebido',
      titulo: e('You got an egg!'),
      img: arteOvo(tipoDoOvo(m, d.tipos)),
      texto:
        m > 0
          ? e('{x} Egg. Put it in an Incubator on your land to hatch.', { x: especieDe(m, d) })
          : e('Put the egg in an Incubator on your land to hatch.'),
    };
  }
  return {
    titulo: e('Creche'),
    local: e(PADRAO.local),
    npc: PADRAO.npc,
    npcImg: ARTE.npc,
    fala: e(FALA),
    macho: slot(M, 'm', d),
    femea: slot(F, 'f', d),
    resultado: k,
    taxa: numero(R.taxa, d),
    criar: { ligado: !!(M && F) && !g && !E.esperando },
    esperando: !!E.esperando,
    dialogo: l,
  };
}
export function linhaDoSeletor(e, a, b, d = {}) {
  const s = sexoDe(e);
  if (s && s !== a)
    return { ok: false, erro: 'sexo', selo: s === '-' ? SELOS.sexo_n : s === 'm' ? SELOS.sexo_m : SELOS.sexo_f };
  if (b && num(b.dex) !== num(e?.dex)) return { ok: false, erro: 'especie', selo: SELOS.especie };
  const c = criaDe(e?.dex, d);
  if (!c.ok) return { ok: false, erro: 'naoCria', selo: SELOS.naoCria };
  if (estaTravado(e)) return { ok: false, erro: 'travado', selo: SELOS.travado };
  return { ok: true };
}
export function vistaSeletor(c, d = {}, { lado: f = 'm', aba: g = 'time', sel: h = null } = {}) {
  const j = d.tr || semTr,
    E = c || {};
  const k = f === 'm' ? E.femea : E.macho,
    m = f === 'm' ? E.macho : E.femea;
  const n = (g === 'caixa' ? E.caixa : E.time) || [];
  const o = n
    .filter((e) => e && e.uid != null && !(k && String(k.uid) === String(e.uid)))
    .map((e, i) => ({ e, i, ...linhaDoSeletor(e, f, k, d) }))
    .filter((x) => g !== 'caixa' || x.ok || x.erro === 'naoCria' || x.erro === 'travado')
    .sort((a, b) => (a.ok ? 0 : a.erro === 'sexo' ? 2 : 1) - (b.ok ? 0 : b.erro === 'sexo' ? 2 : 1) || a.i - b.i)
    .map((x) => ({
      uid: String(x.e.uid),
      nome: nomeDe(x.e, d),
      nivel: 'Lv ' + (x.e.lv ?? '?'),
      img: cabeca(x.e.dex),
      ok: x.ok,
      erro: x.erro || null,
      selo: x.selo ? j(x.selo) : null,
      cadeado: x.erro === 'travado',
      marcado: h != null ? String(h) === String(x.e.uid) : !!m && String(m.uid) === String(x.e.uid),
    }));
  const p = o.find((l) => l.marcado && l.ok) || null;
  const q = k ? especieDe(num(k.dex), d) : null;
  return {
    titulo: j(f === 'm' ? 'Choose the male' : 'Choose the female'),
    pedido: q
      ? j(
          f === 'm'
            ? "For the Daycare: a male {x}, the female's species."
            : "For the Daycare: a female {x}, the male's species.",
          { x: q },
        )
      : j(
          f === 'm'
            ? 'For the Daycare: a male of a species that lays eggs.'
            : 'For the Daycare: a female of a species that lays eggs.',
        ),
    linhas: o,
    vazio: o.length ? null : j(g === 'caixa' ? 'No suitable Pokémon in the Box.' : 'No Pokémon on the team.'),
    botao: { ligado: !!p, texto: p ? j('Choose {x}', { x: p.nome }) : j('Choose') },
  };
}
