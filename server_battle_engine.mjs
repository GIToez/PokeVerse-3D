/* The battle engine (battle_engine.mjs, PokeFable's from upcoming/) connected to our turn battles (server_battle.mjs).
 *
 * Our party records stay the truth for HP and the major status (they are the save). For each Pokémon in a battle the engine
 * gets a combatant built with OUR stats (IVs, EVs, nature: individual.mjs), cached for the fight so stat stages and the
 * volatile states (confusion, Protect, screens, Taunt, Encore, Leech Seed…) carry from turn to turn. After a turn the HP and
 * the major status go back to the record.
 *
 * The client keeps its playback format: one `lance` per move used (who, which move, damage, effectiveness, HP left, miss,
 * status, stat stages, Leech Seed) plus `avisos` (short pop-up texts for the new effects) and English battle text lines. */
import * as BE from './battle_engine.mjs';

const tipoE = (t) => String(t || 'normal').toLowerCase();
const CAT_E = { fisico: 'physical', especial: 'special', status: 'status', physical: 'physical', special: 'special' };
/* engine stat names ↔ ours (stages.mjs) */
const STAT_IN = { atk: 'attack', def: 'defense', spa: 'special-attack', spd: 'special-defense', vel: 'speed', prec: 'accuracy', eva: 'evasion' };
const STAT_OUT = Object.fromEntries(Object.entries(STAT_IN).map(([a, b]) => [b, a]));
const ST_IN = { toxic: 'bad-poison' }, ST_OUT = { 'bad-poison': 'toxic' };
/* engine "can't move" reasons → our status ids (the client's Status.aviso / color) */
const PARADO = { sono: 'asleep', congelado: 'frozen', paralisia: 'paralyzed', hesitar: 'flinched', recarga: 'must recharge', disable: 'move disabled', taunt: 'taunted', encore: 'locked by Encore' };
const VOLATIL_COR = { confusion: '#E8578A', trap: '#B6A136', 'leech-seed': '#6BB84A', flinch: '#9A9AA6', curse: '#6B4F99', nightmare: '#4C3F73' };
/* Short pop-up words for the events that happen outside a move (the full sentence goes to the battle text). */
const CURTO = { confuso: 'confused', 'se-bate': 'hurt itself', acorda: 'woke up', descongela: 'thawed', 'cura-status': 'cured', fim: '' };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function createTurnEngine({ status, engineMoves, moves, species, statOf, struggle }) {
  BE.usar({ status, golpes: engineMoves });
  /* our move ids by slug, to name the engine's moves back (take-down → takedown) */
  const ourBySlug = new Map();
  for (const [id, m] of Object.entries(moves || {})) { ourBySlug.set(slug(id), id); if (m?.nome) ourBySlug.set(slug(m.nome), id); }
  const ourId = (ident) => (ident === 'struggle' ? 'struggle' : ourBySlug.get(slug(ident)) || ident);

  /* A move the engine data doesn't have (our extra ones): build it from moves.json so it at least hits and applies its
     status / stat changes. */
  const built = new Map();
  function fromOurs(m) {
    if (built.has(m.id)) return built.get(m.id);
    const st = m.status ? ST_IN[m.status] || m.status : null, stages = (m.estagios || []).map(([a, n]) => ({ atributo: STAT_IN[a] || a, estagios: n }));
    const cat = CAT_E[m.cat] || 'physical';
    const categoria = cat === 'status' ? (st ? 'ailment' : stages.length ? 'net-good-stats' : 'unique') : st ? 'damage-ailment' : stages.length ? (m.estagiosEm === 'eu' ? 'damage-raise' : 'damage-lower') : 'damage';
    const g = {
      id: m.id, ident: m.id, nome: m.nome || m.id, tipo: tipoE(m.tipo), cat, poder: +m.poder || 0, precisao: m.precisao ?? null, pp: m.pp || 10,
      prioridade: +m.prioridade || 0, alvo: m.statusEm === 'eu' || m.estagiosEm === 'eu' ? 'user' : 'selected-pokemon', marcas: ['protect'],
      efeito: { categoria, status: st, chance: st ? +m.statusChance || (cat === 'status' ? 100 : 0) : null, acertos: null, turnos: null, dreno: 0, cura: 0,
        critico: 0, recuo: 0, atributos: stages, chanceAtributos: stages.length ? +m.estagiosChance || (cat === 'status' ? 0 : 100) : 0 },
    };
    built.set(m.id, g);
    return g;
  }
  function engineMove(m) {
    if (!m) return null;
    if (m.id === 'struggle') return BE.golpe('struggle') || fromOurs(struggle);
    return BE.golpe(m.id) || BE.golpe(m.nome) || fromOurs(m);
  }

  /** The fight's combatant for a party record (built once per battle and per Pokémon, then refreshed from the record). */
  function combatant(p, side, cache) {
    let c = cache.get(p);
    const S = species(p.dex);
    if (!c) {
      c = BE.preparar({ id: side + ':' + String(p.uid ?? p.dex + ':' + Math.random().toString(36).slice(2, 7)), nome: p.nome || S.name || 'Pokémon', dex: +p.dex,
        tipos: (S.types || ['Normal']).map(tipoE), pesoKg: S.kg ?? S.peso ?? null });
      cache.set(p, c);
    }
    c.lv = p.lv || 1; c.maxHp = p.maxHp; c.hp = p.hp;
    c.atk = statOf(S, p, 1); c.def = statOf(S, p, 2); c.spa = statOf(S, p, 3); c.spd = statOf(S, p, 4); c.spe = statOf(S, p, 5);
    const want = p.status?.id ? ST_IN[p.status.id] || p.status.id : null, e = c.est;
    if (!want) e.principal = null;
    else if (e.principal?.id !== want) e.principal = { id: want, ...(want === 'sleep' ? { turnos: Math.max(1, +p.status.turnos || 2) } : {}), ...(want === 'bad-poison' ? { n: Math.max(1, +p.status.n || 1) } : {}) };
    return c;
  }
  /** HP and major status back to the record. */
  function writeBack(c, p) {
    p.hp = Math.max(0, Math.min(p.maxHp, c.hp));
    const s = c.est.principal;
    p.status = p.hp > 0 && s ? { id: ST_OUT[s.id] || s.id, n: s.n | 0, ...(s.turnos != null ? { turnos: s.turnos } : {}) } : null;
  }
  /** The record's stat stages in our format (for the snapshot the client draws). */
  function stagesOf(p, cache) {
    const out = { atk: 0, def: 0, spa: 0, spd: 0, vel: 0, prec: 0, eva: 0 }, c = cache.get(p);
    for (const [k, n] of Object.entries(c?.est?.estagios || {})) if (STAT_OUT[k]) out[STAT_OUT[k]] = n | 0;
    return out;
  }
  const seededOf = (p, cache) => !!cache.get(p)?.est?.vol?.['leech-seed'];
  /** The engine's own list of active effects on a Pokémon (for the client's badges): ['confusion', 'reflect', …]. */
  const volatilesOf = (p, cache) => Object.keys(cache.get(p)?.est?.vol || {});
  /** A Pokémon left the field: stages and volatile states end (the major status stays on the record). */
  function leftField(p, cache) { const c = cache.get(p); if (c) BE.limparAoSair(c); }

  /**
   * One turn. A and B: { p: party record, move: our move object or null (switched / used an item), side: 'eu' | 'ele' }.
   * Returns { events, lances (from A's side), log }.
   */
  function turn(A, B, cache, rng = Math.random) {
    const cA = combatant(A.p, 'a', cache), cB = combatant(B.p, 'b', cache);
    const gA = A.move ? engineMove(A.move) : null, gB = B.move ? engineMove(B.move) : null;
    const events = BE.turno(cA, gA, cB, gB, { rng });
    writeBack(cA, A.p); writeBack(cB, B.p);
    return { events, ...toLances(events, cA, cB, A, B) };
  }

  /** Engine events → the client's lances (from A's point of view) + English text. */
  function toLances(events, cA, cB, A, B) {
    const sideOf = (id) => (id === cA.id ? 'eu' : id === cB.id ? 'ele' : null);
    const recOf = (id) => (id === cA.id ? A.p : id === cB.id ? B.p : null);
    const names = { [cA.id]: cA.nome, [cB.id]: cB.nome };
    const lances = [], log = [];
    let cur = null, actor = null;
    /** A short pop-up over a Pokémon; it rides on the current move's lance (or a lance of its own, which only shows texts). */
    const aviso = (alvo, txt, cor) => {
      if (!txt) return;
      let host = cur || lances.at(-1);
      if (!host) { host = { de: sideOf(alvo) || 'eu' }; lances.push(host); }
      (host.avisos ||= []).push({ quem: sideOf(alvo), txt, ...(cor ? { cor } : {}) });
    };
    for (const e of events) {
      const txt = e.t === 'usa' ? '' : BE.narrar(e, names);
      if (txt) log.push(txt);
      if (e.t === 'usa') {
        actor = e.alvo;
        const foe = actor === cA.id ? cB : cA, rec = recOf(foe.id);
        cur = { de: sideOf(actor), golpe: ourId(e.golpe), dano: 0, eff: 1, hpAlvo: foe.hp, alvo: rec?.uid ?? null, avisos: [] };
        lances.push(cur);
        continue;
      }
      if (e.t === 'nao-age') {
        cur = null;
        lances.push({ de: sideOf(e.alvo), parado: PARADO[e.motivo] || 'can\'t move', avisoTxt: txt });
        continue;
      }
      if (!cur) {   // before a move (confusion, waking up…) or after both (end-of-turn damage)
        if (e.t === 'dano') aviso(e.alvo, '-' + e.v + ' HP', '#ff8a8a');
        else if (e.t === 'cura') aviso(e.alvo, '+' + (e.v || '') + ' HP', '#8ef58e');
        else if (e.t !== 'desmaia') aviso(e.alvo, CURTO[e.t] || txt, VOLATIL_COR[e.id] || (e.t === 'confuso' || e.t === 'se-bate' ? VOLATIL_COR.confusion : undefined));
        continue;
      }
      const onFoe = e.alvo !== actor;
      switch (e.t) {
        case 'dano':
          if (onFoe && !e.motivo) { cur.dano += e.v; cur.hpAlvo = e.hp; if (e.eff != null) cur.eff = e.eff; if (e.critico) aviso(e.alvo, 'critical hit!', '#ffd23a'); }
          else if (e.motivo) aviso(e.alvo, '-' + e.v + ' HP', '#ff8a8a');
          break;
        case 'errou': cur.errou = true; break;
        case 'imune': cur.eff = 0; break;
        case 'protegeu': cur.errou = true; aviso(e.alvo, 'protected!', '#9ad8f5'); break;
        case 'status':
          if (['burn', 'poison', 'bad-poison', 'paralysis', 'sleep', 'freeze'].includes(e.id)) { cur.statusId = ST_OUT[e.id] || e.id; cur.statusQuem = onFoe ? 'ele' : 'eu'; }
          else if (e.id === 'leech-seed') cur.semente = true;
          else if (e.id !== 'flinch') aviso(e.alvo, BE.ROTULO[e.id] ? BE.ROTULO[e.id] + '!' : '', VOLATIL_COR[e.id]);
          break;
        case 'estagio':
          if (e.n) {
            const quem = onFoe ? 'ele' : 'eu';
            if (!cur.estagios) cur.estagios = { quem, mudancas: [] };
            if (cur.estagios.quem === quem) cur.estagios.mudancas.push({ atributo: STAT_OUT[e.atributo] || e.atributo, n: e.n, real: e.n });
            else aviso(e.alvo, txt);
          }
          break;
        case 'cura': if (!onFoe) aviso(e.alvo, '+' + (e.v || '') + ' HP', '#8ef58e'); break;
        case 'falhou': case 'nada': aviso(e.alvo, 'it failed', '#9ab'); break;
        case 'nocaute': aviso(e.alvo, 'one-hit KO!', '#ff5a5a'); break;
        case 'desmaia': break;
        default: if (txt) aviso(e.alvo, txt);
      }
    }
    for (const l of lances) if (l.avisos && !l.avisos.length) delete l.avisos;
    return { lances, log };
  }

  return { turn, combatant, writeBack, stagesOf, seededOf, volatilesOf, leftField, engineMove };
}
