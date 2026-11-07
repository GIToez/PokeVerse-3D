/* DAY CARE AND BREEDING (Nov 7) — breeding as in the main games, played out on the server.
 *
 * The Day Care (the Day Care Lady outside the Route 5 house, NPC role "daycare") takes two Pokémon from the party or the Box.
 * Every `horasPorTentativa` hours (24) counted from the moment both are in, there is a chance an Egg appears (higher for the same
 * species); up to `ovosEsperando` Eggs wait at the counter. Taking an Egg starts its incubation: it hatches by itself after
 * `horasChocar` hours (2), or `horasChocarMedalhao` (1) when the Medallion is active, online or not. Hatchlings join the party,
 * or the Box when it is full; the player is told when they are online (else at their next log-in, from the hatch log).
 *
 * Who can breed (public/data/ovo.json: egg groups, gender ratio, the base of each family, egg moves):
 *  - a male and a female that share an egg group; or anything that can breed with a Ditto (genderless ones included);
 *  - never: the "Undiscovered" group (legendaries, babies, Nidorina/Nidoqueen…), two Ditto, two of the same gender.
 * What the Egg holds (the mother's family, or the non-Ditto parent's):
 *  - species: the base of that family the game has (Raichu → Pikachu); Nidoran♀ gives either Nidoran.
 *  - IVs: 3 stats copied from the parents (5 if either holds a Destiny Knot); a parent holding a Power item always passes that
 *    stat; the rest are random.
 *  - nature: a parent holding an Everstone passes its nature; otherwise random.
 *  - moves: its level-1 moves, plus every egg move of the species either parent knows (egg moves first, 4 at most).
 *  - shiny: the game's normal odds. Ball: Poké Ball. Level: `nivelAoChocar`.
 * Gender: Pokémon have none stored, so it comes from the record's uid and the species' ratio — the same answer every time.
 *
 * Save: save.creche = { pais: [mon, mon], desde, tentativa, ovos: [egg…] } (the two in care and the Eggs waiting),
 *       save.ovos = [egg…] (incubating). An egg = { uid, dex, nome, inicio, prontoEm, dentro: { ivs, natureza, movs, lv } }.
 * Messages: { t: 'creche', op: 'ver' | 'deixar' {uid} | 'retirar' {i} | 'pegar' } → { t: 'creche', vista, save?, rev? }
 *           server → { t: 'ovo_chocou', mon, save, rev } when an Egg hatches. */
import fs from 'node:fs';
import nodePath from 'node:path';

const STATS = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
export const PADRAO = {
  ligado: true, horasPorTentativa: 24, chance: { mesmaEspecie: 0.7, outra: 0.4, ditto: 0.5 }, ovosEsperando: 3, ovosCarregados: 6,
  horasChocar: 2, horasChocarMedalhao: 1, nivelAoChocar: 1, ivsHerdados: 3, ivsComNo: 5,
  itens: { everstone: 950001, destinyKnot: 950002, power: { 950003: 0, 950004: 1, 950005: 2, 950006: 3, 950007: 4, 950008: 5 } },
};

