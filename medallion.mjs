/* THE MEDALLION'S PERKS (Nov 7), in one place. Each Medallion used adds 30 days (up to 90: server_bag.mjs); while
 * save.medalhaoAte is in the future the account gets:
 *   xp        +% EXP for its Pokémon (wild KOs and trainer battles)
 *   vagas     extra Box slots (box_rules.mjs)
 *   anuncios  extra Market listings (server_market.mjs)
 *   recarga   −% cooldown on Travel and Teleport (server_travel.mjs)
 *   selo      the member badge next to the name in chat
 * The numbers live in Game settings (game_config.json → medalhao); a missing field uses PADRAO. The server calls
 * usarConfig(cfgJogo) once; the client's shop text reads the same numbers from game_config.json. */
export const PADRAO = Object.freeze({ xp: 20, vagas: 100, anuncios: 10, recarga: 50, selo: true });

let lerCfg = () => ({});
export function usarConfig(f) { if (typeof f === 'function') lerCfg = f; }

export function perks(cfg = null) {
  let m = null;
  try { m = (cfg || lerCfg() || {}).medalhao; } catch {}
  const o = { ...PADRAO };
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    for (const k of ['xp', 'vagas', 'anuncios', 'recarga']) if (Number.isFinite(+m[k]) && +m[k] >= 0) o[k] = +m[k];
    if (typeof m.selo === 'boolean') o.selo = m.selo;
  }
  o.recarga = Math.min(95, o.recarga);
  o.vagas = Math.floor(o.vagas); o.anuncios = Math.floor(o.anuncios);
  return o;
}
export const ativo = (save, agora = Date.now()) => (+save?.medalhaoAte || 0) > agora;
export const xpMult = (save, cfg) => (ativo(save) ? 1 + perks(cfg).xp / 100 : 1);
export const vagasExtra = (save, cfg) => (ativo(save) ? perks(cfg).vagas : 0);
export const anunciosExtra = (save, cfg) => (ativo(save) ? perks(cfg).anuncios : 0);
export const recargaMult = (save, cfg) => (ativo(save) ? 1 - perks(cfg).recarga / 100 : 1);
export const selo = (save, cfg) => ativo(save) && perks(cfg).selo;
