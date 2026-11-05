/* ACHIEVEMENTS, MASTER LEVEL and TITLES on the server (the client screens are progression_ui.mjs and achievements_ui.mjs,
 * opened from the Trainer card's Achievements button).
 *
 * The achievements are a data file the admin panel edits (Data files → Achievements): public/data/conquistas.json
 *   { categorias: [{ id, nome }], mestre: { xpPorNivel }, conquistas: [{ id, nome, descricao, categoria, conta, oculta,
 *     degraus: [{ degrau: bronze|prata|ouro|platina|diamante, min, pontosMestre, recompensa?: { tipo, id, nome, qtd } }] }] }
 * `conta` is what the achievement counts. Counters that come from server-checked events (the same ones the season pass
 * uses): ko, captura, shiny, treinador, ginasio, evolucao, historia, elite, raid. Counters read from the save:
 * especies (species caught), insignias (badges), nivel (highest level in the party), dinheiro (Coins).
 * Rewards: titulo (shown in the Titles tab), cosmetico (an outfit id), dinheiro, diamantes, item.
 *
 * Progress lives on the account (contas[u].progressao = { cont, resgatados, escolhido }); titles earned anywhere
 * (achievements, mail, events) live in contas[u].titulosGanhos.
 *   {t:'progressao_vista'}                → {t:'progressao_vista', vista}
 *   {t:'progressao_resgatar', id}         claims every finished tier of that achievement → {t:'progressao_resgate', ok, vista, nome, titulo?}
 *   {t:'progressao_titulo', id|null}      picks the shown title (null = automatic) → {t:'progressao_titulo', ok, id, nome} */
import fs from 'node:fs';
import nodePath from 'node:path';

const TIERS = ['bronze', 'prata', 'ouro', 'platina', 'diamante'];
const EVENT_COUNTERS = new Set(['ko', 'captura', 'shiny', 'treinador', 'ginasio', 'evolucao', 'historia', 'elite', 'raid']);
const SAVE_COUNTERS = {
  especies: save => Object.values(save?.dex || {}).filter(v => v === 'pego' || v === 'caught').length,
  insignias: save => (Array.isArray(save?.insignias) ? save.insignias.length : 0),
  nivel: save => Math.max(0, ...[...(save?.time || []), ...(save?.caixa || [])].map(p => +p?.lv || 0)),
  dinheiro: save => Math.max(0, +save?.dinheiro || 0),
};
export const COUNTERS = [...EVENT_COUNTERS, ...Object.keys(SAVE_COUNTERS)];

