/* PARTY + INSPECT (Nov 6): the player card's Party and Inspect buttons.
 * PARTY: up to 4 trainers. Invites last 60 s; the leader can remove members; anyone can leave. A party shares "Focus this one"
 * pings outside raids (V) and is what the 2x2 tournament format will use. Kept in memory (a restart breaks parties up).
 *   { t: 'grupo_convidar', id | nome }  { t: 'grupo_aceitar', de }  { t: 'grupo_recusar', de }  { t: 'grupo_sair' }  { t: 'grupo_expulsar', user }
 *   → members get { t: 'grupo', grupo: { lider, membros: [{ user, nick, id, online, lider }] } | null }, the invited { t: 'grupo_convite', de, nick }
 * INSPECT: { t: 'inspecionar', id } (a player on the same map) → { t: 'inspecao', id, nick, time: [{ dex, glb, lv, nome, shiny }], insignias, campeao }
 *   const party = createParty({ accounts, send, socketsOf, connections, nick })
 *   party.receber(ws, u, m) → true when it handled the message · party.membrosDe(u) → [user] (u's party, u included) */
const MAX = 4, CONVITE_MS = 60e3;

export function createParty({ accounts, send, socketsOf, connections, nick, extra = null }) {   // extra: { mestre(u), saber(save) → { mestres, estudadas } }
  const grupos = new Map(), deQuem = new Map(), convites = new Map();   // id → { id, lider, membros: Set }, user → id, invited user → { de, ate }
  let seq = 0;
  const focoEm = new Map();
  const wsDe = (id) => [...connections()].find((w) => String(w._id) === String(id)) || null;
  const avisar = (u, m) => { for (const w of socketsOf(u)) send(w, m); };
  const texto = (ws, t) => send(ws, { t: 'sistema', texto: t });
  function vista(g) {
    return g ? { lider: g.lider, membros: [...g.membros].map((u) => ({ user: u, nick: nick(u), id: socketsOf(u)[0]?._id ?? null, online: socketsOf(u).length > 0, lider: u === g.lider })) } : null;
  }
  const espalhar = (g) => { const v = vista(g); for (const u of g.membros) avisar(u, { t: 'grupo', grupo: v }); };
  function sair(u, motivo = 'saiu') {
    const id = deQuem.get(u), g = id && grupos.get(id);
    if (!g) return;
    g.membros.delete(u); deQuem.delete(u);
    avisar(u, { t: 'grupo', grupo: null, motivo });
    if (g.membros.size <= 1) { for (const o of g.membros) { deQuem.delete(o); avisar(o, { t: 'grupo', grupo: null, motivo: 'vazio' }); } grupos.delete(id); return; }
    if (g.lider === u) g.lider = [...g.membros][0];
    espalhar(g);
  }
  function receber(ws, u, m) {
    const t = m?.t;
    if (t === 'inspecionar') {
      const w = wsDe(m.id), o = w?._usuario, c = o && accounts[o];
      if (!w || w._mapa !== ws._mapa || !c?.save) { send(ws, { t: 'inspecao', id: m.id, erro: 'That trainer is not here any more.' }); return true; }
      const s = c.save, dex = s.dex && typeof s.dex === 'object' ? s.dex : {}, pego = (v) => v === 'pego' || v === 'caught';
      const todos = [...(s.time || []), ...(s.caixa || [])].filter(Boolean);
      send(ws, { t: 'inspecao', id: m.id, nick: nick(o), insignias: Array.isArray(s.insignias) ? s.insignias.slice(0, 16) : [], campeao: !!s.elite?.vencida,
        tempo: +s.tempo || 0, caixa: (s.caixa || []).length, personagem: s.personagem || null, mestre: extra?.mestre?.(o) || null,
        vistos: Object.keys(dex).length, pegos: Object.values(dex).filter(pego).length,
        kantoVistos: Object.keys(dex).filter((n) => +n >= 1 && +n <= 151).length, kantoPegos: Object.entries(dex).filter(([n, v]) => +n >= 1 && +n <= 151 && pego(v)).length,
        shinies: todos.filter((p) => p.shiny).length, ...(extra?.saber?.(s) || {}),
        time: (s.time || []).filter((p) => p && !p.ovo).slice(0, 6).map((p) => ({ dex: +p.dex, glb: p.glb || null, lv: +p.lv || 1, nome: p.nome || '', shiny: !!p.shiny })) });
      return true;
    }
    if (!String(t || '').startsWith('grupo_')) return false;
    if (!u) { texto(ws, 'Parties need an account.'); return true; }
    if (t === 'grupo_convidar') {
      const w = m.id != null ? wsDe(m.id) : null, alvo = w?._usuario || (m.nome ? Object.keys(accounts).find((k) => k === String(m.nome).toLowerCase() || String(accounts[k]?.save?.nome || '').toLowerCase() === String(m.nome).toLowerCase()) : null);
      if (!alvo || !socketsOf(alvo).length) { texto(ws, "That trainer isn't online."); return true; }
      if (alvo === u) { texto(ws, "You can't invite yourself."); return true; }
      if (deQuem.has(alvo)) { texto(ws, nick(alvo) + ' is already in a party.'); return true; }
      const g = grupos.get(deQuem.get(u));
      if (g && g.lider !== u) { texto(ws, 'Only the party leader can invite.'); return true; }
      if (g && g.membros.size >= MAX) { texto(ws, 'Your party is full (' + MAX + ').'); return true; }
      convites.set(alvo, { de: u, ate: Date.now() + CONVITE_MS });
      avisar(alvo, { t: 'grupo_convite', de: u, nick: nick(u) });
      texto(ws, '👥 Party invite sent to ' + nick(alvo) + '.');
      return true;
    }
    if (t === 'grupo_aceitar' || t === 'grupo_recusar') {
      const c = convites.get(u), de = String(m.de || '').toLowerCase();
      if (!c || c.de !== de || c.ate < Date.now()) { texto(ws, 'That invite has expired.'); convites.delete(u); return true; }
      convites.delete(u);
      if (t === 'grupo_recusar') { avisar(de, { t: 'sistema', texto: nick(u) + ' declined the party invite.' }); return true; }
      if (deQuem.has(u)) sair(u);
      let g = grupos.get(deQuem.get(de));
      if (!g) { g = { id: ++seq, lider: de, membros: new Set([de]) }; grupos.set(g.id, g); deQuem.set(de, g.id); }
      if (g.membros.size >= MAX) { texto(ws, 'That party is full.'); return true; }
      g.membros.add(u); deQuem.set(u, g.id);
      espalhar(g);
      for (const o of g.membros) avisar(o, { t: 'sistema', texto: '👥 ' + nick(u) + ' joined the party.' });
      return true;
    }
    if (t === 'grupo_sair') { sair(u); return true; }
    if (t === 'grupo_expulsar') {
      const g = grupos.get(deQuem.get(u)), alvo = String(m.user || '').toLowerCase();
      if (!g || g.lider !== u || !g.membros.has(alvo) || alvo === u) { texto(ws, 'Only the leader can remove someone from the party.'); return true; }
      sair(alvo, 'removido');
      avisar(alvo, { t: 'sistema', texto: 'You were removed from the party.' });
      return true;
    }
    if (t === 'grupo_foco') {   // "Focus this one" outside raids: the party members on the same map see the ping
      const g = grupos.get(deQuem.get(u)), agora = Date.now();
      if (!g || agora - (focoEm.get(u) || 0) < 2000) return true;
      focoEm.set(u, agora);
      const alvo = m.alvo == null ? null : String(m.alvo).slice(0, 40);
      for (const o of g.membros) for (const w of socketsOf(o)) if (w._mapa === ws._mapa) send(w, { t: 'foco', de: nick(u), alvo });
      return true;
    }
    if (t === 'grupo_ver') { send(ws, { t: 'grupo', grupo: vista(grupos.get(deQuem.get(u))) }); return true; }
    return false;
  }
  const membrosDe = (u) => { const g = grupos.get(deQuem.get(u)); return g ? [...g.membros] : [u]; };
  return { receber, membrosDe, sair };
}
