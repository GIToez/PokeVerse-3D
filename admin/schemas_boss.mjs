/* BOSSES (Nov 6): the two data-editor screens for public/data/bosses.json (rules: boss_rules.mjs; battle: server_battle.mjs).
 *   Boss tiers (niveis)  — the colors: level bonus over the party's best Pokémon, prize multipliers, the IVs of the boss's Pokémon
 *   Bosses (bosses)      — one record per boss; its ID is the cfg you give the point in Map Editor → Points → "+ Boss"
 * Self-contained on purpose: the server imports these schemas too, and the admin page and the game are served from different roots. */

const ehObjeto = v => v && typeof v === 'object' && !Array.isArray(v);
const listaDeTextos = v => (Array.isArray(v) && v.every(s => typeof s === 'string')) ? null : 'must be a list of texts';
const corOk = s => /^#[0-9a-f]{6}$/i.test(s) ? null : 'a #rrggbb color';
const recompensasOk = v => {
  if (v == null) return null;
  if (!Array.isArray(v)) return 'a list of { "item", "qtd", "chance"? }';
  for (const [i, r] of v.entries()) {
    if (!ehObjeto(r) || !Number.isInteger(+r.item) || +r.item < 1) return `#${i + 1}: "item" is an item id (1003 = Ultra Ball…)`;
    if (r.qtd != null && (!Number.isInteger(+r.qtd) || +r.qtd < 1 || +r.qtd > 9999)) return `#${i + 1}: "qtd" between 1 and 9999`;
    if (r.chance != null && !(+r.chance >= 0 && +r.chance <= 1)) return `#${i + 1}: "chance" between 0 and 1 (0.25 = 25%)`;
  }
  return null;
};
const timeBossOk = v => {
  if (!Array.isArray(v) || !v.length) return 'a list of { "dex", "delta"? } (at least one)';
  if (v.length > 6) return 'up to 6 Pokémon';
  for (const [i, e] of v.entries()) {
    if (!ehObjeto(e) || !Number.isInteger(+e.dex) || +e.dex < 1 || +e.dex > 1025) return `#${i + 1}: "dex" between 1 and 1025`;
    if (e.delta != null && (!Number.isFinite(+e.delta) || Math.abs(+e.delta) > 50)) return `#${i + 1}: "delta" between -50 and 50`;
    if (e.glb != null && !/^[\w-]{1,40}$/.test(String(e.glb))) return `#${i + 1}: "glb" is a model name without .glb`;
  }
  return null;
};
const capturaOk = v => {
  if (v == null) return null;
  if (!ehObjeto(v)) return 'an object { "ativa", "modo", "bonus", "tentativas", "umaVez" }';
  if (v.modo != null && !['chance', 'garantida'].includes(v.modo)) return '"modo" is "chance" or "garantida"';
  if (v.bonus != null && !(+v.bonus > 0 && +v.bonus <= 255)) return '"bonus" between 0.1 and 255';
  if (v.tentativas != null && !(Number.isInteger(+v.tentativas) && +v.tentativas >= 1 && +v.tentativas <= 20)) return '"tentativas" between 1 and 20';
  if (v.janelaS != null && !(Number.isInteger(+v.janelaS) && +v.janelaS >= 15 && +v.janelaS <= 600)) return '"janelaS" between 15 and 600 seconds';
  return null;
};
const NIVEIS = [
  { v: 'cinza', rotulo: 'Gray (+0)' }, { v: 'vermelho', rotulo: 'Red (+5)' }, { v: 'verde', rotulo: 'Green (+10)' }, { v: 'azul', rotulo: 'Blue (+20)' },
  { v: 'amarelo', rotulo: 'Yellow (+30)' }, { v: 'laranja', rotulo: 'Orange (+40)' }, { v: 'roxo', rotulo: 'Purple (+50)' },
];

