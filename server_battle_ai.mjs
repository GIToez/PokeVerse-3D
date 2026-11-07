/* SMART TRAINER AI (Nov 6) — how the Elite Four and the Champion fight in turn battles (server_battle.mjs). Every other trainer
 * still picks a random move with PP left. This one plays to win:
 *  - MOVES: the expected damage of each move on the Pokémon in front of it (type, STAB, stats, stages, weather, accuracy).
 *    A move that knocks it out wins, a sure-hit or faster one first; otherwise the most damage. Status moves only when they
 *    help: putting a healthy foe to sleep / paralysing / poisoning it, raising its own stats when it is safe, healing when low.
 *  - SWITCHING: when the Pokémon in the field is about to be knocked out and can't hit back hard, or none of its moves do
 *    anything, it swaps to the teammate that takes the incoming hit best and hits back hardest (at most `maxTrocas` times a
 *    battle, never two turns in a row).
 *  - ITEMS: `itens` from public/data/elite.json (e.g. { "2004": 2 } = two Full Restores) on a Pokémon low on HP that would
 *    otherwise go down, once per Pokémon.
 *  - WHO COMES OUT after a knockout: the teammate with the best matchup, not the next in the list.
 * GYM LEADERS use a gentler mode (`modo: 'medio'`): the same move choice 70 % of the time and a random move otherwise (gyms.json
 * `acaso` changes the 30 %), no switching, no items, and their team comes out in order.
 * The odds are estimates (no critical hits, no damage roll): good enough to play sharp, not perfect. */
const KILL = 1000;

