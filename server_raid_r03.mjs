/* ZAPDOS RAID (r03, "Power Plant Overload", arena 9700003) — the boss's fight on the server.
 * The fight itself is PokeFable's engine, `LutaR03` in raid_r03.mjs: the same rules the client mirrors (raid_r03_mirror.mjs), driven by
 * data/raid_r03.json (config + regra). This module only feeds it and relays it:
 *   - players in: entrar (name, level, spawn slot) + tipos (their partner's types: Ground is immune to the electric hits)
 *   - every tick: the partner's position (the partner is what moves in this arena) → posicao; the engine's events → the arena
 *   - the boss's HP (players' hits, server_raid.mjs) → vida (phases at 65 % and 30 %); hits are refused while Zapdos is up high (phase 2)
 *   - ops from players: f_inicio { gerador } / f_fim (hold F at an overloaded generator), trocar { uid } (switch Pokémon)
 *   - the engine's `dano` (a fraction of max HP) → `pdano` on the player's partner, as in every raid
 *   - Voltorbs: each one the engine spawns is also a world creature (dex 100) the players can target and knock out
 *
 *   Messages to the arena: { t: 'r03', agora, ev, em, ... } (the engine's events as they are) and { t: 'r03', ev: 'retrato', retrato }
 *   for whoever arrives mid-fight; { t: 'r03_erro', erro, op, faltam? } to the player whose op was refused. */
import { LutaR03, usarDados } from './raid_r03.mjs';

/** The engine's attacks → a move the client knows, for the hit animation on the partner. */
const GOLPE_ANIM = { bicada: 'drillpeck', faisca: 'thundershock', polaridade: 'thunderbolt', sobrecarga: 'discharge', estouro: 'explosion',
  voltorb: 'selfdestruct', trovao_abertura: 'thunder', trovao: 'thunder' };
const VOLTORB_DEX = 100, VOLTORB_GLB = 'pm0100_00';
let seqVoltorb = 0;

