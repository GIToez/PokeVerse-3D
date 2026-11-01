/* Painel admin — Eventos ao vivo (Fase 3): multiplicador de EXP e de shiny, densidade de selvagens (com janela de início/fim),
 * aviso global e modo manutenção. Fala com /admin/eventos* (server_events.mjs), que valida, grava public/data/eventos.json
 * com backup e EMPURRA pros jogadores online na hora — não precisa avisar a aba do jogo. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dataHora = iso => new Date(iso).toLocaleString('en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
/** ISO ↔ valor do <input type="datetime-local"> (hora local). */
const paraCampo = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const doCampo = v => v ? new Date(v).toISOString() : null;
const CSS = `
#v-eventos { overflow: auto; padding: 16px; display: grid; gap: 14px; align-content: start; }
#v-eventos .ev-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 14px; align-items: start; }
#v-eventos .ev-agora { font-size: 15px; } #v-eventos .ev-agora b { color: var(--acento); }
#v-eventos .ev-mult { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; }
#v-eventos .ev-mult .rapidos { display: flex; gap: 4px; } #v-eventos .ev-mult .rapidos button { padding: 3px 8px; font-size: 12px; }
#v-eventos textarea { background: #0f131b; border: 1px solid var(--borda); border-radius: 6px; padding: 6px 8px; color: var(--texto); font: inherit; min-height: 64px; resize: vertical; width: 100%; }
#v-eventos input[type=datetime-local] { background: #0f131b; border: 1px solid var(--borda); border-radius: 6px; padding: 5px 8px; color: var(--texto); }
#v-eventos .ev-manut-on { color: var(--erro); font-weight: 700; }
#v-eventos .ev-aviso { font-size: 12px; color: var(--fraco); margin-top: 6px; }`;

