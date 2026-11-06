/* IN-GAME STAFF TOOLS (Nov 6) — what upcoming/staff_ui.mjs asks ("★ Staff" button, for GMs and staff / mod accounts):
 *   { t: 'staff', op: 'ver' }                         → the state + the species list for the follower picker
 *   { t: 'staff', op: 'livre', valor: true|false }    Free path: locks and mount licences don't apply (off = play like any player)
 *   { t: 'staff', op: 'seguidor', dex, shiny } / { dex: null }   a cosmetic Pokémon following you, seen by everyone
 *   → { t: 'staff', livre, padrao, seguidor: { glb, dex, shiny } | null, especies?, op?, mudou? } · non-staff → { t: 'staff', fora: true }
 * Everyone on the map hears { t: 'seguidor_staff', id, seguidor } (network.mjs draws it). Stored on the account: c.staffLivre (GMs
 * start with it on: they get everything), c.staffSeguidor. */
export function createStaff({ accounts, send, broadcastMapa, especies }) {
  const ehStaff = (c) => !!c && (c.gm === true || c.cargo === 'staff' || c.cargo === 'mod');
  const livreDe = (c) => (typeof c.staffLivre === 'boolean' ? c.staffLivre : true);
  function estado(c, extra = {}) {
    return { t: 'staff', livre: livreDe(c), padrao: typeof c.staffLivre !== 'boolean', seguidor: c.staffSeguidor || null, ...extra };
  }
  /** Fields for this player in the map's player list (infoJogador): their staff follower. */
  const info = (ws) => { const c = accounts[ws._usuario]; return ehStaff(c) && c.staffSeguidor ? { seguidorStaff: c.staffSeguidor } : {}; };
  /** Right after the welcome: staff get their state (the button shows up), and their follower comes along. */
  function aoEntrar(ws) {
    const c = accounts[ws._usuario];
    if (ehStaff(c)) send(ws, estado(c));
  }
  function receber(ws, u, m) {
    if (m?.t !== 'staff') return false;
    const c = u && accounts[u];
    if (!ehStaff(c)) { send(ws, { t: 'staff', fora: true }); return true; }
    if (m.op === 'ver') { send(ws, estado(c, { op: 'ver', especies: especies() })); return true; }
    if (m.op === 'livre') {
      c.staffLivre = m.valor === true;
      send(ws, estado(c, { op: 'livre', mudou: true }));
      return true;
    }
    if (m.op === 'seguidor') {
      if (m.dex == null) c.staffSeguidor = null;
      else {
        const dex = Math.round(+m.dex);
        if (!especies().includes(dex)) { send(ws, { t: 'staff_erro', texto: 'That species has no model.' }); return true; }
        c.staffSeguidor = { glb: 'pm' + String(dex).padStart(4, '0') + '_00', dex, shiny: m.shiny === true };
      }
      send(ws, estado(c, { op: 'seguidor', mudou: true }));
      broadcastMapa(ws, { t: 'seguidor_staff', id: ws._id, seguidor: c.staffSeguidor });
      return true;
    }
    send(ws, { t: 'staff_erro', texto: 'Unknown staff request.' });
    return true;
  }
  return { receber, aoEntrar, info, ehStaff, livreDe };
}
