/**
 * Development server — PokeVerse
 * HTTP + WebSocket on port 5190
 *
 * Run: node server.mjs
 *
 * Accounts persist in server/data/contas.json (created automatically).
 * Login, signup, save/load, basic multiplayer (positions, chat,
 * catching Pokémon, healing at a Pokémon Center).
 */

import * as RegrasItemS from './item_rules.mjs';
import * as Forms from './forms.mjs';   // Pokémon forms (public/data/forms.json)   // Running Shoes (TENIS) and the other key-item ids
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'node:fs';
import crypto from 'node:crypto';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESQUEMAS, validarColecao } from './admin/schemas.mjs';   // editor de dados do painel: lista branca + validação (mesmo arquivo do navegador)
import { criarModeracao } from './server_moderation.mjs';           // Fase 3: comandos de GM do chat + moderação do painel (mesmas funções)
import { criarEventos } from './server_events.mjs';
import { criarAgenda } from './server_schedule.mjs';   // event schedule: the Events board, weekly bonuses, raids on a timer               // Fase 3: eventos ao vivo (EXP/shiny/densidade, aviso global, manutenção)
import { criarRecursos } from './server_resources.mjs';             // Fase 3: listas de faixas/máscaras/modelos pras prévias do painel
import { criarRaid } from './server_raid.mjs';                     // raid ao vivo: /raid da staff, fila, ida/volta da arena, o chefe e o prêmio
import { criarBatalha } from './server_battle.mjs';
import { criarWilds } from './server_wild.mjs';
import { mergeHp, healMon } from './server_hp.mjs';
import { mergeMovs } from './server_moves.mjs';
import { ajustarPPMax } from './individual.mjs';
import * as IndS from './individual.mjs';   // the Day Care builds hatchlings' moves from the learnset   // PP x5 (06/11): sobe o ppMax gravado dos Pokémon que já existiam
import { fundir as fundirStatus } from './status.mjs';
import { applyRole, ROLES } from './tools/roles.mjs';
import { aceitarPos, posDaConta, posLimpa } from './server_pos.mjs';
import { chegadaConfere } from './server_doors.mjs';
import { temLink, podeLink, AVISO_LINK } from './chat_links.mjs';
import { criarBolsa } from './server_bag.mjs';
import { criarMercado } from './server_market.mjs';
import { criarCarteira, criarLoja } from './server_shop.mjs';
import * as Calendario from './calendar.mjs';
import { criarTemporada } from './server_season.mjs';
import { createWorld } from './server_world.mjs';
import { createRoamers } from './server_roamers.mjs';   // roaming legendaries
import { createBreeding } from './server_breeding.mjs';   // Day Care, Eggs and hatching
import { createOutbreaks } from './server_outbreaks.mjs';   // mass outbreaks
import { createRanking } from './server_ranking.mjs';
import { createWardrobe } from './server_wardrobe.mjs';
import { createTransform } from './server_transform.mjs';
import { createDrops } from './server_drops.mjs';
import { createHunt } from './server_hunt.mjs';
import { createDaily } from './server_daily.mjs';
import { createFerry } from './server_ferry.mjs';
import { createTravel } from './server_travel.mjs';
import { createTrade } from './server_trade.mjs';   // the trade table, done on the server (Nov 6)
import { createStaff } from './server_staff.mjs';
import { createSocial } from './server_social.mjs';
import { knowledgeSummary } from './server_knowledge.mjs';   // friends, requests, direct messages (the Social window)
import { createParty } from './server_party.mjs';     // parties of up to 4, and Inspect (the player card)
import * as CaixaR from './box_rules.mjs';
import { createMail } from './server_mail.mjs';
import { createProgression } from './server_progression.mjs';
import { fundirSave, pacoteConhecimento } from './knowledge.mjs';

const __dir = nodePath.dirname(fileURLToPath(import.meta.url));
const DADOS = nodePath.join(__dir, 'server/data');
fs.mkdirSync(DADOS, { recursive: true });
/* The web server serves this checkout as plain files and runs as another user. Account data and git history must
   be readable only by this service user, whatever the web server's own rules say. */
for (const p of [DADOS, nodePath.join(__dir, '.git')]) { try { fs.chmodSync(p, 0o700); } catch {} }

const VERSAO_REDE = 22;   // 22: a same-map door is stored, so a refresh stays on the far side

// ── Missões ──────────────────────────────────────────────────────────────────
const MISSOES = {};       // id → missao (main story)
const LATERAIS = {};
const DOAR_LENDARIOS = new Set();   // species that can never be handed over (missions.json → doar.lendarios)      // id → side quest
const MISSAO_SEQ = [];    // ids na ordem certa
/* Fase 2: data/missions.json é a fonte das missões (o painel admin edita); relido quando o arquivo muda (mtime), então salvar no
   painel vale no próximo evento, sem reiniciar. Arquivo quebrado = fica com as missões que já estavam carregadas. */
let missoesMtime = -1;
function carregarMissoes() {
  const arq = nodePath.join(__dir, 'public/data/missions.json');
  let mt; try { mt = fs.statSync(arq).mtimeMs; } catch { return; }
  if (mt === missoesMtime) return;
  missoesMtime = mt;
  try {
    const md = JSON.parse(fs.readFileSync(arq, 'utf8'));
    for (const k of Object.keys(MISSOES)) delete MISSOES[k];
    for (const k of Object.keys(LATERAIS)) delete LATERAIS[k];
    MISSAO_SEQ.length = 0;
    for (const cap of md.capitulos || [])
      for (const m of cap.missoes || []) { MISSOES[m.id] = m; MISSAO_SEQ.push(m.id); }
    for (const g of md.laterais || [])
      for (const m of g.missoes || []) { LATERAIS[m.id] = m; }
    DOAR_LENDARIOS.clear();
    for (const d of md.doar?.lendarios || []) DOAR_LENDARIOS.add(Number(d));
    console.log('Missions loaded:', MISSAO_SEQ.length, 'side quests:', Object.keys(LATERAIS).length);
  } catch(e) { console.warn('Missions not loaded:', e.message); }
}
carregarMissoes();

function missaoEstadoDe(u) {
  carregarMissoes();
  const s = contas[u]?.save;
  if (!s?.missoes) return { atual: MISSAO_SEQ[0] || null, passo: 0, prog: {}, feitas: [], laterais: { ativas: {}, feitas: [] } };
  /* o painel pode ter apagado a missão em que o jogador estava (ou passos dela): segue pra próxima não feita em vez de travar */
  const est = s.missoes;   // …e quem já tinha feito tudo pega a missão nova que o painel acrescentou
  if (est.atual == null || !MISSOES[est.atual]) { const prox = proximaMissao(Array.isArray(est.feitas) ? est.feitas : []); if (prox !== est.atual) { est.atual = prox; est.passo = 0; } }
  else if (est.atual != null && est.passo >= (MISSOES[est.atual].passos?.length || 0)) est.passo = Math.max(0, (MISSOES[est.atual].passos?.length || 1) - 1);
  if (!est.laterais || typeof est.laterais !== 'object') est.laterais = { ativas: {}, feitas: [] };
  if (!est.laterais.ativas || typeof est.laterais.ativas !== 'object') est.laterais.ativas = {};
  if (!Array.isArray(est.laterais.feitas)) est.laterais.feitas = [];
  return est;
}
function salvarMissao(u, est) {
  if (!contas[u]) return;
  if (!contas[u].save) contas[u].save = {};
  contas[u].save.missoes = est;
  contas[u].rev = (contas[u].rev || 0) + 1;
  salvarContas();
}
function cfgOk(alvo, cfg) {
  if (alvo == null || cfg == null) return false;
  if (Array.isArray(alvo)) return alvo.map(String).includes(String(cfg));
  return String(alvo) === String(cfg);
}
/** The next story mission: the first one not done AFTER the furthest one done, so a mission the panel inserted earlier in
 *  the story (Nov 5: chapters 3–4 rewritten, 301–302 are new) doesn't send a veteran back; a brand-new save starts at the top. */
function proximaMissao(feitas) {
  const f = new Set((feitas || []).map(String));
  let ult = -1;
  MISSAO_SEQ.forEach((id, i) => { if (f.has(String(id))) ult = i; });
  for (let i = ult + 1; i < MISSAO_SEQ.length; i++) if (!f.has(String(MISSAO_SEQ[i]))) return MISSAO_SEQ[i];
  return null;
}
/** A trainer win fits a "defeat trainers" step: the named trainer(s) when the step has cfg, any trainer in the step's area otherwise. */
function treinadorOk(p, ev) {
  if (p.cfg != null || p.cfgs != null) return cfgOk(p.cfgs || p.cfg, ev.cfg);
  return !p.area || (ev.area != null && String(ev.area) === String(p.area));
}
function casarPasso(p, ev) {
  if (!p || !ev) return 'none';
  switch (p.tipo) {
    case 'falar':
    case 'entregar':
      return ev.tipo === 'falar' && cfgOk(p.cfgs || p.cfg, ev.cfg) ? 'done' : 'none';
    case 'ir':
      return ev.tipo === 'area' && String(ev.area) === String(p.area) ? 'done' : 'none';
    case 'capturar':
      return ev.tipo === 'captura' && (!p.dex || p.dex.includes(ev.dex)) ? 'count' : 'none';
    case 'derrotar':
      if (p.selvagem && ev.tipo === 'selvagem' && (!p.dex || p.dex.includes(ev.dex)) && (!p.area || String(ev.area) === String(p.area))) return 'count';
      if (!p.selvagem && ev.tipo === 'treinador' && treinadorOk(p, ev)) return (p.n || 1) > 1 ? 'count' : 'done';
      return 'none';
    case 'doar':
      return ev.tipo === 'doar' && cfgOk(p.cfgs || p.cfg, ev.cfg) && (!p.dex || p.dex.map(Number).includes(Number(ev.dex))) ? 'count' : 'none';
    case 'nivel':
      return ev.tipo === 'nivel' && ev.lv >= p.lv ? 'done' : 'none';
    case 'inicial':
      return ev.tipo === 'inicial' ? 'done' : 'none';
    case 'curar':
      return ev.tipo === 'cura' && (!p.cfg || cfgOk(p.cfg, ev.cfg)) ? 'done' : 'none';
    case 'insignia':
      return ev.tipo === 'insignia' ? 'done' : 'none';
    case 'escolher':
      return ev.tipo === 'escolher' && String(ev.chave) === String(p.chave) ? 'done' : 'none';
  }
  return 'none';
}
function missaoConcluida(est, id) {
  if ((est.feitas || []).map(String).includes(String(id))) return true;
  return (est.laterais?.feitas || []).map(String).includes(String(id));
}
function requisitosLateralOk(est, m) {
  const e = Array.isArray(m?.exige) ? m.exige : (m?.exige != null ? [m.exige] : []);
  return e.every(id => missaoConcluida(est, id));
}
function aceitarLateral(u, id) {
  const mid = Number(id);
  const m = LATERAIS[mid] || LATERAIS[id];
  if (!m) return { ok: false, erro: 'Unknown side quest.' };
  const est = missaoEstadoDe(u);
  const L = est.laterais;
  if ((L.feitas || []).map(String).includes(String(m.id))) return { ok: false, erro: 'Already completed.' };
  if (L.ativas[m.id] || L.ativas[String(m.id)]) return { ok: true, estado: est };
  if (!requisitosLateralOk(est, m)) return { ok: false, erro: 'This side quest is still locked.' };
  if (Object.keys(L.ativas).length >= 10) return { ok: false, erro: 'Too many active side quests.' };
  L.ativas[m.id] = { passo: 0, prog: {} };
  const p0 = m.passos?.[0];   // you accept by talking to the giver: their own "talk to me" opening step is done right there
  if (p0 && p0.tipo === 'falar' && m.npc != null && cfgOk(p0.cfgs || p0.cfg, m.npc)) L.ativas[m.id].passo = m.passos.length > 1 ? 1 : 0;
  salvarMissao(u, est);
  return { ok: true, estado: est };
}
/** Drop an active side quest (the Side tab's Abandon button). Story missions can't be abandoned. Its progress is lost; it can be taken again. */
function abandonarLateral(u, id) {
  const est = missaoEstadoDe(u), A = est.laterais.ativas;
  const k = A[id] ? id : A[String(id)] ? String(id) : A[+id] ? +id : null;
  if (k == null) return { ok: false, erro: 'That side quest is not active.' };
  delete A[k];
  salvarMissao(u, est);
  return { ok: true, estado: est };
}
/** A choose-one step: the story's current step or an active side quest's, with this `chave`, and `opcao` one of its options.
 *  The choice is kept in est.escolhas[chave], so later steps, NPCs and rewards can read it. */
function escolherNaMissao(u, missao, chave, opcao) {
  const est = missaoEstadoDe(u);
  let p = null;
  if (est.atual != null && String(est.atual) === String(missao)) p = MISSOES[est.atual]?.passos?.[est.passo];
  else {
    const slot = est.laterais.ativas[missao] || est.laterais.ativas[String(missao)] || est.laterais.ativas[+missao];
    const m = LATERAIS[+missao] || LATERAIS[missao];
    p = slot && m ? m.passos?.[slot.passo || 0] : null;
  }
  if (!p || p.tipo !== 'escolher' || String(p.chave) !== String(chave)) return { erro: 'Nothing to choose right now.' };
  const op = (p.opcoes || []).find(o => String(o.id) === String(opcao));
  if (!op) return { erro: 'That is not one of the options.' };
  est.escolhas = { ...(est.escolhas || {}), [chave]: op.id };
  const dado = null;   // an option's Pokémon (a fossil) is handed out by the mission's own reward/step, reading est.escolhas
  const resultado = aplicarEvento(u, { tipo: 'escolher', chave, opcao: op.id });
  salvarMissao(u, est);
  return { estado: est, resultado, dado };
}
function aplicarLaterais(u, est, ev) {
  let passoFeito = false, concluida = null;
  for (const key of Object.keys(est.laterais.ativas || {})) {
    const slot = est.laterais.ativas[key];
    const m = LATERAIS[+key] || LATERAIS[key];
    if (!m || !slot) continue;
    const p = m.passos?.[slot.passo || 0];
    if (!p) continue;
    const hit = passoJaFeito(u, p) ? 'done' : casarPasso(p, ev);
    if (hit === 'none') continue;
    const chave = m.id + ':' + (slot.passo || 0);
    if (!slot.prog) slot.prog = {};
    if (hit === 'count') {
      slot.prog[chave] = (slot.prog[chave] || 0) + 1;
      if (slot.prog[chave] < (p.n || 1)) { passoFeito = true; continue; }
    }
    slot.passo = (slot.passo || 0) + 1;
    while (slot.passo < m.passos.length && passoJaFeito(u, m.passos[slot.passo])) slot.passo++;
    passoFeito = true;
    if (slot.passo >= m.passos.length) {
      delete est.laterais.ativas[key];
      if (!est.laterais.feitas.map(String).includes(String(m.id))) est.laterais.feitas.push(m.id);
      concluida = m;
    }
  }
  return passoFeito || concluida ? { passoFeito, concluida } : null;
}
/** HAND OVER (`doar` step): the player gives Pokémon to the NPC of an active step. The server checks the step, the species,
 *  that the Pokémon are theirs, not legendary/shiny/locked, not the last one, and that they stand near the NPC; then takes
 *  them out of the team/Box and counts one step event per Pokémon. → { estado, uids, resultado } | { erro } */
function doarPokemon(u, missaoId, uids) {
  const c = contas[u]; if (!c?.save) return { erro: 'No save.' };
  const est = missaoEstadoDe(u);
  let p = null, feitos = 0;
  const lat = est.laterais.ativas[missaoId] || est.laterais.ativas[String(missaoId)];
  if (lat) { const m = LATERAIS[+missaoId]; p = m?.passos?.[lat.passo || 0]; feitos = lat.prog?.[m?.id + ':' + (lat.passo || 0)] || 0; }
  else if (String(est.atual) === String(missaoId)) { p = MISSOES[est.atual]?.passos?.[est.passo]; feitos = est.prog?.[est.atual + ':' + est.passo] || 0; }
  if (!p || p.tipo !== 'doar') return { erro: 'This mission is not asking for a Pokémon right now.' };
  const lista = [...new Set((Array.isArray(uids) ? uids : [uids]).map(String))].filter(x => /^[\w-]{1,40}$/.test(x));
  const falta = Math.max(0, (p.n || 1) - feitos);
  if (!lista.length) return { erro: 'Pick a Pokémon.' };
  if (lista.length > falta) return { erro: 'They only asked for ' + falta + '.' };
  const lend = DOAR_LENDARIOS;
  const s = c.save, time = s.time || [], caixa = s.caixa || [];
  const achar = id => time.find(x => String(x?.uid) === id) || caixa.find(x => String(x?.uid) === id);
  for (const id of lista) {
    const e = achar(id);
    if (!e) return { erro: "That Pokémon isn't yours." };
    if (!(p.dex || []).map(Number).includes(Number(e.dex))) return { erro: "That's not the Pokémon they asked for." };
    if (lend.has(Number(e.dex))) return { erro: 'Legendary Pokémon cannot be handed over.' };
    if (e.shiny) return { erro: 'Shiny Pokémon cannot be handed over.' };
    if (e.travado) return { erro: 'This Pokémon is locked: unlock it first.' };
  }
  if (time.length + caixa.length - lista.length < 1 || time.filter(x => !lista.includes(String(x?.uid))).length < 1) return { erro: "You can't hand over your last Pokémon on the team." };
  const alvo = [].concat(p.cfgs || p.cfg || []).map(Number);
  s.time = time.filter(x => !lista.includes(String(x?.uid)));
  s.caixa = caixa.filter(x => !lista.includes(String(x?.uid)));
  let resultado = null;
  for (const id of lista) {
    const e = time.find(x => String(x?.uid) === id) || caixa.find(x => String(x?.uid) === id);
    resultado = aplicarEvento(u, { tipo: 'doar', cfg: alvo[0], dex: Number(e.dex) }) || resultado;
  }
  c.rev = (c.rev || 0) + 1;
  salvarContas();
  return { estado: missaoEstadoDe(u), uids: lista, resultado };
}
/** Aplica um evento ao estado de missões do usuário; devolve { estado, passoFeito, concluida } ou null. */
const lutaVenceu = new Map();   // u → { cfg, t }: a trainer win the server's own battle already counted (the client then reports it too)
function aplicarEvento(u, ev) {
  if (!contas[u]) return null;
  if (ev?.tipo === 'treinador' && ev.fonte === 'luta') lutaVenceu.set(u, { cfg: String(ev.cfg), t: Date.now() });
  const est = missaoEstadoDe(u);
  const m = est.atual ? MISSOES[est.atual] : null;
  const p = m?.passos?.[est.passo];
  const chave = est.atual + ':' + est.passo;

  const concluirPasso = () => {
    est.passo++;
    while (est.passo < m.passos.length && passoJaFeito(u, m.passos[est.passo])) est.passo++;   // o seguinte já está cumprido: não espera um evento que não vem de novo
    if (est.passo >= m.passos.length) {
      est.feitas = [...(est.feitas || []), est.atual];
      const concluida = m;
      est.atual = proximaMissao(est.feitas);
      est.passo = 0;
      /* a missão nova pode começar num passo já cumprido (ex.: os treinadores da Rota 2 vencidos antes da 303): pula agora,
         sem esperar outro evento. Para no último passo, que fecha (e paga) no próximo evento pelo caminho normal. */
      const prox = est.atual != null ? MISSOES[est.atual] : null;
      while (prox && est.passo < (prox.passos?.length || 0) - 1 && passoJaFeito(u, prox.passos[est.passo])) est.passo++;
      salvarMissao(u, est);
      temporada.contar(u, { conta: 'historia' });
      return { estado: est, passoFeito: true, concluida };
    }
    salvarMissao(u, est);
    return { estado: est, passoFeito: true, concluida: null };
  };
  let resultado = null;
  if (m && p) {
    if (passoJaFeito(u, p)) resultado = concluirPasso();
    else {
      switch (p.tipo) {
        case 'falar':
        case 'entregar':
          if (ev.tipo === 'falar' && cfgOk(p.cfgs || p.cfg, ev.cfg)) resultado = concluirPasso();
          break;
        case 'ir':
          if (ev.tipo === 'area' && String(ev.area) === String(p.area)) resultado = concluirPasso();
          break;
        case 'capturar':
          if (ev.tipo === 'captura' && (!p.dex || p.dex.includes(ev.dex))) {
            est.prog[chave] = (est.prog[chave] || 0) + 1;
            if (est.prog[chave] >= (p.n || 1)) resultado = concluirPasso();
            else { salvarMissao(u, est); resultado = { estado: est, passoFeito: false, concluida: null }; }
          }
          break;
        case 'derrotar':
          if (p.selvagem && ev.tipo === 'selvagem' && (!p.dex || p.dex.includes(ev.dex)) && (!p.area || String(ev.area) === String(p.area))) {
            est.prog[chave] = (est.prog[chave] || 0) + 1;
            if (est.prog[chave] >= (p.n || 1)) resultado = concluirPasso();
            else { salvarMissao(u, est); resultado = { estado: est, passoFeito: false, concluida: null }; }
          }
          if (!p.selvagem && ev.tipo === 'treinador' && treinadorOk(p, ev)) {
            est.prog[chave] = (est.prog[chave] || 0) + 1;
            if (est.prog[chave] >= (p.n || 1)) resultado = concluirPasso();
            else { salvarMissao(u, est); resultado = { estado: est, passoFeito: false, concluida: null }; }
          }
          break;
        case 'doar':
          if (casarPasso(p, ev) === 'count') {
            est.prog[chave] = (est.prog[chave] || 0) + 1;
            if (est.prog[chave] >= (p.n || 1)) resultado = concluirPasso();
            else { salvarMissao(u, est); resultado = { estado: est, passoFeito: false, concluida: null }; }
          }
          break;
        case 'nivel':
          if (ev.tipo === 'nivel' && ev.lv >= p.lv) resultado = concluirPasso();
          break;
        case 'inicial':
          if (ev.tipo === 'inicial') resultado = concluirPasso();
          break;
        case 'curar':
          if (ev.tipo === 'cura' && (!p.cfg || cfgOk(p.cfg, ev.cfg))) resultado = concluirPasso();
          break;
        case 'insignia':
          if (ev.tipo === 'insignia') resultado = concluirPasso();
          break;
        case 'escolher':
          if (casarPasso(p, ev) === 'done') resultado = concluirPasso();
          break;
      }
    }
  }
  const lado = aplicarLaterais(u, est, ev);
  if (lado) {
    salvarMissao(u, est);
    return { estado: est, passoFeito: !!(resultado?.passoFeito || lado.passoFeito), concluida: resultado?.concluida || lado.concluida };
  }
  return resultado;
}
/* Passo cumprido antes de virar o atual. Ex. (27/10): a 1ª missão travava em "Vá ao laboratório" — o evento de área não
   chegava, a pessoa escolhia o inicial com o passo ainda em 'ir', e o 'inicial' não acontece de novo. */
