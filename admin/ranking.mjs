/* Admin panel — 🏆 Ranking. Talks to /admin/ranking* (server_ranking.mjs).
 *   Live lists:    every ranking list as the game shows it (top N), with player, value and title.
 *   This week:     when the weekly lists close, their prize titles, Close the week now (gives the titles) and Reset tallies.
 *   Winners:       past weeks and their #1s.  Weekly titles: who holds one and until when.
 *   Settings (top N, refresh, prize titles, hidden players) are in Data files → Ranking. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = ms => (ms ? new Date(ms).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const LISTS = {
  mestre: 'Master Level', insignias: 'Badges', hall: 'Hall of Fame', elite: 'Elite Four race', historia: 'Story missions',
  treinadores: 'Trainers defeated', kanto: 'Kanto Pokédex', nacional: 'National Pokédex', conhecimento: 'Knowledge points',
  lendarios: 'Legendaries', shiny_capturados: 'Shinies caught', shiny_caixa: 'Shinies in the Box', shiny_especies: 'Shiny species',
  sem_capturas: 'Weekly · catches', sem_shinies: 'Weekly · shinies', sem_selvagens: 'Weekly · wild defeated', sem_raid: 'Weekly · raid points',
};
const fmtValue = (k, x) => k === 'elite' ? (Math.floor(x.valor / 60000) + ':' + String(Math.round(x.valor / 1000) % 60).padStart(2, '0')) : k === 'hall' ? (x.texto || '✔') : Number(x.valor).toLocaleString('en-US');
const CSS = `
#v-ranking { overflow: auto; padding: 16px; display: grid; gap: 14px; align-content: start; }
#v-ranking .rk-topo { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
#v-ranking .rk-topo select { min-width: 220px; }
#v-ranking .rk-grade { display: grid; grid-template-columns: minmax(420px, 1.3fr) minmax(320px, 1fr); gap: 14px; align-items: start; }
@media (max-width: 1100px) { #v-ranking .rk-grade { grid-template-columns: 1fr; } }
#v-ranking table { width: 100%; border-collapse: collapse; font-size: 13px; }
#v-ranking th, #v-ranking td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--borda); vertical-align: top; }
#v-ranking td.num { text-align: right; white-space: nowrap; }
#v-ranking .rk-dica { font-size: 12px; color: var(--fraco); }
#v-ranking .rk-perigo { background: #5a1f24; }`;

export function instalarRanking({ api, toast }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  let state = null, list = 'nacional';
  const root = $('v-ranking');
  async function load() {
    const r = await api('/admin/ranking');
    if (!r.ok) { root.innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    state = r; render();
  }
  function render() {
    const S = state, rows = S.listas[list] || [], prizes = S.cfg?.premios || {};
    root.innerHTML = `
      <div class="caixa">
        <h3 style="margin-top:0">🏆 Ranking</h3>
        <div class="rk-dica">${S.total} player${S.total === 1 ? '' : 's'} ranked. Lists refresh every ${esc(S.cfg?.cacheSegundos)} s in the game.
          Settings (players per list, prize titles, hidden players): <b>Data files → Ranking</b>.</div>
      </div>
      <div class="rk-grade">
        <div class="caixa">
          <div class="rk-topo">
            <select id="rk-lista">${Object.entries(LISTS).map(([k, n]) => `<option value="${k}"${k === list ? ' selected' : ''}>${esc(n)} (${(S.listas[k] || []).length})</option>`).join('')}</select>
            <button id="rk-recarregar" title="Refresh">↻</button>
          </div>
          <table><thead><tr><th>#</th><th>Player</th><th>Title</th><th class="num">Value</th></tr></thead><tbody>
            ${rows.length ? rows.map(x => `<tr><td>${x.pos}</td><td>${esc(x.nick)}</td><td>${esc(x.titulo || '')}</td><td class="num">${esc(fmtValue(list, x))}</td></tr>`).join('')
              : '<tr><td colspan="4" class="rk-dica">Nobody on this list yet.</td></tr>'}
          </tbody></table>
        </div>
        <div style="display:grid;gap:14px">
          <div class="caixa">
            <h4 style="margin-top:0">This week</h4>
            <div>Week of <b>${esc(S.semana?.id)}</b> · closes <b>${esc(when(S.semana?.fim))}</b> (Monday 00:00 UTC)</div>
            <table style="margin:8px 0"><thead><tr><th>Weekly list</th><th>#1 prize title</th><th>Leader</th></tr></thead><tbody>
              ${['sem_capturas', 'sem_shinies', 'sem_selvagens', 'sem_raid'].map(k => `<tr><td>${esc(LISTS[k].replace('Weekly · ', ''))}</td><td>${esc(prizes[k] || '— none —')}</td><td>${esc((S.listas[k] || []).filter(x => x.pos === 1).map(x => x.nick + ' (' + x.valor + ')').join(', ') || '—')}</td></tr>`).join('')}
            </tbody></table>
            <div class="rk-topo">
              <button id="rk-fechar">Close the week now</button>
              <button id="rk-zerar" class="rk-perigo">Reset weekly tallies</button>
            </div>
            <div class="rk-dica" style="margin-top:6px">Closing gives each #1 their title for ${esc(S.cfg?.diasPremio)} days and starts a new week. Reset clears this week's counts and gives nothing.</div>
          </div>
          <div class="caixa">
            <h4 style="margin-top:0">Weekly titles held</h4>
            <table><thead><tr><th>Player</th><th>Title</th><th>Until</th></tr></thead><tbody>
              ${(S.temporarios || []).length ? S.temporarios.map(t => `<tr><td>${esc(t.nick)}</td><td>${esc(t.titulo)}</td><td>${esc(when(t.ate))}</td></tr>`).join('') : '<tr><td colspan="3" class="rk-dica">None.</td></tr>'}
            </tbody></table>
          </div>
          <div class="caixa">
            <h4 style="margin-top:0">Past weeks</h4>
            <table><thead><tr><th>Week</th><th>Closed</th><th>Winners</th></tr></thead><tbody>
              ${(S.vencedores || []).length ? S.vencedores.map(w => `<tr><td>${esc(w.semana)}</td><td>${esc(when(w.em))}${w.por !== 'auto' ? ' · ' + esc(w.por) : ''}</td><td>${esc((w.vencedores || []).map(v => (LISTS[v.lista] || v.lista).replace('Weekly · ', '') + ': ' + v.nick).join(' · ') || 'nobody')}</td></tr>`).join('') : '<tr><td colspan="3" class="rk-dica">No week has closed yet.</td></tr>'}
            </tbody></table>
          </div>
        </div>
      </div>`;
  }
  root.addEventListener('change', ev => { if (ev.target.id === 'rk-lista') { list = ev.target.value; render(); } });
  root.addEventListener('click', async ev => {
    const id = ev.target.id;
    if (id === 'rk-recarregar') return load();
    if (id === 'rk-fechar') {
      if (!confirm('Close this week now? Each weekly #1 gets their prize title, and a new week starts.')) return;
      const r = await api('/admin/ranking/fechar-semana', 'POST', {});
      if (!r.ok) return toast(r.erro || 'That did not work.', true);
      toast(r.vencedores.length ? 'Week closed: ' + r.vencedores.map(v => v.nick).join(', ') : 'Week closed (nobody scored).');
      return load();
    }
    if (id === 'rk-zerar') {
      if (!confirm("Reset this week's tallies for everyone? Nobody gets a title.")) return;
      const r = await api('/admin/ranking/zerar-semana', 'POST', {});
      if (!r.ok) return toast(r.erro || 'That did not work.', true);
      toast('Weekly tallies reset.');
      return load();
    }
  });
  for (const b of document.querySelectorAll('#lado button[data-vista="ranking"]')) b.addEventListener('click', load);
}
