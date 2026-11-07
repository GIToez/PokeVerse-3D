/* FAST TRAVEL (Nov 6) — what the v2 world map's travel buttons ask (travel_ui.mjs, from upcoming/):
 *   { t: 'viagem_vista', centros?: [{ mapa, chegada }] } → { t: 'viagem_vista', teleporte: {...}, viagem: {...} }
 *       teleporte: { tem, motivo, curto, faltaS, recargaMin, destino: { centro, area, mapa, chegada } }   "Return to Center"
 *       viagem:    { tem, motivo, curto, faltaS, recargaMin, aoArLivre, centros: [{ area, mapa, chegada }] } Fly between Centers
 *   { t: 'teleporte' } / { t: 'viagem', mapa, chegada } → { t, ok: true, mapa, chegada, centro } or { t, ok: false, erro, texto, faltaS? }
 *   { t: 'centro_visitado', mapa, chegada } — the game reports each Pokémon Center the player walks into (index.html gravarCentroVisitado)
 * PokeFable unlocks these with two Celadon missions we don't have, so here each needs a number of Gym Badges (admin → Game settings →
 * Fast travel: viagem = { teleporteInsignias, teleporteMin, viagemInsignias, viagemMin }). GMs have both and no cooldown.
 * Stored on the account: save.viagem = { centros: { chegada: { mapa, chegada, area } }, ultimo: chegada, teleEm, viaEm }.
 * A Center is a door arrival (doors.json) whose area is a Pokémon Center (14xx); flying needs an outdoor area (scenes.json tipo 1)
 * outside the Sevii Islands, where the ferry is the way. */
import * as Med from './medallion.mjs';
const PADRAO = { teleporteInsignias: 3, teleporteMin: 10, viagemInsignias: 3, viagemMin: 5 };
const LAB = { mapa: '4110002', chegada: 7180101, area: 1801 };   // no Center yet: Teleport takes you to Professor Oak's Lab, as a whiteout does
const ARQUIPELAGO = new Set([2249, 2250, 2251, 2252, 2253, 2254, 2255, 2265, 2266, 2267, 2268, 2270, 2271, 2272, 2273, 2275, 2276, 2280, 2281, 2282, 2284, 2285, 2287, 2300]);

