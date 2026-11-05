/* MAIL on the server, and its admin panel routes.
 *
 * Players (mail_ui.mjs, opened from the HUD's Mail shortcut) ask over the WebSocket:
 *   {t:'correio_listar'}            → {t:'correio', op:'listar', cartas, naoLidas}
 *   {t:'correio_ler', id}           marks a letter read
 *   {t:'correio_resgatar', id}      hands over the attachments → {…, op:'resgatar', anexos, bolsa, vidas?, titulosGanhos?}
 *   {t:'correio_apagar', id}        deletes a letter with nothing left to claim
 * and get {t:'correio_novo', de, titulo, naoLidas} when a letter arrives while online. The welcome carries the unread
 * count (`correio`). Letters live on the account (contas[u].correio), not in the save, so the client never writes them.
 *
 * A letter: { id, de, titulo, texto, em, venceEm (ms or null = never), lida, resgatada, campanha?, anexos: [...] }
 * Attachments: item {id, qtd} · dinheiro {qtd} (Coins) · diamantes {qtd} · pokemon {ficha: {dex, nome, glb, lv, shiny}}
 *   · titulo {id} · cartao {classe:'roupa', id}. Expired letters disappear, gift or not (the window says so).
 *
 * Admin (GM) routes, from the panel's 📬 Mail tab:
 *   GET  /admin/correio                 system letters, templates, campaign history with delivered/read/redeemed counts
 *   POST /admin/correio/enviar          { para: 'todos'|'online'|'jogadores', jogadores, carta, venceEm } → a campaign
 *   POST /admin/correio/recolher        { campanha } removes that campaign's letters nobody redeemed yet
 *   POST /admin/correio/sistema         { boasVindas } saves the welcome letter (public/data/mail.json, with backup)
 *   POST /admin/correio/modelos         { modelos } saves the reusable templates
 *   GET  /admin/correio/caixa?u=        one player's mailbox · POST /admin/correio/caixa/apagar { u, id } */
import fs from 'node:fs';
import nodePath from 'node:path';

const MAX_LETTERS = 100;
const TEXT_MAX = 2000;
const LOG_MAX = 300;
const DAY = 864e5;
const DEFAULT_SYSTEM = {
  boasVindas: {
    ativo: true,
    de: 'Professor Oak',
    titulo: 'Welcome to Kanto',
    texto: 'Welcome to PokeVerse! Letters from the team, event rewards and gifts arrive here. When a letter has a gift, open it and press Redeem.',
    anexos: [],
    venceDias: 0,
  },
  modelos: [],
};