export function createR03({ dados, paraArena, enviarA, naArena, idDe, maxHpDe, tiposDe, nomeDe, lvDe, vagaDe, danoMult = () => 1,
  clock = () => Date.now(), every = (fn, ms) => setInterval(fn, ms) }) {
  let luta = null, timer = null, chefeId = null;
  const voltorbs = new Map();                    // engine voltorb id → { ent: world id, ultimo: { x, z } }
  const entDe = new Map();                       // world id → engine voltorb id
  const proximo = new Map();                     // player id → the uid that comes in after a faint (the engine's wait)
  const now = clock;

  /** Where a player's partner stands (it is what moves in this arena), or the trainer. */
  const posOf = (ws) => {
    const i = ws._info || {};
    return Number.isFinite(+i.px) && Number.isFinite(+i.pz) ? { x: +i.px, z: +i.pz } : Number.isFinite(+i.x) ? { x: +i.x, z: +i.z } : null;
  };
  const wsDe = (id) => naArena().find((w) => idDe(w) === id) || null;

  function registroVoltorb(ent, v) {
    return { id: ent, dex: VOLTORB_DEX, glb: VOLTORB_GLB + '.glb', nome: 'Voltorb', lv: 30, shiny: false, natureza: 'Serious',
      x: +v.x, z: +v.z, giro: 0, anim: 'Idle', area: null, generico: true, casa: null, perfil: 'agressivo', aquatico: false, pertoDeGrama: false,
      hp: +v.golpes || 2, maxHp: +v.golpes || 2, estado: 'vagando', dono: null, chefe: true, r03: 'voltorb' };
  }
  /** One engine event → the arena (and what it means for the world: Voltorb creatures, damage on partners). */
  function relay(e) {
    if (e.ev === 'voltorb') {
      const ent = 2e9 + (++seqVoltorb % 1e8);
      voltorbs.set(e.id, { ent, ultimo: { x: +e.x, z: +e.z } }); entDe.set(ent, e.id);
      paraArena({ t: 'selvagem', s: registroVoltorb(ent, e) });
      e = { ...e, chefe: ent };
    } else if (e.ev === 'voltorb_fim') {
      const v = voltorbs.get(e.id);
      if (v) { voltorbs.delete(e.id); entDe.delete(v.ent); paraArena({ t: 'sumiu', id: v.ent, motivo: e.motivo === 'caiu' ? 'morreu' : 'fugiu' }); e = { ...e, chefe: v.ent }; }
    } else if (e.ev === 'dano') {
      const w = wsDe(e.jogador);
      if (w) {
        const maxHp = maxHpDe(w) || 100, dano = Math.max(1, Math.round(maxHp * (+e.frac || 0) * danoMult()));
        paraArena({ t: 'pdano', id: chefeId, alvo: e.jogador, golpe: GOLPE_ANIM[e.golpe] || 'thundershock', dano, eff: 1 });
      }
    }
    paraArena({ t: 'r03', agora: now(), ...e });
  }
  /** Voltorbs roll after their target: their world creatures follow. */
  function moverVoltorbs() {
    for (const v of luta.voltorbsVivos()) {
      const r = voltorbs.get(v.id); if (!r) continue;
      if (Math.hypot(v.x - r.ultimo.x, v.z - r.ultimo.z) < 0.05) continue;
      const giro = +Math.atan2(v.x - r.ultimo.x, v.z - r.ultimo.z).toFixed(3);
      r.ultimo = { x: v.x, z: v.z };
      paraArena({ t: 'spos', id: r.ent, x: v.x, z: v.z, giro, anim: 'Walk' });
    }
  }
  function entrarJogador(w) {
    const id = idDe(w), slot = vagaDe(w);
    luta.entrar(id, { nome: nomeDe(w), lv: lvDe(w), slot });
    luta.tipos(id, tiposDe(w));
    const p = posOf(w) || slot;
    if (p) luta.posicao(id, p.x, p.z);
  }
  function step() {
    if (!luta) return;
    try {
      for (const w of naArena()) {
        const id = idDe(w);
        if (!luta.jogadores.has(id)) { entrarJogador(w); continue; }
        const p = posOf(w); if (p) luta.posicao(id, p.x, p.z);
      }
      for (const e of luta.tique()) relay(e);
      for (const id of luta.prontosPraEntrar()) {      // the wait after a faint is over: the next Pokémon comes in, with its types
        const w = wsDe(id), uid = proximo.get(id); proximo.delete(id);
        luta.trocar(id, 'desmaio');
        if (w) luta.tipos(id, tiposDe(w, uid));
        for (const e of luta.tirar()) relay(e.ev === 'troca' && e.jogador === id ? { ...e, uid: uid ?? null } : e);
      }
      moverVoltorbs();
    } catch (e) { console.warn('[r03]', e); }
  }
  const erro = (ws, r, op) => enviarA(ws, { t: 'r03_erro', erro: r.erro || r.motivo || 'op_desconhecida', op, ...(r.faltam != null ? { faltam: r.faltam } : {}) });

  return {
    /** The fight starts: a fresh boss. `chefe` = the raid's boss record (id, hp, maxHp). */
    iniciar(chefe) {
      clearInterval(timer);
      usarDados(dados());
      luta = new LutaR03(dados(), { agora: now });
      chefeId = chefe.id; voltorbs.clear(); entDe.clear(); proximo.clear();
      for (const w of naArena()) entrarJogador(w);
      luta.comecar({ maxHp: chefe.maxHp });
      for (const e of luta.tirar()) relay(e);
      timer = every(step, Math.round((dados()?.regra?.subpasso > 0 ? Math.max(0.05, Math.min(0.2, dados().regra.subpasso)) : 0.1) * 1000));
      timer.unref?.();
    },
    /** The boss's HP changed (players hit it): the engine changes phase at its thresholds. */
    aoDano(hp, maxHp) { if (!luta) return; luta.vida(hp, maxHp); for (const e of luta.tirar()) relay(e); },
    /** Can this player's Pokémon hit Zapdos now? (in range, not paralysed, Zapdos not up high in phase 2) */
    podeBater(ws) { if (!luta) return true; const r = luta.podeBaterChefe(idDe(ws)); return r.ok; },
    /** Damage multiplier for a hit landing now (stunned on the lightning rod after the generators). */
    multiplicador: () => (luta ? luta.multiplicador() : 1),
    /** The minimum HP Zapdos can be brought to before its next phase opens (the engine's floor). */
    pisoHp: () => (luta ? luta.pisoHp() : 0),
    /** Is this world id one of this fight's Voltorbs? */
    ehVoltorb: (ent) => entDe.has(+ent),
    /** A player's Pokémon hits a Voltorb (any damaging move counts as one hit; golpesParaCair hits knock it out). */
    baterVoltorb(ws, ent) {
      const vid = entDe.get(+ent); if (vid == null || !luta) return false;
      const id = idDe(ws), pode = luta.podeBaterVoltorb(id, vid);
      if (!pode.ok) return false;
      luta.atacou(id);
      luta.golpeVoltorb(id, vid);
      const v = luta.voltorbs.find((x) => x.id === vid);
      paraArena({ t: 'shp', id: +ent, hp: v ? v.hp : 0, dano: 1, eff: 1, golpe: 'tackle', de: id });
      for (const e of luta.tirar()) relay(e);
      return true;
    },
    /** The player attacked Zapdos: an F hold in progress is dropped. */
    atacou(ws) { if (luta && luta.atacou(idDe(ws))) for (const e of luta.tirar()) relay(e); },
    morte() { if (!luta) return; luta.morrer(); for (const e of luta.tirar()) relay(e); clearInterval(timer); timer = null; },
    fim() {
      if (luta) { luta.encerrar('fim'); for (const e of luta.tirar()) relay(e); }
      for (const v of voltorbs.values()) paraArena({ t: 'sumiu', id: v.ent, motivo: 'fugiu' });
      voltorbs.clear(); entDe.clear(); proximo.clear();
      clearInterval(timer); timer = null; luta = null;
    },
    /** Ops from a player: f_inicio { gerador } / f_fim (shut an overloaded generator down), trocar { uid } (switch Pokémon). */
    receber(ws, m) {
      if (!luta) return;
      const id = idDe(ws);
      if (!luta.jogadores.has(id)) entrarJogador(ws);
      if (m.op === 'f_inicio' || m.op === 'f_fim') {
        const r = luta.intencao(id, { op: m.op, gerador: m.gerador });
        for (const e of r.eventos || []) relay(e);
        if (!r.ok) erro(ws, r, m.op);
      } else if (m.op === 'trocar') {
        const r = luta.podeTrocar(id);
        for (const e of luta.tirar()) relay(e);
        if (!r.ok) { erro(ws, r, 'trocar'); return; }
        luta.trocar(id, 'voluntaria');
        luta.tipos(id, tiposDe(ws, m.uid));
        for (const e of luta.tirar()) relay(e.ev === 'troca' && e.jogador === id ? { ...e, uid: m.uid ?? null } : e);   // the client switches to this uid
      } else erro(ws, { erro: 'op_desconhecida' }, m.op);
    },
    /** The player's Pokémon fainted (server_raid.mjs `raid_desmaio`): out of the fight for the engine's wait, then `uid` comes in;
        uid null = nothing left, they watch. */
    desmaio(ws, uid) {
      if (!luta) return;
      const id = idDe(ws);
      if (!luta.jogadores.has(id)) entrarJogador(ws);
      if (uid == null) { proximo.delete(id); luta.espectador(id); }
      else { luta.desmaiou(id); proximo.set(id, uid); }
      for (const e of luta.tirar()) relay(e);
    },
    /** A player with no Pokémon able to fight watches the rest. */
    espectador(ws) { if (!luta) return; luta.espectador(idDe(ws)); for (const e of luta.tirar()) relay(e); },
    /** A player who left the arena. */
    sair(ws) { if (luta) luta.sair(idDe(ws)); },
    /** The state for someone joining mid-fight (Voltorbs carry their world id). */
    retrato() {
      if (!luta) return null;
      const r = luta.retrato();
      r.voltorbs = (r.voltorbs || []).map((v) => ({ ...v, chefe: voltorbs.get(v.id)?.ent ?? null }));
      return r;
    },
    /** The Voltorbs alive now, as world creatures (for the welcome of someone arriving mid-fight). */
    voltorbsDoMundo: () => (luta ? luta.voltorbsVivos().map((v) => { const r = voltorbs.get(v.id); const o = luta.voltorbs.find((x) => x.id === v.id); return r ? { ...registroVoltorb(r.ent, { x: v.x, z: v.z, golpes: dados()?.config?.mecanicas?.voltorb?.golpesParaCair || 2 }), hp: o?.hp ?? 1 } : null; }).filter(Boolean) : []),
    ativo: () => !!luta,
  };
}
