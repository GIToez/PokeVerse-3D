/* ARTICUNO RAID (r01, "Seafoam Blizzard") — the boss's fight on the server. The client side is upcoming/raid_r01_* (arena,
 * boss animations, attack effects, markings); it is driven by these events. Every number comes from data/raid_r01.json
 * (`regra`, `pilares`, `braseiros`), so the admin panel's data file tunes it.
 *
 * The fight:
 *   - Phases by the boss's HP (regra.limiares: phase 2 at 70 %, phase 3 at 35 %); each phase draws attacks from regra.fases
 *     and opens with regra.abertura (Blizzard, then Glacial Dive). The boss flies at the centre and turns to its target.
 *   - Ice Beam: one target; a pillar between the boss and the target takes it (inteiro → rachado → toco; a stump no longer
 *     shields). Icy Wind: a cone toward the target at cast time. Hail: circles on up to 4 players. Blizzard: everyone in
 *     range, except whoever stands in the heat of a lit brazier; then it puts out regra.nevascaApaga braziers.
 *   - Glacial Dive: marks one player, lands where they stand. Landing at a lit brazier = steam: the brazier goes out and the
 *     boss is stunned and vulnerable (damage × regra.vulnerabilidade). Otherwise it freezes everyone around the landing.
 *   - Braziers: hold F (op f_inicio / f_fim) for regra.f.segundos next to an unlit one to relight it.
 *   - Players' Pokémon are what move in the arena: positions are the partner's (pos px / pz). Damage is a fraction of the
 *     partner's max HP (regra.golpes.*.dano), sent as `pdano` (the partner's HP stays the client's, as in every raid).
 *
 *   Messages to the arena: { t: 'r01', ev, agora, ... } (ev: entrada, chefe, golpe, golpe_fim, raio, pilar, braseiro, dano,
 *   congelado, nevasca, mergulho, vulneravel, repouso, decolagem, fase, f, troca, espectador, morte, fim, retrato) and
 *   { t: 'r01_erro', erro, op }. */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Does the segment p→q cross polygon `pol` ([[x, z]…])? */
