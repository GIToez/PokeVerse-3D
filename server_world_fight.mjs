/* SHARED-WORLD FIGHTS on the battle engine (battle_engine.mjs, real-time mode 'tempo'), the same rules as turn battles.
 *
 * Before this, a hit in the shared world only computed damage: Thunder Wave, Growl, Leech Seed… did nothing to a wild
 * Pokémon on the server. Now every hit goes through the engine (accuracy with stages, type chart, weather, the move's own
 * effect: status, stat stages, Leech Seed, recoil…), and the clock runs the real-time part (burn / poison / sandstorm /
 * hail every engine turn of AJUSTE.turnoS seconds, sleep and confusion wearing off).
 *
 * Who owns what stays as before: the wild's HP and status are the server's; the partner's HP stays with the client (it
 * gets the damage and subtracts it, as in raids) — the engine keeps a combatant for it only for stages and volatile states.
 *
 *   hitWild(mon, w, move, clima)   → { dano, eff, errou, critico, estagios, semente, st, avisos }   (the player's Pokémon hits)
 *   wildHits(w, mon, move, clima)  → { parado, dano, eff, errou, estagios, status, avisos, selfHp } (the wild hits the partner)
 *   tick(w, clima, now)            → { danos: [{ v, motivo }], st }  (time passing for one wild; st set when its status changed)
 *   forget(w) */
import fs from 'node:fs';
import nodePath from 'node:path';
import * as BE from './battle_engine.mjs';
import { createTurnEngine } from './server_battle_engine.mjs';

const STAT_OUT = { attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'vel', accuracy: 'prec', evasion: 'eva' };
const ST_OUT = { 'bad-poison': 'toxic' };
const MAJOR = new Set(['burn', 'poison', 'bad-poison', 'paralysis', 'sleep', 'freeze']);
const PARADO = { sono: 'asleep', congelado: 'frozen', paralisia: 'paralyzed', hesitar: 'flinched', recarga: 'must recharge', disable: 'move disabled', taunt: 'taunted', encore: 'locked by Encore' };
const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };

