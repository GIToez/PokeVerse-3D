/* ROAMING LEGENDARIES (Nov 6) — a legendary that travels around the overworld by itself, in plain sight, for everyone on the map.
 * Flyers (the birds, Lugia, Ho-Oh) cross the sky in a straight line high above the ground and land in an area for a while;
 * walkers (the Gen 2 dogs, Mew) run from area to area along the routes. Players can see one coming, chase it and fight it once
 * it is on the ground (in the sky it is out of reach). It is a normal shared-world wild underneath (server_world.mjs): the server
 * drives it while nobody fights it; the first hit hands it to that player's game for the fight, and 25 s without a hit gives it
 * back to the server, which sends it on its way. Its HP stays between fights. It breaks away when its HP drops past each
 * `fogeAbaixo` mark, fleeing to another area. Knocked out, it is a catch for 20 s; then it is gone, like any wild.
 *
 * Rules (public/data/roamers.json, the admin panel's "Roaming legendaries" page):
 *  - one roamer at a time, `esperaMin` minutes after the last one ends; it stays `duracaoMin` minutes, then leaves the region.
 *  - each Pokémon spawns at most `limitePorJanela` times in `janelaHoras` hours.
 *  - picked by `peso` (legendaries weigh more than mythicals).
 *  - a bird or a dog brings its two siblings with it `chanceTrio` of the time, each in a different area; the admin's
 *    "Spawn trio" does it on purpose (events).
 *  - Mew (`disfarce`) looks like a Pokémon of the area it is in, and shows itself when hit.
 * State that must survive a restart (the spawn history, when the last one ended) is server/data/roamers_state.json. */
import fs from 'node:fs';
import nodePath from 'node:path';

const TICK_MS = 250, FIGHT_IDLE_MS = 25e3, NEAR_ANNOUNCE = 90, CLIMB = 30;
const TRIOS = { aves: [144, 145, 146], caes: [243, 244, 245] };
export const DEFAULTS = {
  ligado: true, mapa: 'kanto', esperaMin: 120, duracaoMin: 45, limitePorJanela: 2, janelaHoras: 72, chanceTrio: 0.08, anunciar: true,
  flipX: -1, alturaVoo: 9, velVoo: 9, velAndar: 5, pouso: [60, 150], fogeAbaixo: [0.6, 0.3],
  areas: [], lista: [],
};

