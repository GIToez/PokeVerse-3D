/* TOURNAMENT WINDOW (Nov 6, v2 popups `torneio` + `torneio-como-funciona`): the crossed-swords button.
 * Tabs Entry · Bracket · My series · Rules · Rewards, and the "How the tournament works" walkthrough (?). Data: public/data/tournaments.json
 * (admin → Tournaments): the scheduled tournaments, the usual rules, the rewards and the walkthrough pages.
 * With nothing scheduled the Colosseum is closed: the Entry tab says so and "Sign up at the desk" is greyed out.
 * Sign-ups, brackets and matches come with the tournament server (not yet): the tabs show their empty states.
 *   instalar({ tr, defPopup(nome), abrirMapa(), segurar(el), aoFechar() })  ·  abrir(aba?) → false without the layout */
import * as Popup from './popup.mjs';

let ctx = {}, pop = null, popTut = null, dados = null, pagina = 0, relogio = 0;
const tr = (s, v) => ctx.tr?.(s, v) ?? s;
export function instalar(c) { ctx = c || {}; }
async function carregar() {
  if (!dados) dados = await fetch('./data/tournaments.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return dados || { torneios: [], regras: [], premios: {}, tutorial: [] };
}
const proximo = (D) => (D.torneios || []).filter((t) => t && Date.parse(t.fim || t.inicio) > Date.now()).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))[0] || null;
const no = (raiz, nome) => raiz?.querySelector('[data-fig="' + nome + '"]') || null;
const some = (el, s = false) => { if (el) el.style.display = s ? '' : 'none'; };
const todos = (raiz, sel) => [...(raiz?.querySelectorAll(sel) || [])];
function txt(raiz, id, t) { const els = todos(raiz, '[data-txt="' + id + '"]'); for (const el of els) el.textContent = t; return els[0] || null; }
const hora = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const falta = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') : m + ':' + String(s % 60).padStart(2, '0'); };