export function createMail({ accounts, send, socketsOf, online, saveAccounts, wallet, newIndividual, markCaught, dataDir, serverDir, saveWithBackup, logAdmin = () => {} }) {
  // ── System letters and templates: public/data/mail.json (an admin data file, backed up on every save) ──────────────
  const systemFile = nodePath.join(dataDir, 'mail.json');
  let sysCache = { mtime: -1, data: DEFAULT_SYSTEM };
  function system() {
    try {
      const mt = fs.statSync(systemFile).mtimeMs;
      if (mt !== sysCache.mtime) {
        const d = JSON.parse(fs.readFileSync(systemFile, 'utf8')) || {};
        sysCache = { mtime: mt, data: { ...DEFAULT_SYSTEM, ...d, boasVindas: { ...DEFAULT_SYSTEM.boasVindas, ...(d.boasVindas || {}) }, modelos: Array.isArray(d.modelos) ? d.modelos : [] } };
      }
    } catch { sysCache = { mtime: -1, data: DEFAULT_SYSTEM }; }
    return sysCache.data;
  }
  function writeSystem(next) {
    const clean = { _sobre: 'Mail: the welcome letter every new mailbox gets, and the panel\'s saved templates (admin → Mail).', ...system(), ...next };
    saveWithBackup(systemFile, clean);
    sysCache.mtime = -1;
  }

  // ── Campaign history: server/data/mail_log.json ───────────────────────────────────────────────────────────────────
  const logFile = nodePath.join(serverDir, 'mail_log.json');
  let log = [];
  try { log = JSON.parse(fs.readFileSync(logFile, 'utf8')) || []; } catch { log = []; }
  const writeLog = () => { try { fs.writeFileSync(logFile + '.tmp', JSON.stringify(log.slice(-LOG_MAX))); fs.renameSync(logFile + '.tmp', logFile); } catch (e) { console.warn('mail log:', e.message); } };

  // ── Mailboxes ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function box(c) {
    if (!c.correio || typeof c.correio !== 'object' || !Array.isArray(c.correio.cartas)) c.correio = { seq: 0, cartas: [] };
    return c.correio;
  }
  /** Drops expired letters. True if any went. */
  function expire(c) {
    const b = box(c), now = Date.now(), before = b.cartas.length;
    b.cartas = b.cartas.filter(l => !l.venceEm || l.venceEm > now);
    return b.cartas.length !== before;
  }
  const unread = c => { expire(c); return box(c).cartas.filter(l => !l.lida).length; };
  const view = c => box(c).cartas.slice().sort((a, b) => b.em - a.em);

  function cleanAttachment(a) {
    if (!a || typeof a !== 'object') return null;
    const qtd = Math.max(1, Math.min(9999, Math.floor(+a.qtd || 1)));
    if (a.tipo === 'item' && a.id != null && /^\d{1,7}$/.test(String(a.id))) return { tipo: 'item', id: String(a.id), qtd };
    if (a.tipo === 'dinheiro') return { tipo: 'dinheiro', qtd: Math.max(1, Math.min(9999999, Math.floor(+a.qtd || 0))) };
    if (a.tipo === 'diamantes') return { tipo: 'diamantes', qtd };
    if (a.tipo === 'titulo' && a.id) return { tipo: 'titulo', id: String(a.id).slice(0, 40) };
    if (a.tipo === 'cartao' && a.id) return { tipo: 'cartao', classe: 'roupa', id: String(a.id).slice(0, 40) };
    if (a.tipo === 'pokemon' && a.ficha && +a.ficha.dex > 0)
      return { tipo: 'pokemon', ficha: { dex: +a.ficha.dex, nome: String(a.ficha.nome || '').slice(0, 30), glb: String(a.ficha.glb || '').slice(0, 30), lv: Math.max(1, Math.min(100, Math.round(+a.ficha.lv || 5))), ...(a.ficha.shiny ? { shiny: true } : {}) } };
    return null;
  }
  function cleanLetter(l = {}) {
    return {
      de: String(l.de || 'PokeVerse').trim().slice(0, 40) || 'PokeVerse',
      titulo: String(l.titulo || '').trim().slice(0, 80),
      texto: String(l.texto || '').slice(0, TEXT_MAX),
      anexos: (Array.isArray(l.anexos) ? l.anexos : []).map(cleanAttachment).filter(Boolean).slice(0, 10),
    };
  }

  /** Puts a letter in `user`'s mailbox and tells them if they are online. Returns the letter, or null. */
  function sendLetter(user, letter = {}, extra = {}) {
    const c = accounts[user];
    if (!c) return null;
    const b = box(c);
    expire(c);
    const l = { id: ++b.seq, ...cleanLetter(letter), em: Date.now(), venceEm: Number.isFinite(+extra.venceEm) && +extra.venceEm > Date.now() ? +extra.venceEm : null, lida: false, resgatada: false, ...(extra.campanha ? { campanha: extra.campanha } : {}) };
    b.cartas.push(l);
    while (b.cartas.length > MAX_LETTERS) {   // a full mailbox drops its oldest letters with nothing left to claim
      const i = b.cartas.findIndex(x => !x.anexos.length || x.resgatada);
      if (i < 0) break;
      b.cartas.splice(i, 1);
    }
    if (!extra.quiet) saveAccounts();
    for (const w of socketsOf(user)) send(w, { t: 'correio_novo', de: l.de, titulo: l.titulo, naoLidas: unread(c) });
    return l;
  }

  /** Every mailbox gets the welcome letter once (admin → Mail → System letters), the first time it is opened. */
  function welcome(user, c) {
    const b = box(c);
    if (b.boasVindas) return;
    b.boasVindas = true;
    const w = system().boasVindas;
    if (!w.ativo) return saveAccounts();
    sendLetter(user, w, { venceEm: +w.venceDias > 0 ? Date.now() + +w.venceDias * DAY : null, campanha: 'boas-vindas' });
  }

  function grant(c, a, out) {
    const save = c.save || (c.save = {});
    if (a.tipo === 'item') {
      if (!save.itens || typeof save.itens !== 'object') save.itens = {};
      save.itens[a.id] = (save.itens[a.id] | 0) + a.qtd;
    } else if (a.tipo === 'dinheiro') {
      save.dinheiro = (save.dinheiro | 0) + a.qtd;
    } else if (a.tipo === 'diamantes') {
      wallet.creditar(c, a.qtd, 'correio');
    } else if (a.tipo === 'pokemon') {
      if (!Array.isArray(save.time)) save.time = [];
      if (!Array.isArray(save.caixa)) save.caixa = [];
      const pk = newIndividual(a.ficha);
      if (a.ficha.shiny) pk.shiny = true;
      if (save.time.length < 6) save.time.push(pk); else save.caixa.push(pk);
      markCaught(c, pk.dex);
      out.pokemon = pk;
    } else if (a.tipo === 'titulo') {
      if (!Array.isArray(c.titulosGanhos)) c.titulosGanhos = [];
      if (!c.titulosGanhos.includes(a.id)) c.titulosGanhos.push(a.id);
      out.titulosGanhos = c.titulosGanhos;
    } else if (a.tipo === 'cartao') {
      if (!Array.isArray(save.skins)) save.skins = [];
      if (!save.skins.includes(a.id)) save.skins.push(a.id);
    }
  }

  // ── Player messages ───────────────────────────────────────────────────────────────────────────────────────────────
  function receive(ws, u, m) {
    const op = String(m.t).replace('correio_', '');
    const c = u ? accounts[u] : null;
    if (!c) return send(ws, { t: 'correio_erro', op, erro: 'Log in with an account to use the mail.' });
    if (expire(c)) saveAccounts();
    const b = box(c);
    const reply = (o, extra = {}) => send(ws, { t: 'correio', op: o, cartas: view(c), naoLidas: unread(c), ...extra });
    if (m.t === 'correio_listar') { welcome(u, c); return reply('listar'); }
    const l = b.cartas.find(x => x.id === +m.id) || null;
    if (!l) return send(ws, { t: 'correio_erro', op, erro: 'That letter is gone (it may have expired).' });
    if (m.t === 'correio_ler') {
      if (!l.lida) { l.lida = true; saveAccounts(); }
      return reply('ler');
    }
    if (m.t === 'correio_resgatar') {
      if (l.resgatada || !l.anexos.length) return send(ws, { t: 'correio_erro', op, erro: 'Nothing left to claim in that letter.' });
      const out = {};
      for (const a of l.anexos) grant(c, a, out);
      l.resgatada = true; l.lida = true; l.resgatadaEm = Date.now();
      c.rev = (c.rev || 0) + 1;
      saveAccounts();
      const s = c.save;
      return reply('resgatar', {
        anexos: l.anexos, bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens || {}, bolas: s.bolas || {} },
        ...(out.pokemon ? { vidas: s.time } : {}), ...(out.titulosGanhos ? { titulosGanhos: out.titulosGanhos } : {}),
      });
    }
    if (m.t === 'correio_apagar') {
      if (l.anexos.length && !l.resgatada) return send(ws, { t: 'correio_erro', op, erro: 'Redeem the gift before deleting the letter.' });
      b.cartas = b.cartas.filter(x => x !== l);
      saveAccounts();
      return reply('apagar', { id: l.id });
    }
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Delivered / read / redeemed for one campaign, counted from the mailboxes (letters that expired or were deleted
      are no longer there, so `entregues` comes from the log). */
  function campaignStats(id) {
    let presentes = 0, lidas = 0, resgatadas = 0;
    for (const c of Object.values(accounts)) for (const l of c?.correio?.cartas || []) {
      if (l.campanha !== id) continue;
      presentes++;
      if (l.lida) lidas++;
      if (l.resgatada) resgatadas++;
    }
    return { presentes, lidas, resgatadas };
  }
  function recipients(para, list) {
    if (para === 'todos') return Object.keys(accounts).filter(u => accounts[u] && !accounts[u].apagada);
    if (para === 'online') return [...new Set(online())].filter(u => accounts[u]);
    return [...new Set((Array.isArray(list) ? list : []).map(x => String(x || '').toLowerCase().trim()).filter(u => accounts[u]))];
  }

  function adminRoute(rota, metodo, d, gm, json, url) {
    if (rota === '/admin/correio' && metodo === 'GET') {
      const sys = system();
      return json(200, {
        ok: true,
        boasVindas: sys.boasVindas,
        modelos: sys.modelos,
        campanhas: log.slice(-100).reverse().map(x => ({ ...x, ...campaignStats(x.id) })),
        boasVindasStats: campaignStats('boas-vindas'),
        jogadores: Object.keys(accounts).length,
        online: new Set(online()).size,
      }), true;
    }
    if (rota === '/admin/correio/enviar' && metodo === 'POST') {
      const carta = cleanLetter(d.carta);
      if (!carta.titulo) return json(400, { erro: 'The letter needs a title.' }), true;
      const venceEm = d.venceEm ? Date.parse(d.venceEm) : null;
      if (d.venceEm && !(venceEm > Date.now())) return json(400, { erro: 'The expiry date has to be in the future.' }), true;
      const para = ['todos', 'online', 'jogadores'].includes(d.para) ? d.para : 'jogadores';
      const users = recipients(para, d.jogadores);
      if (!users.length) return json(400, { erro: para === 'jogadores' ? 'No player with those names.' : 'Nobody to send it to.' }), true;
      const id = 'c' + Date.now().toString(36);
      for (const u of users) sendLetter(u, carta, { venceEm, campanha: id, quiet: true });
      saveAccounts();
      log.push({ id, quando: new Date().toISOString(), gm, para, jogadores: para === 'jogadores' ? users : undefined, ...carta, venceEm: venceEm || null, entregues: users.length });
      writeLog();
      logAdmin(gm, para === 'jogadores' ? users.join(',').slice(0, 200) : para, 'mail', { titulo: carta.titulo, anexos: carta.anexos.length, entregues: users.length });
      return json(200, { ok: true, campanha: id, entregues: users.length }), true;
    }
    if (rota === '/admin/correio/recolher' && metodo === 'POST') {
      const id = String(d.campanha || '');
      if (!id || id === 'boas-vindas') return json(400, { erro: 'Pick a campaign.' }), true;
      let removidas = 0;
      for (const c of Object.values(accounts)) {
        const b = c?.correio;
        if (!b?.cartas) continue;
        const before = b.cartas.length;
        b.cartas = b.cartas.filter(l => l.campanha !== id || l.resgatada);
        removidas += before - b.cartas.length;
      }
      saveAccounts();
      const e = log.find(x => x.id === id);
      if (e) { e.recolhida = new Date().toISOString(); e.recolhidas = (e.recolhidas || 0) + removidas; writeLog(); }
      logAdmin(gm, id, 'mail-recall', { removidas });
      return json(200, { ok: true, removidas }), true;
    }
    if (rota === '/admin/correio/sistema' && metodo === 'POST') {
      const w = d.boasVindas || {};
      const boasVindas = { ativo: !!w.ativo, ...cleanLetter(w), venceDias: Math.max(0, Math.min(365, Math.round(+w.venceDias || 0))) };
      if (!boasVindas.titulo) return json(400, { erro: 'The welcome letter needs a title.' }), true;
      writeSystem({ boasVindas });
      logAdmin(gm, 'boas-vindas', 'mail-system', { ativo: boasVindas.ativo, anexos: boasVindas.anexos.length });
      return json(200, { ok: true, boasVindas }), true;
    }
    if (rota === '/admin/correio/modelos' && metodo === 'POST') {
      const modelos = (Array.isArray(d.modelos) ? d.modelos : []).slice(0, 50).map(x => ({ nome: String(x?.nome || '').slice(0, 40) || 'Template', ...cleanLetter(x), venceDias: Math.max(0, Math.min(365, Math.round(+x?.venceDias || 0))) }));
      writeSystem({ modelos });
      return json(200, { ok: true, modelos }), true;
    }
    if (rota === '/admin/correio/caixa' && metodo === 'GET') {
      const u = String(url.searchParams.get('u') || '').toLowerCase().trim();
      const c = accounts[u];
      if (!c) return json(404, { erro: 'No player with that name.' }), true;
      if (expire(c)) saveAccounts();
      return json(200, { ok: true, u, cartas: view(c), naoLidas: unread(c) }), true;
    }
    if (rota === '/admin/correio/caixa/apagar' && metodo === 'POST') {
      const u = String(d.u || '').toLowerCase().trim(), c = accounts[u];
      if (!c) return json(404, { erro: 'No player with that name.' }), true;
      const b = box(c), before = b.cartas.length;
      b.cartas = b.cartas.filter(l => l.id !== +d.id);
      if (b.cartas.length === before) return json(404, { erro: 'That letter is gone.' }), true;
      saveAccounts();
      for (const w of socketsOf(u)) send(w, { t: 'correio', op: 'apagar', id: +d.id, cartas: view(c), naoLidas: unread(c) });
      logAdmin(gm, u, 'mail-delete', { id: +d.id });
      return json(200, { ok: true }), true;
    }
    return false;
  }

  return { receive, send: sendLetter, unread: u => (accounts[u] ? unread(accounts[u]) : 0), adminRoute };
}
