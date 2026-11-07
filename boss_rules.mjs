/* BOSSES (Nov 6): NPC bosses and Pokémon bosses whose level follows the player's party.
 *
 * Shared by the server (server_battle.mjs: builds the team, pays, rolls the catch), the game (index.html: the badge above the
 * boss, the challenge card) and the admin panel (schemas: validation). Data: public/data/bosses.json
 *   niveis  { cor: { nome, cor "#rrggbb", bonus, multDinheiro, multItens, ivs, recompensas[] } }   — the color tiers
 *   bosses  { id: boss }                                                                             — one entry per boss
 * A boss is placed on a map like a trainer: Map Editor → Points → "+ Boss" (the map's bosses[] list, {cfg, x, y, z, a}).
 *
 * LEVEL: every Pokémon of the boss is at (highest level in the player's party) + the tier bonus + its own `delta`
 * (0 = the ace; −3 = a weaker member), clamped to the boss's lvMin/lvMax and to 1–100.
 *
 * Boss fields:
 *   tipo 'npc' | 'pokemon' · nome · nivel (tier key) · glb (npc: scenery/npc/<glb>.glb; pokemon: the mon model, e.g. pm0130_00)
 *   time [{ dex, delta?, glb?, shiny? }]   (pokemon boss: one entry, the boss itself)
 *   lvMin? lvMax?  · dinheiro (base prize, × multDinheiro of the tier) · recompensas [{ item, qtd, chance? }] (qtd × multItens)
 *   repeticao 'sempre' | 'diaria' | 'umaVez' · cooldownMin (after a win) · cooldownDerrotaMin (after a loss)
 *   captura (pokemon boss) { ativa, modo 'chance'|'garantida', bonus (× ball bonus), tentativas, umaVez }
 *   fala[] vitoria[] derrota[]
 * A caught boss becomes an ORDINARY Pokémon: fresh random IVs and nature, no tier bonus; only `shiny` is kept from the boss. */

export const ORDEM_NIVEIS = ['cinza', 'vermelho', 'verde', 'azul', 'amarelo', 'laranja', 'roxo'];

export const NIVEIS_PADRAO = {
  cinza:    { nome: 'Gray',   cor: '#a7adb5', bonus: 0,  multDinheiro: 1,   multItens: 1, ivs: 10, recompensas: [] },
  vermelho: { nome: 'Red',    cor: '#ff4d4d', bonus: 5,  multDinheiro: 1.5, multItens: 1, ivs: 15, recompensas: [] },
  verde:    { nome: 'Green',  cor: '#3ddc6a', bonus: 10, multDinheiro: 2,   multItens: 2, ivs: 18, recompensas: [] },
  azul:     { nome: 'Blue',   cor: '#3d8bff', bonus: 20, multDinheiro: 3,   multItens: 2, ivs: 22, recompensas: [] },
  amarelo:  { nome: 'Yellow', cor: '#ffd23a', bonus: 30, multDinheiro: 4.5, multItens: 3, ivs: 25, recompensas: [] },
  laranja:  { nome: 'Orange', cor: '#ff8c1a', bonus: 40, multDinheiro: 6,   multItens: 4, ivs: 28, recompensas: [] },
  roxo:     { nome: 'Purple', cor: '#b05cff', bonus: 50, multDinheiro: 8,   multItens: 5, ivs: 31, recompensas: [] },
};

export const LV_MAX = 100;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const DIA_MS = 86400e3;

/** The tier table: the file's tiers over the defaults (a tier missing in the file keeps its default). */
export function niveis(dados) {
  const out = {};
  const doArq = dados?.niveis && typeof dados.niveis === 'object' ? dados.niveis : {};
  for (const k of new Set([...ORDEM_NIVEIS, ...Object.keys(doArq)])) out[k] = { ...(NIVEIS_PADRAO[k] || NIVEIS_PADRAO.cinza), ...(doArq[k] || {}) };
  return out;
}
export function nivelDe(dados, boss) {
  const T = niveis(dados);
  return T[boss?.nivel] || T.cinza;
}

