/* BATTLE UI v2 (Nov 5): the v2 (Figma) pieces for turn battles and duels, drawn from ui/hud_layout_v2.json → situacao.
 *   convite({ tipo, titulo, info, aviso, preco, n, emblema, npc })  → Promise 'batalhar' | 'tentar-agora' | 'nao' (null = no layout)
 *     tipo: 'treinador' (trainer / duel) · 'ginasio' · 'ginasio-espera' (lost recently: pay to retry) · 'elite'
 *   fecharConvite()
 * index.html keeps the old box as the fallback (portrait phone, old saved layout). */
import * as Hud from './hud.mjs';
import { t as tr } from './i18n.mjs';

let aberto = null;
/* during a v2 turn the Bag button sits on the Poké Ball button's spot */
{ const st = document.createElement('style'); st.textContent = 'body.turno-v2 #bola-btn{visibility:hidden}'; document.head.appendChild(st); }
/* one key listener, registered when the module loads (before the game's own), so Esc / Enter reach the card first */
addEventListener('keydown', (e) => { if (aberto?.tecla) aberto.tecla(e); }, true);
export const conviteAberto = () => !!aberto;
export function fecharConvite(v = 'nao') { if (aberto) aberto.fim(v); }

const ESTADO = { treinador: null, duelo: null, ginasio: 'ginasio', 'ginasio-espera': 'ginasio-espera', elite: 'elite' };
const SELO = { treinador: 'CHALLENGE', duelo: 'DUEL', ginasio: 'GYM', 'ginasio-espera': 'GYM', elite: 'ELITE FOUR' };

export function convite({ tipo = 'treinador', titulo = '', info = '', aviso = '', preco = 0, n = 1, emblema = null, npc = null, botao = null } = {}) {
  const a = Hud.sit('convite-batalha');
  if (!a) return null;
  fecharConvite();
  Hud.sitEstado(a, ESTADO[tipo] || null);
  return new Promise((res) => {
    a.style.zIndex = '57';
    Hud.escrever(a, 'desafio-tipo', tr(SELO[tipo] || 'CHALLENGE'));
    Hud.escrever(a, 'desafio-titulo', titulo);
    Hud.escrever(a, 'desafio-info', info);
    Hud.escrever(a, 'desafio-aviso', aviso || '');
    const ex = (function acha(l){ for (const f of l || []){ if (f.nome === 'img/emblema-rival') return f.exemplo; const r = acha(f.filhos); if (r) return r; } return null; })(a.__sitDef?.filhos || Hud.sitDef('convite-batalha')?.filhos);
    Hud.figImagem(a, 'emblema-rival', emblema || ex, null, emblema ? null : 16);   // the mock-up's crossed swords unless a portrait is given
    /* the six dots: full ball for each Pokémon on the other side (the mock-up's bola-1 art), empty for the rest (bola-6's) */
    const bolas = [1, 2, 3, 4, 5, 6].map(k => Hud.fig(a, 'bola-' + k));
    if (bolas[0] && !a.__arteBolas) a.__arteBolas = { cheia: bolas[0].style.backgroundImage, vazia: bolas[5]?.style.backgroundImage || '' };
    if (a.__arteBolas) bolas.forEach((b, i) => { if (b) b.style.backgroundImage = i < n ? a.__arteBolas.cheia : a.__arteBolas.vazia; });
    const lutar = Hud.fig(a, 'btn-batalhar'), pagar = Hud.fig(a, 'btn-tentar-agora'), nao = Hud.fig(a, 'btn-agora-nao');
    if (lutar) Hud.escrever(a, 'rotulo', botao || tr(tipo === 'treinador' || tipo === 'duelo' ? 'Battle' : 'Challenge'), lutar);
    if (pagar) { Hud.escrever(a, 'rotulo', tr('Challenge now'), pagar); Hud.escrever(a, 'preco', Number(preco).toLocaleString('en-US'), pagar); }
    if (nao) Hud.escrever(a, 'rotulo', tr('Not now'), nao);
    let timer = 0;
    const posicionar = () => { Hud.sitEm(a, innerWidth / 2, innerHeight - Math.round(150 * Hud.escalaAtual()), 'base'); };
    const fim = (v) => {
      if (aberto?.a !== a) return;
      aberto = null;
      cancelAnimationFrame(timer);
      Hud.sitAo(a, null);
      Hud.sitMostrar(a, false);
      res(v);
    };
    const tecla = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;   // typing in the chat
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fim('nao'); }
      else if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); e.stopPropagation(); fim(pagar && tipo === 'ginasio-espera' ? 'tentar-agora' : 'batalhar'); }
    };
    for (const [el, v] of [[lutar, 'batalhar'], [pagar, 'tentar-agora'], [nao, 'nao']]) if (el) {
      el.style.cursor = 'pointer'; el.style.pointerEvents = 'auto';
      el.onclick = (e) => { e.stopPropagation(); fim(v); };
    }
    Hud.sitAo(a, (tag, val) => { if (tag === 'fecha') fim('nao'); else if (tag === 'acao') fim(val === 'tentar-agora' ? 'tentar-agora' : 'batalhar'); });
    aberto = { a, fim, tecla };
    const seguir = () => {
      if (aberto?.a !== a) return;
      if (npc?.longe?.()) { fim('nao'); return; }                      // walked away from the trainer
      posicionar();
      timer = requestAnimationFrame(seguir);
    };
    posicionar();
    Hud.sitMostrar(a, true);
    timer = requestAnimationFrame(seguir);
  });
}

