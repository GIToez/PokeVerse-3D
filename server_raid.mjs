/* RAID AO VIVO — o lado do SERVIDOR de desenvolvimento (27/10). O cliente (raid.mjs, raid_ui.mjs, world.mjs e os trechos do index) existe
 * desde 14/09 e espera um servidor que anuncia, enche a fila, leva todo mundo pra arena e simula o chefe; o server.mjs local deixava
 * `raid_staff`, `raid_entrar` e `raid_sair` caírem no `default:`. Este módulo é esse servidor.
 *
 * Fases (o `fase` do retrato): nenhuma → anunciada (fila aberta) → contagem (fila aberta, "começa em N s") → indo (cada participante
 * sendo levado pra arena) → luta (o chefe na arena, vida compartilhada) → fim (prêmio; em instantes cada um volta) → nenhuma.
 *
 * Staff (chat.mjs → index `staff` → {t:'raid_staff', op, valor}; GM ou cargo staff):
 *   /raid anunciar · comecar · cancelar · hp N|auto · dano F · shiny N · premio mew|sem-mew · status
 *   hp/dano/shiny/premio valem SÓ naquela raid; o padrão é o data/raid.json (painel → Arquivos de dados → Raid), relido a cada anúncio.
 * Jogador: {t:'raid_entrar'} / {t:'raid_sair'} (banner do raid_ui). Retrato {t:'raid', id, fase, nome, dex, n, vagas, nomes, eu,
 *   contagemMs, fimMs, hp, maxHp, mapa} pra todo mundo a cada mudança de fase/fila e logo depois do bem-vindo.
 *
 * IDA E VOLTA = o padrão `posGm` da moderação: a conta ganha `posGm` (onde nascer) e o cliente recarrega ({t:'raid_ir'|'raid_voltar',
 * mapa}); o login e o GET /save entregam `pos`, e o `entrar` no mapa do posGm o apaga (servidor_moderacao.aoEntrar). Onde a conta
 * estava fica em `raidVolta`, NA CONTA (sobrevive a reinício): quem reconecta na arena sem raid recebe o `raid_voltar` de novo, até sair.
 *
 * O CHEFE: o dev local manda `soloWilds: true` (o cliente nasce os selvagens sozinho) e o world.mjs do cliente fica desligado. Pro
 * PARTICIPANTE na arena o bem-vindo sai com `soloWilds: false` e o chefe na lista (`bemvindo(ws)`): o Mundo liga só com ele e o caminho
 * de sempre funciona — golpe do parceiro = {t:'ataque'} → dano calculado AQUI → `shp` pra arena; o chefe bate = `pdano` (o HP do
 * parceiro continua do cliente, como em todo o dev local); KO = `sestado` desmaiado, `raid_fim` com o prêmio e, na volta, `sumiu`.
 * EQUILÍBRIO: a fórmula do `golpear` do index, mas o chefe "luta no nível" de cada jogador (a defesa dele no nível de quem bate, o
 * ataque no nível de quem apanha) — no nível 70 de verdade um time Lv 5 faria 2 de dano e cairia num golpe só. O nível 70 é o que
 * aparece na barra e o do Pokémon do prêmio. Vida automática = soma, por participante, de FATOR_HP chefes do nível do time dele. */
import fs from 'node:fs';
import nodePath from 'node:path';
import { hp as hpBase, stat as statBase, carregarLearnset, learnsetDe } from './individual.mjs';
import { efetividade } from './rules.mjs';
import { TODOS } from './moves_all.mjs';
import * as Stg from './stages.mjs';
import { createR01 } from './server_raid_r01.mjs';

/** The Articuno raid's arena (upcoming/raid_r01_*): its fight runs in server_raid_r01.mjs, driven by data/raid_r01.json. */
const ARENA_R01 = '9700001';

/** O que vale sem data/raid.json (o mesmo PADRAO do raid.mjs do cliente, mais o que só o servidor usa). */
export const PADRAO = { arena: '4120009', vagas: 10, chefeNome: 'Mew', chefeDex: 151, chefeGlb: 'pm0151_00', chefeNivel: 70, chefeHp: 0, chefeDano: 1, taxaShiny: 100, premio: 'mew' };
const CONTAGEM_MS = 15000;                                                   // "Começa em N s": depois do /raid comecar ou da fila cheia
const INDO_MS = 30000;                                                       // espera máxima pela arena (a cena leva uns segundos pra carregar); quem chegar depois entra na luta
const LUTA_MS = 5 * 60000;                                                   // sem KO nesse tempo, o chefe foge
const FIM_MS = 8000;                                                         // do prêmio até a volta ("Em instantes você volta pra onde estava")
const FATOR_HP = 1.5;                                                        // vida automática: cada participante soma 1,5 chefe do nível dele
const FORCA_CHEFE = 0.2;                                                     // golpe do chefe = fórmula do jogo no nível do alvo × isto × o `dano` da raid
const CADA_ALVO_MS = 6000;                                                   // em média o chefe bate em cada participante a cada 6 s (com mais gente, bate mais vezes)
const FLIPX = -1;                                                            // arquivo → mundo: o exportador espelha o x (o mesmo da moderação)
const PREMIO = { dinheiro: 3000, bolas: { 1003: 5 }, itens: { 2003: 3, 2012: 2 } };   // Ultra Bola ×5, HiperPoção ×3, Reanimador ×2 (ids do menu_data.json), pra quem bateu
const FASES_FILA = new Set(['anunciada', 'contagem']), FASES_DENTRO = new Set(['indo', 'luta', 'fim']);
/** Fields a scheduled raid may set for itself (the rest stays data/raid.json's). */
const PADRAO_CAMPOS = { arena: 1, vagas: 1, chefeNome: 1, chefeDex: 1, chefeGlb: 1, chefeNivel: 1, chefeHp: 1, chefeDano: 1, taxaShiny: 1, premio: 1, lutaMin: 1 };
const OP_ALIAS = { comecar: 'comecar', iniciar: 'comecar', start: 'comecar', cancela: 'cancelar', parar: 'cancelar', cancel: 'cancelar', stop: 'cancelar', announce: 'anunciar', damage: 'dano', prize: 'premio' };
const semAcento = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const num = (v, min, max, pad) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : pad; };
const IVS_31 = [31, 31, 31, 31, 31, 31];
const SEMENTE_MS = 4000;                                                     // Leech Seed no chefe: drena a cada 4 s (o mesmo relógio do tempo real)
/** IVs do registro: o cliente usa lista [hp, atk, def, spa, spd, vel]; o servidor sorteia objeto { hp, atk, … } (individuoServidor). */
const ivsDe = p => Array.isArray(p?.ivs) ? p.ivs : (p?.ivs && typeof p.ivs === 'object') ? ['hp', 'atk', 'def', 'spa', 'spd', 'vel'].map(k => +p.ivs[k] || 0) : [0, 0, 0, 0, 0, 0];

