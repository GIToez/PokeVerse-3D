/* Moderação (Fase 3 do painel). Os comandos de GM do chat e a tela Jogadores → Moderação do painel passam pelas MESMAS funções
 * daqui, então dão o mesmo resultado: o mesmo campo na conta (banidoAte/banMotivo/mudoAte/posGm), o mesmo aviso pro jogador e
 * a mesma linha no admin_log.jsonl (o "Histórico do painel" da ficha mostra também o que veio do chat).
 *
 * Chat (chat.mjs → index.html `moderar` → {t:'mod_<op>', …}; o network.mjs mostra a resposta {t:'mod', op, …} no chat de Sistema):
 *   /online · /ver nome · /aviso texto · /mudo nome min [motivo] (0 = tira) · /kick nome [motivo] · /banir nome horas [motivo]
 *   (-1 = pra sempre) · /perdoar nome · /tp nome cidade | /tp nome x z · /ir nome · /puxar nome · /giveskates [nome] (Roller Skates)
 *   `nome` = o usuário da conta ou o nome do personagem. Também aceita o formato antigo {t:'mod', op}.
 *
 * Levar (tp/puxar/ir): grava `posGm` = { mapa, x, z } na conta e manda {t:'volta', mapa} pra quem está online — o cliente
 * recarrega a cena e nasce no ponto (o login e o GET /save entregam `pos`). Offline: nasce lá na próxima entrada. O `posGm`
 * some quando a conta entra no mapa dele (server.mjs, `entrar`). x/z são do MUNDO (os do jogador e do Editor de Mapa). */
import fs from 'node:fs';
import nodePath from 'node:path';
import { PATINS } from './item_rules.mjs';

const MAX_MIN = 525600;                                                      // 1 ano: acima disso é "pra sempre" (-1)
/* Ponto de chegada em Kanto na frente do Centro Pokémon de cada cidade (doors.json: a porta de saída do Centro, 61409xx → 711xx01);
   Pallet não tem Centro: na porta do laboratório. As coordenadas saem do kanto.json (npcs[].cfg). */
export const CIDADES = { pallet: 7110103, viridian: 7110201, pewter: 7110301, cerulean: 7110401, vermilion: 7110501,
  lavender: 7110601, celadon: 7110701, saffron: 7110801, fuchsia: 7110901, cinnabar: 7111001 };
