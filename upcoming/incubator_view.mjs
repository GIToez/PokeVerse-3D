import { STATS } from './individual.mjs';
export const HORA = 3600e3,
  MIN = 60e3;
export const PADRAO = { eclosaoH: 24, ticket: { item: 900150, reduzH: 12, maxPorOvo: 1 }, shiny: 16384 };
export const ARTE = { ticket: './ui/amanda/itens_novos/ic_900150.png' };
export const CORES = {
  chocando: ['#FFE7A0', '#FFB46B'],
  pronto: ['#F5B93B', '#F5B93B'],
  pai: '#6FB7FF',
  mae: '#FF8FC8',
  perdeu: '#FFB46B',
  subiu: '#7BE0A0',
};
export const TIPO_PT = {
  Normal: 'normal',
  Fire: 'fogo',
  Water: 'agua',
  Grass: 'planta',
  Electric: 'eletrico',
  Ice: 'gelo',
  Fighting: 'lutador',
  Poison: 'venenoso',
  Ground: 'terrestre',
  Flying: 'voador',
  Psychic: 'psiquico',
  Bug: 'inseto',
  Rock: 'pedra',
  Ghost: 'fantasma',
  Dragon: 'dragao',
  Dark: 'noturno',
  Steel: 'metalico',
  Fairy: 'fada',
};
export const TIPOS = Object.values(TIPO_PT);
const num = (v, p = 0) => (Number.isFinite(+v) ? +v : p);
const semTr = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s);
const cabeca = (a) => (num(a) > 0 ? './ui/mon/pm' + String(Math.round(num(a))).padStart(4, '0') + '.png' : null);
const especieDe = (a, b) => b.nome?.(a) || '#' + a;
const simbolo = (s) => (s === 'm' || s === 'M' || s === 1 ? '♂' : s === 'f' || s === 'F' || s === 2 ? '♀' : '');
const tipoOk = (t) => (TIPOS.includes(t) ? t : 'normal');
export function tipoDoOvo(a, b) {
  const d = num(a);
  const t = d > 0 ? b?.(d)?.[0] : null;
  return TIPO_PT[t] || 'normal';
}
export const arteOvo = (a, b = '') => './ui/amanda/ovos/ovo-' + tipoOk(a) + (b ? '-' + b : '') + '.png';
export const arteIncubadora = (a, b = false) => './ui/amanda/ovos/incubadora-' + tipoOk(a) + (b ? '-128' : '') + '.png';
export const dobro = (a) => (a ? a.replace(/\.png$/, '@2x.png') : a);
export function duracaoCurta(a, b = {}) {
  const c = b.tr || semTr,
    m = Math.ceil(Math.max(0, num(a)) / MIN);
  if (m < 1) return c('under 1 min');
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : r + ' min';
}
export function quando(b, c, e = {}) {
  const f = e.tr || semTr;
  if (!Number.isFinite(+b) || !(+b > 0)) return '—';
  const d = new Date(+b),
    a = new Date(+c),
    g = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const i = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const j = Math.round((i(d) - i(a)) / 86400e3);
  if (j === 0) return f('today, {h}', { h: g });
  if (j === 1) return f('tomorrow, {h}', { h: g });
  if (j === -1) return f('yesterday, {h}', { h: g });
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ', ' + g;
}
const regras = (v) => ({
  eclosaoH: num(v?.eclosaoH, PADRAO.eclosaoH),
  ticket: { ...PADRAO.ticket, ...(v?.ticket || {}) },
});
export const especieDoOvo = (o) => {
  const d = num(o?.especie ?? o?.pais?.[0]?.dex, 0);
  return d > 0 ? d : null;
};
function textoPais(o, a) {
  const P = Array.isArray(o?.pais) ? o.pais : [];
  const m = P.find((p) => simbolo(p?.sexo) === '♂'),
    f = P.find((p) => simbolo(p?.sexo) === '♀');
  if (!m && !f) return '—';
  const b = (p) => (p?.lv != null ? ' Lv ' + p.lv : '');
  const c = num((m || f).dex),
    d = c > 0 ? especieDe(c, a) : '';
  return (d ? d + ' ' : '') + (m ? '♂' + b(m) : '') + (m && f ? '  ·  ' : '') + (f ? '♀' + b(f) : '');
}
export function arteLinhaOvos(a, b) {
  const c = Array.isArray(a?.incubadoras) ? a.incubadoras : [],
    d = Array.isArray(a?.ovos) ? a.ovos : [];
  const e = c.find((i) => i?.ovo || d.some((o) => o && i?.id != null && String(o.incubadora) === String(i.id)));
  const o = e
    ? d.find((x) => x && String(x.id) === String(e.ovo)) || d.find((x) => x && String(x.incubadora) === String(e.id))
    : d.find(Boolean);
  return arteOvo(tipoDoOvo(especieDoOvo(o), b));
}
export function vistaIncubadora(c, e = {}) {
  const f = e.tr || semTr,
    E = c || {},
    V = E.vista || {},
    R = regras(V),
    g = num(E.agora, Date.now());
  const i = Array.isArray(V.incubadoras) ? V.incubadoras.filter(Boolean) : [],
    j = Array.isArray(V.ovos) ? V.ovos.filter(Boolean) : [];
  const k = R.eclosaoH * HORA;
  const l = (a) =>
    j.find((o) => a.ovo != null && String(o.id) === String(a.ovo)) ||
    j.find((o) => a.id != null && String(o.incubadora) === String(a.id)) ||
    null;
  const m = i.map((a) => {
    const o = l(a),
      b = !o ? 'vazia' : o.pronto || num(o.faltaMs, 1) <= 0 ? 'pronto' : 'chocando';
    const c = especieDoOvo(o),
      d = tipoDoOvo(c, e.tipos),
      h = b === 'chocando' ? Math.max(0, num(o.faltaMs, num(o.prontoEm) - g)) : 0;
    return {
      id: String(a.id),
      estado: b,
      ovo: o,
      dex: c,
      tipo: d,
      especie: b === 'vazia' ? f('Empty') : c ? especieDe(c, e) : f('Egg'),
      tempo: b === 'vazia' ? f('Add an egg') : b === 'pronto' ? f('Ready!') : duracaoCurta(h, e),
      progresso: b === 'pronto' ? 1 : b === 'vazia' ? 0 : Math.max(0, Math.min(1, 1 - h / k)),
      falta: h,
      img: b === 'vazia' ? null : arteIncubadora(d),
    };
  });
  const p =
    m.find((x) => String(x.id) === String(E.incubadora)) ||
    m.find((x) => x.estado === 'pronto') ||
    m.find((x) => x.estado === 'chocando') ||
    m[0] ||
    null;
  const q = p?.ovo || null,
    r = p ? p.estado : 'vazia',
    s = j.filter((o) => !o.incubadora);
  const u = { estado: r };
  if (!m.length) {
    u.titulo = f('No incubator');
    u.dica = f('Place one via Arrange land');
  } else if (r === 'vazia') {
    u.titulo = f('Empty incubator');
    u.dica = s.length ? f('Pick a stored egg on the side') : f('Make an egg at the Route 5 Daycare');
  } else {
    u.especie = p.dex ? f('{especie} Egg', { especie: especieDe(p.dex, e) }) : f('Egg');
    u.progresso = p.progresso;
    u.tempo =
      r === 'pronto' ? f('Ready to hatch!') : f('{x} of {h} h left', { x: duracaoCurta(p.falta, e), h: R.eclosaoH });
    u.img = arteIncubadora(p.tipo, true);
    u.ovinho = arteOvo(p.tipo, '86');
  }
  const n = Math.max(0, Math.floor(num(E.tickets))),
    v = !!q && num(q.tickets) >= R.ticket.maxPorOvo && R.ticket.maxPorOvo > 0;
  const w = v
    ? { estado: 'usado', info: f('Already used on this egg (1 per egg)'), botao: f('Used'), ligado: false }
    : n <= 0
      ? { estado: 'sem-ticket', info: f("You don't have any"), botao: f('Shop'), ligado: true }
      : {
          estado: 'normal',
          info: f('Cuts {h} h · you have {n}', { h: R.ticket.reduzH, n }),
          botao: f('Use'),
          ligado: r === 'chocando' && !E.esperando,
        };
  w.nome = f('Hatch Ticket');
  w.img = ARTE.ticket;
  const y = {
    pais: q ? textoPais(q, e) : '—',
    shiny: f('1 in {n}', { n: Math.round(num(E.shiny, PADRAO.shiny)).toLocaleString(e.local || 'pt-BR') }),
    entrou: q ? quando(q.inicio, g, e) : '—',
    choca: r === 'pronto' ? f('now') : q ? quando(q.prontoEm ?? g + p.falta, g, e) : '—',
  };
  const z = { ligado: r === 'pronto' && !E.esperando };
  const _ = E.esperando
    ? { texto: f('one moment…'), cor: 'bom' }
    : E.aviso?.texto
      ? { texto: E.aviso.texto, cor: E.aviso.bom ? 'bom' : 'ruim' }
      : {
          texto:
            r === 'pronto'
              ? f('The egg is ready!')
              : r === 'vazia'
                ? f('Put an egg in the incubator')
                : f('Available when the egg is ready'),
          cor: null,
        };
  const $ =
    r !== 'vazia'
      ? null
      : {
          ovos: s.map((o) => {
            const d = especieDoOvo(o);
            return { id: String(o.id), nome: d ? especieDe(d, e) : f('Egg'), img: arteOvo(tipoDoOvo(d, e.tipos)) };
          }),
          vazio: s.length ? null : f('No stored eggs'),
          dica: !m.length
            ? f("Place an incubator on your land via Arrange land. Eggs come from Hideko's Daycare on Route 5.")
            : s.length
              ? f('Tap an egg to put it in this incubator.')
              : f("Eggs come from Hideko's Daycare on Route 5."),
        };
  if ($ && E.aviso?.texto) $.dica = E.aviso.texto;
  return {
    contagem: f('{a} of {b} occupied', { a: m.filter((x) => x.estado !== 'vazia').length, b: m.length }),
    incubadoras: m.map(({ ovo: a, falta: b, ...x }) => x),
    incubadora: p ? p.id : null,
    ovo: q ? String(q.id) : null,
    prontos: m.filter((x) => x.estado === 'pronto').length,
    painel: u,
    ticket: w,
    detalhes: y,
    regras: f(
      "The egg hatches in {h} h; a Hatch Ticket cuts {t} h, one per egg. When it's ready, tap Hatch: the Pokémon joins your team (or the Box, if your team is full).",
      { h: R.eclosaoH, t: R.ticket.reduzH },
    ),
    chocar: z,
    dica: _,
    vazia: $,
    nasceu: E.nasceu ? vistaNasceu(E.nasceu, e) : null,
  };
}
export function vistaNasceu(r, b = {}) {
  const c = b.tr || semTr,
    f = r?.ficha || {},
    H = Array.isArray(r?.heranca) ? r.heranca : [];
  const d = num(f.dex),
    e = f.nome || (d > 0 ? especieDe(d, b) : '?');
  const g = (a) => (typeof a === 'string' ? a : typeof a?.texto === 'string' ? a.texto : '');
  const j = r?.daPedra ?? ((Array.isArray(r?.avisos) ? r.avisos : []).some((a) => /Pedra Eterna/.test(g(a))) || null);
  const k = String(f.natureza || '');
  const l =
    j === 'mae'
      ? c('from the mother, via Everstone')
      : j === 'pai'
        ? c('from the father, via Everstone')
        : j
          ? c('via Everstone')
          : c('sorteada');
  const m = STATS.map((a, i) => {
    const h = H[i] || {},
      b = Math.max(-31, Math.min(31, Math.floor(num(h.delta)))),
      d = h.de === 'mae' ? 'mae' : h.de === 'pai' ? 'pai' : null;
    const e = d
      ? c(d === 'mae' ? 'from the mother' : 'from the father') + (b < 0 ? ' −' + Math.abs(b) : b > 0 ? ' +' + b : '')
      : '';
    return {
      rotulo: c(a),
      valor: String(Math.max(0, Math.min(31, Math.floor(num(f.ivs?.[i]))))),
      origem: e,
      cor: !d ? null : b < 0 ? CORES.perdeu : b > 0 ? CORES.subiu : CORES[d],
    };
  });
  return {
    titulo: c('Hatched!'),
    img: cabeca(d),
    shiny: !!f.shiny,
    nome: e + (simbolo(f.sexo) ? ' ' + simbolo(f.sexo) : '') + ' · Lv ' + Math.max(1, Math.floor(num(f.lv, 1))),
    natureza: k ? k + ' · ' + l : l,
    rotuloIvs: c('Where each IV came from'),
    ivs: m,
  };
}