export function createTravel({ accounts, send, readJson, cfg, saveAccounts, emLuta = () => false }) {
  let portas = null, tipos = null;
  const portasDe = () => (portas ||= readJson('doors') || {});
  /** area id → its tipo in scenes.json (1 outdoors, 2 indoors, 3 special). */
  function tipoDaArea(a) {
    if (!tipos) {
      tipos = new Map();
      const d = readJson('scenes'), L = Array.isArray(d) ? d : d?.cenas || [];
      for (const c of L) for (const x of c.areas || []) tipos.set(+x.id, +x.tipo);
    }
    return tipos.get(+a);
  }
  const regras = () => ({ ...PADRAO, ...(cfg()?.viagem || {}) });
  const V = (save) => {
    if (!save.viagem || typeof save.viagem !== 'object') save.viagem = {};
    const v = save.viagem; if (!v.centros || typeof v.centros !== 'object') v.centros = {};
    return v;
  };
  /** A Pokémon Center arrival (doors.json): { mapa, chegada, area } or null. */
  function centro(chegada, mapa) {
    const p = portasDe()[String(+chegada)];
    if (!p || Math.floor(+p.a / 100) !== 14) return null;
    return { mapa: String(mapa ?? p.c ?? ''), chegada: +chegada, area: +p.a };
  }
  function lembrar(save, chegada, mapa) {
    const c = centro(chegada, mapa); if (!c || !c.mapa) return false;
    const v = V(save); v.centros[c.chegada] = c; v.ultimo = c.chegada;
    return true;
  }
  const insignias = (save) => (Array.isArray(save.insignias) ? save.insignias.length : 0);
  function estado(ws, c) {
    const s = c.save || (c.save = {}), v = V(s), R = regras(), gm = !!c.gm, agora = Date.now();
    const nIns = insignias(s);
    const rm = Med.recargaMult(s, cfg?.());   // the Medallion: shorter cooldowns while it runs
    const um = (min0, nIns0, em) => {
      const min = Math.round((+min0 || 0) * rm * 10) / 10;
      const tem = gm || nIns >= nIns0;
      return { tem, recargaMin: min, faltaS: gm ? 0 : Math.max(0, Math.ceil(((+em || 0) + min * 60000 - agora) / 1000)),
        ...(tem ? {} : { motivo: nIns0 === 1 ? 'Needs 1 Gym Badge.' : 'Needs ' + nIns0 + ' Gym Badges (you have ' + nIns + ').', curto: nIns0 + ' badges' }) };
    };
    const area = +(ws._areaId ?? ws._info?.area) || 0;
    const aoArLivre = tipoDaArea(area) === 1 && !ARQUIPELAGO.has(area);
    const ult = v.ultimo != null ? v.centros[v.ultimo] : null;
    return {
      teleporte: { ...um(R.teleporteMin, R.teleporteInsignias, v.teleEm), destino: ult ? { centro: true, ...ult } : { centro: false, ...LAB } },
      viagem: { ...um(R.viagemMin, R.viagemInsignias, v.viaEm), aoArLivre, centros: Object.values(v.centros) },
    };
  }
  function receber(ws, u, m) {
    const t = m?.t;
    if (t !== 'viagem_vista' && t !== 'teleporte' && t !== 'viagem' && t !== 'centro_visitado') return false;
    const c = u && accounts[u];
    if (!c) { send(ws, { t, ok: false, erro: 'conta', texto: 'Sign in with an account.' }); return true; }
    const s = c.save || (c.save = {});
    if (t === 'centro_visitado') { if (lembrar(s, m.chegada, m.mapa)) saveAccounts(); return true; }
    if (t === 'viagem_vista') {
      let mudou = false;   // Centers the game remembered before the server kept them
      for (const x of Array.isArray(m.centros) ? m.centros.slice(0, 60) : []) if (x && !V(s).centros[+x.chegada] && lembrar(s, x.chegada, x.mapa)) mudou = true;
      if (m.ultimo && centro(m.ultimo) && V(s).ultimo == null) { V(s).ultimo = +m.ultimo; mudou = true; }
      if (mudou) saveAccounts();
      send(ws, { t: 'viagem_vista', ...estado(ws, c) });
      return true;
    }
    const e = estado(ws, c)[t === 'teleporte' ? 'teleporte' : 'viagem'];
    const nao = (erro, texto, x = {}) => send(ws, { t, ok: false, erro, texto, ...x });
    if (!e.tem) return nao('bloqueado', e.motivo), true;
    if (emLuta(ws)) return nao('luta', "Can't do that mid-battle."), true;
    if (e.faltaS > 0) return nao('recarga', 'Still recharging:', { faltaS: e.faltaS }), true;
    const v = V(s);
    if (t === 'teleporte') {
      const d = e.destino;
      v.teleEm = c.gm ? 0 : Date.now(); saveAccounts();
      send(ws, { t, ok: true, mapa: d.mapa, chegada: d.chegada, centro: !!d.centro });
      return true;
    }
    if (!e.aoArLivre) return nao('ar', ARQUIPELAGO.has(+(ws._areaId ?? ws._info?.area)) ? "The strong island winds won't let you fly from here. Take the ferry." : 'You can only travel outdoors.'), true;
    const alvo = v.centros[+m.chegada];
    if (!alvo) return nao('centro', 'You have not visited that Pokémon Center yet.'), true;
    v.viaEm = c.gm ? 0 : Date.now(); saveAccounts();
    send(ws, { t, ok: true, mapa: alvo.mapa, chegada: alvo.chegada, centro: true });
    return true;
  }
  return { receber, estado };
}
