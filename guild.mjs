let D = null;
export async function carregar(a = './data/guilda.json', b = fetch) {
  if (D) return D;
  D = await b(a).then((r) => r.json());
  return D;
}
export function usarDados(d) {
  D = d;
  return D;
}
export function dados() {
  return D;
}
const R = () => D.regras;
export const CARGOS = ['lider', 'vice', 'oficial', 'membro', 'recruta'];
export const ENTRADAS = ['aberta', 'aprovacao', 'fechada'];
const NOME_ENTRADA = { aberta: 'Open', aprovacao: 'Approval', fechada: 'Closed' };
export const nomeEntrada = (e) => NOME_ENTRADA[e] || e;
export const cargoDe = (a) => D.cargos.find((c) => c.id === a) || null;
export const nomeCargo = (a) => cargoDe(a)?.nome || a;
const posto = (a) => CARGOS.indexOf(a);
export const acima = (a, b) => posto(a) >= 0 && posto(b) >= 0 && posto(a) < posto(b);
const HORA = 3600e3,
  DIA = 24 * HORA;
export const chave = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const limpo = (s) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function validarNome(a) {
  const n = limpo(a),
    { min: b, max: c } = R().nome;
  if (n.length < b || n.length > c) return { ok: false, erro: 'The name must have from ' + b + ' a ' + c + ' letras.' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(n))
    return { ok: false, erro: 'Use only letters, numbers, spaces, hyphens and apostrophes in the name.' };
  return { ok: true, valor: n };
}
export function validarTag(a) {
  const t = limpo(a).toUpperCase(),
    { min: b, max: c } = R().tag;
  if (!new RegExp('^[A-Z0-9]{' + b + ',' + c + '}$').test(t))
    return { ok: false, erro: 'The TAG must be ' + b + ' ou ' + c + ' letters or numbers, no accents.' };
  return { ok: true, valor: t };
}
export function validarDescricao(a) {
  const d = limpo(a);
  if (d.length > R().descricaoMax)
    return { ok: false, erro: 'The description exceeds ' + R().descricaoMax + ' letras.' };
  return { ok: true, valor: d };
}
const listaDe = (k) => (Array.isArray(D?.[k]) ? D[k] : []);
const temId = (k, a) => typeof a === 'string' && listaDe(k).some((x) => x.id === a);
const antigoDe = (a) =>
  typeof a === 'string' && D?.antigos && typeof D.antigos === 'object' && Object.hasOwn(D.antigos, a)
    ? D.antigos[a]
    : null;
const formaPadrao = () =>
  temId('formas', D?.emblema?.formaPadrao) ? D.emblema.formaPadrao : (listaDe('formas')[0]?.id ?? null);
