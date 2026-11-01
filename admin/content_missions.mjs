/* Admin — Missions screen. Edits public/data/missions.json (schema `missoes` in schemas_f2.mjs):
 *   capitulos  = main story (linear: last mission of chapter 1 auto-starts the first of chapter 2)
 *   laterais   = side quest groups (town / giver folders). Each group holds optional missions.
 * Side quests are NOT in the story chain. The save stores the main mission id + step, plus laterais.ativas / laterais.feitas. */
import { esc, copia, campo, poe, gravar, ler, ref, datalist } from '/admin/content.mjs';
import { TIPOS_PASSO } from '/admin/schemas_f2.mjs';

/** Que campos cada tipo de passo usa (além de texto e onde) — os mesmos que o missions.mjs confere. */
const CAMPOS_PASSO = {
  falar: ['cfg', 'fala'], entregar: ['cfg', 'item', 'n', 'fala'], item: ['item', 'n'], ir: ['area'], capturar: ['n', 'dex'],
  derrotar: ['selvagem', 'n', 'area', 'cfg', 'dex'], nivel: ['lv'], inicial: [], curar: ['cena', 'cfg'], insignia: ['n'],
};
const PADRAO_PASSO = { capturar: { n: 1 }, derrotar: { selvagem: true, n: 1 }, nivel: { lv: 10 }, insignia: { n: 1 } };