export function createRoamers({ world, dataDir, stateFile, send, connections, habitats, log = () => {} }) {
  const cfgFile = nodePath.join(dataDir, 'roamers.json'), mapFile = m => nodePath.join(dataDir, m + '.json');
  let cfgCache = { mtime: -1, d: DEFAULTS };
  const cfg = () => {
    try {
      const t = fs.statSync(cfgFile).mtimeMs;
      if (t !== cfgCache.mtime) cfgCache = { mtime: t, d: { ...DEFAULTS, ...JSON.parse(fs.readFileSync(cfgFile, 'utf8')) } };
    } catch { /* no file: the defaults (nothing on the list, so nothing roams) */ }
    return cfgCache.d;
  };
  let state = { historico: [], ultimoFim: 0 };
  try { state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; } catch {}
  const saveState = () => { try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) { console.warn('roamers: save', e.message); } };

  // ── The area graph: area boxes of the map that touch (within 2 m) are neighbours ─────────────────────────────────
  let graph = null;
  function areaGraph(map) {
    if (graph?.map === map) return graph;
    const k = JSON.parse(fs.readFileSync(mapFile(map), 'utf8'));
    /* The map file is mirrored on x against the world (the game's flipX, −1 in Kanto): a box at x 30 in the file is at x −30
       where players walk. Everything here is turned into world coordinates first. */
    const F = +cfg().flipX || -1;
    const boxes = (k.caixas || []).filter(b => b.sx > 0).map(b => { const cx = F * b.x; return { a: +b.a, x0: cx - b.sx / 2, x1: cx + b.sx / 2, z0: b.z - b.sz / 2, z1: b.z + b.sz / 2, cx, cz: +b.z }; });
    const gap = (a0, a1, b0, b1) => Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));
    const adj = new Map(), door = new Map();
    for (const A of boxes) for (const B of boxes) {
      if (A === B || A.a === B.a || gap(A.x0, A.x1, B.x0, B.x1) > 2 || gap(A.z0, A.z1, B.z0, B.z1) > 2) continue;
      if (!adj.has(A.a)) adj.set(A.a, new Set());
      adj.get(A.a).add(B.a);
      // the crossing point: the middle of where the two boxes meet
      const mid = (a0, a1, b0, b1) => (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
      door.set(A.a + '>' + B.a, { x: mid(A.x0, A.x1, B.x0, B.x1), z: mid(A.z0, A.z1, B.z0, B.z1) });
    }
    const box = new Map();
    for (const b of boxes) if (!box.has(b.a)) box.set(b.a, b);
    /* Where a roamer may stop, so it never ends up inside a tree, a fence or a house: public/data/roamer_spots.json, points
       with clear, flat walkable ground 2 m all around (tall grass included), baked from the game's own collision grid with
       tools/bake_roamer_spots.cjs — re-bake after big scenery changes. Areas with none are passed through, never stopped in. */
    const spots = new Map(), add = (a, x, z) => { if (!spots.has(+a)) spots.set(+a, []); spots.get(+a).push({ x, z }); };
    try {
      const baked = JSON.parse(fs.readFileSync(nodePath.join(dataDir, 'roamer_spots.json'), 'utf8'));
      if ((baked.mapa || 'kanto') === map) for (const [a, L] of Object.entries(baked.areas || {})) for (const [x, z] of L) add(a, x, z);   // already world x
    } catch {}
    return (graph = { map, adj, door, box, spots, nomes: k.nomes || {} });
  }
  const SEA = new Set([1219, 1220, 1221, 1299]);
  function allowedAreas(map, entry) {
    const G = areaGraph(map), C = cfg();
    let L = (Array.isArray(entry.areas) && entry.areas.length ? entry.areas : C.areas?.length ? C.areas : [...G.box.keys()].filter(a => a >= 1200 && a < 1300 || a === 1191)).map(Number);
    if (entry.modo !== 'voa' && !entry.nada) L = L.filter(a => !SEA.has(a));
    return L.filter(a => G.box.has(a) && (G.spots.get(a)?.length || 0) >= 3);
  }
  /** Shortest list of areas from a to b (walkers don't cross the sea unless they swim). */
  function route(map, a, b, nada) {
    const G = areaGraph(map), prev = new Map([[a, null]]), q = [a];
    while (q.length) {
      const c = q.shift();
      if (c === b) break;
      for (const n of G.adj.get(c) || []) if (!prev.has(n) && (nada || !SEA.has(n) || n === b)) { prev.set(n, c); q.push(n); }
    }
    if (!prev.has(b)) return null;
    const out = [];
    for (let c = b; c != null; c = prev.get(c)) out.unshift(c);
    return out;
  }
  const areaName = (map, a) => areaGraph(map).nomes[a] || 'area ' + a;
  /** A place to stop in the area: deep in tall grass or on clear, flat ground (see areaGraph). */
  function landing(map, area) {
    const G = areaGraph(map), S = G.spots.get(area) || [];
    if (S.length) return S[Math.floor(Math.random() * S.length)];
    const b = G.box.get(area);   // never chosen as a destination (allowedAreas), kept so nothing breaks
    return { x: b.cx, z: b.cz };
  }
  function areaAt(map, x, z) {
    for (const b of areaGraph(map).box.values()) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b.a;
    return null;
  }

  // ── Who can spawn ──────────────────────────────────────────────────────────────────────
  const active = new Map();   // world wild id → roamer
  const entryOf = dex => (cfg().lista || []).find(e => +e.dex === +dex);
  const recent = dex => { const C = cfg(), since = Date.now() - (C.janelaHoras || 72) * 3600e3; return state.historico.filter(h => h.dex === +dex && h.em >= since).length; };
  const isActive = dex => [...active.values()].some(r => r.e.dex === +dex);
  function eligible() {
    const C = cfg();
    return (C.lista || []).filter(e => e.ligado !== false && +e.peso > 0 && !isActive(e.dex) && recent(e.dex) < (C.limitePorJanela || 2));
  }
  function pickWeighted(L) {
    const tot = L.reduce((t, e) => t + (+e.peso || 0), 0);
    let r = Math.random() * tot;
    for (const e of L) if ((r -= +e.peso || 0) < 0) return e;
    return L[L.length - 1] || null;
  }

  function announce(map, texto, vars, near = null) {
    if (!cfg().anunciar && !near) return;
    for (const ws of world.onMap(map)) {
      if (near && !(Math.hypot((+ws._info?.x) - near.x, (+ws._info?.z) - near.z) <= NEAR_ANNOUNCE)) continue;
      send(ws, { t: 'sistema', texto, vars });
    }
  }

  /** Puts one roamer on the map. `area` (optional) is where it lands first; `avoid` are areas the others of its trio took. */
  function spawn(e, { area = null, avoid = [], quiet = false } = {}) {
    const C = cfg(), map = C.mapa || 'kanto';
    const areas = allowedAreas(map, e).filter(a => !avoid.includes(a));
    if (!areas.length) return null;
    const dest = area && areas.includes(+area) ? +area : areas[Math.floor(Math.random() * areas.length)];   // an area with no tall grass to stop in: a random one instead
    const flyer = e.modo === 'voa';
    let x, z, alt = 0;
    if (flyer) {   // it comes in from the sky: starts high, a long way off, and flies to where it lands
      const b = areaGraph(map).box.get(dest), ang = Math.random() * Math.PI * 2;
      x = b.cx + Math.cos(ang) * 160; z = b.cz + Math.sin(ang) * 160; alt = C.alturaVoo || 16;
    } else { const p = landing(map, dest); x = p.x; z = p.z; }
    const disguise = e.disfarce ? disguiseFor(dest) : null;
    const w = world.placeServerWild(map, { area: dest, dex: +e.dex, glb: glbOf(e), nome: e.nome, lv: +e.lv || 50 }, x, z,
      { roamer: true, alt, ...(disguise ? { disguise } : {}) });
    const r = { w, e, map, flyer, born: Date.now(), until: Date.now() + (C.duracaoMin || 45) * 60e3, phase: 'pousado', path: [], wait: 0, speed: 0, fled: 0, area: dest, giro: 0 };
    active.set(w.id, r);
    w.onHit = ws => onHit(r, ws);
    w.onGone = reason => gone(r, reason);
    if (flyer) goTo(r, dest, false);
    else land(r);
    state.historico.push({ dex: +e.dex, em: Date.now() });
    state.historico = state.historico.slice(-200);
    saveState();
    log('roamer', e.nome, 'in', areaName(map, dest));
    if (!quiet) {
      if (disguise) announce(map, 'Something strange is roaming Kanto… people near {area} say a Pokémon there is not what it seems.', { area: areaName(map, dest) });
      else announce(map, '🌀 A legendary Pokémon is roaming Kanto: {nome} was seen {onde} {area}!', { nome: e.nome, onde: flyer ? 'flying toward' : 'running through', area: areaName(map, dest) });
    }
    return r;
  }
  /** Spawns the roll's pick and, `chanceTrio` of the time (or always when `trio`), its two siblings, each in its own area. */
  function spawnWithSiblings(e, { trio = false, area = null } = {}) {
    const out = [], first = spawn(e, { area });
    if (!first) return out;
    out.push(first);
    const fam = Object.values(TRIOS).find(t => t.includes(+e.dex));
    if (fam && (trio || Math.random() < (+cfg().chanceTrio || 0))) {
      const taken = [first.area];
      for (const d of fam) {
        if (d === +e.dex || isActive(d)) continue;
        const s = entryOf(d);
        if (!s || s.ligado === false) continue;
        const r = spawn(s, { avoid: taken, quiet: true });
        if (r) { out.push(r); taken.push(r.area); }
      }
      if (out.length > 1) announce(first.map, '🌀 The whole trio is out! {nomes} are roaming Kanto, each in a different area.', { nomes: out.map(r => r.e.nome).join(', ') });
    }
    return out;
  }

  /** Mew's disguise: a land Pokémon of the area it is in. */
  function disguiseFor(area) {
    const L = (habitats()?.areas?.[area] || []).filter(s => !s.agua && +s.dex !== 151);
    if (!L.length) return { dex: 132, glb: 'pm0132_00.glb', nome: 'Ditto' };
    const s = L[Math.floor(Math.random() * L.length)];
    return { dex: +s.dex, glb: glbOf(s), nome: s.nome };
  }

  /** The model file the game loads: pmDDDD_NN.glb. */
  function glbOf(e) { const g = String(e.glb || 'pm' + String(e.dex).padStart(4, '0') + '_00').replace(/\.glb$/, ''); return g + '.glb'; }

  // ── Moving ─────────────────────────────────────────────────────────────────────────
  function land(r) {
    const C = cfg(), [a, b] = Array.isArray(C.pouso) ? C.pouso : [60, 150];
    r.phase = 'pousado'; r.path = []; r.wait = (a + Math.random() * Math.max(0, b - a)) * 1000; r.speed = 0;
    r.area = areaAt(r.map, r.w.x, r.w.z) ?? r.area;
    r.w.area = r.area;
    if (r.e.disfarce && r.w.disguise) { r.w.disguise = disguiseFor(r.area); world.resend(r.map, r.w); }
    const hover = r.flyer ? 1.5 : r.w.disguise ? 0 : r.e.dex === 151 ? 1.2 : 0;
    world.moveServerWild(r.map, r.w, r.w.x, r.w.z, r.giro, 'Idle', hover);
    if (!r.w.disguise) announce(r.map, '{nome} landed nearby!', { nome: r.e.nome }, { x: r.w.x, z: r.w.z });
  }
  /** Sets the way to `dest`: a straight line for flyers, area to area through the crossing points for walkers. */
  function goTo(r, dest, fleeing) {
    const C = cfg(), map = r.map, G = areaGraph(map);
    const end = landing(map, dest);
    if (r.flyer) r.path = [end];
    else {
      const from = areaAt(map, r.w.x, r.w.z) ?? r.area, R = route(map, from, dest, !!r.e.nada);
      if (!R) { r.path = [end]; }
      else {
        r.path = [];
        for (let i = 0; i + 1 < R.length; i++) {
          const d = G.door.get(R[i] + '>' + R[i + 1]);
          if (d) r.path.push(d);
          const b = G.box.get(R[i + 1]);
          if (i + 2 < R.length && b) r.path.push({ x: b.cx, z: b.cz });
        }
        r.path.push(end);
      }
    }
    r.start = { x: r.w.x, z: r.w.z }; r.startAlt = r.w.alt || 0; r.total = 0;
    let px = r.w.x, pz = r.w.z;
    for (const p of r.path) { r.total += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
    r.done = 0;
    r.phase = fleeing ? 'fugindo' : 'movendo';
    r.speed = (r.flyer ? C.velVoo || 9 : C.velAndar || 5) * (fleeing ? 1.6 : 1);
    r.area = dest;
  }
  function pickNext(r, far) {
    const map = r.map, L = allowedAreas(map, r.e).filter(a => a !== r.area && ![...active.values()].some(o => o !== r && o.area === a));
    if (!L.length) return r.area;
    if (r.flyer) return L[Math.floor(Math.random() * L.length)];
    // walkers: an area 1–3 steps away (2–5 when running away), along the graph
    const hops = far ? [2, 5] : [1, 3], from = areaAt(map, r.w.x, r.w.z) ?? r.area;
    const ok = L.filter(a => { const R = route(map, from, a, !!r.e.nada); return R && R.length - 1 >= hops[0] && R.length - 1 <= hops[1]; });
    const P = ok.length ? ok : L;
    return P[Math.floor(Math.random() * P.length)];
  }
  function step(r, dt) {
    const w = r.w, C = cfg();
    let left = r.speed * dt;
    while (left > 0 && r.path.length) {
      const p = r.path[0], d = Math.hypot(p.x - w.x, p.z - w.z);
      if (d > 0.01) r.giro = Math.atan2(p.x - w.x, p.z - w.z);
      if (d <= left) { w.x = p.x; w.z = p.z; left -= d; r.done += d; r.path.shift(); }
      else { w.x += (p.x - w.x) / d * left; w.z += (p.z - w.z) / d * left; r.done += left; left = 0; }
    }
    let alt = 0;
    if (r.flyer) {   // up after take-off, down for the last stretch
      const H = C.alturaVoo || 16, toEnd = Math.max(0, r.total - r.done), a0 = Math.min(H, r.startAlt ?? 1.5);
      const up = a0 + (H - a0) * Math.min(1, r.done / CLIMB), down = 1.5 + (H - 1.5) * Math.min(1, toEnd / CLIMB);
      alt = Math.min(H, up, down);
    } else if (r.e.dex === 151 && !w.disguise) alt = 1.2;
    if (!r.path.length) return land(r);
    world.moveServerWild(r.map, w, w.x, w.z, r.giro, 'Run', alt);
  }

  // ── Fights ────────────────────────────────────────────────────────────────────────
  function onHit(r, ws) {
    const w = r.w;
    if (w.disguise) {   // Mew shows itself
      w.disguise = null; w.alt = 1.2;
      world.resend(r.map, w);
      send(ws, { t: 'sistema', texto: 'It was {nome} in disguise!', vars: { nome: r.e.nome } });
    }
    if (r.phase === 'fugindo') { world.setOwner(r.map, w, null); return; }   // running away: hits land, but it doesn't stop
    r.phase = 'lutando';
    const marks = (cfg().fogeAbaixo || []).map(Number).filter(v => v > 0 && v < 1).sort((a, b) => b - a);
    const ratio = w.hp / (w.maxHp || 1);
    const crossed = marks.filter(m => ratio <= m).length;
    if (crossed > r.fled) {
      r.fled = crossed;
      world.setOwner(r.map, w, null);
      goTo(r, pickNext(r, true), true);
      announce(r.map, '{nome} broke away and fled!', { nome: r.e.nome }, { x: w.x, z: w.z });
    }
  }
  function gone(r, reason) {
    if (!active.delete(r.w.id)) return;
    if (!active.size) { state.ultimoFim = Date.now(); saveState(); }
    log('roamer', r.e.nome, 'gone:', reason);
    if (reason === 'morreu') announce(r.map, '{nome} fainted and vanished before anyone caught it.', { nome: r.e.nome }, { x: r.w.x, z: r.w.z });
    if (reason === 'capturado') announce(r.map, '{nome} was caught! The roaming legendary is gone for now.', { nome: r.e.nome });
  }
  function leave(r, why = 'left') {
    world.remove(r.map, r.w, 'fugiu');
    if (why === 'left') announce(r.map, '{nome} has left the region.', { nome: r.e.nome });
  }

  // ── The clock ──────────────────────────────────────────────────────────────────────
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = Math.min(1, (now - last) / 1000);
    last = now;
    for (const r of [...active.values()]) {
      const w = r.w;
      if (w.state === 'gone') { gone(r, 'gone'); continue; }
      if (w.state !== 'vagando') continue;   // knocked out / being caught: the world settles it
      if (w.owner != null) {                  // a player's game runs the fight
        if (now - w.touched > FIGHT_IDLE_MS) { world.setOwner(r.map, w, null); land(r); r.wait = 8000; }
        continue;
      }
      if (now > r.until && r.phase !== 'lutando') { leave(r); continue; }
      if (r.phase === 'lutando') { land(r); r.wait = 8000; continue; }
      if (r.phase === 'pousado') { r.wait -= TICK_MS; if (r.wait <= 0) goTo(r, pickNext(r, false), false); else continue; }
      step(r, dt);
    }
    const C = cfg();
    if (C.ligado && !active.size && now - (state.ultimoFim || 0) > (C.esperaMin || 120) * 60e3 && world.onMap(C.mapa || 'kanto').length) {
      const e = pickWeighted(eligible());
      if (e) spawnWithSiblings(e);
      else state.ultimoFim = now;   // nobody can come yet: try again after another wait
    }
  }, TICK_MS).unref?.();

  function validate(c) {
    if (!c || typeof c !== 'object') return 'No settings.';
    const num = (k, lo, hi) => Number.isFinite(+c[k]) && +c[k] >= lo && +c[k] <= hi ? null : k + ' must be between ' + lo + ' and ' + hi;
    const e = num('esperaMin', 0, 10080) || num('duracaoMin', 1, 1440) || num('limitePorJanela', 1, 100) || num('janelaHoras', 1, 2160) || num('chanceTrio', 0, 1)
      || num('alturaVoo', 4, 60) || num('velVoo', 1, 40) || num('velAndar', 1, 20);
    if (e) return e;
    if (!Array.isArray(c.lista) || c.lista.length > 40) return 'lista must be a list';
    for (const x of c.lista) {
      if (!x || !Number.isInteger(+x.dex) || +x.dex < 1 || +x.dex > 1025) return 'every entry needs a dex number';
      if (!(+x.peso >= 0 && +x.peso <= 1000)) return x.nome + ': weight 0–1000';
      if (!(+x.lv >= 1 && +x.lv <= 100)) return x.nome + ': level 1–100';
      if (!['voa', 'anda'].includes(x.modo)) return x.nome + ': mode is voa (flies) or anda (walks)';
      if (x.glb && !/^pm\d{4}_\d{2}(\.glb)?$/.test(x.glb)) return x.nome + ': model like pm0144_00';
    }
    if (c.areas && (!Array.isArray(c.areas) || !c.areas.every(a => Number.isInteger(+a)))) return 'areas must be a list of area ids';
    return null;
  }

  // ── Admin (/admin/errantes) ──────────────────────────────────────────────────────────────
  function status() {
    const C = cfg(), now = Date.now();
    return {
      config: C,
      ativos: [...active.values()].map(r => ({ id: r.w.id, dex: r.e.dex, nome: r.e.nome, area: r.area, areaNome: areaName(r.map, r.area), fase: r.w.owner != null ? 'lutando' : r.phase,
        hp: r.w.hp, maxHp: r.w.maxHp, x: r.w.x, z: r.w.z, alt: r.w.alt || 0, disfarce: r.w.disguise?.nome || null, saiEm: r.until })),
      proximoEm: active.size ? null : (state.ultimoFim || 0) + (C.esperaMin || 120) * 60e3,
      contagem: Object.fromEntries((C.lista || []).map(e => [e.dex, recent(e.dex)])),
      areas: [...areaGraph(C.mapa || 'kanto').spots].filter(([, L]) => L.length >= 3).map(([a]) => a).sort((x, y) => x - y).map(a => ({ a, nome: areaName(C.mapa || 'kanto', a) })),   // only where one can stop
      agora: now,
    };
  }
  function adminRoute(rota, method, d, gm, json) {
    if (rota === '/admin/errantes' && method === 'GET') return json(200, { ok: true, ...status() }), true;
    if (rota === '/admin/errantes/nascer' && method === 'POST') {
      const e = entryOf(d.dex);
      if (!e) return json(400, { erro: 'That Pokémon is not on the roaming list.' }), true;
      if (isActive(e.dex)) return json(400, { erro: e.nome + ' is already roaming.' }), true;
      const out = spawnWithSiblings(e, { trio: !!d.trio, area: d.area ? +d.area : null });
      if (!out.length) return json(400, { erro: 'No area to put it in.' }), true;
      log('roamer', 'forced by', gm, out.map(r => r.e.nome).join(', '));
      return json(200, { ok: true, nascidos: out.map(r => ({ nome: r.e.nome, area: areaName(r.map, r.area) })), ...status() }), true;
    }
    if (rota === '/admin/errantes/encerrar' && method === 'POST') {
      const L = [...active.values()].filter(r => !d.id || r.w.id === d.id);
      for (const r of L) leave(r, d.silencio ? 'quiet' : 'left');
      if (d.zerarEspera) state.ultimoFim = 0;
      saveState();
      return json(200, { ok: true, encerrados: L.length, ...status() }), true;
    }
    if (rota === '/admin/errantes/config' && method === 'POST') {
      const erro = validate(d.config);
      if (erro) return json(400, { erro }), true;
      try {
        if (fs.existsSync(cfgFile)) fs.copyFileSync(cfgFile, nodePath.join(nodePath.dirname(stateFile), 'roamers.json.bak'));   // the backup stays out of public/
        fs.writeFileSync(cfgFile, JSON.stringify(d.config, null, 2) + '\n');
      } catch (e) { return json(500, { erro: 'Could not save: ' + e.message }), true; }
      log('roamer', 'settings saved by', gm);
      return json(200, { ok: true, ...status() }), true;
    }
    if (rota === '/admin/errantes/espera' && method === 'POST') {   // start the wait over (now) or let the next one come right away
      state.ultimoFim = d.agora ? 0 : Date.now();
      if (d.zerarContagem) state.historico = [];
      saveState();
      return json(200, { ok: true, ...status() }), true;
    }
    return false;
  }
  return { adminRoute, status, spawn: (dex, o) => { const e = entryOf(dex); return e ? spawnWithSiblings(e, o) : []; }, _test: { areaGraph, route } };
}