export function instalarEventos({ api, toast }) {
  let dados = null, efetivo = null, manutAgora = false, online = 0;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  async function carregar() {
    const r = await api('/admin/eventos');
    if (!r.ok) { $('v-eventos').innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    ({ dados, efetivo, manutencaoAgora: manutAgora, online } = r);
    render();
  }
  const multTxt = e => [`EXP ×${e.expMult}`, `shiny ×${e.shinyMult}`, `wild ×${e.densidade}`].join(' · ');
  const temEvento = e => e.expMult !== 1 || e.shinyMult !== 1 || e.densidade !== 1;

  function render() {
    const m = dados.manutencao || {};
    const agora = temEvento(efetivo)
      ? `🎉 <b>${esc(efetivo.nome || 'Unnamed event')}</b> active now: ${multTxt(efetivo)}${efetivo.fim ? ' — until ' + dataHora(efetivo.fim) : ''}`
      : efetivo.proximo ? `⏳ Event scheduled for ${dataHora(efetivo.proximo)} (${multTxt(dados)})` : 'No event active (everything ×1).';
    const manut = manutAgora ? '<span class="ev-manut-on">🔧 MAINTENANCE ON</span> — only GMs can log in.'
      : m.ativa && m.inicio ? `🔧 Maintenance scheduled for ${dataHora(m.inicio)} (warns at 10, 5 and 1 minute).` : '🟢 Game open.';
    $('v-eventos').innerHTML = `
      <div class="topo-edit"><h2>Live events</h2><button id="ev-atualizar">Refresh</button></div>
      <div class="caixa ev-agora">${agora}<br>${manut} <span class="fraco">· ${online} player(s) online now</span></div>
      <div class="ev-grade">
        <div class="caixa"><h3>Event</h3>
          <div class="form">
            <label class="inteira">Name (shown in the announcement) <input type="text" id="ev-nome" maxlength="60" value="${esc(dados.nome)}" placeholder="e.g. Double EXP weekend"></label>
            ${campoMult('expMult', 'EXP ×', 0.1, 10, 0.1, [1, 1.5, 2, 3])}
            ${campoMult('shinyMult', 'Shiny ×', 1, 100, 1, [1, 2, 5, 10])}
            ${campoMult('densidade', 'Wild ×', 0.25, 3, 0.25, [1, 1.5, 2])}
            <label>Starts <input type="datetime-local" id="ev-inicio" value="${paraCampo(dados.inicio)}"></label>
            <label>Ends <input type="datetime-local" id="ev-fim" value="${paraCampo(dados.fim)}"></label>
            <label class="chk inteira"><input type="checkbox" id="ev-anunciar" checked> Announce on the top banner when applying</label>
          </div>
          <div class="ev-aviso">EXP: from each win against a wild Pokémon. Shiny: divides the rate (Game config → 1 in ${'N'}) — applies to wild Pokémon and catches. Wild: how many alive per area and the spawn pace. Empty "Starts" = now; empty "Ends" = until someone ends it.</div>
          <div class="acoes" style="margin-top:12px"><button class="prim" id="ev-aplicar">Apply event</button><button id="ev-encerrar">End (everything ×1)</button></div>
        </div>
        <div class="caixa"><h3>Global announcement</h3>
          <textarea id="ev-texto" maxlength="200" placeholder="Shows on the scrolling top banner and in the chat of everyone online."></textarea>
          <div class="acoes" style="margin-top:8px"><button class="prim" id="ev-avisar">Send to everyone now</button></div>
          <div class="ev-aviso">Same as the /aviso command in the game chat.</div>
        </div>
        <div class="caixa"><h3>Maintenance mode</h3>
          <div class="form">
            <label class="inteira">Message for players <input type="text" id="ev-mtexto" maxlength="200" value="${esc(m.texto || '')}" placeholder="The game is under maintenance. Come back soon!"></label>
            <label class="inteira">Turn on at (empty = now) <input type="datetime-local" id="ev-minicio" value="${paraCampo(m.ativa ? m.inicio : null)}"></label>
          </div>
          <div class="acoes" style="margin-top:12px">${m.ativa ? '<button class="prim" id="ev-mdesligar">Turn off maintenance</button>' : '<button class="perigo" id="ev-mligar">Turn on maintenance</button>'}</div>
          <div class="ev-aviso">On: non-GMs are disconnected with the message above and cannot get in (login and game). Scheduled: everyone gets a warning at 10, 5 and 1 minute.</div>
        </div>
      </div>`;
    ligar();
  }
  const campoMult = (k, rot, min, max, passo, rapidos) => `<label class="inteira">${rot}
      <div class="ev-mult"><input type="number" id="ev-${k}" min="${min}" max="${max}" step="${passo}" value="${dados[k]}">
      <span class="rapidos">${rapidos.map(v => `<button type="button" data-k="${k}" data-v="${v}">${v}</button>`).join('')}</span></div></label>`;

  async function salvar(novo, extra = {}, ok = 'Saved.') {
    const r = await api('/admin/eventos', 'POST', { dados: novo, ...extra });
    if (!r.ok) { toast(r.erro || 'That did not work.', true); return false; }
    ({ dados, efetivo, manutencaoAgora: manutAgora } = r);
    toast(ok + (r.jogadores ? ` Reached ${r.jogadores} player(s).` : '') + (r.derrubou ? ` ${r.derrubou} disconnected.` : ''));
    render(); return true;
  }
  function ligar() {
    $('ev-atualizar').onclick = carregar;
    for (const b of document.querySelectorAll('#v-eventos .rapidos button')) b.onclick = () => { $('ev-' + b.dataset.k).value = b.dataset.v; };
    $('ev-aplicar').onclick = () => {
      const novo = { ...dados, nome: $('ev-nome').value.trim(), expMult: +$('ev-expMult').value, shinyMult: +$('ev-shinyMult').value, densidade: +$('ev-densidade').value,
        inicio: doCampo($('ev-inicio').value), fim: doCampo($('ev-fim').value) };
      salvar(novo, { anunciar: $('ev-anunciar').checked }, 'Event applied.');
    };
    $('ev-encerrar').onclick = () => { if (confirm('End the event? Everything goes back to ×1 immediately.')) salvar({ ...dados, nome: '', expMult: 1, shinyMult: 1, densidade: 1, inicio: null, fim: null }, {}, 'Event ended.'); };
    $('ev-avisar').onclick = async () => {
      const texto = $('ev-texto').value.trim(); if (!texto) { toast('Write the announcement.', true); return; }
      const r = await api('/admin/eventos/aviso', 'POST', { texto });
      if (!r.ok) { toast(r.erro || 'That did not work.', true); return; }
      $('ev-texto').value = ''; toast(`Announcement sent to ${r.jogadores} player(s).`);
    };
    if ($('ev-mligar')) $('ev-mligar').onclick = () => {
      const inicio = doCampo($('ev-minicio').value), texto = $('ev-mtexto').value.trim();
      if (inicio && Date.parse(inicio) <= Date.now()) { toast('The start time has already passed — leave it empty to turn on now.', true); return; }
      if (!confirm(inicio ? `Schedule maintenance for ${dataHora(inicio)}?` : `Turn on maintenance NOW? The ${online} online player(s) who are not GMs will be kicked.`)) return;
      salvar({ ...dados, manutencao: { ativa: true, inicio, texto } }, {}, inicio ? 'Maintenance scheduled.' : 'Maintenance on.');
    };
    if ($('ev-mdesligar')) $('ev-mdesligar').onclick = () => salvar({ ...dados, manutencao: { ...dados.manutencao, ativa: false, inicio: null } }, {}, 'Maintenance off — the game is open.');
  }

  for (const b of document.querySelectorAll('#lado button[data-vista="eventos"]')) b.addEventListener('click', carregar);
  setInterval(() => { if (!$('v-eventos').hidden && !document.activeElement?.closest?.('#v-eventos')) carregar(); }, 20000);   // o relógio do servidor liga/desliga sozinho
}
