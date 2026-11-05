/* MAIL on the server. The client (mail_ui.mjs, opened from the HUD's Mail shortcut) asks:
 *   {t:'correio_listar'}            → {t:'correio', cartas, naoLidas}
 *   {t:'correio_ler', id}           marks a letter read → {t:'correio', op:'ler', cartas, naoLidas}
 *   {t:'correio_resgatar', id}      hands over the attachments → {t:'correio', op:'resgatar', anexos, cartas, naoLidas, bolsa}
 *   {t:'correio_apagar', id}        deletes a letter with nothing left to claim → {t:'correio', op:'apagar', id, cartas, naoLidas}
 * and gets {t:'correio_novo', de, titulo, naoLidas} when a letter arrives while online. The welcome carries the unread
 * count (`correio`). Letters live on the account (contas[u].correio), not in the save, so the client never writes them.
 *
 * A letter: { id, de, titulo, texto, em, lida, resgatada, anexos: [{ tipo, id, qtd, ficha }] }
 * Attachment kinds handed over here: item, dinheiro (Coins), diamantes, pokemon (a ficha the server builds into a real
 * Pokémon), titulo and cartao/roupa (recorded on the account for the title and wardrobe screens).
 * Other modules send mail with mail.send(user, letter); the GM chat command /mail uses it too. */

const MAX_LETTERS = 100;
const TEXT_MAX = 2000;

export function createMail({ accounts, send, socketsOf, saveAccounts, wallet, newIndividual, markCaught }) {
  function box(c) {
    if (!c.correio || typeof c.correio !== 'object' || !Array.isArray(c.correio.cartas)) c.correio = { seq: 0, cartas: [] };
    return c.correio;
  }
  const unread = c => box(c).cartas.filter(l => !l.lida).length;
  const view = c => box(c).cartas.slice().sort((a, b) => b.em - a.em);

  function cleanAttachment(a) {
    if (!a || typeof a !== 'object') return null;
    const qtd = Math.max(1, Math.min(9999, Math.floor(+a.qtd || 1)));
    if (a.tipo === 'item' && a.id != null) return { tipo: 'item', id: String(a.id), qtd };
    if (a.tipo === 'dinheiro') return { tipo: 'dinheiro', qtd: Math.max(1, Math.min(9999999, Math.floor(+a.qtd || 0))) };
    if (a.tipo === 'diamantes') return { tipo: 'diamantes', qtd };
    if (a.tipo === 'titulo' && a.id) return { tipo: 'titulo', id: String(a.id).slice(0, 40) };
    if (a.tipo === 'cartao' && a.id) return { tipo: 'cartao', classe: String(a.classe || 'roupa'), id: String(a.id).slice(0, 40) };
    if (a.tipo === 'pokemon' && a.ficha && +a.ficha.dex > 0)
      return { tipo: 'pokemon', ficha: { dex: +a.ficha.dex, nome: String(a.ficha.nome || ''), glb: String(a.ficha.glb || ''), lv: Math.max(1, Math.min(100, +a.ficha.lv || 5)), ...(a.ficha.shiny ? { shiny: true } : {}) } };
    return null;
  }

  /** Puts a letter in `user`'s mailbox and tells them if they are online. Returns the letter, or null. */
  function sendLetter(user, letter = {}) {
    const c = accounts[user];
    if (!c) return null;
    const b = box(c);
    const l = {
      id: ++b.seq,
      de: String(letter.de || 'PokeVerse').slice(0, 40),
      titulo: String(letter.titulo || '').slice(0, 80),
      texto: String(letter.texto || '').slice(0, TEXT_MAX),
      em: Date.now(),
      lida: false,
      resgatada: false,
      anexos: (Array.isArray(letter.anexos) ? letter.anexos : []).map(cleanAttachment).filter(Boolean).slice(0, 10),
    };
    b.cartas.push(l);
    // a full mailbox drops the oldest letters that have nothing left to claim
    while (b.cartas.length > MAX_LETTERS) {
      const i = b.cartas.findIndex(x => !x.anexos.length || x.resgatada);
      if (i < 0) break;
      b.cartas.splice(i, 1);
    }
    saveAccounts();
    for (const w of socketsOf(user)) send(w, { t: 'correio_novo', de: l.de, titulo: l.titulo, naoLidas: unread(c) });
    return l;
  }

  /** Every account gets one welcome letter, the first time its mailbox is opened. */
  function welcome(user, c) {
    const b = box(c);
    if (b.boasVindas) return;
    b.boasVindas = true;
    sendLetter(user, {
      de: 'Professor Oak',
      titulo: 'Welcome to Kanto',
      texto: 'Welcome to PokeVerse! Letters from the team, event rewards and gifts arrive here. When a letter has a gift, open it and press Redeem.',
    });
  }

  function grant(u, c, a, out) {
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

  function receive(ws, u, m) {
    const c = u ? accounts[u] : null;
    if (!c) return send(ws, { t: 'correio_erro', op: m.t.replace('correio_', ''), erro: 'Log in with an account to use the mail.' });
    const b = box(c);
    const reply = (op, extra = {}) => send(ws, { t: 'correio', op, cartas: view(c), naoLidas: unread(c), ...extra });
    const find = () => b.cartas.find(l => l.id === +m.id) || null;
    if (m.t === 'correio_listar') { welcome(u, c); return reply('listar'); }
    const l = find();
    if (!l) return send(ws, { t: 'correio_erro', op: m.t.replace('correio_', ''), erro: 'That letter is gone.' });
    if (m.t === 'correio_ler') {
      if (!l.lida) { l.lida = true; saveAccounts(); }
      return reply('ler');
    }
    if (m.t === 'correio_resgatar') {
      if (l.resgatada || !l.anexos.length) return send(ws, { t: 'correio_erro', op: 'resgatar', erro: 'Nothing left to claim in that letter.' });
      const out = {};
      for (const a of l.anexos) grant(u, c, a, out);
      l.resgatada = true; l.lida = true;
      c.rev = (c.rev || 0) + 1;
      saveAccounts();
      const s = c.save;
      return reply('resgatar', {
        anexos: l.anexos, bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens || {}, bolas: s.bolas || {} },
        ...(out.pokemon ? { vidas: s.time } : {}), ...(out.titulosGanhos ? { titulosGanhos: out.titulosGanhos } : {}),
      });
    }
    if (m.t === 'correio_apagar') {
      if (l.anexos.length && !l.resgatada) return send(ws, { t: 'correio_erro', op: 'apagar', erro: 'Redeem the gift before deleting the letter.' });
      b.cartas = b.cartas.filter(x => x !== l);
      saveAccounts();
      return reply('apagar', { id: l.id });
    }
  }

  return { receive, send: sendLetter, unread: u => (accounts[u] ? unread(accounts[u]) : 0) };
}