export async function montar(sec, { api, toast, avisarJogo, marcarSujo, tela }) {
  const [itens, { areas, cenas }, npcs] = await Promise.all([ref.itens(), ref.areas(), ref.npcs()]);
  datalist('dl-f2-itens', Object.entries(itens).map(([id, i]) => [id, i.n]));
  datalist('dl-f2-areas', Object.entries(areas).map(([id, n]) => [id, n]));
  datalist('dl-f2-npcs', Object.entries(npcs).map(([id, n]) => [id, n.nome]));
  const nomeItem = id => id == null ? '' : itens[id]?.n || `⚠ item ${id} does not exist`;
  const nomeNpc = v => (Array.isArray(v) ? v : v == null ? [] : [v]).map(c => npcs[c]?.nome || `NPC ${c}`).join(', ');

  let caps = [], sides = [], meta = { versao: 1 }, orig = '[]', sel = null, filtro = '', tab = 'main';
  const comBolas = new WeakSet();
  const grupos = () => tab === 'side' ? sides : caps;
  const payload = () => ({ ...meta, capitulos: caps, laterais: sides });
  sec.innerHTML = `
    <div class="col-esq"><div class="topo">
      <div class="abas-tipo"><button data-tab="main" class="on">Main story</button><button data-tab="side">Side quests</button></div>
      <input type="search" class="busca" placeholder="filter missions…">
      <div class="acoes"><button data-a="cap">＋ Chapter</button><button data-a="mis">＋ Mission</button></div></div><div class="lista"></div></div>
    <div class="col-dir"><div class="barra-topo"><h2>Missions</h2><span class="sujo" hidden>● unsaved</span><button data-a="descartar">Discard</button><button class="prim" data-a="salvar">Save</button></div>
      <div class="fraco">Main story is one linear chain: finishing the last mission of a chapter automatically starts the first mission of the next chapter (the game never waits for a “start chapter 2” flag). Side quests live in their own groups (a town, an NPC, a theme) — they are optional, can be accepted from a quest giver, and never block or replace the story. Open a side quest on the left to set <b>Requirements</b> (tick story or other side quests that must be finished first). File
        <code>public/data/missions.json</code> — the game and the server both read it. Saves store the current story mission <b>id</b> and step <b>number</b>, plus accepted side quests.</div>
      <div class="editor"></div></div>`;
  const $ = s => sec.querySelector(s), lista = $('.lista'), editor = $('.editor');
  const marcar = () => { const s = JSON.stringify(payload()) !== orig; $('.sujo').hidden = !s; marcarSujo(tela, s); };
  const mudou = () => { marcar(); renderLista(); };

  function setTab(t) {
    tab = t;
    for (const b of sec.querySelectorAll('.abas-tipo button')) b.classList.toggle('on', b.dataset.tab === tab);
    const gBtn = sec.querySelector('[data-a="cap"]');
    gBtn.textContent = tab === 'side' ? '＋ Side quest group' : '＋ Chapter';
    const g = grupos();
    sel = g.length ? { c: 0 } : null;
    renderLista(); renderEditor();
  }

  async function carregar() {
    const d = await ler(api, toast, 'missoes'); if (!d) return;
    if (Array.isArray(d)) { caps = copia(d); sides = []; meta = { versao: 1 }; }
    else { caps = copia(d.capitulos || []); sides = copia(d.laterais || []); meta = { ...d }; delete meta.capitulos; delete meta.laterais; }
    orig = JSON.stringify(payload());
    sel = grupos().length ? { c: 0 } : null;
    marcar(); renderLista(); renderEditor();
  }

  // ── Lista (capítulos e missões) ──────────────────────────────────────────────────────────────────────────────────────────
  function renderLista() {
    const f = filtro, linhas = [], gs = grupos();
    gs.forEach((c, ci) => {
      const ms = c.missoes.map((m, mi) => ({ m, mi })).filter(({ m }) => !f || `${m.id} ${m.nome} ${m.des || ''}`.toLowerCase().includes(f));
      if (f && !ms.length && !`${c.id} ${c.nome}`.toLowerCase().includes(f)) return;
      const titulo = tab === 'side' ? esc(c.nome) : `Ch. ${esc(c.id)} — ${esc(c.nome)}`;
      linhas.push(`<button class="cap ${sel && sel.c === ci && sel.m == null ? 'atual' : ''}" data-c="${ci}"><b>${titulo}</b><span class="n">${c.missoes.length}</span></button>`);
      for (const { m, mi } of ms) linhas.push(`<button class="mis ${sel && sel.c === ci && sel.m === mi ? 'atual' : ''}" data-c="${ci}" data-m="${mi}"><span>${esc(m.nome)}</span><span class="n">${esc(m.id)} · ${m.passos.length} steps</span></button>`);
    });
    lista.innerHTML = linhas.join('') || `<div class="fraco" style="padding:8px">${tab === 'side' ? 'No side quest groups yet. Add a group (a town or a giver), then add missions inside it.' : 'Nothing found.'}</div>`;
    for (const b of lista.querySelectorAll('button')) b.onclick = () => { sel = { c: +b.dataset.c, ...(b.dataset.m != null ? { m: +b.dataset.m } : {}) }; renderLista(); renderEditor(); };
  }

  // ── Editor ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const grade = () => { const g = document.createElement('div'); g.className = 'grade-campos'; return g; };
  const cartao = (titulo, botoes = []) => {
    const c = document.createElement('div'); c.className = 'cartao';
    const cab = document.createElement('div'); cab.className = 'cab'; cab.innerHTML = `<b>${titulo}</b>`;
    for (const [rot, fn, cls] of botoes) { const b = document.createElement('button'); b.textContent = rot; if (cls) b.className = cls; b.onclick = fn; cab.append(b); }
    c.append(cab); return c;
  };
  const mover = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };

  function renderEditor() {
    editor.innerHTML = '';
    const gs = grupos();
    if (!sel || !gs[sel.c]) { editor.innerHTML = `<div class="caixa fraco">${tab === 'side' ? 'Pick a side quest group or mission on the left.' : 'Pick a chapter or mission on the left.'}</div>`; return; }
    const c = gs[sel.c];
    if (sel.m == null) {
      const k = cartao(tab === 'side' ? `Side quest group — ${esc(c.nome)}` : `Chapter ${esc(c.id)}`, [
        ['↑', () => { if (mover(gs, sel.c, -1)) { sel.c--; mudou(); renderEditor(); } }],
        ['↓', () => { if (mover(gs, sel.c, 1)) { sel.c++; mudou(); renderEditor(); } }],
        [tab === 'side' ? 'Delete group' : 'Delete chapter', () => { if (!confirm(`Delete "${c.nome}"${c.missoes.length ? ` and its ${c.missoes.length} missions` : ''}?`)) return; gs.splice(sel.c, 1); sel = gs.length ? { c: Math.max(0, sel.c - 1) } : null; mudou(); renderEditor(); }, 'perigo'],
      ]);
      const g = grade();
      g.append(
        campo({ rotulo: tab === 'side' ? 'Group ID' : 'Chapter ID', tipo: 'num', valor: c.id, min: 1, max: 99999, step: 1, aoMudar: v => { if (!Number.isInteger(v)) return 'whole number'; if (gs.some((x, i) => i !== sel.c && x.id === v)) return 'another group already has this id'; c.id = v; mudou(); } }),
        campo({ rotulo: 'Name', valor: c.nome, max_len: 80, classe: 'larga', aoMudar: v => { if (!v) return 'required'; c.nome = v; mudou(); } }));
      k.append(g);
      const info = document.createElement('div'); info.className = 'mini';
      info.textContent = tab === 'side'
        ? `${c.missoes.length} side quest(s) in this group. Groups are folders (a city, an NPC, a theme) — they do not advance the main story.`
        : `${c.missoes.length} mission(s). The chapter is the group the player sees in Missions (J); the order of chapters and missions is the story order.`;
      k.append(info);
      editor.append(k);
      return;
    }
    const m = c.missoes[sel.m]; if (!m) { sel = { c: sel.c }; renderEditor(); return; }
    const km = cartao(`${tab === 'side' ? 'Side quest' : 'Mission'} ${esc(m.id)}`, [
      ['↑', () => { if (mover(c.missoes, sel.m, -1)) { sel.m--; mudou(); renderEditor(); } }],
      ['↓', () => { if (mover(c.missoes, sel.m, 1)) { sel.m++; mudou(); renderEditor(); } }],
      ['Duplicate', () => { const n = copia(m); n.id = proximoIdMissao(c); n.nome += ' (copy)'; c.missoes.splice(sel.m + 1, 0, n); sel.m++; mudou(); renderEditor(); }],
      ['Delete', () => { if (!confirm(`Delete "${m.nome}"?`)) return; c.missoes.splice(sel.m, 1); sel = c.missoes.length ? { c: sel.c, m: Math.max(0, sel.m - 1) } : { c: sel.c }; mudou(); renderEditor(); }, 'perigo'],
    ]);
    const g = grade();
    g.append(
      campo({ rotulo: 'Mission ID', tipo: 'num', valor: m.id, min: 1, step: 1, ajuda: 'Unique across the whole game — story and side quests share one id space (stored in saves).', aoMudar: v => {
        if (!Number.isInteger(v)) return 'whole number';
        if (todosIds().some(id => id === v && !(c.missoes[sel.m] === m && m.id === v))) return 'another mission already has this id';
        if ([...caps, ...sides].some(x => x.missoes.some(y => y !== m && y.id === v))) return 'another mission already has this id';
        m.id = v; mudou(); } }),
      campo({ rotulo: tab === 'side' ? 'Group' : 'Chapter', tipo: 'opcao', valor: c.id, opcoes: gs.map(x => [x.id, tab === 'side' ? x.nome : `Ch. ${x.id} — ${x.nome}`]), vazio: '—', aoMudar: v => {
        const ci = gs.findIndex(x => x.id === v); if (ci < 0 || ci === sel.c) return;
        c.missoes.splice(sel.m, 1); gs[ci].missoes.push(m); sel = { c: ci, m: gs[ci].missoes.length - 1 }; mudou(); renderEditor(); } }),
      campo({ rotulo: 'Name', valor: m.nome, max_len: 100, classe: 'larga', aoMudar: v => { if (!v) return 'required'; m.nome = v; mudou(); } }),
      campo({ rotulo: 'Description (shown in Missions)', tipo: 'area', valor: m.des, max_len: 400, classe: 'larga', aoMudar: v => { poe(m, 'des', v?.trim() ? v : null); mudou(); } }));
    if (tab === 'side'){
      g.append(campo({ rotulo: 'Quest giver (NPC cfg)', tipo: 'num', valor: m.npc, step: 1, lista: 'dl-f2-npcs', classe: 'larga',
        ajuda: 'Talking to this NPC offers the side quest (Accept / Not now). Empty = listed in Missions only.',
        dica: v => v == null ? '' : nomeNpc(v), aoMudar: v => { if (v != null && !Number.isInteger(v)) return 'NPC cfg'; poe(m, 'npc', v); mudou(); } }));
    }
    km.append(g);
    editor.append(km);
    if (tab === 'side') editor.append(cartaoExige(m));
    editor.append(cartaoRecompensa(m));
    // ── passos
    const kp = cartao(`Steps (${m.passos.length})`, [['＋ Step', () => { m.passos.push({ tipo: 'falar', texto: 'Talk to …' }); mudou(); renderEditor(); }]]);
    const aviso = document.createElement('div'); aviso.className = 'mini';
    aviso.textContent = 'In order: the game shows one step at a time in the tracker and only moves to the next once this one happens.';
    kp.append(aviso);
    m.passos.forEach((p, i) => kp.append(cartaoPasso(m, p, i)));
    editor.append(kp);
  }

  function cartaoExige(m) {
    const escolhidos = new Set((Array.isArray(m.exige) ? m.exige : m.exige != null ? [m.exige] : []).map(Number).filter(n => n > 0 && n !== m.id));
    const k = cartao('Requirements');
    const info = document.createElement('div'); info.className = 'mini';
    info.textContent = 'Tick every story or side quest that must be finished before this one shows up under Available now. Leave all unchecked to offer it immediately.';
    k.append(info);
    const bloco = (titulo, itens) => {
      const wrap = document.createElement('div'); wrap.className = 'req-bloco';
      const h = document.createElement('b'); h.textContent = titulo; wrap.append(h);
      const usable = itens.filter(x => x.id !== m.id);
      if (!usable.length) {
        const vazio = document.createElement('div'); vazio.className = 'fraco'; vazio.textContent = 'None yet.';
        wrap.append(vazio); return wrap;
      }
      for (const item of usable) {
        const lab = document.createElement('label'); lab.className = 'req-item';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = escolhidos.has(item.id);
        cb.onchange = () => {
          if (cb.checked) escolhidos.add(item.id); else escolhidos.delete(item.id);
          const ids = [...escolhidos];
          if (ids.length) m.exige = ids; else delete m.exige;
          mudou();
        };
        lab.append(cb, document.createTextNode(' ' + item.rotulo));
        wrap.append(lab);
      }
      return wrap;
    };
    k.append(
      bloco('Main story', caps.flatMap(c => (c.missoes || []).map(x => ({ id: x.id, rotulo: `Ch. ${c.id} · ${x.nome} (#${x.id})` })))),
      bloco('Side quests', sides.flatMap(c => (c.missoes || []).map(x => ({ id: x.id, rotulo: `${c.nome} · ${x.nome} (#${x.id})` })))),
    );
    return k;
  }
  function cartaoRecompensa(m) {
    const r = m.recompensa || {};
    const atualizar = () => { if (Object.keys(r).length) m.recompensa = r; else delete m.recompensa; mudou(); };
    const k = cartao('Reward');
    const g = grade();
    g.append(
      campo({ rotulo: 'Coins', tipo: 'num', valor: r.dinheiro, min: 0, step: 1, aoMudar: v => { if (v != null && !Number.isInteger(v)) return 'whole number'; poe(r, 'dinheiro', v || null); atualizar(); } }),
      campo({ rotulo: 'EXP', tipo: 'num', valor: r.exp, min: 0, step: 1, aoMudar: v => { if (v != null && !Number.isInteger(v)) return 'whole number'; poe(r, 'exp', v || null); atualizar(); } }));
    k.append(g);
    for (const [chave, titulo] of [['itens', 'Items'], ['bolas', 'Poké Balls (ball bag)']]) {
      if (chave === 'bolas' && !r.bolas && !comBolas.has(m)) {              // as missões de hoje dão bola como item; a bolsa de bolas só aparece se pedir
        const b = document.createElement('button'); b.textContent = '＋ Poké Balls in the ball bag'; b.className = 'mini'; b.style.justifySelf = 'start';
        b.onclick = () => { comBolas.add(m); renderEditor(); }; k.append(b); continue;
      }
      const t = document.createElement('table'); t.className = 'esp';
      t.innerHTML = `<thead><tr><th>${titulo}: item</th><th>Qty</th><th></th></tr></thead><tbody></tbody>`;
      const tb = t.querySelector('tbody');
      const pares = Object.entries(r[chave] || {});                        // o registro só muda quando mexe aqui (um {} vazio que já existia fica)
      const regravar = () => { const novo = {}; for (const [id, n] of pares) if (id && n) novo[id] = n; if (Object.keys(novo).length) r[chave] = novo; else delete r[chave]; atualizar(); };
      pares.forEach((par, i) => {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td'), td2 = document.createElement('td'), td3 = document.createElement('td');
        td1.append(campo({ rotulo: '', tipo: 'num', valor: par[0], lista: 'dl-f2-itens', step: 1, dica: v => nomeItem(v), aoMudar: v => {
          if (v == null || !Number.isInteger(v) || v < 1) return 'item id';
          if (pares.some((x, j) => j !== i && String(x[0]) === String(v))) return 'duplicate item';
          par[0] = String(v); regravar(); } }));
        td2.append(campo({ rotulo: '', tipo: 'num', valor: par[1], min: 1, max: 999999, step: 1, aoMudar: v => { if (!Number.isInteger(v) || v < 1) return '≥ 1'; par[1] = v; regravar(); } }));
        const x = document.createElement('button'); x.textContent = '✕'; x.className = 'perigo'; x.onclick = () => { pares.splice(i, 1); regravar(); renderEditor(); }; td3.append(x);
        tr.append(td1, td2, td3); tb.append(tr);
      });
      const add = document.createElement('button'); add.textContent = '＋ ' + (chave === 'itens' ? 'Item' : 'Poké Ball'); add.style.justifySelf = 'start';
      add.onclick = () => {
        const id = prompt('Item id (see the list in Data files → Items):', chave === 'bolas' ? '1001' : '')?.trim(); if (!id || !/^\d{1,9}$/.test(id)) return;
        if (pares.some(p => p[0] === id)) { toast('This item is already in the reward.', true); return; }
        if (!itens[id]) toast(`Warning: item ${id} does not exist in Items.`, true);
        pares.push([id, 1]); regravar(); renderEditor(); };
      k.append(t, add);
    }
    const ok = document.createElement('div'); ok.className = 'mini';
    ok.textContent = 'The server pays only once, when the mission is in "done" (the game claims it at the end of the mission).';
    k.append(ok);
    return k;
  }

  function cartaoPasso(m, p, i) {
    const k = cartao(`Step ${i + 1}`, [
      ['↑', () => { if (mover(m.passos, i, -1)) { mudou(); renderEditor(); } }],
      ['↓', () => { if (mover(m.passos, i, 1)) { mudou(); renderEditor(); } }],
      ['✕', () => { if (m.passos.length <= 1) { toast('The mission needs at least one step.', true); return; } m.passos.splice(i, 1); mudou(); renderEditor(); }, 'perigo'],
    ]);
    const g = grade();
    g.append(campo({ rotulo: 'Type', tipo: 'opcao', valor: p.tipo, opcoes: Object.entries(TIPOS_PASSO), vazio: '—', aoMudar: v => {
      if (!v) return 'pick the type';
      const fica = new Set(['tipo', 'texto', 'onde', ...CAMPOS_PASSO[v]]);
      for (const key of Object.keys(p)) if (!fica.has(key) && (Object.values(CAMPOS_PASSO).flat().includes(key) || key === 'treinador' || key === 'cfgs')) delete p[key];
      p.tipo = v; Object.assign(p, Object.fromEntries(Object.entries(PADRAO_PASSO[v] || {}).filter(([kk]) => p[kk] == null)));
      mudou(); renderEditor(); } }));
    const usa = new Set(CAMPOS_PASSO[p.tipo] || []);
    if (usa.has('selvagem')) g.append(campo({ rotulo: 'Defeat', tipo: 'opcao', valor: p.selvagem ? 's' : 't', opcoes: [['s', 'Wild Pokémon'], ['t', 'Trainers']], vazio: '—', aoMudar: v => {
      if (v === 's') { p.selvagem = true; delete p.treinador; } else { p.treinador = true; delete p.selvagem; }
      mudou(); renderEditor(); } }));
    if (usa.has('cfg')) {
      const valor = p.cfgs || p.cfg;
      g.append(campo({ rotulo: p.tipo === 'derrotar' ? 'Trainer(s) (cfg)' : p.tipo === 'curar' ? 'Nurse (cfg)' : 'NPC (cfg)', tipo: 'nums', valor: Array.isArray(valor) ? valor : valor != null ? [valor] : null, lista: 'dl-f2-npcs',
        ajuda: p.tipo === 'derrotar' ? 'Empty = any trainer. Several = any of them.' : p.tipo === 'curar' ? 'Empty = any Joy.' : 'Several, comma-separated = any of them.',
        dica: v => v?.length ? nomeNpc(v) : '', aoMudar: v => {
          delete p.cfgs;
          if (p.tipo !== 'derrotar' && p.tipo !== 'curar' && !v) return 'say which NPC';
          poe(p, 'cfg', v ? (v.length === 1 ? v[0] : v) : null); mudou(); } }));
    }
    if (usa.has('item')) g.append(campo({ rotulo: 'Item', tipo: 'num', valor: p.item, step: 1, lista: 'dl-f2-itens', dica: nomeItem, aoMudar: v => { if (!Number.isInteger(v)) return 'item id'; p.item = v; mudou(); } }));
    if (usa.has('n')) g.append(campo({ rotulo: p.tipo === 'insignia' ? 'No. of badges' : 'Quantity', tipo: 'num', valor: p.n, min: 1, max: 9999, step: 1, aoMudar: v => {
      if (p.tipo === 'insignia' && !v) return 'required'; if (v != null && !Number.isInteger(v)) return 'whole number'; poe(p, 'n', v); mudou(); } }));
    if (usa.has('area')) g.append(campo({ rotulo: 'Area', tipo: 'num', valor: p.area, step: 1, lista: 'dl-f2-areas', ajuda: p.tipo === 'derrotar' ? 'Empty = anywhere.' : '',
      dica: v => v == null ? '' : areas[v] || '⚠ unknown area', aoMudar: v => { if (p.tipo === 'ir' && v == null) return 'say which area'; if (v != null && !Number.isInteger(v)) return 'whole number'; poe(p, 'area', v); mudou(); } }));
    if (usa.has('dex')) g.append(campo({ rotulo: 'Only these species (no.)', tipo: 'nums', valor: p.dex, ajuda: 'Empty = any.', aoMudar: v => { poe(p, 'dex', v); mudou(); } }));
    if (usa.has('lv')) g.append(campo({ rotulo: 'Level', tipo: 'num', valor: p.lv, min: 1, max: 100, step: 1, aoMudar: v => { if (!Number.isInteger(v)) return 'from 1 to 100'; p.lv = v; mudou(); } }));
    if (usa.has('cena')) g.append(campo({ rotulo: 'Only at the Center in scene', tipo: 'num', valor: p.cena, step: 1, ajuda: 'Empty = any Center.', dica: v => v == null ? '' : cenas[v] || '⚠ unknown scene',
      aoMudar: v => { poe(p, 'cena', v); mudou(); } }));
    g.append(
      campo({ rotulo: 'Tracker text *', valor: p.texto, max_len: 200, classe: 'larga', aoMudar: v => { if (!v) return 'required — this is what the player reads'; p.texto = v; mudou(); } }),
      campo({ rotulo: 'Where (hint, optional)', valor: p.onde, max_len: 120, classe: 'larga', aoMudar: v => { poe(p, 'onde', v); mudou(); } }));
    if (usa.has('fala')) g.append(campo({ rotulo: 'NPC dialogue for this step (one per line)', tipo: 'linhas', valor: p.fala, classe: 'larga', aoMudar: v => { if (v && v.length > 12) return 'up to 12 lines'; poe(p, 'fala', v); mudou(); } }));
    if (p.tipo === 'item' || p.tipo === 'entregar') { const a = document.createElement('div'); a.className = 'aviso larga'; a.textContent = 'With an account, the local server does not check this type yet ("deliver" counts as talking, without taking the item).'; g.append(a); }
    k.append(g);
    return k;
  }

  // ── Ações ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const todosIds = () => [...caps, ...sides].flatMap(x => x.missoes.map(y => y.id));
  function proximoIdMissao(c) {
    const usados = new Set(todosIds());
    const base = tab === 'side' ? Math.max(9001, ...(c.missoes.map(x => x.id)), 9000) : Math.max(c.id * 100, ...c.missoes.map(x => x.id));
    let id = base + 1;
    while (usados.has(id)) id++;
    return id;
  }
  $('.busca').oninput = e => { filtro = e.target.value.trim().toLowerCase(); renderLista(); };
  for (const b of sec.querySelectorAll('.abas-tipo button')) b.onclick = () => setTab(b.dataset.tab);
  sec.querySelector('[data-a="cap"]').onclick = () => {
    const gs = grupos();
    const id = Math.max(0, ...gs.map(x => x.id)) + 1;
    gs.push({ id, nome: tab === 'side' ? 'New side quest group' : 'New chapter', missoes: [] });
    sel = { c: gs.length - 1 }; mudou(); renderEditor();
  };
  sec.querySelector('[data-a="mis"]').onclick = () => {
    const gs = grupos();
    if (!gs.length) { toast(tab === 'side' ? 'Create a side quest group first (a town or a giver).' : 'Create a chapter first.', true); return; }
    const ci = sel?.c ?? gs.length - 1, c = gs[ci];
    c.missoes.push({ id: proximoIdMissao(c), nome: tab === 'side' ? 'New side quest' : 'New mission', des: '', passos: [{ tipo: 'falar', texto: 'Talk to …' }] });
    sel = { c: ci, m: c.missoes.length - 1 }; mudou(); renderEditor();
  };
  sec.querySelector('[data-a="descartar"]').onclick = () => { if (JSON.stringify(payload()) === orig || confirm('Discard your changes?')) carregar(); };
  sec.querySelector('[data-a="salvar"]').onclick = async () => {
    if (sec.querySelector('.editor .invalido')) { toast('Fix the fields in red before saving.', true); return; }
    for (const c of [...caps, ...sides]) for (const m of c.missoes) if (m.des === '') delete m.des;
    const dados = payload();
    if (!await gravar(api, toast, 'missoes', dados)) return;
    orig = JSON.stringify(dados); marcar();
    toast(`Missions saved (${caps.length} chapters, ${sides.length} side groups, ${todosIds().length} quests). The server uses them now; an open game, after F5.`);
    avisarJogo('missoes');
  };
  await carregar();
}
