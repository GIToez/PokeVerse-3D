/* Admin panel — 🛡️ Guilds (server_guild.mjs): every guild with its level, members and leader; rename (name / TAG), give guild XP,
 * disband. The rules (cost to found, badges needed, levels, XP per activity) are in Data files → Guilds (guilda.json). */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dia = t => new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export function instalarGuildas({ api, toast }) {
  let lista = [];
  async function carregar() {
    const r = await api('/admin/guildas');
    if (!r.ok) { $('v-guildas').innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    lista = r.guildas; render();
  }
  function render() {
    const linhas = lista.sort((a, b) => b.nivel - a.nivel || b.xp - a.xp).map(g => `<tr data-id="${esc(g.id)}">
      <td><b>[${esc(g.tag)}]</b> ${esc(g.nome)}</td><td>${g.nivel}</td><td>${g.xp.toLocaleString('en-US')}</td><td>${g.membros}</td><td>${esc(g.lider)}</td>
      <td>${g.semana.toLocaleString('en-US')}</td><td>${esc(g.entrada)}</td><td>${dia(g.criadaEm)}</td>
      <td style="white-space:nowrap"><button data-a="nome">Rename</button> <button data-a="xp">+XP</button> <button data-a="fim" class="perigo">Disband</button></td></tr>`).join('');
    $('v-guildas').innerHTML = `<div class="topo-edit"><h2>🛡️ Guilds</h2><button id="gu-atualizar">Refresh</button></div>
      <div class="caixa">${lista.length ? `<table class="tab"><tr><th>Guild</th><th>Level</th><th>XP</th><th>Members</th><th>Leader</th><th>Points this week</th><th>Joining</th><th>Founded</th><th></th></tr>${linhas}</table>` : 'No guilds yet.'}
      <div class="fraco" style="margin-top:8px;font-size:12px">Founding costs, badges needed, levels and the guild XP each activity gives are in Data files → Guilds.</div></div>`;
    $('gu-atualizar').onclick = carregar;
    for (const b of document.querySelectorAll('#v-guildas [data-a]')) b.onclick = async () => {
      const id = b.closest('tr').dataset.id, g = lista.find(x => x.id === id); let r;
      if (b.dataset.a === 'nome') {
        const nome = prompt('Guild name', g.nome); if (nome == null) return;
        const tag = prompt('TAG (3–4 letters)', g.tag); if (tag == null) return;
        r = await api('/admin/guildas/renomear', 'POST', { id, nome, tag });
      } else if (b.dataset.a === 'xp') {
        const xp = prompt('Guild XP to give', '1000'); if (!xp) return;
        r = await api('/admin/guildas/xp', 'POST', { id, xp: +xp });
      } else {
        if (!confirm('Disband [' + g.tag + '] ' + g.nome + '? Every member leaves; this cannot be undone.')) return;
        r = await api('/admin/guildas/dissolver', 'POST', { id });
      }
      if (r.ok) { toast('Done.'); carregar(); } else toast(r.erro || 'That did not work.', true);
    };
  }
  for (const b of document.querySelectorAll('#lado button[data-vista="guildas"]')) b.addEventListener('click', carregar);
}
