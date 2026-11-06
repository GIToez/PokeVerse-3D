/* FERRY (Nov 6): the Vermilion ferry (v2 popup `balsa`, ferry_ui.mjs) — Vermilion, the Competition Center, the Sevii Islands and
 * Olivine (Johto, greyed out until it opens). Stops live in public/data/ferry.json (admin → Ferry stops).
 * A stop opens from its dock door (walking onto it) or its Sailor NPC; the server checks the stop's rules (7 Badges, Elite Four,
 * "not open yet") and answers with where to go. GM accounts sail anywhere that is open.
 *   const ferry = createFerry({ accounts, send, readJson })
 *   ferry.receber(ws, u, m)   // { t: 'balsa_vista', porta } → the stops as this player sees them
 *                             // { t: 'balsa', porta, parada } → { t: 'balsa', ok, mapa, chegada, nome } | { ok: false, texto } */
import { paradasDe, paradaDaPorta, porqueFechada } from './ferry_rules.mjs';

export function createFerry({ accounts, send, readJson }) {
  const dados = () => readJson?.('ferry') || { paradas: [] };
  const quem = (u) => {
    const c = accounts[u], s = c?.save || {};
    return { gm: !!c?.gm, insignias: Array.isArray(s.insignias) ? s.insignias.length : 0, campeao: !!s.elite?.vencida, visitas: Array.isArray(s.balsaVisitas) ? s.balsaVisitas : [] };
  };
  const fechada = (p, q) => (p.fechada ? porqueFechada(p, q) : q.gm ? null : porqueFechada(p, q));
  function vista(u, porta) {
    const D = dados(), L = paradasDe(D), q = quem(u), aqui = paradaDaPorta(L, porta);
    return {
      t: 'balsa_vista', ok: true, porta: +porta || 0,
      paradas: L.map((p) => {
        const f = fechada(p, q);
        return { id: p.id, nome: p.nome, mapa: p.mapa, chegada: p.chegada, area: p.area, aberta: !f, texto: f?.texto || null, motivo: f?.motivo || null,
          aqui: p.id === aqui?.id, visitada: q.visitas.includes(p.id) };
      }),
    };
  }
  function receber(ws, u, m) {
    if (!u) { send(ws, { t: m?.t === 'balsa_vista' ? 'balsa_vista' : 'balsa', ok: false, texto: 'The ferry needs an account.' }); return; }
    if (m.t === 'balsa_vista') { send(ws, vista(u, m.porta)); return; }
    if (m.t !== 'balsa') return;
    const L = paradasDe(dados()), P = L.find((p) => p.id === String(m.parada || ''));
    const de = paradaDaPorta(L, m.porta);
    if (!P) { send(ws, { t: 'balsa', ok: false, texto: "That stop doesn't exist." }); return; }
    if (de && de.id === P.id) { send(ws, { t: 'balsa', ok: false, texto: 'You are already here.' }); return; }
    const f = fechada(P, quem(u));
    if (f) { send(ws, { t: 'balsa', ok: false, texto: f.texto }); return; }
    const s = accounts[u]?.save;
    if (s) { const v = Array.isArray(s.balsaVisitas) ? s.balsaVisitas : (s.balsaVisitas = []); if (!v.includes(P.id) && v.length < 64) v.push(P.id); }
    send(ws, { t: 'balsa', ok: true, mapa: P.mapa, chegada: P.chegada, nome: P.nome });
  }
  return { receber, vista };
}
