/* DAILY REWARDS (Nov 5): log in on consecutive days, get the day's prize. 7 days, then it starts again from Day 1; missing a day
 * also sends the streak back to Day 1. Each day has a FREE prize and a PREMIUM prize; the premium one is for players with the
 * Premium Daily Pass (a 30-day purchase, save.passeDiarioAte, sold in the shop later; GM accounts always have it).
 * The prizes live in public/data/daily_rewards.json (admin → Daily rewards). The day turns at midnight Pacific, like the hunt pool.
 *   const daily = createDaily({ accounts, send, socketsOf, saveAccounts, readJson })
 *   daily.login(u, ws)   // on welcome: pays today's prize once and sends { t: 'diario', vista, novo: true }
 *   daily.vista(u)       // { seq, hoje, dias, premium, premiumAte, pegouHoje }
 *   daily.receber(ws, u, m)  // { t: 'diario_ver' } → the popup again */
const hoje = (t = Date.now()) => new Date(t - 8 * 3600e3).toISOString().slice(0, 10);
const ontem = (t = Date.now()) => hoje(t - 86400e3);
const PADRAO = {
  dias: [
    { dia: 1, gratis: { 1001: 5 }, premium: { 1002: 5 } },
    { dia: 2, gratis: { 2001: 3 }, premium: { 2002: 5 } },
    { dia: 3, gratis: { 1002: 5 }, premium: { 1003: 3 } },
    { dia: 4, gratis: { 2002: 3 }, premium: { 2003: 3 } },
    { dia: 5, gratis: { 1003: 3 }, premium: { 1003: 5 } },
    { dia: 6, gratis: { 2003: 2 }, premium: { 2004: 3 } },
    { dia: 7, gratis: { 1003: 5, 2012: 1 }, premium: { 1003: 10, 2013: 2 } },
  ],
};
export function createDaily({ accounts, send, socketsOf, saveAccounts, readJson, isBall, isGm }) {
  const tabela = () => {
    const d = readJson?.('daily_rewards');
    if (!Array.isArray(d?.dias) || d.dias.length !== 7) return PADRAO;
    return { dias: [...d.dias].sort((x, y) => (+x.dia || 0) - (+y.dia || 0)) };
  };
  const premium = (c) => !!c?.gm || isGm?.(c) || (+c?.save?.passeDiarioAte || 0) > Date.now();
  function vista(u) {
    const c = accounts[u]; if (!c?.save) return null;
    const s = c.save, D = s.diario || {};
    return { seq: D.seq || 1, hoje: hoje(), pegouHoje: D.dia === hoje(), dias: tabela().dias, premium: premium(c), premiumAte: +s.passeDiarioAte || 0 };
  }
  function dar(c, premio) {
    const s = c.save;
    if (!s.itens || typeof s.itens !== 'object') s.itens = {};
    if (!s.bolas || typeof s.bolas !== 'object') s.bolas = {};
    for (const [k, v] of Object.entries(premio || {})) {             // { item id: how many }
      const n = Math.floor(+v); if (!(n > 0)) continue;
      const cofre = isBall?.(k) ? s.bolas : s.itens;
      cofre[k] = (+cofre[k] || 0) + n;
    }
  }
  /** Today's first login pays the day (once) and moves the streak. → true when something was paid. */
  function login(u, ws) {
    const c = accounts[u]; if (!c?.save) return false;
    const s = c.save, D = (s.diario ||= {}), h = hoje();
    if (D.dia === h) return false;
    D.seq = D.dia === ontem() ? (D.seq % 7) + 1 : 1;                  // a day in a row → next day; a gap (or the first time) → Day 1
    D.dia = h;
    const dia = tabela().dias[D.seq - 1] || {};
    dar(c, dia.gratis);
    if (premium(c)) dar(c, dia.premium);
    c.rev = (c.rev || 0) + 1;
    saveAccounts();
    const v = vista(u);
    for (const w of socketsOf(u)) {
      send(w, { t: 'bolsa', op: 'diario', bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens, bolas: s.bolas } });
      if (w === ws || !ws) send(w, { t: 'diario', vista: v, novo: true });
    }
    return true;
  }
  function receber(ws, u, m) {
    if (!u || m?.t !== 'diario_ver') return;
    send(ws, { t: 'diario', vista: vista(u), novo: false });
  }
  return { login, vista, receber };
}
