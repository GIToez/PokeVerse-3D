/* TRADE SERVER (Nov 6) — the trade table in trade.mjs, played out on the server so neither side can cheat. Before this the
 * server only echoed `troca_*` messages to the whole map and nothing ever changed hands.
 *   client → { t: 'troca_convidar', para: id }              invite the player with that connection id (player card → Trade)
 *            { t: 'troca_responder', de: id, ok }           accept / decline an invite
 *            { t: 'troca_ofertar', itens: [{ onde: 'time'|'caixa', i }] }   what I put on the table (up to MAX)
 *            { t: 'troca_confirmar', ok }                   lock in (any change to the table clears both confirmations)
 *            { t: 'troca_pronto' }                          my client has pushed its save (after troca_salvar)
 *            { t: 'troca_sair' }                            leave
 *   server → troca_convite { de, nome } · troca_convidou { nome } · troca_recusou { nome } · troca_abriu { com: { id, nome }, maxItens }
 *            troca_estado { dele, confirmei, confirmou, fase, com } · troca_salvar · troca_feita { save, rev, com, dei, recebi }
 *            troca_aviso { motivo } · troca_cancelou { motivo }
 * Rules: both signed in, on the same map, not in a battle; up to MAX Pokémon each; locked Pokémon (travado) can't go; each
 * side must keep at least one Pokémon in the party. The offer is remembered by uid, so a Pokémon that moved or left meanwhile
 * cancels the trade instead of swapping the wrong one. What you receive joins the party while there is room, then the Box. */
const MAX = 3, CONVITE_MS = 30000, SALVAR_MS = 10000;