export function createProgression({ accounts, send, socketsOf, saveAccounts, dataDir, wallet }) {
  const file = nodePath.join(dataDir, 'conquistas.json');
  let cache = { mtime: -1, def: { categorias: [], conquistas: [], mestre: { xpPorNivel: 1000 } } };
  function def() {
    try {
      const mt = fs.statSync(file).mtimeMs;
      if (mt !== cache.mtime) {
        const d = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
        cache = { mtime: mt, def: { categorias: Array.isArray(d.categorias) ? d.categorias : [], conquistas: (Array.isArray(d.conquistas) ? d.conquistas : []).filter(a => a?.id && Array.isArray(a.degraus) && a.degraus.length), mestre: { xpPorNivel: 1000, ...(d.mestre || {}) } } };
      }
    } catch (e) { if (cache.mtime !== -2) console.warn('conquistas.json:', e.message); cache.mtime = -2; }
    return cache.def;
  }
  function stateOf(c) {
    let p = c.progressao;
    if (!p || typeof p !== 'object') p = c.progressao = { cont: {}, resgatados: {}, escolhido: null };
    if (!p.cont || typeof p.cont !== 'object') p.cont = {};
    if (!p.resgatados || typeof p.resgatados !== 'object') p.resgatados = {};
    return p;
  }
  const valueOf = (c, key) => (SAVE_COUNTERS[key] ? SAVE_COUNTERS[key](c.save) : Math.max(0, +stateOf(c).cont[key] || 0));

  /** A server-checked event happened (the season pass's `contar` calls this too). */
  function count(u, ev) {
    const c = accounts[u];
    if (!c || !ev?.conta) return;
    const p = stateOf(c);
    const before = pending(c);
    if (EVENT_COUNTERS.has(ev.conta)) p.cont[ev.conta] = (p.cont[ev.conta] | 0) + Math.max(1, ev.n | 0 || 1);
    if (ev.conta === 'captura' && ev.shiny) p.cont.shiny = (p.cont.shiny | 0) + 1;
    saveAccounts();
    const after = pending(c);
    if (after > before) for (const w of socketsOf(u)) send(w, { t: 'progressao_vista', vista: view(c), novo: after - before });
  }
  const pending = c => def().conquistas.reduce((n, a) => n + Math.max(0, tiersDone(c, a) - (stateOf(c).resgatados[a.id] | 0)), 0);
  const tiersDone = (c, a) => { const v = valueOf(c, a.conta); let n = 0; for (const d of a.degraus) if (v >= +d.min) n++; else break; return n; };

  function view(c) {
    const D = def(), p = stateOf(c), earned = new Set(Array.isArray(c.titulosGanhos) ? c.titulosGanhos : []);
    let masterXp = 0, tiersTotal = 0, tiersDoneAll = 0, completed = 0, toClaim = 0;
    const list = D.conquistas.map(a => {
      const value = valueOf(c, a.conta), done = tiersDone(c, a), claimed = Math.min(done, p.resgatados[a.id] | 0);
      for (let i = 0; i < claimed; i++) masterXp += +a.degraus[i].pontosMestre || 0;
      tiersTotal += a.degraus.length; tiersDoneAll += done;
      const finished = done >= a.degraus.length;
      if (finished) completed++;
      if (done > claimed) toClaim++;
      const next = a.degraus[done] || a.degraus[a.degraus.length - 1];
      const hidden = !!a.oculta && done === 0;
      return {
        id: a.id, nome: hidden ? '???' : a.nome, descricao: hidden ? 'A hidden achievement.' : a.descricao || '', categoria: a.categoria || 'todas',
        oculta: hidden, valor: hidden ? null : value, alvo: +next.min, concluida: finished, podeResgatar: done > claimed,
        degrausFeitos: done, resgatados: claimed,
        degraus: hidden ? [] : a.degraus.map(d => ({ degrau: TIERS.includes(d.degrau) ? d.degrau : 'bronze', min: +d.min, pontosMestre: +d.pontosMestre || 0, descricao: d.descricao || '', ...(d.recompensa ? { recompensa: d.recompensa } : {}) })),
      };
    });
    const perLevel = Math.max(1, +D.mestre.xpPorNivel || 1000), level = 1 + Math.floor(masterXp / perLevel);
    const catalog = [];
    for (const a of D.conquistas) a.degraus.forEach((d, i) => { if (d.recompensa?.tipo === 'titulo') catalog.push({ id: d.recompensa.id, nome: d.recompensa.nome || d.recompensa.id, origem: 'conquista', conquista: a.id, degrau: d.degrau, indice: i }); });
    for (const t of earned) if (!catalog.some(x => x.id === t)) catalog.push({ id: t, nome: t, origem: 'existente' });
    return {
      resumo: { total: list.length, conquistas: completed, degraus: tiersDoneAll, aResgatar: toClaim },
      categorias: (D.categorias.length ? D.categorias : [{ id: 'todas', nome: 'All' }]).map(k => {
        const mine = list.filter(a => a.categoria === k.id);
        return { id: k.id, nome: k.nome || k.id, total: mine.length, concluidas: mine.filter(a => a.concluida).length };
      }),
      conquistas: list,
      mestre: { nivel: level, xp: masterXp, proximo: level * perLevel, falta: level * perLevel - masterXp },
      titulos: { ativos: [...earned], escolhido: p.escolhido && earned.has(p.escolhido) ? p.escolhido : null, catalogo: catalog },
    };
  }

  function grant(c, r) {
    const save = c.save || (c.save = {});
    if (r.tipo === 'titulo') {
      if (!Array.isArray(c.titulosGanhos)) c.titulosGanhos = [];
      if (!c.titulosGanhos.includes(r.id)) c.titulosGanhos.push(r.id);
    } else if (r.tipo === 'cosmetico') {
      if (!Array.isArray(save.skins)) save.skins = [];
      if (!save.skins.includes(r.id)) save.skins.push(r.id);
    } else if (r.tipo === 'dinheiro') save.dinheiro = (save.dinheiro | 0) + Math.max(1, +r.qtd | 0);
    else if (r.tipo === 'diamantes') wallet.creditar(c, Math.max(1, +r.qtd | 0), 'conquista');
    else if (r.tipo === 'item') { if (!save.itens || typeof save.itens !== 'object') save.itens = {}; save.itens[r.id] = (save.itens[r.id] | 0) + Math.max(1, +r.qtd | 0); }
  }

  function receive(ws, u, m) {
    const c = u ? accounts[u] : null;
    if (!c) return send(ws, { t: 'progressao_erro', erro: 'Sign in with an account to see achievements.' });
    if (m.t === 'progressao_vista') return send(ws, { t: 'progressao_vista', vista: view(c) });
    if (m.t === 'progressao_resgatar') {
      const a = def().conquistas.find(x => x.id === String(m.id));
      if (!a) return send(ws, { t: 'progressao_resgate', ok: false, texto: 'That achievement is gone.' });
      const p = stateOf(c), done = tiersDone(c, a), claimed = p.resgatados[a.id] | 0;
      if (done <= claimed) return send(ws, { t: 'progressao_resgate', ok: false, texto: 'Nothing to redeem there yet.' });
      let lastTitle = null, names = [];
      for (let i = claimed; i < done; i++) {
        const r = a.degraus[i].recompensa;
        if (!r) continue;
        grant(c, r);
        names.push(r.nome || r.id || '');
        if (r.tipo === 'titulo') lastTitle = r;
      }
      p.resgatados[a.id] = done;
      c.rev = (c.rev || 0) + 1;
      saveAccounts();
      const s = c.save || {};
      return send(ws, {
        t: 'progressao_resgate', ok: true, vista: view(c), nome: names.filter(Boolean).join(', ') || a.nome, ...(lastTitle ? { titulo: lastTitle.id } : {}),
        bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens || {}, bolas: s.bolas || {} },
      });
    }
    if (m.t === 'progressao_titulo') {
      const p = stateOf(c), id = m.id == null ? null : String(m.id);
      const earned = Array.isArray(c.titulosGanhos) ? c.titulosGanhos : [];
      if (id && !earned.includes(id)) return send(ws, { t: 'progressao_titulo', ok: false, texto: "You haven't earned that title yet." });
      p.escolhido = id;
      saveAccounts();
      const name = id ? view(c).titulos.catalogo.find(x => x.id === id)?.nome || id : '';
      return send(ws, { t: 'progressao_titulo', ok: true, id, nome: name });
    }
  }

  return { receive, count, view: u => (accounts[u] ? view(accounts[u]) : null), def };
}
