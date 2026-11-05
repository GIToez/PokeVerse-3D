/* SAFARI ZONE, v2 UI (Nov 5, ported from upcoming/safari_game.mjs).
   Three situational pieces from ui/hud_layout_v2.json (`situacao.pc` / `situacao.celular_deitado`):
     painel-safari     balls ×n, zone name and the time left (m:ss), under the live raid card while a visit is on
     dialogo-safari    the warden: "Enter (500 Coins)" / "Not now", or the balls and time left during a visit
     aviso-safari-fim  "Safari visit over" + the reason, for 4.5 s
   Every function returns false / null when the layout has no such piece, so index.html falls back to the old speech box. */
import { t as tr } from './i18n.mjs';
import * as Hud from './hud.mjs';

export const relogio = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
const nomeDaZona = () => {
  const a = document.getElementById('mm-area')?.textContent || '';
  return /saf[aá]ri/i.test(a) ? a : tr('Safari Zone');
};

/* ── painel-safari ── */
let ultimoPainel = '';
export function painel(sessao) {
  const a = Hud.sit('painel-safari');
  if (!a) return false;
  const viva = !!(sessao && sessao.fim > Date.now() && sessao.restantes > 0);
  if (viva) {
    Hud.escrever(a, 'safari-bolas', '×' + sessao.restantes);
    Hud.rotular(a, 'rotulo-safari', nomeDaZona());
    Hud.escrever(a, 'safari-tempo', relogio(sessao.fim - Date.now()));
    const k = Hud.escalaAtual(), w = (parseFloat(a.style.width) || 360) * k;
    a.style.zIndex = '33';
    const raid = document.getElementById('alerta-raid');
    const r = raid && !raid.hidden && raid.style.display !== 'none' && raid.offsetParent !== null ? raid.getBoundingClientRect() : null;
    const pos = r && r.width ? [Math.max(8, r.right - w), r.bottom + 8 * k] : [innerWidth - 16 - w, 248];
    const chave = pos.map(Math.round).join(',') + '|' + innerWidth;
    if (chave !== ultimoPainel || a.hidden) { Hud.sitEm(a, pos[0], pos[1], 'topo'); ultimoPainel = chave; }
  }
  Hud.sitMostrar(a, viva);
  return true;
}

/* ── dialogo-safari ──
   Resolves 'entrar' (paid button), 'nao' (Not now / Ok / walked away) or null when the layout has no dialogue. `npc` = the warden
   ({x, y, z, vx, vy, vz}) so the box floats over the warden's head; `longe()` tells when the player walked off. */
let aberto = null;
export function fecharDialogo() {
  if (aberto) aberto.fim('nao');
}
export const dialogoAberto = () => !!aberto;
export function dialogo({ npc, nome, sessao, preco = 500, bolas = 30, minutos = 20, longe = () => false }) {
  const a = Hud.sit('dialogo-safari');
  if (!a) return null;
  fecharDialogo();
  return new Promise((res) => {
    const viva = !!(sessao && sessao.fim > Date.now());
    a.style.zIndex = '57';
    Hud.escrever(a, 'npc-nome', nome || tr('Safari Warden'));
    const entrar = Hud.fig(a, 'btn-entrar-safari'), nao = Hud.fig(a, 'btn-agora-nao');
    if (viva) {
      Hud.escrever(a, 'fala', tr('You have {n} Safari Balls and {x} left. Leave the Zone and the visit ends.', { n: sessao.restantes, x: relogio(sessao.fim - Date.now()) }));
      if (entrar) entrar.style.display = 'none';
      Hud.rotular(a, 'txt-btn', tr('Ok'), nao);
    } else {
      Hud.escrever(a, 'fala', tr('Welcome to the Safari Zone! You get {b} Safari Balls and {m} minutes. Your Pokémon stay in their Balls. Ready?', { b: bolas, m: minutos }));
      if (entrar) { entrar.style.display = 'block'; entrar.dataset.desligado = '0'; entrar.style.opacity = '1'; }
      Hud.rotular(a, 'txt-btn', tr('Enter ({x} Coins)', { x: Number(preco).toLocaleString('en-US') }), entrar);
      Hud.rotular(a, 'txt-btn', tr('Not now'), nao);
    }
    let timer = 0;
    const posicionar = () => {
      if (!npc || !Hud.sitSeguir(a, npc, 0.35)) Hud.sitEm(a, innerWidth / 2, innerHeight - 130, 'base');
      const k = Hud.escalaAtual(), h = (parseFloat(a.style.height) || 100) * k;
      const teto = Math.round(innerHeight * (document.body.classList.contains('mobile') ? 0.19 : 0.12));
      if ((parseFloat(a.style.top) || 0) - h < teto) a.style.top = Math.round(teto + h) + 'px';
    };
    const fim = (v) => {
      if (aberto?.a !== a) return;
      aberto = null;
      cancelAnimationFrame(timer);
      removeEventListener('keydown', tecla, true);
      Hud.sitAo(a, null);
      Hud.sitMostrar(a, false);
      res(v);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); fim('nao'); }
      else if (e.key === 'Enter' && !e.repeat && !viva) { e.preventDefault(); e.stopPropagation(); fim('entrar'); }
    };
    Hud.sitAo(a, (tag, val) => {
      if (tag === 'fecha') fim('nao');
      else if (tag === 'acao' && (!val || val === 'entrar-safari') && !viva && entrar?.dataset.desligado !== '1') fim('entrar');
    });
    /* The live hud's situational pieces don't carry data-tag, so the two buttons get their own click handlers. */
    for (const [el, v] of [[entrar, 'entrar'], [nao, 'nao']]) if (el) {
      el.style.cursor = 'pointer'; el.style.pointerEvents = 'auto';
      el.onclick = (e) => { e.stopPropagation(); if (v === 'entrar' && (viva || el.dataset.desligado === '1')) return; fim(v); };
    }
    aberto = { a, fim };
    addEventListener('keydown', tecla, true);
    const seguir = () => {
      if (aberto?.a !== a) return;
      if (longe()) { fim('nao'); return; }
      posicionar();
      timer = requestAnimationFrame(seguir);
    };
    posicionar();
    Hud.sitMostrar(a, true);
    timer = requestAnimationFrame(seguir);
  });
}

/* ── aviso-safari-fim ── */
const MOTIVO = {
  tempo: "Time's up. Back to the gate…",
  bolas: 'Out of Safari Balls. Back to the gate…',
  saiu: 'You left the Safari Zone. The leftover Safari Balls stay at the gate.',
  fora: 'You left the Safari Zone.',
};
let avisoTimer = 0;
export function avisoFim(motivo) {
  const a = Hud.sit('aviso-safari-fim');
  if (!a) return false;
  Hud.escrever(a, 'safari-fim-titulo', tr('Safari visit over'));
  Hud.escrever(a, 'safari-fim-motivo', tr(MOTIVO[motivo] || 'The Safari visit is over.'));
  a.style.zIndex = '37';
  Hud.sitEm(a, innerWidth / 2, Math.round(innerHeight * 0.16), 'topo-meio');
  Hud.sitMostrar(a, true);
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => Hud.sitMostrar(a, false), 4500);
  return true;
}
