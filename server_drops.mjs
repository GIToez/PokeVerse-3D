/* ITEM DROPS on the server. The engine is drop.mjs (from upcoming/), the rules public/data/drops.json (admin panel → Data
 * files → Item drops). Sources: selvagem (wild KO in the shared world), treinador, ginasio, missao, elite, raid.
 * What drops goes into the bag (save.itens) and the player gets a chat line + the new bag. Per-account quotas and the
 * history live in c.drop (the engine's own state).
 *
 *   drops.roll(u, { fonte, dex, lv, lvMeu, tipos, shiny, parte, maior, lugar, chave, primeira, revanche, contribuicao, insignias }) */
import fs from 'node:fs';
import nodePath from 'node:path';
import { Drop } from './drop.mjs';

export function createDrops({ accounts, dataDir, send, socketsOf, saveAccounts, logAdmin = null }) {
  const file = nodePath.join(dataDir, 'drops.json');
  let cache = { mt: -1, engine: null };
  let itemNames = null;
  /** Item names in English (the item files are Portuguese; locale/content_en.json and ui_en.json translate them). */
  const EN = { 900020: 'Common TM Piece', 900021: 'Strong TM Piece', 900022: 'Rare TM Piece' };
  const names = () => {
    if (!itemNames) {
      itemNames = {};
      let dict = {};
      for (const f of ['locale/ui_en.json', 'locale/content_en.json']) { try { Object.assign(dict, JSON.parse(fs.readFileSync(nodePath.join(dataDir, f), 'utf8'))); } catch {} }
      for (const f of ['menu_data.json', 'itens_novos.json']) {
        try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(nodePath.join(dataDir, f), 'utf8')).itens || {})) if (!itemNames[k] && v?.n) itemNames[k] = { n: EN[k] || (typeof dict[v.n] === 'string' ? dict[v.n] : v.n) }; } catch {}
      }
    }
    return itemNames;
  };
  /** The engine for the current drops.json (rebuilt when the file changes). */
  function engine() {
    let mt = -2;
    try { mt = fs.statSync(file).mtimeMs; } catch {}
    if (mt !== cache.mt) {
      let T = null;
      try { T = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.warn('[drops] drops.json:', e.message); }
      cache = { mt, engine: T ? new Drop({ ...T, itens: names() }, { fusoMin: T.fusoMin ?? -180 }) : null };
    }
    return cache.engine;
  }
  /** Rolls one event for one account; gives the items, tells the player. Returns the items given. */
  function roll(u, ev) {
    const c = accounts[u], D = engine();
    if (!c?.save || !D || !ev?.fonte) return [];
    const regra = D.T.regraKo || {};
    const r = D.rolar(c, { ...ev, insignias: ev.insignias ?? (Array.isArray(c.save.insignias) ? c.save.insignias.length : 0),
      minParte: regra.minParte ?? 0.1, maxContas: regra.maxContas ?? 4, folgaNivel: regra.folgaNivel ?? 10 });
    if (!r.itens.length) return [];
    const s = c.save;
    if (!s.itens || typeof s.itens !== 'object') s.itens = {};
    for (const it of r.itens) s.itens[it.id] = (+s.itens[it.id] || 0) + it.qtd;
    c.rev = (c.rev || 0) + 1;
    saveAccounts();
    const txt = r.itens.map(it => it.qtd + '× ' + it.nome).join(', ');
    for (const w of socketsOf(u)) {
      send(w, { t: 'bolsa', op: 'drop', bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens, bolas: s.bolas } });
      send(w, { t: 'sistema', texto: '🎁 ' + txt });
    }
    return r.itens;
  }
  /** Admin: one account's quotas and its last drops. */
  function summary(u) {
    const c = accounts[u], D = engine();
    if (!c || !D) return null;
    return { resumo: D.resumo(c), historico: (c.drop?.historico || []).slice(-50).reverse() };
  }
  return { roll, summary, engine };
}
