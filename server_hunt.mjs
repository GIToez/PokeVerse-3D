/* HUNT BONUS (Nov 5): extra Coins for knocking out wild Pokémon, from a daily pool.
 * Each account has a pool (save.caca = { saldo, dia }) that refills by `porDia` every day and stacks up to `dias` days, so a player
 * who skips a few days comes back to a bigger pool. A wild KO pays (base + level × porNivel) Coins, scaled by the player's share of
 * the damage (the top hitter gets the full amount), out of the pool. XP and item drops are separate and never run out.
 * The numbers live in Game settings (game_config.json → caca); empty = the defaults below.
 *   const hunt = createHunt({ accounts, send, socketsOf, saveAccounts, gameConfig })
 *   hunt.ko(u, { dex, lv, parte, maior, x, z })   // from the shared world's onKO
 *   hunt.vista(u) → { saldo, cap, porDia }       // for the welcome message and the Bag's bar */
const PADRAO = { porDia: 1500, dias: 7, base: 6, porNivel: 1.2, minParte: 0.25 };
const hoje = (t = Date.now()) => new Date(t - 8 * 3600e3).toISOString().slice(0, 10);   // the day turns at midnight Pacific
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);

export function createHunt({ accounts, send, socketsOf, saveAccounts, gameConfig }) {
  const cfg = () => {
    const c = gameConfig?.()?.caca || {}, n = (v, d, lo, hi) => (Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : d);
    return { porDia: n(c.porDia, PADRAO.porDia, 0, 1e6), dias: n(c.dias, PADRAO.dias, 1, 60), base: n(c.base, PADRAO.base, 0, 1e4),
      porNivel: n(c.porNivel, PADRAO.porNivel, 0, 1e3), minParte: n(c.minParte, PADRAO.minParte, 0, 1) };
  };
  /** The account's pool, refilled for every day since the last look (a brand-new pool starts full for one day). */
  function pool(c) {
    const C = cfg(), s = c.save, d = hoje(), cap = C.porDia * C.dias;
    if (!s.caca || typeof s.caca !== 'object') s.caca = { saldo: C.porDia, dia: d };
    const p = s.caca;
    if (p.dia !== d) { const k = Math.max(0, diasEntre(p.dia, d)) || 1; p.saldo = Math.min(cap, (+p.saldo || 0) + k * C.porDia); p.dia = d; }
    p.saldo = Math.max(0, Math.min(cap, +p.saldo || 0));
    return { p, cap, C };
  }
  function vista(u) {
    const c = accounts[u]; if (!c?.save) return null;
    const { p, cap, C } = pool(c);
    return { saldo: Math.round(p.saldo), cap, porDia: C.porDia };
  }
  function ko(u, ev) {
    const c = accounts[u]; if (!c?.save || !ev) return 0;
    const { p, cap, C } = pool(c);
    if (!ev.maior && !((+ev.parte || 0) >= C.minParte)) return 0;      // a tap on someone else's fight doesn't pay
    const cheio = Math.round(C.base + (+ev.lv || 1) * C.porNivel);
    const ganho = Math.min(Math.round(p.saldo), ev.maior ? cheio : Math.round(cheio * Math.min(1, +ev.parte || 0)));
    if (ganho <= 0) return 0;
    p.saldo -= ganho;
    c.save.dinheiro = (+c.save.dinheiro || 0) + ganho;
    c.rev = (c.rev || 0) + 1;
    saveAccounts();
    const s = c.save;
    for (const w of socketsOf(u)) {
      send(w, { t: 'bolsa', op: 'caca', bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens, bolas: s.bolas } });
      send(w, { t: 'caca', ganho, saldo: Math.round(p.saldo), cap, x: ev.x, z: ev.z });
    }
    return ganho;
  }
  return { ko, vista };
}
