/* Item rules shared by the client (index.html, menus.mjs) and the server (server_bag.mjs), so both agree on what an item
   does and what it costs. Everything is keyed by item id: the names in menu_data.json are translated (English now), and
   the old name tests ("Hiper", "Máx", "Reanimador") stopped matching — Hyper/Max Potion healed 20 HP and Revive was
   refused as "fainted". */

/** HP restored by each medicine (Infinity = full). Potions keep the amounts the game always used. */
export const CURA = { 2001: 20, 2002: 60, 2003: 200, 2004: Infinity, 2005: Infinity, 2014: 30, 2015: 50, 2035: 20 };
/** Revives: fraction of max HP the fainted Pokémon comes back with. */
export const REANIMA = { 2012: 0.5, 2013: 1 };
/** PP restorers: `pp` per move (or 'cheio'), `todos` = every move instead of the emptiest one. */
export const PP = { 2022: { pp: 10, todos: false }, 2023: { pp: 'cheio', todos: false }, 2024: { pp: 10, todos: true }, 2025: { pp: 'cheio', todos: true } };

export const ehCura = id => Object.hasOwn(CURA, +id);
export const ehReanima = id => Object.hasOwn(REANIMA, +id);

/* POKÉMART: each city's mart has its own stock in the dump (menu_data.json `lojas`, 2150X01) and it already grows city by
   city — the first one sells only the Poké Ball, the next adds the Great Ball (400), and from 2150401 on there is the Ultra
   Ball (800). ESTOQUE_EXTRA adds entries on top of a shop, each unlocked by a number of badges. The dump's stock is kept as
   it is; the only additions are the fishing rods, which the dump doesn't have (ids 3101–3103, added to menu_data.json). */
export const ESTOQUE_EXTRA = {
  2150101: [{ item: 3101, n: 1, moeda: 1, preco: 1000, insignias: 0 }],      // Old Rod: from the start
  2150401: [{ item: 3102, n: 1, moeda: 1, preco: 15000, insignias: 2 }],     // Good Rod (also needs fishing mastery 1 to use)
  2150701: [{ item: 3103, n: 1, moeda: 1, preco: 50000, insignias: 4 }],     // Super Rod (fishing mastery 2)
};

/** The full stock of a shop: the dump's entries plus the extra ones, each with `insignias` (0 when always on sale). */
export function estoque(lojas, loja){
  const base = (lojas?.[loja] || []).map(l => ({ ...l, insignias: 0 }));
  const ids = new Set(base.map(l => +l.item));
  return base.concat((ESTOQUE_EXTRA[loja] || []).filter(l => !ids.has(l.item)));
}
/** The entry for `item` in `loja` and whether this many badges unlock it: { linha, liberado } or null. */
export function linhaDaLoja(lojas, loja, item, nInsignias = 0){
  const linha = estoque(lojas, loja).find(l => +l.item === +item);
  return linha ? { linha, liberado: (nInsignias || 0) >= (linha.insignias || 0) } : null;
}

/* ROLLER SKATES (Nov 2): a key item, never used up. From the Bag (or a 5–9 shortcut) it toggles skating: on foot the trainer
   moves PATINS_VEL× faster. GMs hand it out with /giveskates [name] (server_moderation.mjs `patins`). */
export const PATINS = 57900;
export const PATINS_VEL = 1.6;
