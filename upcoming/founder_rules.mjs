export const ORIGEM = 'pacote-fundador';
export const TITULO = 'pacoteFundador';
export const DIAS_POR_MES = 30;
export const MOEDAS = Object.freeze(['brl', 'usd']);
export const NIVEIS = Object.freeze([
  Object.freeze({ id: 'fund-desafiante', nivel: 1, letra: 'd' }),
  Object.freeze({ id: 'fund-elite', nivel: 2, letra: 'e' }),
  Object.freeze({ id: 'fund-campeao', nivel: 3, letra: 'c' }),
]);
export const NIVEL_MAX = NIVEIS.length;
export const CHAVES_PRECOS = Object.freeze([
  'fund-desafiante',
  'fund-elite',
  'fund-campeao',
  'fund-d-e',
  'fund-e-c',
  'fund-d-c',
]);
export const TETO_ID = 16;
export const MINIMO_CENTAVOS = 50;
export const CLASSE_DO_EFEITO = Object.freeze({ chao: 'rastro', peito: 'peito' });
export const TIPOS_PECA = Object.freeze(['roupa', 'mochila', 'peito', 'rastro']);
const TETOS = { diamantes: 100000, vagas: 5000, incubadoras: 20, meses: 36, nome: 40, centavos: 10000000 };
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const inteiro = (v, a = 0, b = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= a && v <= b;
const RE_PECA_TEXTO = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;
const RE_PAG = /^(pi|cs|ch)_[A-Za-z0-9_]{1,110}$/;
const RE_CONCESSAO = /^staff:\d{8}T\d{6}:[a-z0-9_.]{3,16}:[1-9]$/;
export const refDePagamento = (s) => typeof s === 'string' && RE_PAG.test(s);
export const refDeConcessao = (s) => typeof s === 'string' && RE_CONCESSAO.test(s);
export const idDoNivel = (n) => NIVEIS.find((x) => x.nivel === n)?.id ?? null;
export const nivelDoId = (a) => (typeof a === 'string' ? (NIVEIS.find((x) => x.id === a)?.nivel ?? null) : null);
export function lerPeca(s) {
  if (typeof s !== 'string') return null;
  const i = s.indexOf(':');
  if (i < 1) return null;
  const a = s.slice(0, i),
    b = s.slice(i + 1);
  if (!TIPOS_PECA.includes(a)) return null;
  if (a === 'peito' || a === 'rastro') {
    if (!/^[1-9][0-9]{0,8}$/.test(b)) return null;
    return { tipo: a, id: Number(b) };
  }
  return RE_PECA_TEXTO.test(b) ? { tipo: a, id: b } : null;
}
export function pecasDoNivel(a) {
  if (!obj(a)) return [];
  const b = obj(a.efeitos) ? a.efeitos : {};
  return [
    ...(Array.isArray(a.pecas) ? a.pecas : []),
    ...Object.entries(CLASSE_DO_EFEITO).flatMap(([g, a]) => (Array.isArray(b[g]) ? b[g] : []).map((b) => a + ':' + b)),
  ];
}
const niveisDe = (t) => (Array.isArray(t) ? t : obj(t) && Array.isArray(t.niveis) ? t.niveis : []);
const nivelDe = (t, n) => niveisDe(t).find((x) => obj(x) && x.nivel === n) || null;
export const RE_MONTARIA = /^(pm\d{4}|[a-z][a-z0-9-]{1,23})$/;
export const RE_MONTARIA_SHINY = /^pm\d{4}$/;
const TETO_MONTARIAS = 12;
export function montariasDoNivel(a) {
  const M = obj(a) && obj(a.montarias) ? a.montarias : {};
  const l = (v, a) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && a.test(x)))] : []);
  return { normais: l(M.normais, RE_MONTARIA), shiny: l(M.shiny, RE_MONTARIA_SHINY) };
}
export function montariasDaTabela(t) {
  const a = new Set(),
    b = new Set();
  for (const c of niveisDe(t)) {
    const m = montariasDoNivel(c);
    for (const x of m.normais) a.add(x);
    for (const x of m.shiny) b.add(x);
  }
  return { normais: a, shiny: b };
}
export function validarTabela(t) {
  const c = [],
    e = (m) => {
      c.push(m);
    };
  try {
    if (!obj(t)) return { ok: false, erros: ['the table is not an object'] };
    if (t.origem !== ORIGEM) e('origem: must be "' + ORIGEM + '"');
    if (t.titulo !== TITULO)
      e('titulo: must be "' + TITULO + '" ("founder" is the guild title and "challenger" the gym one)');
    if (t.diasPorMes !== DIAS_POR_MES) e('diasPorMes: must be ' + DIAS_POR_MES);
    if (!Array.isArray(t.niveis)) return { ok: false, erros: [...c, 'niveis: must be a list'] };
    if (t.niveis.length !== NIVEL_MAX)
      e('niveis: expected ' + NIVEL_MAX + ' (Challenger, Elite and Champion), got ' + t.niveis.length);
    for (const k of CHAVES_PRECOS)
      if (k.length > TETO_ID) e('the price key "' + k + '" exceeds ' + TETO_ID + ' caracteres');
    let d = null;
    for (let i = 0; i < t.niveis.length; i++) {
      const f = t.niveis[i],
        h = NIVEIS[i],
        j = 'level ' + (i + 1);
      if (!obj(f)) {
        e(j + ': is not an object');
        d = null;
        continue;
      }
      if (!h) {
        e(j + ': extra');
        continue;
      }
      if (f.id !== h.id) e(j + ': the id is "' + h.id + '" (got ' + JSON.stringify(f.id) + ')');
      if (typeof f.id === 'string' && f.id.length > TETO_ID) e(j + ': the id exceeds ' + TETO_ID + ' caracteres');
      if (f.nivel !== h.nivel) e(j + ': `nivel` must be ' + h.nivel);
      if (typeof f.nome !== 'string' || !f.nome.trim() || f.nome.length > TETOS.nome)
        e(j + ': missing name (up to ' + TETOS.nome + ' letters)');
      for (const m of MOEDAS)
        if (!inteiro(f[m], MINIMO_CENTAVOS, TETOS.centavos))
          e(j + ': the price in ' + m + ' (cents, integer, from ' + MINIMO_CENTAVOS + ' a ' + TETOS.centavos + ')');
      if (!inteiro(f.diamantes, 1, TETOS.diamantes)) e(j + ': diamonds (integer from 1 to ' + TETOS.diamantes + ')');
      if (!inteiro(f.vagas, 0, TETOS.vagas)) e(j + ': slots (integer from 0 to ' + TETOS.vagas + ')');
      if (!inteiro(f.incubadoras, 0, TETOS.incubadoras))
        e(j + ': incubators (integer from 0 to ' + TETOS.incubadoras + ')');
      if (!inteiro(f.meses, 0, TETOS.meses)) e(j + ': months (integer from 0 to ' + TETOS.meses + ')');
      if (f.dias !== f.meses * DIAS_POR_MES)
        e(j + ': days = ' + DIAS_POR_MES + ' × months (got ' + JSON.stringify(f.dias) + ')');
      if (f.titulo !== TITULO) e(j + ': the title is "' + TITULO + '"');
      if (!(f.termina === null || inteiro(f.termina, 1))) e(j + ': termina is null (no deadline) or the time in ms');
      if (!Array.isArray(f.pecas)) e(j + ': pecas must be a list');
      else
        for (const p of f.pecas) {
          const l = lerPeca(p);
          if (!l) e(j + ': piece not in "type:id" format: ' + JSON.stringify(p));
          else if (l.tipo === 'peito' || l.tipo === 'rastro') e(j + ': o ' + l.tipo + ' goes in `efeitos` (' + p + ')');
        }
      if (!obj(f.efeitos)) e(j + ': efeitos must be { peito: [ids], chao: [ids] }');
      else
        for (const [g, l] of Object.entries(f.efeitos)) {
          if (!Object.hasOwn(CLASSE_DO_EFEITO, g)) {
            e(j + ': unknown effect group "' + g + '" (they are peito and chao)');
            continue;
          }
          if (!Array.isArray(l) || l.some((a) => !inteiro(a, 1, 999999999)))
            e(j + ': efeitos.' + g + ' is a list of integer ids');
        }
      const n = pecasDoNivel(f);
      if (new Set(n).size !== n.length) e(j + ': duplicate piece');
      if (Object.hasOwn(f, 'montarias')) {
        const M = f.montarias;
        if (!obj(M) || Object.keys(M).some((k) => k !== 'normais' && k !== 'shiny'))
          e(j + ': montarias is { normais: [ids], shiny: [ids] }');
        else
          for (const [k, o] of [
            ['normais', RE_MONTARIA],
            ['shiny', RE_MONTARIA_SHINY],
          ]) {
            const l = Object.hasOwn(M, k) ? M[k] : [];
            if (!Array.isArray(l) || l.length > TETO_MONTARIAS || l.some((x) => typeof x !== 'string' || !o.test(x)))
              e(
                j +
                  ': montarias.' +
                  k +
                  ' is a list of ids ' +
                  (k === 'shiny' ? '"pmNNNN"' : '("pmNNNN" or the vehicle)') +
                  ', up to ' +
                  TETO_MONTARIAS,
              );
            else if (new Set(l).size !== l.length) e(j + ': duplicate mount in mounts.' + k);
          }
      }
      if (d && d.nivel === f.nivel - 1) {
        for (const m of MOEDAS)
          if (inteiro(f[m]) && inteiro(d[m]) && f[m] - d[m] < MINIMO_CENTAVOS)
            e(
              j +
                ': the full price in ' +
                m +
                ' must be higher than the tier below (the upgrade costs at least ' +
                MINIMO_CENTAVOS +
                ' centavos)',
            );
        if (inteiro(f.diamantes) && inteiro(d.diamantes) && !(f.diamantes > d.diamantes))
          e(j + ': Diamonds must be MORE than the tier below (every payment creates a batch: it is the refund anchor)');
        for (const k of ['vagas', 'incubadoras', 'meses'])
          if (inteiro(f[k]) && inteiro(d[k]) && f[k] < d[k]) e(j + ': ' + k + ' cannot be less than in the tier below');
        const q = pecasDoNivel(d),
          r = q.filter((p) => !n.includes(p));
        if (r.length) e(j + ': the upper tier includes everything from the one below — missing ' + r.join(', '));
        {
          const a = montariasDoNivel(d),
            b = montariasDoNivel(f),
            s = [
              ...a.normais.filter((x) => !b.normais.includes(x)),
              ...a.shiny.filter((x) => !b.shiny.includes(x)).map((x) => 'shiny:' + x),
            ];
          if (s.length) e(j + ': the upper tier includes all mounts from the one below — missing ' + s.join(', '));
        }
        if (f.termina !== d.termina)
          e(j + ': the deadline (termina) belongs to the pack: all ' + NIVEL_MAX + ' tiers end together');
      }
      d = f;
    }
  } catch (x) {
    c.push('the table failed validation: ' + (x?.message || x));
  }
  return { ok: c.length === 0, erros: c };
}
const compraValida = (a, x) =>
  refDePagamento(a) && obj(x) && inteiro(x.de, 0, NIVEL_MAX - 1) && inteiro(x.para, 1, NIVEL_MAX) && x.para > x.de;
