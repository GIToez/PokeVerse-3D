/* Painel admin — tela Evoluções (Fase 2). Edita data/evolutions.json → por ({ dex: [regra, …] }, esquema `evolucoes`, registroLista)
 * e mantém o → itens (esquema `evolucoes_itens`): todo item que uma regra usa entra na lista de itens de evolução, senão o jogo não
 * deixa usá-lo no Pokémon. Quem avalia as regras é o evolution.mjs do jogo (lido no boot: o jogo aberto precisa de F5).
 * Item "que ainda não existe no jogo" = 0 (o arquivo antigo usava null; o jogo trata os dois igual e o painel grava 0). */
import { esc, copia, campo, gravar, ler, ref, datalist, pad } from '/admin/content.mjs';
import { ESQUEMAS, validarCampo } from '/admin/schemas.mjs';
import { TIPOS } from '/admin/schemas_f2.mjs';

const CAMPO = Object.fromEntries(ESQUEMAS.evolucoes.campos.map(c => [c.k, c]));
/** Campos que cada gatilho usa (os outros conhecidos somem ao trocar o gatilho; os desconhecidos — beleza, chuva… — ficam). */
const VISIVEIS = {
  nivel: ['nivel', 'amizade', 'horario', 'segurando', 'segurandoNome', 'golpe', 'golpeNome', 'tipoGolpe', 'noTime', 'tipoNoTime', 'genero', 'stats'],
  item: ['item', 'itemNome', 'horario', 'genero'],
  troca: ['item', 'itemNome', 'segurando', 'segurandoNome'],
  muda: ['nivel'],
  outro: ['extra', 'nivel'],
};
const SEMPRE = ['para', 'nome', 'gatilho', 'texto'];

