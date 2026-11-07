/* Admin panel — 🌟 Mass outbreaks (server_outbreaks.mjs): the one going on now, start one by hand (area, species, minutes) or end
 * it. The settings (how often, how long, how much of the area, shiny ×) are in Data files → Mass outbreaks. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hora = t => new Date(t).toLocaleString('en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const min = ms => Math.max(0, Math.round(ms / 60000));

export function instalarSurtos({ api, toast }) {
  let st = null;
  async function carregar() {
    const r = await api('/admin/surtos');
    if (!r.ok) { $('v-surtos').innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    st = r; render();
  }
  function render() {
    const C = st.config, a = st.atual;
    const agora = a ? `🌟 <b>${esc(a.nome)}</b> on <b>${esc(a.areaNome)}</b> — ends ${hora(a.fim)} (${min(a.fim - st.agora)} min left) <button id="su-fim">End now</button>`
      : `No outbreak right now. ${C.ligado ? (st.proximoEm > st.agora ? `The next one can start in <b>${min(st.proximoEm - st.agora)} min</b>, when someone is on the map.` : 'The next one starts as soon as someone is on the map.') : '<b>Outbreaks are off.</b>'}`;
    const areas = st.areas.map(x => `<option value="${x.a}">${esc(x.nome)} (${x.a})</option>`).join('');
    $('v-surtos').innerHTML = `<div class="topo-edit"><h2>🌟 Mass outbreaks</h2><button id="su-atualizar">Refresh</button></div>
      <div class="caixa">${agora}</div>
      <div class="caixa"><h3>Start one now</h3><div class="form">
        <label>Area <select id="su-area"><option value="">Random</option>${areas}</select></label>
        <label>Species <select id="su-dex"><option value="">Random (from the area)</option></select></label>
        <label>Minutes <input type="number" id="su-min" min="1" max="1440" value="${C.duracaoMin}"></label></div>
        <div class="acoes" style="margin-top:10px"><button class="prim" id="su-comecar">Start outbreak</button></div>
        <div class="fraco" style="margin-top:8px;font-size:12px">In that area ${Math.round((C.parte || 0.6) * 100)}% of the wild Pokémon are the outbreak species, with shinies ${C.shinyMult}× as likely. One every ${C.esperaMin} min after the last, ${C.duracaoMin} min each — change these in Data files → Mass outbreaks.</div></div>`;
    $('su-atualizar').onclick = carregar;
    if ($('su-fim')) $('su-fim').onclick = async () => { const r = await api('/admin/surtos/encerrar', 'POST', {}); if (r.ok) { st = r; toast('Outbreak ended.'); render(); } else toast(r.erro || 'That did not work.', true); };
    $('su-area').onchange = () => {
      const x = st.areas.find(z => String(z.a) === $('su-area').value);
      $('su-dex').innerHTML = '<option value="">Random (from the area)</option>' + (x ? x.especies.map(e => `<option value="${e.dex}">${esc(e.nome)}</option>`).join('') : '');
    };
    $('su-comecar').onclick = async () => {
      const r = await api('/admin/surtos/comecar', 'POST', { area: $('su-area').value || null, dex: $('su-dex').value || null, minutos: +$('su-min').value || null });
      if (!r.ok) { toast(r.erro || 'That did not work.', true); return; }
      st = r; toast('Outbreak started: ' + r.atual.nome + ' on ' + r.atual.areaNome + '.'); render();
    };
  }
  for (const b of document.querySelectorAll('#lado button[data-vista="surtos"]')) b.addEventListener('click', carregar);
}
