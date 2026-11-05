/* Event schedule: the Events board's calendar (events_ui.mjs) and what starts on its own. Times are Pacific (calendar.mjs).
 *
 * public/data/agenda.json = { v, eventos: [evento] }, written by the panel's 📅 Event schedule screen (admin/schedule.mjs):
 *   { id, ligado, tipo: 'bonus'|'raid'|'festival'|'torneio'|'invasao'|'outro', titulo, descricao, destaque,
 *     pt: { titulo, descricao }                         Portuguese text (English is the source)
 *     quando: 'uma'   inicio, fim                        one time, ISO instants
 *     quando: 'semana' dias [0 = Sunday…6], horas ['HH:MM'], duracaoMin, desde?, ate?   every week, Pacific wall clock
 *     bonus: { xp, shiny, densidade }                    multipliers while it runs (stack with the live event)
 *     raid:  { filaMin }                                 the raid of data/raid.json: queue opens filaMin before, fight at the start }
 *
 * GET /events?from=YYYY-MM-DD&to=YYYY-MM-DD → { lista: [occurrence], v, agora }, one entry per occurrence:
 *   { id, tipo, titulo, descricao, tr, destaque, oc, fim, estado: 'agora'|'breve'|'encerrado', repete, regra, bonus, raid } */
import fs from 'node:fs';
import nodePath from 'node:path';
import * as Cal from './calendar.mjs';

const MIN = 60e3, DIA = 86400e3;
const TIPOS = ['bonus', 'raid', 'festival', 'torneio', 'invasao', 'outro'];
const MAX_EVENTOS = 100, MAX_JANELA_DIAS = 62;
const ms = iso => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null; };
const num = (v, min, max, pad) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pad; };
const texto = (v, n) => String(v ?? '').trim().slice(0, n);

export const PADRAO = {
  v: 1,
  eventos: [{
    id: 'double-exp-weekend', ligado: true, tipo: 'bonus', destaque: true,
    titulo: 'Double EXP Weekend', descricao: 'All wild EXP is doubled from Saturday 00:00 to Sunday 23:59 (Pacific time).',
    pt: { titulo: 'Fim de semana de EXP em dobro', descricao: 'Toda EXP de selvagem vale o dobro de sábado 00:00 a domingo 23:59 (horário do Pacífico).' },
    quando: 'semana', dias: [6], horas: ['00:00'], duracaoMin: 2880,
    bonus: { xp: 2, shiny: 1, densidade: 1 },
  }],
};