export async function montar(sec, { api, toast, avisarJogo, marcarSujo, tela }) {
  const [especies, itens, dexExtra, elenco] = await Promise.all([ref.especies(), ref.itens(), ref.dexExtra(), ref.elenco()]);
  const golpesDex = dexExtra.golpes || {};
  const comModelo = new Set(elenco.map(e => e.n));
  const nomeSp = n => especies.get(+n)?.nome || `No. ${n}`;
  datalist('dl-f2-itens', Object.entries(itens).map(([id, i]) => [id, i.n]));
  datalist('dl-f2-especies', [...especies].map(([n, s]) => [n, s.nome]));
  datalist('dl-f2-golpes-dex', Object.entries(golpesDex).map(([id, g]) => [id, g[0]]));
  const maxDex = Math.max(...especies.keys());

  let por = {}, orig = '{}', itensEvo = {}, origItens = '{}', sel = null, filtro = '', todas = false;
  sec.innerHTML = `
    <div class="col-esq"><div class="topo"><input type="search" class="busca" placeholder="search species (name or no.)…">
      <label class="chk"><input type="checkbox" class="todas"> show all species</label></div><div class="lista"></div></div>
    <div class="col-dir"><div class="barra-topo"><h2>Evolutions</h2><span class="sujo" hidden>● unsaved</span><button data-a="descartar">Discard</button><button class="prim" data-a="salvar">Save</button></div>
      <div class="fraco">How each species evolves: level, friendship, time of day, item, trade… File <code>public/data/evolutions.json</code>, read by the game
        (evolution.mjs) at boot — after saving, F5 in the game. The target needs a 3D model (Species → models), otherwise the game won't evolve it.</div>
      <div class="editor"></div></div>`;
  const $ = s => sec.querySelector(s), lista = $('.lista'), editor = $('.editor');
  const marcar = () => { const s = JSON.stringify(por) !== orig; $('.sujo').hidden = !s; marcarSujo(tela, s); };

  async function carregar() {
    const [p, it] = await Promise.all([ler(api, toast, 'evolucoes'), ler(api, toast, 'evolucoes_itens')]);
    if (!p || !it) return;
    por = copia(p); itensEvo = copia(it);
    for (const l of Object.values(por)) for (const r of l) normalizar(r);
    orig = JSON.stringify(por); origItens = JSON.stringify(itensEvo);
    marcar(); renderLista(); renderEditor();
  }
  /** null → 0 nos itens "que ainda não existem" (o validador do painel descarta campo null; o jogo trata 0 e null igual). */
  function normalizar(r) {
    for (const [k, nome] of [['item', 'itemNome'], ['segurando', 'segurandoNome']]) if (k in r && r[k] == null) { if (r[nome]) r[k] = 0; else delete r[k]; }
  }
  const deOnde = dex => Object.entries(por).filter(([, l]) => l.some(r => r.para === dex)).map(([d]) => +d);

  // ── Lista ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  function renderLista() {
    const f = filtro, out = [];
    for (let n = 1; n <= maxDex; n++) {
      const l = por[n], nome = nomeSp(n);
      if (f ? !(`${n} ${pad(n)} ${nome}`.toLowerCase().includes(f)) : !(todas || l?.length || String(sel) === String(n))) continue;
      out.push(`<button data-dex="${n}" class="${String(sel) === String(n) ? 'atual' : ''} ${l?.length ? '' : 'vazio'}"><span><span class="n">${pad(n)}</span> ${esc(nome)}</span><span class="n">${l?.length ? '→ ' + l.map(r => esc(nomeSp(r.para))).join(', ') : ''}</span></button>`);
      if (out.length > 1100) break;
    }
    lista.innerHTML = out.join('') || '<div class="fraco" style="padding:8px">Nothing found.</div>';
    for (const b of lista.querySelectorAll('button')) b.onclick = () => { sel = b.dataset.dex; renderLista(); renderEditor(); };
  }

  // ── Editor ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const cartao = (titulo, botoes = []) => {
    const c = document.createElement('div'); c.className = 'cartao';
    const cab = document.createElement('div'); cab.className = 'cab'; cab.innerHTML = `<b>${titulo}</b>`;
    for (const [rot, fn, cls] of botoes) { const b = document.createElement('button'); b.textContent = rot; if (cls) b.className = cls; b.onclick = fn; cab.append(b); }
    c.append(cab); return c;
  };
  function renderEditor() {
    editor.innerHTML = '';
    if (sel == null) { editor.innerHTML = '<div class="caixa fraco">Pick a species on the left (tick "show all" or search to add an evolution to one that has none).</div>'; return; }
    const dex = +sel, l = por[sel] || [];
    const topo = cartao(`${pad(dex)} ${esc(nomeSp(dex))}`, [['＋ Evolution', () => {
      (por[sel] ||= []).push({ para: dex + 1, nome: nomeSp(dex + 1), gatilho: 'nivel', nivel: 16, texto: 'Lv 16' }); marcar(); renderLista(); renderEditor(); }]]);
    const de = deOnde(dex), info = document.createElement('div'); info.className = 'mini';
    info.innerHTML = (de.length ? `Evolves from: ${de.map(d => `<a href="#" data-ir="${d}">${pad(d)} ${esc(nomeSp(d))}</a>`).join(', ')}. ` : '')
      + (l.length ? `${l.length} way(s) to evolve — if there is more than one, the player chooses.` : 'Does not evolve.');
    for (const a of info.querySelectorAll('a[data-ir]')) a.onclick = e => { e.preventDefault(); sel = a.dataset.ir; renderLista(); renderEditor(); };
    topo.append(info);
    editor.append(topo);
    l.forEach((r, i) => editor.append(cartaoRegra(l, r, i)));
  }

  function cartaoRegra(l, r, i) {
    const mudou = () => { marcar(); renderLista(); };
    const k = cartao(`→ ${pad(r.para)} ${esc(nomeSp(r.para))}`, [
      ['↑', () => { if (i > 0) { [l[i - 1], l[i]] = [l[i], l[i - 1]]; mudou(); renderEditor(); } }],
      ['↓', () => { if (i < l.length - 1) { [l[i + 1], l[i]] = [l[i], l[i + 1]]; mudou(); renderEditor(); } }],
      ['✕', () => { if (!confirm(`Remove the evolution into ${nomeSp(r.para)}?`)) return; l.splice(i, 1); if (!l.length) delete por[sel]; mudou(); renderEditor(); }, 'perigo'],
    ]);
    const g = document.createElement('div'); g.className = 'grade-campos';
    const ponha = (key, v) => { if (v == null || v === '') delete r[key]; else r[key] = v; };
    const nomeAuto = { item: id => itens[id]?.n, segurando: id => itens[id]?.n, golpe: id => golpesDex[id]?.[0], para: n => especies.get(+n)?.nome };
    const parDoNome = { item: 'itemNome', segurando: 'segurandoNome', golpe: 'golpeNome', para: 'nome' };
    const widgets = {};
    const fazer = key => {
      const c = CAMPO[key]; if (!c) return null;
      const tipo = c.tipo === 'opcao' ? 'opcao' : c.tipo === 'num' ? 'num' : 'texto';
      const dica = key === 'para' ? v => v == null ? '' : !especies.has(+v) ? '⚠ unknown no.' : comModelo.has(+v) ? '' : '⚠ no 3D model: will not evolve in game'
        : key === 'item' || key === 'segurando' ? v => v == null ? '' : v === 0 ? 'not in the game yet' : itens[v]?.n || '⚠ unknown item'
        : key === 'golpe' ? v => v == null ? '' : golpesDex[v]?.[0] || '⚠ unknown move'
        : key === 'noTime' ? v => v == null ? '' : nomeSp(v) : null;
      const w = campo({ rotulo: c.rotulo + (c.obrigatorio ? ' *' : ''), tipo, valor: r[key], opcoes: (c.opcoes || []).map(o => [o.v, o.rotulo ?? o.v]), ajuda: c.ajuda,
        min: c.min, max: c.max, step: c.int ? 1 : 'any', max_len: c.max && tipo === 'texto' ? c.max : undefined, dica,
        lista: key === 'para' || key === 'noTime' ? 'dl-f2-especies' : key === 'item' || key === 'segurando' ? 'dl-f2-itens' : key === 'golpe' ? 'dl-f2-golpes-dex' : undefined,
        classe: key === 'texto' ? 'larga' : undefined,
        aoMudar: v => {
          if (v == null) { if (c.obrigatorio) return 'required'; ponha(key, null); mudou(); return; }
          const res = validarCampo(c, v); if (!res.ok) return res.erro;
          const antes = r[key];
          ponha(key, res.v);
          const par = parDoNome[key];                                       // nome automático (se o nome estava vazio ou era o automático do valor antigo)
          if (par && nomeAuto[key]) { const novo = nomeAuto[key](res.v); if (novo && (!r[par] || r[par] === nomeAuto[key](antes))) { r[par] = novo; const wp = widgets[par]; if (wp) wp.entrada.value = novo; } }
          if (key === 'para') k.querySelector('.cab b').textContent = `→ ${pad(r.para)} ${nomeSp(r.para)}`;
          mudou();
        } });
      widgets[key] = w; return w;
    };
    const gat = fazer('gatilho');
    gat.entrada.addEventListener('change', () => {                          // troca de gatilho: some com o que o novo não usa
      const fica = new Set([...SEMPRE, ...(VISIVEIS[r.gatilho] || [])]);
      for (const key of Object.keys(r)) if (CAMPO[key] && !fica.has(key)) delete r[key];
      mudou(); renderEditor();
    });
    g.append(fazer('para'), fazer('nome'), gat);
    for (const key of VISIVEIS[r.gatilho] || []) { const w = fazer(key); if (w) g.append(w); }
    const t = fazer('texto'); g.append(t);
    const gerar = document.createElement('button'); gerar.type = 'button'; gerar.textContent = '✎ Generate text from fields'; gerar.className = 'larga'; gerar.style.justifySelf = 'start';
    gerar.onclick = () => { r.texto = textoDa(r); t.entrada.value = r.texto; t.entrada.dispatchEvent(new Event('input')); };
    g.append(gerar);
    const outros = Object.keys(r).filter(key => !CAMPO[key]);
    if (outros.length) { const o = document.createElement('div'); o.className = 'mini larga'; o.textContent = 'Other fields (not editable here, kept as they are): ' + outros.map(key => `${key} = ${JSON.stringify(r[key])}`).join(' · '); g.append(o); }
    if (r.gatilho === 'outro' || r.beleza != null || r.chuva || r.local) { const a = document.createElement('div'); a.className = 'aviso larga'; a.textContent = 'Rule the game cannot fulfill yet: it shows on the entry, but as "not possible here".'; g.append(a); }
    k.append(g);
    return k;
  }
  /** Texto pro jogador a partir dos campos (o jogador lê na ficha do Pokémon). */
  function textoDa(r) {
    const nomeIt = (id, nome) => nome || itens[id]?.n || 'item';
    const sexo = r.genero === 'm' ? ' ♂' : r.genero === 'f' ? ' ♀' : '';
    if (r.gatilho === 'item') return `use ${nomeIt(r.item, r.itemNome)}${sexo}`;
    if (r.gatilho === 'troca') return r.item ? `trade — or use ${nomeIt(r.item, r.itemNome)}` : `trade holding ${nomeIt(r.segurando, r.segurandoNome || r.itemNome)}`;
    if (r.gatilho === 'muda') return 'level up (appears alongside the other evolution if there is room in the party and a Poké Ball)';
    if (r.gatilho === 'outro') return 'special rule' + (r.extra ? ': ' + r.extra : '') + (r.nivel ? ` Lv ${r.nivel}` : '');
    const c = [];
    if (r.amizade) c.push(r.amizade >= 160 ? 'with high friendship' : `with friendship ${r.amizade}`);
    if (r.horario) c.push(r.horario === 'dia' ? 'during the day' : 'at night');
    if ('segurando' in r) c.push('holding ' + nomeIt(r.segurando, r.segurandoNome));
    if (r.golpe) c.push('knowing ' + (r.golpeNome || golpesDex[r.golpe]?.[0] || 'the move'));
    if (r.tipoGolpe) c.push('knowing a ' + (TIPOS[r.tipoGolpe] || r.tipoGolpe) + '-type move');
    if (r.noTime) c.push(`with ${nomeSp(r.noTime)} in the party`);
    if (r.tipoNoTime) c.push(`with a ${TIPOS[r.tipoNoTime] || r.tipoNoTime}-type Pokémon in the party`);
    if (r.stats != null) c.push(r.stats > 0 ? 'with Atk > Def' : r.stats < 0 ? 'with Atk < Def' : 'with Atk = Def');
    return (r.nivel ? `Lv ${r.nivel}` + (c.length ? ' ' + c.join(' ') : '') : 'level up' + (c.length ? ' ' + c.join(' ') : '')) + sexo;
  }

  // ── Ações ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  $('.busca').oninput = e => { filtro = e.target.value.trim().toLowerCase(); renderLista(); };
  $('.todas').onchange = e => { todas = e.target.checked; renderLista(); };
  sec.querySelector('[data-a="descartar"]').onclick = () => { if (JSON.stringify(por) === orig || confirm('Discard your changes?')) carregar(); };
  sec.querySelector('[data-a="salvar"]').onclick = async () => {
    if (sec.querySelector('.editor .invalido')) { toast('Fix the fields in red before saving.', true); return; }
    for (const [d, l] of Object.entries(por)) { if (!l.length) delete por[d]; else l.forEach(normalizar); }
    // todo item usado numa regra entra nos itens de evolução (senão a Mochila não oferece usar no Pokémon)
    const faltam = [];
    for (const l of Object.values(por)) for (const r of l) for (const id of [r.item, r.segurando]) {
      if (!id || itensEvo[id]) continue;
      const it = itens[id];
      if (!it) { faltam.push(id); continue; }
      itensEvo[id] = { id: +id, n: it.n, ...(it.d != null ? { d: it.d } : {}), ...(it.t != null ? { t: it.t } : {}), ...(it.i != null ? { i: it.i } : {}), ...(it.q != null ? { q: it.q } : {}) };
    }
    if (faltam.length) { toast(`Item not in the game: ${[...new Set(faltam)].join(', ')} (use 0 + the name for "not in the game yet").`, true); return; }
    if (!await gravar(api, toast, 'evolucoes', por)) return;
    const novosItens = JSON.stringify(itensEvo) !== origItens;
    if (novosItens && !await gravar(api, toast, 'evolucoes_itens', itensEvo)) return;
    orig = JSON.stringify(por); origItens = JSON.stringify(itensEvo); marcar(); renderEditor();
    toast(`Evolutions saved (${Object.keys(por).length} species${novosItens ? ', evolution items updated' : ''}). Press F5 in the game to apply.`);
    avisarJogo('evolucoes');
  };
  await carregar();
}