export function createBattleAI({ calcularDano, golpeDe, especie, statDe, estDe, Status, Stg }) {
  const fixed = () => 0;   // calcularDano's rng: never misses, lowest roll; accuracy and the mean roll are added below
  const ROLL = 1.08;       // 0.85 → mean of 0.85…1.00 ≈ 0.925
  const movesOf = p => (p?.movs || []).filter(m => m.pp > 0).map(m => golpeDe(m.id)).filter(Boolean);
  const accOf = g => (g.precisao == null || g.precisao === true ? 1 : Math.max(0.3, Math.min(1, (+g.precisao || 100) / 100)));
  const speedOf = p => {
    const S = especie(p.dex, p);
    return statDe(S, p, 5) * (Status.mulVel?.(p) ?? 1) * Stg.mulStat(estDe(p) || {}, 5);
  };
  /** Expected damage of move g from at on def (HP points). */
  function dmg(at, def, g, clima) {
    if (!g || (g.cat || '') === 'status' || !(+g.poder > 0)) return 0;
    try {
      const r = calcularDano(at, def, g, fixed, clima);
      return (r.dano || 0) * ROLL * accOf(g);
    } catch { return 0; }
  }
  /** Best expected damage from at's moves on def, as a fraction of def's current HP (1 = knocked out). */
  function threat(at, def, clima) {
    let best = 0;
    for (const g of movesOf(at)) best = Math.max(best, dmg(at, def, g, clima));
    return def.hp > 0 ? best / def.hp : 0;
  }
  const hasStatus = p => !!(p.status && (p.status.id || typeof p.status === 'string'));
  const typesOf = p => especie(p.dex, p).types || ['Normal'];
  function statusImmune(def, st) {
    const T = typesOf(def);
    if (st === 'paralysis') return T.includes('Electric');
    if (st === 'burn') return T.includes('Fire');
    if (st === 'poison' || st === 'toxic') return T.includes('Poison') || T.includes('Steel');
    if (st === 'freeze') return T.includes('Ice');
    return false;
  }
  const HEALS = new Set(['recover', 'softboiled', 'milkdrink', 'slackoff', 'roost', 'moonlight', 'morningsun', 'synthesis', 'rest', 'healorder', 'wish']);
  const SELF_KO = new Set(['explosion', 'selfdestruct', 'memento', 'finalgambit', 'healingwish', 'lunardance']);

  /** Score of each usable move for `me` against `foe`. */
  function scoreMoves(me, foe, clima) {
    const out = [];
    const foeHitsMe = threat(foe, me, clima);           // ≥ 1: the foe knocks me out next hit
    const faster = speedOf(me) >= speedOf(foe);
    for (const g of movesOf(me)) {
      let s = 0;
      if ((g.cat || '') !== 'status' && +g.poder > 0) {
        const d = dmg(me, foe, g, clima), frac = foe.hp > 0 ? d / foe.hp : 0;
        if (d >= foe.hp) s = KILL + accOf(g) * 100 + ((+g.prioridade || 0) > 0 ? 150 : 0) + (faster ? 20 : 0);
        else s = Math.min(99, frac * 100);
        if (g.id === 'hyperbeam' || g.id === 'gigaimpact') s *= d >= foe.hp ? 1 : 0.6;   // the recharge turn
        if (SELF_KO.has(g.id)) s = me.hp / me.maxHp < 0.3 || foeHitsMe >= 1 ? s : s * 0.2;
        if ((+g.prioridade || 0) > 0 && foeHitsMe >= 1 && !faster) s += 30;              // get a hit in before going down
      } else if (HEALS.has(g.id) || g.statusCura) {
        const low = me.hp / me.maxHp;
        s = low < 0.45 && foeHitsMe < 0.9 ? 70 : low < 0.6 ? 20 : 0;
        if (g.id === 'rest') s *= hasStatus(me) ? 1.2 : 0.8;
      } else if (g.status && (g.statusEm || 'ele') !== 'eu') {
        const st = g.status;
        if (hasStatus(foe) || statusImmune(foe, st)) s = 0;
        else if (st === 'sleep') s = 65;
        else if (st === 'paralysis') s = speedOf(foe) > speedOf(me) ? 60 : 40;
        else if (st === 'toxic' || st === 'poison') s = foe.hp / foe.maxHp > 0.6 ? 45 : 15;
        else if (st === 'burn') s = 40;
        else s = 25;
        if (foeHitsMe >= 1) s *= 0.4;                     // no time for set-up if I'm about to drop
        s *= accOf(g);
      } else if (Array.isArray(g.estagios) && g.estagiosEm === 'eu') {
        const st = estDe(me) || {}, up = g.estagios.some(([k, n]) => n > 0 && (st[k] || 0) < 2);
        s = up && me.hp / me.maxHp > 0.7 && foeHitsMe < 0.5 ? 50 : 3;
      } else if (Array.isArray(g.estagios)) {
        s = foeHitsMe < 0.5 ? 18 : 4;                     // lowering the foe's stats
      } else if (g.id === 'protect' || g.id === 'detect') {
        s = 8;
      } else s = 10;
      out.push({ g, s });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  /** The move to use. A little variety among near-equal choices so it is not fully predictable. */
  function pickMove(me, foe, clima, rng = Math.random) {
    const L = scoreMoves(me, foe, clima);
    if (!L.length) return null;
    if (L.length > 1 && L[0].s < KILL && L[1].s >= L[0].s * 0.9 && rng() < 0.25) return L[1].g;
    return L[0].g;
  }

  /** How well `p` fares against `foe` if it comes in now (it takes the foe's hit first). Higher = better. */
  function matchup(p, foe, clima) {
    const incoming = threat(foe, p, clima);               // fraction of p's HP the foe takes per hit
    const outgoing = threat(p, foe, clima);               // fraction of the foe's HP p takes per hit
    const fast = speedOf(p) >= speedOf(foe) ? 0.15 : 0;
    return Math.min(1.5, outgoing) + fast - Math.min(1.5, incoming) * 1.1;
  }

  /** The teammate to send in (index in team), or -1. `exclude` = the one in the field. */
  function bestSwitch(team, exclude, foe, clima) {
    let best = -1, bs = -Infinity;
    team.forEach((p, i) => {
      if (i === exclude || !(p.hp > 0)) return;
      const m = matchup(p, foe, clima);
      if (m > bs) { bs = m; best = i; }
    });
    return { idx: best, score: bs };
  }

  /**
   * What the trainer does this turn: { tipo: 'golpe', g } | { tipo: 'troca', idx } | { tipo: 'item', id }.
   * `st` (kept on the battle): { trocas, ultimaTroca (turn), itens: { id: n }, itemEm: Set(uid) }.
   */
  function decide({ team, idx, foe, clima, vez, st, maxTrocas = 3, rng = Math.random }) {
    const me = team[idx];
    if (st.modo === 'medio') {   // GYM LEADERS: good move choice, a bit of chance, no switching or items
      const L = movesOf(me);
      if (L.length && rng() < (Number.isFinite(st.acaso) ? st.acaso : 0.3)) return { tipo: 'golpe', g: L[Math.floor(rng() * L.length)] };
      return { tipo: 'golpe', g: pickMove(me, foe, clima, rng) };
    }
    const iHit = threat(me, foe, clima), foeHits = threat(foe, me, clima);
    const faster = speedOf(me) >= speedOf(foe);
    // 1. Heal a Pokémon that would go down, once, if a heal changes the outcome
    const itemId = Object.keys(st.itens || {}).find(id => st.itens[id] > 0);
    if (itemId && me.hp > 0 && me.hp / me.maxHp < 0.3 && !st.itemEm.has(String(me.uid)) && !(iHit >= 1 && faster)) {
      const afterHeal = threat(foe, { ...me, hp: me.maxHp }, clima);   // the foe's hit on it at full HP
      if (afterHeal < 0.9) return { tipo: 'item', id: +itemId };
    }
    // 2. Switch out of a lost matchup
    const canSwitch = (st.trocas || 0) < maxTrocas && st.ultimaTroca !== vez - 1 && team.some((p, i) => i !== idx && p.hp > 0);
    if (canSwitch) {
      const doomed = foeHits >= 1 && !faster && iHit < 1;                // it drops before it can finish the foe
      const useless = iHit < 0.12 && me.hp / me.maxHp > 0.25;             // nothing it has does anything
      if (doomed || useless) {
        const sw = bestSwitch(team, idx, foe, clima);
        const stay = matchup(me, foe, clima);
        if (sw.idx >= 0 && sw.score > stay + 0.35 && threat(foe, team[sw.idx], clima) < 0.6) return { tipo: 'troca', idx: sw.idx };
      }
    }
    // 3. Fight
    return { tipo: 'golpe', g: pickMove(me, foe, clima, rng) };
  }
  /** After a knockout: the best teammate to send in. */
  function nextIn(team, foe, clima) {
    const sw = bestSwitch(team, -1, foe, clima);
    return sw.idx >= 0 ? sw.idx : team.findIndex(p => p.hp > 0);
  }
  return { decide, nextIn, pickMove, scoreMoves, threat, _test: { matchup, speedOf, dmg } };
}
