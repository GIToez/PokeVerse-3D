/* Battle Pass (season pass) on the server. The season comes from public/data/season_pass.json; progress lives in
 * contas[u].save.temporada and only moves on events the server itself checked (wild defeat, capture, battle win,
 * evolution, story mission, raid queue). The client asks over the WebSocket:
 *   {t:'temporada', op:'ver'}                         → {t:'temporada', rid, ok, vista}
 *   {t:'temporada', op:'pegar', nivel, trilha}        claim one level's reward on 'gratis' or 'paga'
 *   {t:'temporada', op:'comprarPasse', ref, preco}    unlock the paid track with Diamonds
 *   {t:'temporada', op:'comprarNivel', n, ref, custo} buy levels with Diamonds (they only unlock paid-track Diamonds/outfits)
 * The reply shape (`vista`) is the one pass_screen.mjs draws. */
import fs from 'fs';
import nodePath from 'path';

const DIA = 86400000;
const MAX_REFS = 40;

export function criarTemporada({ dadosPub, contas, socketsDe, enviar, salvarContas, carteira, itemCatalog, nomeItem }) {
  const arq = nodePath.join(dadosPub, 'season_pass.json');
  let cache = null, cacheMtime = 0;
  function def() {
    try {
      const st = fs.statSync(arq);
      if (!cache || st.mtimeMs !== cacheMtime) { cache = JSON.parse(fs.readFileSync(arq, 'utf8')); cacheMtime = st.mtimeMs; }
    } catch (e) { if (!cache) { console.warn('season_pass.json:', e.message); cache = null; } }
    return cache;
  }
  let tiposDex = null;
  function tiposDe(dex) {
    if (!tiposDex) {
      tiposDex = new Map();
      try {
        const p = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, '..', 'pokedex.json'), 'utf8'));
        for (const s of p.species || []) tiposDex.set(+s.n, (s.types || []).map(t => String(t).toLowerCase()));
      } catch (e) { console.warn('season: pokedex.json', e.message); }
    }
    return tiposDex.get(+dex) || [];
  }

  function relogio(S, agora = Date.now()) {
    const inicio = Date.parse(S.inicio);
    const fim = inicio + S.dias * DIA;
    const dia = Math.floor((agora - inicio) / DIA);
    const semana = Math.floor(dia / 7) + 1;
    const fase = agora < inicio ? 'breve' : agora >= fim ? 'fechada' : 'aberta';
    return { inicio, fim, dia, semana, fase, viradaDia: inicio + (dia + 1) * DIA, viradaSemana: inicio + semana * 7 * DIA };
  }

  function estadoDe(c, S) {
    if (!c.save) c.save = {};
    let t = c.save.temporada;
    if (!t || typeof t !== 'object' || t.id !== S.id) t = c.save.temporada = { id: S.id, pontos: 0, comprados: 0, pago: false, pegos: [], cont: {}, feitas: [], diaria: null, semanaUsadas: null, refs: [] };
    for (const k of ['pegos', 'feitas', 'refs']) if (!Array.isArray(t[k])) t[k] = [];
    if (!t.cont || typeof t.cont !== 'object') t.cont = {};
    return t;
  }
  const semanaDe = (S, n) => (S.semanais || []).length ? S.semanais[(n - 1) % S.semanais.length] : null;
  function diariaDe(t, R) {
    if (!t.diaria || t.diaria.dia !== R.dia) t.diaria = { dia: R.dia, cont: {}, feitas: [] };
    return t.diaria;
  }
  function usadasDe(t, R, S) {
    if (!t.semanaUsadas || t.semanaUsadas.semana !== R.semana) t.semanaUsadas = { semana: R.semana, n: 0 };
    return Math.max(0, (S.diariasPorSemana || 21) - t.semanaUsadas.n);
  }
  const jogandoDe = (t, S) => Math.min(S.maxNivel, Math.floor(t.pontos / S.pontosPorNivel));
  const nivelDe = (t, S) => Math.min(S.maxNivel, jogandoDe(t, S) + (t.comprados || 0));

  /* ── progress ── */
  function bate(m, ev) {
    if (m.conta !== ev.conta) return null;
    if (m.tipos && !tiposDe(ev.dex).some(x => m.tipos.includes(x))) return null;
    if (m.desafio && !(ev.lv >= ev.meuLv)) return null;
    if (m.especies) return 'dex:' + (+ev.dex || 0);
    if (m.areas) return ev.area != null ? 'area:' + ev.area : null;
    return 1;
  }
  function avancar(cont, m, chave) {
    if (chave === 1) { cont[m.id] = Math.min(m.qtd, (+cont[m.id] || 0) + 1); return; }
    const l = Array.isArray(cont[m.id]) ? cont[m.id] : [];
    if (!l.includes(chave) && l.length < m.qtd) l.push(chave);
    cont[m.id] = l;
  }
  const nDe = (cont, m) => Array.isArray(cont[m.id]) ? cont[m.id].length : (+cont[m.id] || 0);

  /** Count one checked event for account `u`: { conta, dex?, lv?, meuLv?, area? }. */
  function contar(u, ev) {
    const S = def(), c = contas[u];
    if (!S || !c) return;
    const R = relogio(S);
    if (R.fase !== 'aberta') return;
    const t = estadoDe(c, S);
    let feitasAgora = 0;
    const semana = semanaDe(S, R.semana);
    const longas = [...(S.temporada || []), ...((semana?.missoes) || []).map(m => ({ ...m, id: m.id + '@' + R.semana })), ...((S.extras?.missoes) || []).map(m => ({ ...m, id: m.id + '@' + R.semana }))];
    let extrasSemana = (S.extras?.missoes || []).filter(x => t.feitas.includes(x.id + '@' + R.semana)).length;
    for (const m of longas) {
      if (t.feitas.includes(m.id)) continue;
      const k = bate(m, ev); if (k == null) continue;
      const extra = (S.extras?.missoes || []).some(x => m.id.startsWith(x.id + '@'));
      if (extra && extrasSemana >= (S.extras.teto || 2)) continue;
      avancar(t.cont, m, k);
      if (nDe(t.cont, m) >= m.qtd) { t.feitas.push(m.id); delete t.cont[m.id]; feitasAgora++; if (extra) extrasSemana++; }
    }
    const D = diariaDe(t, R);
    for (const m of S.diarias || []) {
      if (D.feitas.includes(m.id) || usadasDe(t, R, S) <= 0) continue;
      const k = bate(m, ev); if (k == null) continue;
      avancar(D.cont, m, k);
      if (nDe(D.cont, m) >= m.qtd) { D.feitas.push(m.id); delete D.cont[m.id]; t.semanaUsadas.n++; feitasAgora++; }
    }
    if (feitasAgora) {
      const antes = nivelDe(t, S);
      t.pontos += feitasAgora * S.pontosPorMissao;
      const depois = nivelDe(t, S);
      for (const w of socketsDe(u)) enviar(w, { t: 'temporada_evento', vista: vista(c), missoes: feitasAgora, subiu: depois > antes ? depois : 0 });
    }
    salvarContas();
  }

  /* ── view ── */
  function premioVista(p, i, n, trilha, t, S) {
    const nivel = nivelDe(t, S), jogando = jogandoDe(t, S);
    const comprado = p.tipo === 'diamantes' || p.tipo === 'roupa';
    let estado = 'pronto';
    if (t.pegos.includes(trilha + ':' + n + ':' + i)) estado = 'pego';
    else if (n > nivel) estado = 'bloqueado';
    else if (trilha === 'paga' && !t.pago) estado = 'cadeado';
    else if (n > jogando && !(trilha === 'paga' && comprado)) estado = 'jogando';
    const base = { i, estado, qtd: p.qtd || 1 };
    if (p.tipo === 'item') return { ...base, tipo: 'item', id: p.id, nome: nomeItem(p.id), icone: 'ic_' + p.id };
    if (p.tipo === 'diamantes') return { ...base, tipo: 'gold', nome: 'Diamonds', icone: 'ic_37' };
    if (p.tipo === 'titulo') return { ...base, tipo: 'titulo', nome: p.nome };
    if (p.tipo === 'roupa') {
      const cos = lerCosmeticos();
      const pecas = p.ids.map(id => {
        const r = cos.roupas.find(x => x.id === id) || { nome: id, sexo: /^girl/.test(id) ? 'menina' : 'menino' };
        return { chave: 'roupa:' + id, tipo: 'roupa', id, nome: r.nome, nomes: { en: r.nome }, icone: 'ui/amanda/skins/pecas/roupa-' + id + '@2x.png', sexo: r.sexo };
      });
      return { ...base, tipo: 'roupa', nome: pecas[0]?.nome || 'Outfit', pecas };
    }
    return { ...base, tipo: p.tipo, nome: p.nome || '' };
  }
  function linhaMissao(m, n, feita) { return { id: m.id, texto: m.texto, qtd: m.qtd, n: Math.min(m.qtd, n), conta: m.conta, feita, ...(m.requisito ? { requisito: m.requisito } : {}) }; }

  function vista(c) {
    const S = def();
    if (!S) return null;
    const R = relogio(S), agora = Date.now();
    const t = estadoDe(c, S), D = diariaDe(t, R);
    const nivel = nivelDe(t, S), jogando = jogandoDe(t, S);
    const semanais = [];
    for (let k = 1; k <= Math.min(R.semana, Math.ceil(S.dias / 7)); k++) {
      const s = semanaDe(S, k); if (!s) continue;
      semanais.push({ semana: k, tipo: s.tipo, missoes: s.missoes.map(m => { const id = m.id + '@' + k, f = t.feitas.includes(id); return linhaMissao({ ...m, id }, f ? m.qtd : (k === R.semana ? nDe(t.cont, { id }) : 0), f); }) });
    }
    const trilhas = {};
    for (const tr of ['gratis', 'paga']) trilhas[tr] = (S.trilhas[tr] || []).map(l => ({ nivel: l.nivel, premios: l.premios.map((p, i) => premioVista(p, i, l.nivel, tr, t, S)) }));
    let prontos = 0; for (const tr in trilhas) for (const l of trilhas[tr]) for (const p of l.premios) if (p.estado === 'pronto') prontos++;
    const cart = carteira.de(c);
    return {
      id: 'T' + String(S.id).replace(/^\D+/, ''), nome: S.nome, nomeTela: 'Season pass', fase: R.fase,
      dia: R.dia + 1, dias: S.dias, semana: R.semana, inicio: R.inicio, fim: R.fim,
      diasRestantes: Math.max(0, Math.ceil((R.fim - agora) / DIA)), agora, viradaDia: R.viradaDia, viradaSemana: R.viradaSemana,
      pontos: t.pontos, pontosPorMissao: S.pontosPorMissao, nivel, jogando, comprados: t.comprados || 0,
      noNivel: t.pontos % S.pontosPorNivel, pontosPorNivel: S.pontosPorNivel, maxNivel: S.maxNivel,
      passe: { pago: !!t.pago, estornado: false, preco: S.passe.preco, vendaAberta: R.dia + 1 <= S.passe.vendaAte, vendaAte: S.passe.vendaAte },
      nivelComprado: { custo: S.nivelComprado.custo, aberta: !!t.pago && nivel < S.maxNivel, maxCompravel: t.pago ? S.maxNivel - nivel : 0 },
      guardadas: { n: usadasDe(t, R, S), de: S.diariasPorSemana || 21 },
      tipoDoDia: null, prontos,
      diarias: (S.diarias || []).map(m => linhaMissao(m, D.feitas.includes(m.id) ? m.qtd : nDe(D.cont, m), D.feitas.includes(m.id))),
      semanais,
      temporada: (S.temporada || []).map(m => linhaMissao(m, t.feitas.includes(m.id) ? m.qtd : nDe(t.cont, m), t.feitas.includes(m.id))),
      extras: { teto: S.extras?.teto || 2, nestaSemana: (S.extras?.missoes || []).filter(m => t.feitas.includes(m.id + '@' + R.semana)).length, missoes: (S.extras?.missoes || []).map(m => ({ id: m.id, texto: m.texto, qtd: m.qtd })) },
      trilhas, carteira: cart, fechada: R.fase === 'fechada' ? R.fim : null,
    };
  }

  let cosCache = null, cosMtime = 0;
  function lerCosmeticos() {
    const a = nodePath.join(dadosPub, 'cosmeticos.json');
    try { const st = fs.statSync(a); if (!cosCache || st.mtimeMs !== cosMtime) { cosCache = JSON.parse(fs.readFileSync(a, 'utf8')); cosMtime = st.mtimeMs; } } catch {}
    return cosCache || { roupas: [], efeitos: [] };
  }

  /* ── ops ── */
  function entregar(c, u, p) {
    const s = c.save;
    if (p.tipo === 'item') {
      const pocket = itemCatalog().items?.[p.id]?.t === 7 ? 'bolas' : 'itens';
      if (!s[pocket] || typeof s[pocket] !== 'object') s[pocket] = {};
      s[pocket][p.id] = (+s[pocket][p.id] || 0) + (p.qtd || 1);
    } else if (p.tipo === 'diamantes') carteira.creditar(c, p.qtd, 'passe');
    else if (p.tipo === 'roupa') {
      if (!s.cosmeticos || typeof s.cosmeticos !== 'object') s.cosmeticos = { roupas: [], efeitos: [] };
      if (!Array.isArray(s.cosmeticos.roupas)) s.cosmeticos.roupas = [];
      for (const id of p.ids) if (!s.cosmeticos.roupas.includes(id)) s.cosmeticos.roupas.push(id);
    } else if (p.tipo === 'titulo') {
      if (!Array.isArray(s.titulos)) s.titulos = [];
      if (!s.titulos.includes(p.nome)) s.titulos.push(p.nome);
    }
  }
  function empurrarSave(u) {
    const c = contas[u]; c.rev = (c.rev || 0) + 1;
    for (const w of socketsDe(u)) enviar(w, { t: 'save', save: c.save, rev: c.rev });
  }
  function pegarPendentes(c, u, S, filtro) {
    const t = estadoDe(c, S), entregues = [];
    for (const tr of ['gratis', 'paga']) for (const l of S.trilhas[tr] || []) l.premios.forEach((p, i) => {
      if (!filtro(tr, l.nivel)) return;
      if (premioVista(p, i, l.nivel, tr, t, S).estado !== 'pronto') return;
      entregar(c, u, p); t.pegos.push(tr + ':' + l.nivel + ':' + i);
      entregues.push({ nivel: l.nivel, trilha: tr, i, qtd: p.qtd || 1 });
    });
    return entregues;
  }

  function receber(ws, u, m) {
    const rid = m.rid;
    const resp = o => enviar(ws, { t: 'temporada', rid, ok: true, ...o });
    const erro = (e, msg, extra = {}) => enviar(ws, { t: 'temporada_erro', rid, erro: e, mensagem: msg, ...extra });
    const c = u ? contas[u] : null;
    if (!c) return erro('sem-conta', 'Log in with an account to use the season pass.');
    const S = def();
    if (!S) return erro('fechada', 'There is no season right now.');
    const R = relogio(S), t = estadoDe(c, S);
    const ref = String(m.ref || '').slice(0, 40);
    const repetido = ref && t.refs.includes(ref);
    const lembrar = () => { if (ref) { t.refs.push(ref); if (t.refs.length > MAX_REFS) t.refs.splice(0, t.refs.length - MAX_REFS); } };

    if (m.op === 'ver') return resp({ vista: vista(c) });
    if (R.fase !== 'aberta') return erro('fechada', 'The season is closed.', { vista: vista(c) });

    if (m.op === 'pegar') {
      const tr = m.trilha === 'paga' ? 'paga' : 'gratis', n = +m.nivel;
      const entregues = pegarPendentes(c, u, S, (a, b) => a === tr && b === n);
      if (!entregues.length) return erro('nada-pra-pegar', 'Nothing to claim there.', { vista: vista(c) });
      salvarContas(); empurrarSave(u);
      return resp({ vista: vista(c), entregues, pendentes: [] });
    }
    if (m.op === 'comprarPasse') {
      if (t.pago) return resp({ vista: vista(c), repetido: !!repetido, entregues: [] });
      if (!(R.dia + 1 <= S.passe.vendaAte)) return erro('fechada', 'The season pass is no longer on sale.', { vista: vista(c) });
      if (m.preco != null && +m.preco !== S.passe.preco) return erro('preco-mudou', 'The price changed: review and confirm again.', { vista: vista(c) });
      const falta = S.passe.preco - carteira.de(c).total;
      if (falta > 0) return erro('saldo-insuficiente', 'Not enough Diamonds.', { falta, vista: vista(c) });
      carteira.debitar(c, S.passe.preco);
      t.pago = true; lembrar();
      const entregues = pegarPendentes(c, u, S, (a, b) => a === 'paga' && b === 0);
      salvarContas(); empurrarSave(u);
      return resp({ vista: vista(c), compra: { qtd: S.passe.preco }, entregues, pendentes: [] });
    }
    if (m.op === 'comprarNivel') {
      if (repetido) return resp({ vista: vista(c), repetido: true });
      if (!t.pago) return erro('recusado', 'Unlock the season pass first.', { vista: vista(c) });
      const custo = S.nivelComprado.custo;
      if (m.custo != null && +m.custo !== custo) return erro('preco-mudou', 'The price changed: review and confirm again.', { vista: vista(c) });
      const max = S.maxNivel - nivelDe(t, S);
      const n = Math.max(1, Math.min(max, Math.floor(+m.n || 1)));
      if (max <= 0) return erro('recusado', 'You are already at the last level.', { vista: vista(c) });
      const falta = n * custo - carteira.de(c).total;
      if (falta > 0) return erro('saldo-insuficiente', 'Not enough Diamonds.', { falta, vista: vista(c) });
      carteira.debitar(c, n * custo);
      t.comprados = (t.comprados || 0) + n; lembrar();
      salvarContas(); empurrarSave(u);
      return resp({ vista: vista(c), compra: { qtd: n * custo } });
    }
    return erro('recusado', 'Unknown season pass request.');
  }

  return { receber, contar, vista, def };
}