/* ── TURN BAR v2 (Nov 5) ──────────────────────────────────────────────────────────────────────────────────────────────────
 * The v2 layout draws the turn-battle extras as one frame (`turno-v2`, sized to the 1920×900 mock-up). Its parts are pinned here to
 * the real HUD pieces they sit next to, so they line up on any screen: the glow and the whose-turn / weather pills over the move bar
 * (#skills), the Bag button in place of the Poké Ball button (#bola-btn), Forfeit above the right end of the move bar, Switch above
 * the team panel (#time-hud). The moves are the normal move slots (index.html's usarGolpe sends them to the turn engine).
 *   turno({ ativo, minhaVez, rodada, clima, tecla, podeTrocar, acoes: { mochila, trocar, desistir }, textoDesistir })
 *   resultado({ vitoria, desistiu }) · premio(texto) */
const PARTES = {   // part of turno-v2 → the HUD piece it is pinned to
  'realce-vez': 'skills', 'pilula-vez': 'skills', clima: 'skills', 'btn-turno-desistir': 'skills',
  'btn-turno-mochila': 'bola-btn', 'btn-turno-trocar': 'time-hud', 'dica-troca': 'time-hud',
};
let T2 = null;                                                    // { preset, frame, nos: {parte: def}, ancoras: {piece: {x,y,w,h} in mock-up px} }
function prepararTurno() {
  const L = Hud.layoutAtual?.(), preset = Hud.presetAtual?.();
  if (!L || preset !== 'pc') return null;                         // phones: the old box (the frame's anchors are the PC mock-up's)
  if (T2?.L === L) return T2;
  const pecas = L.pc, f = pecas?.['turno-v2'], tela = L._figma?.tela || { w: 1920, h: 900 };
  if (!f?.figma?.filhos) return null;
  const caixa = (p) => p && ({ x: p.ax === 'right' ? tela.w - p.x - p.w : p.x, y: p.ay === 'bottom' ? tela.h - p.y - p.h : p.y, w: p.w, h: p.h });
  const frame = caixa(f), nos = {};
  for (const n of f.figma.filhos) if (PARTES[n.nome]) nos[n.nome] = n;
  const ancoras = {}; for (const a of new Set(Object.values(PARTES))) ancoras[a] = caixa(pecas[a]);
  /* each part becomes a situational piece of its own (Hud.sit draws from layout.situacao), named tv2-<part> */
  L.situacao ||= {}; L.situacao.pc ||= {};
  for (const [k, n] of Object.entries(nos)) L.situacao.pc['tv2-' + k] = { ...n, nome: 'tv2-' + k, x: 0, y: 0 };
  T2 = { L, frame, nos, ancoras };
  return T2;
}
function pinar(el, parte) {
  const n = T2.nos[parte], a = T2.ancoras[PARTES[parte]], dom = document.getElementById(PARTES[parte]);
  if (!el || !n || !a || !dom || dom.style.display === 'none') return false;
  const r = dom.getBoundingClientRect(); if (!r.width) return false;
  const k = r.width / a.w, x = r.left + (T2.frame.x + n.x - a.x) * k, y = r.top + (T2.frame.y + n.y - a.y) * k;
  Hud.sitEm(el, x, y, 'topo');
  return true;
}
const vistos = new Set();
function peca(nome, mostrar) {
  const el = Hud.sit(nome, { ocultos: true });
  if (!el) return null;
  el.style.zIndex = '36';
  Hud.sitMostrar(el, mostrar);
  if (mostrar) vistos.add(nome);
  return el;
}
let trocando = false, tturno = null;
export function turnoV2Ativo() { return !!prepararTurno(); }
export function turno(s) {
  if (!s?.ativo || !prepararTurno()) { for (const n of vistos) Hud.sitMostrar(Hud.sit(n), false); vistos.clear(); trocando = false; tturno = null; document.body.classList.remove('turno-v2'); fecharDesistir(); return false; }
  tturno = s;
  document.body.classList.add('turno-v2');                       // CSS hides the Poké Ball button under the Bag button
  const vez = !!s.minhaVez;
  const realce = peca('tv2-realce-vez', vez); if (realce) { realce.style.pointerEvents = 'none'; pinar(realce, 'realce-vez'); }
  /* whose turn: the mock-up's gold "YOUR TURN" pill, or the grey "WAIT" one (situacao.pilula-vez, state aguarde) */
  const pv = peca('tv2-pilula-vez', vez), pa = peca('pilula-vez', !vez);
  if (pv) { Hud.escrever(pv, 'vez', tr('YOUR TURN')); Hud.escrever(pv, 'rodada', tr('Round {n}', { n: s.rodada || 1 })); pinar(pv, 'pilula-vez'); }
  if (pa) { Hud.sitEstado(pa, 'aguarde'); Hud.escrever(pa, 'vez', tr('WAIT')); Hud.escrever(pa, 'rodada', tr('Round {n}', { n: s.rodada || 1 })); pinar(pa, 'pilula-vez'); }
  const cl = peca('tv2-clima', !!s.clima); if (cl && s.clima) { Hud.escrever(cl, 'clima', s.clima); pinar(cl, 'clima'); }
  const bag = peca('tv2-btn-turno-mochila', true);
  if (bag) {
    Hud.escrever(bag, 'tecla', s.tecla || 'I');
    const selo = Hud.fig(bag, 'selo-curas'); if (selo) selo.style.display = s.curas != null ? '' : 'none';
    if (s.curas != null) Hud.escrever(bag, 'curas', String(s.curas));
    clicavel(bag, vez, () => s.acoes?.mochila?.());
    pinar(bag, 'btn-turno-mochila');
  }
  const tro = peca('tv2-btn-turno-trocar', true);
  if (tro) {
    Hud.escrever(tro, 'rotulo', trocando ? tr('Cancel') : tr('Switch Pokémon'));
    clicavel(tro, vez && s.podeTrocar, () => { trocando = !trocando; turno(tturno); });
    pinar(tro, 'btn-turno-trocar');
  }
  if (!vez || !s.podeTrocar) trocando = false;
  const dica = peca('tv2-dica-troca', trocando); if (dica) { Hud.escrever(dica, 'dica-troca', tr('Click who goes in · Esc cancels')); pinar(dica, 'dica-troca'); }
  const des = peca('tv2-btn-turno-desistir', true);
  if (des) { Hud.escrever(des, 'rotulo', tr('Forfeit')); clicavel(des, vez, () => abrirDesistir(s)); pinar(des, 'btn-turno-desistir'); }
  return true;
}
function clicavel(el, ligado, fn) {
  el.style.pointerEvents = 'auto'; el.style.cursor = ligado ? 'pointer' : 'default';
  el.style.filter = ligado ? '' : 'grayscale(.7) brightness(.75)';
  el.onclick = (e) => { e.stopPropagation(); if (ligado) fn(); };
}
addEventListener('resize', () => { if (tturno) turno(tturno); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && trocando && tturno) { trocando = false; turno(tturno); } });
/** Called by index.html when a team slot was picked: the switch hint closes. */
export function trocou() { if (trocando) { trocando = false; if (tturno) turno(tturno); } }

