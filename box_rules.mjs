/* BOX SLOTS (Nov 5): the Box holds a limited number of Pokémon. Everyone gets the base (Game settings → caixaBase, default 300) and
 * can buy more in the shop's Comfort tab (shop_products.json `vagasCaixa`: 50 slots per purchase, up to `teto` bought). With a full
 * Box (and a full team) you can't catch: the throw is refused before the ball is spent. Gifts, trades, raid prizes and mail still
 * arrive over the limit — nothing is ever lost.
 *   vagas(save, cfg) → slots   ·   cabe(save, cfg) → can one more Pokémon be caught   ·   AVISO */
import * as Med from './medallion.mjs';
export const BASE = 300;
export const base = (cfg) => (Number.isSafeInteger(+cfg?.caixaBase) && +cfg.caixaBase >= 30 ? +cfg.caixaBase : BASE);
export const vagas = (save, cfg) => base(cfg) + Math.max(0, Math.floor(+save?.caixaCompradas || 0)) + Med.vagasExtra(save, cfg);   // + the Medallion's slots while it runs
export function cabe(save, cfg) {
  const time = Array.isArray(save?.time) ? save.time.length : 0, caixa = Array.isArray(save?.caixa) ? save.caixa.length : 0;
  return time < 6 || caixa < vagas(save, cfg);
}
export const AVISO = 'Your Box is full ({n}/{n}). Buy Box slots in the Shop (Comfort tab) or release some Pokémon.';
export const aviso = (save, cfg) => AVISO.replace(/\{n\}/g, String(vagas(save, cfg)));
