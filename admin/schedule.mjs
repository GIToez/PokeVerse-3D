/* Admin panel — 📅 Event schedule: what the game's Events board shows and what starts on its own (weekly bonuses such as the
 * Double EXP weekend, one-time events, raids on a timer). Talks to /admin/agenda (server_schedule.mjs), which validates, writes
 * public/data/agenda.json with a backup and tells the players online to refresh the board. Weekly times are Pacific time;
 * one-time dates are typed in this computer's time. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const paraCampo = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const doCampo = v => (v ? new Date(v).toISOString() : null);
const quando = t => new Date(t).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' PT';
const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AJUDA_TIPO = {
  bonus: 'Raises EXP / shiny / wild for everyone while it runs.',
  festival: 'Shows on the Events board and is announced in game when it starts; give it rates to make it a bonus too.',
  torneio: 'Shows on the Events board and is announced in game when it starts (the tournament itself is run by staff).',
  invasao: 'Shows on the Events board and is announced in game when it starts; rates are optional.',
  outro: 'Shows on the Events board and is announced in game when it starts.',
};
const TIPO_NOME = { bonus: 'Bonus', raid: 'Raid', festival: 'Festival', torneio: 'Tournament', invasao: 'Invasion', outro: 'Other' };
const taxasTxt = b => (b ? [b.xp !== 1 ? 'EXP ×' + b.xp : '', b.shiny !== 1 ? 'shiny ×' + b.shiny : '', b.densidade !== 1 ? 'wild ×' + b.densidade : ''].filter(Boolean).join(' · ') : '');
const TIPOS = [['bonus', 'Bonus (EXP / shiny / wild)'], ['raid', 'Raid'], ['festival', 'Festival'], ['torneio', 'Tournament'], ['invasao', 'Invasion'], ['outro', 'Other']];
const CSS = `
#v-agenda { overflow: auto; padding: 16px; display: grid; gap: 14px; align-content: start; }
#v-agenda .ag-lista { display: grid; gap: 12px; }
#v-agenda .ag-ev { display: grid; gap: 8px; }
#v-agenda .ag-ev.desligado { opacity: .55; }
#v-agenda .ag-topo { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
#v-agenda .ag-topo h3 { margin: 0; flex: 1; }
#v-agenda .ag-dias { display: flex; gap: 4px; flex-wrap: wrap; }
#v-agenda .ag-dias label { display: inline-flex; gap: 3px; align-items: center; padding: 2px 6px; border: 1px solid var(--borda); border-radius: 6px; }
#v-agenda textarea { background: #0f131b; border: 1px solid var(--borda); border-radius: 6px; padding: 6px 8px; color: var(--texto); font: inherit; min-height: 48px; resize: vertical; width: 100%; }
#v-agenda input[type=datetime-local] { background: #0f131b; border: 1px solid var(--borda); border-radius: 6px; padding: 5px 8px; color: var(--texto); }
#v-agenda .ag-prox li { margin: 2px 0; }
#v-agenda .ag-ajuda { font-size: 12px; color: var(--fraco); }
#v-agenda .ag-sujo { color: var(--acento); font-weight: 700; }
#v-agenda .ag-vivo { color: #43D17C; font-weight: 700; font-size: 12px; }`;

const novoEvento = () => ({ id: 'event-' + Date.now().toString(36), ligado: true, tipo: 'bonus', titulo: '', descricao: '', destaque: false,
  quando: 'semana', dias: [6], horas: ['00:00'], duracaoMin: 1440, bonus: { xp: 2, shiny: 1, densidade: 1 } });

export function instalarAgenda({ api, toast }) {
  let dados = null, proximos = [], bonus = null, sujo = false;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  async function carregar() {
    const r = await api('/admin/agenda');
    if (!r.ok) { $('v-agenda').innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    ({ dados, proximos, bonus } = r); sujo = false;
    render();
  }

  /** Is one of this event's occurrences running now? (from the server's list of the next two weeks) */
  const correndo = (e) => proximos.some(o => o.id === e.id && o.estado === 'agora');
  async function agora(e, acao) {
    if (sujo) { toast('Save the schedule first (▶ / ⏹ act on the saved version).', true); return; }
    let duracaoMin;
    if (acao === 'iniciar') {
      const pad = e.quando === 'semana' ? e.duracaoMin : Math.round((Date.parse(e.fim) - Date.parse(e.inicio)) / 60000);
      const h = prompt(`Start "${e.titulo || e.id}" now.${e.tipo === 'raid' ? ` The raid queue opens right away and the fight starts in ${e.raid?.filaMin ?? 15} min.` : ''}\n\nHow many hours should it last?`, String(+((pad || 60) / 60).toFixed(2)));
      if (h == null) return;
      duracaoMin = Math.round(+h * 60);
      if (!(duracaoMin >= 1)) { toast('Give a duration in hours (e.g. 1 or 0.5).', true); return; }
    } else if (!confirm(`Stop "${e.titulo || e.id}" now?`)) return;
    const r = await api('/admin/agenda/agora', 'POST', { id: e.id, acao, duracaoMin });
    if (!r.ok) { toast(r.erro || 'Failed.', true); return; }
    ({ dados, proximos, bonus } = r); sujo = false;
    render(); toast(r.msg || 'Done.');
  }
  function cartao(e, i) {
    const semana = e.quando === 'semana';
    const dur = e.duracaoMin || 60;
    return `<div class="caixa ag-ev${e.ligado ? '' : ' desligado'}" data-i="${i}">
      <div class="ag-topo"><h3>${esc(e.titulo || 'New event')}</h3>
        <label class="chk"><input type="checkbox" data-k="ligado" ${e.ligado ? 'checked' : ''}> On</label>
        <label class="chk"><input type="checkbox" data-k="destaque" ${e.destaque ? 'checked' : ''}> Featured</label>
        ${correndo(e) ? '<span class="ag-vivo">🟢 running</span>' : ''}
        <button data-acao="iniciar" title="Start a copy of this event right now (a raid: the queue opens now)">▶ Start now</button>
        <button data-acao="parar" title="End this event if it is running right now" ${correndo(e) ? '' : 'disabled'}>⏹ Stop</button>
        <button data-acao="apagar" title="Delete this event">🗑️</button></div>
      ${e.manual ? '<div class="ag-ajuda">Started by hand with ▶ Start now — it goes away by itself after it ends.</div>' : ''}
      <div class="form">
        <label>ID <input type="text" data-k="id" maxlength="40" value="${esc(e.id)}"></label>
        <label>Type <select data-k="tipo">${TIPOS.map(([k, n]) => `<option value="${k}" ${e.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="inteira">Title <input type="text" data-k="titulo" maxlength="60" value="${esc(e.titulo)}" placeholder="e.g. Double EXP Weekend"></label>
        <label class="inteira">Description <textarea data-k="descricao" maxlength="300">${esc(e.descricao)}</textarea></label>
        <label class="inteira">Portuguese title <input type="text" data-k="pt.titulo" maxlength="60" value="${esc(e.pt?.titulo)}"></label>
        <label class="inteira">Portuguese description <textarea data-k="pt.descricao" maxlength="300">${esc(e.pt?.descricao)}</textarea></label>
        <label>Repeats <select data-k="quando"><option value="semana" ${semana ? 'selected' : ''}>Every week</option><option value="uma" ${semana ? '' : 'selected'}>One time</option></select></label>
        ${semana ? `
          <div class="inteira"><div class="ag-ajuda">Days and start times are Pacific time.</div>
            <div class="ag-dias">${DIAS.map((d, k) => `<label><input type="checkbox" data-dia="${k}" ${e.dias?.includes(k) ? 'checked' : ''}>${d}</label>`).join('')}</div></div>
          <label>Start times (HH:MM, comma-separated) <input type="text" data-k="horas" value="${esc((e.horas || []).join(', '))}" placeholder="00:00, 18:30"></label>
          <label>Lasts (hours) <input type="number" data-k="duracaoH" min="0.05" max="168" step="0.25" value="${+(dur / 60).toFixed(2)}"></label>
          <label>From (optional, your time) <input type="datetime-local" data-k="desde" value="${paraCampo(e.desde)}"></label>
          <label>Until (optional, your time) <input type="datetime-local" data-k="ate" value="${paraCampo(e.ate)}"></label>`
        : `
          <label>Starts (your time) <input type="datetime-local" data-k="inicio" value="${paraCampo(e.inicio)}"></label>
          <label>Ends (your time) <input type="datetime-local" data-k="fim" value="${paraCampo(e.fim)}"></label>`}
        ${e.tipo !== 'raid' ? `
          <div class="inteira ag-ajuda"><b>${e.tipo === 'bonus' ? 'Rates while it runs' : 'Rates while it runs (optional — leave all at ×1 for a board entry only)'}</b> · ${AJUDA_TIPO[e.tipo] || ''}</div>
          <label>EXP × <input type="number" data-k="bonus.xp" min="1" max="5" step="0.25" value="${e.bonus?.xp ?? (e.tipo === 'bonus' ? 2 : 1)}"></label>
          <label>Shiny × <input type="number" data-k="bonus.shiny" min="1" max="20" step="1" value="${e.bonus?.shiny ?? 1}"></label>
          <label>Wild × <input type="number" data-k="bonus.densidade" min="0.25" max="3" step="0.25" value="${e.bonus?.densidade ?? 1}"></label>
          <div class="inteira ag-ajuda">Stacks with the Live events screen: a live ×1.5 during a ×2 weekend gives ×3.</div>` : ''}
        ${e.tipo === 'raid' ? `
          <label>Queue opens (minutes before) <input type="number" data-k="raid.filaMin" min="1" max="120" step="1" value="${e.raid?.filaMin ?? 15}"></label>
          <label>Fight time (minutes, then it flees) <input type="number" data-k="raid.lutaMin" min="1" max="30" step="1" value="${esc(e.raid?.lutaMin ?? '')}" placeholder="5"></label>
          <label>Boss name <input type="text" data-k="raid.chefeNome" maxlength="30" value="${esc(e.raid?.chefeNome ?? '')}" placeholder="from Data files → raid"></label>
          <label>Boss species no. <input type="number" data-k="raid.chefeDex" min="1" max="2000" value="${esc(e.raid?.chefeDex ?? '')}" placeholder="e.g. 144"></label>
          <label>Boss model <input type="text" data-k="raid.chefeGlb" maxlength="12" value="${esc(e.raid?.chefeGlb ?? '')}" placeholder="e.g. pm0144_00"></label>
          <label>Boss level <input type="number" data-k="raid.chefeNivel" min="1" max="100" value="${esc(e.raid?.chefeNivel ?? '')}" placeholder="70"></label>
          <label>Arena scene <input type="text" data-k="raid.arena" maxlength="12" value="${esc(e.raid?.arena ?? '')}" placeholder="4120009 or 9700001"></label>
          <div class="inteira ag-ajuda">Empty boss fields use Data files → raid. Arena 9700001 is the Articuno arena (its own attacks and braziers); 4120009 (Lorelei's Room) works for any boss. The queue opens on its own; at the start time the countdown begins, or the raid is canceled if nobody joined.</div>` : ''}
      </div></div>`;
  }

  function render() {
    const rodando = proximos.filter(o => o.estado === 'agora');
    const agoraTxt = (rodando.length
      ? '<b>Running now</b><ul>' + rodando.map(o => `<li>🟢 <b>${esc(o.titulo)}</b> · ${TIPO_NOME[o.tipo] || o.tipo}${o.raid?.chefe ? ' · ' + esc(o.raid.chefe) + ' Lv ' + o.raid.nivel : ''}${taxasTxt(o.bonus) ? ' · ' + taxasTxt(o.bonus) : ''} — until ${quando(o.fim)}</li>`).join('') + '</ul>'
      : '<b>Nothing from the schedule is running right now.</b>')
      + (bonus ? `<div>Rates in effect from the schedule: <b>EXP ×${bonus.xp}${bonus.shiny !== 1 ? ' · shiny ×' + bonus.shiny : ''}${bonus.densidade !== 1 ? ' · wild ×' + bonus.densidade : ''}</b> (Live events stack on top)</div>` : '');
    $('v-agenda').innerHTML = `
      <div class="topo-edit"><h2>Event schedule</h2><span class="ag-sujo" id="ag-sujo" ${sujo ? '' : 'hidden'}>● unsaved</span>
        <button id="ag-aleatoria" title="Start one of the raid events that are switched on, picked at random (its queue opens now)">🎲 Random raid now</button>
        <button id="ag-novo">➕ New event</button><button class="prim" id="ag-salvar">Save schedule</button><button id="ag-atualizar">Refresh</button></div>
      <div class="caixa">${agoraTxt}
        <div class="ag-prox"><b>Next two weeks</b>${proximos.length ? '<ul>' + proximos.map(o => `<li>${o.estado === 'agora' ? '🟢' : '🕒'} ${quando(o.oc)} → ${quando(o.fim)} · ${esc(o.titulo)} <span class="ag-ajuda">(${TIPO_NOME[o.tipo] || o.tipo}${o.raid?.chefe ? ': ' + esc(o.raid.chefe) + ' Lv ' + o.raid.nivel : ''}${taxasTxt(o.bonus) ? ': ' + taxasTxt(o.bonus) : ''})</span></li>`).join('') + '</ul>' : '<div class="ag-ajuda">Nothing booked.</div>'}</div>
        <div class="ag-ajuda">Everything here shows on the game's Events board (and the minimap calendar opens it). Live, one-off tweaks stay on 🎉 Live events.</div></div>
      <div class="ag-lista">${dados.eventos.map(cartao).join('') || '<div class="caixa">No events yet: press ➕ New event.</div>'}</div>`;
    ligar();
  }

  function marcarSujo() { sujo = true; const s = $('ag-sujo'); if (s) s.hidden = false; }
  function definir(e, k, v) {
    if (k === 'horas') { e.horas = String(v).split(/[,\s]+/).filter(Boolean); return; }
    if (k === 'duracaoH') { e.duracaoMin = Math.round(+v * 60); return; }
    if (k === 'desde' || k === 'ate' || k === 'inicio' || k === 'fim') { e[k] = doCampo(v); return; }
    const [a, b] = k.split('.');
    if (b) { const txt = a === 'pt' || (a === 'raid' && ['chefeNome', 'chefeGlb', 'arena'].includes(b)); e[a] = { ...(e[a] || {}), [b]: txt ? v : (v === '' ? '' : +v) }; return; }
    e[k] = v;
  }

  function ligar() {
    $('ag-aleatoria').onclick = () => {
      const l = dados.eventos.filter(e => e.tipo === 'raid' && e.ligado && !e.manual);
      if (!l.length) { toast('No raid event is switched on.', true); return; }
      agora(l[Math.floor(Math.random() * l.length)], 'iniciar');
    };
    $('ag-novo').onclick = () => { dados.eventos.unshift(novoEvento()); sujo = true; render(); };
    $('ag-atualizar').onclick = () => { if (!sujo || confirm('Drop the unsaved changes?')) carregar(); };
    $('ag-salvar').onclick = salvar;
    for (const c of document.querySelectorAll('#v-agenda .ag-ev')) {
      const e = dados.eventos[+c.dataset.i];
      c.querySelector('[data-acao="iniciar"]').onclick = () => agora(e, 'iniciar');
      c.querySelector('[data-acao="parar"]').onclick = () => agora(e, 'parar');
      c.querySelector('[data-acao="apagar"]').onclick = () => {
        if (!confirm(`Delete "${e.titulo || e.id}"?`)) return;
        dados.eventos.splice(+c.dataset.i, 1); sujo = true; render();
      };
      for (const el of c.querySelectorAll('[data-k]')) {
        el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
          const k = el.dataset.k;
          definir(e, k, el.type === 'checkbox' ? el.checked : el.value);
          marcarSujo();
          if (k === 'quando') {
            if (e.quando === 'semana') Object.assign(e, { dias: e.dias || [6], horas: e.horas || ['00:00'], duracaoMin: e.duracaoMin || 1440 });
            else Object.assign(e, { inicio: e.inicio || new Date(Date.now() + 3600e3).toISOString(), fim: e.fim || new Date(Date.now() + 7200e3).toISOString() });
          }
          if (k === 'tipo') {
            if (e.tipo === 'bonus' && !e.bonus) e.bonus = { xp: 2, shiny: 1, densidade: 1 };
            if (e.tipo === 'raid' && !e.raid) e.raid = { filaMin: 15 };
          }
          if (k === 'quando' || k === 'tipo' || k === 'ligado') { sujo = true; render(); }
        });
      }
      for (const el of c.querySelectorAll('[data-dia]')) el.addEventListener('change', () => {
        const d = +el.dataset.dia, s = new Set(e.dias || []);
        if (el.checked) s.add(d); else s.delete(d);
        e.dias = [...s].sort(); marcarSujo();
      });
    }
  }

  async function salvar() {
    const limpo = dados.eventos.map(e => {
      const o = { ...e };
      if (o.quando === 'semana') { delete o.inicio; delete o.fim; } else { delete o.dias; delete o.horas; delete o.duracaoMin; delete o.desde; delete o.ate; }
      if (o.tipo === 'raid' || (o.bonus && o.tipo !== 'bonus' && (o.bonus.xp ?? 1) == 1 && (o.bonus.shiny ?? 1) == 1 && (o.bonus.densidade ?? 1) == 1)) delete o.bonus;
      if (o.tipo !== 'raid') delete o.raid;
      return o;
    });
    const r = await api('/admin/agenda', 'POST', { dados: { v: 1, eventos: limpo } });
    if (!r.ok) { toast(r.erro || 'Failed to save.', true); return; }
    ({ dados, proximos, bonus } = r); sujo = false;
    render();
    toast('Schedule saved (' + dados.eventos.length + ' event' + (dados.eventos.length === 1 ? '' : 's') + '). Players online see it right away.');
  }

  for (const b of document.querySelectorAll('#lado button[data-vista="agenda"]')) b.addEventListener('click', () => { if (!sujo) carregar(); });
  window.addEventListener('beforeunload', ev => { if (sujo) { ev.preventDefault(); ev.returnValue = ''; } });
  const abrirPeloEndereco = () => {
    const m = /^#\/(agenda|eventos)$/.exec(location.hash);
    if (m) document.querySelector(`#lado button[data-vista="${m[1]}"]`)?.click();
  };
  window.addEventListener('hashchange', abrirPeloEndereco);
  abrirPeloEndereco();
}
