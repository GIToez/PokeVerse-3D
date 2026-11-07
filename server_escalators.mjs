/* ESCALATORS BETWEEN FLOORS (Nov 7). The client rides an escalator (escalator_anim.mjs) and, at the far end, asks {t:'escada', peca};
 * this checks the link (public/data/escadas_rolantes.json), that the player stands by that escalator on that map, and sends them to the
 * other floor the way a GM teleport does: posGm on the account (the destination escalator) + {t:'volta', mapa}. The client stamps the
 * arrival in its tab, so the new floor starts with the player riding the other escalator into the room.
 * The Pokémon Center 1F is one map for every town: the town you came from (pos.chegada on 1F) is kept on the account and given back
 * when you ride down/up to 1F again, so its exit still leads to your town's street. */
import fs from 'node:fs';
import nodePath from 'node:path';

const PERTO = 6;   // m from the escalator's placement

export function createEscalators({ dataPub, accounts, send, saveAccounts, log = () => {} }) {
  let cache = { t: 0, d: null };
  const dados = () => { if (Date.now() - cache.t > 10e3) { try { cache = { t: Date.now(), d: JSON.parse(fs.readFileSync(nodePath.join(dataPub, 'escadas_rolantes.json'), 'utf8')) }; } catch { cache = { t: Date.now(), d: cache.d || { ligacoes: [] } }; } } return cache.d || { ligacoes: [] }; };
  const mapas = new Map();
  /** Where an escalator stands on a map, in world coordinates (the map files mirror x). */
  function ondeEsta(mapa, peca) {
    let d = mapas.get(mapa);
    if (!d || Date.now() - d.t > 60e3) { try { d = { t: Date.now(), o: JSON.parse(fs.readFileSync(nodePath.join(dataPub, mapa + '.json'), 'utf8')).objetos || [] }; } catch { d = { t: Date.now(), o: [] }; } mapas.set(mapa, d); }
    const o = d.o.find(x => String(x.n || '').toLowerCase() === peca);
    return o ? { x: -(+o.x || 0), z: +o.z || 0 } : null;
  }
  function receber(ws, m) {
    const u = ws._usuario, c = u && accounts[u]; if (!c) return;
    const aqui = String(ws._cena || ws._mapa || ''), peca = String(m.peca || '').toLowerCase();
    const l = (dados().ligacoes || []).find(x => String(x.de?.mapa) === aqui && String(x.de?.peca).toLowerCase() === peca);
    if (!l) return send(ws, { t: 'sistema', texto: "This escalator doesn't go anywhere yet." });
    const de = ondeEsta(aqui, peca), para = ondeEsta(String(l.para.mapa), String(l.para.peca).toLowerCase());
    const x = +ws._info?.x, z = +ws._info?.z;
    if (!de || !para || !(Math.hypot(x - de.x, z - de.z) <= PERTO)) return send(ws, { t: 'sistema', texto: "You're not on that escalator." });
    if (c.pos?.chegada && String(c.pos.mapa) === aqui) c.escadaChegada = { mapa: aqui, chegada: c.pos.chegada };   // the town of this shared floor
    const volta = c.escadaChegada && String(c.escadaChegada.mapa) === String(l.para.mapa) ? c.escadaChegada.chegada : null;
    c.posGm = { mapa: String(l.para.mapa), x: +para.x.toFixed(2), z: +para.z.toFixed(2), giro: 0, ...(volta ? { chegada: volta } : {}) };
    saveAccounts();
    log('escalator', u, aqui + ' → ' + l.para.mapa);
    send(ws, { t: 'volta', mapa: String(l.para.mapa), texto: '…' });
  }
  return { receber };
}