function passoJaFeito(u, p) {
  const s = contas[u]?.save;
  if (p?.tipo === 'derrotar' && !p.selvagem) return treinadoresVencidosNoPasso(s, p) >= (p.n || 1);
  if (p?.tipo === 'inicial') return !!(s?.inicial || s?.time?.some?.(x => x?.inicial));
  if (p?.tipo === 'nivel') return [...(s?.time || []), ...(s?.caixa || [])].some(x => (+x?.lv || 0) >= (+p.lv || 1));   // o nível já foi alcançado antes
  if (p?.tipo === 'ir') return socketsDe(u).some(w => w._areaId != null && String(w._areaId) === String(p.area));   // já está na área (missao_area)
  return false;
}
/* VITÓRIA ANTES DA MISSÃO (06/11, "A Estrada do Norte"): o jogador venceu os treinadores da Rota 2 antes de a missão 303 virar
   a atual. Treinador vencido não aceita revanche (server_battle: 'beaten'), então "Vença 2 treinadores na Rota 2" nunca fechava.
   A missão pede a vitória e o jogador já tem a vitória: conta quem está em save.treinadorPago e combina com o passo (pelos cfgs
   do passo; sem cfg, pela área do passo; sem nenhum dos dois, qualquer treinador). A vitória entra em treinadorPago antes do
   aplicarEvento, então a mesma conta vale pras vitórias novas, sem contar duas vezes. */
const AREAS_DO_TREINADOR = new Map();   // cfg (string) → Set(áreas onde ele tem vaga), de kanto.json → treinadores[].a
let areasTreinadorMtime = -1;
function areasDoTreinador(cfg) {
  const arq = nodePath.join(__dir, 'public/data/kanto.json');
  let mt; try { mt = fs.statSync(arq).mtimeMs; } catch { mt = -1; }
  if (mt !== areasTreinadorMtime) {
    areasTreinadorMtime = mt;
    try {
      const d = JSON.parse(fs.readFileSync(arq, 'utf8'));
      AREAS_DO_TREINADOR.clear();
      for (const t of d.treinadores || []) {
        if (t?.cfg == null || t.a == null) continue;
        const k = String(t.cfg);
        if (!AREAS_DO_TREINADOR.has(k)) AREAS_DO_TREINADOR.set(k, new Set());
        AREAS_DO_TREINADOR.get(k).add(String(t.a));
      }
    } catch (e) { console.warn('Trainer areas not loaded:', e.message); }   // arquivo quebrado: fica com o índice que já estava
  }
  return AREAS_DO_TREINADOR.get(String(cfg)) || null;
}
function treinadoresVencidosNoPasso(s, p) {
  const pagos = Array.isArray(s?.treinadorPago) ? s.treinadorPago : [];
  const cfgs = new Set(pagos.map(k => String(k).split('@')[0]));   // a chave pode ser "cfg@x,z"; cada treinador conta uma vez
  let n = 0;
  for (const cfg of cfgs) {
    if (p.cfg != null || p.cfgs != null) { if (cfgOk(p.cfgs || p.cfg, cfg)) n++; }
    else if (!p.area || areasDoTreinador(cfg)?.has(String(p.area))) n++;
  }
  return n;
}
function enviarMissao(ws, resultado) {
  if (!resultado) return;
  const { estado, passoFeito, concluida } = resultado;
  /* 05/11: com conta o motor do cliente fica desligado (o servidor conclui), então o `bolsa_missao` que ele mandava ao concluir
     nunca saía e ninguém recebia dinheiro/itens. Agora quem conclui paga, aqui mesmo; a bolsa nova vai junto (o cliente aplica `m.bolsa`). */
  const u = concluida ? sessoes.get(ws._info?.token) || null : null;
  const pago = u ? pagarMissao(u, concluida.id) : null;
  const c = u ? contas[u] : null;
  enviar(ws, { t: 'missao', estado, passoFeito: passoFeito && !concluida, concluiu: concluida?.id || null, nome: concluida?.nome || null,
    ...(pago ? { recompensa: pago.rec, bolsa: { dinheiro: c.save.dinheiro ?? 0, itens: c.save.itens, bolas: c.save.bolas } } : {}) });
  if (pago?.xp) enviar(ws, pago.xp);
  if (pago?.rec?.pokemon) for (const w of socketsDe(u)) enviar(w, { t: 'save', save: c.save, rev: c.rev });   // the gift Pokémon joins the party / Box                                      // XP da missão: mesmo formato do `wild_exp` (o cliente sobe nível, HP, avisa)
}
/** Paga a recompensa de uma missão concluída, uma vez só (save.recompensasPagas). Devolve o que pagou, ou null. */
function pagarMissao(u, id) {
  const c = contas[u];
  if (!c?.save || id == null) return null;
  const est = c.save.missoes;
  const feita = !!est && missaoConcluida(est, id);   // ANTI-TRAPAÇA: só a missão que o servidor marcou como feita
  if (!Array.isArray(c.save.recompensasPagas)) c.save.recompensasPagas = [];
  if (!feita || c.save.recompensasPagas.map(String).includes(String(id))) return null;
  const rec = recompensaMissao(MISSOES[id] || LATERAIS[id] || MISSOES[+id] || LATERAIS[+id]);
  if (!rec) return null;
  c.save.recompensasPagas.push(+id || id);
  if (rec.dinheiro) c.save.dinheiro = (c.save.dinheiro || 0) + rec.dinheiro;
  if (!c.save.itens || typeof c.save.itens !== 'object') c.save.itens = {};
  if (!c.save.bolas || typeof c.save.bolas !== 'object') c.save.bolas = {};
  /* Poké Balls (tipo 7 no menu_data) moram em save.bolas (server_bag: cofre/ehBola); antes a missão punha `"1001": 5` em itens e a bola não aparecia */
  const ehBola = k => catalogoItens().items[String(k)]?.t === 7;
  const somar = (k, v) => { if (!(+v > 0)) return; const cofre = ehBola(k) ? c.save.bolas : c.save.itens; cofre[k] = (cofre[k] || 0) + +v; };
  for (const [k, v] of Object.entries(rec.itens || {})) somar(k, v);
  for (const [k, v] of Object.entries(rec.bolas || {})) somar(k, v);
  /* XP (05/11): com conta ninguém dava — o cliente não soma (ficha é do servidor, ver index `recompensa`) e o servidor não somava. */
  const xp = rec.exp ? wilds.missionExp(c.save, rec.exp) : null;
  const presente = presenteMissao(c, MISSOES[id] || LATERAIS[id] || MISSOES[+id] || LATERAIS[+id], est);
  if (presente) rec.pokemon = { dex: presente.dex, nome: presente.nome, lv: presente.lv };
  c.rev = (c.rev || 0) + 1;
  salvarContas();
  return { rec, xp };
}
/** A mission's gift Pokémon (recompensa.presente): { dex, lv } or { porEscolha: chave, lv } — the Pokémon of the option the player
 *  picked in that choose-one step (a fossil). Goes to the party, or the Box when it's full. */
function presenteMissao(c, m, est) {
  const P = m?.recompensa?.presente;
  if (!P) return null;
  let dex = +P.dex || 0;
  if (!dex && P.porEscolha != null) {
    const ch = est?.escolhas?.[P.porEscolha];
    const passo = (m.passos || []).find(p => p.tipo === 'escolher' && String(p.chave) === String(P.porEscolha));
    dex = +((passo?.opcoes || []).find(o => String(o.id) === String(ch))?.dex) || 0;
  }
  if (!(dex > 0) || (ESPECIES_OK && !ESPECIES_OK.has(dex))) return null;
  const s = c.save;
  if (!Array.isArray(s.time)) s.time = [];
  if (!Array.isArray(s.caixa)) s.caixa = [];
  const pk = individuoServidor({ dex, nome: NOME_ESPECIE.get(dex) || '#' + dex, glb: 'pm' + String(dex).padStart(4, '0') + '_00', lv: +P.lv || 5 });
  if (s.time.length < 6) s.time.push(pk); else s.caixa.push(pk);
  marcarPego(c, dex);
  return pk;
}
function recompensaMissao(m) {
  const r = m?.recompensa;
  if (!r) return null;
  const bolsa = {};
  if (r.dinheiro) bolsa.dinheiro = r.dinheiro;
  if (r.itens) bolsa.itens = r.itens;
  if (r.bolas) bolsa.bolas = r.bolas;
  if (+r.exp > 0) bolsa.exp = +r.exp;
  return bolsa;
}

// ── Persistência ────────────────────────────────────────────────────────────
const contasArq = nodePath.join(DADOS, 'contas.json');
let contas = {};
try { contas = JSON.parse(fs.readFileSync(contasArq, 'utf8')); } catch {}
/* Until Nov 4, 2026 server/data was publicly downloadable, so every session token and recovery code issued before
   then is void: everyone logs in again with their password, and a GM hands out new recovery codes. Runs once. */
const SECRETS_ROTATED = nodePath.join(DADOS, 'secrets-rotated-2026-11-04');
if (!fs.existsSync(SECRETS_ROTATED)) {
  for (const c of Object.values(contas)) {
    if (!c || typeof c !== 'object') continue;
    c.token = null; delete c.tokenExp;
    c.codigo = crypto.randomBytes(8).toString('hex');
  }
  gravarContasDisco();
  try { fs.writeFileSync(SECRETS_ROTATED, new Date().toISOString() + '\n'); } catch {}
  console.log(`[security] voided session tokens and recovery codes for ${Object.keys(contas).length} accounts`);
}

/* Gravação: antes era fs.writeFileSync A CADA mutação (inclusive em cada captura/missão), reescrevendo o contas.json inteiro
   e travando o event loop. Agora `salvarContas()` AGRUPA as gravações de jogo (debounce ~500ms) e `salvarContasJa()` grava na
   hora para o que não pode perder (criar conta, login, senha, apagar). Ao encerrar, descarrega o pendente pra não perder save. */
let _salvarPend = null;
function gravarContasDisco() { try { fs.writeFileSync(contasArq, JSON.stringify(contas, null, 2)); } catch (e) { console.error('Failed to save accounts:', e.message); } }
function salvarContasJa() { if (_salvarPend) { clearTimeout(_salvarPend); _salvarPend = null; } gravarContasDisco(); }
function salvarContas() { if (!_salvarPend) _salvarPend = setTimeout(() => { _salvarPend = null; gravarContasDisco(); }, 500); }
/** Walk position on the account. posGm (GM / raid teleport) stays the spawn until the player arrives. */
function gravarPosConta(u, bruto, { porta = false, ja = false } = {}){
  const c = contas[u];
  if (!c || c.posGm) return;
  /* Cross-map still requires the door flag from this load. A same-map jump
     (route gate, cave, underground) is a door only when the landing is the
     arrival the client named — otherwise it stays inside the walk limit. */
  const mesmoMapa = !!(c.pos && bruto && String(c.pos.mapa) === String(bruto.mapa || ''));
  const portaOk = !!porta && !!bruto?.chegada && (!mesmoMapa || chegadaConfere(bruto.mapa, bruto.x, bruto.z, bruto.chegada));
  const r = aceitarPos(c.pos, bruto, { porta: portaOk, mapaPadrao: bruto?.mapa });
  if (!r.mudou) return;
  c.pos = r.pos;
  (ja ? salvarContasJa : salvarContas)();
}
process.on('SIGINT', () => { salvarContasJa(); process.exit(0); });
process.on('SIGTERM', () => { salvarContasJa(); process.exit(0); });
process.on('beforeExit', () => salvarContasJa());
// Senha: scrypt com sal aleatório por usuário (guardado como "sal:hash"). conferirSenha aceita o formato antigo (sha256) p/ contas velhas.
function hashSenha(s, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(s ?? ''), salt, 64).toString('hex'); }
function conferirSenha(s, guardado) {
  if (!guardado) return false;
  if (guardado.includes(':')) { const salt = guardado.slice(0, guardado.indexOf(':')); return guardado === hashSenha(s, salt); }
  return guardado === crypto.createHash('sha256').update(String(s ?? '') + 'pokefable').digest('hex');   // legado: aceita uma vez e rehash abaixo
}
function migrarSenhaSeLegado(c, senha) {
  if (!c?.senha || String(c.senha).includes(':')) return;
  if (!conferirSenha(senha, c.senha)) return;
  c.senha = hashSenha(senha);
}
function tokenNovo() { return crypto.randomBytes(32).toString('hex'); }
const rnd = (n) => Math.floor(Math.random() * (n + 1));
/** IVs no formato que o JOGO lê (individual.mjs): lista de 6 — HP, Atq, Def, AtE, DfE, Vel. Até 27/10 o servidor gravava um
    objeto {hp, atk…}, que o jogo lia como tudo 0 (e[0] não existe): o objeto antigo vira lista. Inválido → null. */
function ivsLista(v) {
  const l = Array.isArray(v) ? v : (v && typeof v === 'object') ? ['hp', 'atk', 'def', 'spa', 'spd', 'vel'].map(k => v[k]) : null;
  return l && l.length === 6 && l.every(n => Number.isInteger(n) && n >= 0 && n <= 31) ? l.slice() : null;
}
const ivsNovos = () => Array.from({ length: 6 }, () => rnd(31));
for (const c of Object.values(contas)) for (const p of [...(c?.save?.time || []), ...(c?.save?.caixa || [])]) {   // contas gravadas com o objeto antigo
  if (p && p.ivs !== undefined && !Array.isArray(p.ivs)) { const l = ivsLista(p.ivs); if (l) p.ivs = l; }
}

/* ── ANTI-TRAPAÇA (26/10) ─────────────────────────────────────────────────────
   REGRA: o cliente NUNCA cria/edita Pokémon, nem mexe em dinheiro/itens/bolas/insígnias.
   Tudo isso é decidido pelo SERVIDOR. Os helpers abaixo filtram o que o cliente manda. */

// As ÚNICAS chaves do save que o cliente pode gravar por `prefs`; o resto é do servidor.
const PREFS_OK = new Set(['bolaSel', 'atalhos', 'seguidor', 'seguidorUid', 'personagem', 'mochila', 'skin', 'peito', 'rastro', 'introVista', 'ultimoCentro', 'tempo', 'inicial', 'skinMon']);
function aplicarPrefs(c, prefs) {
  if (!prefs || typeof prefs !== 'object') return;
  for (const k of Object.keys(prefs)) {
    if (!PREFS_OK.has(k)) continue;                                       // chave fora da lista (dinheiro, bolas…) é IGNORADA
    if (['skin', 'mochila', 'peito', 'rastro'].includes(k) && !bolsaServ.vestivel(c, k, prefs[k])) continue;   // only owned pieces can be worn (server_wardrobe.mjs)
    if (k === 'skinMon') { c.save.skinMon = loja.skinMonValida(c, prefs[k]); continue; }   // Pokémon skins on: only owned ones (server_shop.mjs)
    if (k === 'personagem') { const p = bolsaServ.validarPersonagem(c, prefs[k]); if (p === null && prefs[k] != null) continue; c.save[k] = p; continue; }   // paid outfit not owned: keeps the last valid one
    c.save[k] = prefs[k];
  }
}
/* Party sync may reorder Pokémon, update friendship (`amizade`), and report a lower HP.
   Experience, level, and banked experience are ignored: a wild defeat is awarded by
   server_wild.mjs, and a trainer battle is awarded by server_battle.mjs. HP cannot go
   up through this message — a Pokémon Center heal is the message that fills it.
   Saved fields stay `time` (party) and `caixa` (box) so existing accounts still load. */
function mergeProgress(record, item) {
  if (!record || !item || typeof item !== 'object') return;
  const friendship = Math.round(Number(item.amizade));
  if (Number.isInteger(friendship) && friendship >= 0 && friendship <= 255) record.amizade = friendship;
  mergeHp(record, item);
  fundirStatus(record, item);
  mergeMovs(record, item);   // level-up / relearn moves learned on the client (server_moves.mjs validates them)
}
/* Applies a party reorder. The account already owns every Pokémon; this only accepts the same
   set of ids (nothing created, duplicated, or deleted). */
function applyPartyOrder(account, order) {
  if (!order || typeof order !== 'object' || !account.save) return false;
  const byUid = new Map();
  for (const mon of [...(account.save.time || []), ...(account.save.caixa || [])]) if (mon && mon.uid != null) byUid.set(String(mon.uid), mon);
  if (!byUid.size) return false;
  const reorder = (list, max) => {
    if (!Array.isArray(list)) return null;
    const seen = new Set(), next = [];
    for (const item of list) {
      const uid = String(item && typeof item === 'object' ? item.uid : item);
      const record = byUid.get(uid);
      if (record && !seen.has(uid)) { next.push(record); seen.add(uid); }
    }
    return max ? next.slice(0, max) : next;
  };
  const party = reorder(order.time, 6), box = reorder(order.caixa, 0);
  if (!party || !box || !party.length) return false;
  const used = new Set([...party, ...box].map(mon => String(mon.uid)));
  const rest = [...byUid.values()].filter(mon => !used.has(String(mon.uid)));
  if (party.length + box.length + rest.length !== byUid.size) return false;
  const fromClient = new Map();
  for (const list of [order.time, order.caixa]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) if (item && typeof item === 'object' && item.uid != null) fromClient.set(String(item.uid), item);
  }
  for (const [uid, record] of byUid) mergeProgress(record, fromClient.get(uid));
  account.save.time = party;
  account.save.caixa = [...box, ...rest];
  return true;
}
/* dex (Pokédex) e conhecimento: o cliente NÃO sobrescreve o objeto inteiro — só ACRESCENTA (merge monotônico), senão dava
   pra mandar a Pokédex 100%/conhecimento no talo. dex = { nºdex: 'visto'|'pego' }: o cliente só marca 'visto'; o 'pego' quem
   põe é o SERVIDOR (na captura/inicial), então não dá pra forjar "pego" em massa. conhecimento = { esp:{dex:registro}, titulos:[] }:
   visto/captura/áreas/golpes só sobem (união) e título só soma. Um nível numérico antigo vira registro. HONESTO: isto impede zerar/rebaixar e forjar "pego", mas um trapaceiro
   ainda infla o PRÓPRIO 'visto'/nível; o lock duro é o servidor computar isso de eventos assinados (não existe no stub local). */
function mesclarDex(atual, novo) {
  const r = (atual && typeof atual === 'object') ? atual : {};
  if (novo && typeof novo === 'object')
    for (const k of Object.keys(novo)) if (/^\d+$/.test(k) && !r[k]) r[k] = 'visto';   // cliente só adiciona VISTO
  return r;
}
function marcarPego(c, dex) {                                                            // servidor marca 'pego' (autoritativo) ao capturar/escolher inicial
  if (dex == null || !c.save) return;
  if (!c.save.dex || typeof c.save.dex !== 'object') c.save.dex = {};
  c.save.dex[+dex] = 'pego';
}
/** Anything you own (party + box) is registered — gifts, trades, and evolutions, not only wild catches. */
function marcarPegoDoTime(c) {
  if (!c?.save) return false;
  let n = 0;
  for (const p of [...(c.save.time || []), ...(c.save.caixa || [])]) {
    if (p?.dex == null) continue;
    const k = +p.dex;
    if (!c.save.dex || typeof c.save.dex !== 'object') c.save.dex = {};
    if (c.save.dex[k] !== 'pego') { c.save.dex[k] = 'pego'; n++; }
  }
  return n > 0;
}
/* conhecimento guarda o registro rico por espécie (visto, capturas, áreas, golpes, shiny). O merge é monotônico em
   knowledge.mjs: um objeto nunca vira 0, e um nível numérico antigo (0–5) vira registro. O pagehide antigo aninhava
   `{ dex, conhecimento }` dentro de `conhecimento`; `pacoteConhecimento` aceita os dois formatos. */
function aplicarDexConhecimento(c, d) {
  if (!c.save) c.save = {};
  const pac = pacoteConhecimento(d || {});
  if (pac.conhecimento !== undefined) c.save.conhecimento = fundirSave(c.save.conhecimento, pac.conhecimento);
  if (pac.dex !== undefined) c.save.dex = mesclarDex(c.save.dex, pac.dex);
}
const NATUREZAS = ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'];
function novoUid() { return String(Date.now()) + String(Math.floor(Math.random() * 9999)).padStart(4, '0'); }
/* Captura: o cliente só diz QUAL Pokémon (dex/nome/modelo); o SERVIDOR gera IVs/natureza/shiny e clampa o nível.
   NOTA DE PRODUÇÃO: o certo é a espécie/nível virem de um encontro que o servidor assinou/guardou — aqui (dev) só se clampa. */
/* Fase 0: a taxa de shiny vem do data/game_config.json (painel admin → Arquivos de dados), a mesma que o cliente usa no
   selvagem. Relê só quando o arquivo muda (mtime): salvar no painel vale na próxima captura, sem reiniciar. */
