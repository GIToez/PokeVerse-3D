/**
 * Turn-based battles the live client already speaks: bat_desafiar / bat_acao / bat_sair.
 * Trainer, gym, Elite Four, and player-vs-player. The server owns HP, XP, badges, and payouts.
 */
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Ind from './individual.mjs';
import * as Ev from './ev.mjs';
import * as Weather from './weather.mjs';
import * as Status from './status.mjs';
import * as Stg from './stages.mjs';
import * as Regras from './item_rules.mjs';
import { efetividade } from './rules.mjs';
import { expMultOf, expSharers } from './exp_items.mjs';

const __dir = nodePath.dirname(fileURLToPath(import.meta.url));
const HP_X = Ind.HP_X;
const STRUGGLE = { id: 'struggle', nome: 'Struggle', tipo: 'Normal', poder: 50, cat: 'fisico', pp: 1 };
/** Idle limit per battle: no move for this long and the server ends it as a loss (`fim.tempo`). */
export const BATALHA_TIMEOUT_MS = 180_000;

const NATUREZAS = Ind.NATUREZAS.map((n) => n[0]);
const ITENS_BATALHA = {
  2001: { cura: 20 * HP_X },
  2002: { cura: 50 * HP_X },
  2003: { cura: 200 * HP_X },
  2004: { cura: 'cheio' },
  2012: { revive: 0.5 },
  2013: { revive: 1 },
};

function lerJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(nodePath.join(__dir, rel), 'utf8'));
  } catch {
    return fallback;
  }
}

/** English-first wire token. Never emit Portuguese codes like `vencido`. */
function fail(error, code, extra = {}) {
  return { erro: error, error, code, ...extra };
}

function cfgDeChave(id) {
  const s = String(id ?? '');
  if (s.startsWith('ginasio:') || s.startsWith('elite:')) return s;
  return s.split('@')[0];
}

function glbDe(dex, dado) {
  if (dado?.glb) return String(dado.glb).replace(/\.glb$/, '');
  return 'pm' + String(dex).padStart(4, '0') + '_00';
}

