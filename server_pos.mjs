/**
 * Last walk position for an account. The server owns spawn after F5 / relog:
 * the client cannot pick a door or edit localStorage to warp.
 *
 * A map change is stored only when this load came through a door (`porta`).
 * A jump of more than POS_PULO_M on the same map without a door is ignored
 * (spoofed `entrar` / `pos` / keepalive).
 */
export const POS_PULO_M = 40;

export function posLimpa(p, mapaPadrao){
  if (!p || typeof p !== 'object') return null;
  const mapa = String(p.mapa || mapaPadrao || '');
  if (!/^[\w.-]{1,40}$/.test(mapa)) return null;
  const x = +p.x, z = +p.z;
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 20000 || Math.abs(z) > 20000) return null;
  const y = +p.y, giro = +p.giro, chegada = +p.chegada;
  const out = {
    mapa,
    x: +x.toFixed(2),
    y: Number.isFinite(y) && Math.abs(y) < 2000 ? +y.toFixed(2) : 0,
    z: +z.toFixed(2),
    giro: Number.isFinite(giro) ? +giro.toFixed(3) : 0,
    em: Date.now()
  };
  if (Number.isFinite(chegada) && chegada > 0) out.chegada = chegada;
  return out;
}

export function posDaConta(c){
  if (!c) return null;
  return c.posGm || c.pos || null;
}

/** Decide whether `nextRaw` may replace the stored walk position. */
export function aceitarPos(prevRaw, nextRaw, { porta = false, mapaPadrao } = {}){
  const next = posLimpa(nextRaw, mapaPadrao || nextRaw?.mapa);
  const prev = posLimpa(prevRaw, prevRaw?.mapa);
  if (!next) return { pos: prev, mudou: false };
  if (prev && prev.mapa !== next.mapa && !porta) return { pos: prev, mudou: false };
  if (prev && prev.mapa === next.mapa && !porta){
    const d = Math.hypot(next.x - prev.x, next.z - prev.z);
    if (d > POS_PULO_M) return { pos: prev, mudou: false };
  }
  if (prev && prev.mapa === next.mapa
    && Math.abs(prev.x - next.x) < 0.08
    && Math.abs(prev.z - next.z) < 0.08
    && Math.abs((prev.giro || 0) - next.giro) < 0.03
    && (prev.chegada || 0) === (next.chegada || 0)) return { pos: prev, mudou: false };
  return { pos: next, mudou: true };
}
