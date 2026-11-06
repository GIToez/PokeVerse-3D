/* CONTROL YOUR POKÉMON (Nov 6) — in the overworld you can take control of your partner, as in the raid arenas: WASD / joystick /
 * clicking the ground move the Pokémon, the camera follows it, the move keys attack as usual; the trainer waits where it stood.
 * C (Controls → "Control your Pokémon") or the paw button switches back and forth. It stays on after a fight ends.
 * Rules: real-time only (not in turn-based trainer battles or duels, not in raids — they have their own), not mounted or surfing,
 * the partner must be out and standing; 3 s between switches; the Pokémon can't go more than LEASH m from the trainer; no Poké
 * Balls while you control it (switch back to throw); it hands control back by itself when it faints or something above starts.
 *   instalar({ tr, jogo, aviso(texto), podeAgora() → motivo|null, aoMudar(ativo) })
 *   alternar() · ativo() · sair(motivo?) · quadro(dt) (cooldown, auto exit, the button) · passo(entrada, dt, deslocar) → moved?
 *   noLimite(x, z) → whether that point is inside the leash */
export const LEASH = 12, ESPERA = 3;
let ctx = {}, on = false, cd = 0, btn = null;
const tr = (s, v) => ctx.tr?.(s, v) ?? s;

export function instalar(c) { ctx = c || {}; botao(); }
export const ativo = () => on;

function botao() {
  if (btn || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = `#pk-controle{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:212px;z-index:40;width:52px;height:52px;border-radius:50%;
border:2px solid #2FA8EE;background:radial-gradient(circle at 50% 35%,#1B4A9A,#0C1D42);color:#fff;font:700 22px/1 system-ui;cursor:pointer;
box-shadow:0 4px 14px #0008;display:none;align-items:center;justify-content:center;padding:0}
#pk-controle.on{border-color:#F8C237;background:radial-gradient(circle at 50% 35%,#FBD04B,#C98A12);color:#1A1405}
#pk-controle .cd{position:absolute;inset:0;border-radius:50%;background:conic-gradient(#0009 var(--p,0%),transparent 0)}
#pk-controle small{position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);font:800 10px 'Nunito Sans',system-ui;color:#fff;
text-shadow:0 1px 2px #000;white-space:nowrap}`;
  document.head.appendChild(s);
  btn = document.createElement('button');
  btn.id = 'pk-controle';
  btn.type = 'button';
  btn.innerHTML = '<span class="cd"></span>🐾<small>C</small>';
  btn.addEventListener('click', (e) => { e.stopPropagation(); alternar(); });
  document.body.appendChild(btn);
}

export function alternar() {
  if (on) return sair(null), true;
  if (cd > 0) { ctx.aviso?.(tr('Wait {n} s to switch again.', { n: Math.ceil(cd) })); return false; }
  const motivo = ctx.podeAgora?.();
  if (motivo) { ctx.aviso?.(tr(motivo)); return false; }
  on = true; cd = ESPERA;
  ctx.aoMudar?.(true);
  return true;
}
/** Back to the trainer. `motivo` (a short line) is shown when the game ends it, not when the player switches. */
export function sair(motivo) {
  if (!on) return;
  on = false; cd = ESPERA;
  if (motivo) ctx.aviso?.(tr(motivo));
  ctx.aoMudar?.(false);
}
export function noLimite(x, z) {
  const a = ctx.jogo?.ash;
  return !a || Math.hypot(x - a.x, z - a.z) <= LEASH;
}
/** Moves the partner by the player's input. The leash: a step that would end past LEASH m slides along it instead. */
export function passo(entrada, dt, deslocar) {
  const p = ctx.jogo?.pika, a = ctx.jogo?.ash;
  if (!p || !a || !entrada || entrada.lengthSq() === 0) return false;
  const n = Math.hypot(entrada.x, entrada.z), v = (p.vel || 4.2) * dt;
  let dx = (entrada.x / n) * v, dz = (entrada.z / n) * v;
  const nx = p.x + dx - a.x, nz = p.z + dz - a.z, d = Math.hypot(nx, nz);
  if (d > LEASH) {                                       // keep only the part of the step along the circle
    const ux = nx / d, uz = nz / d, saida = dx * ux + dz * uz;
    if (saida > 0) { dx -= ux * saida; dz -= uz * saida; }
    if (Math.hypot(dx, dz) < 1e-4) return false;
  }
  p.destino = null;
  p.giro = Math.atan2(dx, dz);
  return !!deslocar(p, dx, dz);
}
export function quadro(dt) {
  if (cd > 0) cd = Math.max(0, cd - dt);
  const j = ctx.jogo;
  if (on && j) {
    const p = j.pika;
    if (!p || p.recolhido || !(p.hp > 0) || p.desmaiado > 0) sair('Your Pokémon fainted: back to your trainer.');
    else { const m = ctx.podeAgora?.(); if (m) sair(m); }
  }
  if (btn) {
    const mostra = !!(j?.ash && j.pika && (on || !ctx.podeAgora?.()));
    btn.style.display = mostra ? 'flex' : 'none';
    btn.classList.toggle('on', on);
    btn.title = on ? tr('Back to your trainer (C)') : tr('Control your Pokémon (C)');
    btn.style.setProperty('--p', cd > 0 ? Math.round((cd / ESPERA) * 100) + '%' : '0%');
  }
}