export function createTrade({ accounts, send, saveAccounts, conexoes, usuarioDe, nomeDe, emLuta = () => false }) {
  const convites = new Map();   // target connection id → { de: inviter id, em }
  const mesas = new Map();      // connection id → mesa (both ids point at the same object)
  const ws = id => conexoes.get(+id) || conexoes.get(String(id)) || null;
  const lado = (m, id) => (String(m.a.id) === String(id) ? m.a : m.b);
  const outro = (m, id) => (String(m.a.id) === String(id) ? m.b : m.a);
  const resumo = p => ({ uid: p.uid, dex: p.dex, nome: p.nome, lv: p.lv || 1, glb: p.glb, shiny: !!p.shiny });

  function monDe(save, onde, i) {
    const L = onde === 'time' ? save.time : onde === 'caixa' ? save.caixa : null;
    return Array.isArray(L) ? L[+i] || null : null;
  }
  function estado(m) {
    for (const L of [m.a, m.b]) {
      const O = L === m.a ? m.b : m.a, w = ws(L.id);
      if (w) send(w, { t: 'troca_estado', dele: O.oferta.map(resumo), confirmei: L.ok, confirmou: O.ok, fase: m.fase, com: { id: O.id, nome: O.nome } });
    }
  }
  function fechar(m, motivo, soEste = null) {
    for (const L of [m.a, m.b]) { mesas.delete(String(L.id)); const w = ws(L.id); if (w && L.id !== soEste) send(w, { t: 'troca_cancelou', motivo }); }
    clearTimeout(m.relogio);
  }
  function aviso(w, motivo) { send(w, { t: 'troca_aviso', motivo }); }

  function concluir(m) {
    clearTimeout(m.relogio);
    const A = accounts[m.a.u], B = accounts[m.b.u];
    if (!A?.save || !B?.save) return fechar(m, 'an account is missing');
    const tirar = (save, oferta) => {
      const out = [];
      for (const o of oferta) {
        const L = [save.time, save.caixa].find(l => Array.isArray(l) && l.some(p => String(p?.uid) === String(o.uid)));
        if (!L) return null;
        out.push(L.find(p => String(p?.uid) === String(o.uid)));
      }
      return out;
    };
    const dA = tirar(A.save, m.a.oferta), dB = tirar(B.save, m.b.oferta);
    if (!dA || !dB) return fechar(m, 'a Pokémon on the table changed before the trade closed');
    if (!dA.length && !dB.length) return fechar(m, 'mesa vazia');
    const sobra = (save, sai, entra) => (save.time || []).filter(p => !sai.includes(p)).length + entra.length;
    if (sobra(A.save, dA, dB) < 1 || sobra(B.save, dB, dA) < 1) return fechar(m, 'each trainer must keep at least one Pokémon in the party');
    const mover = (save, sai, entra) => {
      save.time = (save.time || []).filter(p => !sai.includes(p));
      save.caixa = (save.caixa || []).filter(p => !sai.includes(p));
      for (const p of entra) { delete p.seguindo; (save.time.length < 6 ? save.time : save.caixa).push(p); }
      if (save.seguidorUid != null && sai.some(p => String(p.uid) === String(save.seguidorUid))) delete save.seguidorUid;
    };
    mover(A.save, dA, dB); mover(B.save, dB, dA);
    for (const [c, entra] of [[A, dB], [B, dA]]) {
      if (!c.save.dex || typeof c.save.dex !== 'object') c.save.dex = {};
      for (const p of entra) c.save.dex[+p.dex] = 'pego';
      c.rev = (c.rev || 0) + 1;
    }
    saveAccounts();
    for (const [L, c, dei, recebi] of [[m.a, A, dA, dB], [m.b, B, dB, dA]]) {
      mesas.delete(String(L.id));
      const w = ws(L.id);
      if (w) send(w, { t: 'troca_feita', save: c.save, rev: c.rev, com: outro(m, L.id).nome, dei: dei.map(resumo), recebi: recebi.map(resumo) });
    }
    console.log(`[trade] ${m.a.u} ⇄ ${m.b.u}: ${dA.map(p => p.nome).join(', ') || '—'} for ${dB.map(p => p.nome).join(', ') || '—'}`);
  }

  function receber(w, m) {
    const t = m?.t;
    if (!t?.startsWith('troca_')) return false;
    const u = usuarioDe(w), id = w._id;
    if (!u || !accounts[u]) { aviso(w, 'sign in with an account to trade'); return true; }

    if (t === 'troca_convidar') {
      const alvo = ws(m.para), uAlvo = alvo && usuarioDe(alvo);
      if (!alvo || !uAlvo || alvo === w) return aviso(w, 'that trainer is not nearby'), true;
      if (uAlvo === u) return aviso(w, 'you cannot trade with yourself'), true;
      if (alvo._mapa !== w._mapa) return aviso(w, 'stay on the same map to trade'), true;
      if (mesas.has(String(id)) || mesas.has(String(alvo._id))) return aviso(w, 'one of you is already trading'), true;
      if (emLuta(w) || emLuta(alvo)) return aviso(w, 'finish the battle first'), true;
      convites.set(String(alvo._id), { de: id, em: Date.now() });
      send(alvo, { t: 'troca_convite', de: id, nome: nomeDe(w) });
      send(w, { t: 'troca_convidou', nome: nomeDe(alvo) });
      return true;
    }
    if (t === 'troca_responder') {
      const cv = convites.get(String(id));
      convites.delete(String(id));
      const de = cv && String(cv.de) === String(m.de) && Date.now() - cv.em < CONVITE_MS + 5000 ? ws(cv.de) : null;
      if (!de) { if (m.ok) aviso(w, 'that invite expired'); return true; }
      if (!m.ok) { send(de, { t: 'troca_recusou', nome: nomeDe(w) }); return true; }
      const uDe = usuarioDe(de);
      if (!uDe || de._mapa !== w._mapa || mesas.has(String(id)) || mesas.has(String(de._id))) { aviso(w, 'the trade could not start'); return true; }
      const mesa = { fase: 'montando', a: { id: de._id, u: uDe, nome: nomeDe(de), oferta: [], ok: false }, b: { id, u, nome: nomeDe(w), oferta: [], ok: false } };
      mesas.set(String(de._id), mesa); mesas.set(String(id), mesa);
      send(de, { t: 'troca_abriu', com: { id, nome: mesa.b.nome }, maxItens: MAX });
      send(w, { t: 'troca_abriu', com: { id: de._id, nome: mesa.a.nome }, maxItens: MAX });
      estado(mesa);
      return true;
    }
    const mesa = mesas.get(String(id));
    if (!mesa) return true;
    const eu = lado(mesa, id);
    if (t === 'troca_sair') { fechar(mesa, nomeDe(w) + ' left the trade', id); return true; }
    if (mesa.fase !== 'montando' && t !== 'troca_pronto') return true;
    if (t === 'troca_ofertar') {
      const save = accounts[u].save || {}, nova = [], vistos = new Set();
      for (const x of (Array.isArray(m.itens) ? m.itens : []).slice(0, MAX)) {
        const p = monDe(save, x?.onde, x?.i);
        if (!p || p.uid == null || vistos.has(String(p.uid))) continue;
        if (p.travado) { aviso(w, (p.nome || 'that Pokémon') + ' is locked: unlock it before trading it'); continue; }
        vistos.add(String(p.uid)); nova.push(p);
      }
      eu.oferta = nova.map(p => ({ ...resumo(p) }));
      mesa.a.ok = mesa.b.ok = false;     // the table changed: both confirm again
      estado(mesa);
      return true;
    }
    if (t === 'troca_confirmar') {
      eu.ok = !!m.ok;
      const O = outro(mesa, id);
      if (eu.ok && O.ok) {
        if (!mesa.a.oferta.length && !mesa.b.oferta.length) { mesa.a.ok = mesa.b.ok = false; for (const L of [mesa.a, mesa.b]) { const x = ws(L.id); if (x) send(x, { t: 'troca_cancelou', motivo: 'mesa vazia' }); } estado(mesa); return true; }
        mesa.fase = 'salvando'; mesa.prontos = new Set();
        estado(mesa);
        for (const L of [mesa.a, mesa.b]) { const x = ws(L.id); if (x) send(x, { t: 'troca_salvar' }); }
        mesa.relogio = setTimeout(() => concluir(mesa), SALVAR_MS);   // a client that never answers: close with the saves we have
      } else estado(mesa);
      return true;
    }
    if (t === 'troca_pronto' && mesa.fase === 'salvando') {
      mesa.prontos.add(String(id));
      if (mesa.prontos.size >= 2) concluir(mesa);
      return true;
    }
    return true;
  }
  /** A connection closed: drop its invite and cancel its table. */
  function saiu(w) {
    convites.delete(String(w._id));
    const mesa = mesas.get(String(w._id));
    if (mesa) fechar(mesa, nomeDe(w) + ' left', w._id);
  }
  const ocupado = w => mesas.has(String(w._id));
  return { receber, saiu, ocupado };
}