export function createBreeding({ dataDir, accounts, saveAccounts, send, socketsOf, newIndividual, markCaught, gameConfig, Ind, moveExists, log = () => {} }) {
  const lerJ = (f, d) => { try { return JSON.parse(fs.readFileSync(nodePath.join(dataDir, f), 'utf8')); } catch { return d; } };
  let cache = { t: 0, cfg: PADRAO, ovo: null };
  function dados() {
    if (Date.now() - cache.t > 30e3) cache = { t: Date.now(), cfg: { ...PADRAO, ...(lerJ('breeding.json', {}) || {}) }, ovo: lerJ('ovo.json', { especies: {} }) };
    return cache;
  }
  const cfg = () => dados().cfg;
  const esp = dex => dados().ovo?.especies?.[String(+dex)] || null;
  const UNDISCOVERED = 15, DITTO_GROUP = 13;

  // ── Gender ─────────────────────────────────────────────────────────────────────────
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  /** 'm' | 'f' | null (genderless). A stored `sexo` wins (hatchlings get one). */
  function sexoDe(p) {
    if (p?.sexo === 'm' || p?.sexo === 'f') return p.sexo;
    const e = esp(p?.dex);
    if (!e || e.macho == null || e.macho < 0) return null;
    if (e.macho >= 100) return 'm';
    if (e.macho <= 0) return 'f';
    return (hash(p.uid ?? (p.dex + ':' + (p.ivs || []).join(','))) % 1000) < e.macho * 10 ? 'm' : 'f';
  }
  const ehDitto = p => +p?.dex === 132;
  const grupos = p => (esp(p?.dex)?.grupos || []).map(Number);

  /** Can these two make an Egg? { ok, motivo, mae } — `mae` is the parent whose family the Egg is. */
  function compat(a, b) {
    if (!a || !b) return { ok: false, motivo: 'Leave two Pokémon.' };
    const ga = grupos(a), gb = grupos(b);
    if (!esp(a.dex) || !esp(b.dex)) return { ok: false, motivo: 'One of them is a Pokémon nobody has bred yet.' };
    if (ga.includes(UNDISCOVERED) || gb.includes(UNDISCOVERED)) return { ok: false, motivo: (ga.includes(UNDISCOVERED) ? a : b).nome + ' can\'t have Eggs.' };
    if (ehDitto(a) && ehDitto(b)) return { ok: false, motivo: 'Two Ditto can\'t have an Egg.' };
    if (ehDitto(a) || ehDitto(b)) return { ok: true, mae: ehDitto(a) ? b : a, ditto: true };
    const sa = sexoDe(a), sb = sexoDe(b);
    if (!sa || !sb) return { ok: false, motivo: (sa ? b : a).nome + ' only breeds with a Ditto.' };
    if (sa === sb) return { ok: false, motivo: 'They are both ' + (sa === 'm' ? 'male' : 'female') + '.' };
    if (!ga.some(g => gb.includes(g))) return { ok: false, motivo: 'They don\'t share an egg group.' };
    return { ok: true, mae: sa === 'f' ? a : b, mesma: +a.dex === +b.dex };
  }
  function chanceDe(c, a, b) {
    const C = cfg().chance || {};
    if (!c.ok) return 0;
    if (c.ditto) return +C.ditto || 0.35;
    return +(+a.dex === +b.dex ? C.mesmaEspecie : C.outra) || 0.2;
  }
  const linhaChance = ch => ch >= 0.5 ? 'The two seem to get along very well.' : ch >= 0.3 ? 'The two seem to get along.' : ch > 0 ? 'The two don\'t seem to like each other much.' : '';

  /** The species that hatches. */
  function especieDoOvo(mae) {
    const e = esp(mae.dex);
    let dex = +(e?.baseNoJogo || e?.base || mae.dex);
    if (dex === 29 || dex === 32) dex = Math.random() < 0.5 ? 29 : 32;   // Nidoran♀ (and a Nidoran♂ with a Ditto) gives either
    return dex;
  }
  const heldId = p => { const h = p?.held; return h == null ? null : +(typeof h === 'object' ? h.id : h) || null; };

  /** Everything inside the Egg, decided when it is laid (the parents as they are now). */
  function montarOvo(a, b, c) {
    const C = cfg(), I = C.itens || PADRAO.itens, dex = especieDoOvo(c.mae), e = esp(dex);
    const pais = [a, b];
    // IVs: power items first, then random stats from random parents, up to 3 (5 with a Destiny Knot)
    const nos = pais.some(p => heldId(p) === +I.destinyKnot);
    const quantos = nos ? +C.ivsComNo || 5 : +C.ivsHerdados || 3;
    const ivs = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32)), herdou = [];
    const power = pais.map(p => ({ p, stat: I.power?.[String(heldId(p))] })).filter(x => Number.isInteger(x.stat));
    if (power.length) {
      const x = power[Math.floor(Math.random() * power.length)];
      ivs[x.stat] = +(x.p.ivs?.[x.stat] ?? ivs[x.stat]); herdou.push(x.stat);
    }
    const livres = [0, 1, 2, 3, 4, 5].filter(i => !herdou.includes(i));
    while (herdou.length < quantos && livres.length) {
      const i = livres.splice(Math.floor(Math.random() * livres.length), 1)[0], p = pais[Math.floor(Math.random() * 2)];
      ivs[i] = +(p.ivs?.[i] ?? ivs[i]); herdou.push(i);
    }
    // nature
    const pedra = pais.filter(p => heldId(p) === +I.everstone && p.natureza);
    const natureza = pedra.length ? pedra[Math.floor(Math.random() * pedra.length)].natureza : null;
    // moves: egg moves either parent knows, then its level-1 moves
    const conhecidos = new Set(pais.flatMap(p => (p.movs || []).map(m => m.id)));
    const familia = esp(c.mae.dex);   // egg moves of the hatchling and of the family's true base (Pikachu's are listed under Pichu)
    const lista = [...new Set([...(e?.golpesOvo || []), ...(esp(familia?.base)?.golpesOvo || [])])];
    const ovoMoves = lista.filter(id => conhecidos.has(id) && moveExists(id));
    const lv = Math.max(1, +C.nivelAoChocar || 1);
    const base = Ind.golpesIniciais(dex, lv, ['tackle']).filter(id => !ovoMoves.includes(id));
    const movs = [...ovoMoves, ...base].slice(0, 4);
    return {
      uid: 'ovo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), dex, nome: e?.nome || 'Pokémon',
      de: pais.map(p => p.nome), em: Date.now(),
      dentro: { ivs, herdou, natureza, movs, lv, ovoMoves },
    };
  }

  // ── The Day Care, per account ───────────────────────────────────────────────────────
  const saveDe = c => c.save || (c.save = {});
  function creche(c) {
    const s = saveDe(c);
    if (!s.creche || typeof s.creche !== 'object') s.creche = { pais: [null, null], desde: 0, tentativa: 0, ovos: [] };
    if (!Array.isArray(s.creche.pais)) s.creche.pais = [null, null];
    if (!Array.isArray(s.creche.ovos)) s.creche.ovos = [];
    if (!Array.isArray(s.ovos)) s.ovos = [];
    return s.creche;
  }
  /** Rolls the Eggs earned since the last look (lazy: no timer runs for offline players). */
  function avancar(c) {
    const C = cfg(), k = creche(c), [a, b] = k.pais;
    if (!C.ligado || !a || !b) return 0;
    const comp = compat(a, b), ch = chanceDe(comp, a, b);
    if (!comp.ok || !(ch > 0)) return 0;
    const passo = Math.max(0.0005, +C.horasPorTentativa || 24) * 3600e3, agora = Date.now();
    if (!k.tentativa) k.tentativa = agora;
    let n = 0;
    while (agora - k.tentativa >= passo && n < 50) {
      k.tentativa += passo; n++;
      if (k.ovos.length < (+C.ovosEsperando || 3) && Math.random() < ch) k.ovos.push(montarOvo(a, b, comp));
    }
    if (agora - k.tentativa > passo * 50) k.tentativa = agora;
    return n;
  }
  const resumo = p => p ? { uid: p.uid, dex: +p.dex, nome: p.nome, lv: p.lv, shiny: !!p.shiny, sexo: sexoDe(p), held: heldId(p), ivs: p.ivs || null, natureza: p.natureza || null } : null;
  /* The role each one plays, as in the games: the Egg is always the mother's family; a Ditto turns into the copy of the other's
     opposite (a female copy of a male, a male copy of a female), so the Egg is the other parent's family. */
  function papeis(a, b) {
    if (!a || !b) return [null, null];
    const role = (p, o) => ehDitto(p) ? (sexoDe(o) === 'm' ? 'f' : sexoDe(o) === 'f' ? 'm' : 'ditto') : sexoDe(p);
    return [role(a, b), role(b, a)];
  }
  function vista(c) {
    const C = cfg(), k = creche(c), [a, b] = k.pais, comp = a && b ? compat(a, b) : null, ch = comp ? chanceDe(comp, a, b) : 0;
    const proxima = a && b && comp?.ok ? Math.max(0, (k.tentativa || Date.now()) + Math.max(0.0005, +C.horasPorTentativa || 24) * 3600e3 - Date.now()) : null;
    return {
      ligado: !!C.ligado, pais: [resumo(a), resumo(b)], papeis: papeis(a, b), mae: comp?.ok ? k.pais.indexOf(comp.mae) : -1, compat: comp ? { ok: comp.ok, motivo: comp.motivo || null, linha: comp.ok ? linhaChance(ch) : null, chance: ch, especie: comp.ok ? esp(especieDoOvo(comp.mae))?.nome || null : null } : null,
      ovosEsperando: k.ovos.length, maxEsperando: +C.ovosEsperando || 3, proximaMs: proxima,
      carregados: saveDe(c).ovos.map(o => ({ uid: o.uid, dex: o.dex, nome: o.nome, inicio: o.inicio, prontoEm: o.prontoEm, faltaMs: Math.max(0, (o.prontoEm || 0) - Date.now()) })), maxCarregados: +C.ovosCarregados || 6,
      horasChocar: +C.horasChocar || 2, horasChocarMedalhao: +C.horasChocarMedalhao || 1, medalhao: (+saveDe(c).medalhaoAte || 0) > Date.now(),
      itens: C.itens || PADRAO.itens,
    };
  }
  /** Takes a Pokémon out of the party / Box by uid. */
  function tirarDoSave(s, uid) {
    for (const L of [s.time, s.caixa]) {
      if (!Array.isArray(L)) continue;
      const i = L.findIndex(p => String(p?.uid) === String(uid));
      if (i >= 0) return { p: L.splice(i, 1)[0], deTime: L === s.time };
    }
    return null;
  }
  const cabe = (s, p) => { if (!Array.isArray(s.time)) s.time = []; if (!Array.isArray(s.caixa)) s.caixa = []; (s.time.length < 6 ? s.time : s.caixa).push(p); return s.time.includes(p); };

  function operar(u, m) {
    const c = accounts[u];
    if (!c) return { erro: 'Log in first.' };
    const s = saveDe(c), k = creche(c), C = cfg();
    avancar(c); chocarProntos(u);
    const op = String(m.op || 'ver');
    const pronto = (extra = {}) => { c.rev = (c.rev || 0) + 1; saveAccounts(); return { ok: true, vista: vista(c), save: s, rev: c.rev, ...extra }; };
    if (op === 'ver') return { ok: true, vista: vista(c) };
    if (!C.ligado) return { erro: 'The Day Care is closed for now.' };
    if (op === 'deixar') {
      const vaga = k.pais.findIndex(p => !p);
      if (vaga < 0) return { erro: 'The Day Care already has two of your Pokémon.' };
      const achado = [...(s.time || []), ...(s.caixa || [])].find(p => String(p?.uid) === String(m.uid));
      if (!achado) return { erro: 'That Pokémon is not yours.' };
      if (achado.travado) return { erro: achado.nome + ' is locked: unlock it first.' };
      if (achado.transf) return { erro: 'Wait for the transformation to wear off.' };
      if ((s.time || []).includes(achado) && (s.time || []).filter(p => p && p !== achado).length < 1) return { erro: 'Keep at least one Pokémon with you.' };
      const t = tirarDoSave(s, m.uid);
      delete t.p.seguindo;
      if (s.seguidorUid != null && String(s.seguidorUid) === String(t.p.uid)) delete s.seguidorUid;
      k.pais[vaga] = t.p;
      k.tentativa = Date.now(); if (!k.desde) k.desde = Date.now();
      log('daycare', u, 'left', t.p.nome);
      return pronto({ aviso: 'We\'ll take good care of ' + t.p.nome + '.' });
    }
    if (op === 'retirar') {
      const i = +m.i, p = k.pais[i];
      if (!p) return { erro: 'Nothing there.' };
      k.pais[i] = null;
      if (!k.pais.some(Boolean)) { k.desde = 0; k.tentativa = 0; }
      const naEquipe = cabe(s, p);
      return pronto({ aviso: p.nome + (naEquipe ? ' is back in your party.' : ' went to your Box (your party is full).') });
    }
    if (op === 'pegar') {
      if (!k.ovos.length) return { erro: 'There is no Egg yet.' };
      const max = +C.ovosCarregados || 6;
      if (s.ovos.length >= max) return { erro: 'You can carry ' + max + ' Eggs at most: hatch some first.' };
      const n = Math.min(k.ovos.length, max - s.ovos.length), pegos = k.ovos.splice(0, n);
      const med = (+s.medalhaoAte || 0) > Date.now(), horas = med ? +C.horasChocarMedalhao || 1 : +C.horasChocar || 2, agora = Date.now();
      for (const o of pegos) { o.inicio = agora; o.prontoEm = agora + horas * 3600e3; delete o.metros; delete o.total; }
      s.ovos.push(...pegos);
      log('daycare', u, 'took', n, 'egg(s)');
      const t = horas === 1 ? '1 hour' : horas < 1 ? Math.round(horas * 60) + ' minutes' : horas + ' hours';
      return pronto({ aviso: (n === 1 ? 'You got an Egg! It hatches in ' + t : 'You got ' + n + ' Eggs! They hatch in ' + t) + (med ? ' (Medallion).' : '.') });
    }
    return { erro: 'Unknown Day Care action.' };
  }

  // ── Incubation: Eggs hatch by themselves when their time is up ──────────────────────
  /** Hatches every Egg of this account whose time is up. Returns how many. */
  function chocarProntos(u) {
    const c = accounts[u];
    if (!c?.save?.ovos?.length) return 0;
    const agora = Date.now();
    let n = 0;
    for (const o of [...c.save.ovos]) {
      if (!o.prontoEm) { o.inicio = agora; o.prontoEm = agora + (+cfg().horasChocar || 2) * 3600e3; continue; }   // an Egg from before incubation existed
      if (o.prontoEm > agora) continue;
      chocar(u, c, o); n++;
    }
    if (n) { c.rev = (c.rev || 0) + 1; saveAccounts(); }
    return n;
  }
  function chocar(u, c, o) {
    const s = c.save;
    s.ovos = s.ovos.filter(x => x !== o);
    const d = o.dentro || {}, e = esp(o.dex);
    const pk = newIndividual({ dex: o.dex, nome: e?.nome || o.nome, glb: 'pm' + String(o.dex).padStart(4, '0') + '_00', lv: d.lv || 1 });
    if (Array.isArray(d.ivs) && d.ivs.length === 6) pk.ivs = d.ivs.map(v => Math.max(0, Math.min(31, v | 0)));
    if (d.natureza) pk.natureza = d.natureza;
    pk.movs = (d.movs || []).filter(moveExists).slice(0, 4).map(id => Ind.novoGolpe(id));
    if (!pk.movs.length) delete pk.movs;
    pk.sexo = sexoDe({ ...pk, sexo: undefined });
    pk.origem = 'ovo';
    pk.chocadoEm = Date.now();
    pk.amizade = 120;
    const naEquipe = cabe(s, pk);
    markCaught?.(c, pk.dex);
    log('daycare', u, 'hatched', pk.nome, pk.shiny ? 'shiny' : '');
    const socks = socketsOf(u);
    if (!socks.length) { if (!Array.isArray(s.chocados)) s.chocados = []; s.chocados.push({ nome: pk.nome, shiny: !!pk.shiny, caixa: !naEquipe }); s.chocados = s.chocados.slice(-12); }   // told at the next log-in
    for (const ws of socks) send(ws, { t: 'ovo_chocou', mon: pk, caixa: !naEquipe, save: s, rev: (c.rev || 0) + 1 });
  }

  /* Every 30 s: Eggs whose time is up hatch (online or not), and a new Egg at the counter is announced to an online player. */
  setInterval(() => {
    for (const [u, c] of Object.entries(accounts)) {
      if (c?.save?.ovos?.length) chocarProntos(u);
      const k = c?.save?.creche;
      if (!k?.pais?.[0] || !k.pais[1]) continue;
      const socks = socketsOf(u);
      if (!socks.length) continue;
      const antes = k.ovos?.length || 0;
      avancar(c);
      if ((k.ovos?.length || 0) > antes) {
        saveAccounts();
        for (const ws of socks) send(ws, { t: 'sistema', texto: '🥚 The Day Care Lady on Route 5 has an Egg for you!' });
      }
    }
  }, 30e3).unref?.();
  /** At log-in: what hatched while the player was away. */
  function aoEntrar(u, ws) {
    chocarProntos(u);
    const s = accounts[u]?.save;
    if (!s?.chocados?.length) return;
    for (const h of s.chocados) send(ws, { t: 'sistema', texto: '🥚 While you were away, your Egg hatched: {x} joined {onde}.', vars: { x: (h.shiny ? '✨ ' : '') + h.nome, onde: h.caixa ? 'your Box' : 'your party' } });
    delete s.chocados; saveAccounts();
  }

  return { operar, aoEntrar, chocarProntos, vista: u => accounts[u] ? vista(accounts[u]) : null, _test: { compat, montarOvo, sexoDe, especieDoOvo, avancar, chocar, creche } };
}
