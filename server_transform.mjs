/* TRANSFORM on the server: Ditto copies a nearby Pokémon (a wild one, another player's partner, or one of your own party)
 * for 30 minutes in the overworld. The engine is transform.mjs (from upcoming/), the rules public/data/transform.json.
 * This file only adapts the live server to the engine's `amb` hooks.
 *
 *   {t:'transformar', uid, alvo: { tipo: 'selvagem'|'jogador'|'time', id|uid }}   → {t:'transf', uid, ok, transf?, texto, erro?}
 *   {t:'destransformar', uid}                                                    → {t:'transf', uid, ok, transf: null, motivo}
 * A transformed partner is shown to the room with the copied model (`parceiro` + `transf`); it changes back when the time runs
 * out, on a faint, a partner swap, a map change, or on request. In the world it fights with the copied types and stats. */
import fs from 'node:fs';
import nodePath from 'node:path';
import * as Transf from './transform.mjs';

export function createTransform({ accounts, dataDir, send, socketsOf, onMap, world, wilds, battle, saveAccounts, broadcast }) {
  const rules = JSON.parse(fs.readFileSync(nodePath.join(dataDir, 'transform.json'), 'utf8'));
  Transf.usarDados(rules);
  let pokedex = null, moves = null;
  const species = dex => {
    if (!pokedex) { pokedex = new Map(); try { for (const s of JSON.parse(fs.readFileSync(nodePath.join(dataDir, '..', 'pokedex.json'), 'utf8')).species || []) if (!pokedex.has(+s.n)) pokedex.set(+s.n, s); } catch {} }
    const s = pokedex.get(+dex);
    return s ? { name: s.name, types: s.types || [], bs: s.bs || [] } : null;
  };
  const moveExists = id => {
    if (!moves) { try { moves = JSON.parse(fs.readFileSync(nodePath.join(dataDir, 'moves.json'), 'utf8')); } catch { moves = {}; } }
    return !!moves[id];
  };
  const pad = n => String(Math.max(0, Math.round(+n || 0))).padStart(4, '0');
  const allMons = c => [...(Array.isArray(c?.save?.time) ? c.save.time : []), ...(Array.isArray(c?.save?.caixa) ? c.save.caixa : [])];

  /** The engine's view of one connection (a stable object per socket, read live). */
  const playerOf = ws => ws._transf || (ws._transf = {
    ws,
    get conta() { return ws._usuario || null; },
    get mapa() { return ws._mapa || null; },
    get uidParceiro() { return ws._info?.uid ?? null; },
    get parceiro() { return ws._info?.parceiro || null; },
    get nome() { return ws._info?.nome || ws._usuario || ''; },
    get id() { return ws._id; },
    get px() { return ws._info?.px ?? null; },
    get pz() { return ws._info?.pz ?? null; },
  });

  const engine = new Transf.Transformacao(null, {
    agora: () => Date.now(),
    conta: j => { const c = j?.conta ? accounts[j.conta] : null; if (c && !c.usuario) c.usuario = j.conta; return c; },
    contaPorNome: u => accounts[u] || null,
    conexaoDe: u => { const w = socketsOf(u)[0]; return w ? playerOf(w) : null; },
    emBatalha: j => !!battle?.emLuta?.(j.conta),
    enviar: (j, m) => send(j.ws, m),
    especie: species,
    glbDoDex: dex => 'pm' + pad(dex) + '_00',
    golpeExiste: moveExists,
    golpesDoSelvagem: w => (Array.isArray(w?.ind?.movs) ? w.ind.movs : []).map(m => m?.id ?? m),
    jogadorNaSala: (map, id) => { const w = onMap(map).find(x => String(x._id) === String(id)); return w ? playerOf(w) : null; },
    log: s => console.log(s),
    mon: (c, uid) => { const p = allMons(c).find(x => x && String(x.uid) === String(uid)); return p ? { dex: p.dex, ficha: p, ovo: !!p.ovo } : null; },
    noTime: (c, uid) => (Array.isArray(c?.save?.time) ? c.save.time : []).some(x => x && String(x.uid) === String(uid)),
    posicao: j => (j.ws._info && Number.isFinite(+j.ws._info.x) ? { x: +j.ws._info.x, z: +j.ws._info.z } : null),
    remontar: (j, info) => announce(j.ws, info),
    salvar: () => saveAccounts(),
    selvagem: (map, id) => {
      const w = world?.wild?.(map, id);
      return w ? { id: w.id, dex: w.dex, lv: w.lv, hp: w.hp, estado: w.state, x: w.x, z: w.z, ind: w.ind, chefe: !!w.chefe } : null;
    },
    teto: c => { try { return wilds?.levelCap?.(c.save); } catch { return null; } },
    transformados: c => allMons(c).filter(p => p?.transf).map(p => String(p.uid)),
  });

  /** What the room should draw for this player's partner: the copied model while transformed. */
  function shown(ws) {
    const c = ws._usuario ? accounts[ws._usuario] : null, uid = ws._info?.uid;
    return c && uid != null ? engine.exibido(c, uid, { cena: ws._mapa }) : null;
  }
  function announce(ws, info = {}) {
    const s = shown(ws), i = ws._info || {};
    broadcast(ws, { t: 'parceiro', id: ws._id, parceiro: s?.glb || i.parceiro || null, pshiny: s ? s.shiny : !!i.shiny, montaria: i.montaria || null,
      ...(s ? { transf: { dex: s.dex, nome: s.nome, ...(info.transformou ? { de: info.transformou.de } : {}) } } : {}) });
  }

  setInterval(() => { try { engine.tique(); } catch (e) { console.warn('[transform] tick:', e.message); } }, Math.max(1, +rules.regras?.varreduraS || 1) * 1000).unref?.();

  return {
    receive(ws, m) { return engine.receber(playerOf(ws), m); },
    /** After `entrar`: undo what can't carry over (time ran out, another map, a different partner). */
    joined(ws) { try { engine.entrouNaSala(playerOf(ws)); } catch (e) { console.warn('[transform] join:', e.message); } },
    /** The partner changed (`parceiro` message): undo the old one if it was transformed. */
    partnerChanged(ws, oldUid) { try { if (oldUid != null) engine.mudouEmCampo(playerOf(ws), oldUid); } catch (e) { console.warn('[transform] swap:', e.message); } },
    fainted(ws, uid) { try { engine.desmaiou(playerOf(ws), uid); } catch {} },
    /** The look others get on join / in the player list: the copied model while transformed. */
    shown,
  };
}