/** Highest level in the party (fainted ones count too: the boss scales to what you OWN in the party, not what is standing). */
export function maiorNivel(time) {
  let m = 1;
  for (const p of time || []) if (p) m = Math.max(m, Math.round(+p.lv || 1));
  return clamp(m, 1, LV_MAX);
}

export function nivelMembro(maxLv, tier, boss, ent) {
  let lv = Math.round(+maxLv || 1) + (+tier?.bonus || 0) + (+ent?.delta || 0);
  if (Number.isFinite(+boss?.lvMin) && +boss.lvMin > 0) lv = Math.max(lv, +boss.lvMin);
  if (Number.isFinite(+boss?.lvMax) && +boss.lvMax > 0) lv = Math.min(lv, +boss.lvMax);
  return clamp(lv, 1, LV_MAX);
}

export const glbMon = (ent) => (ent?.glb ? String(ent.glb).replace(/\.glb$/, '') : 'pm' + String(ent?.dex || 0).padStart(4, '0') + '_00');

/** The boss's team for a party whose best level is `maxLv`: [{ dex, lv, glb, shiny, ivs }]. */
export function montarTime(dados, boss, maxLv) {
  const tier = nivelDe(dados, boss);
  const lista = boss?.tipo === 'pokemon' ? (boss.time || []).slice(0, 1) : (boss?.time || []).slice(0, 6);
  const ivs = clamp(Math.round(+tier.ivs || 15), 0, 31);
  return lista.filter((e) => +e?.dex > 0).map((e) => ({
    dex: +e.dex, lv: nivelMembro(maxLv, tier, boss, e), glb: glbMon(e), shiny: !!(e.shiny ?? (boss.tipo === 'pokemon' && boss.shiny)), ivs,
  }));
}

/** The prize for a win: money × multDinheiro, the boss's items (qty × multItens) plus the tier's own extras. */
export function recompensa(dados, boss) {
  const tier = nivelDe(dados, boss);
  const multI = Math.max(0, +tier.multItens || 1);
  const itens = [];
  for (const r of boss?.recompensas || []) if (+r?.item > 0) itens.push({ item: +r.item, qtd: Math.max(1, Math.round((+r.qtd || 1) * multI)), chance: r.chance == null ? 1 : clamp(+r.chance, 0, 1) });
  for (const r of tier.recompensas || []) if (+r?.item > 0) itens.push({ item: +r.item, qtd: Math.max(1, Math.round(+r.qtd || 1)), chance: r.chance == null ? 1 : clamp(+r.chance, 0, 1) });
  return { dinheiro: Math.max(0, Math.round((+boss?.dinheiro || 0) * (+tier.multDinheiro || 1))), itens };
}

/** Rolls each item's chance. */
export function sortearItens(itens, rng = Math.random) {
  return (itens || []).filter((r) => r.chance >= 1 || rng() < r.chance).map((r) => ({ item: r.item, qtd: r.qtd }));
}

const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/** Can this account fight the boss now? `reg` = save.bosses[id] ({ vitorias, ultimaVitoria, ultimaDerrota, capturado }).
    → { ok: true } or { ok: false, code: 'once' | 'daily' | 'wait', espera (ms) } */
export function disponivel(boss, reg, agora = Date.now()) {
  if (!boss) return { ok: false, code: 'target' };
  const r = reg || {};
  const rep = boss.repeticao || 'sempre';
  if (rep === 'umaVez' && (r.vitorias || 0) > 0) return { ok: false, code: 'once' };
  if (boss.tipo === 'pokemon' && boss.captura?.ativa && boss.captura?.umaVez !== false && r.capturado) return { ok: false, code: 'once' };
  if (rep === 'diaria' && r.ultimaVitoria && mesmoDia(r.ultimaVitoria, agora)) {
    const amanha = new Date(agora); amanha.setHours(24, 0, 0, 0);
    return { ok: false, code: 'daily', espera: amanha - agora };
  }
  const cdV = Math.max(0, +boss.cooldownMin || 0) * 60e3, cdD = Math.max(0, +boss.cooldownDerrotaMin || 0) * 60e3;
  const ate = Math.max(r.ultimaVitoria && cdV ? r.ultimaVitoria + cdV : 0, r.ultimaDerrota && cdD ? r.ultimaDerrota + cdD : 0);
  if (ate > agora) return { ok: false, code: 'wait', espera: ate - agora };
  return { ok: true };
}

