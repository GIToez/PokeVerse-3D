/* Admin panel — 📬 Mail. Talks to /admin/correio* (server_mail.mjs).
 *   Compose:        to everyone / online now / named players, a letter with attachments (items, Coins, Diamonds, a Pokémon,
 *                   a title, an outfit), an expiry (never, a preset, or a date), a live preview, and saved templates.
 *   System letters: the welcome letter every new mailbox gets (on/off, text, gifts, expiry).
 *   Sent mail:      every campaign with delivered / read / redeemed counts, and Recall (removes the copies nobody redeemed).
 *   Mailbox:        one player's letters, with delete. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = iso => (iso ? new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const toField = ms => { const d = new Date(ms); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const KINDS = { item: 'Item', dinheiro: 'Coins', diamantes: 'Diamonds', pokemon: 'Pokémon', titulo: 'Title', cartao: 'Outfit' };
const EXPIRY = [['0', 'Never expires'], ['1', '1 day'], ['3', '3 days'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['custom', 'Pick a date…']];
const CSS = `
#v-correio { overflow: auto; padding: 16px; display: grid; gap: 14px; align-content: start; }
#v-correio .co-grade { display: grid; grid-template-columns: minmax(420px, 1.2fr) minmax(320px, 1fr); gap: 14px; align-items: start; }
@media (max-width: 1100px) { #v-correio .co-grade { grid-template-columns: 1fr; } }
#v-correio textarea { background: #0f131b; border: 1px solid var(--borda); border-radius: 6px; padding: 6px 8px; color: var(--texto); font: inherit; min-height: 90px; resize: vertical; width: 100%; }
#v-correio input[type=datetime-local] { background: #0f131b; border: 1px solid var(--borda); border-radius: 6px; padding: 5px 8px; color: var(--texto); }
#v-correio .co-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
#v-correio .co-tabs button.atual { outline: 2px solid var(--acento); }
#v-correio .co-anexos { display: grid; gap: 6px; margin-top: 6px; }
#v-correio .co-anexo { display: grid; grid-template-columns: 110px 1fr 90px auto; gap: 6px; align-items: center; }
#v-correio .co-anexo img { width: 22px; height: 22px; vertical-align: middle; margin-right: 4px; }
#v-correio .co-carta { background: linear-gradient(#1c2740, #141b2d); border: 1px solid #36507e; border-radius: 12px; padding: 14px; }
#v-correio .co-carta h4 { margin: 0 0 2px; font-size: 17px; } #v-correio .co-carta .de { color: #9fb6dd; font-size: 12px; }
#v-correio .co-carta .corpo { white-space: pre-wrap; margin: 10px 0; line-height: 1.4; }
#v-correio .co-presente { display: flex; flex-wrap: wrap; gap: 6px; }
#v-correio .co-presente span { background: #24345a; border-radius: 8px; padding: 4px 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
#v-correio .co-presente img { width: 20px; height: 20px; }
#v-correio .co-vence { font-size: 12px; color: #f5b93b; }
#v-correio table { width: 100%; border-collapse: collapse; font-size: 13px; }
#v-correio th, #v-correio td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--borda); vertical-align: top; }
#v-correio td.num { text-align: right; white-space: nowrap; }
#v-correio .co-dica { font-size: 12px; color: var(--fraco); margin-top: 6px; }`;

export function instalarCorreio({ api, toast, resolverEspecie }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  let state = null, tab = 'compor', items = {}, outfits = [], itemList = null;
  const draft = { para: 'todos', jogadores: '', carta: { de: 'PokeVerse Team', titulo: '', texto: '', anexos: [] }, expiry: '0', custom: '' };
  let welcomeDraft = null, mailbox = null;

  async function loadCatalogs() {
    try { const r = await fetch('/data/menu_data.json', { cache: 'no-cache' }); items = (await r.json()).itens || {}; } catch { items = {}; }
    try { const r = await fetch('/data/cosmeticos.json', { cache: 'no-cache' }); outfits = (await r.json()).roupas || []; } catch { outfits = []; }
    itemList = Object.entries(items).map(([id, it]) => ({ id, n: it.n || 'Item ' + id, i: it.i })).sort((a, b) => a.n.localeCompare(b.n));
    let dl = $('dl-itens-correio');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'dl-itens-correio'; document.body.appendChild(dl); }
    dl.innerHTML = itemList.map(x => `<option value="${esc(x.id + ' ' + x.n)}">`).join('');
    let dlo = $('dl-roupas-correio');
    if (!dlo) { dlo = document.createElement('datalist'); dlo.id = 'dl-roupas-correio'; document.body.appendChild(dlo); }
    dlo.innerHTML = outfits.map(o => `<option value="${esc(o.id + ' ' + (o.nome || ''))}">`).join('');
  }
  async function load() {
    const r = await api('/admin/correio');
    if (!r.ok) { $('v-correio').innerHTML = `<div class="caixa">${esc(r.erro || 'Failed to load.')}</div>`; return; }
    state = r;
    if (!welcomeDraft) welcomeDraft = JSON.parse(JSON.stringify(r.boasVindas));
    render();
  }

  // ── Attachments ─────────────────────────────────────────────────────────────────────────────────────────────────
  const itemIcon = id => (items[id]?.i ? `<img src="/ui/itens/${esc(items[id].i)}.png" alt="" onerror="this.remove()">` : '');
  function attachmentText(a) {
    if (a.tipo === 'item') return `${itemIcon(a.id)}${esc(items[a.id]?.n || 'Item ' + a.id)} ×${a.qtd}`;
    if (a.tipo === 'dinheiro') return `🪙 ${Number(a.qtd).toLocaleString('en-US')} Coins`;
    if (a.tipo === 'diamantes') return `💎 ${a.qtd} Diamonds`;
    if (a.tipo === 'pokemon') return `🎁 ${esc(a.ficha?.nome || 'No. ' + a.ficha?.dex)} Lv ${a.ficha?.lv || 5}${a.ficha?.shiny ? ' ✨' : ''}`;
    if (a.tipo === 'titulo') return `🏷️ Title "${esc(a.id)}"`;
    if (a.tipo === 'cartao') return `🎽 ${esc(outfits.find(o => o.id === a.id)?.nome || a.id)}`;
    return '?';
  }
  function attachmentRow(a, i, scope) {
    const kind = `<select data-co="${scope}" data-i="${i}" data-k="tipo">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${a.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    let what = '', qty = '';
    if (a.tipo === 'item') { what = `<input type="text" list="dl-itens-correio" data-co="${scope}" data-i="${i}" data-k="item" value="${esc(a.id ? a.id + ' ' + (items[a.id]?.n || '') : '')}" placeholder="search an item…">`; qty = `<input type="number" min="1" max="9999" data-co="${scope}" data-i="${i}" data-k="qtd" value="${a.qtd || 1}">`; }
    else if (a.tipo === 'dinheiro' || a.tipo === 'diamantes') { what = `<span class="fraco">${a.tipo === 'dinheiro' ? 'Coins' : 'Diamonds (wallet)'}</span>`; qty = `<input type="number" min="1" data-co="${scope}" data-i="${i}" data-k="qtd" value="${a.qtd || 1}">`; }
    else if (a.tipo === 'pokemon') { what = `<input type="text" list="dl-especies" data-co="${scope}" data-i="${i}" data-k="especie" value="${esc(a.ficha?.dex ? String(a.ficha.dex).padStart(4, '0') + ' ' + (a.ficha.nome || '') : '')}" placeholder="species (name or no.)">`; qty = `<span style="display:flex;gap:4px;align-items:center"><input type="number" min="1" max="100" style="width:56px" title="Level" data-co="${scope}" data-i="${i}" data-k="lv" value="${a.ficha?.lv || 5}"><label class="chk" title="Shiny"><input type="checkbox" data-co="${scope}" data-i="${i}" data-k="shiny" ${a.ficha?.shiny ? 'checked' : ''}>✨</label></span>`; }
    else if (a.tipo === 'titulo') what = `<input type="text" maxlength="40" data-co="${scope}" data-i="${i}" data-k="id" value="${esc(a.id || '')}" placeholder="title shown on the player card">`;
    else if (a.tipo === 'cartao') what = `<input type="text" list="dl-roupas-correio" data-co="${scope}" data-i="${i}" data-k="roupa" value="${esc(a.id ? a.id + ' ' + (outfits.find(o => o.id === a.id)?.nome || '') : '')}" placeholder="outfit…">`;
    return `<div class="co-anexo">${kind}${what}${qty || '<span></span>'}<button type="button" data-co="${scope}" data-i="${i}" data-k="remover" title="Remove">✕</button></div>`;
  }
  function editAttachment(list, i, k, el) {
    const a = list[i]; if (!a) return;
    if (k === 'tipo') { list[i] = el.value === 'pokemon' ? { tipo: 'pokemon', ficha: { lv: 5 } } : { tipo: el.value, qtd: 1 }; return true; }
    if (k === 'remover') { list.splice(i, 1); return true; }
    if (k === 'qtd') a.qtd = Math.max(1, Math.floor(+el.value || 1));
    if (k === 'id') a.id = el.value.trim();
    if (k === 'item') { const m = el.value.match(/^\s*(\d+)/); a.id = m ? m[1] : ''; if (!m) { const f = itemList.find(x => x.n.toLowerCase() === el.value.trim().toLowerCase()); if (f) a.id = f.id; } }
    if (k === 'roupa') a.id = (el.value.trim().split(/\s+/)[0] || '');
    if (k === 'especie') { const r = resolverEspecie?.(el.value); a.ficha = { ...(a.ficha || {}), dex: r?.dex || null, nome: r?.nome || '', glb: r?.glb ? String(r.glb).replace(/\.glb$/, '') : '' }; }
    if (k === 'lv') a.ficha = { ...(a.ficha || {}), lv: Math.max(1, Math.min(100, Math.round(+el.value || 5))) };
    if (k === 'shiny') a.ficha = { ...(a.ficha || {}), shiny: el.checked };
    return false;
  }
  const validAttachments = list => list.filter(a => (a.tipo === 'item' ? a.id && items[a.id] : a.tipo === 'pokemon' ? a.ficha?.dex : a.tipo === 'titulo' || a.tipo === 'cartao' ? a.id : a.qtd > 0));

  // ── The letter editor (compose, welcome letter, templates share it) ─────────────────────────────────────────────
  function letterForm(scope, l) {
    return `<div class="form">
      <label>From <input type="text" maxlength="40" data-co="${scope}" data-k="de" value="${esc(l.de)}"></label>
      <label>Title <input type="text" maxlength="80" data-co="${scope}" data-k="titulo" value="${esc(l.titulo)}" placeholder="e.g. Thanks for testing!"></label>
      <label class="inteira">Message <textarea maxlength="2000" data-co="${scope}" data-k="texto" placeholder="What the player reads when they open the letter.">${esc(l.texto)}</textarea></label>
    </div>
    <div style="margin-top:8px"><b>Gifts</b> <span class="fraco">(up to 10; the player presses Redeem to get them)</span>
      <div class="co-anexos">${(l.anexos || []).map((a, i) => attachmentRow(a, i, scope)).join('') || '<span class="fraco">No gifts: a plain letter.</span>'}</div>
      <div class="acoes" style="margin-top:6px">${Object.entries(KINDS).map(([k, v]) => `<button type="button" data-co="${scope}" data-k="add" data-tipo="${k}">+ ${v}</button>`).join('')}</div>
    </div>`;
  }
  function preview(l, venceEm) {
    const gifts = validAttachments(l.anexos || []);
    const days = venceEm ? Math.max(0, Math.ceil((venceEm - Date.now()) / 864e5)) : null;
    return `<div class="co-carta"><h4>${esc(l.titulo || '(no title)')}</h4><div class="de">from ${esc(l.de || 'PokeVerse')} · just now</div>
      <div class="corpo">${esc(l.texto || '')}</div>
      ${gifts.length ? `<div class="co-presente">${gifts.map(a => `<span>${attachmentText(a)}</span>`).join('')}</div>` : ''}
      <div class="co-vence" style="margin-top:8px">${days == null ? 'never expires' : `expires in ${days} day${days === 1 ? '' : 's'}`}</div></div>`;
  }
  const expiryMs = () => (draft.expiry === 'custom' ? (draft.custom ? Date.parse(draft.custom) : null) : +draft.expiry > 0 ? Date.now() + +draft.expiry * 864e5 : null);

  // ── Views ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function render() {
    const tabs = [['compor', '✉️ Compose'], ['sistema', '⚙️ System letters'], ['enviadas', '📤 Sent mail'], ['caixa', '📥 Player mailbox']];
    $('v-correio').innerHTML = `
      <div class="topo-edit"><h2>Mail</h2><span class="fraco">${state.jogadores} accounts · ${state.online} online now</span><button id="co-atualizar">Refresh</button></div>
      <div class="co-tabs">${tabs.map(([k, v]) => `<button data-co-tab="${k}" class="${tab === k ? 'atual' : ''}">${v}</button>`).join('')}</div>
      <div id="co-corpo">${tab === 'compor' ? viewCompose() : tab === 'sistema' ? viewSystem() : tab === 'enviadas' ? viewSent() : viewMailbox()}</div>`;
  }
  function viewCompose() {
    const tpls = state.modelos || [];
    return `<div class="co-grade">
      <div class="caixa"><h3>New letter</h3>
        <div class="form">
          <label class="inteira">To <select data-co="draft" data-k="para">
            <option value="todos" ${draft.para === 'todos' ? 'selected' : ''}>Everyone (${state.jogadores} accounts)</option>
            <option value="online" ${draft.para === 'online' ? 'selected' : ''}>Online now (${state.online})</option>
            <option value="jogadores" ${draft.para === 'jogadores' ? 'selected' : ''}>Specific players…</option></select></label>
          ${draft.para === 'jogadores' ? `<label class="inteira">Usernames (comma or space separated) <input type="text" data-co="draft" data-k="jogadores" value="${esc(draft.jogadores)}" placeholder="ash, misty"></label>` : ''}
          <label>Expires <select data-co="draft" data-k="expiry">${EXPIRY.map(([k, v]) => `<option value="${k}" ${draft.expiry === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          ${draft.expiry === 'custom' ? `<label>Expiry date <input type="datetime-local" data-co="draft" data-k="custom" value="${esc(draft.custom || toField(Date.now() + 7 * 864e5))}"></label>` : '<span></span>'}
        </div>
        <div style="margin-top:8px">${letterForm('draft', draft.carta)}</div>
        <div class="acoes" style="margin-top:12px"><button class="prim" id="co-enviar">Send</button>
          <button id="co-salvar-modelo">Save as template</button>
          ${tpls.length ? `<select id="co-modelo"><option value="">Load a template…</option>${tpls.map((t, i) => `<option value="${i}">${esc(t.nome)}</option>`).join('')}</select><button id="co-apagar-modelo" title="Delete the selected template">🗑</button>` : ''}</div>
        <div class="co-dica">Expired letters disappear from the mailbox, gift or not. Everyone also covers accounts that are offline: they find the letter when they next log in.</div>
      </div>
      <div class="caixa"><h3>Preview</h3><div id="co-previa">${preview(draft.carta, expiryMs())}</div></div>
    </div>`;
  }
  function viewSystem() {
    const w = welcomeDraft, s = state.boasVindasStats || {};
    return `<div class="co-grade">
      <div class="caixa"><h3>Welcome letter</h3>
        <div class="form">
          <label class="chk inteira"><input type="checkbox" data-co="welcome" data-k="ativo" ${w.ativo ? 'checked' : ''}> Send it to every new mailbox</label>
          <label>Expires after (days, 0 = never) <input type="number" min="0" max="365" data-co="welcome" data-k="venceDias" value="${w.venceDias || 0}"></label><span></span>
        </div>
        <div style="margin-top:8px">${letterForm('welcome', w)}</div>
        <div class="acoes" style="margin-top:12px"><button class="prim" id="co-salvar-sistema">Save welcome letter</button></div>
        <div class="co-dica">Each account gets it once, the first time it opens the mail. Changes apply to accounts that have not opened the mail yet. Saved in data/mail.json (History / Undo keeps a backup).</div>
      </div>
      <div class="caixa"><h3>Preview</h3>${preview(w, +w.venceDias > 0 ? Date.now() + w.venceDias * 864e5 : null)}
        <p class="fraco" style="margin-top:10px">In mailboxes now: ${s.presentes || 0} · read ${s.lidas || 0} · redeemed ${s.resgatadas || 0}</p></div>
    </div>`;
  }
  function viewSent() {
    const rows = state.campanhas || [];
    if (!rows.length) return '<div class="caixa">Nothing sent from the panel yet.</div>';
    return `<div class="caixa"><table><tr><th>Sent</th><th>Letter</th><th>To</th><th class="num">Delivered</th><th class="num">Read</th><th class="num">Redeemed</th><th>Expires</th><th></th></tr>
      ${rows.map(c => `<tr><td>${when(c.quando)}<br><span class="fraco">${esc(c.gm || '')}</span></td>
        <td><b>${esc(c.titulo)}</b><br><span class="fraco">from ${esc(c.de)}</span>${c.anexos?.length ? `<div class="co-presente" style="margin-top:4px">${c.anexos.map(a => `<span>${attachmentText(a)}</span>`).join('')}</div>` : ''}</td>
        <td>${c.para === 'todos' ? 'Everyone' : c.para === 'online' ? 'Online' : esc((c.jogadores || []).join(', '))}</td>
        <td class="num">${c.entregues}</td><td class="num">${c.lidas}</td><td class="num">${c.resgatadas}</td>
        <td>${c.venceEm ? when(c.venceEm) : 'never'}${c.recolhida ? `<br><span class="fraco">recalled ${when(c.recolhida)}</span>` : ''}</td>
        <td>${c.presentes > c.resgatadas ? `<button class="perigo" data-co-recolher="${esc(c.id)}" title="Remove the copies nobody redeemed">Recall</button>` : ''}</td></tr>`).join('')}
    </table><div class="co-dica">Recall removes the letter from every mailbox where it was not redeemed yet. Redeemed gifts stay with the players.</div></div>`;
  }
  function viewMailbox() {
    return `<div class="caixa"><div class="acoes"><input type="text" id="co-caixa-u" placeholder="username" value="${esc(mailbox?.u || '')}"><button class="prim" id="co-caixa-ver">Open mailbox</button></div>
      ${mailbox ? (mailbox.cartas.length ? `<table style="margin-top:10px"><tr><th>Received</th><th>Letter</th><th>State</th><th>Expires</th><th></th></tr>
        ${mailbox.cartas.map(l => `<tr><td>${when(l.em)}</td><td><b>${esc(l.titulo)}</b><br><span class="fraco">from ${esc(l.de)}</span>${l.anexos?.length ? `<div class="co-presente" style="margin-top:4px">${l.anexos.map(a => `<span>${attachmentText(a)}</span>`).join('')}</div>` : ''}</td>
          <td>${l.resgatada ? 'redeemed' : l.lida ? 'read' : 'unread'}</td><td>${l.venceEm ? when(l.venceEm) : 'never'}</td>
          <td><button class="perigo" data-co-apagar="${l.id}">Delete</button></td></tr>`).join('')}</table>` : '<p class="fraco">Empty mailbox.</p>') : ''}</div>`;
  }

  // ── Events ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const letterOf = scope => (scope === 'welcome' ? welcomeDraft : draft.carta);
  function refreshPreview() {
    const p = $('co-previa');
    if (p) p.innerHTML = preview(draft.carta, expiryMs());
  }
  function onInput(ev) {
    const el = ev.target, scope = el.dataset.co, k = el.dataset.k;
    if (!scope || !k) return;
    if (scope === 'draft' && ['para', 'jogadores', 'expiry', 'custom'].includes(k)) {
      draft[k] = el.value;
      if (k === 'para' || (k === 'expiry' && ev.type === 'change')) render(); else refreshPreview();
      return;
    }
    const l = letterOf(scope);
    if (el.dataset.i != null) {
      const rebuild = editAttachment(l.anexos, +el.dataset.i, k, el);
      if (rebuild || ev.type === 'change') render(); else refreshPreview();
      return;
    }
    if (k === 'ativo') l.ativo = el.checked;
    else if (k === 'venceDias') l.venceDias = Math.max(0, Math.min(365, Math.round(+el.value || 0)));
    else l[k] = el.value;
    if (scope === 'welcome' && ev.type === 'change') render(); else refreshPreview();
  }
  async function onClick(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.coTab) { tab = b.dataset.coTab; render(); return; }
    if (b.id === 'co-atualizar') { await load(); return; }
    const scope = b.dataset.co, k = b.dataset.k;
    if (scope && k === 'add') { const l = letterOf(scope); if (l.anexos.length >= 10) return toast('Up to 10 gifts per letter.', true); l.anexos.push(b.dataset.tipo === 'pokemon' ? { tipo: 'pokemon', ficha: { lv: 5 } } : { tipo: b.dataset.tipo, qtd: b.dataset.tipo === 'dinheiro' ? 1000 : 1 }); render(); return; }
    if (scope && k === 'remover') { letterOf(scope).anexos.splice(+b.dataset.i, 1); render(); return; }
    if (b.id === 'co-enviar') return send();
    if (b.id === 'co-salvar-modelo') return saveTemplate();
    if (b.id === 'co-apagar-modelo') return deleteTemplate();
    if (b.id === 'co-salvar-sistema') return saveWelcome();
    if (b.dataset.coRecolher) return recall(b.dataset.coRecolher);
    if (b.id === 'co-caixa-ver') return openMailbox($('co-caixa-u').value);
    if (b.dataset.coApagar) return deleteLetter(+b.dataset.coApagar);
  }
  async function send() {
    const carta = { ...draft.carta, anexos: validAttachments(draft.carta.anexos) };
    if (!carta.titulo.trim()) return toast('Give the letter a title.', true);
    if (carta.anexos.length !== draft.carta.anexos.length) return toast('One of the gifts is incomplete (pick the item / species / outfit).', true);
    const venceEm = expiryMs();
    const who = draft.para === 'todos' ? `everyone (${state.jogadores} accounts)` : draft.para === 'online' ? `everyone online (${state.online})` : draft.jogadores;
    if (!confirm(`Send "${carta.titulo}" to ${who}?` + (carta.anexos.length ? `\nGifts: ${carta.anexos.length}` : ''))) return;
    const r = await api('/admin/correio/enviar', 'POST', { para: draft.para, jogadores: draft.jogadores.split(/[\s,;]+/).filter(Boolean), carta, venceEm: venceEm ? new Date(venceEm).toISOString() : null });
    if (!r.ok) return toast(r.erro || 'That did not work.', true);
    toast(`Sent to ${r.entregues} mailbox${r.entregues === 1 ? '' : 'es'}.`);
    draft.carta = { de: draft.carta.de, titulo: '', texto: '', anexos: [] };
    tab = 'enviadas';
    await load();
  }
  async function saveTemplates(modelos, ok) {
    const r = await api('/admin/correio/modelos', 'POST', { modelos });
    if (!r.ok) return toast(r.erro || 'That did not work.', true);
    state.modelos = r.modelos; toast(ok); render();
  }
  function saveTemplate() {
    const nome = prompt('Template name:', draft.carta.titulo || 'Template');
    if (!nome) return;
    const list = (state.modelos || []).filter(t => t.nome !== nome);
    list.push({ nome, ...draft.carta, anexos: validAttachments(draft.carta.anexos), venceDias: draft.expiry !== 'custom' ? +draft.expiry : 0 });
    saveTemplates(list, 'Template saved.');
  }
  function deleteTemplate() {
    const i = $('co-modelo')?.value;
    if (i === '' || i == null) return toast('Pick a template first.', true);
    const t = state.modelos[+i];
    if (!confirm(`Delete the template "${t.nome}"?`)) return;
    saveTemplates(state.modelos.filter((_, j) => j !== +i), 'Template deleted.');
  }
  function loadTemplate(i) {
    const t = state.modelos?.[+i];
    if (!t) return;
    draft.carta = { de: t.de, titulo: t.titulo, texto: t.texto, anexos: JSON.parse(JSON.stringify(t.anexos || [])) };
    draft.expiry = String(t.venceDias || 0);
    if (!EXPIRY.some(([k]) => k === draft.expiry)) { draft.expiry = 'custom'; draft.custom = toField(Date.now() + t.venceDias * 864e5); }
    render();
  }
  async function saveWelcome() {
    const w = { ...welcomeDraft, anexos: validAttachments(welcomeDraft.anexos) };
    if (w.anexos.length !== welcomeDraft.anexos.length) return toast('One of the gifts is incomplete.', true);
    const r = await api('/admin/correio/sistema', 'POST', { boasVindas: w });
    if (!r.ok) return toast(r.erro || 'That did not work.', true);
    welcomeDraft = JSON.parse(JSON.stringify(r.boasVindas));
    toast('Welcome letter saved.');
    await load();
  }
  async function recall(id) {
    if (!confirm('Remove this letter from every mailbox where it was not redeemed yet?')) return;
    const r = await api('/admin/correio/recolher', 'POST', { campanha: id });
    if (!r.ok) return toast(r.erro || 'That did not work.', true);
    toast(`Removed from ${r.removidas} mailbox${r.removidas === 1 ? '' : 'es'}.`);
    await load();
  }
  async function openMailbox(u) {
    const r = await api('/admin/correio/caixa?u=' + encodeURIComponent(String(u || '').trim()));
    if (!r.ok) return toast(r.erro || 'That did not work.', true);
    mailbox = r; render();
  }
  async function deleteLetter(id) {
    if (!confirm('Delete this letter from the player\'s mailbox? A gift that was not redeemed goes with it.')) return;
    const r = await api('/admin/correio/caixa/apagar', 'POST', { u: mailbox.u, id });
    if (!r.ok) return toast(r.erro || 'That did not work.', true);
    toast('Letter deleted.');
    await openMailbox(mailbox.u);
  }

  const root = $('v-correio');
  root.addEventListener('input', onInput);
  root.addEventListener('change', ev => { if (ev.target.id === 'co-modelo') return loadTemplate(ev.target.value); onInput(ev); });
  root.addEventListener('click', onClick);
  let started = false;
  for (const b of document.querySelectorAll('#lado button[data-vista="correio"]'))
    b.addEventListener('click', async () => { if (started) return; started = true; await loadCatalogs(); await load(); });
}
