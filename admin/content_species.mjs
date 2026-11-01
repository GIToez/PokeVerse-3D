/* Painel admin — tela Espécies (Fase 2). Junta por nº da dex o que estava espalhado em vários arquivos e grava em cada um só o que
 * mudou, cada um pelo seu esquema (schemas_f2.mjs):
 *   altura real ........ heights.json (+ dex_extra.a)    → tamanho no campo (régua proporcional) e a ficha da Pokédex
 *   % de machos ........ genders.json (+ dex_extra.m/f)    → sorteio do sexo (knowledge.mjs) e a ficha
 *   ajuste de tamanho .. species.json { escala }         → AJUSTE_PROPORCIONAL do index.html (o Gastly 0,7 veio do código)
 *   descrição .......... idioma/dex_pt.json               → o texto da ficha em português (i18n.descricaoDex)
 *   EXP ................ exp.json → especies { c, b, a } → curva, EXP base e amizade base (evolution.mjs)
 *   modelos ............ cast.json (nome, forma) e sizes.json (MapSize do modo de tamanho "jogo")
 * O nome OFICIAL da espécie (pokedex.json) não muda aqui: o jogo usa ele como chave (dano, cadeia de evolução, elenco). */
import { esc, copia, campo, gravar, ler, ref, pad } from '/admin/content.mjs';
import { TIPOS, CURVAS } from '/admin/schemas_f2.mjs';

const ARQS = ['especies', 'alturas', 'sexos', 'tamanhos', 'descricoes_pt', 'dex_extra', 'elenco', 'exp_especies'];
/** A régua do index.html (alturaProporcional): h = 1,3 · real^0,55, entre 0,55 m e 3,2 m (selvagem) / 1,8 m (seguidor). */
const regua = (real, teto) => Math.min(teto, Math.max(0.55, 1.3 * Math.pow(real, 0.55)));
/** A chave do sizes.json de um modelo (chaveTamanho do index.html): pm0017_00 → pm0017; forma com chave própria → pm0487_11. */
const chaveTamanho = (glb, T) => { const m = String(glb).match(/^(pm\d{4})(?:_(\d\d))?/); if (!m) return null; return m[2] && m[2] !== '00' && T[m[1] + '_' + m[2]] != null ? m[1] + '_' + m[2] : m[1]; };
const fmt = n => Number(n).toLocaleString('en-US');