/* FORMS (forms.mjs): public/data/forms.json, read again when it changes (admin → Forms), every module shares the table. */
let formasMtime = -1;
function recarregarFormas() {
  try { const arq = nodePath.join(DADOS_PUB, 'forms.json'), mt = fs.statSync(arq).mtimeMs; if (mt !== formasMtime) { Forms.usar(JSON.parse(fs.readFileSync(arq, 'utf8'))); formasMtime = mt; } } catch {}
}
setInterval(recarregarFormas, 15000).unref?.();
let cfgJogoCache = { mtime: -1, cfg: {} };
function cfgJogo() {
  try {
    const arq = nodePath.join(DADOS_PUB, 'game_config.json'), mt = fs.statSync(arq).mtimeMs;
    if (mt !== cfgJogoCache.mtime) cfgJogoCache = { mtime: mt, cfg: JSON.parse(fs.readFileSync(arq, 'utf8')) || {} };
  } catch { cfgJogoCache = { mtime: -1, cfg: {} }; }
  return cfgJogoCache.cfg;
}
const taxaShiny = () => { const t = cfgJogo().taxaShiny; return Math.max(1, (Number.isInteger(t) && t >= 2 ? t : 4096) / (eventos?.shinyMult() || 1)); };   // Fase 3: ÷ multiplicador do evento ao vivo
function individuoServidor(base) {
  const lv = Math.max(1, Math.min(100, Math.round(+base?.lv || 5)));
  const ivs = ivsNovos();
  return { dex: base?.dex, nome: base?.nome, glb: base?.glb, lv, ivs, evs: [0, 0, 0, 0, 0, 0], natureza: NATUREZAS[Math.floor(Math.random() * NATUREZAS.length)], shiny: Math.random() < 1 / taxaShiny(), uid: novoUid() };
}
/* Iniciais permitidos (Fase 2): os de data/starters.json — o MESMO arquivo que o laboratório do jogo oferece (o painel edita),
   relido quando muda. Sem o arquivo (ou quebrado) vale a lista antiga: os starters de cada geração. */
const INICIAIS_PADRAO = new Set([1,4,7,152,155,158,252,255,258,387,390,393,495,498,501,650,653,656,722,725,728,810,813,816,906,909,912]);
let iniciaisCache = { mtime: -1, dex: null };
function inicialOk(dex) {
  try {
    const arq = nodePath.join(DADOS_PUB, 'starters.json'), mt = fs.statSync(arq).mtimeMs;
    if (mt !== iniciaisCache.mtime) { const l = JSON.parse(fs.readFileSync(arq, 'utf8')); iniciaisCache = { mtime: mt, dex: Array.isArray(l) && l.length ? new Set(l.map(o => +o?.dex)) : null }; }
  } catch { iniciaisCache = { mtime: -1, dex: null }; }
  return (iniciaisCache.dex || INICIAIS_PADRAO).has(+dex);
}
const NOME_ESPECIE = new Map();   // dex → English name (first pokedex.json entry): names a gift Pokémon
/* Espécies válidas = nº de dex do pokedex.json. STOPGAP da nº14 no local: captura/inicial recusa dex que não existe.
   IMPORTANTE: produção amarra a espécie a um ENCONTRO assinado (a captura manda só `id` do encontro + bola, nunca a espécie),
   e por isso lá a nº14 não existe. O stub local não tem encontro, então o máximo que dá é barrar dex inexistente. */
let ESPECIES_OK = null;
try {
  const pdx = JSON.parse(fs.readFileSync(nodePath.join(__dir, 'public/pokedex.json'), 'utf8'));
  ESPECIES_OK = new Set((pdx.species || []).map(s => +s.n).filter(n => n >= 0));
  for (const s of pdx.species || []) if (!NOME_ESPECIE.has(+s.n)) NOME_ESPECIE.set(+s.n, s.name);
  console.log('Valid species:', ESPECIES_OK.size);
} catch (e) { console.warn('pokedex.json not loaded (species validation off):', e.message); }
function especieValida(dex) { return !ESPECIES_OK || ESPECIES_OK.has(+dex); }   // sem o arquivo, não bloqueia (fail-open no dev)
/* EVOLUÇÃO (posse_evoluir): o servidor confere a regra oficial (data/evolutions.json — a mesma do evolution.mjs) com o nível e a
   amizade do SAVE, desconta a pedra/cabo/item segurado da bolsa e troca a espécie no registro. Horário e golpe conhecido ficam
   com o cliente (o servidor não sabe o fuso do aparelho nem tem a tabela de golpes). Arquivos relidos quando mudam. */
const evoCache = { mtime: -1, evo: null, cast: [], exp: null, nomes: new Map() };
function dadosEvolucao() {
  try {
    const arq = nodePath.join(DADOS_PUB, 'evolutions.json'), mt = fs.statSync(arq).mtimeMs;
    if (mt !== evoCache.mtime) {
      evoCache.mtime = mt;
      evoCache.evo = lerJson(arq, { por: {} });
      evoCache.cast = lerJson(nodePath.join(DADOS_PUB, 'cast.json'), []);
      evoCache.exp = lerJson(nodePath.join(DADOS_PUB, 'exp.json'), { especies: {} });
      const pdx = lerJson(nodePath.join(__dir, 'public/pokedex.json'), { species: [] });
      evoCache.nomes = new Map();
      for (const s of pdx.species || []) if (!evoCache.nomes.has(+s.n)) evoCache.nomes.set(+s.n, s.name);   // a 1ª é a forma base (Raichu, não Raichu-Alola)
    }
  } catch {}
  return evoCache;
}
function evoluirNoServidor(c, uid, item, area = null, para = null) {
  const pk = (c.save?.time || []).find(p => String(p?.uid) === String(uid));
  if (!pk) return { erro: 'that Pokémon is not in your party' };
  const D = dadosEvolucao(), regras = D.evo?.por?.[pk.dex] || [];
  if (!regras.length) return { erro: 'does not evolve' };
  const tem = id => (c.save.itens?.[id] || 0) > 0;
  const amizade = pk.amizade ?? D.exp?.especies?.[pk.dex]?.a ?? 70;
  let falta = 'cannot evolve yet';
  for (const r of regras) {
    if (r.gatilho === 'outro' || r.gatilho === 'muda' || r.local || r.chuva || r.beleza) continue;
    if (para != null && +r.para !== +para) continue;                // the evolution the player picked (Eevee, Pikachu → Raichu / Alolan Raichu)
    const fr = Forms.regraDaForma(r, pk, area);                      // forms: a rule for one form only, or for one region (forms.mjs)
    if (!fr.vale) { if (fr.falta) falta = fr.falta; continue; }
    let consome = null;
    if (r.gatilho === 'item' || r.gatilho === 'troca') {
      if (!r.item || String(r.item) !== String(item)) continue;
      if (!tem(r.item)) { falta = 'no item in the bag'; continue; }
      consome = r.item;
    } else {
      if (r.nivel && (pk.lv || 1) < r.nivel) { falta = 'needs Lv ' + r.nivel; continue; }
      if (r.amizade && amizade < r.amizade) { falta = 'needs higher friendship'; continue; }
      if ('segurando' in r) {
        if (!r.segurando || String(r.segurando) !== String(item) || !tem(r.segurando)) { falta = 'needs the held item'; continue; }
        consome = r.segurando;
      } else if (item != null) continue;                          // pediu com item, mas esta regra é só de nível
      if (r.noTime && !(c.save.time || []).some(t => +t.dex === +r.noTime)) { falta = 'needs a specific Pokémon in the party'; continue; }
    }
    const nome = D.nomes.get(+r.para) || r.nome;
    const alvo = D.cast.find(x => x.n === +r.para && /_00$/.test(x.glb)) || D.cast.find(x => x.n === +r.para);
    if (!alvo) { falta = nome + ' has no model yet'; continue; }
    if (consome != null) { c.save.itens[consome]--; if (c.save.itens[consome] <= 0) delete c.save.itens[consome]; }
    const glbForma = Forms.glbNaEvolucao(pk, r);                     // Alolan Rattata → Alolan Raticate (before the record changes)
    pk.dex = +r.para; pk.nome = nome; pk.glb = glbForma || Calendario.formaNaEvolucao(pk.glb, r.para) || alvo.glb;   // a Fall Deerling becomes a Fall Sawsbuck
    marcarPego(c, pk.dex);
    return { pk, consumiu: consome != null };
  }
  return { erro: falta };
}
// Rate-limit simples por IP (em memória; zera ao reiniciar).
/* Behind a reverse proxy on the same machine (nginx → 127.0.0.1:5190) every request comes from loopback, so the real client
   IP is taken from X-Forwarded-For — but only when the connection itself is local, so remote clients can't spoof it. */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function ipDe(req) {
  const a = req.socket.remoteAddress;
  const f = LOOPBACK.has(a) && req.headers['x-forwarded-for'];
  return f ? String(f).split(',')[0].trim() : a;
}
const _tentativas = new Map();
function limitado(ip, chave, max, janelaMs) {
  const k = chave + '|' + (ip || '?'), agora = Date.now();
  const arr = (_tentativas.get(k) || []).filter(t => agora - t < janelaMs);
  arr.push(agora); _tentativas.set(k, arr);
  return arr.length > max;
}

// ── Sessões: token → usuario (com expiração) ─────────────────────────────────
const _sess = new Map();
const TOKEN_VIDA_MS = 30 * 24 * 3600 * 1000;                              // token vale 30 dias
const sessoes = {
  get(t) {
    const u = _sess.get(t); if (!u) return null;
    if (contas[u]?.tokenExp && Date.now() > contas[u].tokenExp) { _sess.delete(t); if (contas[u]) contas[u].token = null; return null; }   // token vencido
    return u;
  },
  set(t, u) { _sess.set(t, u); },
  delete(t) { _sess.delete(t); },
  get size() { return _sess.size; },
};
// restaura sessões do disco ao iniciar
for (const [u, c] of Object.entries(contas)) {
  if (c.token) sessoes.set(c.token, u);
}

function tokenDe(req) {
  const auth = req.headers['authorization'] || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}
function usuarioDe(req) {
  const t = tokenDe(req);
  return t ? sessoes.get(t) || null : null;
}

// ── Painel admin (/admin, servido pelo Vite) ─────────────────────────────────
/* Só conta GM. Edita os arquivos de dados que o JOGO lê (public/data/*.json, servidos pelo Vite), com cópia de segurança em
   server/data/backups/ antes de cada gravação (fica com as 30 últimas de cada arquivo). Tudo que chega é LIMPO aqui. */
const DADOS_PUB = nodePath.join(__dir, 'public/data');
recarregarFormas();
const MODELOS_DIR = nodePath.join(__dir, 'public/scenery/mon');
const BACKUPS = nodePath.join(DADOS, 'backups');
// Os GLB de mapa ficam em DOIS lugares (a Vite serve os dois em /scenery/): public/scenery/ (ex.: pallet_route1) e scenery/ na raiz
// (os outros 72, incl. kanto). O editor lê/grava no MESMO lugar de onde o jogo carrega — public tem precedência no Vite.
const CENARIO_PUB = nodePath.join(__dir, 'public/scenery');
const CENARIO_RAIZ = nodePath.join(__dir, 'scenery');
function caminhoGlb(m) {
  const pub = nodePath.join(CENARIO_PUB, m + '.glb'), raiz = nodePath.join(CENARIO_RAIZ, m + '.glb');
  if (fs.existsSync(pub)) return pub;
  if (fs.existsSync(raiz)) return raiz;
  return pub;   // mapa novo: grava em public (ganha no Vite)
}
// Maps with no GLB of their own that build from another map's prefab library (same rule as GLB_CENA in index.html).
const GLB_EMPRESTADO = { 2000001: 'kanto' };
function mapasComGlb() {                                                   // nomes de mapa com .glb (os dois lugares), que também têm <mapa>.json
  const nomes = new Set();
  for (const d of [CENARIO_PUB, CENARIO_RAIZ]) { try { for (const f of fs.readdirSync(d)) if (f.endsWith('.glb')) nomes.add(f.slice(0, -4)); } catch {} }
  for (const [m, lib] of Object.entries(GLB_EMPRESTADO)) if (nomes.has(lib)) nomes.add(m);
  return [...nomes].filter(m => fs.existsSync(nodePath.join(DADOS_PUB, m + '.json'))).sort();
}
const ZONAS_ARQ = nodePath.join(DADOS_PUB, 'zonas_spawn.json');
const HABITATS_ARQ = nodePath.join(DADOS_PUB, 'habitats.json');
function gmDe(req) { const u = usuarioDe(req); return u && contas[u]?.gm ? u : null; }

// ── Jogadores (painel, Fase 1): resumo, moderação e o que o GM pode gravar no save ──
const ADMIN_LOG = nodePath.join(DADOS, 'admin_log.jsonl');
function logAdmin(gm, alvo, acao, extra = {}) { try { fs.appendFileSync(ADMIN_LOG, JSON.stringify({ quando: new Date().toISOString(), gm, alvo, acao, ...extra }) + '\n'); } catch (e) { console.warn('admin_log:', e.message); } }
function logAdminDe(alvo, n) {
  let linhas = []; try { linhas = fs.readFileSync(ADMIN_LOG, 'utf8').split('\n'); } catch {}
  const out = [];
  for (let i = linhas.length - 1; i >= 0 && out.length < n; i--) { try { const e = JSON.parse(linhas[i]); if (e.alvo === alvo) out.push(e); } catch {} }
  return out;
}
const socketsDe = u => [...conexoes.values()].filter(w => w._usuario === u);
/** Banimento em vigor: -1 = pra sempre, timestamp = até quando, 0 = livre (vencido conta como livre). */
const banidoAteDe = c => (c?.banidoAte === -1 || c?.banidoAte > Date.now()) ? c.banidoAte : 0;
function resumoConta(u, c) {
  const w = socketsDe(u).find(x => x._info);
  return { usuario: u, nome: c.save?.nome || '', email: c.email || '', gm: !!c.gm, cargo: c.cargo || null, idioma: c.idioma || null,
    dinheiro: c.save?.dinheiro ?? null, nTime: (c.save?.time || []).length, nCaixa: (c.save?.caixa || []).length,
    banidoAte: banidoAteDe(c), banMotivo: banidoAteDe(c) ? c.banMotivo || '' : '', mudoAte: c.mudoAte > Date.now() ? c.mudoAte : 0,
    online: w ? { mapa: w._mapa, x: +(+w._info.x || 0).toFixed(1), z: +(+w._info.z || 0).toFixed(1), area: w._info.area ?? null } : null };
}
/** Manda a tela de "derrubado" (o cliente mostra o texto) e fecha. Devolve quantas conexões caíram. */
function derrubar(u, texto, motivo = null) {   // motivo picks the look of the client's account warning (suspensa, equipe, fechado…)
  const ws = socketsDe(u);
  for (const w of ws) { enviar(w, { t: 'saia', texto, ...(motivo ? { motivo } : {}) }); setTimeout(() => { try { w.close(); } catch {} }, 300); }
  return ws.length;
}
const resumoMon = p => ({ uid: p?.uid, dex: p?.dex, nome: p?.nome, lv: p?.lv, shiny: !!p?.shiny });
// itens existentes (menu_data.json do jogo), relido quando o arquivo muda — bolsa com id que o jogo não conhece é recusada
let itensCache = { mtime: -1, ids: null };
function itemExiste(id) {
  try {
    const arq = nodePath.join(DADOS_PUB, 'menu_data.json'), mt = fs.statSync(arq).mtimeMs;
    if (mt !== itensCache.mtime) {
      const ids = new Set(Object.keys(JSON.parse(fs.readFileSync(arq, 'utf8')).itens || {}));
      try { for (const k of Object.keys(JSON.parse(fs.readFileSync(nodePath.join(DADOS_PUB, 'itens_novos.json'), 'utf8')).itens || {})) ids.add(k); } catch {}   // TM pieces, Rare Candy S…MAX, shards, incubators
      itensCache = { mtime: mt, ids };
    }
  } catch { return true; }                                                  // sem o arquivo (demo) não bloqueia
  return !itensCache.ids || itensCache.ids.has(String(id));
}
let itensTab = { mtime: -1, items: {} };
function catalogoItens() {
  try {
    const arq = nodePath.join(DADOS_PUB, 'menu_data.json'), mt = fs.statSync(arq).mtimeMs;
    if (mt !== itensTab.mtime) {
      const items = { ...(JSON.parse(fs.readFileSync(arq, 'utf8')).itens || {}) };
      try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(nodePath.join(DADOS_PUB, 'itens_novos.json'), 'utf8')).itens || {})) items[k] ||= v; } catch {}   // names for TM pieces, shards… (were "Item 900070")
      itensTab = { mtime: mt, items };
    }
  } catch {}
  return itensTab;
}
const nomeItem = id => catalogoItens().items[id]?.n || 'Item ' + id;
function limparBolsa(d) {
  const bolsa = {};
  if (d.dinheiro !== undefined) {
    const n = Number(d.dinheiro);
    if (!Number.isInteger(n) || n < 0 || n > 1e12) return { erro: 'Money: a whole number from 0 to 1 trillion.' };
    bolsa.dinheiro = n;
  }
  for (const k of ['itens', 'bolas']) if (d[k] !== undefined) {
    if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) return { erro: k + ': invalid format.' };
    const m = {};
    for (const [id, q] of Object.entries(d[k])) {
      if (!/^\d{1,9}$/.test(id) || !itemExiste(id)) return { erro: `${k}: item ${id} does not exist in the game.` };
      const n = Number(q);
      if (!Number.isInteger(n) || n < 0 || n > 999999) return { erro: `${k} ${id}: quantidade de 0 a 999999.` };
      if (n > 0) m[id] = n;                                                  // 0 = tira da bolsa
    }
    if (Object.keys(m).length > 3000) return { erro: k + ': itens demais.' };
    bolsa[k] = m;
  }
  if (d.insignias !== undefined) {
    if (!Array.isArray(d.insignias) || d.insignias.length > 200 || !d.insignias.every(i => Number.isInteger(i) && i > 0 && i < 1e7)) return { erro: 'Badges: a list of ids.' };
    bolsa.insignias = [...new Set(d.insignias)];
  }
  return { bolsa };
}
/* Time e caixa vindos do painel: só Pokémon que a conta JÁ tem (casa por uid — criar é pela ação "dar Pokémon", que sorteia como
   uma captura). O GM pode mexer em nível, shiny, natureza e IVs, mover entre time e caixa e tirar (soltar); o resto do registro
   (golpes, HP, EXP…) continua o do servidor. */
const NATUREZAS_OK = new Set(NATUREZAS);
function limparTime(c, d) {
  if (!Array.isArray(d.time) || !Array.isArray(d.caixa)) return { erro: 'Missing the team or the box.' };
  if (d.time.length > 6) return { erro: 'A team can have at most 6 Pokémon.' };
  const porUid = new Map(), vistos = new Set();
  for (const p of [...(c.save.time || []), ...(c.save.caixa || [])]) if (p?.uid != null) porUid.set(String(p.uid), p);
  const limpar = lista => {
    const out = [];
    for (const e of lista) {
      const uid = String(e?.uid ?? ''), orig = porUid.get(uid);
      if (!orig) return { erro: `Unknown Pokémon (uid ${uid}) — to create one, use "Give Pokémon".` };
      if (vistos.has(uid)) return { erro: `Pokémon repetido (uid ${uid}).` };
      vistos.add(uid);
      const p = { ...orig };
      if (e.lv !== undefined) { const lv = Number(e.lv); if (!Number.isInteger(lv) || lv < 1 || lv > 100) return { erro: `${p.nome || uid}: nível de 1 a 100.` }; p.lv = lv; }
      if (e.shiny !== undefined) p.shiny = e.shiny === true;
      if (e.natureza !== undefined) { if (!NATUREZAS_OK.has(e.natureza)) return { erro: `${p.nome || uid}: natureza inválida.` }; p.natureza = e.natureza; }
      if (e.ivs !== undefined) {
        const ivs = ivsLista(e.ivs);
        if (!ivs) return { erro: `${p.nome || uid}: IVs de 0 a 31.` };
        p.ivs = ivs;
      }
      out.push(p);
    }
    return { lista: out };
  };
  const t = limpar(d.time); if (t.erro) return t;
  const cx = limpar(d.caixa); if (cx.erro) return cx;
  return { time: t.lista, caixa: cx.lista };
}
function lerJson(arq, padrao) { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } }
/* Cópia do arquivo atual em server/data/backups/ antes de sobrescrever. Nomes: <base>-<data>.json e <base>-glb-<data>.glb.
   Mantém os 30 últimos de cada JSON e os 8 últimos de cada GLB (é grande). A limpeza do JSON ignora os "-glb-" do mesmo nome
   (antes, salvar o JSON do pallet_route1 podia apagar os backups do GLB dele). */
const RE_BACKUP = /^(\w+?)-(glb-)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.(json|glb)$/;
function fazerBackup(arq, ehGlb) {
  if (!fs.existsSync(arq)) return;
  fs.mkdirSync(BACKUPS, { recursive: true });
  const base = nodePath.basename(arq).replace(/\.(json|glb)$/, ''), prefixo = base + (ehGlb ? '-glb-' : '-'), ext = ehGlb ? '.glb' : '.json';
  fs.copyFileSync(arq, nodePath.join(BACKUPS, prefixo + new Date().toISOString().replace(/[:.]/g, '-') + ext));
  const velhos = fs.readdirSync(BACKUPS).filter(f => f.startsWith(prefixo) && f.endsWith(ext) && (ehGlb || !f.startsWith(base + '-glb-'))).sort();
  for (const f of velhos.slice(0, Math.max(0, velhos.length - (ehGlb ? 8 : 30)))) fs.unlinkSync(nodePath.join(BACKUPS, f));
}
function gravarComBackup(arq, obj) {
  fazerBackup(arq, false);
  const tmp = arq + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj, null, 1)); fs.renameSync(tmp, arq);   // troca atômica: o jogo nunca lê meio arquivo
}
let _modelos = null, _modelosEm = 0;
function modelosMon() {                                                    // glb de Pokémon que existem (espécie sem modelo não nasce)
  if (_modelos && Date.now() - _modelosEm < 10000) return _modelos;
  try { _modelos = new Set(fs.readdirSync(MODELOS_DIR).filter(f => /^pm\d{4}(_\d{2})?\.glb$/.test(f))); } catch { _modelos = new Set(); }
  _modelosEm = Date.now(); return _modelos;
}
const numEntre = (v, min, max, pad) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pad; };
/* exigirModelo: nas zonas a espécie PRECISA ter .glb; nos habitats não (o arquivo veio do jogo e pode citar modelo que esta
   cópia não tem — apagar a linha ao salvar seria perder dado sem ninguém pedir). */