export const ERRO_EMBLEMA = "That emblem doesn't exist: pick a shape, color and symbol from the list.";
export function emblemaPadrao() {
  return {
    forma: listaDe('formas')[0]?.id ?? null,
    cor: listaDe('cores')[0]?.id ?? null,
    simbolo: listaDe('simbolos')[0]?.id ?? null,
  };
}
export function validarEmblema(e) {
  const o = e && typeof e === 'object' && !Array.isArray(e) ? e : {},
    a = antigoDe(o.simbolo);
  const b = temId('formas', o.forma) ? o.forma : temId('formas', a?.forma) ? a.forma : formaPadrao();
  const c = temId('simbolos', o.simbolo)
    ? o.simbolo
    : temId('simbolos', a?.simbolo)
      ? a.simbolo
      : (listaDe('simbolos')[0]?.id ?? null);
  const d = temId('cores', o.cor) ? o.cor : (listaDe('cores')[0]?.id ?? null);
  return { forma: b, cor: d, simbolo: c };
}
export function emblemaDoPedido(e) {
  if (e == null) return { ok: true, valor: emblemaPadrao() };
  const a = { ok: false, erro: ERRO_EMBLEMA };
  if (typeof e !== 'object' || Array.isArray(e)) return a;
  if (!temId('simbolos', e.simbolo) && !antigoDe(e.simbolo)) return a;
  if (!temId('cores', e.cor)) return a;
  if (e.forma != null && !temId('formas', e.forma)) return a;
  return { ok: true, valor: validarEmblema(e) };
}
const mesmoEmblema = (a, b) => !!a && !!b && a.forma === b.forma && a.cor === b.cor && a.simbolo === b.simbolo;
export function quando(a, b) {
  const d = Math.max(0, b - a);
  if (d < 60e3) return 'agora';
  if (d < HORA) return '~ ' + Math.floor(d / 60e3) + 'min';
  if (d < DIA) return '~ ' + Math.floor(d / HORA) + 'h';
  if (d < 2 * DIA) return 'ontem';
  return '~ ' + Math.floor(d / DIA) + 'd';
}
export const COR_ATIVIDADE = {
  criada: 'verde',
  entrou: 'verde',
  promovido: 'ciano',
  rebaixado: 'ciano',
  lider: 'ciano',
  destituido: 'ciano',
  editou: 'ciano',
  aviso: 'ciano',
  raid: 'laranja',
  doou: 'laranja',
  nivel: 'laranja',
  xp: 'laranja',
  saiu: 'cinza',
  dissolvida: 'cinza',
  expulso: 'vermelho',
  chefe: 'laranja',
  chefeMeta: 'laranja',
  construiu: 'ciano',
  semana: 'laranja',
  loja: 'laranja',
  equipe: 'vermelho',
  apagada: 'cinza',
};
export function textoAtividade(a, b = (u) => u) {
  const q = b(a.quem),
    c = a.alvo ? b(a.alvo) : '';
  switch (a.tipo) {
    case 'criada':
      return q + ' founded the guild';
    case 'entrou':
      return q + ' joined the guild';
    case 'saiu':
      return q + ' left the guild';
    case 'apagada':
      return (a.extra || '?') + ' left the guild' + (a.alvo ? ' e ' + c + ' took over leadership' : '');
    case 'expulso':
      return q + ' expulsou ' + c;
    case 'promovido':
      return q + ' promoveu ' + c + ' a ' + nomeCargo(a.extra);
    case 'rebaixado':
      return q + ' mudou ' + c + ' pra ' + nomeCargo(a.extra);
    case 'lider':
      return q + ' passed leadership to ' + c;
    case 'destituido':
      return c + ' took over leadership (' + q + ' was gone for ' + a.extra + ' days)';
    case 'aviso':
      return q + ' changed the notice';
    case 'editou':
      return q + ' mudou ' + a.extra;
    case 'nivel':
      return 'the guild reached level ' + a.extra + '!';
    case 'raid':
      return a.extra;
    case 'xp':
      return a.extra;
    case 'doou':
      return q + ' doou ' + a.extra + ' to the guild';
    case 'chefe':
    case 'chefeMeta':
    case 'semana':
      return a.extra;
    case 'construiu':
      return q + ' construiu ' + a.extra;
    case 'loja':
      return q + ' trocou ' + a.extra + ' in the guild shop';
    case 'equipe':
      return 'the team changed ' + a.extra;
    default:
      return a.extra || a.tipo;
  }
}
export function chaveSemana(a) {
  const x = new Date(a - 3 * HORA),
    b = (x.getUTCDay() + 6) % 7;
  const c = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - b);
  const q = new Date(c + 3 * DIA),
    d = q.getUTCFullYear(),
    e = Date.UTC(d, 0, 4),
    f = (new Date(e).getUTCDay() + 6) % 7;
  const g = 1 + Math.round((c - (e - f * DIA)) / (7 * DIA));
  return d + '-S' + String(g).padStart(2, '0');
}
export function nivelInfo(a) {
  return D.niveis.find((n) => n.nivel === a) || D.niveis[0];
}
export function nivelDeXp(a) {
  let b = 1,
    c = Math.max(0, a | 0);
  for (const n of D.niveis) {
    if (!n.xpProximo || c < n.xpProximo) {
      b = n.nivel;
      break;
    }
    c -= n.xpProximo;
    b = n.nivel + 1;
  }
  const d = nivelInfo(Math.min(b, D.niveis.length));
  return { nivel: d.nivel, xpNoNivel: d.xpProximo ? c : 0, xpProximo: d.xpProximo };
}
export function fonte(a) {
  return (D.fontes || []).find((f) => f.id === a) || null;
}
export function beneficiosDe(a) {
  return (D.beneficios || []).filter((b) => b.nivel <= a);
}
export function proximoBeneficio(a) {
  return (D.beneficios || []).find((b) => b.nivel > a) || null;
}
export function bonusXpGrupo(a) {
  return beneficiosDe(a).reduce((m, b) => Math.max(m, b.xpGrupo || 0), 0);
}
export function anunciosExtras(a) {
  return beneficiosDe(a).reduce((m, b) => Math.max(m, b.anuncios || 0), 0);
}
export const DIA_ZERO = Date.UTC(2026, 9, 5, 3);
export function chaveDia(a) {
  const x = new Date(a - 3 * HORA);
  return (
    x.getUTCFullYear() +
    '-' +
    String(x.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(x.getUTCDate()).padStart(2, '0')
  );
}
export function fimDaSemana(a) {
  const x = new Date(a - 3 * HORA),
    b = (x.getUTCDay() + 6) % 7;
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - b + 7) + 3 * HORA;
}
export function degrauDoChefe(n) {
  const e = D.chefe?.escada || [];
  return n >= 1 && n <= e.length ? e[n - 1] : null;
}
export function degrauMaxDe(a) {
  const e = D.chefe?.escada || [];
  return Math.min(e.length, Math.max(1, (a | 0) * (D.chefe?.regras?.degrausPorNivel || 2)));
}
export function fatorTipoChefe(a, b) {
  const r = D.chefe?.regras || {};
  if (!a?.tipos || !b) return 1;
  if (a.tipos.mais.includes(b)) return r.tiposMais || 1.5;
  if (a.tipos.menos.includes(b)) return r.tiposMenos || 0.5;
  return 1;
}
export function proximoDaVaga(v, a = 0) {
  if (!v) return null;
  if (v.niveis) {
    const p = v.niveis[a];
    return p ? { n: a + 1, nivel: p.nivel, custo: p.custo } : null;
  }
  return a ? null : { n: 1, nivel: v.nivel, custo: v.custo };
}
export function pecasDe(a, b = {}) {
  const c = [];
  for (const v of a?.vagas || []) {
    const n = b[v.id] || 0;
    if (!n) continue;
    const d = v.niveis ? v.niveis[Math.min(n, v.niveis.length) - 1]?.pecas || [] : v.pecas;
    for (const p of d) c.push({ ...p, vaga: v.id });
  }
  return c;
}
export const pecasDaBase = (a) => pecasDe(D.base, a);
export const pecasDaCasa = (a) => pecasDe(D.casa, a);
export function regioesAbertas(a) {
  return (D.base?.regioes || []).filter((r) => r.nivel <= a);
}
export function semanasPorNivel(a) {
  let b = 0;
  const c = [];
  for (const n of D.niveis) {
    if (!n.xpProximo) break;
    b += n.xpProximo;
    c.push({ nivel: n.nivel + 1, semanas: a > 0 ? +(b / a).toFixed(1) : Infinity });
  }
  return c;
}
export function permissoesDe(g, a) {
  const b = cargoDe(a)?.padrao || {};
  if (a === 'lider') return Object.fromEntries(D.permissoes.map((p) => [p.id, true]));
  return { ...b, ...(g.perms?.[a] || {}) };
}
export function pode(g, a, b, d = null) {
  if (!a) return false;
  const c = cargoDe(a),
    p = permissoesDe(g, a);
  switch (b) {
    case 'convidar':
    case 'aceitar':
    case 'aviso':
    case 'evento':
    case 'bau':
      return !!p[b];
    case 'expulsar':
      return !!p.expulsar && (d == null || acima(a, d));
    case 'promover':
    case 'rebaixar':
      return (c?.muda || []).length > 0 && (d == null || (c.muda.includes(d) && acima(a, d)));
    case 'gerenciar':
      return !!c?.gerencia;
    case 'lideranca':
    case 'dissolver':
    case 'permissoes':
      return a === 'lider';
    default:
      return false;
  }
}
export const mapaLivre = (o = null) => {
  const m = Object.create(null);
  if (o && typeof o === 'object' && !Array.isArray(o)) for (const k of Object.keys(o)) m[k] = o[k];
  return m;
};
const proprio = (o, k) => (o != null && k != null && Object.hasOwn(o, String(k)) ? o[String(k)] : undefined);
function semProtoNoLivro(d) {
  d.guildas = mapaLivre(d.guildas);
  d.jogadores = mapaLivre(d.jogadores);
  for (const g of Object.values(d.guildas)) {
    if (!g || typeof g !== 'object') continue;
    g.membros = mapaLivre(g.membros);
    g.perms = mapaLivre(g.perms);
    if (g.chefe && typeof g.chefe === 'object')
      for (const k of ['contrib', 'janelas', 'entradas', 'nEntradas']) g.chefe[k] = mapaLivre(g.chefe[k]);
    if (g.loja && typeof g.loja === 'object') g.loja.compras = mapaLivre(g.loja.compras);
  }
  return d;
}
export function livroVazio() {
  return { versao: 1, prox: 1, guildas: mapaLivre(), jogadores: mapaLivre() };
}
export class Livro {
  constructor(a, b) {
    this.dados = semProtoNoLivro(a || livroVazio());
    this.amb = b;
  }
  migrarEmblemas() {
    if (!listaDe('formas').length || !listaDe('simbolos').length || !listaDe('cores').length) return 0;
    let n = 0;
    for (const g of Object.values(this.dados.guildas)) {
      if (!g || typeof g !== 'object') continue;
      const a = g.emblema,
        e = validarEmblema(a);
      if (!(a && typeof a === 'object' && !Array.isArray(a) && mesmoEmblema(a, e) && Object.keys(a).length === 3)) {
        g.emblema = e;
        n++;
      }
    }
    return n;
  }
  jogador(u) {
    return (
      proprio(this.dados.jogadores, u) ||
      (this.dados.jogadores[String(u)] = { guilda: null, saiuEm: null, convites: [], pedidos: [] })
    );
  }
  guilda(a) {
    return proprio(this.dados.guildas, a) || null;
  }
  guildaDe(u) {
    const a = proprio(this.dados.jogadores, u)?.guilda;
    return a ? this.guilda(a) : null;
  }
  cargoDe(u) {
    return proprio(this.guildaDe(u)?.membros, u)?.cargo || null;
  }
  nick(u) {
    return this.amb.conta(u)?.nick || u;
  }
  idDe(u) {
    return u == null ? null : typeof this.amb.id === 'function' ? this.amb.id(u) : u;
  }
  _alvo(a, b) {
    const x = a?.id ?? a?.usuario;
    if (x == null || x === '') return null;
    return (b || []).find((u) => this.idDe(u) === String(x)) || null;
  }
  contar(g, a) {
    return Object.values(g.membros).filter((m) => m.cargo === a).length;
  }
  total(g) {
    return Object.keys(g.membros).length;
  }
  vagas(g) {
    return nivelInfo(g.nivel).vagas;
  }
  liderDe(g) {
    return Object.keys(g.membros).find((u) => g.membros[u].cargo === 'lider') || null;
  }
  esperaAte(u) {
    const s = proprio(this.dados.jogadores, u)?.saiuEm;
    return s ? s + R().esperaSairHoras * HORA : 0;
  }
  ranking() {
    return Object.values(this.dados.guildas)
      .sort((a, b) => (b.semana?.pts || 0) - (a.semana?.pts || 0) || b.nivel - a.nivel || a.criadaEm - b.criadaEm)
      .map((g) => g.id);
  }
  podeFundar(u) {
    return { ...this._podeFundar(u), custo: R().custo, insigniasMin: R().insigniasMin };
  }
  _podeFundar(u) {
    const c = this.amb.conta(u),
      a = this.amb.agora();
    if (!c) return { ok: false, motivo: 'Sign in with an account to found a guild.' };
    if (this.guildaDe(u)) return { ok: false, motivo: "You're already in a guild." };
    if (a < this.esperaAte(u))
      return {
        ok: false,
        motivo: 'You left a guild recently: wait ' + Math.ceil((this.esperaAte(u) - a) / HORA) + 'h.',
      };
    if ((c.insignias || 0) < R().insigniasMin)
      return {
        ok: false,
        motivo: 'Founding requires ' + R().insigniasMin + (R().insigniasMin === 1 ? ' badge' : ' badges') + '.',
      };
    if ((c.dinheiro || 0) < R().custo)
      return {
        ok: false,
        motivo: 'Short by ' + (R().custo - (c.dinheiro || 0)).toLocaleString('pt-BR') + ' ₽ to found it.',
      };
    return { ok: true, motivo: '' };
  }
  executar(u, b, a = {}) {
    const f = this['op_' + b];
    if (typeof f !== 'function') return { ok: false, erro: 'Unknown operation.', tocados: [] };
    if (!this.amb.conta(u)) return { ok: false, erro: 'Sign in to an account to use guilds.', tocados: [] };
    try {
      return f.call(this, u, a || {}) || { ok: false, erro: 'No response.', tocados: [] };
    } catch (e) {
      return { ok: false, erro: String(e?.message || e), tocados: [] };
    }
  }
  _erro(t) {
    return { ok: false, erro: t, tocados: [] };
  }
  _ok(g, a = {}) {
    return { ok: true, tocados: g ? Object.keys(g.membros) : [], ...a };
  }
  _registrar(g, a, b, c = null, d = null) {
    g.atividade.unshift({ tipo: a, quem: b, alvo: c, extra: d, quando: this.amb.agora() });
    if (g.atividade.length > R().atividadeGuardada) g.atividade.length = R().atividadeGuardada;
  }
  _entrarComo(g, u, a) {
    const j = this.jogador(u),
      b = this.amb.agora();
    for (const c of j.pedidos) {
      const o = this.guilda(c);
      if (o) o.pedidos = o.pedidos.filter((p) => p.usuario !== u);
    }
    j.pedidos = [];
    j.convites = [];
    j.guilda = g.id;
    g.membros[u] = { cargo: a, desde: b, pts: 0, ptsSemana: 0 };
    g.pedidos = g.pedidos.filter((p) => p.usuario !== u);
  }
  _sairDa(g, u, a) {
    delete g.membros[u];
    const j = this.jogador(u);
    j.guilda = null;
    if (a) j.saiuEm = this.amb.agora();
  }
  _podeEntrarAgora(u) {
    const a = this.amb.agora();
    if (this.guildaDe(u)) return "You're already in a guild.";
    if (a < this.esperaAte(u))
      return 'You left a guild recently: you can join another in ' + Math.ceil((this.esperaAte(u) - a) / HORA) + 'h.';
    return null;
  }
  op_criar(u, a) {
    const b = this.podeFundar(u);
    if (!b.ok) return this._erro(b.motivo);
    const n = validarNome(a.nome);
    if (!n.ok) return this._erro(n.erro);
    const t = validarTag(a.tag);
    if (!t.ok) return this._erro(t.erro);
    const d = validarDescricao(a.desc);
    if (!d.ok) return this._erro(d.erro);
    const c = emblemaDoPedido(a.emblema);
    if (!c.ok) return this._erro(c.erro);
    for (const g of Object.values(this.dados.guildas)) {
      if (chave(g.nome) === chave(n.valor)) return this._erro('A guild with that name already exists.');
      if (g.tag === t.valor) return this._erro('A TAG [' + t.valor + '] already belongs to another guild.');
    }
    if (!this.amb.cobrar(u, R().custo)) return this._erro('Not enough money to found it.');
    const e = this.amb.agora(),
      f = 'g' + this.dados.prox++;
    const g = (this.dados.guildas[f] = {
      id: f,
      nome: n.valor,
      tag: t.valor,
      desc: d.valor,
      emblema: c.valor,
      entrada: ENTRADAS.includes(a.entrada) ? a.entrada : 'aberta',
      nivelMin: D.nivelMinimo.includes(+a.nivelMin) ? +a.nivelMin : 0,
      criadaEm: e,
      xp: 0,
      nivel: 1,
      semana: { chave: chaveSemana(e), pts: 0 },
      membros: mapaLivre(),
      perms: mapaLivre(),
      pedidos: [],
      aviso: null,
      atividade: [],
      chat: [],
    });
    this._entrarComo(g, u, 'lider');
    this._registrar(g, 'criada', u);
    return this._ok(g, { guilda: f });
  }
  op_entrar(u, a) {
    const g = this.guilda(a.guilda);
    if (!g) return this._erro('This guild no longer exists.');
    const b = this._podeEntrarAgora(u);
    if (b) return this._erro(b);
    if (g.entrada !== 'aberta')
      return this._erro(g.entrada === 'aprovacao' ? 'This guild is request-only.' : 'This guild is invite-only.');
    if (this.total(g) >= this.vagas(g)) return this._erro('The guild is full.');
    if ((this.amb.conta(u).lv || 0) < g.nivelMin)
      return this._erro('This guild requires Lv ' + g.nivelMin + ' or higher.');
    this._entrarComo(g, u, 'recruta');
    this._registrar(g, 'entrou', u);
    return this._ok(g);
  }
  op_pedir(u, a) {
    const g = this.guilda(a.guilda);
    if (!g) return this._erro('This guild no longer exists.');
    const b = this._podeEntrarAgora(u);
    if (b) return this._erro(b);
    if (g.entrada !== 'aprovacao')
      return this._erro(g.entrada === 'aberta' ? 'This guild is open: just join.' : 'This guild is invite-only.');
    if (this.total(g) >= this.vagas(g)) return this._erro('The guild is full.');
    if ((this.amb.conta(u).lv || 0) < g.nivelMin)
      return this._erro('This guild requires Lv ' + g.nivelMin + ' or higher.');
    const j = this.jogador(u);
    if (j.pedidos.includes(g.id)) return this._erro('You already asked to join this guild.');
    if (j.pedidos.length >= R().pedidosPorJogador)
      return this._erro('You already have ' + R().pedidosPorJogador + ' pending requests.');
    if (g.pedidos.length >= R().pedidosPorGuilda)
      return this._erro('This guild has too many pending requests. Try again later.');
    j.pedidos.push(g.id);
    g.pedidos.push({ usuario: u, quando: this.amb.agora() });
    return { ok: true, tocados: [u, ...Object.keys(g.membros).filter((m) => pode(g, g.membros[m].cargo, 'aceitar'))] };
  }
  op_cancelarPedido(u, a) {
    const g = this.guilda(a.guilda),
      j = this.jogador(u);
    j.pedidos = j.pedidos.filter((x) => x !== a.guilda);
    if (g) g.pedidos = g.pedidos.filter((p) => p.usuario !== u);
    return { ok: true, tocados: [u, ...(g ? Object.keys(g.membros) : [])] };
  }
  op_aceitarPedido(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (!pode(g, g.membros[u].cargo, 'aceitar')) return this._erro("Your role can't accept requests.");
    const b = this._alvo(
        a,
        g.pedidos.map((x) => x.usuario),
      ),
      p = b ? g.pedidos.find((x) => x.usuario === b) : null;
    if (!p) return this._erro('That request is no longer in the queue.');
    const c = this._podeEntrarAgora(b);
    if (c) {
      g.pedidos = g.pedidos.filter((x) => x !== p);
      this.jogador(b).pedidos = this.jogador(b).pedidos.filter((x) => x !== g.id);
      return {
        ok: false,
        erro: this.nick(b) + " can't join right now (already joined another or left recently).",
        tocados: Object.keys(g.membros),
      };
    }
    if (this.total(g) >= this.vagas(g)) return this._erro('The guild is full.');
    this._entrarComo(g, b, 'recruta');
    this._registrar(g, 'entrou', b);
    return this._ok(g);
  }
  op_recusarPedido(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (!pode(g, g.membros[u].cargo, 'aceitar')) return this._erro("Your role can't decline requests.");
    const b = this._alvo(
      a,
      g.pedidos.map((x) => x.usuario),
    );
    if (!b) return { ok: true, tocados: Object.keys(g.membros) };
    g.pedidos = g.pedidos.filter((x) => x.usuario !== b);
    const j = this.jogador(b);
    j.pedidos = j.pedidos.filter((x) => x !== g.id);
    return { ok: true, tocados: [...Object.keys(g.membros), b] };
  }
  op_convidar(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (!pode(g, g.membros[u].cargo, 'convidar')) return this._erro("Your role can't invite.");
    const b = this.amb.porNick(limpo(a.nick));
    if (!b) return this._erro("Couldn't find a trainer with that exact name.");
    if (b === u) return this._erro("That's you.");
    if (this.guildaDe(b)) return this._erro(this.nick(b) + ' is already in a guild.');
    if (this.total(g) >= this.vagas(g)) return this._erro('The guild is full.');
    const j = this.jogador(b);
    if (j.convites.some((c) => c.guilda === g.id)) return this._erro(this.nick(b) + ' already has a guild invite.');
    j.convites.push({ guilda: g.id, por: u, quando: this.amb.agora() });
    return { ok: true, tocados: [b], convidado: this.nick(b) };
  }
  op_aceitarConvite(u, a) {
    const j = this.jogador(u),
      c = j.convites.find((x) => x.guilda === a.guilda);
    if (!c) return this._erro('That invite is no longer valid.');
    const g = this.guilda(a.guilda);
    if (!g) {
      j.convites = j.convites.filter((x) => x !== c);
      return this._erro('This guild no longer exists.');
    }
    const b = this._podeEntrarAgora(u);
    if (b) return this._erro(b);
    if (this.total(g) >= this.vagas(g)) return this._erro('The guild is full.');
    this._entrarComo(g, u, 'recruta');
    this._registrar(g, 'entrou', u);
    return this._ok(g);
  }
  op_recusarConvite(u, a) {
    const j = this.jogador(u);
    j.convites = j.convites.filter((x) => x.guilda !== a.guilda);
    return { ok: true, tocados: [u] };
  }
  op_sair(u) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (g.membros[u].cargo === 'lider') {
      if (this.total(g) > 1) return this._erro('Pass leadership before leaving.');
      return this.op_dissolver(u);
    }
    const a = Object.keys(g.membros);
    this._sairDa(g, u, true);
    this._registrar(g, 'saiu', u);
    return { ok: true, tocados: a };
  }
  op_expulsar(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    const b = this._alvo(a, Object.keys(g.membros)),
      c = b ? g.membros[b] : null;
    if (!c) return this._erro("That trainer isn't in the guild.");
    if (!pode(g, g.membros[u].cargo, 'expulsar', c.cargo))
      return this._erro("You can't kick a " + nomeCargo(c.cargo) + '.');
    const d = Object.keys(g.membros);
    this._sairDa(g, b, true);
    this._registrar(g, 'expulso', u, b);
    return { ok: true, tocados: d };
  }
  op_promover(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    const b = this._alvo(a, Object.keys(g.membros)),
      m = b ? g.membros[b] : null;
    if (!m) return this._erro("That trainer isn't in the guild.");
    const c = g.membros[u].cargo;
    if (m.cargo === 'vice' && c === 'lider') return this._erro('To make a Vice the Leader, pass leadership.');
    if (!pode(g, c, 'promover', m.cargo)) return this._erro("You can't promote a " + nomeCargo(m.cargo) + '.');
    const d = CARGOS[posto(m.cargo) - 1];
    if (!acima(c, d)) return this._erro('You can only promote up to one rank below yours.');
    const e = nivelInfo(g.nivel),
      f = { vice: e.vices, oficial: e.oficiais }[d];
    if (f != null && this.contar(g, d) >= f)
      return this._erro('The guild already has ' + f + ' ' + (d === 'vice' ? 'Vices' : 'Officers') + '.');
    m.cargo = d;
    this._registrar(g, 'promovido', u, b, d);
    return this._ok(g);
  }
  op_rebaixar(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    const b = this._alvo(a, Object.keys(g.membros)),
      m = b ? g.membros[b] : null;
    if (!m) return this._erro("That trainer isn't in the guild.");
    if (!pode(g, g.membros[u].cargo, 'rebaixar', m.cargo))
      return this._erro("You can't change the role of a " + nomeCargo(m.cargo) + '.');
    if (m.cargo === 'recruta') return this._erro('Recruit is already the lowest rank.');
    const c = CARGOS[posto(m.cargo) + 1];
    m.cargo = c;
    this._registrar(g, 'rebaixado', u, b, c);
    return this._ok(g);
  }
  op_passarLideranca(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (g.membros[u].cargo !== 'lider') return this._erro('Only the leader can pass on leadership.');
    const b = this._alvo(a, Object.keys(g.membros)),
      m = b ? g.membros[b] : null;
    if (!m || b === u) return this._erro('Pick another guild member.');
    const c = m.cargo;
    m.cargo = 'lider';
    const d = nivelInfo(g.nivel);
    g.membros[u].cargo =
      c === 'vice' || this.contar(g, 'vice') < d.vices
        ? 'vice'
        : this.contar(g, 'oficial') < d.oficiais
          ? 'oficial'
          : 'membro';
    this._registrar(g, 'lider', u, b);
    return this._ok(g);
  }
  op_dissolver(u) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (g.membros[u].cargo !== 'lider') return this._erro('Only the leader can disband the guild.');
    const a = Object.keys(g.membros);
    for (const m of a) this._sairDa(g, m, m === u);
    for (const p of g.pedidos) {
      const j = this.jogador(p.usuario);
      j.pedidos = j.pedidos.filter((x) => x !== g.id);
    }
    for (const j of Object.values(this.dados.jogadores)) j.convites = j.convites.filter((c) => c.guilda !== g.id);
    const b = this._premiosAoDissolver(g);
    delete this.dados.guildas[g.id];
    return { ok: true, tocados: a, dissolvida: g.nome, premios: b };
  }
  contaApagada(u, a = null) {
    const k = String(u ?? ''),
      j = proprio(this.dados.jogadores, k),
      g = this.guildaDe(k),
      b = new Set();
    let d = false,
      e = null,
      f = null,
      h = [];
    for (const i of j?.pedidos || []) {
      const o = this.guilda(i);
      if (o && o.pedidos.some((p) => p.usuario === k)) {
        o.pedidos = o.pedidos.filter((p) => p.usuario !== k);
        d = true;
      }
    }
    if (g && proprio(g.membros, k)) {
      const l = Object.keys(g.membros).filter((m) => m !== k);
      for (const m of l) b.add(m);
      if (g.membros[k].cargo === 'lider' && !l.length) {
        for (const p of g.pedidos) {
          const n = proprio(this.dados.jogadores, p.usuario);
          if (n) n.pedidos = n.pedidos.filter((x) => x !== g.id);
        }
        for (const x of Object.values(this.dados.jogadores))
          x.convites = (x.convites || []).filter((c) => c.guilda !== g.id);
        h = this._premiosAoDissolver(g);
        delete this.dados.guildas[g.id];
        f = g.nome;
      } else {
        if (g.membros[k].cargo === 'lider') {
          e = this.sucessor(g);
          if (e) g.membros[e].cargo = 'lider';
        }
        delete g.membros[k];
        this._registrar(
          g,
          'apagada',
          null,
          e,
          String(a || '')
            .trim()
            .slice(0, 24) || null,
        );
      }
      d = true;
    }
    if (j) {
      delete this.dados.jogadores[k];
      d = true;
    }
    return {
      mudou: d,
      guilda: g ? { id: g.id, tag: g.tag, nome: g.nome } : null,
      novoLider: e,
      dissolvida: f,
      premios: h,
      tocados: [...b],
    };
  }
  op_editar(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (!pode(g, g.membros[u].cargo, 'gerenciar')) return this._erro('Only the Leader and Vice can change the guild.');
    const b = [];
    let c = null;
    if (a.emblema != null) {
      c = emblemaDoPedido(a.emblema);
      if (!c.ok) return this._erro(c.erro);
    }
    if (a.desc != null) {
      const d = validarDescricao(a.desc);
      if (!d.ok) return this._erro(d.erro);
      if (d.valor !== g.desc) {
        g.desc = d.valor;
        b.push('the description');
      }
    }
    if (a.entrada != null && ENTRADAS.includes(a.entrada) && a.entrada !== g.entrada) {
      g.entrada = a.entrada;
      b.push('the entry to ' + nomeEntrada(a.entrada));
    }
    if (a.nivelMin != null && D.nivelMinimo.includes(+a.nivelMin) && +a.nivelMin !== g.nivelMin) {
      g.nivelMin = +a.nivelMin;
      b.push('minimum level to ' + g.nivelMin);
    }
    if (c && !mesmoEmblema(c.valor, g.emblema)) {
      g.emblema = c.valor;
      b.push('o emblema');
    }
    if (!b.length) return this._ok(g, { nada: true });
    this._registrar(g, 'editou', u, null, b.join(', '));
    return this._ok(g);
  }
  staffRenomear(b, a = {}) {
    const g = this.guilda(b);
    if (!g) return this._erro('This guild no longer exists.');
    const c = [],
      d = Object.values(this.dados.guildas).filter((o) => o !== g);
    if (a.nome != null) {
      const n = validarNome(a.nome);
      if (!n.ok) return this._erro(n.erro);
      if (d.some((o) => chave(o.nome) === chave(n.valor))) return this._erro('A guild with that name already exists.');
      if (n.valor !== g.nome) {
        g.nome = n.valor;
        c.push('the name to "' + n.valor + '"');
      }
    }
    if (a.tag != null) {
      const t = validarTag(a.tag);
      if (!t.ok) return this._erro(t.erro);
      if (d.some((o) => o.tag === t.valor))
        return this._erro('A TAG [' + t.valor + '] already belongs to another guild.');
      if (t.valor !== g.tag) {
        g.tag = t.valor;
        c.push('the TAG to [' + t.valor + ']');
      }
    }
    if (!c.length) return this._ok(g, { nada: true });
    this._registrar(g, 'equipe', null, null, c.join(' e '));
    return this._ok(g, { mudou: c });
  }
  op_aviso(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (!pode(g, g.membros[u].cargo, 'aviso')) return this._erro("Your role can't change the notice.");
    const t = limpo(a.texto).slice(0, R().avisoMax);
    g.aviso = t ? { texto: t, autor: u, quando: this.amb.agora() } : null;
    this._registrar(g, 'aviso', u);
    return this._ok(g);
  }
  op_permissao(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (g.membros[u].cargo !== 'lider') return this._erro('Only the leader can change permissions.');
    if (!CARGOS.includes(a.cargo) || a.cargo === 'lider') return this._erro('The leader can do everything.');
    if (!D.permissoes.some((p) => p.id === a.perm)) return this._erro('Unknown permission.');
    (g.perms[a.cargo] ||= {})[a.perm] = !!a.ligado;
    return this._ok(g);
  }
  op_mensagem(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    const t = limpo(a.texto).slice(0, R().mensagemMax);
    if (!t) return this._erro('Empty message.');
    const b = { de: u, texto: t, quando: this.amb.agora() };
    g.chat.push(b);
    if (g.chat.length > R().chatGuardado) g.chat.splice(0, g.chat.length - R().chatGuardado);
    return {
      ok: true,
      tocados: [],
      chat: { ...b, de: this.idDe(u), nick: this.nick(u), guilda: g.id },
      para: Object.keys(g.membros),
    };
  }
  ganharXp(a, b, c = null) {
    const g = this.guilda(a);
    if (!g || !(b > 0)) return [];
    const d = g.nivel;
    g.xp += Math.round(b);
    g.nivel = nivelDeXp(g.xp).nivel;
    if (c) this._registrar(g, 'xp', null, null, c);
    if (g.nivel > d) this._registrar(g, 'nivel', null, null, g.nivel);
    return Object.keys(g.membros);
  }
  pontuar(u, a) {
    const g = this.guildaDe(u);
    if (!g || !(a > 0)) return [];
    this._virarSemanaTodas();
    const m = g.membros[u];
    m.pts += a;
    m.ptsSemana += a;
    g.semana.pts += a;
    return Object.keys(g.membros);
  }
  _virarSemanaTodas() {
    const a = this.amb.agora(),
      k = chaveSemana(a),
      b = Object.values(this.dados.guildas).filter((g) => g.semana?.chave !== k);
    if (!b.length) return [];
    const c = this.ranking(),
      d = new Set(),
      e = D.ranking?.titulo || null;
    for (const g of b) {
      const f = c.indexOf(g.id) + 1,
        h = g.semana?.pts || 0;
      g.semanaPassada = { chave: g.semana?.chave || null, pts: h, posicao: f, membros: this.total(g) };
      if (h > 0) {
        const i = f === 1 && !!e;
        this._registrar(
          g,
          'semana',
          null,
          null,
          i
            ? 'the guild finished the week 1st in Kanto: title "' + e.nome + '" for everyone!'
            : 'the guild finished the week at #' + f + ' in Kanto (' + h.toLocaleString('pt-BR') + ' pts)',
        );
        if (i) g.titulo = { id: e.id, nome: e.nome, ate: a + e.dias * DIA, semana: g.semana?.chave || null };
      }
      g.semana = { chave: k, pts: 0 };
      for (const m of Object.values(g.membros)) m.ptsSemana = 0;
      for (const m of Object.keys(g.membros)) d.add(m);
    }
    return [...d];
  }
  evento(u, a = {}) {
    const g = this.guildaDe(u),
      f = fonte(a.tipo);
    if (!g || !f) return { ok: false, motivo: !g ? 'no guild' : 'unknown source', xp: 0, pts: 0, tocados: [] };
    const m = g.membros[u],
      b = Math.max(0, +a.qtd || 1);
    if (!(b > 0)) return { ok: false, motivo: 'qtd', xp: 0, pts: 0, tocados: [] };
    const c = chaveDia(this.amb.agora());
    if (!m.cotas || m.cotas.dia !== c) m.cotas = { dia: c, n: {} };
    let d = b;
    if (f.cotaDia != null) {
      const j = m.cotas.n[f.id] || 0;
      d = Math.max(0, Math.min(b, f.cotaDia - j));
      m.cotas.n[f.id] = j + d;
    }
    if (!(d > 0)) return { ok: true, xp: 0, pts: 0, cota: true, tocados: [] };
    const e = Math.round(f.xp * d),
      h = Math.round(f.pts * d);
    const i = new Set(this.ganharXp(g.id, e, a.texto || null));
    for (const t of this.pontuar(u, h)) i.add(t);
    return { ok: true, xp: e, pts: h, cota: d < b, tocados: [...i] };
  }
  tique() {
    const a = this.amb.agora(),
      b = new Set();
    for (const u of this._virarSemanaTodas()) b.add(u);
    for (const g of Object.values(this.dados.guildas)) {
      if (g.chefe) {
        const e = g.chefe.dia;
        this._virarDiaChefe(g);
        if (g.chefe.dia !== e) for (const m of Object.keys(g.membros)) b.add(m);
      }
      const d = this.liderDe(g),
        c = d && this.amb.conta(d);
      if (d && c && !c.online && c.vistoEm && a - c.vistoEm > R().liderSumidoDias * DIA && this.total(g) > 1) {
        const f = this.sucessor(g);
        if (f) {
          g.membros[f].cargo = 'lider';
          g.membros[d].cargo = 'membro';
          this._registrar(g, 'destituido', d, f, Math.floor((a - c.vistoEm) / DIA));
          for (const m of Object.keys(g.membros)) b.add(m);
        }
      }
    }
    for (const [u, j] of Object.entries(this.dados.jogadores)) {
      const h = j.convites.length;
      j.convites = j.convites.filter((c) => a - c.quando < R().conviteValidadeHoras * HORA && this.guilda(c.guilda));
      if (j.convites.length !== h) b.add(u);
    }
    return [...b];
  }
  sucessor(g) {
    const c = this.liderDe(g);
    return (
      Object.entries(g.membros)
        .filter(([u]) => u !== c)
        .sort(([, a], [, b]) => posto(a.cargo) - posto(b.cargo) || b.pts - a.pts || a.desde - b.desde)[0]?.[0] || null
    );
  }
  _chefeDe(g) {
    if (!g.chefe)
      g.chefe = {
        dia: null,
        degrau: 1,
        contrib: mapaLivre(),
        janelas: mapaLivre(),
        entradas: mapaLivre(),
        nEntradas: mapaLivre(),
        pendentes: [],
        historico: [],
      };
    this._virarDiaChefe(g);
    return g.chefe;
  }
  _degrauDoDia(g) {
    const a = Math.floor((this.amb.agora() - DIA_ZERO) / DIA),
      b = Math.max(1, degrauMaxDe(g.nivel));
    return 1 + ((((a + ((g.id | 0) % 7)) % b) + b) % b);
  }
  _faixaDe(c) {
    const d = (D.chefe?.regras?.faixas || []).slice().sort((a, b) => b.min - a.min);
    return d.find((f) => c >= f.min) || null;
  }
  _fecharDiaChefe(g) {
    const c = g.chefe;
    if (!c?.dia) return;
    const a = D.chefe.regras,
      b = degrauDoChefe(c.degrau),
      d = b?.hp || 1,
      e = Object.values(c.contrib).reduce((s, v) => s + v, 0);
    const h = e >= d * (a.meta?.fracao ?? 1);
    let n = 0;
    for (const [u, i] of Object.entries(c.contrib)) {
      const f = this._faixaDe(i / d);
      if (!(i > 0) || !f) continue;
      c.pendentes.push({
        u,
        dia: c.dia,
        degrau: c.degrau,
        nome: b?.nome || null,
        dano: i,
        faixa: f.nome,
        fragmentos: f.fragmentos,
        meta: h,
      });
      n++;
    }
    if (e > 0) {
      this._registrar(
        g,
        'chefe',
        null,
        null,
        'daily boss ' +
          c.dia +
          ' (' +
          (b?.nome || '?') +
          ', step ' +
          c.degrau +
          '): ' +
          n +
          (n === 1 ? ' member hit' : ' members hit') +
          ', ' +
          e.toLocaleString('pt-BR') +
          ' damage' +
          (h ? ' — GOAL REACHED!' : ''),
      );
      if (h) {
        const j = fonte('chefeMeta'),
          k = (a.meta?.tesouroPorDegrau || 0) * c.degrau;
        this._baseDe(g).tesouro += k;
        if (j)
          this.ganharXp(
            g.id,
            (j.xp || 0) * c.degrau,
            'the guild hit the daily boss goal (' +
              (b?.nome || '?') +
              ', step ' +
              c.degrau +
              ')! +' +
              ((j.xp || 0) * c.degrau).toLocaleString('pt-BR') +
              ' XP, +' +
              k +
              ' ' +
              (D.base?.tesouro?.nome || 'Guild coin'),
          );
      }
    }
    c.historico.unshift({ dia: c.dia, degrau: c.degrau, nome: b?.nome || null, total: e, participantes: n, meta: h });
    if (c.historico.length > 14) c.historico.length = 14;
  }
  _virarDiaChefe(g) {
    const c = g.chefe,
      a = chaveDia(this.amb.agora());
    if (c.dia === a) return;
    this._fecharDiaChefe(g);
    c.dia = a;
    c.degrau = this._degrauDoDia(g);
    c.contrib = mapaLivre();
    c.janelas = mapaLivre();
    c.entradas = mapaLivre();
    c.nEntradas = mapaLivre();
  }
  _premioDe(g, p) {
    return { guilda: g.id, tag: g.tag, nomeGuilda: g.nome, item: D.chefe?.regras?.loja?.fragmentoItem || 900040, ...p };
  }
  colherPremios() {
    const a = [];
    for (const g of Object.values(this.dados.guildas)) {
      if (!g.chefe) continue;
      this._virarDiaChefe(g);
      for (const p of g.chefe.pendentes) a.push(this._premioDe(g, p));
      g.chefe.pendentes = [];
    }
    return a;
  }
  _premiosAoDissolver(g) {
    if (!g.chefe) return [];
    this._virarDiaChefe(g);
    this._fecharDiaChefe(g);
    g.chefe.contrib = mapaLivre();
    const a = g.chefe.pendentes.map((p) => this._premioDe(g, p));
    g.chefe.pendentes = [];
    return a;
  }
  _entradasPorDia() {
    return Math.max(1, Math.floor(+D.chefe?.regras?.entradasPorDia || 1));
  }
  _entradasUsadas(c, u, a) {
    return proprio(c.entradas, u) === a ? Math.max(1, Math.floor(+proprio(c.nEntradas, u) || 1)) : 0;
  }
  entradasRestam(u) {
    const g = this.guildaDe(u);
    if (!g) return 0;
    const c = this._chefeDe(g);
    return Math.max(0, this._entradasPorDia() - this._entradasUsadas(c, u, chaveDia(this.amb.agora())));
  }
  _chegada(a, g, u) {
    const b = (a === 'chefe' ? D.base?.chegada?.chefe : D.base?.chegada?.base) || [{ x: 0, z: 0 }],
      i = Object.keys(g.membros).indexOf(u);
    return b[(i < 0 ? 0 : i) % b.length];
  }
  _salaDa(g) {
    return String(D.base?.sala || 'casa#<guilda>').replace('<guilda>', g.id);
  }
  op_chefeEntrar(u) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    this._virarSemanaTodas();
    const c = this._chefeDe(g),
      a = D.chefe.regras,
      b = this.amb.agora(),
      d = chaveDia(b),
      e = degrauDoChefe(c.degrau);
    if (g.nivel < (a.nivelMinimoGuilda || 1))
      return this._erro(
        'The guild boss unlocks at level ' + a.nivelMinimoGuilda + ' (the guild is at ' + g.nivel + ').',
      );
    if (!e) return this._erro('The boss ladder is over for this season.');
    const f = () => ({
      ok: true,
      tocados: [u],
      janela: c.janelas[u] || null,
      cena: D.base.cena,
      sala: this._salaDa(g),
      chegada: this._chegada('chefe', g, u),
      chefe: this._vistaChefe(g, u),
    });
    if (c.entradas[u] === d) {
      if (!c.janelas[u] || c.janelas[u].fim > b) return f();
      const h = this._entradasUsadas(c, u, d);
      if (h >= this._entradasPorDia()) return this._erro('Your window for today is over. Another boss tomorrow.');
      delete c.janelas[u];
      (c.nEntradas ||= mapaLivre())[u] = h + 1;
      return f();
    }
    c.entradas[u] = d;
    (c.nEntradas ||= mapaLivre())[u] = 1;
    return f();
  }
  chefeSair(u) {
    return [];
  }
  chefeDano(u, a) {
    const g = this.guildaDe(u);
    if (!g) return { erro: 'no guild' };
    this._virarSemanaTodas();
    const c = this._chefeDe(g),
      b = this.amb.agora(),
      d = D.chefe.regras,
      e = degrauDoChefe(c.degrau),
      h = chaveDia(b);
    if (!e) return { erro: 'the ladder is over' };
    if (c.entradas[u] !== h) return { erro: 'outside the entry' };
    if (!c.janelas[u]) c.janelas[u] = { inicio: b, fim: b + (d.janelaS || 120) * 1000 };
    if (b > c.janelas[u].fim) return { erro: 'window ended', janela: c.janelas[u] };
    a = Math.max(0, Math.round(+a || 0));
    const i = e.hp || 1,
      j = new Set();
    if (a) {
      const n = c.contrib[u] || 0;
      c.contrib[u] = n + a;
      const o = Math.floor(c.contrib[u] / 1000) - Math.floor(n / 1000);
      if (o > 0) for (const t of this.evento(u, { tipo: 'chefe', qtd: o }).tocados) j.add(t);
      for (const m of Object.keys(g.membros)) j.add(m);
    }
    const k = c.contrib[u] || 0,
      l = Object.values(c.contrib).reduce((s, v) => s + v, 0),
      f = this._faixaDe(k / i);
    return {
      ok: true,
      dano: a,
      meu: k,
      faixa: f ? { nome: f.nome, fragmentos: f.fragmentos } : null,
      janelaAte: c.janelas[u].fim,
      totalDia: l,
      meta: { alvo: Math.round(i * (d.meta?.fracao ?? 1)), ok: l >= i * (d.meta?.fracao ?? 1) },
      tocados: [...j],
    };
  }
  _degrausDaSemana(g) {
    const a = this.amb.agora(),
      x = new Date(a - 3 * HORA),
      b = (x.getUTCDay() + 6) % 7;
    const c = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - b) + 3 * HORA,
      d = Math.max(1, degrauMaxDe(g.nivel)),
      e = new Set();
    for (let i = 0; i < 7; i++) {
      const f = Math.floor((c + i * DIA - DIA_ZERO) / DIA);
      e.add(1 + ((((f + ((g.id | 0) % 7)) % d) + d) % d));
    }
    return [...e];
  }
  _lojaDe(g) {
    return (g.loja ||= { compras: mapaLivre() });
  }
  op_lojaGuilda(u, a = {}) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    const b = D.chefe.regras,
      L = this._lojaDe(g),
      c = chaveSemana(this.amb.agora()),
      d = String(a.held ?? ''),
      e = Math.max(0, +a.fragmentos || 0);
    const f = this._lojaDaSemana(g).find((h) => String(h.id) === d);
    if (!f) return this._erro("That held item isn't in this week's shop.");
    if ((L.compras[u] || {})[c] >= (b.loja?.porMembroPorSemana || 1))
      return this._erro('You already traded a held item this week.');
    if (e < f.preco) return this._erro('Not enough fragments: ' + f.preco + ' (you have ' + e + ').');
    (L.compras[u] ||= {})[c] = ((L.compras[u] || {})[c] || 0) + 1;
    this._registrar(g, 'loja', u, null, f.preco + ' fragments for ' + f.nome);
    return {
      ok: true,
      tocados: [u],
      debitar: { item: b.loja?.fragmentoItem || 900040, qtd: f.preco },
      entregar: { item: +f.id, qtd: 1, preso: true, nome: f.nome },
    };
  }
  _lojaDaSemana(g) {
    const a = D.chefe.regras,
      b = D.chefe?.heldNomes || {},
      c = [],
      e = new Set();
    for (const d of this._degrausDaSemana(g))
      for (const h of degrauDoChefe(d)?.held || []) {
        if (e.has(String(h.id))) continue;
        e.add(String(h.id));
        c.push({
          id: h.id,
          nome: b[h.id] || 'held ' + h.id,
          raridade: h.raridade,
          preco: (a.loja?.precos || {})[h.raridade] || 20,
          chefe: degrauDoChefe(d)?.nome || null,
        });
      }
    return c;
  }
  _vistaChefe(g, u) {
    const c = this._chefeDe(g),
      e = this.amb.agora(),
      h = D.chefe.regras,
      i = degrauDoChefe(c.degrau),
      j = chaveDia(e),
      k = c.contrib[u] || 0,
      l = i?.hp || 1;
    const m = Object.values(c.contrib).reduce((s, v) => s + v, 0),
      f = this._faixaDe(k / l),
      n = (h.faixas || []).map((x) => ({
        nome: x.nome,
        alvo: Math.round(x.min * l),
        fragmentos: x.fragmentos,
        alcancado: k >= x.min * l,
      }));
    const o = Object.entries(c.contrib)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([a, d]) => ({ id: this.idDe(a), nick: this.nick(a), dano: d }));
    const p = chaveSemana(e),
      L = this._lojaDe(g);
    const q = this._entradasPorDia(),
      r = this._entradasUsadas(c, u, j),
      t = c.janelas[u] || null,
      w = r > 0 && r < q && !!t && t.fim <= e;
    return {
      modelo: 'contribuicao-do-dia',
      degrau: c.degrau,
      total: (D.chefe.escada || []).length,
      degrauMax: degrauMaxDe(g.nivel),
      nivelMinimo: h.nivelMinimoGuilda || 1,
      liberado: g.nivel >= (h.nivelMinimoGuilda || 1),
      nome: i?.nome || null,
      dex: i?.dex || null,
      glb: i?.glb || null,
      lv: i?.lv || 0,
      referencia: l,
      tipos: i?.tipos || { mais: [], menos: [] },
      tipoNome: D.chefe.tipoNome || {},
      dia: c.dia,
      entradaHoje: r > 0 && !w,
      janela: w ? null : t,
      janelaAte: w ? 0 : t?.fim || 0,
      janelaS: h.janelaS,
      entradasPorDia: q,
      entradasUsadas: r,
      entradasRestam: Math.max(0, q - r),
      meuDano: k,
      minhaFaixa: f ? f.nome : null,
      faixas: n,
      marcos: n.map((x) => ({
        dano: x.alvo,
        premio: { fragmentos: x.fragmentos },
        alcancado: x.alcancado,
        pago: false,
        nome: x.nome,
      })),
      danoTotal: m,
      meta: { alvo: Math.round(l * (h.meta?.fracao ?? 1)), ok: m >= l * (h.meta?.fracao ?? 1) },
      participantes: Object.keys(c.contrib).length,
      top: o,
      historico: c.historico.slice(0, 7),
      loja: {
        itens: this._lojaDaSemana(g),
        compradoEstaSemana: (L.compras[u] || {})[p] || 0,
        porSemana: h.loja?.porMembroPorSemana || 1,
        fragmentoItem: h.loja?.fragmentoItem || 900040,
      },
      premioVia: h.premioVia || 'correio',
      tesouroNome: D.base?.tesouro?.nome || 'Guild coin',
    };
  }
  _baseDe(g) {
    return (g.base ||= { construidas: { salao: 1, descanso: 1 }, tesouro: 0 });
  }
  op_irBase(u) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    return {
      ok: true,
      tocados: [],
      cena: D.base.cena,
      sala: this._salaDa(g),
      chegada: this._chegada('base', g, u),
      base: this._vistaBase(g, u),
    };
  }
  op_construir(u, a) {
    const g = this.guildaDe(u);
    if (!g) return this._erro("You're not in a guild.");
    if (!pode(g, g.membros[u].cargo, 'bau')) return this._erro("Your role can't use the guild treasury.");
    const v = (D.base?.vagas || []).find((x) => x.id === a.vaga);
    if (!v) return this._erro("That slot doesn't exist.");
    const b = this._baseDe(g),
      c = b.construidas[v.id] || 0,
      d = proximoDaVaga(v, c);
    if (!d) return this._erro(v.niveis ? v.nome + ' is already at max size.' : v.nome + ' is already built.');
    if (g.nivel < d.nivel)
      return this._erro(v.nome + (v.niveis ? ' ' + d.n : '') + ' requires guild level ' + d.nivel + '.');
    if (b.tesouro < d.custo)
      return this._erro('Short by ' + (d.custo - b.tesouro) + ' ' + D.base.tesouro.nome + ' to build.');
    b.tesouro -= d.custo;
    b.construidas[v.id] = d.n;
    this._registrar(g, 'construiu', u, null, v.nome + (v.niveis ? ' ' + d.n : ''));
    return this._ok(g, { vaga: v.id, n: d.n });
  }
  _vistaBase(g, u) {
    const b = this._baseDe(g),
      a = pode(g, g.membros[u].cargo, 'bau'),
      c = D.base?.tesouro?.nome || 'Guild coin';
    return {
      cena: D.base?.cena || 'casa',
      sala: this._salaDa(g),
      tesouro: b.tesouro,
      tesouroNome: c,
      construidas: { ...b.construidas },
      podeConstruir: a,
      regioes: (D.base?.regioes || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        nivel: r.nivel,
        aberta: g.nivel >= r.nivel,
      })),
      vagas: (D.base?.vagas || []).map((v) => {
        const d = b.construidas[v.id] || 0,
          e = proximoDaVaga(v, d);
        let f = '';
        if (!e) f = v.niveis ? 'at max size' : 'built';
        else if (g.nivel < e.nivel) f = 'requires guild level ' + e.nivel;
        else if (b.tesouro < e.custo) f = 'faltam ' + (e.custo - b.tesouro) + ' ' + c;
        else if (!a) f = 'only treasury users can build';
        return {
          id: v.id,
          nome: v.nome,
          descricao: v.descricao || '',
          atual: d,
          max: v.niveis ? v.niveis.length : 1,
          proximo: e,
          pode: !!e && !f,
          motivo: f,
        };
      }),
    };
  }
  _beneficios(g) {
    const a = bonusXpGrupo(g.nivel),
      c = anunciosExtras(g.nivel),
      d = proximoBeneficio(g.nivel),
      b = this._baseDe(g);
    const e = Object.keys(b.construidas).filter((k) => k !== 'salao' && b.construidas[k]).length;
    return {
      linhas: [
        a
          ? '+' + Math.round(a * 100) + '% XP when 2+ guild members hit the same wild Pokémon'
          : 'Guild group XP: from level 3 (+5%)',
        c
          ? '+' + c + (c === 1 ? ' listing' : ' announcements') + ' on the Market per member'
          : 'Extra Market listing: from level 2',
        'Base with Hall ' +
          (b.construidas.salao || 1) +
          (e ? ' + ' + e + (e === 1 ? ' building' : ' buildings') : '') +
          ' · daily boss: tier ' +
          this._chefeDe(g).degrau,
      ],
      proximo: d ? 'at level ' + d.nivel + ': ' + d.texto : 'all perks unlocked',
      xpGrupo: a,
      anuncios: c,
      todos: beneficiosDe(g.nivel).map((x) => x.texto),
    };
  }
  resumoGuilda(g, a = null) {
    return {
      id: g.id,
      nome: g.nome,
      tag: g.tag,
      desc: g.desc,
      emblema: g.emblema,
      nivel: g.nivel,
      membros: this.total(g),
      vagas: this.vagas(g),
      entrada: g.entrada,
      nivelMin: g.nivelMin,
      posicao: a,
      pts: g.semana?.pts || 0,
      chefeDegrau: g.chefe?.degrau || 1,
    };
  }
  vista(u) {
    this._virarSemanaTodas();
    const c = this.amb.conta(u),
      d = this.amb.agora(),
      j = this.jogador(u),
      g = this.guildaDe(u);
    const e = this.ranking(),
      f = (a) => e.indexOf(a) + 1 || null;
    const h = {
      id: this.idDe(u),
      nick: c?.nick || u,
      lv: c?.lv || 0,
      insignias: c?.insignias || 0,
      dinheiro: c?.dinheiro || 0,
      cargo: g ? g.membros[u].cargo : null,
      esperaAte: this.esperaAte(u) > d ? this.esperaAte(u) : 0,
      fundar: this.podeFundar(u),
    };
    const v = { agora: d, eu: h, guilda: null, convites: [], pedidos: [...j.pedidos], lista: [] };
    if (g) {
      const i = g.membros[u].cargo,
        l = nivelDeXp(g.xp);
      const n = Object.entries(g.membros)
        .map(([a, m]) => {
          const b = this.amb.conta(a) || {};
          return {
            id: this.idDe(a),
            nick: b.nick || a,
            cargo: m.cargo,
            lv: b.lv || 0,
            dex: b.dex || 0,
            online: !!b.online,
            vistoEm: b.vistoEm || 0,
            pts: m.ptsSemana || 0,
            desde: m.desde,
          };
        })
        .sort(
          (a, b) =>
            posto(a.cargo) - posto(b.cargo) || b.online - a.online || b.pts - a.pts || a.nick.localeCompare(b.nick),
        );
      const o = Object.fromEntries(
        [
          'convidar',
          'aceitar',
          'expulsar',
          'aviso',
          'evento',
          'bau',
          'gerenciar',
          'lideranca',
          'dissolver',
          'permissoes',
          'promover',
        ].map((k) => [k, pode(g, i, k)]),
      );
      v.guilda = {
        ...this.resumoGuilda(g, f(g.id)),
        criadaEm: g.criadaEm,
        xp: g.xp,
        xpNoNivel: l.xpNoNivel,
        xpProximo: l.xpProximo,
        vices: nivelInfo(g.nivel).vices,
        oficiais: nivelInfo(g.nivel).oficiais,
        lider: this.nick(this.liderDe(g)),
        online: n.filter((m) => m.online).length,
        aviso: g.aviso ? { texto: g.aviso.texto, autor: this.nick(g.aviso.autor), quando: g.aviso.quando } : null,
        membros: n,
        pedidos: o.aceitar
          ? g.pedidos.map((p) => {
              const a = this.amb.conta(p.usuario) || {};
              return {
                id: this.idDe(p.usuario),
                nick: a.nick || p.usuario,
                lv: a.lv || 0,
                dex: a.dex || 0,
                quando: p.quando,
              };
            })
          : [],
        perms: Object.fromEntries(CARGOS.map((k) => [k, permissoesDe(g, k)])),
        eu: { cargo: i, pode: o, muda: cargoDe(i)?.muda || [] },
        atividade: g.atividade.slice(0, 50).map((a) => ({
          tipo: a.tipo,
          extra: a.extra,
          quando: a.quando,
          texto: textoAtividade(a, (x) => this.nick(x)),
          cor: COR_ATIVIDADE[a.tipo] || 'ciano',
        })),
        chat: g.chat
          .slice(-50)
          .map((m) => ({ de: this.idDe(m.de), texto: m.texto, quando: m.quando, nick: this.nick(m.de) })),
        beneficios: this._beneficios(g),
        chefe: this._vistaChefe(g, u),
        base: this._vistaBase(g, u),
        semanaPassada: g.semanaPassada || null,
        titulo: g.titulo && g.titulo.ate > d ? g.titulo : null,
      };
    } else {
      v.convites = j.convites
        .filter((x) => this.guilda(x.guilda))
        .map((x) => ({
          guilda: this.resumoGuilda(this.guilda(x.guilda), f(x.guilda)),
          por: this.nick(x.por),
          quando: x.quando,
        }));
      v.lista = e.map((a) => this.resumoGuilda(this.guilda(a), f(a)));
    }
    return v;
  }
}