export function criarBatalha(ctx) {
  const pdx = lerJson('public/pokedex.json', { species: [], chart: {} });
  const chart = pdx.chart || {};
  const porDex = new Map((pdx.species || []).map((s) => [+s.n, s]));
  const golpes = lerJson('public/data/moves.json', {});
  const learn = lerJson('public/data/learnset.json', { learnset: {}, pp: {} });
  Ev.usarYields(lerJson('public/data/ev_yields.json', { rende: {} }));
  Ind.carregarLearnset(learn);
  const expTab = lerJson('public/data/exp.json', { curvas: {}, especies: {} });
  const heldTab = lerJson('public/data/held.json', { itens: {} });
  const ginasios = lerJson('public/data/gyms.json', {});
  const treinadores = lerJson('public/data/trainers.json', {});
  const elite = lerJson('public/data/elite.json', { membros: [] });
  const elitePorOrdem = new Map((elite.membros || []).map((m) => [+m.ordem, m]));

  const lutas = new Map();
  const convites = new Map();
  /* Stages and Leech Seed of the Pokémon in the field. The party objects ARE the save (timeJogador), so this
     battle-only state stays out of them: a WeakMap keyed by the Pokémon, wiped on switch, faint, and battle start/end. */
  const vol = new WeakMap();
  function volDe(p) {
    let v = vol.get(p);
    if (!v) vol.set(p, (v = { est: Stg.novo(), semente: false }));
    return v;
  }
  const estDe = (p) => (p ? volDe(p).est : null);
  const limparVol = (...lista) => { for (const p of lista.flat()) if (p) vol.delete(p); };

  function contaDe(ws) {
    const u = ws._usuario && ctx.sessoes.get(ws._info?.token);
    if (!u || !ctx.contas[u]) return null;
    return { u, c: ctx.contas[u] };
  }

  function saveDe(c) {
    if (!c.save) c.save = {};
    if (!Array.isArray(c.save.time)) c.save.time = [];
    if (!Array.isArray(c.save.treinadorPago)) c.save.treinadorPago = [];
    if (!Array.isArray(c.save.insignias)) c.save.insignias = [];
    if (!c.save.ginasioCd || typeof c.save.ginasioCd !== 'object') c.save.ginasioCd = {};
    if (!c.save.elite || typeof c.save.elite !== 'object') c.save.elite = { corrida: null, vencida: false, pagos: [] };
    if (!Array.isArray(c.save.elite.pagos)) c.save.elite.pagos = [];
    if (c.save.dinheiro == null) c.save.dinheiro = 0;
    if (!c.save.itens || typeof c.save.itens !== 'object') c.save.itens = {};
    return c.save;
  }

  function especie(dex) {
    return porDex.get(+dex) || { n: +dex, name: '#' + dex, types: ['Normal'], bs: [50, 50, 50, 50, 50, 50] };
  }

  function garantirMon(p) {
    Ind.garantir(p);
    Ind.garantirMovs(p, ['tackle']);
    const S = especie(p.dex);
    p.maxHp = Ind.hpDe(S, p);
    if (p.hp == null || p.hp > p.maxHp) p.hp = p.maxHp;
    p.hp = Math.max(0, Math.round(+p.hp || 0));
    return p;
  }

  function snapshotMon(p) {
    return {
      dex: +p.dex,
      lv: +p.lv || 1,
      hp: Math.max(0, +p.hp || 0),
      maxHp: +p.maxHp || 1,
      glb: glbDe(p.dex, p),
      uid: p.uid ?? null,
      nome: p.nome || especie(p.dex).name,
    };
  }

  function timeJogador(s) {
    return (s.time || []).filter(Boolean).map((p) => garantirMon(p));
  }

  function primeiroVivo(lista) {
    return lista.find((p) => p.hp > 0) || null;
  }

  function monNpc(ent) {
    const p = garantirMon({
      dex: +ent.dex,
      lv: +ent.lv || 5,
      glb: glbDe(ent.dex, ent),
      nome: especie(ent.dex).name,
      ivs: [15, 15, 15, 15, 15, 15],
      natureza: 'Hardy',
      uid: 'npc-' + ent.dex + '-' + (ent.lv || 0) + '-' + Math.random().toString(36).slice(2, 7),
    });
    p.hp = p.maxHp;
    return p;
  }

  function velDe(p) {
    return Ind.statDe(especie(p.dex), p, 5) * Status.mulVel(p) * Stg.mulStat(estDe(p), 5);
  }

  /** A medicine in a turn battle. Amounts already in ITENS_BATALHA stay as they are; other cures use item_rules. */
  function usarItemNaLuta(eu, id, save) {
    const regra = ITENS_BATALHA[id];
    const conhecido = !!(regra || Regras.ehCura(id) || Regras.curaStatus(id) || Regras.ehReanima(id));
    if (!conhecido || !(save.itens[id] > 0) || !eu) return false;
    const quais = Regras.statusDe(id);
    const tinha = Status.limpo(eu.status);
    const curaEsse = !!(tinha && (quais === null || (Array.isArray(quais) && quais.includes(tinha.id))));
    const max = eu.maxHp || 1;
    if (regra?.revive || (Regras.ehReanima(id) && !regra)) {
      if (eu.hp > 0) return false;
      const frac = regra?.revive ?? Regras.REANIMA[id] ?? 0.5;
      eu.hp = Math.max(1, Math.ceil(max * frac));
      eu.status = null;
    } else {
      if (eu.hp <= 0) return false;
      const querHp = (regra?.cura || Regras.ehCura(id)) && eu.hp < max;
      if (!querHp && !curaEsse) return false;
      if (querHp) {
        if (regra?.cura === 'cheio' || Regras.CURA[id] === Infinity) eu.hp = max;
        else eu.hp = Math.min(max, eu.hp + (regra?.cura || Regras.CURA[id] || 0));
      }
      if (curaEsse) Status.curar(eu, quais);
    }
    save.itens[id]--;
    if (save.itens[id] <= 0) delete save.itens[id];
    return true;
  }

  function anotarLance(log, lance, at, def) {
    if (!lance || !log) return;
    if (lance.parado) { log.push((at?.nome || 'Pokémon') + ' ' + Status.aviso(lance.parado) + '!'); return; }
    if (lance.errou) { log.push((at?.nome || 'Pokémon') + "'s attack missed!"); return; }
    if (lance.statusNome) {
      const quem = lance.statusQuem === 'eu' ? at : def;
      log.push((quem?.nome || 'Pokémon') + ' is ' + lance.statusNome + '!');
    }
    if (lance.estagios) {
      const quem = lance.estagios.quem === 'eu' ? at : def;
      for (const m of lance.estagios.mudancas) log.push(Stg.frase(quem?.nome, m));
    }
    if (lance.semente === true) log.push((def?.nome || 'Pokémon') + ' was seeded!');
    else if (lance.semente === 'imune') log.push("It doesn't affect " + (def?.nome || 'Pokémon') + '...');
  }

  /** End of turn: burn/poison, then Leech Seed. `pares` = [[mon, the foe in the field now]]: the seed heals that foe. */
  function residualTurno(pares, log) {
    for (const [mon] of pares) {
      if (!mon || mon.hp <= 0) continue;
      const antes = Status.limpo(mon.status);
      const d = Status.residual(mon);
      if (!(d > 0) || !antes) continue;
      mon.hp = Math.max(0, mon.hp - d);
      log.push((mon.nome || 'Pokémon') + ' is hurt by being ' + Status.nome(antes.id) + '!');
      if (mon.hp <= 0) { mon.status = null; limparVol(mon); }
    }
    for (const [mon, foe] of pares) {
      if (!mon || mon.hp <= 0 || !volDe(mon).semente) continue;
      const d = Math.min(mon.hp, Stg.drenoSemente(mon.maxHp));
      mon.hp -= d;
      log.push((mon.nome || 'Pokémon') + "'s health is sapped by Leech Seed!");
      if (foe && foe.hp > 0) foe.hp = Math.min(foe.maxHp || foe.hp, foe.hp + d);
      if (mon.hp <= 0) { mon.status = null; limparVol(mon); }
    }
  }

  function golpeDe(id) {
    if (id === 'struggle') return STRUGGLE;
    return golpes[id] || null;
  }

  function escolherGolpe(p) {
    const ids = (p.movs || []).filter((m) => m.pp > 0).map((m) => m.id);
    if (!ids.length) return STRUGGLE;
    return golpeDe(ids[Math.floor(Math.random() * ids.length)]) || STRUGGLE;
  }

  function calcularDano(at, def, g, rng = Math.random, clima = null) {
    const A = especie(at.dex),
      D = especie(def.dex);
    const estA = estDe(at), estD = estDe(def);
    if ((g.cat || '') === 'status') {
      const acc = Stg.chance(Weather.precisao(clima, g), g, estA, estD);
      if (acc < 1 && rng() > acc) return { dano: 0, eff: 1, errou: true };
      const tipo = Weather.tipoGolpe(clima, g);
      const eff = g.statusEm === 'eu' ? 1 : efetividade(chart, tipo || 'Normal', D.types || ['Normal']);
      return { dano: 0, eff };
    }
    const fisico = (g.cat || 'fisico') === 'fisico';
    const a = Ind.statDe(A, at, fisico ? 1 : 3) * Status.mulAtaque(at, fisico) * Stg.mulStat(estA, fisico ? 1 : 3);
    const defI = fisico ? 2 : 4;
    const d = Math.max(1, Weather.defesa(clima, D.types, defI, Ind.statDe(D, def, defI)) * Stg.mulStat(estD, defI));
    const tipo = Weather.tipoGolpe(clima, g);
    const poder = Math.max(1, Weather.poderGolpe(clima, g, +g.poder || 40));
    const climaMul = Weather.poderTipo(clima, tipo);
    const acc = Stg.chance(Weather.precisao(clima, g), g, estA, estD);
    if (acc < 1 && rng() > acc) return { dano: 0, eff: 1, errou: true };
    const eff = efetividade(chart, tipo || 'Normal', D.types || ['Normal']);
    const stab = (A.types || []).includes(tipo) ? 1.5 : 1;
    const base = Math.floor(((2 * (at.lv || 1) / 5 + 2) * poder * a) / d / 50 + 2);
    const dano = eff === 0 ? 0 : Math.max(1, Math.floor(base * stab * eff * climaMul * (0.85 + rng() * 0.15)));
    return { dano, eff };
  }

  function gastarPP(p, id) {
    if (id === 'struggle') return true;
    const m = (p.movs || []).find((x) => x.id === id);
    if (!m) return false;
    if (m.pp <= 0) return false;
    m.pp--;
    return true;
  }

  function expGanha(lvVencedor, dexDerrotado, lvDerrotado) {
    const b = expTab.especies?.[dexDerrotado]?.b || 60;
    const L = Math.max(1, lvDerrotado | 0);
    const Lp = Math.max(1, lvVencedor | 0);
    return Math.max(1, Math.floor((b * L) / 5 * Math.pow((2 * L + 10) / (L + Lp + 10), 2.5) + 1));
  }

  function curvaDe(dex) {
    return expTab.curvas?.[expTab.especies?.[dex]?.c || 'medium'] || [];
  }

  function aplicarExp(p, qtd) {
    const curva = curvaDe(p.dex);
    p.exp = Math.max(0, (+p.exp || curva[p.lv] || 0) + qtd);
    let subiu = 0;
    while (p.lv < 100 && (curva[p.lv + 1] ?? Infinity) <= p.exp) {
      p.lv++;
      subiu++;
    }
    if (subiu) {
      const hpAntes = p.maxHp;
      garantirMon(p);
      p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - hpAntes));
    }
    return subiu;
  }

  function retrato(bat) {
    const eu = bat.eu.field;
    const ele = bat.dele[bat.eleIdx] || null;
    return {
      t: 'bat',
      vez: bat.vez,
      nomeInimigo: bat.nomeInimigo,
      tipo: bat.tipo,
      id: bat.id,
      pvp: !!bat.pvp,
      abrir: true,
      dele: bat.dele.map(snapshotMon),
      eu: eu ? { uid: eu.uid, hp: eu.hp, maxHp: eu.maxHp, dex: eu.dex, lv: eu.lv, status: Status.exportar(eu.status), estagios: { ...estDe(eu) }, semente: !!volDe(eu).semente } : null,
      ele: ele ? { hp: ele.hp, maxHp: ele.maxHp, dex: ele.dex, lv: ele.lv, status: Status.exportar(ele.status), estagios: { ...estDe(ele) }, semente: !!volDe(ele).semente } : null,
      lances: bat.lances || [],
      log: bat.log || [],
      vidas: bat.eu.time.map((p) => ({
        uid: p.uid,
        hp: p.hp,
        maxHp: p.maxHp,
        lv: p.lv,
        exp: p.exp || 0,
        movs: p.movs,
        status: Status.exportar(p.status),
      })),
      fim: bat.fim || null,
    };
  }

  function ginasioPorId(id) {
    const n = +id;
    return Object.values(ginasios).find((g) => +g.insignia?.id === n || +g.numero === n) || null;
  }

  function treinadorPorId(id) {
    const cfg = cfgDeChave(id);
    return treinadores[cfg] ? { cfg, info: treinadores[cfg] } : null;
  }

  function esperarGym(s, g) {
    const cd = s.ginasioCd[g.insignia.id];
    if (!cd) return 0;
    if (new Date(cd.ate).toDateString() !== new Date().toDateString() && Date.now() > cd.ate) return 0;
    return Math.max(0, cd.ate - Date.now());
  }

  function abrirNpc(ws, acc, tipo, id) {
    const s = saveDe(acc.c);
    const party = timeJogador(s);
    if (!party.some((p) => p.hp > 0)) return fail('your whole party is fainted', 'party');
    let nomeInimigo = 'Trainer';
    let timeInimigo = [];
    let premio = 200;
    let meta = {};

    if (tipo === 'ginasio') {
      const g = ginasioPorId(id);
      if (!g) return fail('unknown gym', 'target');
      const espera = esperarGym(s, g);
      if (espera > 0 && !s.ginasioPagoAgora?.[g.insignia.id]) {
        return fail('the leader is resting — pay to challenge now or wait', 'wait', { espera });
      }
      nomeInimigo = g.lider;
      timeInimigo = g.time || [];
      premio = g.dinheiro || 0;
      meta = { ginasio: g.insignia.id, numero: g.numero, g };
    } else if (tipo === 'elite') {
      const ordem = +id;
      const M = elitePorOrdem.get(ordem);
      if (!M) return fail('unknown Elite Four member', 'target');
      if ((s.insignias || []).length < 8) return fail('the League opens with all 8 Kanto badges', 'badges');
      const corrida = s.elite.corrida;
      const proximo = corrida?.proximo || 1;
      if (ordem !== proximo) {
        return fail(ordem < proximo ? 'you already beat this room on this run' : 'beat the previous room first', 'order');
      }
      nomeInimigo = M.nome;
      timeInimigo = M.time || [];
      premio = M.dinheiro || 0;
      meta = { elite: ordem, membro: M };
    } else {
      const t = treinadorPorId(id);
      if (!t) return fail('unknown trainer', 'target');
      if (s.treinadorPago.some((k) => String(k).split('@')[0] === t.cfg)) {
        return fail('you already beat this trainer', 'beaten');
      }
      nomeInimigo = t.info.nome;
      timeInimigo = t.info.time || [];
      premio = t.info.dinheiro || 200;
      meta = { treinador: t.cfg, chave: String(id), info: t.info };
    }

    const dele = timeInimigo.map(monNpc);
    if (!dele.length) return fail('this trainer has no team', 'party');

    const bat = {
      tipo,
      id,
      usuario: acc.u,
      wsId: ws._id,
      nomeInimigo,
      premio,
      meta,
      eu: { time: party, field: null },
      dele,
      eleIdx: 0,
      vez: 1,
      pvp: null,
      lances: [],
      log: ['Battle against ' + nomeInimigo + '!'],
      fim: null,
      ultimo: Date.now(),
    };
    if (tipo === 'elite' && s.elite.corrida?.hp) {
      for (const p of bat.eu.time) {
        const h = s.elite.corrida.hp[String(p.uid)];
        if (h != null) p.hp = Math.max(0, Math.min(p.maxHp, +h));
      }
    }
    bat.eu.field = primeiroVivo(bat.eu.time);
    limparVol(bat.eu.time, dele);
    lutas.set(acc.u, bat);
    if (tipo === 'elite' && !s.elite.corrida) {
      s.elite.corrida = { proximo: 1, hp: Object.fromEntries(s.time.map((p) => [String(p.uid), p.hp])) };
      ctx.salvarContas();
      for (const w of ctx.socketsDe(acc.u)) ctx.enviar(w, { t: 'elite', corrida: s.elite.corrida, vencida: !!s.elite.vencida });
    }
    return retrato(bat);
  }

  function acharJogador(id) {
    const alvo = String(id || '').toLowerCase();
    if (!alvo) return null;
    for (const ws of ctx.conexoes.values()) {
      const u = ws._usuario && ctx.sessoes.get(ws._info?.token);
      if (!u) continue;
      const nome = String(ws._info?.nome || u).toLowerCase();
      if (u.toLowerCase() === alvo || nome === alvo) return { ws, u, c: ctx.contas[u] };
    }
    return null;
  }

  function dist2(a, b) {
    const dx = (a._info?.x || 0) - (b._info?.x || 0);
    const dz = (a._info?.z || 0) - (b._info?.z || 0);
    return dx * dx + dz * dz;
  }

  function abrirPvp(aWs, aAcc, b) {
    const sa = saveDe(aAcc.c);
    const sb = saveDe(b.c);
    const ta = timeJogador(sa).filter((p) => p.hp > 0);
    const tb = timeJogador(sb).filter((p) => p.hp > 0);
    if (!ta.length) return fail('your whole party is fainted', 'party');
    if (!tb.length) return fail('they have no Pokémon ready', 'party');
    const nomeA = aWs._info?.nome || aAcc.u;
    const nomeB = b.ws._info?.nome || b.u;
    const batA = {
      tipo: 'jogador',
      id: b.u,
      usuario: aAcc.u,
      wsId: aWs._id,
      nomeInimigo: nomeB,
      premio: 0,
      meta: {},
      eu: { time: timeJogador(sa), field: null },
      dele: timeJogador(sb).map((p) => ({ ...p })),
      eleIdx: 0,
      vez: 1,
      pvp: { outro: b.u, lado: 'a' },
      lances: [],
      log: ['PvP: ' + nomeA + ' vs ' + nomeB],
      fim: null,
      par: null,
    };
    const batB = {
      tipo: 'jogador',
      id: aAcc.u,
      usuario: b.u,
      wsId: b.ws._id,
      nomeInimigo: nomeA,
      premio: 0,
      meta: {},
      eu: { time: timeJogador(sb), field: null },
      dele: timeJogador(sa).map((p) => ({ ...p })),
      eleIdx: 0,
      vez: 1,
      pvp: { outro: aAcc.u, lado: 'b' },
      lances: [],
      log: ['PvP: ' + nomeA + ' vs ' + nomeB],
      fim: null,
      par: null,
    };
    batA.eu.field = primeiroVivo(batA.eu.time);
    batB.eu.field = primeiroVivo(batB.eu.time);
    limparVol(batA.eu.time, batB.eu.time);
    batA.par = batB;
    batB.par = batA;
    batA.ultimo = batB.ultimo = Date.now();
    lutas.set(aAcc.u, batA);
    lutas.set(b.u, batB);
    return { a: retrato(batA), b: retrato(batB) };
  }

  function gravarTime(acc, bat) {
    const s = saveDe(acc.c);
    const por = new Map(bat.eu.time.map((p) => [String(p.uid), p]));
    s.time = (s.time || []).map((p) => {
      const n = por.get(String(p.uid));
      return n ? Object.assign(p, { hp: n.hp, maxHp: n.maxHp, lv: n.lv, exp: n.exp, movs: n.movs }) : p;
    });
    acc.c.rev = (acc.c.rev || 0) + 1;
    ctx.salvarContas();
  }

  function pagar(acc, bat, venceu, extra = {}) {
    limparVol(bat.eu.time, bat.dele);
    const s = saveDe(acc.c);
    const fim = { venceu, desistiu: !!extra.desistiu, fugiu: !!extra.fugiu, tempo: !!extra.tempo };
    if (bat.tipo === 'treinador') {
      const g = bat.premio || 200;
      if (venceu) {
        s.dinheiro = (s.dinheiro || 0) + g;
        if (!s.treinadorPago.some((k) => String(k).split('@')[0] === bat.meta.treinador)) s.treinadorPago.push(bat.meta.chave || bat.meta.treinador);
        const r = ctx.aplicarEvento?.(acc.u, { tipo: 'treinador', cfg: +bat.meta.treinador });
        if (r) for (const w of ctx.socketsDe(acc.u)) ctx.enviarMissao(w, r);
      } else if (!extra.desistiu) {
        const perda = Math.min(s.dinheiro || 0, Math.round(g / 2));
        s.dinheiro -= perda;
        fim.perda = perda;
      }
    } else if (bat.tipo === 'ginasio') {
      const g = bat.meta.g;
      const primeira = !(s.insignias || []).includes(g.insignia.id);
      if (venceu) {
        const ganho = primeira ? g.dinheiro : Math.round(g.dinheiro / 2);
        s.dinheiro = (s.dinheiro || 0) + ganho;
        if (primeira) {
          s.insignias.push(g.insignia.id);
          fim.insignia = g.insignia.id;
          const r = ctx.aplicarEvento?.(acc.u, { tipo: 'insignia', id: g.insignia.id, numero: g.numero });
          if (r) for (const w of ctx.socketsDe(acc.u)) ctx.enviarMissao(w, r);
        }
        delete s.ginasioCd[g.insignia.id];
        if (s.ginasioPagoAgora) delete s.ginasioPagoAgora[g.insignia.id];
        fim.premio = { dinheiro: ganho };
      } else if (!extra.desistiu) {
        const cd = s.ginasioCd[g.insignia.id];
        const k = Math.min((g.cooldownMin || [15]).length - 1, cd && new Date(cd.ate).toDateString() === new Date().toDateString() ? cd.n || 0 : 0);
        s.ginasioCd[g.insignia.id] = { ate: Date.now() + (g.cooldownMin || [15])[k] * 60000, n: k + 1 };
        const perda = Math.min(s.dinheiro || 0, Math.round(g.dinheiro / 4));
        s.dinheiro -= perda;
        fim.perda = perda;
      }
    } else if (bat.tipo === 'elite') {
      const M = bat.meta.membro;
      if (venceu) {
        const ja = s.elite.pagos.includes(M.ordem);
        if (!ja) {
          s.dinheiro = (s.dinheiro || 0) + (M.dinheiro || 0);
          s.elite.pagos.push(M.ordem);
          fim.premio = { dinheiro: M.dinheiro || 0 };
        }
        if (M.campeao) {
          s.elite.corrida = null;
          s.elite.vencida = true;
          fim.campeao = true;
          fim.elite = { ordem: M.ordem, nome: M.nome, campeao: true };
        } else {
          s.elite.corrida = { proximo: M.ordem + 1, hp: Object.fromEntries(s.time.map((p) => [String(p.uid), p.hp])) };
          const prox = elitePorOrdem.get(M.ordem + 1);
          fim.elite = { ordem: M.ordem, nome: M.nome, proximo: prox ? { nome: prox.nome, ordem: prox.ordem } : null };
          fim.proximo = fim.elite.proximo;
        }
      } else {
        s.elite.corrida = null;
        fim.elite = { zerou: true, ordem: M.ordem, nome: M.nome };
      }
      for (const w of ctx.socketsDe(acc.u)) ctx.enviar(w, { t: 'elite', corrida: s.elite.corrida, vencida: !!s.elite.vencida });
    }
    gravarTime(acc, bat);
    s.bolsa = { dinheiro: s.dinheiro, itens: s.itens, bolas: s.bolas, insignias: s.insignias };
    fim.bolsa = s.bolsa;   // the client only learns about the new badge/money through this (network.mjs applies `fim.bolsa`)
    return fim;
  }

  function aplicarLance(de, at, def, g) {
    const agir = Status.podeAgir(at);
    if (!agir.age) {
      return { de, golpe: g.id, dano: 0, eff: 1, hpAlvo: def.hp, alvo: def.uid ?? null, parado: agir.porque };
    }
    if (!gastarPP(at, g.id) && g.id !== 'struggle') return null;
    if (g.id !== 'struggle' && !(at.movs || []).some((m) => m.id === g.id) && g !== STRUGGLE) return null;
    const rolado = calcularDano(at, def, g);
    if (!rolado.errou && rolado.dano > 0) {
      def.hp = Math.max(0, def.hp - rolado.dano);
      if (def.hp <= 0) def.status = null;
    }
    const emSi = g.statusEm === 'eu';
    let statusId = null, statusN = 0, curou = false;
    if (!rolado.errou && (emSi || rolado.eff !== 0)) {
      const quem = emSi ? at : def;
      if (quem?.hp > 0) {
        const tipo = Weather.tipoGolpe(null, g);
        if (!emSi && tipo === 'Fire') Status.descongelar(quem);
        if (g.statusCura === 'cheio' && !Status.limpo(quem.status)) {
          quem.hp = quem.maxHp;
          curou = true;
        }
        const novo = Status.doGolpe(quem, g, especie(quem.dex).types || []);
        if (novo) { statusId = novo.id; statusN = novo.n; }
      }
    }
    let estagios = null, semente = null;
    if (!rolado.errou) {
      /* status moves skip the type chart (Growl works on a Ghost); a side effect needs the hit to land */
      const alvoOk = def.hp > 0 && (g.cat === 'status' || rolado.eff !== 0);
      estagios = Stg.doGolpe(g, at.hp > 0 ? estDe(at) : null, alvoOk ? estDe(def) : null);
      if (g.semente && def.hp > 0) {
        if (!Stg.podeSemear(especie(def.dex).types)) semente = 'imune';
        else if (!volDe(def).semente) { volDe(def).semente = true; semente = true; }
      }
    }
    if (def.hp <= 0) limparVol(def);
    if (g.id === 'struggle') at.hp = Math.max(0, at.hp - Math.max(1, Math.floor(at.maxHp / 4)));
    if (at.hp <= 0) limparVol(at);
    return {
      de, golpe: g.id, dano: rolado.dano, eff: rolado.eff, hpAlvo: def.hp, alvo: def.uid ?? null,
      errou: !!rolado.errou,
      statusId, statusN, statusQuem: emSi ? 'eu' : 'ele', statusNome: statusId ? Status.nome(statusId) : null, curou,
      ...(estagios ? { estagios } : {}), ...(semente ? { semente } : {}),
    };
  }

  function depoisDoLance(bat, acc, log) {
    const ele = bat.dele[bat.eleIdx];
    if (ele && ele.hp <= 0) {
      const ganhador = bat.eu.field;
      if (ganhador && ganhador.hp > 0) {
        const xp = Math.max(1, Math.round(expGanha(ganhador.lv, ele.dex, ele.lv) * expMultOf(ganhador, heldTab)));
        const evR = Ev.ganharPorKo(ganhador, ele.dex);
        aplicarExp(ganhador, xp);
        log.push(ganhador.nome + ' gained ' + xp + ' EXP.');
        if (evR.ganhou?.some((n) => n)) log.push(ganhador.nome + ' gained ' + Ev.textoGanho(evR.ganhou) + ' EVs.');
        for (const { mon, part } of expSharers(bat.eu.time, ganhador, heldTab)) {
          const parte = Math.max(1, Math.round(expGanha(mon.lv, ele.dex, ele.lv) * part));
          Ev.ganharPorKo(mon, ele.dex);
          aplicarExp(mon, parte);
          log.push((mon.nome || 'Pokémon') + ' gained ' + parte + ' EXP from the Exp. Share.');
        }
      }
      if (!bat.dele.some((p) => p.hp > 0)) return 'vitoria';
      /* o próximo do treinador entra AQUI: com o índice parado no desmaiado, todo golpe seguinte caía nele (HP 0), dava EXP/EV
         de novo e o cliente "matava" o Onix do Brock a cada hit, num ciclo sem fim */
      bat.eleIdx = bat.dele.findIndex((p) => p.hp > 0);
    }
    if (bat.eu.field && bat.eu.field.hp <= 0) {
      const prox = primeiroVivo(bat.eu.time);
      if (!prox) return 'derrota';
      bat.eu.field = prox;
      bat.lances.push({ troca: prox.uid });
      log.push('Go, ' + (prox.nome || 'Pokémon') + '!');
    }
    return null;
  }

  function jogarNpc(bat, acc, acao) {
    bat.lances = [];
    bat.log = [];
    const eu = bat.eu.field;
    const ele = bat.dele[bat.eleIdx];
    if (!eu || !ele) return fail('no Pokémon in the field', 'field');
    if (acao.vez != null && +acao.vez !== bat.vez) return fail('that turn already ended', 'turn', { vez: bat.vez });

    let meuGolpe = null;
    if (acao.acao === 'trocar') {
      const prox = bat.eu.time.find((p) => String(p.uid) === String(acao.uid) && p.hp > 0);
      if (!prox) return fail('that Pokémon cannot battle', 'switch');
      limparVol(bat.eu.field);
      bat.eu.field = prox;
      bat.lances.push({ troca: prox.uid });
      bat.log.push('You sent out ' + (prox.nome || 'Pokémon') + '.');
    } else if (acao.acao === 'item') {
      const id = +acao.item;
      const s = saveDe(acc.c);
      if (bat.tipo === 'elite') return fail('no healing in the Elite Four', 'elite');
      if (!usarItemNaLuta(eu, id, s)) return fail('you cannot use that item here', 'item');
      bat.log.push('You used an item.');
    } else if (acao.acao === 'fugir') {
      bat.fim = pagar(acc, bat, false, { fugiu: true });
      lutas.delete(acc.u);
      return retrato(bat);
    } else {
      meuGolpe = golpeDe(acao.golpe) || escolherGolpe(eu);
      if (meuGolpe !== STRUGGLE && !(eu.movs || []).some((m) => m.id === meuGolpe.id && m.pp > 0)) meuGolpe = escolherGolpe(eu);
    }

    const jogarEu = () => {
      const lance = aplicarLance('eu', eu, ele, meuGolpe);
      if (lance) { bat.lances.push(lance); anotarLance(bat.log, lance, eu, ele); }
    };
    const jogarEle = () => {
      const lance = aplicarLance('ele', ele, bat.eu.field, escolherGolpe(ele));
      if (lance) { bat.lances.push(lance); anotarLance(bat.log, lance, ele, bat.eu.field); }
    };
    /* A move goes in Speed order (stages and paralysis count). Switching and items always go first. */
    const vEu = meuGolpe ? velDe(eu) : 0, vEle = meuGolpe ? velDe(ele) : 0;
    let fim = null;
    if (meuGolpe && (vEle > vEu || (vEle === vEu && Math.random() < 0.5))) {
      jogarEle();
      fim = depoisDoLance(bat, acc, bat.log);
      if (!fim && ele.hp > 0 && bat.eu.field === eu && eu.hp > 0) {   // fainted first: the one sent in does not move this turn
        jogarEu();
        fim = depoisDoLance(bat, acc, bat.log);
      }
    } else {
      if (meuGolpe) jogarEu();
      fim = depoisDoLance(bat, acc, bat.log);
      if (!fim && ele.hp > 0 && bat.eu.field.hp > 0) {
        jogarEle();
        fim = depoisDoLance(bat, acc, bat.log);
      }
    }
    if (!fim && ele.hp > 0 && bat.eu.field?.hp > 0) {
      residualTurno([[bat.eu.field, ele], [ele, bat.eu.field]], bat.log);
      fim = depoisDoLance(bat, acc, bat.log);
    }

    if (fim === 'vitoria' || fim === 'derrota') {
      bat.fim = pagar(acc, bat, fim === 'vitoria');
      lutas.delete(acc.u);
    } else {
      bat.vez++;
      gravarTime(acc, bat);
    }
    return retrato(bat);
  }

  function jogarPvp(bat, acc, acao) {
    if (!bat.pvp) return jogarNpc(bat, acc, acao);
    if (acao.vez != null && +acao.vez !== bat.vez) return fail('that turn already ended', 'turn', { vez: bat.vez });
    bat.acao = acao;
    const outro = lutas.get(bat.pvp.outro);
    if (!outro) return fail('the other trainer left', 'dropped');
    if (!outro.acao) return { t: 'bat', espera: true, vez: bat.vez, eu: retrato(bat).eu, ele: retrato(bat).ele, dele: retrato(bat).dele };

    const aFirst = bat.pvp.lado === 'a' ? bat : outro;
    const bFirst = aFirst.par;
    const accA = { u: aFirst.usuario, c: ctx.contas[aFirst.usuario] };
    const accB = { u: bFirst.usuario, c: ctx.contas[bFirst.usuario] };

    const resolver = (lado, ac, alvoLado) => {
      lado.lances = [];
      lado.log = [];
      const eu = lado.eu.field;
      const ele = alvoLado.eu.field;
      if (ac.acao === 'trocar') {
        const prox = lado.eu.time.find((p) => String(p.uid) === String(ac.uid) && p.hp > 0);
        if (prox) {
          limparVol(lado.eu.field);
          lado.eu.field = prox;
          lado.lances.push({ troca: prox.uid });
        }
        return;
      }
      if (ac.acao === 'item') {
        const id = +ac.item;
        const s = saveDe(ctx.contas[lado.usuario]);
        if (s) usarItemNaLuta(eu, id, s);
        return;
      }
      if (ac.acao === 'fugir') {
        lado.fimPedido = 'fugiu';
        return;
      }
      const g = golpeDe(ac.golpe) || escolherGolpe(eu);
      const lance = aplicarLance('eu', eu, ele, g);
      if (lance) { lado.lances.push(lance); anotarLance(lado.log, lance, eu, ele); }
    };

    const velA = velDe(aFirst.eu.field);
    const velB = velDe(bFirst.eu.field);
    const ordem = velA === velB ? (Math.random() < 0.5 ? [aFirst, bFirst] : [bFirst, aFirst]) : velA > velB ? [aFirst, bFirst] : [bFirst, aFirst];

    if (aFirst.acao.acao === 'fugir' || bFirst.acao.acao === 'fugir') {
      const quem = aFirst.acao.acao === 'fugir' ? aFirst : bFirst;
      const outroL = quem.par;
      quem.fim = pagar({ u: quem.usuario, c: ctx.contas[quem.usuario] }, quem, false, { fugiu: true });
      outroL.fim = pagar({ u: outroL.usuario, c: ctx.contas[outroL.usuario] }, outroL, true, {});
      lutas.delete(quem.usuario);
      lutas.delete(outroL.usuario);
      return retrato(bat);
    }

    for (const lado of ordem) {
      if (lado.eu.field.hp <= 0 || lado.par.eu.field.hp <= 0) continue;
      resolver(lado, lado.acao, lado.par);
      lado.par.lances = lado.par.lances || [];
      for (const l of lado.lances) {
        if (l.golpe) lado.par.lances.push({ ...l, de: 'ele', alvo: lado.par.eu.field?.uid });
      }
    }

    if (aFirst.eu.field?.hp > 0 && bFirst.eu.field?.hp > 0) {
      const extra = [];
      residualTurno([[aFirst.eu.field, bFirst.eu.field], [bFirst.eu.field, aFirst.eu.field]], extra);
      aFirst.log.push(...extra);
      bFirst.log.push(...extra);
    }

    const koA = !primeiroVivo(aFirst.eu.time);
    const koB = !primeiroVivo(bFirst.eu.time);
    if (koA || koB) {
      aFirst.fim = pagar(accA, aFirst, !koA && koB);
      bFirst.fim = pagar(accB, bFirst, !koB && koA);
      lutas.delete(aFirst.usuario);
      lutas.delete(bFirst.usuario);
    } else {
      if (aFirst.eu.field.hp <= 0) {
        aFirst.eu.field = primeiroVivo(aFirst.eu.time);
        aFirst.lances.push({ troca: aFirst.eu.field.uid });
      }
      if (bFirst.eu.field.hp <= 0) {
        bFirst.eu.field = primeiroVivo(bFirst.eu.time);
        bFirst.lances.push({ troca: bFirst.eu.field.uid });
      }
      aFirst.vez++;
      bFirst.vez++;
      aFirst.acao = null;
      bFirst.acao = null;
      gravarTime(accA, aFirst);
      gravarTime(accB, bFirst);
    }
    const outroWs = [...ctx.conexoes.values()].find((w) => w._id === bat.par.wsId);
    if (outroWs) ctx.enviar(outroWs, retrato(bat.par));
    return retrato(bat);
  }

  function desafiar(ws, m) {
    const acc = contaDe(ws);
    if (!acc) return { t: 'bat_erro', ...fail('log in to battle', 'account') };
    if (lutas.has(acc.u)) return { t: 'bat_erro', ...fail('you are already in a battle', 'busy') };
    const tipo = m.tipo || 'treinador';
    if (tipo === 'jogador') {
      const b = acharJogador(m.id);
      if (!b || b.u === acc.u) return { t: 'bat_erro', ...fail('that trainer is not online', 'target') };
      if (b.ws._mapa !== ws._mapa) return { t: 'bat_erro', ...fail('you must be on the same map', 'map') };
      if (dist2(ws, b.ws) > 14 * 14) return { t: 'bat_erro', ...fail('get closer to challenge them', 'near') };
      if (lutas.has(b.u)) return { t: 'bat_erro', ...fail('they are already battling', 'busy') };
      const chaveDeles = b.u + '>' + acc.u;
      if (m.aceitar || convites.get(chaveDeles)) {
        convites.delete(chaveDeles);
        convites.delete(acc.u + '>' + b.u);
        const r = abrirPvp(ws, acc, b);
        if (r.erro) return { t: 'bat_erro', ...r };
        ctx.enviar(b.ws, { ...r.b, abrir: true });
        return r.a;
      }
      convites.set(acc.u + '>' + b.u, { de: acc.u, para: b.u, em: Date.now() });
      ctx.enviar(b.ws, { t: 'bat_convite', de: acc.u, nome: ws._info?.nome || acc.u });
      return { t: 'bat', espera: true, alvo: b.u, nomeInimigo: b.ws._info?.nome || b.u };
    }
    const r = abrirNpc(ws, acc, tipo, m.id);
    if (r.erro) return { t: 'bat_erro', ...r };
    return r;
  }

  function acao(ws, m) {
    const acc = contaDe(ws);
    if (!acc) return { t: 'bat_erro', ...fail('log in to battle', 'account') };
    const bat = lutas.get(acc.u);
    if (!bat) return { t: 'bat_erro', ...fail('you are not in a battle', 'dropped') };
    const r = bat.pvp ? jogarPvp(bat, acc, m) : jogarNpc(bat, acc, m);
    if (r.erro) return { t: 'bat_erro', ...r };
    const agora = Date.now();
    bat.ultimo = agora;
    if (bat.par && !bat.acao) bat.par.ultimo = agora; /* PvP turn resolved: the other side's clock restarts too */
    if (r.t !== 'bat') return { t: 'bat', ...r };
    return r;
  }

  /* Pushed without `abrir`/`pvp`, so network.mjs routes it to `batalhaFim` instead of reopening the panel. */
  function avisarFim(bat) {
    const msg = { t: 'bat', tipo: bat.tipo, id: bat.id, nomeInimigo: bat.nomeInimigo, vez: bat.vez, fim: bat.fim, log: bat.log || [] };
    for (const w of ctx.socketsDe(bat.usuario)) ctx.enviar(w, msg);
  }

  function ocioso(bat, agora) {
    return !bat.acao && agora - (bat.ultimo || 0) > BATALHA_TIMEOUT_MS;
  }

  /** Ends an idle battle as a loss. PvP: the idle side loses and the other wins, unless both went idle. */
  function expirar(bat, agora = Date.now()) {
    if (lutas.get(bat.usuario) !== bat) return;
    const outro = bat.pvp && bat.par && lutas.get(bat.par.usuario) === bat.par ? bat.par : null;
    const msg = 'Time is up: ' + Math.round(BATALHA_TIMEOUT_MS / 1000) + ' s without a move.';
    bat.log = [msg];
    bat.fim = pagar({ u: bat.usuario, c: ctx.contas[bat.usuario] }, bat, false, { tempo: true });
    lutas.delete(bat.usuario);
    avisarFim(bat);
    if (outro) {
      outro.log = [msg];
      outro.fim = pagar({ u: outro.usuario, c: ctx.contas[outro.usuario] }, outro, !ocioso(outro, agora), { tempo: true });
      lutas.delete(outro.usuario);
      avisarFim(outro);
    }
  }

  function varrerOciosas(agora = Date.now()) {
    for (const bat of [...lutas.values()]) if (ocioso(bat, agora)) expirar(bat, agora);
  }
  setInterval(varrerOciosas, 5000).unref?.();

  function sair(ws) {
    const acc = contaDe(ws);
    if (!acc) return { t: 'bat_erro', ...fail('log in to battle', 'account') };
    const bat = lutas.get(acc.u);
    if (!bat) return { t: 'bat', fim: { venceu: false, desistiu: true } };
    if (bat.pvp && bat.par) {
      const outro = bat.par;
      outro.fim = pagar({ u: outro.usuario, c: ctx.contas[outro.usuario] }, outro, true, {});
      const w = [...ctx.conexoes.values()].find((x) => x._id === outro.wsId);
      if (w) ctx.enviar(w, retrato(outro));
      lutas.delete(outro.usuario);
    }
    bat.fim = pagar(acc, bat, false, { desistiu: true });
    lutas.delete(acc.u);
    return retrato(bat);
  }

  function bolsaGinasioReset(acc, id) {
    const s = saveDe(acc.c);
    const g = ginasioPorId(id);
    if (!g) return { erro: 'unknown gym' };
    const preco = g.resetMoedas || 500;
    if ((s.dinheiro || 0) < preco) return { erro: 'not enough Coins' };
    s.dinheiro -= preco;
    delete s.ginasioCd[g.insignia.id];
    s.ginasioPagoAgora = s.ginasioPagoAgora || {};
    s.ginasioPagoAgora[g.insignia.id] = true;
    acc.c.rev = (acc.c.rev || 0) + 1;
    ctx.salvarContas();
    return { ok: true, bolsa: { dinheiro: s.dinheiro, itens: s.itens, bolas: s.bolas, insignias: s.insignias } };
  }

  return {
    receber(ws, m) {
      const op = String(m.t || '').slice(4);
      if (op === 'desafiar') ctx.enviar(ws, desafiar(ws, m));
      else if (op === 'acao') ctx.enviar(ws, acao(ws, m));
      else if (op === 'sair') ctx.enviar(ws, sair(ws));
      else if (op === 'consultar') {
        const acc = contaDe(ws);
        const bat = acc && lutas.get(acc.u);
        ctx.enviar(ws, { t: 'bat_estado', aberta: bat ? retrato(bat) : null });
      } else ctx.enviar(ws, { t: 'bat_erro', erro: 'unknown battle request' });
    },
    bolsa(ws, op, m) {
      const acc = contaDe(ws);
      if (!acc) return null;
      if (op === 'ginasioreset') return bolsaGinasioReset(acc, m.ginasio);
      return null;
    },
    aoSair(ws) {
      const acc = contaDe(ws);
      if (!acc) return;
      const bat = lutas.get(acc.u);
      if (!bat) return;
      sair(ws);
    },
    bloquearCura(u) {
      const c = ctx.contas[u];
      return !!(c && saveDe(c).elite.corrida);
    },
    eliteDe(u) {
      const c = ctx.contas[u];
      if (!c) return { corrida: null, vencida: false };
      const e = saveDe(c).elite;
      return { corrida: e.corrida, vencida: !!e.vencida };
    },
    /* exported for tests */
    _test: { calcularDano, abrirNpc, ginasioPorId, treinadorPorId, elitePorOrdem, monNpc, lutas, pagar, cfgDeChave, varrerOciosas, expirar },
  };
}