function limparEspecie(e, exigirModelo) {
  const dex = Math.round(Number(e?.dex)), glb = String(e?.glb || '');
  if (!especieValida(dex) || !/^pm\d{4}(_\d{2})?\.glb$/.test(glb) || (exigirModelo && !modelosMon().has(glb))) return null;
  const o = { dex, glb, nome: String(e.nome ?? '').slice(0, 40) || 'Nº ' + dex, peso: Math.round(numEntre(e.peso, 1, 1000, 100)) };
  if (e.agua) o.agua = 1;
  if (e.skittishHp === 0 || e.skittishHp === '0') o.skittishHp = 0;
  else { const hp = Math.round(Number(e.skittishHp)); if (Number.isInteger(hp) && hp >= 1 && hp <= 100) o.skittishHp = hp; }
  if (typeof e.fonte === 'string' && e.fonte) o.fonte = e.fonte.slice(0, 20);
  const lvA = Math.round(Number(e.lvMin)), lvB = Math.round(Number(e.lvMax));
  if (Number.isInteger(lvA) && Number.isInteger(lvB) && lvA >= 1 && lvB <= 100 && lvA <= lvB){ o.lvMin = lvA; o.lvMax = lvB; }
  const horas = (Array.isArray(e.hora) ? e.hora : (e.hora ? [e.hora] : [])).filter(h => h === 'manha' || h === 'dia' || h === 'noite');
  if (horas.length && horas.length < 3) o.hora = [...new Set(horas)];
  const regra = (k, ok) => { const l = [...new Set((Array.isArray(e[k]) ? e[k] : (e[k] ? [e[k]] : [])).map(x => String(x).toLowerCase()).filter(x => ok.includes(x)))]; if (l.length && l.length < ok.length) o[k] = l; };
  regra('estacoes', Calendario.ESTACOES);   // spawn rules (calendar.mjs): real season, real weekday, weather
  regra('dias', Calendario.DIAS);
  regra('climas', ['clear', 'chuva', 'chuva_forte', 'sol', 'areia', 'granizo', 'neve', 'nevoeiro']);
  return o;
}
/* Objeto de cenário: uma peça (prefab `n`) colocada em x/y/z. O `a` do dump é sempre 0 (não é rotação — a orientação está no prefab);
   preservado só pra não perder dado. O nome do prefab aceita letras/números/_-./:[] e espaço (nomes "lib:..." do export). */
function limparObjeto(o) {
  const n = String(o?.n ?? '');
  if (!n || n.length > 80 || !/^[\w .:/\[\]-]+$/.test(n)) return null;
  const num = v => { const x = Number(v); return Number.isFinite(x) ? +x.toFixed(3) : 0; };
  const r = { n, x: num(o.x), y: num(o.y), z: num(o.z) };
  for (const k of ['a', 'w', 'h']) if (o[k] !== undefined) r[k] = num(o[k]);   // ambiente/areaEnv (chão/água) trazem a/w/h — preserva
  for (const k of ['rx', 'r', 'rz']) {                                       // rotação livre do editor de cenário 3D (graus, Euler XYZ no mundo; r = Y). 0 não grava
    const g = Math.round((((Number(o[k]) || 0) % 360) + 360) % 360 * 10) / 10;
    if (g && g < 360) r[k] = g;
  }
  return r;
}
function limparZona(z) {
  const especies = (Array.isArray(z?.especies) ? z.especies : []).slice(0, 30).map(e => limparEspecie(e, true)).filter(Boolean);
  if (!especies.length) return null;                                       // zona sem espécie válida não nasce nada: descarta
  const a = Math.round(numEntre(z.lvMin, 1, 100, 3)), b = Math.round(numEntre(z.lvMax, 1, 100, a));
  return {
    id: (typeof z.id === 'string' && z.id !== 'undefined' && z.id !== 'null' && /^[\w-]{1,40}$/.test(z.id)) ? z.id : 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    mapa: /^[\w-]{1,40}$/.test(String(z.mapa)) ? String(z.mapa) : 'kanto',
    nome: String(z.nome ?? '').slice(0, 60) || 'Zona',
    x: +numEntre(z.x, -5000, 5000, 0).toFixed(2), z: +numEntre(z.z, -5000, 5000, 0).toFixed(2),   // coordenadas do MUNDO (as do jogador)
    raio: +numEntre(z.raio, 1, 200, 10).toFixed(1),
    especies, lvMin: Math.min(a, b), lvMax: Math.max(a, b),
    max: Math.round(numEntre(z.max, 1, 30, 4)),                            // quantos vivos ao mesmo tempo
    intervalo: Math.round(numEntre(z.intervalo, 1, 600, 8)),               // segundos entre um nascimento e outro
    shiny: +numEntre(z.shiny, 0, 1, 0).toFixed(4),                        // chance de shiny da zona (0 = a padrão do jogo)
    ativa: z.ativa !== false,
  };
}

const ORIGENS_OK = new Set([
  'https://play.pokeverse.quest',
  'http://localhost:5300',
  'http://127.0.0.1:5300',
  'http://localhost:5190',
  'http://127.0.0.1:5190',
  ...(String(process.env.PV_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)),
]);
const MAX_CONEXOES = Math.max(8, +process.env.PV_MAX_CONEXOES || 128);
function origemOk(orig) {
  if (!orig) return true;
  try {
    const u = new URL(orig);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  } catch {}
  return ORIGENS_OK.has(orig);
}