export function cadeiaDeCompras(f) {
  const c = obj(f) && obj(f.compras) ? f.compras : {};
  const d = Object.entries(c)
    .filter(([a, x]) => compraValida(a, x) && !x.estornadoEm)
    .map(([a, x]) => ({ pi: a, de: x.de, para: x.para }));
  const e = obj(f) && obj(f.concessoes) ? f.concessoes : {};
  const g = Object.entries(e)
    .filter(([a, x]) => refDeConcessao(a) && obj(x) && inteiro(x.para, 1, NIVEL_MAX))
    .map(([, x]) => x.para);
  const h = new Set([0, ...g]);
  for (let i = true; i;) {
    i = false;
    for (const v of d)
      if (h.has(v.de) && !h.has(v.para)) {
        h.add(v.para);
        i = true;
      }
  }
  return {
    nivel: Math.max(...h),
    alcancados: [...h].sort((a, b) => a - b),
    orfas: d
      .filter((v) => !h.has(v.de))
      .map((v) => v.pi)
      .sort(),
    validas: d.map((v) => v.pi).sort(),
  };
}
export const nivelDaConta = (f) => cadeiaDeCompras(f).nivel;
const ZERO = Object.freeze({
  id: null,
  nivel: 0,
  nome: null,
  pecas: [],
  montarias: Object.freeze({ normais: Object.freeze([]), shiny: Object.freeze([]) }),
  diamantes: 0,
  vagas: 0,
  incubadoras: 0,
  meses: 0,
  dias: 0,
  titulo: null,
});
export function conteudo(t, n) {
  if (n === 0) return { ...ZERO, pecas: [], montarias: { normais: [], shiny: [] } };
  const a = inteiro(n, 1, NIVEL_MAX) ? nivelDe(t, n) : null;
  if (!a) return null;
  return {
    id: a.id,
    nivel: a.nivel,
    nome: a.nome,
    pecas: pecasDoNivel(a),
    montarias: montariasDoNivel(a),
    diamantes: a.diamantes,
    vagas: a.vagas,
    incubadoras: a.incubadoras,
    meses: a.meses,
    dias: a.dias,
    titulo: a.titulo,
  };
}
export function delta(t, c, d) {
  if (!inteiro(c, 0, NIVEL_MAX) || !inteiro(d, 1, NIVEL_MAX) || d <= c) return null;
  const a = conteudo(t, c),
    b = conteudo(t, d);
  if (!a || !b) return null;
  return {
    de: c,
    para: d,
    pecas: b.pecas.filter((p) => !a.pecas.includes(p)),
    montarias: {
      normais: b.montarias.normais.filter((x) => !a.montarias.normais.includes(x)),
      shiny: b.montarias.shiny.filter((x) => !a.montarias.shiny.includes(x)),
    },
    diamantes: b.diamantes - a.diamantes,
    vagas: b.vagas - a.vagas,
    incubadoras: b.incubadoras - a.incubadoras,
    meses: b.meses - a.meses,
    dias: b.dias - a.dias,
  };
}
export function precoDaCompra(t, c, d, e) {
  if (!MOEDAS.includes(e) || !inteiro(c, 0, NIVEL_MAX) || !inteiro(d, 1, NIVEL_MAX) || d <= c) return null;
  const f = (n) => (n === 0 ? 0 : nivelDe(t, n)?.[e]);
  const a = f(c),
    b = f(d);
  if (!inteiro(a) || !inteiro(b, 1) || b - a < 1) return null;
  return b - a;
}
export function compraDoProduto(a, b) {
  const c = nivelDoId(b);
  if (c === null || !inteiro(a, 0, NIVEL_MAX)) return { ok: false, erro: 'nivel-desconhecido' };
  if (c <= a) return { ok: false, erro: 'ja-e-seu' };
  return { ok: true, de: a, para: c, chave: chaveDoPreco(a, c) };
}
export function chaveDoPreco(a, b) {
  if (!inteiro(a, 0, NIVEL_MAX) || !inteiro(b, 1, NIVEL_MAX) || b <= a) return null;
  if (a === 0) return idDoNivel(b);
  return 'fund-' + NIVEIS[a - 1].letra + '-' + NIVEIS[b - 1].letra;
}
export function pecasRecusadas(t, a) {
  const b = [...new Set(niveisDe(t).flatMap(pecasDoNivel))];
  return b.filter((p) => {
    const l = lerPeca(p);
    if (!l || typeof a !== 'function') return true;
    try {
      return a(l.tipo, l.id) !== true;
    } catch {
      return true;
    }
  });
}
export function estadoDaVenda(t, a) {
  const { agora: b = null } = obj(a) ? a : {};
  const v = validarTabela(t);
  if (!v.ok)
    return {
      aberta: false,
      motivos: ['the pack table is invalid (' + v.erros.length + ' error(s)): ' + v.erros.join('; ')],
    };
  const c = t.niveis
    .filter((a) => Object.hasOwn(a, 'aguardando'))
    .map((a) => 'tier ' + a.nivel + ' (' + a.id + ') has the `aguardando` field');
  const d = t.niveis[0].termina,
    e = typeof b === 'number' && Number.isFinite(b);
  if (d !== null && !e) c.push('the deadline (termina) is set and no time was given to check if it ended');
  else if (d !== null && !(d > b)) c.push('the offer deadline has passed (termina = ' + d + ')');
  return { aberta: c.length === 0, motivos: c };
}
export function ofertasPublicas(t, a) {
  const { nomeDaPeca: b = null, nomeDaMontaria: c = null } = obj(a) ? a : {};
  if (!estadoDaVenda(t, a).aberta) return [];
  const d = (a, c) => {
    if (typeof b !== 'function') return null;
    try {
      const n = b(a, c);
      return typeof n === 'string' && n ? n : null;
    } catch {
      return null;
    }
  };
  return t.niveis.map((a) => ({
    id: a.id,
    nivel: a.nivel,
    nome: a.nome,
    brl: a.brl,
    usd: a.usd,
    termina: a.termina,
    conteudo: {
      pecas: pecasDoNivel(a)
        .map(lerPeca)
        .map((p) => ({ tipo: p.tipo, id: p.id, nome: d(p.tipo, p.id) })),
      montarias: montariasPublicas(a, c),
      diamantes: a.diamantes,
      vagas: a.vagas,
      incubadoras: a.incubadoras,
      meses: a.meses,
      titulo: a.titulo,
    },
  }));
}
export function montariasPublicas(a, b = null) {
  const M = montariasDoNivel(a);
  const c = (a) => {
    if (typeof b !== 'function') return null;
    try {
      const n = b(a);
      return typeof n === 'string' && n ? n : null;
    } catch {
      return null;
    }
  };
  return [
    ...M.normais.map((a) => ({ id: a, shiny: false, nome: c(a) })),
    ...M.shiny.map((a) => ({ id: a, shiny: true, nome: c(a) })),
  ];
}
