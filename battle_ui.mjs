/* BATTLE UI v2 (Nov 5): the v2 (Figma) pieces for turn battles and duels, drawn from ui/hud_layout_v2.json → situacao.
 *   convite({ tipo, titulo, info, aviso, preco, n, emblema, npc })  → Promise 'batalhar' | 'tentar-agora' | 'nao' (null = no layout)
 *     tipo: 'treinador' (trainer / duel) · 'ginasio' · 'ginasio-espera' (lost recently: pay to retry) · 'elite'
 *   fecharConvite()
 * index.html keeps the old box as the fallback (portrait phone, old saved layout). */
import * as Hud from './hud.mjs';
import { t as tr } from './i18n.mjs';

let aberto = null;
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