/** Validates one event from the panel. { v } or { erro }. */
export function limparEventoAgenda(e, i = 0) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { erro: `Event ${i + 1}: invalid format.` };
  const id = texto(e.id, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) return { erro: `Event ${i + 1}: give it an ID.` };
  const titulo = texto(e.titulo, 60);
  if (!titulo) return { erro: `${id}: give it a title.` };
  const tipo = TIPOS.includes(e.tipo) ? e.tipo : 'outro';
  const v = { id, ligado: e.ligado !== false, tipo, titulo, descricao: texto(e.descricao, 300), destaque: !!e.destaque };
  const pt = { titulo: texto(e.pt?.titulo, 60), descricao: texto(e.pt?.descricao, 300) };
  if (pt.titulo || pt.descricao) v.pt = pt;
  if (e.quando === 'semana') {
    const dias = [...new Set((Array.isArray(e.dias) ? e.dias : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    const horas = [...new Set((Array.isArray(e.horas) ? e.horas : []).map(String).filter(h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)))].sort();
    if (!dias.length) return { erro: `${id}: pick at least one day.` };
    if (!horas.length) return { erro: `${id}: give a start time (HH:MM).` };
    const dur = Math.round(num(e.duracaoMin, 1, 7 * 1440, NaN));
    if (!Number.isFinite(dur)) return { erro: `${id}: how many minutes does it last?` };
    Object.assign(v, { quando: 'semana', dias, horas, duracaoMin: dur });
    for (const k of ['desde', 'ate']) if (e[k]) { const t = ms(e[k]); if (t == null) return { erro: `${id}: invalid ${k} date.` }; v[k] = new Date(t).toISOString(); }
  } else {
    const a = ms(e.inicio), b = ms(e.fim);
    if (a == null) return { erro: `${id}: give a start date.` };
    if (b == null || b <= a) return { erro: `${id}: the end must be after the start.` };
    Object.assign(v, { quando: 'uma', inicio: new Date(a).toISOString(), fim: new Date(b).toISOString() });
  }
  /* Rates while it runs: required for a Bonus, optional for a Festival / Tournament / Invasion / Other (all ×1 = just a board entry). */
  if (tipo !== 'raid' && (tipo === 'bonus' || e.bonus)) {
    const b = e.bonus || {};
    const bonus = { xp: Math.round(num(b.xp, 1, 5, 1) * 100) / 100, shiny: Math.round(num(b.shiny, 1, 20, 1) * 100) / 100, densidade: Math.round(num(b.densidade, 0.25, 3, 1) * 100) / 100 };
    const neutro = bonus.xp === 1 && bonus.shiny === 1 && bonus.densidade === 1;
    if (neutro && tipo === 'bonus') return { erro: `${id}: a bonus needs EXP, shiny or wild above ×1.` };
    if (!neutro) v.bonus = bonus;
  }
  if (tipo === 'raid') {
    v.raid = { filaMin: Math.round(num(e.raid?.filaMin, 1, 120, 15)) };
    /* The raid's own boss (empty = data/raid.json): a daily rotation sets a different one per day. */
    const r = e.raid || {};
    if (/^\d{3,9}$/.test(String(r.arena ?? ''))) v.raid.arena = String(r.arena);
    if (texto(r.chefeNome, 30)) v.raid.chefeNome = texto(r.chefeNome, 30);
    if (Number.isFinite(+r.chefeDex) && +r.chefeDex >= 1 && +r.chefeDex <= 2000 && r.chefeDex !== '') v.raid.chefeDex = Math.round(+r.chefeDex);
    if (/^pm\d{4}(_\d{2})?$/.test(String(r.chefeGlb ?? ''))) v.raid.chefeGlb = String(r.chefeGlb);
    if (Number.isFinite(+r.chefeNivel) && +r.chefeNivel >= 1 && +r.chefeNivel <= 100 && r.chefeNivel !== '') v.raid.chefeNivel = Math.round(+r.chefeNivel);
    if (Number.isFinite(+r.lutaMin) && +r.lutaMin >= 1 && +r.lutaMin <= 30 && r.lutaMin !== '') v.raid.lutaMin = +r.lutaMin;
    if (v.raid.chefeDex && v.raid.chefeGlb && +v.raid.chefeGlb.slice(2, 6) !== v.raid.chefeDex) return { erro: `${id}: model ${v.raid.chefeGlb} is not species no. ${v.raid.chefeDex}.` };
  }
  { const t = ms(e.paradoEm); if (t != null) v.paradoEm = new Date(t).toISOString(); }   // "Stop now" from the panel: whatever was running at that moment ends there
  if (e.manual) v.manual = true;                                                          // made by "Start now" (one time, starts at the click)
  return { v };
}
export function limparAgenda(d) {
  const lista = Array.isArray(d?.eventos) ? d.eventos.slice(0, MAX_EVENTOS) : null;
  if (!lista) return { erro: 'Invalid format.' };
  const out = [], ids = new Set();
  for (const [i, e] of lista.entries()) {
    const r = limparEventoAgenda(e, i); if (r.erro) return r;
    if (ids.has(r.v.id)) return { erro: `Two events use the ID "${r.v.id}".` };
    ids.add(r.v.id); out.push(r.v);
  }
  return { v: { v: 1, eventos: out } };
}

/** Every occurrence of `e` that overlaps [de, ate). An occurrence that was running when "Stop now" was pressed ends at that moment. */
export function ocorrencias(e, de, ate) {
  const p = ms(e.paradoEm);
  const lista = ocorrenciasCruas(e, de, ate);
  return p == null ? lista : lista.map(o => (o.oc <= p && o.fim > p ? { oc: o.oc, fim: p } : o)).filter(o => o.fim > o.oc && o.fim > de);
}
function ocorrenciasCruas(e, de, ate) {
  if (!e.ligado) return [];
  if (e.quando !== 'semana') {
    const a = ms(e.inicio), b = ms(e.fim);
    return a != null && b > de && a < ate ? [{ oc: a, fim: b }] : [];
  }
  const out = [], dur = e.duracaoMin * MIN, desde = ms(e.desde), ateRegra = ms(e.ate);
  const p = Cal.partesPt(de - dur - DIA);
  for (let i = 0; ; i++) {
    const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia + i));
    const ano = d.getUTCFullYear(), mes = d.getUTCMonth() + 1, dia = d.getUTCDate();
    if (Cal.instantePt(ano, mes, dia) >= ate) break;
    if (!e.dias.includes(d.getUTCDay())) continue;
    for (const h of e.horas) {
      const oc = Cal.instantePt(ano, mes, dia, +h.slice(0, 2), +h.slice(3, 5));
      const f = new Date(Date.UTC(ano, mes - 1, dia, +h.slice(0, 2), +h.slice(3, 5)) + dur);   // wall clock: "until Monday 00:00" holds across a time change
      const fim = Cal.instantePt(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate(), f.getUTCHours(), f.getUTCMinutes());
      if (fim <= de || oc >= ate) continue;
      if (desde != null && oc < desde) continue;
      if (ateRegra != null && oc >= ateRegra) continue;
      out.push({ oc, fim });
    }
  }
  return out;
}