/** The catch settings of a Pokémon boss, with defaults; null when it cannot be caught. */
export function captura(boss) {
  if (boss?.tipo !== 'pokemon' || !boss.captura?.ativa) return null;
  const c = boss.captura;
  return { modo: c.modo === 'garantida' ? 'garantida' : 'chance', bonus: Math.max(0.1, +c.bonus || 1), tentativas: clamp(Math.round(+c.tentativas || 3), 1, 20), umaVez: c.umaVez !== false, janelaS: clamp(Math.round(+c.janelaS || 90), 15, 600) };
}

/** Gen III shakes against a beaten boss (HP treated as 1/maxHp, like the raid catch). 4 = caught. */
export function sacudidas(rate, bonusBola, bonusBoss = 1, rng = Math.random) {
  const a = Math.max(1, +rate || 45) * Math.max(0.1, +bonusBola || 1) * Math.max(0.1, +bonusBoss || 1);
  if (a >= 255) return 4;
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / a));
  let n = 0;
  while (n < 4 && rng() * 65536 < b) n++;
  return n;
}

/** What the ordinary Pokémon looks like once caught: the boss's species, the battle level (or capturaLv), and its shiny. */
export function monCapturado(boss, ent) {
  const lv = Number.isFinite(+boss?.capturaLv) && +boss.capturaLv > 0 ? clamp(Math.round(+boss.capturaLv), 1, LV_MAX) : ent.lv;
  return { dex: ent.dex, lv, glb: String(ent.glb || glbMon(ent)).replace(/_s$/, ''), shiny: !!ent.shiny };
}

// ── admin validation ──────────────────────────────────────────────────────────────────────────────────────────────────
export function validarTime(v, tipo) {
  if (!Array.isArray(v) || !v.length) return 'a list of { "dex", "delta"? } (at least one)';
  if (v.length > 6) return 'up to 6 Pokémon';
  for (const [i, e] of v.entries()) {
    if (!e || !Number.isInteger(+e.dex) || +e.dex < 1 || +e.dex > 1025) return `#${i + 1}: "dex" between 1 and 1025`;
    if (e.delta != null && (!Number.isFinite(+e.delta) || Math.abs(+e.delta) > 50)) return `#${i + 1}: "delta" between -50 and 50`;
    if (e.glb != null && !/^[\w-]{1,40}$/.test(String(e.glb))) return `#${i + 1}: "glb" is a model name without .glb`;
  }
  if (tipo === 'pokemon' && v.length > 1) return 'a Pokémon boss has exactly one entry';
  return null;
}
export function validarRecompensas(v) {
  if (v == null) return null;
  if (!Array.isArray(v)) return 'a list of { "item", "qtd", "chance"? }';
  for (const [i, r] of v.entries()) {
    if (!r || !Number.isInteger(+r.item) || +r.item < 1) return `#${i + 1}: "item" is an item id`;
    if (r.qtd != null && (!Number.isInteger(+r.qtd) || +r.qtd < 1 || +r.qtd > 9999)) return `#${i + 1}: "qtd" between 1 and 9999`;
    if (r.chance != null && !(+r.chance >= 0 && +r.chance <= 1)) return `#${i + 1}: "chance" between 0 and 1`;
  }
  return null;
}
export function validarCaptura(v) {
  if (v == null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return 'an object { "ativa", "modo", "bonus", "tentativas", "umaVez" }';
  if (v.modo != null && !['chance', 'garantida'].includes(v.modo)) return '"modo" is "chance" or "garantida"';
  if (v.bonus != null && !(+v.bonus > 0 && +v.bonus <= 255)) return '"bonus" between 0.1 and 255';
  if (v.tentativas != null && !(Number.isInteger(+v.tentativas) && +v.tentativas >= 1 && +v.tentativas <= 20)) return '"tentativas" between 1 and 20';
  return null;
}