// ── Servidor HTTP ────────────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname;
  const orig = req.headers.origin;
  if (orig && !origemOk(orig)) { res.writeHead(403); res.end(); return; }
  res.setHeader('Access-Control-Allow-Origin', orig && origemOk(orig) ? orig : 'https://play.pokeverse.quest');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  /* LIVE TABLES (Nov 6, live_table.mjs): GET /tabela/<name>.json — a game data file (one the admin panel edits) read fresh from disk,
     never cached, so an admin edit reaches players on their next read without a redeploy or a stale browser copy. Signed-in only. */
  if (req.method === 'GET' && /^\/tabela\/[a-z0-9_]{1,40}\.json$/.test(rota)) {
    if (!usuarioDe(req)) return json(401, { erro: 'Sign in with an account.' });
    const nomeT = rota.slice(8, -5);
    if (!Object.values(ESQUEMAS).some(e => e.arquivo === nomeT)) return json(404, { erro: 'unknown table' });
    try {
      const txt = fs.readFileSync(nodePath.join(DADOS_PUB, nomeT + '.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(txt);
    } catch { json(404, { erro: 'no such table' }); }
    return;
  }

  // ── Upload do GLB de cenário (binário; o editor 3D re-exporta o mapa) ──────────
  // Caminho próprio: o corpo é um .glb (vários MB), não JSON — não passa pelo cap de 1MB nem pelo parse de texto.
  if (req.method === 'POST' && rota === '/admin/mapa-glb') {
    const u = usuarioDe(req);
    if (!u) return json(401, { erro: 'Your sign-in expired or you signed in somewhere else: sign in to the panel again.' });
    if (!contas[u]?.gm) return json(403, { erro: 'GM accounts only.' });
    const m = String(url.searchParams.get('map') || url.searchParams.get('mapa') || '');
    if (!/^[\w-]{1,40}$/.test(m)) return json(400, { erro: 'invalid map' });
    const chunks = []; let tam = 0, grande = false;
    req.on('data', d => { if (grande) return; tam += d.length; if (tam > 150 * 1024 * 1024) { grande = true; json(413, { erro: 'GLB file is too large.' }); req.destroy(); return; } chunks.push(d); });
    req.on('end', () => {
      if (grande) return;
      const buf = Buffer.concat(chunks);
      if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546C67) return json(400, { erro: 'the body is not a valid GLB (glTF header).' });   // "glTF" = 0x46546C67
      const arq = caminhoGlb(m);   // grava onde o jogo lê (public/scenery/ ou scenery/ raiz)
      try {
        fazerBackup(arq, true);
        const tmp = arq + '.tmp'; fs.writeFileSync(tmp, buf); fs.renameSync(tmp, arq);
        console.log(`[admin] ${u} saved the GLB for ${m} (${(buf.length / 1048576).toFixed(1)} MB)`);
        return json(200, { ok: true, bytes: buf.length });
      } catch (e) { return json(500, { erro: e.message }); }
    });
    return;
  }

  let body = '', corpoGrande = false;
  const capCorpo = rota.startsWith('/admin/') ? 30 * 1024 * 1024 : 1024 * 1024;   // rotas admin (só GM) mandam mapas grandes (kanto ~2,3MB de objetos); o resto fica em 1MB (nº17)
  req.setEncoding('utf8');                                // corpo grande chega em vários pedaços: sem isto um "ã" cortado na divisa virava "��" (o painel gravava o arquivo estragado)
  req.on('data', d => {                                   // cap de corpo: evita encher a RAM/disco com POST gigante (nº17)
    if (corpoGrande) return;
    body += d;
    if (body.length > capCorpo) { corpoGrande = true; json(413, { erro: 'Request body is too large.' }); req.destroy(); }
  });
  req.on('end', () => {
    if (corpoGrande) return;
    let d = {};
    try { d = body ? JSON.parse(body) : {}; } catch {}

    // Local CLI only: no X-Forwarded-For (Caddy always sets that). Used by tools/set_role.mjs.
    if (req.method === 'POST' && rota === '/local/role') {
      const local = LOOPBACK.has(req.socket.remoteAddress) && !req.headers['x-forwarded-for'];
      if (!local) return json(403, { erro: 'Local only.' });
      const u = String(d.usuario || '').toLowerCase().trim();
      const role = String(d.role || '').toLowerCase().trim();
      if (!ROLES[role]) return json(400, { erro: 'role must be admin, staff, mod, or player' });
      if (!u || !contas[u]) return json(404, { erro: 'Account not found.' });
      const depois = applyRole(contas[u], role);
      contas[u].rev = (contas[u].rev || 0) + 1;
      salvarContasJa();
      logAdmin('local', u, 'role', { depois });
      for (const w of socketsDe(u)) {
        enviar(w, { t: 'save', save: contas[u].save || null, rev: contas[u].rev, gm: !!contas[u].gm, cargo: contas[u].cargo || null });
        enviar(w, { t: 'sistema', texto: 'Your role is now ' + role + '.' });
      }
      console.log('[role] ' + u + ' → ' + role);
      return json(200, { ok: true, usuario: u, ...depois });
    }

    // ── Diagnóstico de boot + erros do cliente ────────────────────────────
    if (req.method === 'POST' && (rota === '/conta/boot' || rota === '/conta/log')) {
      if (limitado(ipDe(req), 'log', 60, 60000)) return json(429, { ok: false });   // nº17: freia flood de log por IP
      const linha = JSON.stringify({ ...d, _t: new Date().toISOString(), _ip: ipDe(req) }) + '\n';
      try { fs.appendFileSync(nodePath.join(DADOS, 'client.log'), linha); } catch {}
      if (d.tipo === 'erro' || d.tipo === 'rejeicao')
        console.warn('[client]', d.usuario || '?', d.tipo, d.msg?.slice(0, 120));
      return json(200, { ok: true });
    }

    // GET /conta/logs — lista os últimos erros do cliente. nº16: só GM (o log tem IP+usuário de outros jogadores).
    if (req.method === 'GET' && rota === '/conta/logs') {
      const uLog = usuarioDe(req);
      if (!contas[uLog]?.gm) return json(403, { erro: 'Permission denied.' });
      try {
        const linhas = fs.readFileSync(nodePath.join(DADOS, 'client.log'), 'utf8').trim().split('\n').filter(Boolean);
        const ultimas = linhas.slice(-50).map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
        return json(200, { ok: true, total: linhas.length, ultimas });
      } catch { return json(200, { ok: true, total: 0, ultimas: [] }); }
    }

    if (req.method === 'GET' && (rota === '/health' || rota === '/saude')) {
      return json(200, { ok: true, game: 'PokeVerse' });
    }
    if (req.method === 'GET' && rota === '/alfa') return json(200, { ok: true, chaveObrigatoria: false });
    if (req.method === 'POST' && rota === '/chaves/validar') return json(200, { ok: true, chave: d.chave });

    // ── Cadastro ──────────────────────────────────────────────────────────
    if (req.method === 'POST' && rota === '/conta/criar') {
      if (limitado(ipDe(req), 'criar', 5, 60000)) return json(429, { erro: 'Too many accounts created from this IP. Wait a minute.' });
      const u = String(d.usuario || '').toLowerCase().trim();
      if (!u || u.length < 3) return json(400, { erro: 'Username is too short (at least 3 letters).' });
      if (!/^[a-z0-9_]{3,20}$/.test(u)) return json(400, { erro: 'Use only letters, numbers and _ (3–20 characters).' });
      if (contas[u]) return json(409, { erro: 'This username is already taken.' });
      const termosV = termosAtuais();
      if (termosV && String(d.termos ?? '') !== termosV) return json(400, { erro: 'To create the account, tick the box saying you have read and accept the Terms of Use and the Privacy Policy.', termosVersao: termosV });
      const codigo = crypto.randomBytes(8).toString('hex');
      const token = tokenNovo();
      contas[u] = { senha: hashSenha(d.senha || ''), email: d.email || '', save: null, rev: 0, codigo, token, tokenExp: Date.now() + TOKEN_VIDA_MS, criadaEm: Date.now(), ...(termosV ? { termos: { versao: termosV, em: Date.now(), ip: ipDe(req) } } : {}) };
      salvarContasJa();
      sessoes.set(token, u);
      return json(200, { ok: true, token, usuario: u, rev: 0, codigo, save: null });
    }

    // ── Login ─────────────────────────────────────────────────────────────
    if (req.method === 'POST' && rota === '/conta/entrar') {
      if (limitado(ipDe(req), 'entrar', 10, 60000)) return json(429, { erro: 'Too many attempts. Wait a minute.' });
      const u = String(d.usuario || '').toLowerCase().trim();
      const c = contas[u];
      if (!c || !conferirSenha(d.senha || '', c.senha)) return json(401, { erro: 'Incorrect username or password.' });
      migrarSenhaSeLegado(c, d.senha || '');
      const ban = banidoAteDe(c);                                         // painel → Jogadores → Banir
      if (ban) return json(403, { erro: 'Account suspended ' + (ban === -1 ? 'permanently' : 'until ' + new Date(ban).toLocaleString('en-US')) + '.' + (c.banMotivo ? ' Reason: ' + c.banMotivo : '') });
      const manut = eventos.bloqueiaLogin(c); if (manut) return json(503, { erro: manut });   // Fase 3: modo manutenção (GM entra)
      const token = tokenNovo();
      c.token = token;
      c.tokenExp = Date.now() + TOKEN_VIDA_MS;
      salvarContasJa();
      sessoes.set(token, u);
      return json(200, { ok: true, token, usuario: u, rev: c.rev || 0, save: c.save || null, gm: !!c.gm, cargo: c.cargo || null, alfa: !!c.alfa, idioma: c.idioma || null, ...(posDaConta(c) ? { pos: posDaConta(c) } : {}), ...termosPendentesDe(c) });   // posGm wins; else last walk (F5 / relog)
    }

    // ── Recuperação de senha ───────────────────────────────────────────────
    if (req.method === 'POST' && rota === '/conta/recuperar') {
      if (limitado(ipDe(req), 'recuperar', 5, 60000)) return json(429, { erro: 'Too many attempts. Wait a minute.' });
      const u = String(d.usuario || '').toLowerCase().trim();
      const c = contas[u];
      if (!c) return json(400, { erro: 'User not found.' });
      if (c.codigo !== d.codigo) return json(400, { erro: 'Incorrect recovery code.' });
      c.senha = hashSenha(d.nova || '');
      c.codigo = crypto.randomBytes(8).toString('hex');
      salvarContasJa();
      return json(200, { ok: true, codigo: c.codigo });
    }

    // ── Save (requer auth) ────────────────────────────────────────────────
    if (req.method === 'GET' && rota === '/save') {
      const u = usuarioDe(req);
      if (!u) return json(401, { erro: 'Invalid session.' });
      const c = contas[u];
      if (c?.save && marcarPegoDoTime(c)) salvarContas();
      return json(200, { ok: true, save: c.save || null, rev: c.rev || 0, gm: !!c.gm, cargo: c.cargo || null, alfa: !!c.alfa, idioma: c.idioma || null, ...(posDaConta(c) ? { pos: posDaConta(c) } : {}), ...termosPendentesDe(c) });
    }

    if (req.method === 'PUT' && rota === '/save') {
      const u = usuarioDe(req);
      if (!u) return json(401, { erro: 'Invalid session.' });
      // ANTI-TRAPAÇA: o cliente só pode ZERAR (save:null). Um save com conteúdo (dinheiro/time) é do SERVIDOR — recusa.
      if (d.save != null) return json(403, { erro: 'Operation not allowed.' });
      contas[u].save = null;
      contas[u].rev = (contas[u].rev || 0) + 1;
      salvarContas();
      return json(200, { ok: true, rev: contas[u].rev });
    }

    // ── Estado (keepalive, aceita sem auth silenciosamente) ───────────────
    if (req.method === 'POST' && rota === '/conta/estado') {
      const u = usuarioDe(req);
      if (u && contas[u]) {
        const c = contas[u];
        if (!c.save) c.save = {};
        if (d.party || d.arranjo) applyPartyOrder(c, d.party || d.arranjo);   // party order plus field experience; `arranjo` is the old message name
        aplicarPrefs(c, d.prefs);                       // só as chaves permitidas (nunca dinheiro/itens/bolas)
        aplicarDexConhecimento(c, d);                       // dex só ganha 'visto' do cliente; o registro de conhecimento só sobe
        marcarPegoDoTime(c);
        if (d.pos){
          const mesmo = c.pos && String(c.pos.mapa) === String(d.pos.mapa || '');
          gravarPosConta(u, d.pos, { porta: !!(mesmo && d.pos.porta && d.pos.chegada) });   // refresh keeps a same-map door landing; a tab close cannot pick another map
        }
        c.rev = (c.rev || 0) + 1;
        salvarContas();
        if (d.outroAparelho) return json(409, { erro: 'Session conflict.', outroAparelho: true });
      }
      return json(200, { ok: true, rev: contas[u]?.rev || 0 });
    }

    // ── Sair ──────────────────────────────────────────────────────────────
    // Scene pass: the upcoming client asks for a signed pass. We do not gate scenes yet (pass_rules.mjs
    // SCENES_GATED = false), so this only confirms the session; with no `passe` the client treats every scene as free.
    if (req.method === 'GET' && rota === '/loja/catalogo') {   // 👕 wardrobe + shop catalog, with what this account owns
      const u = usuarioDe(req), c = u ? contas[u] : null;
      if (c?.save) guarda.owned(c.save);
      return json(200, guarda.catalogFor(c, String(url.searchParams.get('l') || 'en').slice(0, 2)));
    }
    if ((rota === '/social' || rota.startsWith('/social/')) && social.route(rota, req.method, d, usuarioDe(req), json, url)) return;   // friends and messages (server_social.mjs)
    if (rota.startsWith('/ranking') && ranking.route(rota, req.method, json, usuarioDe, req)) return;   // 🏆 rankings (server_ranking.mjs)
    if (req.method === 'GET' && rota === '/conta/passe') {
      const u = usuarioDe(req);
      if (!u) return json(401, { erro: 'Invalid session.' });
      return json(200, { ok: true, gated: false });
    }
    // Terms of use accepted (screens ask once per terms version).
    if (req.method === 'POST' && rota === '/conta/termos') {
      const u = usuarioDe(req);
      if (!u || !contas[u]) return json(401, { erro: 'Invalid session.' });
      const atual = termosAtuais();
      if (atual && String(d.versao ?? '') !== atual) return json(409, { erro: 'The Terms of Use or the Privacy Policy have changed. Reload the page and accept the new version.', termosVersao: atual });
      contas[u].termos = { versao: String(d.versao || '').slice(0, 40), em: Date.now(), ip: ipDe(req) };
      salvarContas();
      return json(200, { ok: true });
    }
    // Account settings (account_settings.mjs): one small object per settings type.
    if (req.method === 'POST' && rota === '/conta/config') {
      const u = usuarioDe(req);
      if (!u || !contas[u]) return json(401, { erro: 'Invalid session.' });
      const tipo = String(d.tipo || '');
      if (!/^[a-z_]{1,24}$/i.test(tipo) || !d.config || typeof d.config !== 'object' || Array.isArray(d.config)) return json(400, { erro: 'Invalid settings.' });
      const texto = JSON.stringify(d.config);
      if (texto.length > 4000) return json(413, { erro: 'Settings are too large.' });
      if (!contas[u].config || typeof contas[u].config !== 'object') contas[u].config = {};
      contas[u].config[tipo] = JSON.parse(texto);
      salvarContas();
      return json(200, { ok: true });
    }

    if (req.method === 'POST' && rota === '/conta/sair') {
      const u = usuarioDe(req);
      if (u && contas[u]) { sessoes.delete(contas[u].token); contas[u].token = null; salvarContasJa(); }
      return json(200, { ok: true });
    }

    // ── Configurações de conta ────────────────────────────────────────────
    if (req.method === 'POST' && rota === '/conta/nome') {
      const u = usuarioDe(req);
      if (!u) return json(401, { erro: 'Invalid session.' });
      const nome = String(d.nome || '').trim();
      if (nome.length < 2) return json(400, { erro: 'Name is too short.' });
      if (!contas[u].save) contas[u].save = {};
      contas[u].save.nome = nome;
      salvarContas();
      return json(200, { ok: true });
    }

    if (req.method === 'POST' && rota === '/conta/idioma') {
      const u = usuarioDe(req);
      if (u && contas[u] && d.idioma) { contas[u].idioma = d.idioma; salvarContas(); }
      return json(200, { ok: true });
    }

    if (req.method === 'POST' && rota === '/conta/senha') {
      const u = usuarioDe(req);
      if (!u) return json(401, { erro: 'Invalid session.' });
      if (!conferirSenha(d.senhaAtual || '', contas[u].senha)) return json(400, { erro: 'Current password is incorrect.' });
      contas[u].senha = hashSenha(d.nova || '');
      salvarContasJa();
      return json(200, { ok: true });
    }

    if (req.method === 'GET' && rota === '/events') return agenda.publico(url, json);
    if (req.method === 'GET' && rota === '/loja') return json(200, loja.info());
    if (req.method === 'POST' && rota === '/loja/checkout') return json(503, { erro: 'Diamond purchases are not open yet.', codigo: 'loja-fechada' });
    if (req.method === 'GET' && (rota === '/temporada' || rota === '/conta')) {
      const u = usuarioDe(req);
      if (!u || !contas[u]) return json(401, { erro: 'Invalid session.' });
      if (rota === '/conta') return json(200, { usuario: u, nome: contas[u].save?.nome || u, email: '', emailVerificado: false });
      const v = temporada.vista(contas[u]);
      return v ? json(200, { vista: v }) : json(404, { erro: 'There is no season right now.' });
    }

    if (req.method === 'POST' && rota === '/conta/personagem/apagar') {
      const u = usuarioDe(req);
      if (u && contas[u]?.save) { delete contas[u].save.personagem; salvarContas(); }
      return json(200, { ok: true });
    }

    if (req.method === 'POST' && rota === '/conta/apagar') {
      const u = usuarioDe(req);
      if (!u) return json(401, { erro: 'Invalid session.' });
      if (!conferirSenha(d.senha || '', contas[u].senha)) return json(400, { erro: 'Incorrect password.' });
      if (contas[u].token) sessoes.delete(contas[u].token);
      delete contas[u];
      salvarContasJa();
      return json(200, { ok: true });
    }

    // ── Painel admin (só GM) ──────────────────────────────────────────────
    if (rota.startsWith('/admin/')) {
      if (rota === '/admin/eu' && req.method === 'GET') {                  // o painel pergunta quem é antes de abrir
        const u = usuarioDe(req);
        if (!u) return json(401, { erro: 'Invalid session.' });
        return json(200, { ok: true, usuario: u, gm: !!contas[u]?.gm, nome: contas[u]?.save?.nome || u });
      }
      const g = gmDe(req);
      if (!g) return usuarioDe(req) ? json(403, { erro: 'GM accounts only.' }) : json(401, { erro: 'Your sign-in expired or you signed in somewhere else: sign in to the panel again.' });
      if ((rota === '/admin/agenda' || rota === '/admin/agenda/agora') && agenda.rota(rota, req.method, d, g, json)) return;   // 📅 event schedule (server_schedule.mjs)
      if (rota.startsWith('/admin/eventos') && eventos.rota(rota, req.method, d, g, json)) return;
      if (rota.startsWith('/admin/errantes') && errantes.adminRoute(rota, req.method, d, g, json)) return;   // 🌀 Roaming legendaries
      if (rota.startsWith('/admin/surtos') && surtos.adminRoute(rota, req.method, d, g, json)) return;   // 🌟 Mass outbreaks
      if (rota === '/admin/campeao' && req.method === 'GET') return json(200, { ok: true, campeao: batalha.campeaoAdmin() });   // 👑 Champion's seat
      if (rota === '/admin/campeao/resetar' && req.method === 'POST') return json(200, { ...batalha.resetarCampeao(g), campeao: batalha.campeaoAdmin() });
      if (rota.startsWith('/admin/ranking') && ranking.adminRoute(rota, req.method, d, g, json)) return;   // 🏆 Ranking tab
      if (rota.startsWith('/admin/correio') && mail.adminRoute(rota, req.method, d, g, json, url)) return;   // 📬 Mail tab (server_mail.mjs)   // Fase 3: eventos ao vivo (server_events.mjs)
      if (rota.startsWith('/admin/recursos/') && recursos(rota, req.method, url, json)) return;      // Fase 3: listas pras prévias (server_resources.mjs)
      if (rota === '/admin/modelos' && req.method === 'GET')
        return json(200, { ok: true, modelos: [...modelosMon()].sort().map(glb => ({ glb, dex: +glb.slice(2, 6) })) });
      if (rota === '/admin/mapas' && req.method === 'GET') {               // cenas que têm arquivo de mapa (o painel junta o nome do scenes.json)
        let mapas = []; try { mapas = fs.readdirSync(DADOS_PUB).filter(f => /^(\d+|kanto|pallet_route1)\.json$/.test(f)).map(f => f.slice(0, -5)); } catch {}
        return json(200, { ok: true, mapas });
      }
      if (rota === '/admin/zonas' && req.method === 'GET') return json(200, { ok: true, ...lerJson(ZONAS_ARQ, { v: 1, zonas: [] }) });
      if (rota === '/admin/zonas' && req.method === 'POST') {
        if (!Array.isArray(d.zonas)) return json(400, { erro: 'Missing the zone list.' });
        const zonas = d.zonas.slice(0, 500).map(limparZona).filter(Boolean);
        const ids = new Set(); for (const z of zonas) { while (ids.has(z.id)) z.id += '_'; ids.add(z.id); }
        gravarComBackup(ZONAS_ARQ, { v: 1, zonas });
        console.log(`[admin] ${g} saved ${zonas.length} spawn zone(s)`);
        return json(200, { ok: true, total: zonas.length, descartadas: d.zonas.length - zonas.length });
      }
      if (rota === '/admin/habitats' && req.method === 'GET') return json(200, { ok: true, ...lerJson(HABITATS_ARQ, { areas: {}, generico: [] }) });
      if (rota === '/admin/habitats' && req.method === 'POST') {
        const areas = {};
        for (const [k, lista] of Object.entries(d.areas && typeof d.areas === 'object' ? d.areas : {})) {
          if (!/^\d{1,8}$/.test(k) || !Array.isArray(lista)) continue;
          const l = lista.slice(0, 60).map(e => limparEspecie(e, false)).filter(Boolean);
          if (l.length) areas[k] = l;
        }
        const generico = (Array.isArray(d.generico) ? d.generico : []).slice(0, 60).map(e => limparEspecie(e, false)).filter(Boolean);
        gravarComBackup(HABITATS_ARQ, { ...lerJson(HABITATS_ARQ, {}), areas, generico });   // mantém as outras chaves do arquivo (ex.: `mapa`)
        console.log(`[admin] ${g} saved habitats (${Object.keys(areas).length} areas)`);
        return json(200, { ok: true, areas: Object.keys(areas).length });
      }
      /* ── NEW MAP (Nov 5): blank or a clone of an existing map ──
         POST /admin/mapa/novo { modo: 'vazio' | 'clonar', nome, tipo: 'fora' | 'dentro', de (clone source), lib (blank: the prefab
         library map, default 2100011), largura / profundidade (blank, metres) }.
         A map is three files plus its scenes.json entry: public/data/<id>.json (areas, scenery pieces, layers), scenery/<id>.glb (the
         prefab library; a copy of the source's file) and scenery/<id>_chao.json. New maps get ids from
         9100001 and their own area ids, so names, music and spawns never mix with the map they came from. A clone keeps the
         scenery, ground, grass and water; NPCs, doors, trainers and stories are left out (they belong to the original's places). */
      if (rota === '/admin/mapa/novo' && req.method === 'POST') {
        const LADO_MAX = 320;   // a blank map is one 1 × 1 m ground tile per m²: 320 × 320 ≈ 100k tiles, about Johto's file size (bigger loads slowly)
        const modo = d.modo === 'clonar' ? 'clonar' : 'vazio';
        const nome = String(d.nome || '').trim().slice(0, 60);
        if (!nome) return json(400, { erro: 'Give the new map a name.' });
        const fora = d.tipo !== 'dentro';
        const cenasArq = nodePath.join(DADOS_PUB, 'scenes.json'), cenas = lerJson(cenasArq, { cenas: [] });
        if (!Array.isArray(cenas.cenas)) cenas.cenas = [];
        const usados = new Set(cenas.cenas.map(c => +c.id)), areasUsadas = new Set(cenas.cenas.flatMap(c => (c.areas || []).map(a => +a.id)));
        let id = 9100001; while (usados.has(id) || fs.existsSync(nodePath.join(DADOS_PUB, id + '.json'))) id++;
        let proxArea = 910001; const novaArea = () => { while (areasUsadas.has(proxArea)) proxArea++; areasUsadas.add(proxArea); return proxArea++; };
        const glbDe = m => { const lib = GLB_EMPRESTADO[m] || m; for (const dir of [CENARIO_RAIZ, CENARIO_PUB]) { const f = nodePath.join(dir, lib + '.glb'); if (fs.existsSync(f)) return { dir, lib, f }; } return null; };
        const ligar = (de, para) => fs.copyFileSync(de, para);   // a real copy: each map's GLB is re-exported by the 3D editor on its own, and a hard link broke the deploy's live-edit save (tar non-file member)
        let dados, origem, areasCena;
        if (modo === 'clonar') {
          const de = String(d.de || '');
          if (!/^[\w-]{1,40}$/.test(de)) return json(400, { erro: 'Pick the map to clone.' });
          const src = lerJson(nodePath.join(DADOS_PUB, de + '.json'), null);
          if (!src) return json(404, { erro: 'Map ' + de + ' not found.' });
          origem = glbDe(de);
          if (!origem) return json(400, { erro: 'Map ' + de + ' has no 3D file to clone.' });
          const troca = new Map();                                               // old area id → new one
          const nova = a => { if (!troca.has(+a)) troca.set(+a, novaArea()); return troca.get(+a); };
          dados = { ...src, mapa: id, nome, npcs: [], portas: [], treinadores: [], historias: [] };
          dados.caixas = (src.caixas || []).map(c => ({ ...c, a: nova(c.a) }));
          for (const k of ['grama', 'agua']) if (Array.isArray(src[k])) dados[k] = src[k].map(t => (t && typeof t === 'object' && 'a' in t ? { ...t, a: nova(t.a) } : t));
          const nomesSrc = src.nomes || {}, cenaSrc = cenas.cenas.find(c => String(c.id) === de);
          dados.nomes = {}; areasCena = [];
          for (const [velho, novo] of troca) {
            const n0 = nomesSrc[velho] || cenaSrc?.areas?.find(a => +a.id === velho)?.nome || nome;
            dados.nomes[novo] = n0; areasCena.push({ id: novo, nome: n0, tipo: fora ? 1 : 2 });
          }
          if (!areasCena.length) { const a = novaArea(); areasCena.push({ id: a, nome, tipo: fora ? 1 : 2 }); dados.nomes = { [a]: nome }; }
        } else {
          const lib = String(d.lib || '2100011');
          origem = glbDe(lib);
          const libDados = lerJson(nodePath.join(DADOS_PUB, lib + '.json'), null);
          if (!origem || !libDados) return json(400, { erro: 'Library map ' + lib + ' not found.' });
          const W = Math.max(10, Math.min(LADO_MAX, Math.round(+d.largura || 60))), D = Math.max(10, Math.min(LADO_MAX, Math.round(+d.profundidade || 60)));
          const piso = (libDados.prefabs || []).find(n => /^floor_grass/.test(n)) || (libDados.prefabs || []).find(n => /floor/i.test(n)) || 'floor_grass2';
          const objetos = [];                                                    // the ground: floor tiles, like the source maps
          for (let x = -W / 2; x < W / 2; x++) for (let z = -D / 2; z < D / 2; z++) objetos.push({ n: piso, x: x + 0.5, y: 0, z: z + 0.5, a: 0 });   // floor_grass2 is a 1 × 1 m tile
          const a = novaArea();
          dados = { mapa: id, nome, areas: [], nomes: { [a]: nome }, caixas: [{ a, x: 0, y: 0, z: 0, sx: W, sy: 20, sz: D }], objetos, ambiente: [], areaEnv: [],
            grama: [], agua: [], portas: [], treinadores: [], historias: [], npcs: [], nav: [], prefabs: libDados.prefabs || [], bbox: { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2 } };
          areasCena = [{ id: a, nome, tipo: fora ? 1 : 2 }];
        }
        try {
          ligar(origem.f, nodePath.join(CENARIO_RAIZ, id + '.glb'));
          const chao = nodePath.join(origem.dir, origem.lib + '_chao.json');
          if (fs.existsSync(chao)) fs.copyFileSync(chao, nodePath.join(CENARIO_RAIZ, id + '_chao.json'));
          fs.writeFileSync(nodePath.join(DADOS_PUB, id + '.json'), JSON.stringify(dados));
          cenas.cenas.push({ id, nome, areas: areasCena, objeto: false, criado: { por: g, em: new Date().toISOString(), modo, de: modo === 'clonar' ? String(d.de) : String(d.lib || '2100011') } });
          gravarComBackup(cenasArq, cenas);
        } catch (e) { return json(500, { erro: 'Could not write the map files: ' + e.message }); }
        logAdmin(g, '*', 'new map', { depois: { id, nome, modo, de: d.de || d.lib || null } });
        /* the GM who made it is sent there (next load, or now if the game is open): the middle of its first area, on ground */
        const c0 = dados.caixas?.[0];
        contas[g].posGm = { mapa: String(id), x: c0 ? -(+c0.x || 0) : 0, z: c0 ? +c0.z || 0 : 0, giro: 0 }; salvarContas();
        for (const w of socketsDe(g)) enviar(w, { t: 'volta', mapa: String(id), texto: '🧭 Going to the new map ' + nome + '…' });
        console.log(`[admin] ${g} created map ${id} "${nome}" (${modo}${modo === 'clonar' ? ' of ' + d.de : ''})`);
        return json(200, { ok: true, id, nome, areas: areasCena, objetos: dados.objetos?.length || 0 });
      }
      /* ── DELETE A MAP (Nov 6): POST /admin/mapa/apagar { id, nome } — only maps made in the panel (New map: ids 9100001+, with a
         `criado` stamp), never the game's own. `nome` must match (the panel asks you to type it). The files go to the backups folder
         first; the scenes.json entry goes too, and players saved on that map come back to Pallet Town on their next login. */
      if (rota === '/admin/mapa/apagar' && req.method === 'POST') {
        const id = String(d.id || '');
        const cenasArq = nodePath.join(DADOS_PUB, 'scenes.json'), cenas = lerJson(cenasArq, { cenas: [] });
        const i = (cenas.cenas || []).findIndex(c => String(c.id) === id);
        const c = i >= 0 ? cenas.cenas[i] : null;
        if (!c) return json(404, { erro: 'No map ' + id + '.' });
        if (!(+id >= 9100001 && +id < 9200000) || !c.criado) return json(403, { erro: 'Only maps made with New map can be deleted here.' });
        const dig = String(d.nome || '').trim().toLowerCase();   // the map's name (any case) or its number
        if (dig !== String(c.nome || '').trim().toLowerCase() && dig !== id) return json(400, { erro: 'Type the map name or its number to delete it.' });
        const arquivos = [nodePath.join(DADOS_PUB, id + '.json'), nodePath.join(CENARIO_RAIZ, id + '.glb'), nodePath.join(CENARIO_RAIZ, id + '_chao.json'),
          nodePath.join(CENARIO_PUB, id + '.glb'), nodePath.join(CENARIO_PUB, id + '_chao.json')];
        try {
          for (const f of arquivos) if (fs.existsSync(f)) { fazerBackup(f, f.endsWith('.glb')); fs.unlinkSync(f); }
          cenas.cenas.splice(i, 1);
          gravarComBackup(cenasArq, cenas);
        } catch (e) { return json(500, { erro: 'Could not delete the map files: ' + e.message }); }
        for (const conta of Object.values(contas)) { if (String(conta?.posGm?.mapa) === id) delete conta.posGm; if (String(conta?.pos?.mapa) === id) delete conta.pos; }   // nobody wakes up on a map that is gone
        salvarContas();
        logAdmin(g, '*', 'delete map', { antes: { id, nome: c.nome } });
        console.log(`[admin] ${g} deleted map ${id} "${c.nome}"`);
        return json(200, { ok: true, id, nome: c.nome });
      }
      // ── Editor de Cenário 3D: objetos (prefabs colocados) do mapa ──
      if (rota === '/admin/mapas-glb' && req.method === 'GET') {           // mapas com .glb (public/scenery/ + scenery/ raiz) que têm <mapa>.json
        const mapas = mapasComGlb();
        const glb = Object.fromEntries(Object.entries(GLB_EMPRESTADO).filter(([m]) => mapas.includes(m)));
        return json(200, { ok: true, mapas, glb });
      }
      if (rota === '/admin/mapa-objetos' && req.method === 'GET') {
        const m = String(url.searchParams.get('map') || url.searchParams.get('mapa') || '');
        if (!/^[\w-]{1,40}$/.test(m)) return json(400, { erro: 'invalid map' });
        const d2 = lerJson(nodePath.join(DADOS_PUB, m + '.json'), null);
        if (!d2) return json(404, { erro: 'map not found' });
        // o jogo monta o cenário de 3 listas: areaEnv (chão), ambiente (água/céu) e objetos (props)
        return json(200, { ok: true, objetos: d2.objetos || [], ambiente: d2.ambiente || [], areaEnv: d2.areaEnv || [] });
      }
      if (rota === '/admin/mapa-objetos' && req.method === 'POST') {
        const m = String(d.mapa || '');
        if (!/^[\w-]{1,40}$/.test(m)) return json(400, { erro: 'invalid map' });
        const arq = nodePath.join(DADOS_PUB, m + '.json');
        const d2 = lerJson(arq, null);
        if (!d2) return json(404, { erro: 'map not found' });
        const limpa = l => (Array.isArray(l) ? l : []).slice(0, 200000).map(limparObjeto).filter(Boolean);
        let n = 0;
        for (const k of ['objetos', 'ambiente', 'areaEnv']) if (Array.isArray(d[k])) { d2[k] = limpa(d[k]); n += d2[k].length; }   // só troca as listas que vieram; o resto do mapa fica
        gravarComBackup(arq, d2);
        console.log(`[admin] ${g} saved ${n} scenery pieces on ${m}`);
        return json(200, { ok: true, total: n });
      }
      /* ── Editor de Mapa: ÁREAS (caixas + nomes) ──
         Uma área = id + nome + 1..N caixas {a,x,y,z,sx,sy,sz} (x em coords de ARQUIVO; o jogo espelha). A caixa decide a área
         onde o jogador está (nome na tela, música) e o limite do mundo na água. O nome que o jogo mostra vem PRIMEIRO do
         data/scenes.json (nomeAreaCena) e depois do `nomes` do mapa — então renomear grava nos dois. Só os nomes enviados mudam
         (o cliente manda os que editou; ex.: o cenas diz "Cidade Celeste" e o mapa "Cidade Cerulean", e isso fica como está).
         `tilesArea` (opcional) = o id de área de cada tile de grama/água, na ordem do arquivo: é como uma área nova assume a
         grama de dentro dela (o spawn agrupa por tile.a). */
      if (rota === '/admin/mapa-areas' && req.method === 'POST') {
        const m = String(d.mapa || '');
        if (!/^[\w-]{1,40}$/.test(m)) return json(400, { erro: 'invalid map' });
        const arq = nodePath.join(DADOS_PUB, m + '.json');
        const d2 = lerJson(arq, null);
        if (!d2) return json(404, { erro: 'map not found' });
        if (!Array.isArray(d.caixas) || d.caixas.length > 2000) return json(400, { erro: 'Missing the box list.' });
        const num = (v, min, max) => { const n = +v; return Number.isFinite(n) && n >= min && n <= max ? +n.toFixed(3) : null; };
        const caixas = [];
        for (const c of d.caixas) {
          const a = Number.isInteger(+c?.a) && +c.a >= 1 && +c.a <= 99999999 ? +c.a : null;
          const x = num(c?.x, -100000, 100000), z = num(c?.z, -100000, 100000), sx = num(c?.sx, 0.5, 10000), sz = num(c?.sz, 0.5, 10000);
          if (a == null || x == null || z == null || sx == null || sz == null) return json(400, { erro: 'Invalid box: ' + JSON.stringify(c).slice(0, 80) });
          caixas.push({ a, x, y: num(c.y ?? 0, -10000, 10000) ?? 0, z, sx, sy: num(c.sy ?? 60, 0.5, 10000) ?? 60, sz });
        }
        const comCaixa = new Set(caixas.map(c => c.a)), tinhaCaixa = new Set((d2.caixas || []).map(c => +c.a));
        const removidas = new Set([...tinhaCaixa].filter(a => !comCaixa.has(a)));
        const areasAntes = (d2.areas || []).map(Number);
        const novas = [...comCaixa].filter(a => !areasAntes.includes(a));
        const areas = [...areasAntes.filter(a => !removidas.has(a)), ...novas], temArea = new Set(areas);
        const nomes = { ...(d2.nomes || {}) }, renomeadas = {};
        for (const a of removidas) delete nomes[a];
        for (const [k, v] of Object.entries(d.nomes && typeof d.nomes === 'object' ? d.nomes : {})) {
          if (!temArea.has(+k) || typeof v !== 'string' || !v.trim()) continue;
          nomes[+k] = renomeadas[+k] = v.trim().slice(0, 60);
        }
        for (const k of ['grama', 'agua']) {
          const ids = d.tilesArea?.[k]; if (ids == null) continue;
          if (!Array.isArray(ids) || ids.length !== (d2[k] || []).length) return json(409, { erro: `A lista de ${k} mudou desde que o painel abriu — recarregue a página.` });
          ids.forEach((a, i) => { if (Number.isInteger(a) && temArea.has(a)) d2[k][i].a = a; });
        }
        d2.caixas = caixas; d2.areas = areas; d2.nomes = nomes;
        gravarComBackup(arq, d2);
        const arqCenas = nodePath.join(DADOS_PUB, 'scenes.json'), ce = lerJson(arqCenas, null);
        if (Array.isArray(ce?.cenas)) {
          let mudou = false;
          for (const cena of ce.cenas) for (const x of cena.areas || []) if (renomeadas[x.id] && x.nome !== renomeadas[x.id]) { x.nome = renomeadas[x.id]; mudou = true; }
          const cenaMapa = ce.cenas.find(c => c.id === d2.mapa);
          if (cenaMapa) {
            const antes = (cenaMapa.areas || []).length;
            cenaMapa.areas = (cenaMapa.areas || []).filter(x => !removidas.has(x.id));
            for (const a of novas) if (!cenaMapa.areas.some(x => x.id === a)) cenaMapa.areas.push({ id: a, nome: nomes[a] || 'Área ' + a, tipo: 1 });
            if (cenaMapa.areas.length !== antes || novas.length) mudou = true;
          }
          if (mudou) gravarComBackup(arqCenas, ce);
        }
        console.log(`[admin] ${g} saved areas of ${m}: ${areas.length} areas, ${caixas.length} boxes (+${novas.length} −${removidas.size})`);
        return json(200, { ok: true, areas: areas.length, caixas: caixas.length, novas: novas.length, removidas: removidas.size });
      }
      /* ── Editor de Mapa: CAMADAS (Fase 1) — os pontos (npcs, treinadores) e os tiles (grama, agua, spawn = piso de caverna) do
         <mapa>.json. Só troca as listas que vieram. Cada item é refeito campo a campo na ordem do arquivo (número finito; cfg,
         modelo, tipo e área inteiros); chave desconhecida cai fora. Quem o NPC é (npcs_glb) e as portas (doors.json) vão
         pelo /admin/dados, com os esquemas `npcs` e `portas`. ── */
      if (rota === '/admin/mapa-camadas' && req.method === 'POST') {
        const m = String(d.mapa || '');
        if (!/^[\w-]{1,40}$/.test(m)) return json(400, { erro: 'invalid map' });
        const arq = nodePath.join(DADOS_PUB, m + '.json'), d2 = lerJson(arq, null);
        if (!d2) return json(404, { erro: 'map not found' });
        const CAMPOS = { npcs: ['cfg', 'modelo', 'face', 'x', 'y', 'z', 'a'], treinadores: ['cfg', 'tipo', 'x', 'y', 'z', 'a'], bosses: ['cfg', 'x', 'y', 'z', 'a'], grama: ['cfg', 'tipo', 'x', 'y', 'z', 'a'],
          agua: ['tipo', 'x', 'y', 'z', 'a'], spawn: ['x', 'z', 'y', 'a'] };
        const INTEIROS = new Set(['cfg', 'modelo', 'tipo', 'a']), contagem = {}, novas = {};
        for (const [k, campos] of Object.entries(CAMPOS)) {
          if (d[k] === undefined) continue;
          if (!Array.isArray(d[k]) || d[k].length > 100000) return json(400, { erro: k + ': lista inválida' });
          const lista = [];
          for (const [i, o] of d[k].entries()) {
            const out = {};
            for (const c of campos) {
              const v = o?.[c];
              if (v === undefined || v === null) { if (c === 'x' || c === 'z') return json(400, { erro: `${k} ${i + 1}: missing position` }); continue; }
              const n = Number(v);
              if (!Number.isFinite(n) || Math.abs(n) > 1e9 || (INTEIROS.has(c) && !Number.isInteger(n))) return json(400, { erro: `${k} ${i + 1}: invalid "${c}"` });
              out[c] = (c === 'x' || c === 'y' || c === 'z' || c === 'face') ? +n.toFixed(3) : n;
            }
            lista.push(out);
          }
          novas[k] = lista; contagem[k] = lista.length;
        }
        if (!Object.keys(novas).length) return json(400, { erro: 'Nothing to save.' });
        Object.assign(d2, novas);
        gravarComBackup(arq, d2);
        console.log(`[admin] ${g} saved layers of ${m}: ${Object.entries(contagem).map(([k, n]) => k + ' ' + n).join(', ')}`);
        return json(200, { ok: true, contagem });
      }
      /* ── Jogadores (Fase 1) ──
         A conta é o `contas[u]` em memória (grava com salvarContasJa). O painel NUNCA recebe senha, token nem código de
         recuperação — o código só aparece quando o GM gera um novo, pra passar ao jogador. Toda ação entra no admin_log.jsonl
         (quem, em quem, o quê, antes/depois) e, com o jogador online, chega na hora pelo WS: bolsa → {t:'bolsa'}, time →
         {t:'save'}, ban/desconectar → {t:'saia'} + fecha o socket, recado/mudo → {t:'sistema'}. */
      if (rota === '/admin/jogadores' && req.method === 'GET') {
        const q = String(url.searchParams.get('q') || '').toLowerCase().trim(), soOnline = url.searchParams.get('online') === '1';
        const lista = Object.entries(contas).map(([u, c]) => resumoConta(u, c))
          .filter(r => (!q || r.usuario.includes(q) || r.nome.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) && (!soOnline || r.online))
          .sort((a, b) => (!!b.online - !!a.online) || a.usuario.localeCompare(b.usuario));
        const visitantes = [...conexoes.values()].filter(w => w._info && !contas[w._usuario]).map(w => ({ usuario: w._usuario, online: { mapa: w._mapa, x: +(+w._info.x || 0).toFixed(1), z: +(+w._info.z || 0).toFixed(1) } }));
        return json(200, { ok: true, total: Object.keys(contas).length, online: conexoes.size, jogadores: lista.slice(0, 500), visitantes });
      }
      if (rota === '/admin/jogador' && req.method === 'GET') {
        const u = String(url.searchParams.get('u') || ''), c = contas[u];
        if (!c) return json(404, { erro: 'Account not found.' });
        return json(200, { ok: true, conta: resumoConta(u, c), save: c.save || {}, rev: c.rev || 0, log: logAdminDe(u, 60) });
      }
      if (rota.startsWith('/admin/jogador/') && req.method === 'POST') {
        const acao = rota.slice('/admin/jogador/'.length), u = String(d.u || ''), c = contas[u];
        if (!c) return json(404, { erro: 'Account not found.' });
        if (u === g && ((acao === 'cargo' && d.gm !== true) || (acao === 'moderar' && d.acao !== 'recado' && d.acao !== 'levar')))   // não se tranca pra fora do painel
          return json(400, { erro: "This can't be done on your own account." });
        if (!c.save) c.save = {};
        const pronto = (extra = {}) => { c.rev = (c.rev || 0) + 1; salvarContasJa(); return json(200, { ok: true, conta: resumoConta(u, c), save: c.save, rev: c.rev, log: logAdminDe(u, 60), ...extra }); };

        if (acao === 'bolsa') {
          /* The panel sends the whole table it showed, plus what it loaded (`itensAntes` / `bolasAntes`). Anything the player got
             after the panel loaded (a purchase, a drop, the Running Shoes) is kept instead of being wiped by the old table. */
          const juntar = (agora, antes, novo) => {
            if (!antes || typeof antes !== 'object' || !novo || typeof novo !== 'object') return novo;
            const out = { ...(agora || {}) };
            for (const k of Object.keys(antes)) if (!(k in novo)) delete out[k];
            for (const [k, q] of Object.entries(novo)) out[k] = q;
            return out;
          };
          d.itens = juntar(c.save.itens, d.itensAntes, d.itens);
          d.bolas = juntar(c.save.bolas, d.bolasAntes, d.bolas);
          const r = limparBolsa(d);
          if (r.erro) return json(400, { erro: r.erro });
          const antes = { dinheiro: c.save.dinheiro ?? null, itens: c.save.itens || {}, bolas: c.save.bolas || {}, insignias: c.save.insignias || [] };
          Object.assign(c.save, r.bolsa);
          logAdmin(g, u, 'bag', { antes, depois: r.bolsa });
          for (const w of socketsDe(u)) { enviar(w, { t: 'bolsa', op: 'painel', bolsa: r.bolsa }); enviar(w, { t: 'sistema', texto: '🎒 A GM adjusted your bag.' }); }
          return pronto();
        }
        if (acao === 'time') {
          const r = limparTime(c, d);
          if (r.erro) return json(400, { erro: r.erro });
          const antes = { time: (c.save.time || []).map(resumoMon), caixa: (c.save.caixa || []).map(resumoMon) };
          c.save.time = r.time; c.save.caixa = r.caixa;
          marcarPegoDoTime(c);
          logAdmin(g, u, 'team', { antes, depois: { time: r.time.map(resumoMon), caixa: r.caixa.map(resumoMon) } });
          const res = pronto();
          for (const w of socketsDe(u)) { enviar(w, { t: 'save', save: c.save, rev: c.rev }); enviar(w, { t: 'sistema', texto: '🔁 A GM changed your team.' }); }
          return res;
        }
        if (acao === 'pokemon') {                                            // dar um Pokémon: o servidor sorteia IVs/natureza como numa captura
          const dex = +d.dex, lv = Math.max(1, Math.min(100, Math.round(+d.lv || 5)));
          if (!especieValida(dex)) return json(400, { erro: 'Invalid species.' });
          const glb = String(d.glb || ''); if (!/^pm\d{4}[\w-]{0,20}$/.test(glb)) return json(400, { erro: 'Invalid model (glb).' });
          const pk = individuoServidor({ dex, lv, glb, nome: String(d.nome || '').slice(0, 30) });
          if (d.shiny === true) pk.shiny = true;
          if (!Array.isArray(c.save.time)) c.save.time = [];
          if (!Array.isArray(c.save.caixa)) c.save.caixa = [];
          const lugar = c.save.time.length < 6 ? 'time' : 'caixa';
          c.save[lugar].push(pk); marcarPego(c, dex);
          logAdmin(g, u, 'give pokemon', { depois: { ...resumoMon(pk), lugar: lugar === 'time' ? 'team' : 'box' } });
          const res = pronto({ lugar });
          for (const w of socketsDe(u)) { enviar(w, { t: 'save', save: c.save, rev: c.rev }); enviar(w, { t: 'sistema', texto: '🎁 A GM gave you ' + (pk.nome || 'a Pokémon') + ' (Lv ' + pk.lv + ')' + (lugar === 'caixa' ? ' — it went to your box.' : '.') }); }
          return res;
        }
        if (acao === 'cargo') {
          const cargo = ['staff', 'mod'].includes(d.cargo) ? d.cargo : null, gm = d.gm === true;
          const antes = { gm: !!c.gm, cargo: c.cargo || null };
          if (gm) c.gm = true; else delete c.gm;
          c.cargo = cargo;
          logAdmin(g, u, 'role', { antes, depois: { gm, cargo } });
          return pronto();
        }
        if (acao === 'moderar') {                                            // Fase 3: as mesmas funções dos comandos de GM do chat (server_moderation.mjs)
          const r = moderacao.moderar(g, u, d.acao, d);
          if (r.erro) return json(400, { erro: r.erro });
          return pronto();
        }
        if (acao === 'codigo') {                                             // novo código de recuperação de senha (o antigo para de valer)
          c.codigo = crypto.randomBytes(8).toString('hex');
          logAdmin(g, u, 'new recovery code', {});
          return pronto({ codigo: c.codigo });
        }
        return json(404, { erro: 'Unknown action.' });
      }
      // ── Dados genéricos (Fase 0): só os arquivos de admin/schemas.mjs; valida pelo esquema e grava com backup ──
      if (rota.startsWith('/admin/dados/')) {
        const nomeEsq = rota.slice('/admin/dados/'.length);
        const esq = Object.prototype.hasOwnProperty.call(ESQUEMAS, nomeEsq) ? ESQUEMAS[nomeEsq] : null;
        if (!esq) return json(404, { erro: 'File is not editable from the panel: ' + nomeEsq });
        const arq = nodePath.join(DADOS_PUB, esq.arquivo + '.json');
        const vazio = esq.forma === 'lista' ? [] : {};
        const atual = lerJson(arq, esq.caminho ? {} : vazio);
        if (req.method === 'GET') return json(200, { ok: true, dados: (esq.caminho ? atual[esq.caminho] : atual) ?? vazio });
        if (req.method === 'POST') {
          const r = validarColecao(esq, d.dados);
          if (!r.ok) return json(400, { erro: r.erro });
          gravarComBackup(arq, esq.caminho ? { ...atual, [esq.caminho]: r.v } : r.v);   // com caminho, só troca a subchave
          const n = esq.forma === 'objeto' ? 1 : (Array.isArray(r.v) ? r.v.length : Object.keys(r.v).length);
          console.log(`[admin] ${g} saved ${esq.arquivo}${esq.caminho ? '.' + esq.caminho : ''} (${n} record(s))`);
          return json(200, { ok: true, total: n });
        }
      }
      // ── Histórico: lista os backups e restaura um (a restauração também faz backup, então dá pra desfazer o desfazer) ──
      if (rota === '/admin/backups' && req.method === 'GET') {
        const arquivos = {};
        let nomes = []; try { nomes = fs.readdirSync(BACKUPS); } catch {}
        for (const f of nomes) {
          const m = f.match(RE_BACKUP); if (!m) continue;
          const tipo = m[4], chave = m[1] + '.' + tipo;
          let bytes = 0; try { bytes = fs.statSync(nodePath.join(BACKUPS, f)).size; } catch {}
          (arquivos[chave] ||= []).push({ nome: f, tipo, bytes, data: m[3].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z') });
        }
        for (const k of Object.keys(arquivos)) arquivos[k].sort((a, b) => b.data.localeCompare(a.data));
        return json(200, { ok: true, arquivos });
      }
      if (rota === '/admin/backups/restaurar' && req.method === 'POST') {
        const nome = String(d.nome || '');
        const m = nome.match(RE_BACKUP);
        if (!m) return json(400, { erro: 'invalid backup name' });
        const origem = nodePath.join(BACKUPS, nome);
        if (!fs.existsSync(origem)) return json(404, { erro: 'backup not found' });
        const ehGlb = m[4] === 'glb';
        const emPasta = Object.values(ESQUEMAS).find(e => e.arquivo.includes('/') && nodePath.basename(e.arquivo) === m[1])?.arquivo;   // Fase 2: o backup guarda só o nome (dex_pt), o arquivo mora em idioma/
        const destino = ehGlb ? caminhoGlb(m[1]) : nodePath.join(DADOS_PUB, (emPasta || m[1]) + '.json');
        if (!fs.existsSync(destino)) return json(404, { erro: 'the target file does not exist' });   // só restaura por cima de um arquivo que existe
        const conteudo = fs.readFileSync(origem);                                // lê ANTES do backup novo (a limpeza pode apagar o mais antigo)
        fazerBackup(destino, ehGlb);
        const tmp = destino + '.tmp'; fs.writeFileSync(tmp, conteudo); fs.renameSync(tmp, destino);
        console.log(`[admin] ${g} restored ${nome}`);
        return json(200, { ok: true, arquivo: m[1], tipo: m[4] });
      }
      return json(404, { erro: 'Admin route not found: ' + rota });
    }

    json(404, { erro: 'Route not found: ' + rota });
  });
});

// ── WebSocket ────────────────────────────────────────────────────────────────
const conexoes = new Map();   // id → ws
const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: (info) => {
    if (conexoes.size >= MAX_CONEXOES) return false;
    return origemOk(info.origin || info.req?.headers?.origin);
  },
});
let proxId = 1;
// Fase 3 do painel: a lógica mora nos módulos; aqui só entram os helpers que eles reusam (os mesmos da tela Jogadores)
const agenda = criarAgenda({ dadosPub: DADOS_PUB, conexoes, enviar, logAdmin, gravarComBackup, get raid(){ return raid; } });
const eventos = criarEventos({ dadosPub: DADOS_PUB, conexoes, contas, enviar, derrubar, logAdmin, gravarComBackup, agendaBonus: agora => agenda.bonusAgora(agora) });
const moderacao = criarModeracao({ contas, sessoes, socketsDe, banidoAteDe, derrubar, logAdmin, enviar, salvarContasJa, conexoes, dadosPub: DADOS_PUB, avisar: eventos.avisar, darDiamantes: (u, n) => loja.darDiamantes(u, n), temporadaGm: (u, op, n) => temporada.gm(u, op, n) });
const recursos = criarRecursos(__dir);
const raid = criarRaid({ contas, sessoes, conexoes, enviar, socketsDe, logAdmin, salvarContas, salvarContasJa, dadosPub: DADOS_PUB, raiz: __dir, individuoServidor, marcarPego,
  bolaBonus: (id, w, u) => world.ballBonus(id, w, u),   // the ball's catch bonus, same as in the wild (Level / Net / Nest / Repeat Ball…)
  shinyMult: () => eventos.shinyMult(), pontoSeguro: () => moderacao.cidade('pallet'), aoEntrarFila: u => temporada.contar(u, { conta: 'raid' }),
  aoPontuar: (u, n, mvp, parte) => { temporada.contar(u, { conta: 'raidPontos', n, parte }); if (mvp) temporada.contar(u, { conta: 'mvp' }); } });