/** h = { dadosPub, conexoes, enviar, logAdmin, gravarComBackup, raid } (server.mjs). */
export function criarAgenda(h) {
  const { dadosPub, conexoes, enviar, logAdmin, gravarComBackup } = h;
  const ARQ = nodePath.join(dadosPub, 'agenda.json');
  let cache = { mtime: -2, v: PADRAO }, versao = 1;
  function ler() {
    let mt = -1;
    try { mt = fs.statSync(ARQ).mtimeMs; } catch {}
    if (mt === cache.mtime) return cache.v;
    let v = PADRAO;
    if (mt >= 0) {
      try { const r = limparAgenda(JSON.parse(fs.readFileSync(ARQ, 'utf8'))); if (r.v) v = r.v; else console.warn('[agenda] agenda.json:', r.erro); }
      catch (e) { console.warn('[agenda] agenda.json:', e.message); }
    }
    cache = { mtime: mt, v }; versao++;
    return v;
  }
  const estadoDe = (o, agora) => (agora >= o.fim ? 'encerrado' : agora >= o.oc ? 'agora' : 'breve');
  function lista(de, ate, agora = Date.now()) {
    const out = [];
    for (const e of ler().eventos) {
      for (const o of ocorrencias(e, de, ate)) {
        const r = {
          id: e.id, tipo: e.tipo, titulo: e.titulo, descricao: e.descricao, destaque: e.destaque,
          oc: o.oc, fim: o.fim, estado: estadoDe(o, agora),
          ...(e.pt ? { tr: { pt: e.pt } } : {}),
        };
        if (e.quando === 'semana') { r.repete = 'semana'; r.regra = { repete: 'semana', dias: e.dias, horas: e.horas }; }
        if (e.bonus) r.bonus = { ...e.bonus };
        if (e.raid) { const { filaMin, ...preset } = e.raid; let res = null; try { res = h.raid?.resumo?.(preset); } catch {} r.raid = { ...res, filaMin, filaEm: o.oc - filaMin * MIN, preset }; }   // try: at boot server.mjs's `raid` may not exist yet
        out.push(r);
      }
    }
    return out.sort((a, b) => a.oc - b.oc);
  }
  /** The scheduled bonuses running now, multiplied together ({ xp, shiny, densidade, nome, fim }), or null. */
  function bonusAgora(agora = Date.now()) {
    let b = null;
    for (const o of lista(agora - 1, agora + 1, agora)) {
      if (!o.bonus || o.estado !== 'agora') continue;   // any type with rates (a Festival with ×2 EXP counts too)
      b ||= { xp: 1, shiny: 1, densidade: 1, nome: '', fim: null };
      b.xp *= o.bonus.xp; b.shiny *= o.bonus.shiny; b.densidade *= o.bonus.densidade;
      b.nome = b.nome ? b.nome + ' + ' + o.titulo : o.titulo;
      b.fim = b.fim == null ? new Date(o.fim).toISOString() : new Date(Math.min(ms(b.fim), o.fim)).toISOString();
    }
    return b;
  }

  // Raids on the schedule: the queue opens `filaMin` before the start, and the countdown starts on time.
  // Everything else is announced to everyone online when it starts (the top banner + System chat), with its rates.
  const feitos = new Set();
  const taxas = (b) => (b ? [b.xp !== 1 ? 'EXP ×' + b.xp : '', b.shiny !== 1 ? 'shiny ×' + b.shiny : '', b.densidade !== 1 ? 'wild ×' + b.densidade : ''].filter(Boolean).join(' · ') : '');
  const ROTULO = { bonus: '🎉', festival: '🎪 Festival', torneio: '🏆 Tournament', invasao: '⚠️ Invasion', outro: '📅' };
  function tique() {
    const agora = Date.now();
    for (const o of lista(agora - 2 * MIN, agora + 1, agora)) {
      if (o.tipo === 'raid' || o.estado !== 'agora' || agora - o.oc > 2 * MIN) continue;
      const k = o.id + '@' + o.oc + ':aviso';
      if (feitos.has(k)) continue;
      feitos.add(k);
      const t = taxas(o.bonus);
      const texto = (ROTULO[o.tipo] || '📅') + ' ' + o.titulo + ' has started' + (t ? ': ' + t : '') + '!';
      for (const w of conexoes.values()) if (w._info) enviar(w, { t: 'invasao', texto });
      console.log('[agenda] ' + texto);
    }
    for (const o of lista(agora - 2 * MIN, agora + 121 * MIN, agora)) {
      if (o.tipo !== 'raid' || !h.raid) continue;
      const k = o.id + '@' + o.oc;
      if (agora >= o.raid.filaEm && agora < o.oc && !feitos.has(k + ':fila')) {
        feitos.add(k + ':fila');
        const r = h.raid.anunciarAgendada(o.titulo, o.raid.preset);
        console.log(`[agenda] ${o.id}: raid queue ${r.erro ? 'not opened (' + r.erro + ')' : 'opened'}`);
      }
      if (agora >= o.oc && agora < o.oc + 2 * MIN && !feitos.has(k + ':luta')) {
        feitos.add(k + ':luta');
        h.raid.comecarAgendada();
      }
    }
    if (feitos.size > 500) feitos.clear();
  }
  setInterval(tique, 10000).unref?.();

  function avisarClientes() { for (const w of conexoes.values()) if (w._info) enviar(w, { t: 'eventos', v: versao }); }

  /** Public schedule (the Events board). */
  function publico(url, json) {
    const dia = s => (/^\d{4}-\d\d-\d\d$/.test(s || '') ? Cal.instantePt(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)) : null);
    const agora = Date.now();
    let de = dia(url.searchParams.get('from')) ?? agora - 7 * DIA, ate = dia(url.searchParams.get('to')) ?? agora + 35 * DIA;
    ate += DIA;
    if (ate <= de) return json(400, { erro: 'from must be before to.' });
    if (ate - de > MAX_JANELA_DIAS * DIA) ate = de + MAX_JANELA_DIAS * DIA;
    ler();
    return json(200, { lista: lista(de, ate, agora), v: versao, agora });
  }

  /** Panel routes (GM only; server.mjs already checked). True when handled. */
  function rota(r, metodo, d, g, json) {
    if (r === '/admin/agenda' && metodo === 'GET') {
      const agora = Date.now();
      json(200, { ok: true, dados: ler(), proximos: lista(agora - DIA, agora + 14 * DIA, agora).filter(o => o.estado !== 'encerrado').slice(0, 30), bonus: bonusAgora(agora) });
      return true;
    }
    if (r === '/admin/agenda' && metodo === 'POST') {
      const res = limparAgenda(d.dados);
      if (res.erro) { json(400, { erro: res.erro }); return true; }
      const antes = ler();
      gravarComBackup(ARQ, res.v); cache.mtime = -2;
      ler();
      logAdmin(g, '*', 'event schedule', { antes, depois: res.v });
      avisarClientes();
      h.aoMudar?.();
      console.log(`[admin] ${g} saved the event schedule (${res.v.eventos.length} events)`);
      const agora = Date.now();
      json(200, { ok: true, dados: ler(), proximos: lista(agora - DIA, agora + 14 * DIA, agora).filter(o => o.estado !== 'encerrado').slice(0, 30), bonus: bonusAgora(agora) });
      return true;
    }
    /* START NOW / STOP NOW (panel buttons): { id, acao: 'iniciar' | 'parar', duracaoMin? }.
       Start adds a one-time copy that begins now (a raid: the queue opens now and the fight starts after its queue time); stop ends
       every occurrence of that event running right now (a "Start now" copy is removed). The weekly rule itself stays as it is. */
    if (r === '/admin/agenda/agora' && metodo === 'POST') {
      const atual = ler(), agora = Date.now();
      const e = atual.eventos.find(x => x.id === String(d.id || ''));
      if (!e) { json(404, { erro: 'No event with that ID (save the schedule first).' }); return true; }
      let eventos = atual.eventos.map(x => ({ ...x })), msg;
      if (d.acao === 'iniciar') {
        const durPad = e.quando === 'semana' ? e.duracaoMin : Math.round((ms(e.fim) - ms(e.inicio)) / MIN);
        const dur = Math.round(num(d.duracaoMin, 1, 7 * 1440, durPad || 60));
        const fila = e.raid ? e.raid.filaMin : 0;
        const ini = agora + fila * MIN;
        const copia = { ...e, id: (e.id.slice(0, 30) + '-now-' + agora.toString(36).slice(-5)), ligado: true, quando: 'uma', manual: true,
          inicio: new Date(ini).toISOString(), fim: new Date(ini + dur * MIN).toISOString() };
        for (const k of ['dias', 'horas', 'duracaoMin', 'desde', 'ate', 'paradoEm']) delete copia[k];
        eventos = eventos.filter(x => !(x.manual && ms(x.fim) <= agora));   // old finished "Start now" copies go
        if (eventos.length >= MAX_EVENTOS) { json(400, { erro: 'The schedule is full (' + MAX_EVENTOS + ' events).' }); return true; }
        eventos.unshift(copia);
        msg = e.raid ? `"${e.titulo}": raid queue open now, the fight starts in ${fila} min.` : `"${e.titulo}" started (${dur} min).`;
      } else if (d.acao === 'parar') {
        const rodando = (x) => ocorrencias(x, agora - 1, agora + 1).some(o => o.oc <= agora && o.fim > agora);
        const base = e.manual ? e.id : null;
        eventos = eventos.filter(x => !(x.manual && (x.id === base || (rodando(x) && x.titulo === e.titulo && x.tipo === e.tipo))))
          .map(x => (x.id === e.id && rodando(x) ? { ...x, paradoEm: new Date(agora).toISOString() } : x));
        msg = `"${e.titulo}" stopped.`;
        if (e.tipo === 'raid') msg += ' A raid already in its queue or fight keeps going: use /raid cancel in the game to end it.';
      } else { json(400, { erro: 'acao must be iniciar or parar.' }); return true; }
      const res = limparAgenda({ v: 1, eventos });
      if (res.erro) { json(400, { erro: res.erro }); return true; }
      gravarComBackup(ARQ, res.v); cache.mtime = -2; ler();
      logAdmin(g, '*', 'event ' + d.acao + ' now', { id: e.id });
      avisarClientes(); h.aoMudar?.();
      tique();
      console.log(`[admin] ${g}: ${msg}`);
      json(200, { ok: true, msg, dados: ler(), proximos: lista(agora - DIA, agora + 14 * DIA, agora).filter(o => o.estado !== 'encerrado').slice(0, 30), bonus: bonusAgora(agora) });
      return true;
    }
    return false;
  }

  return { lista, bonusAgora, publico, rota, ler };
}