function montar() {
  if (pop?.isConnected) return pop;
  const def = ctx.defPopup?.('torneio'); if (!def) return null;
  pop = Popup.montar(def, {
    aba: (n) => mostrarAba(n),
    abre: (alvo) => {
      if (alvo === 'popup-mapa') { Popup.fechar(pop); ctx.abrirMapa?.(); return true; }
      if (alvo === 'popup-torneio-como-funciona') { abrirTutorial(); return true; }
      return false;
    },
    acao: () => {},
    fechar: () => { clearInterval(relogio); relogio = 0; ctx.aoFechar?.(); },
  });
  if (!pop) return null;
  pop.id = 'pf-torneio';
  return pop;
}
function mostrarAba(n) {
  if (!pop) return;
  some(no(pop, 'conteudo-inscricao'), n === 'inscricao');
  Popup.abaSolta(pop, n);
  marcarAba(n);
  /* the tab blocks' boxes reach up over the tab row: only their own buttons and lists take clicks */
  for (const d of pop.querySelectorAll(':scope > .pf-extra[data-aba-de]')) {
    d.style.pointerEvents = 'none';
    for (const b of d.querySelectorAll('[data-tag], [data-fig="lista-regras"], [data-fig="rola"]')) b.style.pointerEvents = 'auto';
  }
  pintar();
}
/* The layout draws Entry gold and the other four navy, with no "active" state of their own: the active tab borrows Entry's art */
function marcarAba(n) {
  const abas = ['inscricao', 'chave', 'serie', 'regras', 'premios'].map((id) => no(pop, 'aba-' + id)).filter(Boolean);
  const ouro = abas[0]?.dataset.arte, azul = abas[1]?.dataset.arte;
  if (!ouro || !azul) return;
  for (const a of abas) {
    const eh = a.dataset.tagval === n;
    a.style.backgroundImage = 'url(' + (eh ? ouro : azul) + ')';
    a.dataset.aba = eh ? 'ativa' : 'inativa';
    for (const t of a.querySelectorAll('[data-txt]')) t.style.color = eh ? '#1D2B45' : '#EAF6FB';
  }
}
function pintar() {
  const D = dados || {}, T = proximo(D), agora = Date.now();
  Popup.textoCru(pop, 'titulo', T ? tr(T.nome || 'Tournament') + (T.formato ? ' · ' + T.formato : '') : tr('Tournament'));
  for (const [id, en] of [['inscricao', 'Entry'], ['chave', 'Bracket'], ['serie', 'My series'], ['regras', 'Rules'], ['premios', 'Rewards']]) { const a = no(pop, 'aba-' + id); if (a) txt(a, 'aba', tr(en)); }
  /* Entry */
  const tel = no(pop, 'inscricao-telao'), meio = no(pop, 'inscricao-meio'), rod = no(pop, 'inscricao-rodape');
  txt(tel, 'selo-estado', T ? (agora < Date.parse(T.inicio) ? tr('SIGN-UPS OPEN') : tr('IN PROGRESS')) : tr('NO TOURNAMENT'));
  txt(tel, 'estado-noite', T ? tr('{x} · {f}', { x: tr(T.nome || 'Tournament'), f: T.formato || '1x1' }) : tr('No tournament is scheduled right now.'));
  some(no(tel, 'txt/presenca'), !!T); txt(tel, 'presenca', tr('Be in the Colosseum when it starts: being online and there is what counts for your matches.'));
  const rot = todos(tel, '[data-fig="rotulo-relogio"]'), rel = [no(tel, 'txt/relogio-comeca'), no(tel, 'txt/relogio-coliseu')];
  rot.forEach((r) => some(r, !!T)); rel.forEach((r) => some(r, !!T));
  if (T) {
    if (rot[0]) rot[0].textContent = tr('Starts in'); if (rot[1]) rot[1].textContent = tr('The Colosseum opens in');
    if (rel[0]) rel[0].textContent = falta(Date.parse(T.inicio) - agora); if (rel[1]) rel[1].textContent = falta(Date.parse(T.coliseuAbre || T.inicio) - agora);
  }
  const rg = no(meio, 'rotulo-guiche'); if (rg) rg.textContent = tr('Where to sign up');
  txt(meio, 'onde-guiche', tr('Entries, the reserve and the doubles team are all done at the tournament desk, in the Competition Center.'));
  txt(meio, 'balsa-dica', tr('The ferry to the Competition Center leaves from the Vermilion pier.'));
  const cc = no(meio, 'btn-como-chegar'); if (cc) (cc.querySelector('[data-fig="txt-btn"]') || {}).textContent = tr('How to get there (map)');
  for (const n of ['txt/reserva-resumo', 'txt/reserva-nota', 'txt/taxa', 'txt/saldo']) some(no(meio, n), false);
  todos(meio, '[data-fig="cabeca"]').forEach((c) => some(c, false));
  const ag = todos(meio, '[data-fig="rotulo-agenda"]'), agT = todos(meio, '[data-txt="agenda"]');
  ag.forEach((r) => some(r, !!T)); agT.forEach((r) => some(r, !!T));
  if (T) {
    [tr('Colosseum opens'), tr('Starts'), tr('Final')].forEach((s, i) => { if (ag[i]) ag[i].textContent = s; });
    [hora(Date.parse(T.coliseuAbre || T.inicio)), hora(Date.parse(T.inicio)), tr('best of 3')].forEach((s, i) => { if (agT[i]) agT[i].textContent = s; });
  }
  const bg = no(rod, 'btn-inscricao-guiche');
  if (bg) {
    (bg.querySelector('[data-fig="txt-btn"]') || {}).textContent = tr('Sign up at the desk');
    const ap = bg.querySelector('[data-fig="fx/apagado"]'); if (ap) ap.style.display = T ? 'none' : 'block';
    bg.style.opacity = T ? '' : '0.75'; bg.style.cursor = 'default'; bg.title = T ? tr('Talk to the clerk at the desk in the Competition Center.') : '';
  }
  const dica = no(rod, 'txt/dica-botao');
  if (dica) { dica.textContent = T ? tr('Talk to the clerk at the desk in the Competition Center to sign up.') : tr('The Colosseum is closed: no tournament is scheduled right now.'); dica.style.color = T ? '' : '#F58E8E'; }
  /* Bracket */
  const ch = Popup.extra(pop, 'conteudo-chave');
  if (ch) {
    txt(ch, 'noite-da-chave', T ? tr('The bracket comes out when the tournament starts.') : tr('No bracket: no tournament is scheduled right now.'));
    for (const n of ['partida', 'passa-direto', 'na-chave', 'rotulo-rodada', 'rotulo-melhor-de-3', 'btn-conferir-sorteio']) todos(ch, '[data-fig="' + n + '"]').forEach((e) => some(e, false));
    some(no(ch, 'txt/sorteio'), false);
  }
  /* My series */
  const se = Popup.extra(pop, 'conteudo-serie');
  if (se) {
    txt(se, 'serie-vazia', T ? tr('Your series shows up here when the bracket comes out, at {h}.', { h: hora(Date.parse(T.inicio)) }) : tr('Your series shows up here during a tournament.'));
    for (const n of ['txt/serie-contra', 'txt/serie-formato', 'txt/serie-placar', 'txt/serie-comeca', 'btn-arrumar-time']) some(no(se, n), false);
  }
  /* Rules */
  const re = Popup.extra(pop, 'conteudo-regras');
  if (re) {
    const r0 = re.querySelector('[data-fig="rotulo-regras-sempre"]'); if (r0) r0.textContent = tr('The usual rules');
    const ex = (T?.regrasExtra || []).slice(0, 7), lista = [...(D.regras || []).slice(0, 7 - ex.length), ...ex].map((x) => tr(x));   // 7 rows of art
    const g = no(re, 'lista-regras'), linhas = todos(g, '[data-txt="regra"]');
    if (g && linhas.length) {
            linhas.forEach((el, i) => { el.textContent = lista[i] || ''; some(el, !!lista[i]); });
      todos(g, '[data-fig="rotulo-abrir"]').forEach((e) => some(e, false));   // the designer's "open" row: our rules don't expand
      g.style.overflowY = 'auto'; g.style.pointerEvents = 'auto';
    }
  }
  /* Rewards */
  const pr = Popup.extra(pop, 'conteudo-premios'), P = D.premios || {};
  if (pr) {
    const cards = [P.primeiro, P.segundo, P.top4];
    ['premio-posicao', 'premio-titulo', 'premio-cosmetico', 'premio-pontos'].forEach((id) => {
      const k = { 'premio-posicao': 'posicao', 'premio-titulo': 'titulo', 'premio-cosmetico': 'cosmetico', 'premio-pontos': 'pontos' }[id];
      todos(pr, '[data-txt="' + id + '"]').forEach((el, i) => { el.textContent = cards[i]?.[k] ? tr(cards[i][k]) : ''; });
    });
    const la = todos(pr, '[data-txt="premio-linha-a"]'), lb = todos(pr, '[data-txt="premio-linha-b"]');
    (P.linhas || []).forEach((l, i) => { if (la[i]) la[i].textContent = tr(l.a || ''); if (lb[i]) lb[i].textContent = tr(l.b || ''); });
  }
}
export async function abrir(aba = 'inscricao') {
  await carregar();
  const p = montar(); if (!p) return false;
  Popup.abrir(p);
  ctx.segurar?.(p);
  Popup.trocarAba(p, aba);
  mostrarAba(aba);
  clearInterval(relogio); relogio = setInterval(() => { if (Popup.aberto(p)) pintar(); else { clearInterval(relogio); relogio = 0; } }, 1000);
  return true;
}
/* How the tournament works: page by page (the walkthrough's art is the designer's page 1; the rest are text pages for now) */
function abrirTutorial() {
  const def = ctx.defPopup?.('torneio-como-funciona'); if (!def) return;
  if (!popTut?.isConnected) {
    popTut = Popup.montar(def, { acao: (n) => { const N = (dados?.tutorial || []).length || 1; if (n === 'tutorial-proximo') pagina = Math.min(N - 1, pagina + 1); if (n === 'tutorial-anterior') pagina = Math.max(0, pagina - 1); pintarTutorial(); }, fechar: () => {} });
    if (!popTut) return;
    popTut.id = 'pf-torneio-tutorial'; popTut.style.zIndex = '960';
  }
  pagina = 0;
  Popup.abrir(popTut);
  pintarTutorial();
}
function pintarTutorial() {
  const L = dados?.tutorial || [], p = L[pagina] || {};
  Popup.textoCru(popTut, 'titulo', tr('How the tournament works'));
  Popup.textoCru(popTut, 'numero', String(pagina + 1));
  Popup.textoCru(popTut, 'tutorial-titulo', tr(p.titulo || ''));
  Popup.textoCru(popTut, 'tutorial-texto', tr(p.texto || ''));
  const chip = no(popTut, 'chip-quando'); if (chip) { some(chip, !!p.chip); Popup.textoCru(popTut, 'tutorial-chip', tr(p.chip || '')); }
  const img = popTut.querySelector('[data-var="tutorial-1"], [data-fig="img/tutorial-1"]'); if (img) img.style.visibility = pagina === 0 ? '' : 'hidden';
  const ok = no(popTut, 'btn-entendi'); if (ok) (ok.querySelector('[data-fig="txt-btn"]') || {}).textContent = tr('Got it');
  const nav = no(popTut, 'navegacao-tutorial');   // the page dots are baked in the bar's art (1st lit): ours go over them and follow the page
  if (nav) {
    let pts = nav.querySelector('.torneio-pontos');
    if (!pts) { pts = document.createElement('div'); pts.className = 'torneio-pontos'; Object.assign(pts.style, { position: 'absolute', left: '237px', top: '8px', width: '210px', height: '40px', background: 'rgb(12,1,93)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', pointerEvents: 'none' }); nav.appendChild(pts); }
    pts.innerHTML = L.map((_, i) => '<i style="display:block;height:12px;border-radius:6px;width:' + (i === pagina ? 30 : 12) + 'px;background:' + (i === pagina ? '#FF5CD6' : 'rgb(74,68,163)') + '"></i>').join('');
  }
  const ant = no(popTut, 'btn-anterior'), prox = no(popTut, 'btn-proximo');
  if (ant) ant.style.opacity = pagina === 0 ? '0.4' : ''; if (prox) prox.style.opacity = pagina >= L.length - 1 ? '0.4' : '';
}
