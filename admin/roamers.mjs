/* Admin panel — 🌀 Roaming legendaries (server_roamers.mjs): who is roaming now and where, spawn one (or a whole trio) on
 * demand, send it away, restart the wait, and the settings: the wait between roamers, how long one stays, the per-Pokémon
 * limit, the trio chance and the list with each Pokémon's weight, level and mode. Talks to /admin/errantes*. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hora = t => new Date(t).toLocaleString('en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const minutos = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
const TRIOS = { 144: 'birds', 145: 'birds', 146: 'birds', 243: 'dogs', 244: 'dogs', 245: 'dogs' };
const CSS = `
#v-errantes { overflow: auto; padding: 16px; display: grid; gap: 14px; align-content: start; }
#v-errantes .er-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 14px; align-items: start; }
#v-errantes table { width: 100%; border-collapse: collapse; font-size: 13px; }
#v-errantes th, #v-errantes td { padding: 5px 6px; border-bottom: 1px solid var(--borda); text-align: left; }
#v-errantes td input[type=number] { width: 64px; }
#v-errantes td select { min-width: 118px; }
#v-errantes .er-ativo { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--borda); }
#v-errantes .er-ativo:last-child { border-bottom: 0; }
#v-errantes .er-ativo b { color: var(--acento); }
#v-errantes .er-dica { font-size: 12px; color: var(--fraco); margin-top: 6px; }`;

export function instalarErrantes({ api, toast }) {
  let st = null;
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);

  async function carregar() {
    const r = await api('/admin/errantes');
    if (!r.ok) { $('v-errantes').innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    st = r; render();
  }
  function render() {
    const C = st.config, lista = C.lista || [];
    const ativos = st.ativos.length ? st.ativos.map(a => `<div class="er-ativo"><span><b>${esc(a.nome)}</b> · ${esc(a.areaNome)} · ${esc({ movendo: 'travelling', fugindo: 'fleeing', pousado: 'landed', lutando: 'in a fight' }[a.fase] || a.fase)}${a.alt > 4 ? ' (flying)' : ''}
        · HP ${a.hp}/${a.maxHp}${a.disfarce ? ` · disguised as <b>${esc(a.disfarce)}</b>` : ''} · leaves ${hora(a.saiEm)}</span><button data-fim="${esc(a.id)}">Send away</button></div>`).join('')
      : `<div>Nobody is roaming. ${C.ligado ? (st.proximoEm > st.agora ? `The next one can come in <b>${minutos(st.proximoEm - st.agora)}</b> (${hora(st.proximoEm)}), when someone is on the map.` : 'The next one comes as soon as someone is on the map.') : '<b>Roaming is off.</b>'}</div>`;
    const opcoes = lista.map(e => `<option value="${e.dex}">${esc(e.nome)} (#${e.dex})</option>`).join('');
    const areas = `<option value="">Random area</option>` + st.areas.map(a => `<option value="${a.a}">${esc(a.nome)} (${a.a})</option>`).join('');
    const linhas = lista.map((e, i) => `<tr data-i="${i}">
        <td><input type="checkbox" data-k="ligado" ${e.ligado !== false ? 'checked' : ''}></td>
        <td>${esc(e.nome)} <span class="fraco">#${e.dex}</span>${TRIOS[e.dex] ? ` <span class="fraco">· ${TRIOS[e.dex]}</span>` : ''}</td>
        <td><select data-k="classe"><option value="lendario" ${e.classe !== 'mitico' ? 'selected' : ''}>Legendary</option><option value="mitico" ${e.classe === 'mitico' ? 'selected' : ''}>Mythical</option></select></td>
        <td><select data-k="modo"><option value="voa" ${e.modo === 'voa' ? 'selected' : ''}>Flies</option><option value="anda" ${e.modo !== 'voa' ? 'selected' : ''}>Walks</option></select></td>
        <td><input type="number" data-k="peso" min="0" max="1000" step="1" value="${+e.peso || 0}"></td>
        <td><input type="number" data-k="lv" min="1" max="100" step="1" value="${+e.lv || 50}"></td>
        <td>${st.contagem[e.dex] || 0} / ${C.limitePorJanela}</td></tr>`).join('');
    $('v-errantes').innerHTML = `
      <div class="topo-edit"><h2>🌀 Roaming legendaries</h2><button id="er-atualizar">Refresh</button></div>
      <div class="caixa">${ativos}</div>
      <div class="er-grade">
        <div class="caixa"><h3>Spawn now</h3>
          <div class="form">
            <label>Pokémon <select id="er-dex">${opcoes}</select></label>
            <label>Where <select id="er-area">${areas}</select></label>
          </div>
          <div class="acoes" style="margin-top:10px"><button class="prim" id="er-nascer">Spawn</button><button id="er-trio">Spawn the whole trio</button></div>
          <div class="er-dica">Spawning ignores the wait and the per-Pokémon limit (it still counts toward the limit). "Whole trio" works for a bird or a dog: its two siblings come too, each in a different area — for events.</div>
          <div class="acoes" style="margin-top:12px"><button id="er-agora">Let the next one come now</button><button id="er-zerar">Clear the spawn counts</button><button id="er-fim-todos">Send all away</button></div>
        </div>
        <div class="caixa"><h3>Settings</h3>
          <div class="form">
            <label class="chk inteira"><input type="checkbox" id="er-ligado" ${C.ligado ? 'checked' : ''}> Roaming on (off = nothing spawns by itself; Spawn still works)</label>
            <label>Wait between roamers (min) <input type="number" id="er-esperaMin" min="0" max="10080" value="${C.esperaMin}"></label>
            <label>Each one stays (min) <input type="number" id="er-duracaoMin" min="1" max="1440" value="${C.duracaoMin}"></label>
            <label>Same Pokémon at most (times) <input type="number" id="er-limitePorJanela" min="1" max="100" value="${C.limitePorJanela}"></label>
            <label>…in (hours) <input type="number" id="er-janelaHoras" min="1" max="2160" value="${C.janelaHoras}"></label>
            <label>Trio chance (%) <input type="number" id="er-chanceTrio" min="0" max="100" step="1" value="${Math.round((C.chanceTrio || 0) * 100)}"></label>
            <label>Flight height (m) <input type="number" id="er-alturaVoo" min="4" max="60" value="${C.alturaVoo}"></label>
            <label>Flying speed (m/s) <input type="number" id="er-velVoo" min="1" max="40" step="0.5" value="${C.velVoo}"></label>
            <label>Running speed (m/s) <input type="number" id="er-velAndar" min="1" max="20" step="0.5" value="${C.velAndar}"></label>
            <label class="inteira">Flees at HP (%), comma separated <input type="text" id="er-fogeAbaixo" value="${esc((C.fogeAbaixo || []).map(v => Math.round(v * 100)).join(', '))}"></label>
            <label class="chk inteira"><input type="checkbox" id="er-anunciar" ${C.anunciar ? 'checked' : ''}> Announce in everyone's chat when one appears</label>
          </div>
        </div>
      </div>
      <div class="caixa"><h3>Who can roam</h3>
        <table><thead><tr><th>On</th><th>Pokémon</th><th>Kind</th><th>Moves</th><th>Weight</th><th>Level</th><th>Spawned lately</th></tr></thead><tbody id="er-lista">${linhas}</tbody></table>
        <div class="er-dica">Weight: the bigger it is, the more often that one is picked (10 vs 2 = five times as likely). Mew walks around disguised as a Pokémon of its area and shows itself when hit. Flyers can only be fought once they land.</div>
        <div class="acoes" style="margin-top:12px"><button class="prim" id="er-salvar">Save settings</button></div>
      </div>`;
    ligar();
  }
  async function post(rota, corpo, ok) {
    const r = await api(rota, 'POST', corpo);
    if (!r.ok) { toast(r.erro || 'That did not work.', true); return; }
    st = r; toast(typeof ok === 'function' ? ok(r) : ok); render();
  }
  function lerConfig() {
    const C = { ...st.config };
    for (const k of ['esperaMin', 'duracaoMin', 'limitePorJanela', 'janelaHoras', 'alturaVoo', 'velVoo', 'velAndar']) C[k] = +$('er-' + k).value;
    C.chanceTrio = Math.min(100, Math.max(0, +$('er-chanceTrio').value)) / 100;
    C.ligado = $('er-ligado').checked; C.anunciar = $('er-anunciar').checked;
    C.fogeAbaixo = $('er-fogeAbaixo').value.split(',').map(v => +v.trim() / 100).filter(v => v > 0 && v < 1);
    C.lista = (C.lista || []).map((e, i) => {
      const tr = document.querySelector(`#er-lista tr[data-i="${i}"]`), v = k => tr.querySelector(`[data-k="${k}"]`);
      return { ...e, ligado: v('ligado').checked, classe: v('classe').value, modo: v('modo').value, peso: +v('peso').value, lv: +v('lv').value };
    });
    return C;
  }
  function ligar() {
    $('er-atualizar').onclick = carregar;
    $('er-nascer').onclick = () => post('/admin/errantes/nascer', { dex: +$('er-dex').value, area: $('er-area').value || null }, r => 'Spawned: ' + r.nascidos.map(n => n.nome + ' in ' + n.area).join(', '));
    $('er-trio').onclick = () => {
      if (!TRIOS[$('er-dex').value]) { toast('Pick a bird (Articuno, Zapdos, Moltres) or a dog (Raikou, Entei, Suicune).', true); return; }
      post('/admin/errantes/nascer', { dex: +$('er-dex').value, trio: true }, r => 'Spawned: ' + r.nascidos.map(n => n.nome + ' in ' + n.area).join(', '));
    };
    $('er-agora').onclick = () => post('/admin/errantes/espera', { agora: true }, 'The wait is over: the next one comes when someone is on the map.');
    $('er-zerar').onclick = () => { if (confirm('Clear how many times each one spawned lately?')) post('/admin/errantes/espera', { zerarContagem: true }, 'Spawn counts cleared (the wait started over).'); };
    $('er-fim-todos').onclick = () => { if (confirm('Send every roaming legendary away now?')) post('/admin/errantes/encerrar', {}, r => r.encerrados + ' sent away.'); };
    for (const b of document.querySelectorAll('#v-errantes [data-fim]')) b.onclick = () => post('/admin/errantes/encerrar', { id: b.dataset.fim }, 'Sent away.');
    $('er-salvar').onclick = () => post('/admin/errantes/config', { config: lerConfig() }, 'Settings saved.');
  }
  for (const b of document.querySelectorAll('#lado button[data-vista="errantes"]')) b.addEventListener('click', carregar);
  setInterval(() => { if (!$('v-errantes').hidden && !document.activeElement?.closest?.('#v-errantes')) carregar(); }, 15000);
}