/* RUNNING SHOES (item_rules.mjs TENIS): players get them from Mom (side quest 9001 "A Letter Home", unlocked by mission 305,
   the Boulder Badge); GM accounts get them here on login. */
function darTenis(u, { avisar = true } = {}) {
  const c = contas[u]; if (!c) return false;
  if (!c.save) c.save = {};
  const s = c.save; if (!s.itens || typeof s.itens !== 'object') s.itens = {};
  if (+s.itens[RegrasItemS.TENIS] > 0) return false;
  s.itens[RegrasItemS.TENIS] = 1; c.rev = (c.rev || 0) + 1; salvarContas();
  if (avisar) for (const w of socketsDe(u)) enviar(w, { t: 'sistema', texto: "👟 Professor Oak's aide caught up with you: \"Brock's badge! The Professor wants you to have these.\" You got the Running Shoes! Hold Shift (or push the joystick all the way) to run.", bolsa: { dinheiro: s.dinheiro ?? 0, itens: s.itens, bolas: s.bolas || {} } });
  return true;
}
const batalha = criarBatalha({ contas, sessoes, conexoes, enviar, socketsDe, salvarContas, aplicarEvento, enviarMissao, aoMudarCampeao: (novo, velho) => trocouCampeao(novo, velho), contarTemporada: (u, ev) => temporada.contar(u, ev), darTenis: u => darTenis(u),
  /* bosses (boss_rules.mjs): the catch after a Pokémon boss falls uses the same individual, Pokédex mark, Box rule and ball bonus as the wild */
  novoIndividuo: individuoServidor, marcarPego, gameConfig: () => cfgJogo(), bolaBonus: (id, w, u) => world.ballBonus(id, w, u),
  aoCapturar: (ws, u, pk, bola) => { temporada.contar(u, { conta: 'captura', dex: pk.dex, shiny: !!pk.shiny, bola }); const r = aplicarEvento(u, { tipo: 'captura', dex: pk.dex }); if (r) enviarMissao(ws, r); } });
/* PP x5 (06/11, individual.mjs PP_MULT): o criarBatalha acabou de carregar o learnset; todo golpe gravado com o ppMax antigo sobe pro novo
   e o PP atual ganha a diferença (sem precisar do Centro). Idempotente: quem já está no valor atual fica igual. */
{
  let mons = 0;
  for (const c of Object.values(contas)) for (const p of [...(c?.save?.time || []), ...(c?.save?.caixa || [])]) if (ajustarPPMax(p)) mons++;
  if (mons) { console.log('[pp] ppMax atualizado em', mons, 'Pokémon'); salvarContas(); }
}
/* WARDROBE (server_wardrobe.mjs): the outfit/bag/effect catalog and who owns what. */
const guarda = createWardrobe({ dataDir: DADOS_PUB });
const bolsaServ = criarBolsa({ dadosPub: DADOS_PUB, salvar: salvarContas, bloquearCura: u => batalha.bloquearCura(u), eliteVencida: u => !!batalha.eliteDe(u)?.vencida, guarda });   // comprar / usar / descartar / held items (server_bag.mjs)
const mercado = criarMercado({ dados: DADOS, dadosPub: DADOS_PUB, contas, socketsDe, enviar, salvarContas, marcarPego, emLuta: u => batalha.emLuta(u) });
const carteira = criarCarteira();
const loja = criarLoja({ dadosPub: DADOS_PUB, contas, socketsDe, enviar, salvarContas, carteira, guarda });
const temporada = criarTemporada({ dadosPub: DADOS_PUB, contas, socketsDe, enviar, salvarContas, carteira, itemCatalog: catalogoItens, nomeItem });
const wilds = criarWilds({
  dir: __dir, contas, enviar, salvarContas, modelos: modelosMon,
  surto: (mapa, area, agua) => surtos?.rolar(mapa, area, agua) || null,   // mass outbreaks (server_outbreaks.mjs)
  expMult: () => eventos.efetivo().expMult,
  aoDerrotar: (u, ev) => temporada.contar(u, { conta: 'ko', ...ev }),
});
/* ACHIEVEMENTS (server_progression.mjs): every event the season pass counts also counts here. */
const progressao = createProgression({ accounts: contas, send: enviar, socketsOf: socketsDe, saveAccounts: salvarContas, dataDir: DADOS_PUB, wallet: carteira });
{ const contarTemporada = temporada.contar; temporada.contar = (u, ev) => { try { contarTemporada(u, ev); } finally { progressao.count(u, ev); } }; }
/* ITEM DROPS (server_drops.mjs + drop.mjs, rules public/data/drops.json): trainers, gyms, missions, the Elite Four and raids
   come through the counter events; wild KOs come from the shared world (onKO). */
const drops = createDrops({ accounts: contas, dataDir: DADOS_PUB, send: enviar, socketsOf: socketsDe, saveAccounts: salvarContas });
const diario = createDaily({ accounts: contas, send: enviar, socketsOf: socketsDe, saveAccounts: salvarContas,   // daily login rewards (7-day streak, free + premium)
  readJson: nome => lerJson(nodePath.join(__dir, 'public/data/' + nome + '.json'), null), isBall: k => catalogoItens().items[String(k)]?.t === 7 });
