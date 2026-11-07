/* Admin panel — 👑 Champion's seat (server_battle.mjs): who holds the title (name, since when, defences, the party challengers
 * face), the ones before, and "Reset to Blue": the seat goes back to Blue until a player beats him on a second League run. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hora = t => t ? new Date(t).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const CSS = `
#v-campeao { overflow: auto; padding: 16px; display: grid; gap: 14px; align-content: start; }
#v-campeao .cp-time { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
#v-campeao .cp-mon { background: var(--painel2); border: 1px solid var(--borda); border-radius: 8px; padding: 6px 10px; font-size: 13px; }
#v-campeao table { width: 100%; border-collapse: collapse; font-size: 13px; }
#v-campeao th, #v-campeao td { padding: 5px 6px; border-bottom: 1px solid var(--borda); text-align: left; }
#v-campeao .cp-dica { font-size: 12px; color: var(--fraco); margin-top: 8px; }`;

export function instalarCampeao({ api, toast }) {
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  let c = null;
  async function carregar() {
    const r = await api('/admin/campeao');
    if (!r.ok) { $('v-campeao').innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    c = r.campeao; render();
  }
  function render() {
    const atual = c
      ? `<div><b style="font-size:16px">👑 ${esc(c.nome)}</b> <span class="fraco">(account ${esc(c.usuario)})</span><br>Champion since ${hora(c.desde)} · ${c.defesas || 0} defence(s)</div>
         <div class="cp-time">${(c.time || []).map(p => `<span class="cp-mon">${p.shiny ? '✨ ' : ''}${esc(p.nome)} Lv${p.lv}</span>`).join('')}</div>
         <div class="acoes" style="margin-top:12px"><button id="cp-reset">Reset to Blue</button></div>`
      : `<div><b>Blue</b> holds the seat (no player has taken it yet).</div>`;
    const antes = (c?.antes || []).map(a => `<tr><td>${esc(a.nome)}</td><td>${hora(a.desde)}</td><td>${hora(a.ate)}</td><td>${a.defesas || 0}</td><td>${a.resetPor ? 'reset by ' + esc(a.resetPor) : 'beaten'}</td></tr>`).join('');
    $('v-campeao').innerHTML = `
      <div class="topo-edit"><h2>👑 Champion's seat</h2><button id="cp-atualizar">Refresh</button></div>
      <div class="caixa">${atual}
        <div class="cp-dica">A player's first League run always ends against Blue. From the second run on, the last room holds the player who took the title last, with their outfit and the party they had when they won; beating them takes the seat. Only the reigning Champion shows "👑 Indigo League Champion" (the League is shared by Kanto and Johto) under their name.</div></div>
      ${antes ? `<div class="caixa"><h3>Before</h3><table><thead><tr><th>Champion</th><th>From</th><th>Until</th><th>Defences</th><th>How it ended</th></tr></thead><tbody>${antes}</tbody></table></div>` : ''}`;
    $('cp-atualizar').onclick = carregar;
    if ($('cp-reset')) $('cp-reset').onclick = async () => {
      if (!confirm(`Take the title from ${c.nome}? Blue holds the seat again until a player beats him on a second League run.`)) return;
      const r = await api('/admin/campeao/resetar', 'POST', {});
      if (!r.ok) { toast(r.erro || 'That did not work.', true); return; }
      c = r.campeao; toast('The seat is back with Blue.'); render();
    };
  }
  for (const b of document.querySelectorAll('#lado button[data-vista="campeao"]')) b.addEventListener('click', carregar);
}
