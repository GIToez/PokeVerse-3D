/* GUILDS (Nov 7). The rules engine is guild.mjs (the same file the client loads: the Livro class runs every operation —
 * found, join, apply, invite, ranks, kick, notice, chat, permissions, level/XP, weekly ranking, the daily guild boss, the
 * base's buildings); this module gives it storage, the accounts it needs and the socket traffic.
 *   data:   public/data/guilda.json (rules, ranks, levels, sources of guild XP — admin → Data files)
 *   state:  server/data/guildas.json (every guild and every player's invites/requests)
 *   socket: { t: 'guilda', op, rid, ... }  →  { t: 'guilda', rid, ok, erro?, vista }  (op 'vista' = just the view)
 *           pushes: guilda_vista (someone else changed my guild), guilda_chat (a message), guilda_tag (the [TAG] over a head)
 *   hooks:  evento(u, tipo, qtd) — guild XP and weekly points from play (selvagem, captura, missao, ginasio, elite, raid…)
 *           tagDe(u) — the guild tag shown over a player; aoApagarConta(u) */
import fs from 'node:fs';
import nodePath from 'node:path';
import crypto from 'node:crypto';
import * as G from './guild.mjs';

export function createGuilds({ dataPub, dataDir, accounts, send, socketsOf, saveAccounts, colocacao = () => null, onTag = () => {}, levar = () => {}, pontoSeguro = () => null, log = () => {} }) {
  // rules: re-read when the file changes (the admin edits it)
  let mtime = -1;
  const regras = () => {
    try {
      const arq = nodePath.join(dataPub, 'guilda.json'), mt = fs.statSync(arq).mtimeMs;
      if (mt !== mtime) { G.usarDados(JSON.parse(fs.readFileSync(arq, 'utf8'))); mtime = mt; }
    } catch (e) { if (mtime === -1) throw e; }
    return G.dados();
  };
  regras();

  const arq = nodePath.join(dataDir, 'guildas.json');
  let estado = null;
  try { estado = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch {}

  const idDe = u => 'p' + crypto.createHash('sha1').update('guild:' + u).digest('hex').slice(0, 12);   // other players never see the login
  const nickDe = u => accounts[u]?.save?.nome || u;
  const amb = {
    agora: () => Date.now(),
    id: idDe,
    conta(u) {
      const c = accounts[u]; if (!c) return null;
      const s = c.save || {};
      const lv = Math.max(0, ...[...(s.time || []), ...(s.caixa || [])].map(p => +p?.lv || 0));
      const dex = s.dex && typeof s.dex === 'object' ? Object.values(s.dex).filter(v => v === 'pego').length : 0;
      return { nick: nickDe(u), lv, insignias: Math.max(Array.isArray(s.insignias) ? s.insignias.length : 0, c.gm ? 8 : 0), dinheiro: c.gm ? Math.max(1e9, Math.floor(+s.dinheiro || 0)) : Math.floor(+s.dinheiro || 0), dex,   // GM accounts have everything
        online: socketsOf(u).length > 0, vistoEm: +c.vistoEm || 0 };
    },
    cobrar(u, n) {
      const s = accounts[u]?.save; if (!s) return false;
      if (accounts[u].gm) return true;                                    // GM accounts have everything
      if (Math.floor(+s.dinheiro || 0) < n) return false;
      s.dinheiro = Math.floor(+s.dinheiro || 0) - n; saveAccounts(); return true;
    },
    porNick(nick) {
      const k = G.chave(nick); if (!k) return null;
      for (const [u, c] of Object.entries(accounts)) if (G.chave(c?.save?.nome || u) === k) return u;
      return null;
    },
  };
  const livro = new G.Livro(estado, amb);
  try { if (livro.migrarEmblemas()) gravar(); } catch {}

  let pend = null;
  function gravar() {
    if (pend) return;
    pend = setTimeout(() => {
      pend = null;
      try { fs.writeFileSync(arq + '.tmp', JSON.stringify(livro.dados)); fs.renameSync(arq + '.tmp', arq); } catch (e) { console.warn('guild save:', e.message); }
    }, 500);
  }

  // ── tags over heads ───────────────────────────────────────────────────────────────
  const tags = new Map();
  const tagDe = u => livro.guildaDe(u)?.tag || null;
  function conferirTag(u) {
    const t = tagDe(u);
    if ((tags.get(u) ?? null) === t) return;
    tags.set(u, t); onTag(u, t);
  }

  /** The base's arrangement state for the placement engine (placement.mjs, lugar 'base' in colocacao.json). */
  function estadoBase(g) {
    const b = livro._baseDe(g);
    if (!Array.isArray(b.colocacoes)) b.colocacoes = [];
    if (!Array.isArray(b.guardadas)) b.guardadas = [];
    return { lugar: 'base', colocacoes: b.colocacoes, guardadas: b.guardadas, construidas: b.construidas || {}, nivel: g.nivel };
  }
  /** ARRANGE THE BASE: Leader, Vice and Officers (GM: anyone) move, store and put back the base's buildings, inside the base. */
  function arrumarBase(ws, u, op, m, responder) {
    const C = colocacao(), g = livro.guildaDe(u);
    if (!C || !g) return responder({ ok: false, erro: g ? 'The base layout is not loaded.' : "You're not in a guild." , vista: vistaDe(u) });
    const est = estadoBase(g), gm = !!accounts[u]?.gm;
    const ctx = { agora: Date.now(), usuario: u, papel: gm ? 'lider' : g.membros[u]?.cargo, naSala: String(ws._mapa || '') === livro._salaDa(g), nivel: g.nivel, itens: {} };
    const { t: _t, rid: _r, op: _o, ...pedido } = m;
    let r = null;
    try { r = C[op](est, pedido, ctx); } catch (e) { r = { ok: false, msg: e.message }; }
    if (!r?.ok) return responder({ ok: false, erro: r?.msg || r?.erro || "That didn't work.", codigo: r?.erro, vista: vistaDe(u) });
    const b = livro._baseDe(g); b.colocacoes = est.colocacoes; b.guardadas = est.guardadas;
    gravar(); log('guild', u, 'base ' + op, r.colocacao?.vaga || r.removida?.vaga || '');
    responder({ ok: true, vista: vistaDe(u) });
  }
  /** The guild window's view. GM accounts get everything: the guild boss is open to them whatever the guild level, with no daily limit. */
  function vistaDe(u) {
    const v = livro.vista(u), c = v?.guilda?.chefe;
    if (v?.guilda?.base) try { const C = colocacao(), g = livro.guildaDe(u); if (C && g) v.guilda.base.colocacao = C.vista(estadoBase(g), {}); } catch {}   // where the base's buildings stand (the arrange screen)
    if (c?.loja) { c.loja.fragmentos = accounts[u]?.gm ? Math.max(1e6, qtdItem(accounts[u].save, FRAGMENTO())) : qtdItem(accounts[u]?.save, FRAGMENTO()); c.loja.trocouNaSemana = c.loja.compradoEstaSemana; }
    if (c && accounts[u]?.gm) { c.liberado = true; if (c.janela && !(c.janelaAte > Date.now())) { c.janela = null; c.entradaHoje = false; } }
    return v;
  }

  // ── pushes ─────────────────────────────────────────────────────────────────────────
  function empurrar(us, exceto = null) {
    for (const u of new Set(us)) {
      if (u === exceto) { conferirTag(u); continue; }
      conferirTag(u);
      const ws = socketsOf(u); if (!ws.length) continue;
      const vista = vistaDe(u);
      for (const w of ws) send(w, { t: 'guilda_vista', vista });
    }
  }
  const PRIVADOS = new Set(['tocados', 'para', 'chat', 'premios']);
  function operar(ws, m) {
    regras();
    const u = ws._usuario, rid = m.rid;
    const responder = o => send(ws, { t: 'guilda', rid, ...o });
    if (!u || !accounts[u]) return responder({ ok: false, erro: 'Sign in to an account to use guilds.' });
    const op = String(m.op || 'vista');
    if (op === 'vista') return responder({ ok: true, vista: vistaDe(u) });
    const naBase = String(ws._mapa || '').startsWith('casa#');
    if (op === 'sairBase') {                                                // back where I was before the base (else Pallet Town)
      const a = accounts[u].save?.antesBase, p = a && Number.isFinite(+a.x) ? { mapa: a.mapa, x: +a.x, z: +a.z, giro: 0 } : pontoSeguro();
      responder({ ok: true, vista: vistaDe(u) });
      if (p && naBase) levar(u, p, 'Leaving the guild base…');
      return;
    }
    if ((op === 'irBase' || op === 'chefeEntrar') && !naBase && accounts[u].save)
      accounts[u].save.antesBase = { mapa: String(ws._cena || ws._mapa || 'kanto'), x: ws._info?.x, z: ws._info?.z };
    if (!/^[a-zA-Z]{2,24}$/.test(op)) return responder({ ok: false, erro: 'Unknown operation.' });
    if (op === 'colocar' || op === 'mover' || op === 'remover') return arrumarBase(ws, u, op, m, responder);
    const { t, rid: _r, op: _o, ...dados } = m;
    const sv = accounts[u].save || (accounts[u].save = {});
    if (op === 'lojaGuilda') dados.fragmentos = qtdItem(sv, FRAGMENTO()) + (accounts[u].gm ? 1e6 : 0);   // what the Bag really holds (GM: everything)
    let r = livro.executar(u, op, dados) || { ok: false, erro: 'No response.' };
    if (!r.ok && op === 'chefeEntrar' && accounts[u].gm && livro.guildaDe(u)) {   // GM: to the boss whatever the guild level or today's entries
      const g = livro.guildaDe(u), c = livro._chefeDe(g), hoje = G.chaveDia(Date.now());
      c.entradas[u] = hoje; c.nEntradas[u] = 1; delete c.janelas[u];
      r = { ok: true, tocados: [u], chegada: livro._chegada('chefe', g, u), sala: livro._salaDa(g) };
    }
    if (r.ok) {
      gravar();
      log('guild', u, op, r.guilda || '');
      empurrar(r.tocados || [], u);
      conferirTag(u);
      if (r.chat && Array.isArray(r.para)) for (const v of r.para) for (const w of socketsOf(v)) send(w, { t: 'guilda_chat', msg: r.chat });
      if (Array.isArray(r.premios)) entregar(r.premios);
      if (r.debitar || r.entregar) {                                         // the guild shop: fragments out, the held item in (bound to the account)
        if (r.debitar && !accounts[u].gm) tirarItem(sv, String(r.debitar.item), Math.max(0, +r.debitar.qtd || 0));
        if (r.entregar) { sv.presos = sv.presos || {}; const id = String(r.entregar.item); sv.presos[id] = (+sv.presos[id] || 0) + Math.max(1, +r.entregar.qtd || 1); r.entregue = r.entregar; }
        empurrarSave(u);
      }
    }
    const extra = Object.fromEntries(Object.entries(r).filter(([k]) => !PRIVADOS.has(k)));
    responder({ ...extra, ok: !!r.ok, vista: vistaDe(u) });
    if (r.ok && op === 'construir') {                                       // the new building shows after the base scene reloads, for everyone inside
      const sala = String(ws._mapa || '');
      if (sala.startsWith('casa#')) for (const v of Object.keys(livro.guildaDe(u)?.membros || {})) for (const w of socketsOf(v))
        if (w._mapa === sala && Number.isFinite(+w._info?.x)) levar(v, { mapa: cenaBase(), x: +w._info.x, z: +w._info.z, giro: +w._info.giro || 0 }, 'Building…');
    }
    if (r.ok && (op === 'irBase' || op === 'chefeEntrar') && r.chegada) {   // the base: a private copy of map 4700001 per guild (room casa#<id>)
      saveAccounts();
      const fx = -1;   // guilda.json / colocacao.json use the map file's coordinates, which the game mirrors on x (world = −x)
      levar(u, { mapa: String(G.dados().base?.mapa || 4700001), x: fx * (+r.chegada.x || 0), z: +r.chegada.z || 0, giro: 0 }, op === 'chefeEntrar' ? 'To the guild boss…' : 'Going to the guild base…');
    }
  }

  const FRAGMENTO = () => String(G.dados()?.chefe?.regras?.loja?.fragmentoItem || 900040);
  const qtdItem = (s, id) => (+s?.presos?.[id] || 0) + (+s?.itens?.[id] || 0);
  function tirarItem(s, id, n) {
    for (const k of ['presos', 'itens']) { const b = s[k]; if (!b || n <= 0) continue; const q = Math.min(n, +b[id] || 0); b[id] = (+b[id] || 0) - q; n -= q; if (!(b[id] > 0)) delete b[id]; }
  }
  function empurrarSave(u) {
    const c = accounts[u]; if (!c?.save) return;
    c.rev = (c.rev || 0) + 1; saveAccounts();
    for (const w of socketsOf(u)) send(w, { t: 'save', save: { itens: c.save.itens || {}, presos: c.save.presos || {} }, rev: c.rev });
  }
  // prizes (the guild boss's fragments when its day closes: { u, item, fragmentos }) go straight into the Bag, bound to the account
  function entregar(lista) {
    for (const p of lista || []) {
      const u = p?.usuario ?? p?.u; const s = accounts[u]?.save; if (!s) continue;
      const itens = p.itens || (p.item ? { [p.item]: p.qtd || p.fragmentos || 1 } : null);
      if (!itens) continue;
      s.presos = s.presos || {};
      for (const [id, q] of Object.entries(itens)) s.presos[id] = (+s.presos[id] || 0) + Math.max(0, Math.floor(+q || 0));
      empurrarSave(u);
      if (p.fragmentos) for (const w of socketsOf(u)) send(w, { t: 'sistema', texto: '🛡️ Guild boss (' + (p.nome || '?') + '): your ' + Number(p.dano || 0).toLocaleString('en-US') + ' damage reached the ' + p.faixa + ' tier: +' + p.fragmentos + ' Guild Fragment' + (p.fragmentos === 1 ? '' : 's') + (p.meta ? '. The guild hit its daily goal!' : '.') });
    }
  }

  /** Guild XP and weekly points from play. tipo = an id from guilda.json `fontes` (selvagem, captura, missao, ginasio, elite, raid…). */
  function evento(u, tipo, qtd = 1, texto = null) {
    try {
      if (!livro.guildaDe(u)) return null;
      const r = livro.evento(u, { tipo, qtd, texto });
      if (r?.ok && (r.xp || r.pts)) gravar();
      return r;
    } catch (e) { console.warn('guild event:', e.message); return null; }
  }
  function aoApagarConta(u) {
    const r = livro.contaApagada(u, nickDe(u));
    if (r.mudou) { gravar(); empurrar(r.tocados || []); entregar(r.premios); }
  }
  function aoEntrar(u) { tags.set(u, tagDe(u)); }

  setInterval(() => {
    try {
      regras();
      const t = livro.tique();
      const p = livro.colherPremios();
      if (t.length || p.length) { gravar(); empurrar(t); entregar(p); }
    } catch (e) { console.warn('guild tick:', e.message); }
  }, 60e3).unref?.();

  /** Admin: list and staff actions. */
  function adminRoute(rota, method, d, gm, json) {
    if (rota === '/admin/guildas' && method === 'GET') {
      const lista = Object.values(livro.dados.guildas).map(g => ({ id: g.id, nome: g.nome, tag: g.tag, nivel: g.nivel, xp: g.xp, membros: Object.keys(g.membros).length,
        lider: nickDe(livro.liderDe(g)), criadaEm: g.criadaEm, semana: g.semana?.pts || 0, entrada: g.entrada }));
      return json(200, { ok: true, guildas: lista }), true;
    }
    if (rota === '/admin/guildas/renomear' && method === 'POST') {
      const r = livro.staffRenomear(String(d.id || ''), { nome: d.nome, tag: d.tag });
      if (r?.ok) { gravar(); empurrar(r.tocados || []); log('guild', 'renamed by', gm, d.id); }
      return json(r?.ok ? 200 : 400, { ok: !!r?.ok, erro: r?.erro }), true;
    }
    if (rota === '/admin/guildas/xp' && method === 'POST') {
      const tocados = livro.ganharXp(String(d.id || ''), Math.max(0, +d.xp || 0), 'staff');
      gravar(); empurrar(tocados); log('guild', 'xp by', gm, d.id, d.xp);
      return json(200, { ok: true }), true;
    }
    if (rota === '/admin/guildas/dissolver' && method === 'POST') {
      const g = livro.guilda(String(d.id || ''));
      if (!g) return json(404, { ok: false, erro: 'No such guild.' }), true;
      const lider = livro.liderDe(g);
      const r = lider ? livro.executar(lider, 'dissolver', {}) : { ok: false, erro: 'No leader.' };
      if (r.ok) { gravar(); empurrar([...(r.tocados || []), lider]); entregar(r.premios); log('guild', 'dissolved by', gm, d.id); }
      return json(r.ok ? 200 : 400, { ok: r.ok, erro: r.erro }), true;
    }
    return false;
  }

  /** The guild group XP bonus (0.05 = +5%) for u when other guildmates also hit the same wild (guilda.json beneficios xpGrupo). */
  function bonusGrupo(u, outros = []) {
    const g = livro.guildaDe(u); if (!g) return 0;
    return outros.some(o => o !== u && livro.guildaDe(o) === g) ? G.bonusXpGrupo(g.nivel) : 0;
  }
  const anunciosExtra = u => { try { const g = livro.guildaDe(u); return g ? G.anunciosExtras(g.nivel) : 0; } catch { return 0; } };
  /** The base's buildings as map objects (file coordinates) for the scene loader: [{ n, x, y, z, a }]. */
  function pecasDaBase(u, C) {
    const g = livro.guildaDe(u); if (!g || !C) return [];
    const v = C.vista(estadoBase(g), {});
    return (v?.pecas || []).filter(p => !p.glb).map(p => ({ n: p.n, x: p.x, y: p.y || 0, z: p.z, a: p.giro || 0 }));
  }
  /** The room for an account entering the base scene: its guild's base (null: not in a guild). */
  const salaBase = u => { const g = livro.guildaDe(u); return g ? livro._salaDa(g) : null; };
  const cenaBase = () => String(G.dados().base?.mapa || 4700001);
  return { operar, evento, bonusGrupo, tagDe, anunciosExtra, salaBase, cenaBase, pecasDaBase, aoEntrar, aoApagarConta, adminRoute, livro, idDe, gravar, _test: { amb, gravar } };
}