const social = createSocial({ accounts: contas, send: enviar, socketsOf: socketsDe, saveAccounts: salvarContas, isMuted: u => !!(contas[u]?.mudoAte && contas[u].mudoAte > Date.now()) });
const grupo = createParty({ accounts: contas, send: enviar, socketsOf: socketsDe, connections: () => conexoes.values(), nick: u => contas[u]?.save?.nome || u,
  extra: { mestre: u => progressao.masterLevel(u), saber: s => { const k = knowledgeSummary(s); return { mestres: k.masters, estudadas: k.studied }; } } });   // Inspect: their Master level and Pokédex knowledge
let especiesStaff = null, especiesStaffEm = 0;   // species with a model (pmDDDD_00.glb): the staff follower picker
const staff = createStaff({ accounts: contas, send: enviar, broadcastMapa: (ws, m) => broadcast(ws, m),   // in-game staff tools (server_staff.mjs)
  especies: () => {
    if (!especiesStaff || Date.now() - especiesStaffEm > 60e3) {
      try { especiesStaff = fs.readdirSync(nodePath.join(CENARIO_PUB, 'mon')).map(f => /^pm(\d{4})_00\.glb$/.exec(f)).filter(Boolean).map(x => +x[1]).filter(n => n > 0).sort((a, b) => a - b); } catch { especiesStaff = []; }
      especiesStaffEm = Date.now();
    }
    return especiesStaff;
  } });
const viagem = createTravel({ accounts: contas, send: enviar, cfg: () => cfgJogo(), saveAccounts: () => salvarContas(),   // fast travel: Teleport + Fly between Centers (server_travel.mjs)
  readJson: nome => lerJson(nodePath.join(__dir, 'public/data/' + nome + '.json'), null), emLuta: ws => { try { return !!batalha.emLuta(ws._usuario); } catch { return false; } } });
const troca = createTrade({ accounts: contas, send: enviar, saveAccounts: () => salvarContas(), conexoes,
  usuarioDe: ws => sessoes.get(ws._info?.token) || null, nomeDe: ws => ws._info?.nome || ws._usuario || 'Trainer',
  emLuta: ws => { try { return !!batalha.emLuta(ws._usuario); } catch { return false; } } });
const balsa = createFerry({ accounts: contas, send: enviar, readJson: nome => lerJson(nodePath.join(__dir, 'public/data/' + nome + '.json'), null) });   // the Vermilion ferry (server_ferry.mjs)
const caca = createHunt({ accounts: contas, send: enviar, socketsOf: socketsDe, saveAccounts: salvarContas, gameConfig: () => cfgJogo() });   // hunt bonus: Coins per wild KO from a daily pool
{ const contarAntes = temporada.contar; temporada.contar = (u, ev) => {
  try { contarAntes(u, ev); } finally {
    try {
      if (ev?.conta === 'treinador') drops.roll(u, { fonte: 'treinador', chave: ev.chave });
      else if (ev?.conta === 'ginasio') drops.roll(u, { fonte: 'ginasio', chave: ev.chave, primeira: !!ev.primeira, revanche: !!ev.revanche });
      else if (ev?.conta === 'elite') drops.roll(u, { fonte: 'elite', chave: 'elite' });
      else if (ev?.conta === 'historia') drops.roll(u, { fonte: 'missao' });
      else if (ev?.conta === 'raidPontos') drops.roll(u, { fonte: 'raid', contribuicao: +ev.parte || 0 });
    } catch (e) { console.warn('[drops]', e.message); }
  } }; }
/* RANKINGS (server_ranking.mjs): GET /ranking, /ranking/eu; weekly lists reset on Monday 00:00 UTC. */
const ranking = createRanking({ accounts: contas, progression: progressao, dataDir: DADOS_PUB, serverDir: DADOS, saveAccounts: salvarContas,
  send: enviar, socketsOf: socketsDe, isBanned: c => !!banidoAteDe(c), logAdmin });
{ const contarAntes = temporada.contar; temporada.contar = (u, ev) => { try { contarAntes(u, ev); } finally { ranking.count(u, ev); } }; }
/* MAIL (server_mail.mjs): letters on the account, opened from the HUD's Mail shortcut. */
const mail = createMail({
  accounts: contas, send: enviar, socketsOf: socketsDe, saveAccounts: salvarContas, wallet: carteira, newIndividual: individuoServidor, markCaught: marcarPego,
  online: () => [...conexoes.values()].map(w => w._usuario).filter(Boolean), dataDir: DADOS_PUB, serverDir: DADOS, saveWithBackup: gravarComBackup, logAdmin,
});
/* SHARED WORLD (server_world.mjs): the wild Pokémon live here, one set per map, and every player on the map sees them. */
const world = createWorld({
  surtoShiny: () => surtos?.bonusShiny() || 0,
  root: __dir, dataDir: DADOS_PUB, connections: conexoes, send: enviar, accounts: contas, wilds,
  newIndividual: individuoServidor, markCaught: marcarPego, saveAccounts: salvarContas, gameConfig: cfgJogo,
  onFish: (ws, u, f) => temporada.contar(u, { conta: 'pesca', dex: f.dex, nivel: f.nivel }),
  onKO: (u, ev) => { drops.roll(u, { fonte: 'selvagem', ...ev }); try { caca.ko(u, ev); } catch (e) { console.warn('caca', e); } },   // item drops (server_drops.mjs) + hunt bonus (server_hunt.mjs)
  onCatch: (ws, u, pk, bola, agua) => {
    temporada.contar(u, { conta: 'captura', dex: pk.dex, shiny: !!pk.shiny, bola, agua });
    const r = aplicarEvento(u, { tipo: 'captura', dex: pk.dex });
    if (r) enviarMissao(ws, r);
  },
});