/* forfeit: "Forfeit the battle?" Continue / Forfeit */
let desAberto = null;
function fecharDesistir() { if (desAberto) { Hud.sitMostrar(desAberto, false); desAberto = null; } }
function abrirDesistir(s) {
  const a = Hud.sit('dialogo-desistir');
  if (!a) { s.acoes?.desistir?.(); return; }
  if (s.elite) Hud.sitEstado(a, 'elite');
  Hud.escrever(a, 'dialogo-titulo', tr('Forfeit the battle?'));
  Hud.escrever(a, 'dialogo-texto', s.textoDesistir || tr('No prize, and no Coins lost.'));
  const cont = Hud.fig(a, 'btn-continuar'), conf = Hud.fig(a, 'btn-confirmar');
  if (cont) { Hud.escrever(a, 'rotulo', tr('Continue'), cont); cont.style.pointerEvents = 'auto'; cont.style.cursor = 'pointer'; cont.onclick = (e) => { e.stopPropagation(); fecharDesistir(); }; }
  if (conf) { Hud.escrever(a, 'rotulo', tr('Forfeit'), conf); conf.style.pointerEvents = 'auto'; conf.style.cursor = 'pointer'; conf.onclick = (e) => { e.stopPropagation(); fecharDesistir(); s.acoes?.desistir?.(); }; }
  a.style.zIndex = '58';
  Hud.sitEm(a, innerWidth / 2, innerHeight * 0.42, 'meio');
  Hud.sitMostrar(a, true);
  desAberto = a;
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && desAberto) { e.stopImmediatePropagation(); fecharDesistir(); } }, true);