const APELIDOS = { celeste: 'cerulean', lavanda: 'lavender', carmim: 'vermilion', cinzenta: 'pewter', verde: 'viridian', azaleia: 'celadon', acafrao: 'saffron', fucsia: 'fuchsia', canela: 'cinnabar' };
const semAcento = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** h = helpers do server.mjs (os mesmos que a tela Jogadores usa). `avisar(gm, texto)` vem do server_events.mjs. */
export function criarModeracao(h) {
  const { contas, sessoes, socketsDe, banidoAteDe, derrubar, logAdmin, enviar, salvarContasJa, conexoes, dadosPub, avisar } = h;
  const hora = ms => new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const quando = ms => ms === -1 ? 'forever' : 'until ' + new Date(ms).toLocaleString('en-US');

  // ── Pontos das cidades (kanto.json é grande: lê na 1ª vez que alguém usa /tp cidade) ──
  let pontos = null;
  function cidade(txt) {
    let k = semAcento(txt).replace(/^(cidade|ilha)\s+(de\s+)?/, '');
    k = APELIDOS[k] || k;
    if (!CIDADES[k]) return null;
    if (!pontos) {
      pontos = {};
      try {
        const kanto = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, 'kanto.json'), 'utf8'));
        const porCfg = new Map((kanto.npcs || []).map(n => [+n.cfg, n]));
        for (const [nome, cfg] of Object.entries(CIDADES)) {
          const n = porCfg.get(cfg); if (!n) continue;
          pontos[nome] = { mapa: 'kanto', x: +(-n.x).toFixed(2), z: +(+n.z).toFixed(2), nome: kanto.nomes?.[n.a] || nome };   // arquivo → mundo: x espelhado (FLIPX = -1)
        }
      } catch (e) { console.warn('moderation: kanto.json:', e.message); }
    }
    return pontos[k] || null;
  }
  const listaCidades = () => Object.keys(CIDADES).join(', ');

  /** Conta pelo usuário (login) ou pelo nome do personagem. */
  function acharConta(txt) {
    const q = String(txt || '').trim(); if (!q) return null;
    if (contas[q.toLowerCase()]) return q.toLowerCase();
    const low = q.toLowerCase();
    return Object.keys(contas).find(u => String(contas[u]?.save?.nome || '').toLowerCase() === low) || null;
  }
  /** Onde a conta está agora (online) — { mapa, x, z } do mundo. */
  function ondeEsta(u) {
    const w = socketsDe(u).find(x => x._info);
    return w ? { mapa: String(w._mapa), x: +(+w._info.x || 0).toFixed(2), z: +(+w._info.z || 0).toFixed(2) } : null;
  }

  // ── Ações (painel e chat) — não gravam: quem chama salva (o painel com pronto(), o chat com salvarContasJa) ──
  function banir(g, u, minutos, motivo) {
    const c = contas[u];
    if (!(minutos === -1 || (minutos >= 1 && minutos <= MAX_MIN))) return { erro: 'Invalid ban duration.' };
    c.banidoAte = minutos === -1 ? -1 : Date.now() + minutos * 60000; c.banMotivo = motivo;
    if (c.token) { sessoes.delete(c.token); c.token = null; }                 // a sessão cai: o próximo login esbarra no banimento
    derrubar(u, 'Your account is suspended ' + quando(c.banidoAte) + '.' + (motivo ? ' Reason: ' + motivo : ''), 'suspensa');
    logAdmin(g, u, 'ban', { depois: { banidoAte: c.banidoAte, motivo } });
    return { ate: c.banidoAte };
  }
  function perdoar(g, u) {
    const c = contas[u];
    logAdmin(g, u, 'unban', { antes: { banidoAte: c.banidoAte || 0 } });
    delete c.banidoAte; delete c.banMotivo;
    return {};
  }
  function silenciar(g, u, minutos, motivo) {
    const c = contas[u];
    if (!(minutos >= 1 && minutos <= MAX_MIN)) return { erro: 'Invalid mute duration.' };
    c.mudoAte = Date.now() + minutos * 60000;
    for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: '🔇 You are muted until ' + hora(c.mudoAte) + '.' + (motivo ? ' Reason: ' + motivo : '') });
    logAdmin(g, u, 'mute', { depois: { mudoAte: c.mudoAte, motivo } });
    return { minutos };
  }
  function desmutar(g, u) {
    delete contas[u].mudoAte;
    for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: '🔊 You can talk in chat again.' });
    logAdmin(g, u, 'unmute', {});
    return {};
  }
  function desconectar(g, u, motivo) {
    const n = derrubar(u, 'A GM disconnected you.' + (motivo ? ' Reason: ' + motivo : ''), 'equipe');
    logAdmin(g, u, 'kick', { depois: { conexoes: n } });
    return { derrubou: n };
  }
  function recado(g, u, texto) {
    texto = String(texto || '').trim().slice(0, 240);
    if (!texto) return { erro: 'Write the message.' };
    const n = socketsDe(u).length;
    if (!n) return { erro: 'The player is not online.' };
    for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: '📩 GM: ' + texto });
    logAdmin(g, u, 'message', { depois: { texto } });
    return {};
  }
  /** Leva a conta pra `dest` = { mapa, x, z, nome }. Online: a cena recarrega agora; offline: nasce lá ao entrar. */
  function levar(g, u, dest, acao = 'teleport') {
    const pos = { mapa: String(dest.mapa), x: +dest.x, z: +dest.z, giro: 0 };
    if (!/^[\w-]{1,40}$/.test(pos.mapa) || !Number.isFinite(pos.x) || !Number.isFinite(pos.z) || Math.abs(pos.x) > 100000 || Math.abs(pos.z) > 100000) return { erro: 'Invalid destination.' };
    contas[u].posGm = pos;
    const ws = socketsDe(u);
    for (const w of ws) enviar(w, { t: 'volta', mapa: pos.mapa, texto: '🧭 A GM moved you' + (dest.nome ? ' to ' + dest.nome : '') + '…' });
    logAdmin(g, u, acao, { depois: { ...pos, nome: dest.nome || null } });
    return { ...pos, nome: dest.nome || null, derrubou: ws.length };
  }
  /** /ir and the panel's "Go there": the GM's game goes to `u` — same map: a jump next to them; another map: the GM's scene reloads there. */
  function irAte(g, u, acao) {
    const ele = ondeEsta(u);
    if (!ele) return { erro: u + ' is not online' };
    const meus = socketsDe(g).filter(w => w._info);
    if (!meus.length) return { erro: 'Your game is not online: open the game with this GM account first.' };
    logAdmin(g, u, acao, { depois: ele });
    for (const w of meus) {
      if (String(ele.mapa) === String(w._mapa)) enviar(w, { t: 'mod', op: 'ir', usuario: u, ...ele, mesmoMapa: true });
      else {
        contas[g].posGm = { ...ele, giro: 0 };                                     // another map: my scene reloads there
        enviar(w, { t: 'mod', op: 'ir', usuario: u, ...ele, mesmoMapa: false });
        enviar(w, { t: 'volta', mapa: ele.mapa, texto: '🧭 Going to ' + u + '…' });
      }
    }
    salvarContasJa();
    return { ...ele, usuario: u };
  }
  /** Destino do /tp e do painel: cidade (texto) ou x/z (no mapa onde a conta está, ou Kanto). */
  function destino(u, d) {
    if (d.cidade != null && /^\d{5,9}$/.test(String(d.cidade).trim())) {   // /tp <map id>: the middle of that map (its file's bbox; the world mirrors x)
      const id = String(d.cidade).trim();
      let b = null; try { b = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, id + '.json'), 'utf8')).bbox || null; } catch {}
      if (!b || ![b.x0, b.x1, b.z0, b.z1].every(Number.isFinite)) return { erro: 'No map ' + id + ' (or it has no bounds).' };
      return { mapa: id, x: +(-(b.x0 + b.x1) / 2).toFixed(2), z: +((b.z0 + b.z1) / 2).toFixed(2), nome: 'map ' + id };
    }
    if (d.cidade != null && String(d.cidade).trim()) {
      const p = cidade(d.cidade);
      return p || { erro: `Unknown city: ${d.cidade} (use ${listaCidades()}).` };
    }
    const x = Number(d.x), z = Number(d.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { erro: 'Missing the city or x and z.' };
    const mapa = String(d.mapa || ondeEsta(u)?.mapa || contas[u]?.posGm?.mapa || 'kanto');
    return { mapa, x, z, nome: null };
  }

  /** Painel → /admin/jogador/moderar. `d` = { acao, minutos, motivo, texto, cidade | x z mapa }. */
  function moderar(g, u, acao, d = {}) {
    const minutos = Math.round(+d.minutos || 0), motivo = String(d.motivo || '').slice(0, 120);
    if (acao === 'banir') return banir(g, u, minutos, motivo);
    if (acao === 'perdoar') return perdoar(g, u);
    if (acao === 'mudo') return silenciar(g, u, minutos, motivo);
    if (acao === 'desmutar') return desmutar(g, u);
    if (acao === 'desconectar') return desconectar(g, u, motivo);
    if (acao === 'recado') return recado(g, u, d.texto);
    if (acao === 'levar') { const dest = destino(u, d); return dest.erro ? dest : levar(g, u, dest); }
    if (acao === 'ir') return irAte(g, u, 'go to (panel)');                     // panel "Go there in game": YOUR game goes to them (same as /ir)
    if (acao === 'puxar') {                                                      // panel "Bring to me": they come to where your game is (same as /puxar)
      const eu = ondeEsta(g);
      if (!eu) return { erro: 'Your game is not online: open the game with this GM account first.' };
      return levar(g, u, { ...eu, nome: 'near ' + (contas[g]?.save?.nome || g) }, 'pull (panel)');
    }
    return { erro: 'Unknown action.' };
  }

  // ── /giveitem: item names from menu_data.json, the held list from held.json (re-read when either file changes) ──
  const MAX_STACK = 999;
  let catalog = { key: '', items: {}, held: [] };
  const normalize = s => semAcento(s).replace(/[^a-z0-9]+/g, '');
  function itemCatalog() {
    try {
      const menuFile = nodePath.join(dadosPub, 'menu_data.json'), heldFile = nodePath.join(dadosPub, 'held.json');
      const key = fs.statSync(menuFile).mtimeMs + ':' + (fs.existsSync(heldFile) ? fs.statSync(heldFile).mtimeMs : 0);
      if (key !== catalog.key) {
        const items = JSON.parse(fs.readFileSync(menuFile, 'utf8')).itens || {};
        let held = [];
        try { held = Object.keys(JSON.parse(fs.readFileSync(heldFile, 'utf8')).itens || {}).filter(id => items[id]); } catch {}
        catalog = { key, items, held };
      }
    } catch {}
    return catalog;
  }
  function parseGiveItem(text) {
    let words = text.trim().split(/\s+/).filter(Boolean), player = null, amount = 1;
    const at = words.findIndex(w => w.startsWith('@'));
    if (at >= 0) { player = words[at].slice(1); words.splice(at, 1); }
    if (words.length > 1 && /^x?\d+$/i.test(words[words.length - 1])) amount = +words.pop().replace(/^x/i, '');
    if (!words.length) return { erro: 'Usage: /giveitem <item name or id> [amount] [@player] · /giveitem held gives every held item' };
    if (!(amount >= 1 && amount <= MAX_STACK)) return { erro: 'Amount must be 1 to ' + MAX_STACK };
    const { items, held } = itemCatalog(), query = words.join(' ');
    if (/^held( items?)?$/i.test(query)) return held.length ? { ids: held, amount, player } : { erro: 'No held items are set up' };
    if (/^\d+$/.test(query)) return items[query] ? { ids: [query], amount, player } : { erro: 'No item with id ' + query };
    const q = normalize(query);
    const exact = Object.keys(items).filter(id => normalize(items[id].n) === q);
    if (exact.length) return { ids: [exact[0]], amount, player };
    const partial = Object.keys(items).filter(id => normalize(items[id].n).includes(q));
    if (partial.length === 1) return { ids: partial, amount, player };
    if (!partial.length) return { erro: 'No item called "' + query.slice(0, 40) + '"' };
    return { erro: 'Which one? ' + partial.slice(0, 6).map(id => items[id].n + ' (' + id + ')').join(', ') + (partial.length > 6 ? '…' : '') };
  }

  // ── Chat: {t:'mod_<op>'} (ou {t:'mod', op}) ─────────────────────────────────────────────────────────────────────────
  function comando(ws, m) {
    const g = sessoes.get(ws._info?.token) || null;
    if (!contas[g]?.gm) { enviar(ws, { t: 'mod_erro', erro: 'No permission' }); return; }
    const op = m.t === 'mod' ? String(m.op || '') : String(m.t).slice(4);
    const ok = (o = {}) => enviar(ws, { t: 'mod', op, ...o });
    const erro = e => enviar(ws, { t: 'mod_erro', erro: String(e).replace(/\.$/, '') });   // o network.mjs põe o ponto

    if (op === 'online') {
      const lista = [...conexoes.values()].filter(w => w._info).map(w => {
        const c = contas[w._usuario];
        return { nome: w._info.nome || w._usuario, conta: c ? w._usuario : null, gm: !!c?.gm, mudo: c?.mudoAte > Date.now(), mapa: w._mapa, area: w._info.area || null };
      });
      ok({ lista }); return;
    }
    if (op === 'aviso') {
      const r = avisar(g, m.texto);
      if (r.erro) erro(r.erro); else ok({ n: r.n });
      return;
    }
    if (op === 'patins') {                                                    // /giveskates [name] (Nov 2): Roller Skates in that bag; no name = the GM's own
      const u = m.usuario ? acharConta(m.usuario) : g;
      if (!u) { erro('Account "' + String(m.usuario).slice(0, 30) + '" not found'); return; }
      const c = contas[u]; if (!c.save) c.save = {};
      const s = c.save; if (!s.itens || typeof s.itens !== 'object') s.itens = {};
      if (+s.itens[PATINS] > 0) { ok({ usuario: u, ja: true }); return; }
      s.itens[PATINS] = 1;
      c.rev = (c.rev || 0) + 1;
      salvarContasJa();
      logAdmin(g, u, 'giveskates (chat)', { item: PATINS });
      for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: '🛼 You got Roller Skates! Use them from the Bag (Key items) to put them on.', bolsa: { itens: s.itens } });   // aplicarBolsa writes only the keys sent
      ok({ usuario: u });
      return;
    }
    if (op === 'diamantes') {                                                 // /givediamonds <amount> [@player] (GM): staff credit to the Diamond wallet
      const t = String(m.texto || '').trim(), mt = /^(\d{1,6})(?:\s+@?(\S+))?$/.exec(t);
      if (!mt || !(+mt[1] > 0)) { erro('Usage: /givediamonds <amount> [@player]'); return; }
      const n = Math.min(100000, +mt[1]);
      const u = mt[2] ? acharConta(mt[2]) : g;
      if (!u) { erro('Account "' + mt[2].slice(0, 30) + '" not found'); return; }
      const total = h.darDiamantes?.(u, n);
      if (total == null) { erro('The Diamond wallet is not available'); return; }
      logAdmin(g, u, 'givediamonds (chat)', { amount: n, total });
      if (u !== g) for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: '💎 You got ' + n + ' Diamonds (balance ' + total + ').' });
      ok({ usuario: u, n, total });
      return;
    }
    if (op === 'passe' || op === 'passenivel' || op === 'passereset') {       // /givepass [@player] · /givepasslevel [n] [@player] · /resetpass [@player] (GM): season pass test tools
      const t = String(m.texto || '').trim();
      const mt = op === 'passenivel' ? /^(?:(\d{1,3})\s*)?(?:@?(\S+))?$/.exec(t) : /^(?:@?(\S+))?$/.exec(t);
      const uso = { passe: '/givepass [@player]', passenivel: '/givepasslevel [levels] [@player]', passereset: '/resetpass [@player]' }[op];
      if (!mt) { erro('Usage: ' + uso); return; }
      const quem = op === 'passenivel' ? mt[2] : mt[1];
      const u = quem ? acharConta(quem) : g;
      if (!u) { erro('Account "' + quem.slice(0, 30) + '" not found'); return; }
      const n = op === 'passenivel' ? +(mt[1] || 1) : 0;
      const r = h.temporadaGm?.(u, { passe: 'passe', passenivel: 'nivel', passereset: 'reset' }[op], n);
      if (!r) { erro('The season pass is not available'); return; }
      if (r.erro) { erro(r.erro); return; }
      logAdmin(g, u, { passe: 'givepass', passenivel: 'givepasslevel', passereset: 'resetpass' }[op] + ' (chat)', { n, nivel: r.nivel });
      const texto = op === 'passe' ? '🎟️ Season pass: paid track unlocked for ' + u + '.'
        : op === 'passenivel' ? '🎟️ Season pass: ' + u + ' is now level ' + r.nivel + '/' + r.maxNivel + '.'
        : '🎟️ Season pass: progress of ' + u + ' was reset.';
      if (u !== g) for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: op === 'passereset' ? '🎟️ A GM reset your season pass progress.' : op === 'passe' ? '🎟️ A GM unlocked your paid season pass.' : '🎟️ A GM moved your season pass to level ' + r.nivel + '.' });
      ok({ usuario: u, ...r, texto });
      return;
    }
    if (op === 'item') {                                                      // /giveitem <name | id | held> [amount] [@player] (GM)
      const r = parseGiveItem(String(m.texto || ''));
      if (r.erro) { erro(r.erro); return; }
      const u = r.player ? acharConta(r.player) : g;
      if (!u) { erro('Account "' + r.player.slice(0, 30) + '" not found'); return; }
      const c = contas[u]; if (!c.save) c.save = {};
      const s = c.save;
      for (const k of ['itens', 'bolas']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
      const changed = { itens: {}, bolas: {} };
      for (const id of r.ids) {
        const pocket = itemCatalog().items[id]?.t === 7 ? 'bolas' : 'itens';
        s[pocket][id] = Math.min(MAX_STACK, (+s[pocket][id] || 0) + r.amount);
        changed[pocket][id] = s[pocket][id];
      }
      c.rev = (c.rev || 0) + 1;
      salvarContasJa();
      logAdmin(g, u, 'giveitem (chat)', { ids: r.ids, amount: r.amount });
      const what = r.ids.length === 1 ? itemCatalog().items[r.ids[0]].n + ' ×' + r.amount : r.ids.length + ' items ×' + r.amount;
      const bolsa = {};
      if (Object.keys(changed.itens).length) bolsa.itens = changed.itens;
      if (Object.keys(changed.bolas).length) bolsa.bolas = changed.bolas;
      for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: '🎁 You got ' + what + '.', bolsa });
      ok({ usuario: u, what });
      return;
    }
    const u = op === 'tp' && !m.usuario ? g : acharConta(m.usuario);   // /tp cidade | /tp x z with no name: the GM themself
    if (!u) { erro(m.usuario ? 'Account "' + String(m.usuario).slice(0, 30) + '" not found' : 'Missing the name'); return; }
    const c = contas[u];
    if (u === g && ['mudo', 'kick', 'banir', 'perdoar'].includes(op)) { erro("You can't do that to your own account"); return; }
    const fim = r => { if (r.erro) { erro(r.erro); return; } salvarContasJa(); ok({ usuario: u, ...r }); };

    if (op === 'ver') {
      const ban = banidoAteDe(c);
      ok({ usuario: u, gm: !!c.gm, banidoAte: ban, mudoAte: c.mudoAte > Date.now() ? c.mudoAte : 0, motivo: ban ? c.banMotivo || '' : '' });
    } else if (op === 'mudo') {
      const min = Math.round(+m.minutos);
      if (min === 0) { desmutar(g, u); salvarContasJa(); enviar(ws, { t: 'sistema', texto: '🔊 ' + u + ' can talk again.' }); return; }
      fim(silenciar(g, u, Number.isFinite(min) ? min : 10, String(m.motivo || '').slice(0, 120)));
    } else if (op === 'kick') fim(desconectar(g, u, String(m.motivo || '').slice(0, 120)));
    else if (op === 'banir') {
      const horas = +m.horas;
      fim(banir(g, u, horas === -1 ? -1 : Math.round((Number.isFinite(horas) && horas > 0 ? horas : 24) * 60), String(m.motivo || '').slice(0, 120)));
    } else if (op === 'perdoar') fim(perdoar(g, u));
    else if (op === 'tp') {
      const txt = String(m.destino || '').trim(), xz = txt.match(/^(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)$/);
      const dest = destino(u, xz ? { x: xz[1], z: xz[2] } : { cidade: txt });
      fim(dest.erro ? dest : levar(g, u, dest, 'teleport (chat)'));
    } else if (op === 'puxar') {
      const eu = ondeEsta(g);
      if (!eu) { erro("Couldn't find your position (enter the map first)"); return; }
      fim(levar(g, u, { ...eu, nome: 'near ' + (contas[g]?.save?.nome || g) }, 'pull (chat)'));
    } else if (op === 'ir') {
      const r = irAte(g, u, 'go to (chat)');
      if (r.erro) erro(r.erro);
    } else erro('Unknown command: /' + op);
  }

  /** `entrar` no WS: a conta chegou no mapa do posGm → ele já foi usado (senão ela nasceria ali pra sempre). */
  function aoEntrar(ws, u) {
    const p = contas[u]?.posGm;
    if (p && String(p.mapa) === String(ws._mapa)) {
      /* o destino vira a última posição: sem isso o `entrar` logo depois era recusado como salto sem porta (aceitarPos, > 40 m ou
         outro mapa) e o `pos` ficava no lugar antigo — o próximo F5/login devolvia a conta pra onde estava presa */
      contas[u].pos = { mapa: String(p.mapa), x: +p.x, y: 0, z: +p.z, giro: +p.giro || 0, em: Date.now(), ...(+p.chegada > 0 ? { chegada: +p.chegada } : {}) };   // chegada: a shared Center floor keeps its town (escalators)
      delete contas[u].posGm; salvarContasJa();
    }
  }

  return { moderar, comando, aoEntrar, acharConta, cidade };
}