function crosses(p, q, pol) {
  const seg = (a, b, c, d) => {
    const o = (p1, p2, p3) => (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  const A = [p.x, p.z], B = [q.x, q.z];
  for (let i = 0; i < pol.length; i++) if (seg(A, B, pol[i], pol[(i + 1) % pol.length])) return true;
  return false;
}

export function createR01({ dados, paraArena, naArena, idDe, maxHpDe, clock = () => Date.now(), every = (fn, ms) => setInterval(fn, ms) , danoMult = () => 1 }) {
  const D = dados(), R = D.regra, G = R.golpes;
  let st = null, timer = null;
  const now = clock;
  const send = (ev, x = {}) => paraArena({ t: 'r01', ev, agora: now(), ...x });
  /** Where a player's Pokémon stands (the partner moves in this arena), or the trainer. */
  const posOf = (ws) => {
    const i = ws._info || {};
    return Number.isFinite(+i.px) && Number.isFinite(+i.pz) ? { x: +i.px, z: +i.pz } : { x: +i.x || 0, z: +i.z || 0 };
  };
  const players = () => naArena().filter((w) => w._info && !st?.espectadores.has(idDe(w)));
  const lit = () => D.braseiros.filter((b) => st.braseiros[b.id] === 'aceso');
  const inHeat = (p) => lit().some((b) => Math.hypot(p.x - b.x, p.z - b.z) <= (R.calor || 4));

  function hurt(ws, golpe, frac) {
    const maxHp = maxHpDe(ws) || 100, dano = Math.max(1, Math.round(maxHp * rand(frac[0], frac[1]) * danoMult()));   // × the staff's /raid damage (raid.json chefeDano)
    const id = idDe(ws);
    send('dano', { jogador: id, golpe });
    paraArena({ t: 'pdano', id: st.chefeId, alvo: id, golpe: { icebeam: 'icebeam', icywind: 'icywind', hail: 'hail', blizzard: 'blizzard', glacialdive: 'glacialdive' }[golpe] || 'tackle', dano, eff: 1 });
    const c = st.canais[id];
    if (c) { delete st.canais[id]; send('f', { jogador: id, sub: 'cancelado', motivo: 'dano', braseiro: c.braseiro }); }
  }
  /** One timed step of the current attack. */
  const at = (ms, fn) => st.agenda.push({ t: st.golpe.inicio + ms, fn });
  function face(p) {
    st.chefe.giro = +Math.atan2(p.x - st.chefe.x, p.z - st.chefe.z).toFixed(3);
    send('chefe', { x: st.chefe.x, z: st.chefe.z, giro: st.chefe.giro });
  }

  function cast(id) {
    const ps = players();
    if (!ps.length) { st.proximo = now() + 2000; return; }
    const g = G[id], inicio = now();
    st.estado = 'golpe'; st.ultimoGolpe = id;
    const ev = { id, inicio };
    if (id === 'icebeam' || id === 'glacialdive') {
      const alvo = pick(ps); ev.alvo = idDe(alvo); face(posOf(alvo));
    } else if (id === 'icywind') {
      const alvo = pick(ps), p = posOf(alvo), d = Math.hypot(p.x, p.z) || 1;
      ev.alvo = idDe(alvo); ev.direcao = [+(p.x / d).toFixed(3), +(p.z / d).toFixed(3)]; ev.origem = [st.chefe.x, st.chefe.z]; face(p);
    } else if (id === 'hail') {
      const alvos = [...ps].sort(() => Math.random() - 0.5).slice(0, g.quantidade || 4);
      ev.alvos = alvos.map(idDe);
      ev.centros = alvos.map((w) => { const p = posOf(w); return [+p.x.toFixed(2), +p.z.toFixed(2)]; });
      while (ev.centros.length < (g.quantidade || 4)) { const a = Math.random() * Math.PI * 2, r = rand(4, 15); ev.centros.push([+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)]); }
    }
    st.golpe = ev;
    send('golpe', ev);
    const s = (x) => Math.round(x * 1000), end = (ms) => at(ms, () => { send('golpe_fim', { id }); st.golpe = null; st.estado = 'livre'; st.proximo = now() + s(R.intervalo || 1.5); });

    if (id === 'icebeam') {
      at(s(g.preparo), () => {
        const w = ps.find((x) => idDe(x) === ev.alvo); if (!w) return;
        const p = posOf(w);
        const pilar = D.pilares.find((pl) => st.pilares[pl.id] !== 'toco' && crosses({ x: st.chefe.x, z: st.chefe.z }, p, pl.poligono));
        if (pilar) {
          st.pilares[pilar.id] = st.pilares[pilar.id] === 'inteiro' ? 'rachado' : 'toco';
          send('pilar', { id: pilar.id, estado: st.pilares[pilar.id] });
          send('raio', { sub: 'pilar', id: pilar.id, estado: st.pilares[pilar.id] });
          send('raio', { sub: 'fim', motivo: 'pilar' });
        } else { hurt(w, id, g.dano); send('raio', { sub: 'acerto', jogador: ev.alvo }); }
      });
      end(s(g.preparo + (g.saida || 0.24)) + 600);
    } else if (id === 'icywind') {
      at(s(g.impacto), () => {
        const [dx, dz] = ev.direcao, half = ((g.abertura || 50) / 2) * Math.PI / 180;
        for (const w of players()) {
          const p = posOf(w), vx = p.x - st.chefe.x, vz = p.z - st.chefe.z, d = Math.hypot(vx, vz);
          if (d > (g.alcance || 13) || d < 0.01) continue;
          if (Math.acos(Math.max(-1, Math.min(1, (vx * dx + vz * dz) / d))) <= half) hurt(w, id, g.dano);
        }
      });
      end(s(g.fim));
    } else if (id === 'hail') {
      at(s(g.impacto), () => { for (const w of players()) { const p = posOf(w); if (ev.centros.some(([x, z]) => Math.hypot(p.x - x, p.z - z) <= (g.raio || 2.5))) hurt(w, id, g.dano); } });
      end(s(g.fim));
    } else if (id === 'blizzard') {
      st.proximaNevasca = now() + s(R.nevascaIntervalo || 40);
      at(s(g.impacto), () => {
        const seguros = [];
        for (const w of players()) { const p = posOf(w); if (Math.hypot(p.x, p.z) > (g.raio || 20)) continue; if (inHeat(p)) seguros.push(idDe(w)); else hurt(w, id, g.dano); }
        send('nevasca', { seguros });
      });
      at(s(g.apagar), () => {
        for (const b of [...lit()].sort(() => Math.random() - 0.5).slice(0, R.nevascaApaga || 2)) { st.braseiros[b.id] = 'apagado'; send('braseiro', { id: b.id, estado: 'apagado', motivo: 'nevasca' }); }
      });
      at(s(g.fim), () => {   // tired after its big move: it lands for regra.pouso seconds
        st.golpe = null; send('golpe_fim', { id });
        st.estado = 'repouso'; st.repousoAte = now() + s(R.pouso || 5);
        send('repouso', { tipo: 'pouso', ate: st.repousoAte });
      });
    } else if (id === 'glacialdive') {
      let pouso = null;
      at(s(g.desce), () => {
        const w = players().find((x) => idDe(x) === ev.alvo);
        const p = w ? posOf(w) : { x: 0, z: 8 }, d = Math.hypot(p.x, p.z), lim = R.mergulho?.limite || 19.1;
        pouso = d > lim ? { x: (p.x / d) * lim, z: (p.z / d) * lim } : p;
        st.golpe.pouso = [+pouso.x.toFixed(2), +pouso.z.toFixed(2)];
        send('mergulho', { sub: 'desce', pouso: st.golpe.pouso });
      });
      at(s(g.marca), () => {
        const P = pouso || { x: 0, z: 8 };
        const b = lit().find((x) => Math.hypot(P.x - x.x, P.z - x.z) <= (R.mergulho?.raioBraseiro || 0.78) + (R.mergulho?.distanciaPouso || 2));
        if (b) {
          st.braseiros[b.id] = 'apagado';
          send('braseiro', { id: b.id, estado: 'apagado', motivo: 'mergulho' });
          send('mergulho', { sub: 'impacto', braseiro: b.id, vapor: true });
          st.vulneravelAte = now() + s(g.atordoado || 8);
          send('vulneravel', { ate: st.vulneravelAte });
        } else {
          send('mergulho', { sub: 'impacto', vapor: false });
          const presos = [];
          for (const w of players()) if (dist(posOf(w), P) <= (g.raioCongelamento || 5)) { presos.push(idDe(w)); hurt(w, id, g.dano); }
          if (presos.length) { const ate = now() + s(g.congelado || 4); for (const id2 of presos) st.congelados[id2] = ate; send('congelado', { jogadores: presos, ate }); }
        }
      });
      const fim = s(g.marca) + (st.vulneravelAte > now() ? s(g.atordoado || 8) : s(g.recuperacao || 2)) + s(g.retorno || 1.7);
      end(fim);
    }
  }

  function step() {
    if (!st || st.morto) return;
    const t = now();
    for (const a of st.agenda.splice(0).sort((x, y) => x.t - y.t)) { if (a.t <= t) { try { a.fn(); } catch (e) { console.warn('[r01]', e); } } else st.agenda.push(a); }
    for (const [id, c] of Object.entries(st.canais)) if (t >= c.ate) {   // a brazier relit by holding F
      delete st.canais[id];
      if (st.braseiros[c.braseiro] === 'apagado') { st.braseiros[c.braseiro] = 'aceso'; send('braseiro', { id: c.braseiro, estado: 'aceso', motivo: 'f' }); }
      send('f', { jogador: c.jogador, sub: 'fim', braseiro: c.braseiro, motivo: 'aceso' });
    }
    if (st.estado === 'repouso' && t >= st.repousoAte) { st.estado = 'livre'; send('decolagem'); st.proximo = t + Math.round((R.decolagem || 0.8) * 1000) + 600; }
    if (st.estado === 'entrada' && t >= st.proximo) st.estado = 'livre';
    if (st.estado !== 'livre' || t < st.proximo || st.vulneravelAte > t) return;
    const pool = R.fases[String(st.fase)] || R.fases['1'];
    let id = st.abertura || null;
    st.abertura = null;
    if (!id && st.fase >= 2 && pool.includes('blizzard') && t >= st.proximaNevasca) id = 'blizzard';
    if (!id) { const l = pool.filter((x) => x !== st.ultimoGolpe && x !== 'blizzard'); id = pick(l.length ? l : pool); }
    cast(id);
  }

  return {
    /** The fight starts: a fresh boss. `chefe` = the raid's boss record (id, hp, maxHp). */
    iniciar(chefe) {
      clearInterval(timer);
      const t = now();
      st = { chefeId: chefe.id, chefe: { x: 0, z: 0, giro: Math.PI }, fase: 1, estado: 'entrada', proximo: t + Math.round((R.entrada || 1.6) * 1000) + 2500,
        agenda: [], golpe: null, ultimoGolpe: null, abertura: null, proximaNevasca: t + 15000, vulneravelAte: 0, repousoAte: 0, morto: false,
        pilares: Object.fromEntries(D.pilares.map((p) => [p.id, 'inteiro'])), braseiros: Object.fromEntries(D.braseiros.map((b) => [b.id, 'aceso'])),
        congelados: {}, canais: {}, espectadores: new Set(), trocas: new Map() };
      send('entrada');
      timer = every(step, Math.round((R.tique || 0.1) * 1000));
      timer.unref?.();
    },
    /** The boss's HP changed (players hit it): phase changes at regra.limiares. */
    aoDano(hp, maxHp) {
      if (!st || st.morto) return;
      const k = hp / Math.max(1, maxHp);
      for (const f of [3, 2]) if (st.fase < f && k <= (R.limiares?.[f] ?? (f === 2 ? 0.7 : 0.35))) {
        st.fase = f; st.abertura = R.abertura?.[f] || null;
        send('fase', { fase: f });
        if (st.estado === 'livre') st.proximo = now() + Math.round((R.furia || 1.6) * 1000);
        break;
      }
    },
    /** Damage multiplier for a hit landing now (stunned after a steam dive). */
    multiplicador: () => (st && st.vulneravelAte > now() ? R.vulnerabilidade || 1.5 : 1),
    /** A player's Pokémon must be this close to the boss to hit it. */
    alcance: (ws) => (st ? dist(posOf(ws), st.chefe) <= (R.alcanceGolpe || 12) + 2 : true),
    congelado: (ws) => !!st && (st.congelados[idDe(ws)] || 0) > now(),
    morte() { if (!st) return; st.morto = true; st.agenda = []; send('morte'); },
    fim() { if (st) send('fim'); clearInterval(timer); st = null; },
    /** Ops from a player: f_inicio { braseiro } / f_fim (relight a brazier), trocar { uid } (switch Pokémon). */
    receber(ws, m) {
      if (!st) return;
      const id = idDe(ws), t = now();
      if (m.op === 'f_inicio') {
        const b = D.braseiros.find((x) => x.id === m.braseiro);
        if (!b) return;
        if (st.braseiros[b.id] !== 'apagado') return paraArena({ t: 'r01_erro', erro: 'aceso', op: m.op });
        if (dist(posOf(ws), b) > (R.f?.distancia || 2.25) + (R.f?.folga || 0.25) + 1.2) return paraArena({ t: 'r01_erro', erro: 'longe', op: m.op });
        const c = { braseiro: b.id, desde: t, ate: t + Math.round((R.f?.segundos || 3) * 1000) };
        st.canais[id] = { ...c, jogador: id };
        send('f', { jogador: id, sub: 'inicio', ...c });
      } else if (m.op === 'f_fim') {
        const c = st.canais[id]; if (!c) return;
        delete st.canais[id];
        send('f', { jogador: id, sub: 'cancelado', motivo: 'soltou', braseiro: c.braseiro });
      } else if (m.op === 'trocar') {
        const last = st.trocas.get(id) || 0, cd = Math.round((R.troca?.recarga || 6) * 1000);
        if (t - last < cd) return paraArena({ t: 'r01_erro', erro: 'troca_recarga', op: 'trocar', faltam: Math.ceil((cd - (t - last)) / 1000) });
        st.trocas.set(id, t);
        const p = posOf(ws);
        send('troca', { jogador: id, uid: m.uid ?? null, x: p.x, z: p.z });
      }
    },
    /** The player's Pokémon fainted (server_raid.mjs `raid_desmaio`): an F hold is dropped; with nothing left (uid null) they only watch. */
    desmaio(ws, uid) {
      if (!st) return;
      const id = idDe(ws), c = st.canais[id];
      if (c) { delete st.canais[id]; send('f', { jogador: id, sub: 'cancelado', motivo: 'desmaio', braseiro: c.braseiro }); }
      if (uid == null) this.espectador(ws);
    },
    /** A player with no Pokémon able to fight watches the rest. */
    espectador(ws) { if (!st) return; st.espectadores.add(idDe(ws)); send('espectador', { jogador: idDe(ws) }); },
    /** The state for someone joining mid-fight. */
    retrato() {
      if (!st) return null;
      return { fase: st.fase, estado: st.morto ? 'morto' : st.estado, pilares: st.pilares, braseiros: st.braseiros, vulneravelAte: st.vulneravelAte,
        congelados: st.congelados, chefe: st.chefe, olhar: st.golpe?.alvo ?? null, ate: st.repousoAte, canais: st.canais, golpe: st.golpe };
    },
    ativo: () => !!st,
  };
}