export function createWorldFight({ dataDir, species, moves, statOfParty, statOfWild, struggle, prepParty = (p) => p }) {
  const engine = createTurnEngine({
    status: readJson(nodePath.join(dataDir, 'biblioteca/status.json'), {}),
    engineMoves: readJson(nodePath.join(dataDir, 'biblioteca/golpes.json'), { golpes: {} }).golpes,
    moves: moves(), species, struggle,
    statOf: (S, p, i) => (p && p.ind && p.state ? statOfWild(S, p, i) : statOfParty(S, p, i)),
  });
  const cache = new WeakMap();
  const cb = (p, side) => engine.combatant(side === 'p' ? prepParty(p) : p, side, cache);
  /** The engine's real-time clock for one combatant: advance it to now. */
  function advance(c, now) {
    const dt = c.__t ? Math.min(30, (now - c.__t) / 1000) : 0;
    c.__t = now;
    return dt > 0 ? BE.tique(c, dt, { modo: 'tempo' }) : [];
  }
  const setWeather = (a, b, clima) => {
    for (const c of [a, b]) c.est.climaMapa = clima || null;
    const vA = a.est.vol.clima, vB = b.est.vol.clima;
    if (vA && !vB) b.est.vol.clima = { ...vA }; else if (vB && !vA) a.est.vol.clima = { ...vB };
  };
  const stOf = (c) => (c.est.principal ? { id: ST_OUT[c.est.principal.id] || c.est.principal.id, n: c.est.principal.turnos ?? c.est.principal.n ?? 0 } : null);

  /** Engine events of one move → what the client draws (world.mjs shp / pdano). `atk` = attacker's combatant. */
  function read(ev, atk, def) {
    const out = { dano: 0, eff: 1, avisos: [] };
    for (const e of ev) {
      const onDef = e.alvo === def.id;
      switch (e.t) {
        case 'dano':
          if (onDef && !e.motivo) { out.dano += e.v; if (e.eff != null) out.eff = e.eff; if (e.critico) out.critico = true; }
          else if (!onDef) out.selfHp = (out.selfHp || 0) - e.v;   // recoil, confusion self-hit, Belly Drum…
          break;
        case 'cura': if (!onDef) out.selfHp = (out.selfHp || 0) + (e.v || 0); break;
        case 'errou': case 'protegeu': out.errou = true; break;
        case 'imune': out.eff = 0; break;
        case 'status':
          if (onDef && MAJOR.has(e.id)) out.status = { id: ST_OUT[e.id] || e.id };
          else if (onDef && e.id === 'leech-seed') out.semente = true;
          else if (BE.ROTULO[e.id]) out.avisos.push({ quem: onDef ? 'alvo' : 'eu', txt: BE.ROTULO[e.id] + '!' });
          break;
        case 'estagio':
          if (e.n) {
            const quem = onDef ? 'ele' : 'eu';
            if (!out.estagios) out.estagios = { quem, mudancas: [] };
            if (out.estagios.quem === quem) out.estagios.mudancas.push({ atributo: STAT_OUT[e.atributo] || e.atributo, n: e.n, real: e.n });
          }
          break;
        case 'falhou': case 'nada': out.avisos.push({ quem: 'eu', txt: 'it failed' }); break;
        case 'nocaute': out.avisos.push({ quem: 'alvo', txt: 'one-hit KO!' }); break;
      }
    }
    if (!out.avisos.length) delete out.avisos;
    return out;
  }

  /** The player's Pokémon `mon` (party record) hits the wild `w`. */
  function hitWild(mon, w, move, clima, now = Date.now()) {
    const a = cb(mon, 'p'), d = cb(w, 'w');
    setWeather(a, d, clima);
    advance(a, now);
    const pre = advance(d, now);
    const ev = BE.resolverGolpe(a, d, engine.engineMove(move), { rng: Math.random, modo: 'tempo' });
    const before = w.status?.id || null;
    engine.writeBack(d, w);
    const r = read(ev, a, d);
    const after = stOf(d);
    if ((after?.id || null) !== before) r.st = after;   // the wild's status changed (got one, or lost it)
    r.pre = pre;
    return r;
  }

  /** The wild `w` hits the partner `mon`. Sleep, paralysis, flinch, confusion… can stop it first. */
  function wildHits(w, mon, move, clima, now = Date.now()) {
    const a = cb(w, 'w'), d = cb(mon, 'p');
    setWeather(a, d, clima);
    advance(a, now); advance(d, now);
    const g = engine.engineMove(move);
    const pode = BE.podeAgir(a, { rng: Math.random, golpe: g, modo: 'tempo' });
    const before = w.status?.id || null;
    if (!pode.pode) {
      engine.writeBack(a, w);
      const self = pode.eventos.filter((e) => e.t === 'dano' && e.alvo === a.id).reduce((t, e) => t + e.v, 0);
      const after = stOf(a);
      const motivo = pode.eventos.find((e) => e.t === 'nao-age')?.motivo;
      return { parado: PARADO[motivo] || (self ? 'hurt itself' : "can't move"), dano: 0, eff: 1, errou: true, selfHp: self ? -self : 0,
        ...((after?.id || null) !== before ? { stSelf: after } : {}) };
    }
    const ev = [...pode.eventos, ...BE.resolverGolpe(a, d, g, { rng: Math.random, modo: 'tempo' })];
    engine.writeBack(a, w);
    const r = read(ev, a, d);
    const after = stOf(a);
    if ((after?.id || null) !== before) r.stSelf = after;
    return r;
  }

  /** Time passing for one wild in a fight: burn / poison / sandstorm / hail, waking up, thawing. */
  function tick(w, clima, now = Date.now()) {
    if (!cache.has(w) || !(w.hp > 0)) return null;
    const c = cb(w, 'w');   // refreshed from the record (HP / status may have changed since the last hit)
    c.est.climaMapa = clima || null;
    const before = w.status?.id || null;
    const ev = advance(c, now);
    if (!ev.length) return null;
    engine.writeBack(c, w);
    const danos = ev.filter((e) => e.t === 'dano' && e.alvo === c.id).map((e) => ({ v: e.v, motivo: e.motivo || null }));
    const after = stOf(c);
    return { danos, ...((after?.id || null) !== before ? { st: after } : {}) };
  }
  const inFight = (w) => cache.has(w);
  const forget = (w) => cache.delete(w);
  return { hitWild, wildHits, tick, inFight, forget };
}