/* result banner: VICTORY! / DEFEAT, then the prize line when the game knows it */
let faixa = null, faixaT = 0;
export function resultado({ vitoria = false, desistiu = false } = {}) {
  const a = Hud.sit('faixa-resultado');
  if (!a) return false;
  Hud.sitEstado(a, vitoria ? null : 'derrota');
  Hud.escrever(a, 'resultado', vitoria ? tr('VICTORY!') : desistiu ? tr('YOU RAN') : tr('DEFEAT'));
  Hud.escrever(a, 'resultado-premio', '');
  const ins = Hud.fig(a, 'img/insignia-ganha'); if (ins) ins.style.display = 'none';
  a.style.zIndex = '58'; a.style.pointerEvents = 'none';
  Hud.sitEm(a, innerWidth / 2, Math.round(innerHeight * 0.14), 'topo-meio');
  Hud.sitMostrar(a, true);
  faixa = a; clearTimeout(faixaT);
  /* in a duel the HUD re-lays out right after the fight (the other player's turn ends too) and that hid the banner after ~1 s:
     it holds itself up until its own 3.8 s are over */
  const ate = Date.now() + 3800;
  const segurar = () => { if (faixa !== a) return; if (Date.now() >= ate) { Hud.sitMostrar(a, false); faixa = null; return; } if (a.hidden) Hud.sitMostrar(a, true); faixaT = setTimeout(segurar, 100); };
  faixaT = setTimeout(segurar, 100);
  return true;
}
export function premio(texto, insignia = null) {
  if (!faixa) return;
  Hud.escrever(faixa, 'resultado-premio', texto || '');
  if (insignia) { const f = Hud.figImagem(faixa, 'insignia-ganha', insignia); if (f) f.style.display = ''; }
}