/** h = helpers do server.mjs. `pontoSeguro()` = onde mandar quem não tem volta guardada (a frente do laboratório do Oak). */
export function criarRaid(h) {
  const { contas, sessoes, conexoes, enviar, socketsDe, logAdmin, salvarContas, salvarContasJa, dadosPub, raiz, individuoServidor, marcarPego, shinyMult, pontoSeguro } = h;

  // ── Dados do jogo (os mesmos arquivos que o cliente lê) ────────────────────────────────────────────────────────────────
  let pokedex = null;
  function especie(dex) {
    if (!pokedex) {
      pokedex = { porN: new Map(), chart: {} };
      try {
        const d = JSON.parse(fs.readFileSync(nodePath.join(raiz, 'public/pokedex.json'), 'utf8'));
        pokedex = { porN: new Map((d.species || []).map(s => [+s.n, s])), chart: d.chart || {} };
      } catch (e) { console.warn('raid: pokedex.json:', e.message); }
    }
    return pokedex.porN.get(+dex) || null;
  }
  const ESPECIE_VAZIA = { name: '?', types: ['Normal'], bs: [50, 50, 50, 50, 50, 50] };
  /* Golpes: o data/moves.json do painel (Fase 2) é a fonte; sem ele, a tabela gerada (moves_all.mjs). Relido quando muda. */
  let golpesCache = { mtime: -1, tab: TODOS };
  function golpes() {
    try {
      const arq = nodePath.join(dadosPub, 'moves.json'), mt = fs.statSync(arq).mtimeMs;
      if (mt !== golpesCache.mtime) {
        const d = JSON.parse(fs.readFileSync(arq, 'utf8'));
        golpesCache = { mtime: mt, tab: d && typeof d === 'object' && Object.keys(d).length ? Object.fromEntries(Object.entries(d).map(([k, g]) => [k, { ...g, id: k }])) : TODOS };
      }
    } catch { golpesCache = { mtime: -1, tab: TODOS }; }
    return golpesCache.tab;
  }
  /** data/raid.json validado como o raid.mjs do cliente faz (a arena e as vagas têm que bater com o que ele mostra). */
  /** `preset` = a scheduled raid's own boss (server_schedule.mjs → event.raid: arena, chefeNome, chefeDex, chefeGlb, chefeNivel…),
      laid over data/raid.json for that one raid. */
  function lerCfg(preset = null) {
    let d = {}; try { d = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, 'raid.json'), 'utf8')) || {}; } catch {}
    if (preset && typeof preset === 'object') for (const [k, v] of Object.entries(preset)) if (v != null && v !== '' && k in PADRAO_CAMPOS) d[k] = v;
    return {
      arena: /^\d{3,9}$/.test(String(d.arena ?? '')) ? String(d.arena) : PADRAO.arena,
      vagas: Math.round(num(d.vagas, 1, 50, PADRAO.vagas)),
      chefeNome: typeof d.chefeNome === 'string' && d.chefeNome.trim() ? d.chefeNome.trim().slice(0, 30) : PADRAO.chefeNome,
      chefeDex: Math.round(num(d.chefeDex, 1, 2000, PADRAO.chefeDex)),
      chefeGlb: /^pm\d{4}(_\d{2})?$/.test(String(d.chefeGlb ?? '')) ? d.chefeGlb : PADRAO.chefeGlb,
      chefeNivel: Math.round(num(d.chefeNivel, 1, 100, PADRAO.chefeNivel)),
      chefeHp: Math.round(num(d.chefeHp, 0, 1e7, PADRAO.chefeHp)),
      chefeDano: num(d.chefeDano, 0, 10, PADRAO.chefeDano),
      taxaShiny: Math.round(num(d.taxaShiny, 1, 1e6, PADRAO.taxaShiny)),
      premio: d.premio === 'sem-mew' ? 'sem-mew' : PADRAO.premio,
      lutaMin: num(d.lutaMin, 1, 30, LUTA_MS / 60000),                     // minutes to KO the boss before it flees
    };
  }
  /* A sala: o chefe no meio do bbox da cena (no Quarto da Lorelei, onde ela fica), os participantes em fileiras 6 m ao sul, de frente
     pra ele. Tudo em coordenadas do MUNDO (as do jogador, do posGm e do Mundo). O cliente ainda acerta pro chão livre mais perto. */
  function geometria(arena) {
    if (String(arena) === ARENA_R01) {   // the Articuno arena: boss at the centre, players on the regra's spawn points (south)
      const sp = dadosR01()?.spawns || [];
      return { r01: true, sp, b: { x0: -20, x1: 20, z0: -20, z1: 20 }, cx: 0, cz: 0, chefe: { x: 0, z: 0 } };
    }
    let b = null; try { b = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, arena + '.json'), 'utf8')).bbox || null; } catch {}
    if (!b || ![b.x0, b.x1, b.z0, b.z1].every(Number.isFinite)) b = { x0: -19.2, x1: 0.3, z0: 0, z1: 30 };   // o do 4120009
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    return { b, cx, cz, chefe: { x: +(FLIPX * cx).toFixed(2), z: +cz.toFixed(2) } };
  }
  const OFS = [0, 1.8, -1.8, 3.6, -3.6, 5.4, -5.4];
  function vaga(g, i) {
    if (g.r01 && g.sp.length) { const v = g.sp[i % g.sp.length]; return { x: v.x, z: v.z, giro: v.giro ?? 3.14 }; }
    const lado = OFS[i % OFS.length], fileira = Math.floor(i / OFS.length);
    const fx = Math.min(g.b.x1 - 1, Math.max(g.b.x0 + 1, g.cx + lado)), fz = Math.min(g.b.z1 - 1, Math.max(g.b.z0 + 1, g.cz - 6 - fileira * 2));
    const x = +(FLIPX * fx).toFixed(2), z = +fz.toFixed(2);
    return { x, z, giro: +Math.atan2(g.chefe.x - x, g.chefe.z - z).toFixed(3) };
  }

  // ── Estado ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  let raid = null, seq = Math.floor(Date.now() / 1000) % 1e7;               // o id segue o relógio: depois de um reinício não repete o de uma raid velha (o cliente guarda "já fui pra raid N" na aba)
  const contaDe = ws => (ws && contas[ws._usuario]) ? ws._usuario : null;  // Visitante não tem conta
  const nomeDe = u => String(contas[u]?.save?.nome || u).slice(0, 20);
  const online = () => [...conexoes.values()].filter(w => w._info);
  const naArena = () => raid ? online().filter(w => String(w._mapa) === raid.cfg.arena && raid.fila.has(contaDe(w))) : [];
  const paraArena = obj => { for (const w of naArena()) enviar(w, obj); };
  const sistema = (ws, texto) => enviar(ws, { t: 'sistema', texto });
  const todos = texto => { for (const w of online()) sistema(w, texto); };
  const danoRaid = () => raid.sobre.dano ?? raid.cfg.chefeDano;
  const taxaRaid = () => raid.sobre.shiny ?? raid.cfg.taxaShiny;
  const premioRaid = () => raid.sobre.premio ?? raid.cfg.premio;
  let r01Dados = null;
  function dadosR01() {
    if (!r01Dados) { try { r01Dados = JSON.parse(fs.readFileSync(nodePath.join(dadosPub, 'raid_r01.json'), 'utf8')); } catch (e) { console.warn('[raid] raid_r01.json:', e.message); } }
    return r01Dados;
  }
  /** The Articuno fight (only when the raid's arena is its arena). */
  const r01 = createR01({
    dados: dadosR01, danoMult: () => danoRaid(), paraArena: (o) => paraArena(o), naArena: () => naArena(), idDe: (w) => w._id,
    maxHpDe: (w) => { const u = contaDe(w); const mon = w._raidMon || (u && monDaConta(u, { uid: w._info?.uid })); if (!mon) return 0; if (mon.maxHp > 0) return mon.maxHp; const S = especie(mon.dex); return S ? hpBase(S.bs[0], lvDe(mon), ivsDe(mon)[0] || 0) : 100; },
  });
  const ehR01 = () => !!raid && String(raid.cfg.arena) === ARENA_R01;

  function retrato(u) {
    if (!raid) return { t: 'raid', fase: 'nenhuma' };
    const agora = Date.now(), c = raid.cfg;
    return { t: 'raid', id: raid.id, fase: raid.fase, nome: c.chefeNome, dex: c.chefeDex, n: raid.fila.size, vagas: c.vagas,
      nomes: [...raid.fila.values()].map(p => p.nome), eu: !!(u && raid.fila.has(u)),
      contagemMs: raid.fase === 'contagem' ? Math.max(0, raid.contagemAte - agora) : 0,
      fimMs: raid.fase === 'luta' ? Math.max(0, raid.lutaAte - agora) : raid.fase === 'fim' ? Math.max(0, raid.fimAte - agora) : 0,
      hp: raid.chefe ? raid.chefe.hp : null, maxHp: raid.chefe ? raid.chefe.maxHp : null, mapa: c.arena };
  }
  function difundir() { for (const w of online()) enviar(w, retrato(contaDe(w))); }

  /** O chefe como registro do Mundo (world.mjs `chegou`/`corpo` → index `criarSelvagem` + `montarChefeRaid`). */
  function registroChefe() {
    const c = raid.cfg, ch = raid.chefe;
    /* glb COM .glb: o corpo de selvagem carrega o arquivo pelo nome exato (criarSelvagem → modeloMon); o time guarda sem. */
    return { id: ch.id, dex: c.chefeDex, glb: c.chefeGlb + '.glb', nome: c.chefeNome, lv: c.chefeNivel, shiny: false, ivs: IVS_31, natureza: 'Serious',
      x: ch.x, z: ch.z, giro: ch.giro, anim: 'Idle', area: null, generico: true, casa: null, perfil: 'agressivo', aquatico: false, pertoDeGrama: false,
      hp: ch.hp, maxHp: ch.maxHp, estado: ch.hp > 0 ? 'vagando' : 'desmaiado', ...(ch.hp > 0 ? {} : { ate: raid.fimAte }), dono: null, raid: raid.id, chefe: true };
  }
  /** The boss's own level-up moves at its level. Damaging ones win, so a status-only tail does not replace Aeroblast. */
  function golpesDoChefe(dex, lv) {
    try { carregarLearnset(JSON.parse(fs.readFileSync(nodePath.join(dadosPub, 'learnset.json'), 'utf8'))); } catch {}
    const tab = golpes(), nivel = lv || 70, ids = [];
    for (const [id, n] of learnsetDe(dex)) if (n <= nivel && !ids.includes(id)) ids.push(id);
    const damaging = ids.map(id => tab[id]).filter(g => g && g.cat !== 'status' && g.poder > 0);
    const picked = (damaging.length ? damaging : ids.map(id => tab[id]).filter(Boolean)).slice(-4);
    return picked.length ? picked : [tab.tackle || { id: 'tackle', tipo: 'Normal', poder: 40, cat: 'fisico', anim: 'Attack' }];
  }

  // ── Contas: o Pokémon de verdade (do save), a vida automática, o prêmio ───────────────────────────────────────────────────
  /** O Pokémon da conta que está em campo: o do uid que o cliente diz, senão o primeiro do time com aquela espécie, senão o 1º do time.
      Nível/IVs/natureza vêm SEMPRE do save (o cliente só aponta qual). */
  function monDaConta(u, dica = {}) {
    const time = contas[u]?.save?.time || [];
    return (dica.uid != null && time.find(p => String(p?.uid) === String(dica.uid))) || (dica.dex != null && time.find(p => +p?.dex === +dica.dex)) || time[0] || null;
  }
  const dexDoGlb = glb => { const m = /^pm(\d{4})/.exec(String(glb || '')); return m ? +m[1] : null; };
  const lvDe = p => Math.max(1, Math.min(100, Math.round(+p?.lv || 5)));
  const statMon = (S, p, i) => statBase(S.bs[i], lvDe(p), ivsDe(p)[i] || 0, 0, p?.natureza, i);
  /** Dano de um golpe, a fórmula do `golpear` do index (STAB 1,5, tipos, 85–100 %). `lv` = o nível da luta. */
  function calcDano(golpe, lv, A, a, D, d, mult = 1) {
    const eff = efetividade(pokedex?.chart || {}, golpe.tipo, D.types);
    const stab = A.types.includes(golpe.tipo) ? 1.5 : 1;
    const base = Math.floor(((2 * lv / 5 + 2) * (+golpe.poder || 0) * a / Math.max(1, d)) / 50 + 2);
    return { eff, dano: eff === 0 ? 0 : Math.max(1, Math.floor(base * stab * eff * (0.85 + Math.random() * 0.15) * mult)) };
  }
  function vidaAuto() {
    const S = especie(raid.cfg.chefeDex) || ESPECIE_VAZIA;
    let t = 0;
    for (const p of raid.fila.values()) {
      if (!p.ida) continue;
      const lv = Math.max(1, ...(contas[p.u]?.save?.time || []).map(lvDe));
      t += FATOR_HP * hpBase(S.bs[0], lv, 31);
    }
    return Math.max(50, Math.round(t));
  }
  function pagar(u) {
    const c = contas[u]; if (!c) return null;
    if (!c.save) c.save = {};
    const s = c.save, premio = { mew: null, dinheiro: PREMIO.dinheiro, itens: { ...PREMIO.bolas, ...PREMIO.itens } };
    s.dinheiro = (s.dinheiro || 0) + PREMIO.dinheiro;
    if (!s.bolas || typeof s.bolas !== 'object') s.bolas = {};
    for (const [id, n] of Object.entries(PREMIO.bolas)) s.bolas[id] = (s.bolas[id] || 0) + n;
    if (!s.itens || typeof s.itens !== 'object') s.itens = {};
    for (const [id, n] of Object.entries(PREMIO.itens)) s.itens[id] = (s.itens[id] || 0) + n;
    if (premioRaid() === 'mew') {
      const S = especie(raid.cfg.chefeDex);
      const pk = individuoServidor({ dex: raid.cfg.chefeDex, nome: S?.name || raid.cfg.chefeNome, glb: raid.cfg.chefeGlb, lv: raid.cfg.chefeNivel });
      pk.shiny = Math.random() < 1 / Math.max(1, taxaRaid() / (shinyMult() || 1));   // a taxa da raid ÷ o multiplicador do evento ao vivo
      pk.origem = 'raid';
      if (!Array.isArray(s.time)) s.time = [];
      if (!Array.isArray(s.caixa)) s.caixa = [];
      if (s.time.length < 6) s.time.push(pk); else s.caixa.push(pk);
      marcarPego(c, pk.dex);
      premio.mew = { nome: pk.nome, lv: pk.lv, shiny: pk.shiny, dex: pk.dex, uid: pk.uid };
    }
    c.rev = (c.rev || 0) + 1;
    return premio;
  }

  // ── Fases ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  function anunciar(g, titulo = '', preset = null) {
    const cfg = lerCfg(preset);
    if (!especie(cfg.chefeDex)) return { erro: 'Species no. ' + cfg.chefeDex + ' from data/raid.json is not in pokedex.json.' };
    const geo = geometria(cfg.arena);
    raid = { id: ++seq, fase: 'anunciada', cfg, geo, sobre: { hp: null, dano: null, shiny: null, premio: null }, fila: new Map(), por: g,
      contagemAte: 0, indoAte: 0, lutaAte: 0, fimAte: 0, chefe: null, venceu: false, golpesChefe: golpesDoChefe(cfg.chefeDex, cfg.chefeNivel) };
    console.log(`[raid] #${raid.id} announced by ${g}: ${cfg.chefeNome} Lv${cfg.chefeNivel}, ${cfg.vagas} slots, arena ${cfg.arena}`);
    todos('📢 RAID' + (titulo ? ' · ' + titulo : '') + ': a Lv ' + cfg.chefeNivel + ' ' + cfg.chefeNome + ' appeared! Join the queue with the RAID button (' + cfg.vagas + ' spots).');
    difundir();
    return {};
  }
  function contar() {
    raid.fase = 'contagem'; raid.contagemAte = Date.now() + CONTAGEM_MS;
    for (const p of raid.fila.values()) for (const w of socketsDe(p.u)) sistema(w, 'The ' + raid.cfg.chefeNome + ' raid starts in ' + Math.round(CONTAGEM_MS / 1000) + ' s!');
  }
  /** Leva UM participante: guarda onde estava (raidVolta), põe o posGm na arena e manda recarregar lá. */
  function fazerIda(p, ws) {
    const c = contas[p.u], cfg = raid.cfg;
    const i = [...raid.fila.keys()].indexOf(p.u), v = vaga(raid.geo, Math.max(0, i));
    const aqui = String(ws._mapa) !== cfg.arena && Number.isFinite(+ws._info?.x) && Number.isFinite(+ws._info?.z)
      ? { mapa: String(ws._mapa), x: +(+ws._info.x).toFixed(2), z: +(+ws._info.z).toFixed(2), giro: +(+ws._info.giro || 0).toFixed(3) } : seguro();
    c.raidVolta = { ...aqui, raid: raid.id, arena: cfg.arena };
    c.posGm = { mapa: cfg.arena, x: v.x, z: v.z, giro: v.giro };
    salvarContasJa();
    p.ida = true;
    for (const w of socketsDe(p.u)) enviar(w, { t: 'raid_ir', id: raid.id, mapa: cfg.arena });
  }
  function seguro() {
    const s = pontoSeguro?.();
    return s ? { mapa: String(s.mapa), x: +s.x, z: +s.z, giro: 0 } : { mapa: 'kanto', x: null, z: null, giro: 0 };
  }
  function irTodos() {
    if (!raid.fila.size) { todos('The ' + raid.cfg.chefeNome + ' raid was canceled: nobody joined the queue.'); raid = null; difundir(); return; }
    raid.fase = 'indo'; raid.indoAte = Date.now() + INDO_MS;
    for (const p of raid.fila.values()) {
      const ws = socketsDe(p.u).filter(w => w._info).sort((a, b) => b._id - a._id)[0];   // duas abas da mesma conta: vale a que entrou por último
      if (ws) fazerIda(p, ws);                                               // offline agora (recarregando, porta): vai quando entrar (aoEntrar)
    }
    console.log(`[raid] #${raid.id} heading to the arena: ${[...raid.fila.keys()].join(', ')}`);
    difundir();
  }
  function lutar() {
    const chegaram = [...raid.fila.values()].filter(p => p.chegou);
    if (!chegaram.length) { todos('The ' + raid.cfg.chefeNome + ' raid is over: nobody reached the arena.'); terminar(); return; }
    const maxHp = raid.sobre.hp ?? (raid.cfg.chefeHp > 0 ? raid.cfg.chefeHp : vidaAuto());
    const ch = raid.geo.chefe;
    raid.chefe = { id: 1e9 + raid.id, hp: maxHp, maxHp, x: ch.x, z: ch.z, giro: +Math.PI.toFixed(3), proxGolpe: Date.now() + 4000,   // giro π: de frente pro sul, onde a fila fica
      est: Stg.novo(), sementes: new Map(), proxSemente: Date.now() + SEMENTE_MS };   // estágios do chefe valem pra sala inteira; sementes = conta → { dreno, de }
    raid.fase = 'luta'; raid.lutaAte = Date.now() + Math.round((raid.cfg.lutaMin || LUTA_MS / 60000) * 60000);
    paraArena({ t: 'selvagem', s: registroChefe() });
    if (ehR01()) r01.iniciar(raid.chefe);
    console.log(`[raid] #${raid.id} fight: ${raid.cfg.chefeNome} with ${maxHp} HP, ${chegaram.length} in the arena`);
    difundir();
  }
  /** KO do chefe: prêmio pra quem bateu (já gravado na conta, online ou não), e a volta em FIM_MS. */
  function vencer() {
    if (ehR01()) r01.morte();
    raid.fase = 'fim'; raid.venceu = true; raid.fimAte = Date.now() + FIM_MS; raid.chefe.hp = 0;
    paraArena({ t: 'sestado', id: raid.chefe.id, estado: 'desmaiado', ate: raid.fimAte, hp: 0 });
    const resumo = [];
    for (const p of raid.fila.values()) {
      const premio = p.dano > 0 ? pagar(p.u) : null, c = contas[p.u];
      resumo.push(p.u + ' ' + p.dano + (premio?.mew ? (premio.mew.shiny ? ' ✨' : '') + ' +' + premio.mew.nome : ''));
      const msg = { t: 'raid_fim', id: raid.id, venceu: true, premio,
        ...(premio && c?.save ? { bolsa: { dinheiro: c.save.dinheiro, itens: c.save.itens, bolas: c.save.bolas }, save: c.save, rev: c.rev } : {}) };
      for (const w of socketsDe(p.u)) enviar(w, msg);
    }
    { // raid points (damage dealt) and the MVP go to the achievements and the weekly ranking
      const L = [...raid.fila.values()].filter(p => p.dano > 0), top = Math.max(0, ...L.map(p => p.dano)), soma = L.reduce((t, p) => t + p.dano, 0) || 1;
      for (const p of L) try { h.aoPontuar?.(p.u, p.dano, p.dano === top, p.dano / soma); } catch (e) { console.warn('[raid] points:', e.message); }
    }
    salvarContas();
    console.log(`[raid] #${raid.id} won (damage: ${resumo.join(', ')})`);
    difundir();
  }
  /** O chefe escapou (tempo) ou a staff encerrou no meio da luta. */
  function perder(texto) {
    if (ehR01()) r01.fim();
    raid.fase = 'fim'; raid.fimAte = Date.now() + FIM_MS; raid.fugiu = true;
    for (const p of raid.fila.values()) for (const w of socketsDe(p.u)) enviar(w, { t: 'raid_fim', id: raid.id, venceu: false, premio: null });
    if (raid.chefe) paraArena({ t: 'sumiu', id: raid.chefe.id, motivo: 'fugiu' });
    if (texto) for (const p of raid.fila.values()) for (const w of socketsDe(p.u)) sistema(w, texto);
    console.log(`[raid] #${raid.id} lost${texto ? ' (' + texto + ')' : ''}`);
    difundir();
  }
  /** A volta de cada participante e o fim da raid. Quem está na arena recarrega pra onde estava; offline nasce lá no próximo login. */
  function terminar() {
    const cfg = raid.cfg;
    if (ehR01()) r01.fim();
    if (raid.venceu && raid.chefe) paraArena({ t: 'sumiu', id: raid.chefe.id, motivo: 'morreu' });
    for (const p of raid.fila.values()) {
      const c = contas[p.u]; if (!c) continue;
      const volta = c.raidVolta?.raid === raid.id ? c.raidVolta : null;
      const ws = socketsDe(p.u).filter(w => w._info), la = ws.filter(w => String(w._mapa) === cfg.arena);
      const dest = volta || seguro();
      const posDe = d => d.x == null ? null : { mapa: d.mapa, x: d.x, z: d.z, giro: d.giro || 0 };
      if (la.length || !ws.length || (p.ida && !p.chegou)) {
        /* na arena: volta agora. Offline: o posGm leva no próximo login. A caminho (recarregando pra arena): o posGm já aponta pra casa e,
           se ele chegar na arena mesmo assim, o aoEntrar manda o raid_voltar (a raidVolta fica até ele sair de lá). */
        if (posDe(dest)) c.posGm = posDe(dest); else delete c.posGm;
        if (!volta) c.raidVolta = { ...dest, raid: raid.id, arena: cfg.arena };
        for (const w of la) enviar(w, { t: 'raid_voltar', id: raid.id, mapa: dest.mapa });
      } else {                                                               // online fora da arena (nunca foi, ou já saiu): nada a desfazer
        if (c.posGm?.mapa === cfg.arena) delete c.posGm;
        delete c.raidVolta;
      }
    }
    salvarContasJa();
    console.log(`[raid] #${raid.id} closed`);
    raid = null;
    difundir();
  }

  // ── Mensagens ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  function comando(ws, m) {
    const g = sessoes.get(ws._info?.token) || null, cg = contas[g];
    if (!cg?.gm && cg?.cargo !== 'staff') { sistema(ws, '⚠ Only staff can run the raid.'); return; }
    let op = semAcento(m.op); op = OP_ALIAS[op] || op;
    const v = m.valor, txt = semAcento(v);
    const ok = (texto, extra = {}) => { sistema(ws, '🐉 ' + texto); if (op !== 'status') logAdmin(g, '*', 'raid ' + op, { depois: { id: raid?.id ?? null, ...extra } }); };
    const erro = texto => sistema(ws, '⚠ ' + texto);
    if (op === 'anunciar') {
      if (raid) { erro('There is already a raid (' + raid.fase + '). Use /raid cancel first.'); return; }
      const r = anunciar(g); if (r.erro) { erro(r.erro); return; }
      ok('Raid #' + raid.id + ' announced: ' + raid.cfg.chefeNome + ' Lv ' + raid.cfg.chefeNivel + ', ' + raid.cfg.vagas + ' spots. /raid start opens the countdown.', { cfg: raid.cfg });
      if (!fs.existsSync(nodePath.join(raiz, 'public/scenery/mon', raid.cfg.chefeGlb + '.glb'))) erro('The model ' + raid.cfg.chefeGlb + '.glb is not in public/scenery/mon: the boss will only show as a health bar.');
      return;
    }
    if (op === 'status') { sistema(ws, '🐉 ' + status()); return; }
    if (!raid) { erro('No raid right now. Use /raid announce first.'); return; }
    if (op === 'comecar') {
      if (raid.fase === 'anunciada') {
        if (!raid.fila.size) { erro('Nobody in the queue yet.'); return; }
        contar(); difundir(); ok('Countdown open: the raid starts in ' + Math.round(CONTAGEM_MS / 1000) + ' s (' + raid.fila.size + ' in the queue).'); return;
      }
      if (raid.fase === 'contagem') { raid.contagemAte = Date.now(); ok('Countdown skipped: taking the queue to the arena.'); return; }
      erro('The raid is already past the queue (' + raid.fase + ').'); return;
    }
    if (op === 'cancelar') {
      const fase = raid.fase;
      if (FASES_FILA.has(fase)) { todos('The ' + raid.cfg.chefeNome + ' raid was canceled by staff.'); raid = null; difundir(); }
      else if (fase === 'indo') { for (const p of raid.fila.values()) for (const w of socketsDe(p.u)) sistema(w, 'Staff canceled the raid. Heading back…'); terminar(); }
      else if (fase === 'luta') perder('Staff ended the raid.');
      else { erro('The raid is already ending.'); return; }
      ok('Raid canceled (it was in ' + fase + ').');
      return;
    }
    if (op === 'hp') {
      if (txt === 'auto') raid.sobre.hp = null;
      else { const n = Math.round(+String(v).replace(',', '.')); if (!(n >= 1 && n <= 1e7)) { erro('Use: /raid hp N (1 to 10 million) or /raid hp auto.'); return; } raid.sobre.hp = n; }
      if (raid.fase === 'luta' && raid.chefe) {                           // no meio da luta: a vida MÁXIMA muda e a barra fica na mesma fração
        const ch = raid.chefe, novo = raid.sobre.hp ?? (raid.cfg.chefeHp > 0 ? raid.cfg.chefeHp : vidaAuto());
        ch.hp = Math.max(1, Math.round(novo * ch.hp / ch.maxHp)); ch.maxHp = novo;
        paraArena({ t: 'shp', id: ch.id, hp: ch.hp, maxHp: ch.maxHp });
        difundir();
      }
      ok('Vida do chefe: ' + (raid.sobre.hp ?? 'automática') + (raid.chefe ? ' (agora ' + raid.chefe.hp + '/' + raid.chefe.maxHp + ')' : '') + '.', { hp: raid.sobre.hp });
      return;
    }
    if (op === 'dano') {
      const f = +String(v).replace(',', '.');
      if (!(f >= 0 && f <= 10)) { erro('Use: /raid damage F (0 to 10; 1 = normal, 0 = the minimum, 1 damage).'); return; }
      raid.sobre.dano = f; ok('Dano do chefe ×' + f + '.', { dano: f }); return;
    }
    if (op === 'shiny') {
      const n = Math.round(+String(v).replace(',', '.'));
      if (!(n >= 1 && n <= 1e6)) { erro('Use: /raid shiny N (1 em N; 1 = sempre shiny).'); return; }
      raid.sobre.shiny = n; ok('Prize shiny odds: 1 in ' + n + '.', { shiny: n }); return;
    }
    if (op === 'premio') {
      if (txt !== 'mew' && txt !== 'sem-mew') { erro('Use: /raid premio mew | sem-mew'); return; }
      raid.sobre.premio = txt; ok('Prize: ' + (txt === 'mew' ? raid.cfg.chefeNome + ' + items' : 'items only') + '.', { premio: txt }); return;
    }
    erro('Use: /raid anunciar | comecar | cancelar | hp N | dano F | shiny N | premio mew|sem-mew | status');
  }
  function status() {
    if (!raid) return 'No raid right now (data/raid.json default: ' + (c => c.chefeNome + ' Lv ' + c.chefeNivel + ', ' + c.vagas + ' spots, arena ' + c.arena)(lerCfg()) + ').';
    const r = retrato(null), ch = raid.chefe;
    return 'Raid #' + raid.id + ' · ' + raid.fase + ' · queue ' + raid.fila.size + '/' + raid.cfg.vagas + (raid.fila.size ? ' (' + [...raid.fila.values()].map(p => p.nome + (p.dano ? ' ' + p.dano : '') + (p.chegou ? '' : p.ida ? ' a caminho' : '')).join(', ') + ')' : '')
      + (ch ? ' · ' + raid.cfg.chefeNome + ' ' + ch.hp + '/' + ch.maxHp : ' · vida ' + (raid.sobre.hp ?? (raid.cfg.chefeHp || 'auto')))
      + ' · damage ×' + danoRaid() + ' · shiny 1/' + taxaRaid() + ' · prize ' + premioRaid()
      + (r.contagemMs ? ' · starts in ' + Math.ceil(r.contagemMs / 1000) + ' s' : '') + (r.fimMs ? ' · ' + Math.ceil(r.fimMs / 1000) + ' s left' : '');
  }
  function entrarFila(ws) {
    const u = contaDe(ws);
    const recusa = texto => { sistema(ws, '⚠ ' + texto); enviar(ws, retrato(u)); };   // o retrato volta sempre: o banner sai do "esperando"
    if (!u) return recusa('Entre com a sua conta pra participar da raid.');
    if (!raid || !FASES_FILA.has(raid.fase)) return recusa('The raid queue is not open.');
    if (raid.fila.has(u)) { enviar(ws, retrato(u)); return; }
    if (!(contas[u].save?.time || []).length) return recusa('Você precisa de pelo menos um Pokémon no time pra entrar na raid.');
    if (String(ws._mapa) === raid.cfg.arena) return recusa('Leave this room to join the raid queue.');
    if (raid.fila.size >= raid.cfg.vagas) return recusa('The raid queue is full.');
    raid.fila.set(u, { u, nome: nomeDe(u), ida: false, chegou: false, dano: 0, cd: {} });
    if (!raid.contados) raid.contados = new Set();
    if (!raid.contados.has(u)) { raid.contados.add(u); h.aoEntrarFila?.(u); }   // once per raid: leaving and rejoining the queue doesn't count again
    sistema(ws, 'You joined the ' + raid.cfg.chefeNome + ' raid queue (' + raid.fila.size + '/' + raid.cfg.vagas + ').');
    if (raid.fase === 'anunciada' && raid.fila.size >= raid.cfg.vagas) contar();   // fila cheia: a contagem abre sozinha
    difundir();
  }
  function sairFila(ws) {
    const u = contaDe(ws);
    if (!u || !raid || !FASES_FILA.has(raid.fase) || !raid.fila.has(u)) { enviar(ws, retrato(u)); return; }
    raid.fila.delete(u);
    sistema(ws, 'You left the raid queue.');
    if (raid.fase === 'contagem' && !raid.fila.size) raid.fase = 'anunciada';   // a fila esvaziou: a contagem para
    difundir();
  }
  /** Golpe do parceiro no chefe (world.mjs `atacar`): o dano é daqui. */
  function ataque(ws, m) {
    if (!raid || raid.fase !== 'luta' || !raid.chefe || String(m.id) !== String(raid.chefe.id)) return;
    const u = contaDe(ws), p = u && raid.fila.get(u);
    if (!p || String(ws._mapa) !== raid.cfg.arena) return;
    if (ehR01() && (!r01.alcance(ws) || r01.congelado(ws))) return;      // Articuno: too far from the boss, or frozen
    const golpe = golpes()[String(m.golpe || '')]; if (!golpe) return;
    const agora = Date.now(), espera = Math.max(500, (+golpe.recarga || 1.5) * 600);   // 60 % da recarga do golpe: folga pro relógio do cliente, sem metralhadora
    if (agora - (p.cd[golpe.id] || 0) < espera || agora - (p.ultimo || 0) < 300) return;
    p.cd[golpe.id] = agora; p.ultimo = agora;
    const mon = monDaConta(u, m.atacante || {}); if (!mon) return;
    ws._raidMon = mon;                                                       // o chefe bate nele (pdano) até o próximo golpe dizer outro
    const est = estDoParticipante(p, mon), ch = raid.chefe;
    const A = especie(mon.dex) || ESPECIE_VAZIA, B = especie(raid.cfg.chefeDex) || ESPECIE_VAZIA, lv = lvDe(mon), fis = golpe.cat === 'fisico';
    if (Math.random() > Stg.chance(1, golpe, est, ch.est)) { paraArena({ t: 'shp', id: ch.id, hp: ch.hp, dano: 0, eff: 1, golpe: golpe.id, de: ws._id, errou: true }); return; }
    const { dano, eff } = golpe.cat === 'status' ? { dano: 0, eff: 1 }
      : calcDano(golpe, lv, A, statMon(A, mon, fis ? 1 : 3) * Stg.mulStat(est, fis ? 1 : 3), B, statBase(B.bs[fis ? 2 : 4], lv, 31, 0, null, fis ? 2 : 4) * Stg.mulStat(ch.est, fis ? 2 : 4));
    const danoF = ehR01() ? Math.round(dano * r01.multiplicador()) : dano;   // Articuno stunned by the steam: vulnerable
    ch.hp = Math.max(0, ch.hp - danoF); p.dano += danoF;
    if (ehR01()) r01.aoDano(ch.hp, ch.maxHp);
    const estagios = Stg.doGolpe(golpe, est, ch.hp > 0 && (golpe.cat === 'status' || eff !== 0) ? ch.est : null);
    let semente = null;
    if (golpe.semente && ch.hp > 0) {
      if (!Stg.podeSemear(B.types)) semente = 'imune';
      else if (!ch.sementes.has(u)) { ch.sementes.set(u, { dreno: Stg.drenoSemente(hpBase(A.bs[0], lv, ivsDe(mon)[0] || 0)), de: ws._id }); semente = true; }
    }
    paraArena({ t: 'shp', id: ch.id, hp: ch.hp, dano: danoF, eff, golpe: golpe.id, de: ws._id, ...(estagios ? { estagios } : {}), ...(semente ? { semente } : {}) });
    if (ch.hp <= 0) vencer();
  }
  /** Os estágios do Pokémon do participante: novos quando ele troca de Pokémon (outro uid). */
  function estDoParticipante(p, mon) {
    const uid = String(mon?.uid ?? mon?.dex ?? '');
    if (!p.est || p.estUid !== uid) { p.est = Stg.novo(); p.estUid = uid; }
    return p.est;
  }
  /** Leech Seed no chefe: cada semente drena 1/8 do HP de quem plantou (o chefe tem a vida da sala inteira) e cura o parceiro dele no cliente. */
  function drenarSementes() {
    const ch = raid.chefe;
    ch.proxSemente = Date.now() + SEMENTE_MS;
    for (const [u, s] of ch.sementes) {
      if (ch.hp <= 0) break;
      const p = raid.fila.get(u);
      if (!p) { ch.sementes.delete(u); continue; }
      const dano = Math.min(ch.hp, s.dreno);
      ch.hp -= dano; p.dano += dano;
      paraArena({ t: 'shp', id: ch.id, hp: ch.hp, dano, eff: 1, golpe: 'leechseed', de: s.de, dreno: true });
    }
    if (ch.hp <= 0) vencer();
  }
  /** O chefe bate num participante da arena (sorteado): pdano pra sala, virado pro parceiro dele, com a animação do golpe. */
  function golpeDoChefe() {
    const ch = raid.chefe, alvos = naArena().filter(w => w._info?.parceiro);
    ch.proxGolpe = Date.now() + Math.max(1500, CADA_ALVO_MS / Math.max(1, alvos.length));
    if (!alvos.length) return;
    const w = alvos[Math.floor(Math.random() * alvos.length)], u = contaDe(w);
    const mon = w._raidMon || monDaConta(u, { uid: w._info.uid, dex: dexDoGlb(w._info.parceiro) }); if (!mon) return;
    const golpe = raid.golpesChefe[Math.floor(Math.random() * raid.golpesChefe.length)];
    const B = especie(raid.cfg.chefeDex) || ESPECIE_VAZIA, D = especie(mon.dex) || ESPECIE_VAZIA, lv = lvDe(mon), fis = golpe.cat === 'fisico';
    const p = raid.fila.get(u), est = p ? estDoParticipante(p, mon) : null;
    const errou = Math.random() > Stg.chance(1, golpe, ch.est, est);
    const { dano, eff } = errou ? { dano: 0, eff: 1 }
      : calcDano(golpe, lv, B, statBase(B.bs[fis ? 1 : 3], lv, 31, 0, null, fis ? 1 : 3) * Stg.mulStat(ch.est, fis ? 1 : 3), D, statMon(D, mon, fis ? 2 : 4) * Stg.mulStat(est, fis ? 2 : 4), FORCA_CHEFE * danoRaid());
    const estagios = errou ? null : Stg.doGolpe(golpe, ch.est, eff !== 0 ? est : null);   // o efeito secundário do golpe do chefe (Psychic −SpD, Close Combat no próprio chefe)
    const px = Number.isFinite(+w._info.px) ? +w._info.px : +w._info.x || 0, pz = Number.isFinite(+w._info.pz) ? +w._info.pz : +w._info.z || 0;
    ch.giro = +Math.atan2(px - ch.x, pz - ch.z).toFixed(3);
    const id = raid.id, deste = () => raid && raid.id === id && raid.fase === 'luta';
    paraArena({ t: 'spos', id: ch.id, x: ch.x, z: ch.z, giro: ch.giro, anim: golpe.anim || 'Attack' });
    setTimeout(() => { if (deste()) paraArena({ t: 'pdano', id: ch.id, alvo: w._id, golpe: golpe.id, dano, eff, ...(errou ? { errou } : {}), ...(estagios ? { estagios } : {}) }); }, Math.round((+golpe.atraso || 0.3) * 1000) + 250);   // sem uid/hp: vale o parceiro em campo, e o HP é do cliente
    setTimeout(() => { if (deste()) paraArena({ t: 'spos', id: ch.id, x: ch.x, z: ch.z, giro: ch.giro, anim: 'Idle' }); }, 1400);   // Idle de novo: o próximo golpe toca a animação outra vez
  }
  function receber(ws, m) {
    if (m.t === 'raid_staff') comando(ws, m);
    else if (m.t === 'raid_entrar') entrarFila(ws);
    else if (m.t === 'raid_sair') sairFila(ws);
    else if (m.t === 'ataque') ataque(ws, m);
    else if (m.t === 'r01' && ehR01() && raid.fase === 'luta' && raid.fila.has(contaDe(ws))) r01.receber(ws, m);
  }

  // ── Entrada no mundo ──────────────────────────────────────────────────────────────────────────────────────────────────
  /** Campos a mais no bem-vindo: participante na arena liga o Mundo do cliente, só com o chefe. */
  function bemvindo(ws) {
    const u = contaDe(ws);
    if (!raid || !u || !raid.fila.has(u) || !FASES_DENTRO.has(raid.fase) || String(ws._mapa) !== raid.cfg.arena) return {};
    return { soloWilds: false, selvagens: raid.chefe && !raid.fugiu ? [registroChefe()] : [] };
  }
  /** Depois do bem-vindo: o retrato e, se for o caso, a ida que ficou pendente ou a volta que não chegou. */
  function aoEntrar(ws) {
    const u = contaDe(ws), c = contas[u], p = u && raid?.fila.get(u);
    enviar(ws, retrato(u));
    if (ehR01() && r01.ativo() && p && String(ws._mapa) === raid.cfg.arena) enviar(ws, { t: 'r01', ev: 'retrato', agora: Date.now(), retrato: r01.retrato() });
    if (!c) return;
    const naSala = !!raid && String(ws._mapa) === raid.cfg.arena;
    if (p && FASES_DENTRO.has(raid.fase)) {
      if (naSala) p.chegou = true;
      else if (!p.ida && raid.fase !== 'fim') fazerIda(p, ws);             // estava offline quando a fila foi pra arena
      else if (p.ida && !p.chegou && raid.fase !== 'fim' && c.posGm?.mapa !== raid.cfg.arena) { const v = vaga(raid.geo, [...raid.fila.keys()].indexOf(u)); c.posGm = { mapa: raid.cfg.arena, ...v }; salvarContasJa(); }   // o cliente vai sozinho (raid.mjs): que nasça na vaga
      return;
    }
    const v = c.raidVolta; if (!v) return;
    const arena = String(v.arena || lerCfg().arena);                        // the arena of the raid this account went to (scheduled raids pick their own)
    if (String(ws._mapa) === arena || (raid && naSala)) {                  // na arena sem raid (acabou enquanto recarregava, reinício do servidor): de volta pra casa
      if (v.x != null) c.posGm = { mapa: v.mapa, x: v.x, z: v.z, giro: v.giro || 0 };
      salvarContasJa();
      enviar(ws, { t: 'raid_voltar', id: v.raid ?? null, mapa: v.mapa });
    } else {                                                                 // saiu da arena: a volta foi usada
      delete c.raidVolta;
      if (c.posGm?.mapa === arena) delete c.posGm;
      salvarContas();
    }
  }

  // ── Relógio ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  function tique() {
    if (!raid) return;
    const agora = Date.now();
    try {
      if (raid.fase === 'contagem' && agora >= raid.contagemAte) irTodos();
      else if (raid.fase === 'indo') {
        const foram = [...raid.fila.values()].filter(p => p.ida);
        if (agora >= raid.indoAte || (foram.length && foram.every(p => p.chegou) && foram.length === raid.fila.size)) lutar();
      }
      else if (raid.fase === 'luta') {
        if (agora >= raid.lutaAte) perder('O ' + raid.cfg.chefeNome + ' escapou: o tempo acabou.');
        else if (!ehR01() && agora >= raid.chefe.proxGolpe) golpeDoChefe();   // Articuno attacks on its own clock (server_raid_r01.mjs)
        else if (raid.chefe.sementes.size && agora >= raid.chefe.proxSemente) drenarSementes();
      }
      else if (raid.fase === 'fim' && agora >= raid.fimAte) terminar();
    } catch (e) { console.warn('[raid] tique:', e); }
  }
  setInterval(tique, 250).unref?.();

  /* Event schedule (server_schedule.mjs): the queue opens on its own before the start, and the countdown starts on time
     (nobody in the queue = canceled). A raid already running is left alone. */
  function anunciarAgendada(titulo, preset = null) {
    if (raid) return { erro: 'a raid is already running' };
    return anunciar('schedule', titulo, preset);
  }
  function comecarAgendada() {
    if (!raid || raid.por !== 'schedule' || raid.fase !== 'anunciada') return;
    if (!raid.fila.size) { todos('The ' + raid.cfg.chefeNome + ' raid was canceled: nobody joined the queue.'); raid = null; difundir(); return; }
    contar(); difundir();
  }
  const resumo = (preset = null) => { const c = lerCfg(preset); return { chefe: c.chefeNome, dex: c.chefeDex, nivel: c.chefeNivel, vagas: c.vagas }; };
  return { receber, bemvindo, aoEntrar, anunciarAgendada, comecarAgendada, resumo, estado: () => raid && { ...retrato(null), sobre: raid.sobre, chefe: raid.chefe } };
}