export const ESQUEMAS_BOSS = {
  boss_niveis: {
    titulo: 'Boss tiers (colors)', arquivo: 'bosses', caminho: 'niveis', forma: 'mapa', previa: '/admin/preview_boss.mjs', idValido: /^[a-z][a-z0-9_]{0,23}$/, idAjuda: 'lowercase key, e.g. vermelho',
    descricao: 'The boss colors. A boss\'s Pokémon are at the level of the player\'s strongest party Pokémon + Level bonus (+ each Pokémon\'s own delta). '
      + 'The prize money is multiplied by the money multiplier, the boss\'s item quantities by the item multiplier, and the tier\'s own extra rewards are added on top. '
      + 'Default keys: cinza, vermelho, verde, azul, amarelo, laranja, roxo (the server falls back to the defaults for a missing one). Applies on the next challenge.',
    campos: [
      { k: 'nome', rotulo: 'Name (shown on the badge)', tipo: 'texto', max: 24, col: true, obrigatorio: true },
      { k: 'cor', rotulo: 'Color', tipo: 'texto', max: 7, col: true, obrigatorio: true, validar: corOk, ajuda: '#rrggbb — the badge, the ring on the ground and the catch panel use it.' },
      { k: 'bonus', rotulo: 'Level bonus', tipo: 'num', int: true, min: 0, max: 99, col: true, obrigatorio: true, ajuda: 'Levels above the player\'s strongest party Pokémon.' },
      { k: 'multDinheiro', rotulo: 'Money multiplier', tipo: 'num', min: 0, max: 100, col: true, padrao: 1 },
      { k: 'multItens', rotulo: 'Item quantity multiplier', tipo: 'num', min: 0, max: 100, col: true, padrao: 1 },
      { k: 'ivs', rotulo: 'IVs of the boss\'s Pokémon', tipo: 'num', int: true, min: 0, max: 31, col: true, padrao: 15, ajuda: 'Every stat; only in the fight — a caught boss gets fresh random IVs.' },
      { k: 'recompensas', rotulo: 'Extra rewards of this tier', tipo: 'json', validar: recompensasOk, resumo: v => (v || []).map(r => r.qtd + '× ' + r.item + (r.chance != null && r.chance < 1 ? ' (' + Math.round(r.chance * 100) + '%)' : '')).join(', '),
        ajuda: '[{ "item": 1003, "qtd": 3 }, { "item": 1004, "qtd": 1, "chance": 0.1 }] — added to every boss of this color (not multiplied).' },
    ],
  },
  bosses: {
    titulo: 'Bosses', arquivo: 'bosses', caminho: 'bosses', forma: 'mapa', previa: '/admin/preview_boss.mjs', idValido: /^\d{1,9}$/, idAjuda: 'numbers only (88xxxxx): the cfg of the boss point on the map',
    descricao: 'NPC bosses (a trainer with a team) and Pokémon bosses (the Pokémon itself, which can be caught). To put one in the world: create it here, then '
      + 'Map Editor → Points → "+ Boss" and type this ID as the cfg. The level follows the player\'s party (see Boss tiers). A caught boss becomes an ordinary '
      + 'Pokémon: fresh IVs and nature, no tier bonus — only its shiny is kept. Applies on the next challenge (players see the new badge after F5).',
    campos: [
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 60, col: true, obrigatorio: true },
      { k: 'tipo', rotulo: 'Kind', tipo: 'opcao', col: true, obrigatorio: true, padrao: 'npc', opcoes: [{ v: 'npc', rotulo: 'NPC boss (trainer)' }, { v: 'pokemon', rotulo: 'Pokémon boss' }] },
      { k: 'nivel', rotulo: 'Tier (color)', tipo: 'opcao', col: true, obrigatorio: true, padrao: 'cinza', opcoes: NIVEIS, ajuda: 'A custom tier key from Boss tiers also works (type it in the JSON).' },
      { k: 'glb', rotulo: 'Model', tipo: 'texto', max: 40, col: true, validar: s => /^[\w-]{1,40}$/.test(s) ? null : 'file name, without .glb',
        ajuda: 'NPC boss: scenery/npc/<model>.glb (e.g. NPC1008). Pokémon boss: scenery/mon/<model>.glb (e.g. pm0130_00); empty = the dex\'s default model.' },
      { k: 'time', rotulo: 'Team', tipo: 'json', col: true, obrigatorio: true, validar: timeBossOk,
        resumo: v => (v || []).map(p => '#' + p.dex + (p.delta ? ' (' + (p.delta > 0 ? '+' : '') + p.delta + ')' : '') + (p.shiny ? '✨' : '')).join(', '),
        ajuda: '[{ "dex": 24, "delta": -3 }, { "dex": 42 }] — delta = levels relative to the tier level (0 = the ace). Pokémon boss: exactly one entry. "shiny": true per entry.' },
      { k: 'shiny', rotulo: 'Shiny (Pokémon boss)', tipo: 'bool', col: true, ajuda: 'A shiny boss stays shiny when caught; a normal one stays normal.' },
      { k: 'lvMin', rotulo: 'Lowest level', tipo: 'num', int: true, min: 1, max: 100, ajuda: 'Optional floor (e.g. the red Gyarados is never below 30).' },
      { k: 'lvMax', rotulo: 'Highest level', tipo: 'num', int: true, min: 1, max: 100, ajuda: 'Optional ceiling.' },
      { k: 'dinheiro', rotulo: 'Prize money (base)', tipo: 'num', int: true, min: 0, max: 10000000, col: true, padrao: 0, ajuda: '× the tier\'s money multiplier.' },
      { k: 'recompensas', rotulo: 'Item rewards (base)', tipo: 'json', validar: recompensasOk, resumo: v => (v || []).map(r => r.qtd + '× ' + r.item).join(', '),
        ajuda: '[{ "item": 2013, "qtd": 1, "chance": 0.5 }] — qty × the tier\'s item multiplier; chance 0–1 (empty = always). Balls (1001–1099) go to the ball pocket.' },
      { k: 'repeticao', rotulo: 'Repeat', tipo: 'opcao', col: true, padrao: 'sempre', opcoes: [{ v: 'sempre', rotulo: 'Always (cooldown only)' }, { v: 'diaria', rotulo: 'Once a day' }, { v: 'umaVez', rotulo: 'Once per account' }] },
      { k: 'cooldownMin', rotulo: 'Cooldown after a win (min)', tipo: 'num', int: true, min: 0, max: 100000 },
      { k: 'cooldownDerrotaMin', rotulo: 'Cooldown after a loss (min)', tipo: 'num', int: true, min: 0, max: 100000 },
      { k: 'captura', rotulo: 'Catch (Pokémon boss)', tipo: 'json', validar: capturaOk, resumo: v => v?.ativa ? (v.modo === 'garantida' ? 'guaranteed' : '×' + (v.bonus || 1) + ', ' + (v.tentativas || 3) + ' throws') : '',
        ajuda: '{ "ativa": true, "modo": "chance" | "garantida", "bonus": 2, "tentativas": 3, "janelaS": 90, "umaVez": true } — after the win the player throws their own balls; '
          + 'bonus multiplies the ball (Gen III odds); umaVez = once caught, the boss is gone for that account.' },
      { k: 'capturaLv', rotulo: 'Level when caught', tipo: 'num', int: true, min: 1, max: 100, ajuda: 'Optional: the caught Pokémon\'s level. Empty = the level it had in the fight.' },
      { k: 'fala', rotulo: 'Line before battle', tipo: 'linhas', validar: listaDeTextos },
      { k: 'vitoria', rotulo: 'Line when the player wins', tipo: 'linhas', validar: listaDeTextos },
      { k: 'derrota', rotulo: 'Line when the player loses', tipo: 'linhas', validar: listaDeTextos },
    ],
    validar: r => (r.tipo === 'pokemon' && Array.isArray(r.time) && r.time.length !== 1) ? 'a Pokémon boss has exactly one Pokémon in Team' : null,
  },
};