export async function montar(sec, { api, toast, avisarJogo, marcarSujo, tela }) {
  const [especies, modelosR] = await Promise.all([ref.especies(), api('/admin/modelos')]);
  const nomeSp = n => especies.get(+n)?.nome || `No. ${n}`;
  const maxDex = Math.max(...especies.keys());
  const glbsDe = {}; for (const { glb, dex } of modelosR.modelos || []) (glbsDe[dex] ||= []).push(String(glb).replace(/\.glb$/, ''));

  const D = {}, O = {};                                                      // D = em edição, O = como está no disco (texto)
  let curvas = {}, sel = null, filtro = '';
  sec.innerHTML = `
    <div class="col-esq"><div class="topo"><input type="search" class="busca" placeholder="search species (name or no.)…">
      <label class="chk"><input type="checkbox" class="soMud"> changed only</label></div><div class="lista"></div></div>
    <div class="col-dir"><div class="barra-topo"><h2>Species</h2><span class="sujo" hidden>● unsaved</span><button data-a="descartar">Discard</button><button class="prim" data-a="salvar">Save</button></div>
      <div class="fraco">Height, gender, field size, Pokédex description, EXP and the 3D models of each species. Each value lives in the file the game already reads
        (alturas, sexos, especies, idioma/dex_pt, exp, elenco, tamanhos) — saving writes only the ones that changed, with a backup in History. The game reads them at boot: F5 after saving.</div>
      <div class="editor"></div></div>`;
  const $ = s => sec.querySelector(s), lista = $('.lista'), editor = $('.editor');
  const sujos = () => ARQS.filter(a => JSON.stringify(D[a]) !== O[a]);
  const marcar = () => { const s = sujos().length > 0; $('.sujo').hidden = !s; marcarSujo(tela, s); };
  let origP = {};                                                           // cópia parseada do disco, pra marcar a espécie alterada na lista
  const daEspecie = (src, n) => {
    const els = (src.elenco || []).filter(e => e.n === n), ks = new Set(els.map(e => chaveTamanho(e.glb, src.tamanhos || {})).filter(Boolean));
    return JSON.stringify([src.especies?.[n], src.alturas?.[n], src.sexos?.[n], src.descricoes_pt?.[n], src.exp_especies?.[n], els, [...ks].map(k => src.tamanhos?.[k])]);
  };
  const mudouDex = n => daEspecie(D, n) !== daEspecie(origP, n);

  async function carregar() {
    const [rs, cv] = await Promise.all([Promise.all(ARQS.map(a => ler(api, toast, a))), ler(api, toast, 'exp_curvas')]);
    if (rs.some(r => r == null)) return;
    ARQS.forEach((a, i) => { D[a] = copia(rs[i]); O[a] = JSON.stringify(rs[i]); });
    origP = Object.fromEntries(ARQS.map(a => [a, JSON.parse(O[a])]));
    curvas = cv || {};
    marcar(); renderLista(); renderEditor();
  }

  // ── Lista ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  function renderLista() {
    const so = $('.soMud').checked, out = [];
    for (let n = 1; n <= maxDex; n++) {
      const nome = nomeSp(n);
      if (filtro && !`${n} ${pad(n)} ${nome}`.toLowerCase().includes(filtro)) continue;
      const mud = mudouDex(n);
      if (so && !mud) continue;
      out.push(`<button data-dex="${n}" class="${String(sel) === String(n) ? 'atual' : ''} ${mud ? 'mudou' : ''}"><span><span class="n">${pad(n)}</span> <b>${esc(nome)}</b></span><span class="n">${(especies.get(n)?.tipos || []).map(t => TIPOS[t] || t).join('/')}</span></button>`);
    }
    lista.innerHTML = out.join('') || '<div class="fraco" style="padding:8px">Nothing found.</div>';
    for (const b of lista.querySelectorAll('button')) b.onclick = () => { sel = +b.dataset.dex; renderLista(); renderEditor(); };
  }
  const atualizarLinha = () => { const b = lista.querySelector(`button[data-dex="${sel}"]`); if (b) b.classList.toggle('mudou', mudouDex(sel)); marcar(); };

  // ── Editor ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const cartao = (titulo, botoes = []) => {
    const c = document.createElement('div'); c.className = 'cartao';
    const cab = document.createElement('div'); cab.className = 'cab'; cab.innerHTML = `<b>${titulo}</b>`;
    for (const [rot, fn, cls] of botoes) { const b = document.createElement('button'); b.textContent = rot; if (cls) b.className = cls; b.onclick = fn; cab.append(b); }
    c.append(cab); return c;
  };
  const grade = () => { const g = document.createElement('div'); g.className = 'grade-campos'; return g; };

  function renderEditor() {
    editor.innerHTML = '';
    if (sel == null) { editor.innerHTML = '<div class="caixa fraco">Pick a species on the left.</div>'; return; }
    const n = sel, k = String(n), sp = especies.get(n);
    const X = D.dex_extra[k];                                               // ficha extra (pode faltar pra espécie nova)
    // ── espécie
    const ke = cartao(`${pad(n)} ${esc(nomeSp(n))} ${(sp?.tipos || []).map(t => `<span class="pilula">${esc(TIPOS[t] || t)}</span>`).join('')}`);
    const g = grade();
    const aj = () => D.especies[k]?.escala ?? 1;
    const m2 = x => x.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const dicaAltura = real => real > 0 ? `in the field: ~${m2(regua(real, 3.2) * aj())} m wild · ${m2(regua(real, 1.8) * aj())} m following the trainer` : '';
    const wAlt = campo({ rotulo: 'Real height (m)', tipo: 'num', valor: D.alturas[k], min: 0.01, max: 200, ajuda: 'The Pokédex height. The field size is derived from it (proportional scale, the default mode).', dica: dicaAltura,
      aoMudar: v => { if (v == null) return 'required (without a height the game uses the model size)'; D.alturas[k] = v; if (X) X.a = v; atualizarLinha(); } });
    const wAj = campo({ rotulo: 'Field size adjustment (×)', tipo: 'num', valor: D.especies[k]?.escala, min: 0.1, max: 5, ajuda: 'Multiplies the scale size. Empty = 1 (no adjustment). E.g. Gastly 0.7 (the gas cloud is not measured).',
      aoMudar: v => {
        if (v == null || v === 1) { if (D.especies[k]) { delete D.especies[k].escala; if (!Object.keys(D.especies[k]).length) delete D.especies[k]; } }
        else (D.especies[k] ||= {}).escala = v;
        wAlt.dica(dicaAltura(D.alturas[k])); atualizarLinha(); } });
    const sexoTxt = m => m == null ? '' : m < 0 ? 'genderless' : `♂ ${m}% · ♀ ${100 - m}%`;
    g.append(wAlt, wAj,
      campo({ rotulo: '% male', tipo: 'num', valor: D.sexos[k], min: -1, max: 100, ajuda: '-1 = genderless · 50 = half · 87.5 = 7 in 8 (starters) · 0 = female only.', dica: sexoTxt,
        aoMudar: v => { if (v == null) return 'required'; if (v < 0 && v !== -1) return 'use -1 for genderless'; D.sexos[k] = v; if (X) { X.m = v; X.f = v < 0 ? -1 : 100 - v; } atualizarLinha(); } }),
      campo({ rotulo: 'Pokédex description (Portuguese)', tipo: 'area', valor: D.descricoes_pt[k], classe: 'larga', max_len: 6000,
        ajuda: 'The entry text (Portuguese game; English lives in idioma/dex_en.json). Shown from species knowledge level 2.',
        aoMudar: v => { if (v == null || !v.trim()) delete D.descricoes_pt[k]; else D.descricoes_pt[k] = v; atualizarLinha(); } }));
    ke.append(g);
    const nota = document.createElement('div'); nota.className = 'mini';
    nota.textContent = 'The official name comes from pokedex.json and is a key in the game (damage, evolution chain, capture) — it cannot be changed here. Each model\'s name is under Models.';
    ke.append(nota);
    editor.append(ke);

    // ── EXP
    const kx = cartao('EXP and friendship');
    const E = D.exp_especies[k] || {}, Ee = () => (D.exp_especies[k] ||= Object.assign(E, { c: E.c || 'medium', b: E.b || 60, a: E.a ?? 70 }));   // espécie sem EXP ganha os padrões do jogo ao mexer
    const gx = grade();
    gx.append(
      campo({ rotulo: 'EXP curve', tipo: 'opcao', valor: E.c, opcoes: Object.entries(CURVAS), vazio: '—', dica: c => curvas[c] ? `Lv 100 = ${fmt(curvas[c][100])} EXP` : '',
        ajuda: 'Curves are in Data files → EXP curves.', aoMudar: v => { if (!v) return 'required'; Ee().c = v; atualizarLinha(); } }),
      campo({ rotulo: 'Base EXP (when defeated)', tipo: 'num', valor: E.b, min: 1, max: 1000, step: 1, ajuda: 'Used in the Gen 5+ formula: the higher it is, the more EXP it gives.', aoMudar: v => { if (!Number.isInteger(v)) return 'whole number from 1 to 1000'; Ee().b = v; atualizarLinha(); } }),
      campo({ rotulo: 'Base friendship', tipo: 'num', valor: E.a, min: 0, max: 255, step: 1, ajuda: 'Starting value (70 is typical; friendship evolutions trigger at 160).', aoMudar: v => { if (!Number.isInteger(v)) return 'whole number from 0 to 255'; Ee().a = v; atualizarLinha(); } }));
    kx.append(gx);
    editor.append(kx);

    // ── modelos (elenco + tamanhos do modo "jogo")
    const els = D.elenco.filter(e => e.n === n);
    const livres = (glbsDe[n] || []).filter(gl => !D.elenco.some(e => e.glb === gl));
    const km = cartao(`3D models (${els.length})`, livres.length ? [['＋ Model', () => {
      const gl = prompt('Which model? Available for this species:\n' + livres.join(', '), livres[0]); if (!gl) return;
      if (!livres.includes(gl.trim())) { toast('This model does not exist in scenery/mon (or is already in the cast).', true); return; }
      const i = D.elenco.findLastIndex(e => e.n <= n);
      D.elenco.splice(i + 1, 0, { n, nome: nomeSp(n), glb: gl.trim(), altura: 0 }); atualizarLinha(); renderEditor(); }]] : []);
    if (!els.length) { const v = document.createElement('div'); v.className = 'mini'; v.textContent = 'No model in the cast: this species does not appear in the game (not even as an evolution).'; km.append(v); }
    else {
      const t = document.createElement('table'); t.className = 'esp';
      t.innerHTML = '<thead><tr><th>Model</th><th>Name</th><th>Form</th><th title="Original game MapSize — only in the &quot;jogo&quot; size mode">Size (game mode)</th><th></th></tr></thead><tbody></tbody>';
      const tb = t.querySelector('tbody');
      for (const e of els) {
        const tr = document.createElement('tr'), td = () => document.createElement('td');
        const [t1, t2, t3, t4, t5] = [td(), td(), td(), td(), td()];
        t1.innerHTML = `<code>${esc(e.glb)}</code><div class="mini">model height ${e.altura ? e.altura + ' m' : '—'}</div>`;
        t2.append(campo({ rotulo: '', valor: e.nome, max_len: 40, aoMudar: v => { if (!v) return 'required'; e.nome = v; atualizarLinha(); } }));
        t3.append(campo({ rotulo: '', valor: e.nota, max_len: 40, aoMudar: v => { if (v) e.nota = v; else delete e.nota; atualizarLinha(); } }));
        const kt = chaveTamanho(e.glb, D.tamanhos);
        t4.append(campo({ rotulo: '', tipo: 'num', valor: D.tamanhos[kt], min: 0.01, max: 50, dica: () => kt ? 'key ' + kt + (kt.includes('_') ? '' : ' (applies to all forms without their own key)') : '',
          aoMudar: v => { if (!kt) return 'model has no key'; if (v == null) delete D.tamanhos[kt]; else D.tamanhos[kt] = v; atualizarLinha(); } }));
        const x = document.createElement('button'); x.textContent = '✕'; x.className = 'perigo'; x.title = 'Remove from cast';
        x.onclick = () => { if (!confirm(`Remove ${e.glb} from the cast? (the .glb file stays; the game stops using this model)`)) return; D.elenco.splice(D.elenco.indexOf(e), 1); atualizarLinha(); renderEditor(); };
        t5.append(x);
        tr.append(t1, t2, t3, t4, t5); tb.append(tr);
      }
      km.append(t);
      const v = document.createElement('div'); v.className = 'mini';
      v.textContent = 'The name and form appear in model lists (follower, evolution). The "jogo" mode size only applies with ?tamanhos=jogo — in the default mode the real height and adjustment decide.';
      km.append(v);
    }
    editor.append(km);
  }

  // ── Ações ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  $('.busca').oninput = e => { filtro = e.target.value.trim().toLowerCase(); renderLista(); };
  $('.soMud').onchange = renderLista;
  sec.querySelector('[data-a="descartar"]').onclick = () => { if (!sujos().length || confirm('Discard your changes?')) carregar(); };
  sec.querySelector('[data-a="salvar"]').onclick = async () => {
    if (sec.querySelector('.editor .invalido')) { toast('Fix the fields in red before saving.', true); return; }
    const lista2 = sujos(); if (!lista2.length) { toast('Nothing changed.'); return; }
    const feitos = [];
    for (const a of lista2) {
      if (!await gravar(api, toast, a, D[a])) { if (feitos.length) toast('Saved before the error: ' + feitos.join(', '), true); break; }
      O[a] = JSON.stringify(D[a]); feitos.push(a);
      avisarJogo(a === 'descricoes_pt' ? 'dex_pt' : a === 'exp_especies' ? 'exp' : a === 'dex_extra' ? 'dex_extra' : a);
    }
    origP = Object.fromEntries(ARQS.map(a => [a, JSON.parse(O[a])]));
    marcar(); renderLista();
    if (feitos.length === lista2.length) toast(`Species saved (${feitos.join(', ')}). Press F5 in the game to apply.`);
  };
  await carregar();
}