function enviar(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
/* TERMS OF USE + PRIVACY POLICY (Nov 7): public/legal/terms.html and privacy.html; the version in public/data/legal.json (admin →
   Data files → Terms version). Sign-up needs the box ticked for the current version; an account whose accepted version is older
   gets `termosPendentes` at log-in and the game asks it to accept before playing. */
function termosAtuais() { const v = lerJson(nodePath.join(DADOS_PUB, 'legal.json'), {})?.versao; return v == null || v === '' ? null : String(v); }
const termosPendentesDe = c => { const v = termosAtuais(); return v && c && String(c.termos?.versao ?? '') !== v ? { termosPendentes: v } : {}; };
/* THE CHAMPION'S CROWN (Nov 6): only the player holding the Champion's seat (server_battle.mjs) shows "👑 Indigo League Champion" (Kanto and Johto share the Indigo League)
   under their name, over whatever title they picked; losing the seat gives their own title back. */
const TITULO_CAMPEAO = '👑 Indigo League Champion';
function aplicarCoroa(ws) {
  if (!ws._info) return false;
  const antes = ws._info.titulo;
  if (ws._usuario && batalha?.campeaoUsuario?.() === ws._usuario) {
    if (ws._info.titulo !== TITULO_CAMPEAO) ws._tituloProprio = ws._info.titulo || '';
    ws._info.titulo = TITULO_CAMPEAO;
  } else if (ws._info.titulo === TITULO_CAMPEAO) ws._info.titulo = ws._tituloProprio || '';
  return antes !== ws._info.titulo;
}
function trocouCampeao(...usuarios) {
  for (const ws of conexoes.values()) {
    if (!usuarios.includes(ws._usuario) || !aplicarCoroa(ws)) continue;
    broadcast(ws, { t: 'titulo', id: ws._id, titulo: ws._info.titulo });
  }
}
let movesCriacaoCache = null;
const movesCriacao = () => movesCriacaoCache || (movesCriacaoCache = lerJson(nodePath.join(DADOS_PUB, 'moves.json'), {}));
/* DAY CARE AND BREEDING (server_breeding.mjs): two Pokémon at the Route 5 Day Care may make an Egg every 24 h; Eggs hatch in 2 h (1 h with the Medallion). */
const criacao = createBreeding({ dataDir: DADOS_PUB, accounts: contas, saveAccounts: salvarContas, send: enviar, socketsOf: socketsDe,
  newIndividual: individuoServidor, markCaught: marcarPego, gameConfig: cfgJogo, Ind: IndS, moveExists: id => !!movesCriacao()[id], log: (...a) => console.log('[daycare]', ...a.slice(1)) });
/* MASS OUTBREAKS (server_outbreaks.mjs): one route fills with one species for a while, with better shiny odds. */
var surtos = createOutbreaks({ dataDir: DADOS_PUB, habitats: () => lerJson(nodePath.join(DADOS_PUB, 'habitats.json'), null), send: enviar, taxaShiny,
  onMap: map => [...conexoes.values()].filter(w => w.readyState === 1 && w._usuario && String(w._mapa || 'kanto') === String(map)),
  areaName: a => (lerJson(nodePath.join(DADOS_PUB, 'kanto.json'), {})?.nomes || {})[a] || 'area ' + a, nomeDe: dex => NOME_ESPECIE.get(+dex) || null, clearArea: (m, a) => world.clearArea(m, a), log: (...a) => console.log('[outbreak]', ...a.slice(1)) });
/* ROAMING LEGENDARIES (server_roamers.mjs): one legendary at a time travels Kanto in plain sight; admin page "Roaming legendaries". */
const errantes = createRoamers({ world, dataDir: DADOS_PUB, stateFile: nodePath.join(DADOS, 'roamers_state.json'), send: enviar, connections: conexoes,
  habitats: () => lerJson(nodePath.join(DADOS_PUB, 'habitats.json'), null), log: (...a) => console.log('[roamers]', ...a.slice(1)) });
/* TRANSFORM (server_transform.mjs + transform.mjs): Ditto copies a nearby Pokémon for 30 min in the world. */
const transformacao = createTransform({
  accounts: contas, dataDir: DADOS_PUB, send: enviar, socketsOf: socketsDe, world, wilds, battle: batalha, saveAccounts: salvarContas,
  onMap: map => [...conexoes.values()].filter(w => w._mapa === map), broadcast: (ws, obj) => broadcast(ws, obj),
});

function broadcast(remetente, obj, soMesmoMapa = true) {
  const m = remetente._mapa;
  for (const ws of conexoes.values()) {
    if (ws === remetente) continue;
    if (soMesmoMapa && ws._mapa !== m) continue;
    enviar(ws, obj);
  }
}

function infoJogador(ws) {
  const i = ws._info || {};
  return { ...staff.info(ws), id: ws._id, nome: i.nome || ws._usuario || 'Jogador', cargo: null, titulo: i.titulo || '', x: i.x || 0, y: i.y || 0, z: i.z || 0, giro: i.giro || 0, anim: i.anim || 'Idle', ...(() => { const t = transformacao.shown(ws); return t ? { parceiro: t.glb, pshiny: t.shiny, transf: { dex: t.dex, nome: t.nome } } : { parceiro: i.parceiro || null, pshiny: !!i.shiny }; })(), montaria: i.montaria || null, personagem: i.personagem || null, px: i.px, pz: i.pz, pg: i.pg, pa: i.pa };
}

wss.on('connection', ws => {
  ws._id = String(proxId++);
  ws._mapa = 'kanto';
  ws._usuario = null;
  ws._info = null;
  conexoes.set(ws._id, ws);

  ws.on('message', raw => {
    if (raw && raw.length > 64 * 1024) return;                                  // nº20: mensagem gigante é ignorada (anti-amplificação)
    const agora = Date.now();                                                   // nº20: rate-limit por conexão (descarta o excedente de flood)
    if (!ws._rl || agora - ws._rl.t > 1000) ws._rl = { t: agora, n: 0 };
    if (++ws._rl.n > 120) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    switch (m.t) {
      case 'entrar': {
        if (ws._worldJoined) world.left(ws, ws._mapa);   // a second `entrar` on the same socket is a map change
        ws._mapa = m.mapa || 'kanto';
        ws._info = { ...m };
        const uTok = m.token ? sessoes.get(m.token) : null;
        if (uTok && banidoAteDe(contas[uTok])) { enviar(ws, { t: 'saia', motivo: 'suspensa', texto: 'Your account is suspended.' }); try { ws.close(); } catch {} return; }
        // A stale token must not fall through to a visitor: the visitor wears the player's look and dodges the one-session rule, so it shows up as a second copy of them.
        if (m.token && !uTok) { enviar(ws, { t: 'saia', motivo: 'sessao', texto: 'Your session expired. Log in again.' }); try { ws.close(); } catch {} return; }
        if (uTok && contas[uTok] && m.personagem != null){                    // the look the others see on join: only owned outfits/effects (server_bag validarPersonagem)
          const pv = bolsaServ.validarPersonagem(contas[uTok], m.personagem);
          ws._info.personagem = pv === null ? (contas[uTok].save?.personagem ?? null) : pv;
        }
        if (eventos.aoEntrar(ws, uTok)) return;                            // Fase 3: manutenção barra quem não é GM; senão manda o evento ao vivo
        moderacao.aoEntrar(ws, uTok);                                      // Fase 3: chegou onde o GM levou (posGm) → apaga
        if (uTok && contas[uTok]?.gm) darTenis(uTok, { avisar: false });   // GM accounts have everything; players get the Running Shoes from Mom (side quest 9001 "A Letter Home", after the Boulder Badge)
        if (uTok) for (const w of socketsDe(uTok)) {                       // sessão única, como em produção: a aba/aparelho anterior leva `saia` (não reconecta) e some do mapa dos outros — antes cada aba virava mais um boneco
          if (w === ws) continue;
          enviar(w, { t: 'saia', motivo: 'outro-lugar', texto: 'You logged in from somewhere else.' });
          conexoes.delete(w._id);
          broadcast(w, { t: 'saiu', id: w._id });
          setTimeout(() => { try { w.close(); } catch {} }, 300);
        }
        ws._usuario = uTok || ('Visitante' + ws._id);                    // identidade só do token; sem conta = Visitante (nunca o nome do cliente)
        if (ws._info) ws._info.nome = (uTok && contas[uTok]?.save?.nome) || ws._usuario;   // nome na cabeça/chat vem da CONTA
        aplicarCoroa(ws);                                                   // the reigning Champion wears the crown title
        if (uTok) gravarPosConta(uTok, { mapa: ws._mapa, x: m.x, y: m.y, z: m.z, giro: m.giro, chegada: m.chegada }, { porta: !!m.porta && !!m.chegada, ja: true });

        const outros = [];
        for (const [id, other] of conexoes) {
          if (id === ws._id || !other._info || other._mapa !== ws._mapa) continue;
          outros.push(infoJogador(other));
        }
        enviar(ws, { t: 'bemvindo', id: ws._id, jogadores: outros, selvagens: world.list(ws._mapa), online: conexoes.size, conta: ws._usuario, ...(ws._usuario && contas[ws._usuario] ? { correio: mail.unread(ws._usuario), caca: caca.vista(ws._usuario), caixaVagas: CaixaR.vagas(contas[ws._usuario].save, cfgJogo()), transformLigado: !!cfgJogo().transformLigado || !!contas[ws._usuario].gm } : {}), versao: VERSAO_REDE, soloWilds: false, ...raid.bemvindo(ws) });   // dev local não tem servidor de mundo: o cliente nasce os selvagens sozinho (batalha/captura locais). Raid: na arena o participante liga o Mundo só com o chefe
        if (ws._usuario && contas[ws._usuario]) setTimeout(() => { try { diario.login(ws._usuario, ws); } catch (e) { console.warn('daily:', e.message); } }, 4000);   // today's daily prize (once a day), after the world has loaded
        if (uTok && contas[uTok]) enviar(ws, { t: 'elite', ...batalha.eliteDe(uTok) });
        broadcast(ws, { t: 'entrou', jogador: infoJogador(ws) });
        transformacao.joined(ws);                                         // a Ditto that can't stay transformed changes back
        ws._worldJoined = true; world.joined(ws);
        if (ws._usuario) try { criacao.aoEntrar(ws._usuario, ws); surtos.aoEntrar(ws); } catch (e) { console.warn('daycare/outbreak', e); }   // Eggs that hatched while away; an outbreak in progress                           // shared world: wilds nobody owns on this map go to this player
        staff.aoEntrar(ws);                                                // staff: the ★ Staff button's state (server_staff.mjs)
        raid.aoEntrar(ws);                                                 // retrato da raid logo depois do bem-vindo (+ ida pendente / volta que não chegou)
        // Envia estado de missões logo após bemvindo
        const uM = sessoes.get(m.token) || null;
        if (uM && contas[uM]) {
          const estM = missaoEstadoDe(uM);
          if (estM.atual) enviar(ws, { t: 'missao', estado: estM });
        }
        console.log(`[+] ${ws._usuario} joined ${ws._mapa} (${conexoes.size} online)`);
        break;
      }

      case 'ping':
        enviar(ws, { t: 'pong', hora: m.hora });
        break;

      case 'wild_roll':
        wilds.roll(ws, m);
        break;

      case 'wild_drop':
        wilds.drop(ws, m);
        break;

      case 'wild_defeat':
        wilds.defeat(ws, m);
        break;

      case 'pos':
        if (ws._info) { ws._info.x = m.x; ws._info.y = m.y; ws._info.z = m.z; ws._info.giro = m.giro; ws._info.anim = m.anim; if (m.px != null) { ws._info.px = m.px; ws._info.pz = m.pz; ws._info.pg = m.pg; ws._info.pa = m.pa; } }
        if (ws._usuario && contas[ws._usuario]){
          const agoraPos = Date.now();
          const porta = !!(+m.porta && +m.chegada > 0);
          if (porta || !ws._posGravadaEm || agoraPos - ws._posGravadaEm > 2500){
            ws._posGravadaEm = agoraPos;
            gravarPosConta(ws._usuario, { mapa: ws._mapa, x: m.x, y: m.y, z: m.z, giro: m.giro, ...(porta ? { chegada: +m.chegada } : {}) }, { porta });
          }
        }
        broadcast(ws, { t: 'pos', id: ws._id, x: m.x, y: m.y, z: m.z, giro: m.giro, anim: m.anim, px: m.px, pz: m.pz, pg: m.pg, pa: m.pa });
        break;

      case 'parceiro': {
        const uidAntes = ws._info?.uid ?? null;
        if (ws._info) { ws._info.parceiro = m.parceiro; ws._info.shiny = m.shiny ?? m.pshiny; ws._info.montaria = m.montaria; if (m.uid !== undefined) ws._info.uid = m.uid; }
        if (uidAntes != null && String(uidAntes) !== String(ws._info?.uid ?? '')) transformacao.partnerChanged(ws, uidAntes);   // swapped out: the Ditto changes back
        const tv = transformacao.shown(ws);
        broadcast(ws, { t: 'parceiro', id: ws._id, parceiro: tv?.glb || m.parceiro, pshiny: tv ? tv.shiny : !!(m.shiny ?? m.pshiny), montaria: m.montaria, ...(tv ? { transf: { dex: tv.dex, nome: tv.nome } } : {}) });
        break;
      }
      case 'transformar': case 'destransformar':   // Transform (server_transform.mjs); off for players until Game settings → Transform is on
        if (m.t === 'transformar' && !cfgJogo().transformLigado && !contas[ws._usuario]?.gm) { enviar(ws, { t: 'transf', ok: false, texto: "Transform isn't ready yet." }); break; }
        transformacao.receive(ws, m);
        break;

      case 'personagem': {
        const cP = contas[ws._usuario];
        const pers = cP ? bolsaServ.validarPersonagem(cP, m.personagem) : m.personagem;   // visitors have no shop: only accounts are checked
        if (pers === null && m.personagem != null) { enviar(ws, { t: 'sistema', texto: "That outfit isn't yours yet: get it in the Wardrobe." }); break; }
        if (ws._info) ws._info.personagem = pers;
        broadcast(ws, { t: 'personagem', id: ws._id, personagem: pers });
        break;
      }

      case 'titulo': {
        const titulo = String(m.titulo ?? '').slice(0, 40);                     // nº19: título é string livre espalhada a todos — limita o tamanho
        if (titulo === TITULO_CAMPEAO) break;                                // nobody picks the crown: the server gives it
        ws._tituloProprio = titulo;
        if (ws._info) ws._info.titulo = titulo;
        aplicarCoroa(ws);
        broadcast(ws, { t: 'titulo', id: ws._id, titulo: ws._info?.titulo ?? titulo });
        break;
      }

      case 'chat': {
        const texto = String(m.texto ?? '').slice(0, 240);                // corta no servidor (o cliente dizia 240, mas por WS dava pra furar)
        if (!texto.trim()) break;
        const c = contas[ws._usuario];                                    // conta logada (Visitante não tem)
        if (c?.mudoAte > Date.now()) { enviar(ws, { t: 'sistema', texto: '🔇 You are muted until ' + new Date(c.mudoAte).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + '.' }); break; }
        const nome = c?.save?.nome || ws._usuario || 'Player';           // character name, not the login
        const cargo = c?.cargo || null;                                   // [STAFF]/[MOD] pros outros verem
        if (temLink(texto) && !podeLink(cargo)) { enviar(ws, { t: 'sistema', texto: AVISO_LINK }); break; }   // the client blocks it too; this stops a hand-made WS message
        broadcast(ws, { t: 'chat', canal: m.canal || 'local', texto, de: { nome, cargo, id: ws._id } }, m.canal === 'local');   // id: the others draw the speech bubble over this player
        // sem "echo pra mim": o cliente já mostra a própria mensagem (publicar em chat.mjs) — reenviar duplicava
        break;
      }

      case 'party':
      case 'tm_montar': case 'tm_ensinar': case 'tm_tutor': {   // TM counter / teach / tutor (tm_ui.mjs → server_bag.mjs tmProtocolo)
        const uTm = sessoes.get(ws._info?.token) || ws._usuario, cTm = uTm && contas[uTm];
        if (!cTm) { enviar(ws, { t: 'tm', op: m.t.slice(3), ok: false, erro: 'TMs need an account.' }); break; }
        if (!cTm.save) cTm.save = {};
        const r = bolsaServ.tmProtocolo(cTm, m);
        if (!r) break;
        enviar(ws, { t: 'bolsa', op: 'tm', bolsa: r.bolsa, ...(r.vidas ? { vidas: r.vidas } : {}) });
        enviar(ws, r.tm);
        break;
      }
      case 'arranjo': {
        const uArr = sessoes.get(ws._info?.token) || ws._usuario;
        const cArr = uArr && contas[uArr];
        if (cArr && m.held && typeof m.held === 'object') {   // held_ui.mjs: give / swap / take a held item (server_bag.mjs segurar / tirar)
          if (!cArr.save) cArr.save = {};
          const h = m.held, tirar = h.item == null;
          const r = bolsaServ.tratar(cArr, tirar ? 'tirar' : 'segurar', { uid: h.uid, item: h.item, preso: h.preso }, uArr);
          if (r?.erro) { enviar(ws, { t: 'bolsa_erro', op: 'segurar', ...r }); enviar(ws, { t: 'held_erro', uid: h.uid, motivo: r.erro }); break; }
          enviar(ws, { t: 'bolsa', op: tirar ? 'tirar' : 'segurar', ...r });
          const pv = r?.vidas?.[0];
          enviar(ws, { t: 'held_ok', uid: h.uid, held: pv?.held ? (typeof pv.held === 'object' ? pv.held : { id: pv.held }) : null });
          break;
        }
        if (cArr) {
          if (!cArr.save) cArr.save = {};
          if (applyPartyOrder(cArr, m)) {
            marcarPegoDoTime(cArr);
            cArr.rev = (cArr.rev || 0) + 1;
            salvarContas();
            // batched party sync (account.mjs, protocol 22+): confirm the batch so the client stops resending it
            if (Number.isSafeInteger(m.seq)) enviar(ws, { t: 'arranjo_ok', seq: m.seq });
          }
        }
        break;
      }

      // account.mjs manda uma pref por vez ({ t: 'pref', chave, valor }) e o conhecimento à parte; sem estes casos
      // o switch descartava as duas e o atalho/seguidor só sobrevivia ao F5 se o envio caísse no HTTP do pagehide
      case 'pref': {
        const uPref = sessoes.get(ws._info?.token) || ws._usuario;
        const cPref = uPref && contas[uPref];
        if (cPref && typeof m.chave === 'string' && PREFS_OK.has(m.chave)) {
          if (!cPref.save) cPref.save = {};
          aplicarPrefs(cPref, { [m.chave]: m.valor });
          cPref.rev = (cPref.rev || 0) + 1;
          salvarContas();
        }
        break;
      }
      case 'conhecimento': {
        const uCon = sessoes.get(ws._info?.token) || ws._usuario;
        const cCon = uCon && contas[uCon];
        if (cCon) {
          if (!cCon.save) cCon.save = {};
          aplicarDexConhecimento(cCon, m);                       // dex só ganha 'visto' do cliente; o registro de conhecimento só sobe
          cCon.rev = (cCon.rev || 0) + 1;
          salvarContas();
        }
        break;
      }

      // Client intents: party order, preferences, knowledge
      case 'save': {
        const u = (sessoes.get(ws._info?.token) || null);
        if (u && contas[u]) {
          const c = contas[u];
          if (!c.save) c.save = {};
          if (m.party || m.arranjo) applyPartyOrder(c, m.party || m.arranjo);   // party order plus field experience; `arranjo` is the old message name
          aplicarPrefs(c, m.prefs);                       // só as chaves permitidas (nunca dinheiro/itens/bolas)
          aplicarDexConhecimento(c, m);                       // dex só ganha 'visto' do cliente; o registro de conhecimento só sobe
          marcarPegoDoTime(c);
          c.rev = (c.rev || 0) + 1;
          salvarContas();
        }
        break;
      }

      // ── Missões ──────────────────────────────────────────────────────────
      case 'missao_falar': {
        const uF = sessoes.get(ws._info?.token) || null;
        const est1 = uF ? missaoEstadoDe(uF) : null;
        console.log(`[mission_talk] user=${uF} cfg=${m.cfg} current_step=${JSON.stringify(est1 ? MISSOES[est1.atual]?.passos?.[est1.passo] : null)}`);
        if (uF) enviarMissao(ws, aplicarEvento(uF, { tipo: 'falar', cfg: m.cfg }));
        break;
      }
      case 'missao_area': {
        const uA = sessoes.get(ws._info?.token) || null;
        ws._areaId = m.area ?? null;                                      // onde está agora (passo 'ir' que vira o atual com a pessoa já lá)
        const est2 = uA ? missaoEstadoDe(uA) : null;
        console.log(`[mission_area] user=${uA} area=${m.area} current_step=${JSON.stringify(est2 ? MISSOES[est2.atual]?.passos?.[est2.passo] : null)}`);
        if (uA) enviarMissao(ws, aplicarEvento(uA, { tipo: 'area', area: m.area }));
        break;
      }
      case 'missao_treinador': {
        const uT = sessoes.get(ws._info?.token) || null;
        const jaContou = uT && lutaVenceu.get(uT);
        if (jaContou && jaContou.cfg === String(m.cfg) && Date.now() - jaContou.t < 120e3) { lutaVenceu.delete(uT); break; }   // the server battle already counted this win
        if (uT) enviarMissao(ws, aplicarEvento(uT, { tipo: 'treinador', cfg: m.cfg, area: m.area }));
        break;
      }
      case 'missao_selvagem': {
        const uS = sessoes.get(ws._info?.token) || null;
        if (uS) enviarMissao(ws, aplicarEvento(uS, { tipo: 'selvagem', dex: m.dex, area: m.area }));
        break;
      }
      case 'missao_captura': {
        const uC2 = sessoes.get(ws._info?.token) || null;
        if (uC2) enviarMissao(ws, aplicarEvento(uC2, { tipo: 'captura', dex: m.dex }));
        break;
      }
      case 'missao_inicial': {
        const uI = sessoes.get(ws._info?.token) || null;
        if (uI) enviarMissao(ws, aplicarEvento(uI, { tipo: 'inicial' }));
        break;
      }
      case 'missao_cura': {
        const uCr = sessoes.get(ws._info?.token) || null;
        if (uCr) enviarMissao(ws, aplicarEvento(uCr, { tipo: 'cura', cfg: m.cfg }));
        break;
      }
      case 'missao_nivel': {
        const uN = sessoes.get(ws._info?.token) || null;
        if (uN) enviarMissao(ws, aplicarEvento(uN, { tipo: 'nivel', lv: m.lv }));
        break;
      }
      case 'missao_insignia': {
        const uIg = sessoes.get(ws._info?.token) || null;
        if (uIg) enviarMissao(ws, aplicarEvento(uIg, { tipo: 'insignia', id: m.id, numero: m.numero }));
        break;
      }
      case 'missao_doar': {   // hand Pokémon over to an NPC for a `doar` step (side_quests_ui.mjs → 'Hand over a Pokémon')
        const uD = sessoes.get(ws._info?.token) || null;
        if (!uD) break;
        const rD = doarPokemon(uD, m.missao, m.uids);
        if (rD.erro) { enviar(ws, { t: 'missao_erro', op: 'doar', erro: rD.erro }); break; }
        const cD = contas[uD];
        for (const w of socketsDe(uD)) enviar(w, { t: 'save', save: cD.save, rev: cD.rev });
        enviar(ws, { t: 'missao', op: 'doar', estado: rD.estado, uids: rD.uids, passoFeito: !!rD.resultado?.passoFeito && !rD.resultado?.concluida });
        if (rD.resultado?.concluida) enviarMissao(ws, rD.resultado);
        break;
      }
      case 'missao_abandonar': {
        const uAb = sessoes.get(ws._info?.token) || null;
        if (!uAb) break;
        const rAb = abandonarLateral(uAb, m.id);
        if (!rAb.ok) { enviar(ws, { t: 'missao_erro', op: 'abandonar', erro: rAb.erro }); break; }
        enviar(ws, { t: 'missao', op: 'abandonar', estado: rAb.estado, abandonou: m.id });
        break;
      }
      case 'missao_escolher': {
        const uEs = sessoes.get(ws._info?.token) || null;
        if (!uEs) break;
        const rEs = escolherNaMissao(uEs, m.missao, m.chave, m.opcao);
        if (rEs.erro) { enviar(ws, { t: 'missao_erro', op: 'escolher', erro: rEs.erro }); break; }
        if (rEs.dado) { const cEs = contas[uEs]; for (const w of socketsDe(uEs)) enviar(w, { t: 'save', save: cEs.save, rev: cEs.rev }); }
        enviar(ws, { t: 'missao', op: 'escolher', estado: rEs.estado, escolheu: m.opcao });
        if (rEs.resultado) enviarMissao(ws, rEs.resultado);
        break;
      }
      case 'missao_aceitar': {
        const uAc = sessoes.get(ws._info?.token) || null;
        if (!uAc) break;
        const rAc = aceitarLateral(uAc, m.id);
        enviar(ws, { t: 'missao', op: rAc.ok ? 'aceitar' : undefined, estado: rAc.estado || missaoEstadoDe(uAc), aceitou: rAc.ok ? m.id : null, erro: rAc.erro || null, nome: (LATERAIS[m.id] || LATERAIS[+m.id])?.nome || null });
        break;
      }

      // ── Posse de Pokémon (captura, soltar, etc.) ─────────────────────────
      default: {
        if (m.t?.startsWith('posse_')) {
          const op = m.t.slice(6);
          const u = sessoes.get(ws._info?.token) || null;
          const c = u ? contas[u] : null;

          if (op === 'inicial' && m.mon && c) {
            if (!inicialOk(m.mon.dex)) { enviar(ws, { t: 'posse_erro', op, erro: 'invalid starter' }); return; }
            if (!c.save) c.save = {};
            if (!Array.isArray(c.save.time)) c.save.time = [];
            const jaEscolheu = c.save.time.some(p => p.inicial);
            if (jaEscolheu) {
              enviar(ws, { t: 'posse_erro', op, erro: 'starter already chosen' });
            } else {
              const uid = String(Date.now()) + String(Math.floor(Math.random() * 9999)).padStart(4, '0');
              const ivs = ivsNovos();
              const naturezas = ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'];
              const natureza = naturezas[Math.floor(Math.random() * naturezas.length)];
              const shiny = Math.random() < 1 / taxaShiny();
              const pk = { ...m.mon, uid, lv: 5, ivs, evs: [0, 0, 0, 0, 0, 0], natureza, shiny, inicial: true };
              c.save.time.unshift(pk);
              c.save.inicial = { dex: m.mon.dex, glb: m.mon.glb, nome: m.mon.nome, i: m.i ?? 0 };
              marcarPego(c, pk.dex);                    // nº15: inicial marca 'pego' na Pokédex (servidor)
              marcarPegoDoTime(c);
              c.rev = (c.rev || 0) + 1;
              salvarContas();
              enviar(ws, { t: 'posse', op, mon: pk, vidas: c.save.time });
              const rI = aplicarEvento(u, { tipo: 'inicial' });
              if (rI) enviarMissao(ws, rI);
            }
          } else if (op === 'capturar' && m.pokemon && c) {
            if (!especieValida(m.pokemon.dex)) { enviar(ws, { t: 'posse_erro', op, erro: 'invalid species' }); return; }   // nº14 (stopgap): recusa dex que não existe
            if (!c.save) c.save = {};
            if (!Array.isArray(c.save.time)) c.save.time = [];
            if (!Array.isArray(c.save.caixa)) c.save.caixa = [];
            if (!CaixaR.cabe(c.save, cfgJogo())) { enviar(ws, { t: 'posse_erro', op, erro: CaixaR.aviso(c.save, cfgJogo()) }); return; }   // full team + full Box
            const pk = individuoServidor(m.pokemon);   // IVs/natureza/shiny e nível decididos pelo SERVIDOR (não confia no cliente)
            if (c.save.time.length < 6) c.save.time.push(pk);
            else c.save.caixa.push(pk);
            marcarPego(c, pk.dex);                      // nº15: quem marca 'pego' na Pokédex é o servidor
            c.rev = (c.rev || 0) + 1;
            salvarContas();
            enviar(ws, { t: 'posse', op, pokemon: pk, vidas: c.save.time });
            // Dispara evento de missão de captura
            temporada.contar(u, { conta: 'captura', dex: pk.dex, shiny: !!pk.shiny });
            const rC = aplicarEvento(u, { tipo: 'captura', dex: m.pokemon?.dex });
            if (rC) enviarMissao(ws, rC);
          } else if (op === 'soltar' && m.uid && c?.save) {
            c.save.time = (c.save.time || []).filter(p => p.uid !== m.uid);
            c.save.caixa = (c.save.caixa || []).filter(p => p.uid !== m.uid);
            c.rev = (c.rev || 0) + 1;
            salvarContas();
            enviar(ws, { t: 'posse', op, uid: m.uid, vidas: c.save.time });
          } else if (op === 'evoluir' && m.uid != null && c?.save) {
            const r = evoluirNoServidor(c, m.uid, m.item ?? null, Number.isFinite(+m.area) ? +m.area : null, Number.isFinite(+m.para) ? +m.para : null);
            if (r.erro) { enviar(ws, { t: 'posse_erro', op, erro: r.erro }); return; }
            temporada.contar(u, { conta: 'evolucao', dex: r.pk.dex });
            c.rev = (c.rev || 0) + 1;
            salvarContas();
            enviar(ws, { t: 'posse', op, uid: r.pk.uid, dex: r.pk.dex, glb: r.pk.glb, nome: r.pk.nome,
              ...(r.consumiu ? { bolsa: { dinheiro: c.save.dinheiro ?? 0, itens: c.save.itens, bolas: c.save.bolas } } : {}) });
          } else {
            enviar(ws, { ...m, t: 'posse', op });                 // eco: o `t` vem DEPOIS do ...m (antes o 'posse_<op>' do pedido sobrescrevia e o cliente esperava até o timeout)
          }
        }

        else if (m.t?.startsWith('mercado_')) mercado.receber(ws, sessoes.get(ws._info?.token) || null, m);
        else if (m.t === 'loja_ver' || m.t === 'loja_comprar') loja.receber(ws, sessoes.get(ws._info?.token) || null, m);
        else if (m.t === 'temporada') temporada.receber(ws, sessoes.get(ws._info?.token) || null, m);
        else if (m.t === 'diario_ver' || m.t === 'diario_receber') diario.receber(ws, sessoes.get(ws._info?.token) || null, m);
        else if ((m.t?.startsWith('grupo_') || m.t === 'inspecionar') && grupo.receber(ws, sessoes.get(ws._info?.token) || null, m)) {}   // party + Inspect (server_party.mjs)
        else if (m.t === 'social_pedir') { const uS = sessoes.get(ws._info?.token) || null; const r = uS ? social.request(uS, m.to) : { erro: 'Friends need an account.' }; enviar(ws, { t: 'sistema', texto: r.erro ? '🤝 ' + r.erro : r.friends ? '🤝 You and ' + r.nick + ' are now friends.' : r.ja ? '🤝 You already asked ' + r.nick + '.' : '📨 Friend request sent to ' + r.nick + '.' }); }
        else if (m.t === 'balsa_vista' || m.t === 'balsa') balsa.receber(ws, sessoes.get(ws._info?.token) || null, m);
        else if (m.t === 'viagem_vista' || m.t === 'teleporte' || m.t === 'viagem' || m.t === 'centro_visitado') viagem.receber(ws, sessoes.get(ws._info?.token) || null, m);
        else if (m.t === 'staff') { if (staff.receber(ws, sessoes.get(ws._info?.token) || null, m)) salvarContas(); }

        else if (m.t?.startsWith('bolsa_')) {
          const op = m.t.slice(6);
          const u = sessoes.get(ws._info?.token) || null;
          const c = u ? contas[u] : null;
          // bolsa_missao: paga recompensa da missão concluída
          if (op === 'missao' && m.missao && c) {
            const pg = pagarMissao(u, m.missao);                           // já pago na conclusão (enviarMissao): aqui vira só uma conferência
            if (pg?.xp) enviar(ws, pg.xp);
            enviar(ws, { t: 'bolsa', op, bolsa: { dinheiro: c.save?.dinheiro, itens: c.save?.itens, bolas: c.save?.bolas } });
          } else {
            if (op === 'safari' && ws._info) { m.x = ws._info.x; m.z = ws._info.z; }   // the warden check uses the walked position, not the one in the message
            const rb = c ? bolsaServ.tratar(c, op, m, u) : null;          // comprar / usar / descartar / segurar / tirar / consumir / safari
            const extra = rb || (c && batalha.bolsa(ws, op, m));
            if (op === 'safari' && rb?.pouso && u && contas[u] && !contas[u].posGm && ws._mapa) {
              const limpo = posLimpa({ mapa: ws._mapa, x: rb.pouso.x, y: ws._info?.y || 0, z: rb.pouso.z, giro: 0 }, ws._mapa);
              if (limpo) { contas[u].pos = limpo; salvarContas(); }       // the gate is farther than a walk; no door id, so a refresh is not a door landing
            }
            if (rb?.erro) enviar(ws, { t: 'bolsa_erro', op, ...rb });       // carries the bag snapshot: undoes what the client took off locally
            else if (extra) enviar(ws, { t: 'bolsa', op, ...extra });
            else enviar(ws, { t: 'bolsa', op, bolsa: c?.save ? { dinheiro: c.save.dinheiro ?? 0, bolas: c.save.bolas, itens: c.save.itens, insignias: c.save.insignias } : null });
          }
        }

        else if (m.t === 'vida_curar') {
          const u = sessoes.get(ws._info?.token) || null;
          if (u && batalha.bloquearCura(u)) { enviar(ws, { t: 'vida_erro', erro: 'no healing in the Elite Four: the five fights are one run' }); break; }
          if (ws._ultCura && Date.now() - ws._ultCura < 2000) break;      // anti-flood (prod: exigir estar num Centro Pokémon)
          ws._ultCura = Date.now();
          const c = u ? contas[u] : null;
          let vidas = null;
          if (c?.save?.time) {
            for (const p of c.save.time) healMon(p);
            vidas = c.save.time;
            c.rev = (c.rev || 0) + 1;
            salvarContas();
          }
          enviar(ws, { t: 'vida', vidas });
        }

        else if (m.t === 'vida_gm') {                                       // /pokeheal (02/11): GM cura time E caixa, em qualquer lugar
          const u = sessoes.get(ws._info?.token) || null, c = u ? contas[u] : null;
          if (!c?.gm) { enviar(ws, { t: 'vida_erro', erro: '/pokeheal is GM only' }); break; }
          if (!c.save) c.save = {};
          for (const p of [...(c.save.time || []), ...(c.save.caixa || [])]) healMon(p);
          c.rev = (c.rev || 0) + 1;
          salvarContas();
          logAdmin(u, u, 'pokeheal', { time: (c.save.time || []).length, caixa: (c.save.caixa || []).length });
          enviar(ws, { t: 'vida', vidas: c.save.time || [] });
        }

        else if (m.t?.startsWith('bat_')) {
          batalha.receber(ws, m);
        }

        else if (m.t === 'creche') { if (ws._usuario) enviar(ws, { t: 'creche', op: m.op, ...criacao.operar(ws._usuario, m) }); }   // Day Care (server_breeding.mjs)
        else if (m.t?.startsWith('troca_')) troca.receber(ws, m);   // the trade table (server_trade.mjs); it used to be echoed to the whole map

        else if (m.t === 'missao_passo') {
          enviar(ws, { t: 'missao', estado: m.estado });
        }

        else if (m.t === 'mod' || m.t?.startsWith('mod_')) moderacao.comando(ws, m);   // Fase 3: /online /ver /aviso /mudo /kick /banir /perdoar /tp /ir /puxar (o chat manda {t:'mod_<op>'})
        else if (m.t === 'raid_staff' || m.t === 'raid_entrar' || m.t === 'raid_sair' || m.t === 'raid_foco' || m.t === 'ataque' || m.t === 'r01' || m.t === 'r03' || m.t === 'raid_desmaio') { raid.receber(ws, m); if (m.t === 'ataque') world.receive(ws, m); }   // a raid boss id only matches the raid; any other id is a shared-world wild
        else if (m.t === 'progressao_vista' || m.t === 'progressao_resgatar' || m.t === 'progressao_titulo') progressao.receive(ws, sessoes.get(ws._info?.token) || ws._usuario, m);
        else if (m.t === 'correio_listar' || m.t === 'correio_ler' || m.t === 'correio_resgatar' || m.t === 'correio_apagar') mail.receive(ws, sessoes.get(ws._info?.token) || ws._usuario, m);
        else if (m.t === 'capturar' && raid.capturar(ws, m)) {}   // the raid boss's catch throw (server_raid.mjs); any other id is a shared-world wild
        else if (m.t === 'nascer' || m.t === 'spos' || m.t === 'sataque' || m.t === 'shp' || m.t === 'capturar' || m.t === 'pesca_lancar' || m.t === 'pesca_puxar' || m.t === 'pesca_largar') world.receive(ws, m);   // raid ao vivo (o `ataque` só existe com o Mundo ligado: o chefe)
        break;
      }
    }
  });

  ws.on('close', () => {
    try { batalha.aoSair(ws); } catch {}
    try { world.left(ws); } catch {}
    try { troca.saiu(ws); } catch {}
    if (ws._usuario && contas[ws._usuario] && ws._info) gravarPosConta(ws._usuario, { mapa: ws._mapa, x: ws._info.x, y: ws._info.y, z: ws._info.z, giro: ws._info.giro }, { ja: true });
    if (!conexoes.delete(ws._id)) return;                                 // já saiu da lista (sessão única) e o `saiu` já foi
    console.log(`[-] ${ws._usuario || ws._id} left (${conexoes.size} online)`);
    broadcast(ws, { t: 'saiu', id: ws._id });
  });

  ws.on('error', () => {});
});

httpServer.listen(+process.env.PORT || 5190, process.env.HOST || undefined, () => {   // HOST=127.0.0.1 behind a reverse proxy; unset = all interfaces (LAN dev)
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  PokeVerse — Dev Server            ║');
  console.log('║  HTTP + WebSocket on port 5190        ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
});
