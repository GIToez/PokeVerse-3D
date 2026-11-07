/* Esquemas do editor de dados do painel admin (Fase 0).
 * O MESMO arquivo é usado pelo navegador (monta tabela e formulário) e pelo servidor (valida e decide quais arquivos de
 * public/data a rota /admin/dados aceita — só os que estão aqui).
 *
 * Esquema:  { titulo, descricao, arquivo, caminho?, forma, id?, recarga?, campos }
 *   arquivo  = nome em public/data, sem .json
 *   caminho  = subchave dentro do arquivo (ex.: 'itens' em menu_data.json); sem caminho = o arquivo inteiro
 *   forma    = 'objeto' (o arquivo é UM registro, ex.: config) · 'mapa' ({ id: registro }) · 'lista' ([registro, …])
 *   id       = (lista) campo que identifica o registro — obrigatório e único
 *   recarga  = 'vivo' se o jogo aplica sem recarregar; senão o jogo avisa pra dar F5
 * Campo: { k, rotulo, tipo, ajuda?, col? (aparece na tabela), obrigatorio?, ...regras do tipo }
 *   texto(max) · num(min, max, int) · bool · opcao(opcoes: [{v, rotulo}]) · numeros(tam, min, max, int: "20, 26, 32")
 *   linhas (lista de textos, uma por linha) · json (livre; validar(v) → mensagem de erro ou null)
 * Chave que o esquema não conhece PASSA DIRETO: os arquivos têm campos que o painel ainda não edita, e não dá pra perder dado.
 * Fase 2 (conteúdo: insígnias, EXP, iniciais, montarias, golpes, missões, evoluções, espécies, learnset): admin/schemas_f2.mjs,
 * que acrescenta `tela` (edição numa tela própria) e `colecao` (validação do conteúdo inteiro — ver validarColecao). */
import { ESQUEMAS_F2 } from './schemas_f2.mjs';
import { ESQUEMAS_F3 } from './schemas_f3.mjs';   // Fase 3: cores de NPC, falas, diálogos, traduções, músicas, raid
import { ESQUEMAS_BOSS } from './schemas_boss.mjs';   // NPC / Pokémon bosses and their color tiers (bosses.json)

const faixaNivel = v => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'must be an object { "area": [min, max] }';
  for (const [a, f] of Object.entries(v)) {
    if (!/^\d{1,8}$/.test(a)) return `invalid area: ${a}`;
    if (!Array.isArray(f) || f.length !== 2 || !f.every(n => Number.isInteger(n) && n >= 1 && n <= 100) || f[0] > f[1]) return `area ${a}: use [min, max] between 1 and 100`;
  }
  return null;
};
const listaDeTextos = v => (Array.isArray(v) && v.every(s => typeof s === 'string')) ? null : 'must be a list of texts';
// receitas de cor (formato do CANAIS/ROTULOS/PADRAO do character.mjs)
const ehObjeto = v => v && typeof v === 'object' && !Array.isArray(v);
const CHAVE_PARTE = /^[a-z][a-z0-9_]{0,23}$/;
const nomesDasPartes = v => {
  if (!ehObjeto(v) || !Object.keys(v).length) return 'must be { "part": "name the player sees" }';
  for (const [k, n] of Object.entries(v)) if (!CHAVE_PARTE.test(k) || typeof n !== 'string' || !n.trim() || n.length > 40) return `part "${k}": lowercase key and a name of up to 40 characters`;
  return null;
};
const coresDasPartes = v => {
  if (!ehObjeto(v)) return 'must be { "part": "#rrggbb" }';
  for (const [k, c] of Object.entries(v)) if (!CHAVE_PARTE.test(k) || !/^#[0-9a-f]{6}$/i.test(c)) return `part "${k}": use a #rrggbb color`;
  return null;
};
const canaisDaMascara = v => {
  if (!ehObjeto(v) || !Object.keys(v).length) return 'must be { "material": { "R": …, "G": …, "B": …, "K": …, "mask": "file.png" } }';
  for (const [mat, c] of Object.entries(v)) {
    if (!ehObjeto(c) || typeof c.mask !== 'string' || !/^[\w .-]{1,80}\.png$/i.test(c.mask)) return `${mat}: missing "mask" (.png file in scenery/npc/mask)`;
    for (const k of ['R', 'G', 'B', 'K']) {
      const x = c[k];
      if (x === undefined || x === null || (typeof x === 'string' && CHAVE_PARTE.test(x))) continue;
      if (!Array.isArray(x) || x.length !== 3 || !x.every(n => typeof n === 'number' && n >= 0 && n <= 1)) return `${mat}.${k}: use a part key, [r, g, b] from 0 to 1, or null`;
    }
  }
  return null;
};
// itens e lojas (menu_data.json) e treinadores (Fase 1)
const TIPOS_ITEM = { 1: 'Currency', 2: 'Materials', 3: 'Carried items', 4: 'Technical Machine', 5: 'Materials (2)', 6: 'Bundle', 7: 'Poké Ball', 8: 'Fragment',
  9: 'Recovery', 10: 'Title', 11: 'Outfit', 12: 'Mount', 13: 'Coupons', 14: 'Equipment', 15: 'Summoning Stone', 16: 'Habitat Buildings',
  17: 'Habitat Materials', 18: 'Habitat Food', 19: 'Habitat Seeds' };
const precoItem = v => Array.isArray(v) && v.length <= 10 && v.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isInteger(n) && n >= 0 && n < 1e12))
  ? null : 'list of [currency, price] — e.g. [[1, 100]] = 100 Coins; [[1, 100], [2, 5]] = 100 Coins or 5 Crystals';
const timeNpc = v => {
  if (!Array.isArray(v) || v.length < 1 || v.length > 6) return '1 to 6 Pokémon: [{ "dex": 19, "lv": 11, "glb": "pm0019_00" }, …]';
  for (const [i, p] of v.entries()) {
    if (!p || typeof p !== 'object' || !Number.isInteger(p.dex) || p.dex < 1 || p.dex > 2000) return `Pokémon ${i + 1}: invalid "dex"`;
    if (!Number.isInteger(p.lv) || p.lv < 1 || p.lv > 100) return `Pokémon ${i + 1}: "lv" from 1 to 100`;
    if (typeof p.glb !== 'string' || !/^pm\d{4}[\w-]{0,20}$/.test(p.glb)) return `Pokémon ${i + 1}: model "glb" (e.g. pm0019_00)`;
  }
  return null;
};
const insigniaGinasio = v => ehObjeto(v) && Number.isInteger(v.id) && v.id > 0 && v.id < 1e7 && typeof v.nome === 'string' && v.nome.trim() && v.nome.length <= 60
  && (v.icone == null || /^[\w-]{1,60}$/.test(v.icone)) ? null : 'use { "id": 101, "nome": "Boulder Badge", "icone": "dghz_1" }';
/** Registro de receita: toda parte usada nos canais precisa de nome e cor padrão. */
const receitaCompleta = r => {
  for (const [mat, c] of Object.entries(r.texturas || {})) for (const k of ['R', 'G', 'B', 'K'])
    if (typeof c[k] === 'string' && (!r.rotulos?.[c[k]] || !r.padrao?.[c[k]])) return `${mat}.${k} uses the part "${c[k]}", which must be in both Parts and Default color`;
  return null;
};

const premioOk = v => v == null || (v && typeof v === 'object' && !Array.isArray(v) && Object.entries(v).every(([k, n]) => /^\d{1,9}$/.test(k) && Number.isInteger(n) && n > 0 && n <= 9999)) ? null : '{ "item id": quantity }, e.g. { "1001": 5 }';
export const ESQUEMAS = {
  config_jogo: {
    titulo: 'Game settings', arquivo: 'game_config', forma: 'objeto',
    descricao: 'Numbers that used to be hard-coded. Empty field = uses the game default.',
    campos: [
      { k: 'taxaShiny', rotulo: 'Wild shiny (1 in N)', tipo: 'num', min: 2, max: 1000000, int: true, ajuda: 'Default 4096. Lower = more shinies.' },
      { k: 'tetoNivel', rotulo: 'Obedience cap by badges', tipo: 'numeros', tam: 9, min: 1, max: 100, int: true, ajuda: 'Highest level that obeys with 0, 1, … 8 badges. Default: 20, 26, 32, 38, 46, 52, 58, 62, 70.' },
      { k: 'desmaio', rotulo: 'Seconds fainted', tipo: 'num', min: 1, max: 120, int: true, ajuda: 'How long a wild Pokémon stays down (capture window). Default 8.' },
      { k: 'skittishHp', rotulo: 'Turn skittish at HP %', tipo: 'num', min: 0, max: 100, int: true, ajuda: 'Aggressive wild Pokémon flee when their HP falls to this percent or below. 0 = off (default). Per-species values in Habitats / spawn zones override this.' },
      { k: 'xpMinParte', rotulo: 'XP: minimum share of the damage', tipo: 'num', min: 0, max: 1, ajuda: 'A wild KO gives XP to whoever dealt this share of its HP or more, or dealt the most damage. Default 0.1 (10%). 0 = everyone who hit it.' },
      { k: 'caca', rotulo: 'Hunt bonus (Coins per wild KO)', tipo: 'json', validar: v => v == null || (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(n => typeof n === 'number' && n >= 0)) ? null : 'an object of numbers, e.g. { "porDia": 1500, "dias": 7 }',
        ajuda: 'A daily pool of extra Coins paid on wild knockouts. porDia = Coins added per day (default 1500) · dias = days it stacks (7) · base + level × porNivel = Coins per KO (6 + 1.2/level) · minParte = share of the damage needed (0.25; the top hitter always gets paid). Empty = defaults. E.g. { "porDia": 1500, "dias": 7, "base": 6, "porNivel": 1.2 }' },
      { k: 'safariCaptura', rotulo: 'Safari catch multiplier', tipo: 'num', min: 0.05, max: 4, ajuda: 'Multiplies every Safari Ball throw (on top of the ball\'s 1.5 and bait ×0.5 / rock ×2). 1 = the original games (Nidoran 46% a throw, Kangaskhan 9%, Chansey 6%). Default 0.5 (Nidoran 23%, Kangaskhan 4%, Chansey 3%).' },
      { k: 'caixaBase', rotulo: 'Box size (slots)', tipo: 'num', min: 30, max: 100000, int: true, ajuda: 'Default 300. Box slots bought in the shop add on top (Shop: Comfort items → boxSlots). With a full team and a full Box the player can\'t catch; gifts, trades and mail still arrive.' },
      { k: 'transformLigado', rotulo: 'Transform (Ditto) for players', tipo: 'bool', ajuda: 'On: a Ditto out of its ball can Transform in the overworld (button, T key, or "Transform into…" near a trainer), and its Transform move works in turn battles. Off: only GM accounts can use it.' },
      { k: 'viagem', rotulo: 'Fast travel (world map)', tipo: 'json', validar: v => v == null || (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(n => typeof n === 'number' && n >= 0 && n <= 1440)) ? null : 'an object of numbers, e.g. { "teleporteInsignias": 3, "teleporteMin": 10, "viagemInsignias": 3, "viagemMin": 5 }',
        ajuda: 'The world map\'s Return to Center (Teleport) and Fly between Pokémon Centers: teleporteInsignias / viagemInsignias = Gym Badges needed (default 3 each) · teleporteMin / viagemMin = cooldown in minutes (10 and 5). GMs have both, no cooldown.' },
      { k: 'maxBolasNoAr', rotulo: 'Balls in the air at once', tipo: 'num', min: 1, max: 20, int: true, ajuda: 'Default 4.' },
      { k: 'trocaCd', rotulo: 'Pokémon switch cooldown (s)', tipo: 'num', min: 0, max: 120, int: true, ajuda: 'Default 6.' },
      { k: 'chefeLv', rotulo: 'Test boss level (?chefe)', tipo: 'num', min: 1, max: 100, int: true, ajuda: 'Default 70.' },
      { k: 'nivelArea', rotulo: 'Wild levels by area', tipo: 'json', validar: faixaNivel, ajuda: 'Easier in Habitats by Area (each area\'s level next to its species). Areas not listed here use the table in the code. E.g. { "1201": [2, 5] }' },
      // as bolas (`bolas`) têm tela própria (esquema `bolas`, abaixo); aqui elas só passam direto
    ],
  },
  itens: {
    titulo: 'Items', arquivo: 'menu_data', caminho: 'itens', forma: 'mapa', idValido: /^\d{1,9}$/, idAjuda: 'numbers only',
    descricao: 'Every item in the game (name, description, type, icon and price). Poké Balls are items too (type Poké Ball).',
    previa: '/admin/preview_item.mjs',
    campos: [
      { k: 'n', rotulo: 'Name', tipo: 'texto', max: 200, col: true, obrigatorio: true },
      { k: 't', rotulo: 'Type', tipo: 'opcao', col: true, opcoes: Object.entries(TIPOS_ITEM).map(([v, rotulo]) => ({ v: +v, rotulo })) },
      { k: 'd', rotulo: 'Description', tipo: 'texto', max: 3000, area: true },
      { k: 'v', rotulo: 'Value (currency, price)', tipo: 'json', col: true, validar: precoItem, resumo: v => (v || []).map(([m, p]) => p + ' (currency ' + m + ')').join(' or '),
        ajuda: 'The item\'s reference value in the original game: [[currency, price]], e.g. [[1, 100]] = 100 Coins. Empty = no value. The SELL price in shops is set on the Shops screen.' },
      { k: 'i', rotulo: 'Icon', tipo: 'texto', max: 60, validar: s => /^[\w-]{1,60}$/.test(s) ? null : 'file name without extension', ajuda: 'File ui/itens/<icon>.png.' },
      { k: 'q', rotulo: 'Quality (rarity)', tipo: 'num', min: 0, max: 10, int: true },
    ],
  },
  itens_novos: {
    titulo: 'New items', arquivo: 'itens_novos', caminho: 'itens', forma: 'mapa', idValido: /^9\d{5}$/, idAjuda: '900001 to 999999',
    descricao: 'The items we added on top of the original game (Rare Candy S…MAX, TM pieces, raid shards, incubators, medallions…). The game merges them into the Items list. Write names and descriptions in English; the Portuguese text goes in the translations.',
    previa: '/admin/preview_item.mjs',
    campos: [
      { k: 'n', rotulo: 'Name', tipo: 'texto', max: 200, col: true, obrigatorio: true },
      { k: 't', rotulo: 'Type', tipo: 'opcao', col: true, opcoes: Object.entries(TIPOS_ITEM).map(([v, rotulo]) => ({ v: +v, rotulo })) },
      { k: 'd', rotulo: 'Description', tipo: 'texto', max: 3000, area: true },
      { k: 'i', rotulo: 'Icon', tipo: 'texto', max: 60, validar: s => /^[\w-]{1,60}$/.test(s) ? null : 'file name without extension', ajuda: 'File ui/amanda/itens_novos/<icon>@2x.png (and <icon>.png). Items without art yet show a placeholder in the game.' },
      { k: 'q', rotulo: 'Quality (rarity)', tipo: 'num', min: 0, max: 10, int: true, col: true },
      { k: 'v', rotulo: 'Value (currency, price)', tipo: 'json', validar: v => v == null ? null : precoItem(v), resumo: v => (v || []).map(([m, p]) => p + ' (currency ' + m + ')').join(' or '),
        ajuda: 'Reference value: [[currency, price]], e.g. [[1, 100]] = 100 Coins. Empty or null = no value.' },
      { k: 'preso', rotulo: 'Bound to account', tipo: 'bool', col: true, ajuda: 'Can\'t be traded, sold or put on the Market.' },
      { k: 'uso', rotulo: 'Use (what it does)', tipo: 'json', validar: v => v == null || (v && typeof v === 'object' && !Array.isArray(v) && typeof v.tipo === 'string') ? null : 'an object with a "tipo", e.g. { "tipo": "nivel", "faixa": [1, 15] }',
        ajuda: 'How the game uses it. Rare Candy: { "tipo": "nivel", "faixa": [min, max] }. Leave as is unless you know the code reads the new value.' },
    ],
  },
  lojas: {
    titulo: 'Shops', arquivo: 'menu_data', caminho: 'lojas', forma: 'mapa', registroLista: true, usaItens: true, idValido: /^\d{1,9}$/, idAjuda: 'numbers only',
    descricao: 'What each shop sells: item, quantity per purchase, currency, price and minimum level. The game\'s Poké Mart is shop 2150101.',
    ajudaLista: 'the order here is the order in the shop',
    colunas: [
      { rotulo: 'Products', valor: l => (l || []).length },
      { rotulo: 'Currencies', valor: (l, ctx) => [...new Set((l || []).map(p => ctx.item(p.moeda)))].join(', ') },
      { rotulo: 'Sells', valor: (l, ctx) => (l || []).slice(0, 3).map(p => ctx.item(p.item)).join(', ') + ((l || []).length > 3 ? '…' : '') },
    ],
    campos: [
      { k: 'item', rotulo: 'Item', tipo: 'num', int: true, min: 1, max: 999999999, item: true, obrigatorio: true },
      { k: 'n', rotulo: 'Qty', tipo: 'num', int: true, min: 1, max: 9999, padrao: 1, ajuda: 'how many units come per purchase' },
      { k: 'moeda', rotulo: 'Currency', tipo: 'num', int: true, min: 1, max: 999999999, item: true, padrao: 1, obrigatorio: true, ajuda: 'the item used to pay (1 = Coin, 2 = Crystal)' },
      { k: 'preco', rotulo: 'Price', tipo: 'num', int: true, min: 0, max: 1e9, padrao: 100, obrigatorio: true },
      { k: 'lv', rotulo: 'Min. level', tipo: 'num', int: true, min: 1, max: 99999, padrao: 1, ajuda: 'trainer level required to unlock (the original game goes up to 9999)' },
    ],
  },
  treinadores: {
    titulo: 'NPC Trainers', arquivo: 'trainers', forma: 'mapa', idValido: /^\d{1,9}$/, idAjuda: 'the trainer\'s cfg on the map, numbers only',
    descricao: 'The trainers who challenge the player on the map: name, model, team, prize and lines. The ID is the cfg shown in the map\'s trainer layer.',
    previa: '/admin/preview_trainer.mjs',
    campos: [
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 60, col: true, obrigatorio: true },
      { k: 'glb', rotulo: 'Model (NPC)', tipo: 'texto', max: 40, col: true, validar: s => /^[\w-]{1,40}$/.test(s) ? null : 'file name, without .glb', ajuda: 'File scenery/npc/<model>.glb (e.g. NPC1008, fc1041_00).' },
      { k: 'time', rotulo: 'Team', tipo: 'json', col: true, obrigatorio: true, validar: timeNpc, resumo: v => (v || []).map(p => '#' + p.dex + ' Lv' + p.lv).join(', '),
        ajuda: 'List of { "dex", "lv", "glb" } (up to 6). The preview shows the names.' },
      { k: 'dinheiro', rotulo: 'Prize money', tipo: 'num', min: 0, max: 10000000, int: true, col: true },
      { k: 'fala', rotulo: 'Line before battle', tipo: 'linhas', validar: listaDeTextos },
      { k: 'vitoria', rotulo: 'Line when the player wins', tipo: 'linhas', validar: listaDeTextos },
      { k: 'derrota', rotulo: 'Line when the player loses', tipo: 'linhas', validar: listaDeTextos },
    ],
  },
  npcs: {
    titulo: 'NPCs (who\'s who)', arquivo: 'npcs_glb', forma: 'mapa', idValido: /^\d{1,9}$/, idAjuda: 'the NPC\'s cfg, the same as its map point',
    descricao: 'Name, model and lines of each NPC. The cfg links it to the map point (Map Editor → Points). A map NPC not registered here does not appear in the game.',
    previa: '/admin/preview_trainer.mjs',
    campos: [
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 60, col: true },
      { k: 'glb', rotulo: 'Model', tipo: 'texto', max: 60, col: true, validar: s => /^(npc|mon|pc)\/[\w-]{1,40}$/.test(s) ? null : 'folder/file without .glb (e.g. npc/fc1004_00, mon/pm0122)',
        ajuda: 'scenery/<model>.glb — npc/… (people) or mon/… (Pokémon). Signs have no model.' },
      { k: 'falas', rotulo: 'Lines (one per line)', tipo: 'linhas', validar: listaDeTextos },
      { k: 'role', rotulo: 'Role', tipo: 'opcao', col: true, opcoes: [{ v: 'heal', rotulo: 'Healing (Pokémon Center)' }, { v: 'shop', rotulo: 'Shop' }, { v: 'pc', rotulo: 'Box (PC)' }, { v: 'safari', rotulo: 'Safari Zone warden' }] },
      { k: 'curaApos', rotulo: 'Heals after line', tipo: 'num', int: true, min: 1, max: 20, ajuda: 'Healing only: heal after this many lines, then say the rest (Mom: 1). Empty = heal after the last line.' },
      { k: 'placa', rotulo: 'Sign (invisible point with text)', tipo: 'bool', col: true },
      { k: 'tipo', rotulo: 'Original game type', tipo: 'num', int: true, min: 0, max: 99 },
      { k: 'cena', rotulo: 'Scene', tipo: 'num', int: true, min: 1, max: 99999999, ajuda: '1000001 = Kanto' },
    ],
  },
  portas: {
    titulo: 'Doors', arquivo: 'doors', forma: 'mapa', idValido: /^\d{1,9}$/, idAjuda: 'the cfg of the door\'s point on the map',
    descricao: 'An NPC-layer point with a cfg listed here becomes a door: a "Door" leads to the destination "Arrival" (n); an "Arrival" is where the player spawns on entering. Edit on the map: Map Editor → Points.',
    validar: r => r.t === 6 && r.n === undefined ? 'a door needs a destination (n; 0 = dead end)' : null,
    campos: [
      { k: 't', rotulo: 'Type', tipo: 'opcao', col: true, obrigatorio: true, opcoes: [{ v: 6, rotulo: 'Door (leads to…)' }, { v: 7, rotulo: 'Arrival (spawn point)' }] },
      { k: 'n', rotulo: 'Destination (arrival cfg)', tipo: 'num', int: true, min: 0, max: 999999999, col: true, ajuda: '0 = dead-end door (the original game has 17 of these)' },
      { k: 'c', rotulo: 'Scene of this point', tipo: 'num', int: true, min: 1, max: 99999999, col: true, ajuda: '1000001 = Kanto; the others are the numbered maps' },
      { k: 'a', rotulo: 'Area', tipo: 'num', int: true, min: 0, max: 99999999, col: true },
    ],
  },
  produtos_loja: {
    titulo: 'Shop: Comfort items', arquivo: 'shop_products', forma: 'lista', id: 'id',
    descricao: 'What the Diamond Shop\'s Comfort tab sells. boxSlots = Box slots (everyone starts with Game settings → Box size). Each other product puts an item in the Bag (tradable: use it or sell it on the Market). Medallion items add Medallion days (+20% XP); the Premium Daily Pass item adds days of the Premium daily prize.',
    campos: [
      { k: 'id', rotulo: 'Product ID', tipo: 'texto', max: 40, col: true, obrigatorio: true, validar: s => /^[\w-]{1,40}$/.test(s) ? null : 'letters, numbers and dashes', ajuda: 'medallion30 / medallion60 / medallion90 / premiumDailyPass30 / boxSlots have their own art and text in the shop.' },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 60, col: true },
      { k: 'item', rotulo: 'Item given', tipo: 'num', int: true, min: 1, max: 999999999, col: true, ajuda: 'Not used by boxSlots (Box slots go straight onto the account).' },
      { k: 'qtd', rotulo: 'How many', tipo: 'num', int: true, min: 1, max: 999, col: true, ajuda: 'Items per purchase; for boxSlots, Box slots per purchase.' },
      { k: 'teto', rotulo: 'Most slots bought (boxSlots)', tipo: 'num', int: true, min: 1, max: 100000 },
      { k: 'preco', rotulo: 'Price (Diamonds)', tipo: 'num', int: true, min: 1, max: 1000000, col: true, obrigatorio: true },
      { k: 'aVenda', rotulo: 'On sale', tipo: 'bool', col: true },
    ],
  },
  premios_diarios: {
    titulo: 'Daily rewards', arquivo: 'daily_rewards', caminho: 'dias', forma: 'lista', id: 'dia',
    descricao: 'Log in on consecutive days: Day 1 → Day 7, then Day 1 again; missing a day goes back to Day 1. Each day pays the Free prize to everyone and the Premium prize to Premium Daily Pass holders (GMs always). Prizes are { "item id": how many }. Keep exactly 7 days.',
    campos: [
      { k: 'dia', rotulo: 'Day', tipo: 'num', int: true, min: 1, max: 7, col: true, obrigatorio: true },
      { k: 'gratis', rotulo: 'Free prize', tipo: 'json', col: true, validar: premioOk, ajuda: 'e.g. { "1001": 5 } = 5 Poké Balls' },
      { k: 'premium', rotulo: 'Premium prize', tipo: 'json', col: true, validar: premioOk },
    ],
  },
  pesca_areas: {
    titulo: 'Fishing by area', arquivo: 'pesca', caminho: 'areas', forma: 'mapa', registroLista: true, idValido: /^\d{1,8}$/, idAjuda: 'the area number (Route 1 is 1201)',
    descricao: 'What bites in each area with the Good Rod and the Super Rod (the Old Rod only hooks Magikarp, and the Good Rod hooks Magikarp part of the time). An area not listed uses the generic list (Fishing rods → Generic catch). Saved changes apply on the next cast, no restart.',
    ajudaLista: 'one row per species; a higher weight bites more often',
    colunas: [
      { rotulo: 'Area', valor: (l, ctx, id) => ctx?.area?.(id) || '' },
      { rotulo: 'Species', valor: l => (l || []).length },
      { rotulo: 'Bites', valor: l => (l || []).slice(0, 4).map(e => e.nome || '#' + e.dex).join(', ') + ((l || []).length > 4 ? '…' : '') },
    ],
    campos: [
      { k: 'dex', rotulo: 'Pokédex no.', tipo: 'num', int: true, min: 1, max: 2000, obrigatorio: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 30, ajuda: 'shown in the list only; the game uses the species name' },
      { k: 'peso', rotulo: 'Weight', tipo: 'num', min: 0.01, max: 1000, padrao: 1, ajuda: '1 = normal; 0.2 = five times rarer' },
      { k: 'glb', rotulo: 'Model', tipo: 'texto', max: 30, validar: s => !s || /^pm\d{4}(_\d{2})?(\.glb)?$/.test(s) ? null : 'e.g. pm0118_00.glb', ajuda: 'empty = the normal model' },
    ],
  },
  pesca_varas: {
    titulo: 'Fishing rods', arquivo: 'pesca', forma: 'objeto',
    descricao: 'The rods (wait, bite window, levels, Magikarp chance, mastery needed), fishing mastery steps, and the generic catch for areas without their own list.',
    campos: [
      { k: 'varas', rotulo: 'Rods', tipo: 'json', validar: v => Array.isArray(v) && v.length >= 1 && v.length <= 10 && v.every(r => r && Number.isInteger(r.item) && Array.isArray(r.nivel) && r.nivel.length === 2) ? null : 'a list of rods: { item, nome, maestria, espera: [min, max] s, janelaMs, nivel: [min, max], magikarp?, soMagikarp? }' },
      { k: 'maestria', rotulo: 'Mastery', tipo: 'json', validar: v => v && Array.isArray(v.degraus) ? null : '{ degraus: [catches for each level], teto }' },
      { k: 'generico', rotulo: 'Generic catch', tipo: 'json', validar: v => Array.isArray(v) && v.every(e => e && Number.isInteger(e.dex)) ? null : 'a list like [{ "dex": 129, "nome": "Magikarp" }]' },
    ],
  },
  criacao: {
    titulo: 'Day Care and breeding', arquivo: 'breeding', forma: 'objeto',
    descricao: 'The Day Care Lady outside the Route 5 Day Care (server_breeding.mjs). Two Pokémon left with her may make an Egg; the Egg is always the mother\'s family (a Ditto plays the opposite of the other parent). IVs: 3 from the parents (5 with a Destiny Knot), a Power item always passes its stat, an Everstone passes the nature; egg moves a parent knows are passed on. Egg groups and egg moves come from public/data/ovo.json.',
    campos: [
      { k: 'ligado', rotulo: 'On', tipo: 'bool' },
      { k: 'horasPorTentativa', rotulo: 'Hours per Egg chance', tipo: 'num', min: 0.01, max: 720, ajuda: 'Counted from the moment both are in (24 = once a day).' },
      { k: 'chance', rotulo: 'Egg chance', tipo: 'json', validar: v => v && ['mesmaEspecie', 'outra', 'ditto'].every(k => +v[k] >= 0 && +v[k] <= 1) ? null : '{ "mesmaEspecie": 0.7, "outra": 0.4, "ditto": 0.5 } (0–1)', ajuda: 'Same species / different species / with a Ditto.' },
      { k: 'ovosEsperando', rotulo: 'Eggs that can wait at the counter', tipo: 'num', int: true, min: 1, max: 20 },
      { k: 'ovosCarregados', rotulo: 'Eggs incubating at once', tipo: 'num', int: true, min: 1, max: 30 },
      { k: 'horasChocar', rotulo: 'Hours to hatch', tipo: 'num', min: 0.01, max: 240 },
      { k: 'horasChocarMedalhao', rotulo: 'Hours to hatch with the Medallion', tipo: 'num', min: 0.01, max: 240 },
      { k: 'nivelAoChocar', rotulo: 'Level when hatched', tipo: 'num', int: true, min: 1, max: 100 },
      { k: 'ivsHerdados', rotulo: 'IVs inherited', tipo: 'num', int: true, min: 0, max: 6 },
      { k: 'ivsComNo', rotulo: 'IVs inherited with a Destiny Knot', tipo: 'num', int: true, min: 0, max: 6 },
    ],
  },
  legal: {
    titulo: 'Terms of Use version', arquivo: 'legal', forma: 'objeto',
    descricao: 'The Terms of Use (public/legal/terms.html) and the Privacy Policy (public/legal/privacy.html) share one version. Sign-up asks to accept the current version; when you change the version, every player is asked to accept the new one at their next log-in and can\'t play until they do. Change the version only after the pages themselves say what changed.',
    campos: [
      { k: 'versao', rotulo: 'Version', tipo: 'texto', max: 20, obrigatorio: true, validar: s => /^[\w.-]{1,20}$/.test(s) ? null : 'e.g. 1, 2 or 2.1', ajuda: 'Raise it (1 → 2) when the Terms or the Privacy Policy change: everyone accepts again. Empty is not allowed.' },
      { k: 'data', rotulo: 'Date', tipo: 'texto', max: 10, validar: s => !s || /^\d{4}-\d\d-\d\d$/.test(s) ? null : 'YYYY-MM-DD', ajuda: 'Shown on both pages, e.g. 2026-11-07.' },
      { k: 'mudou', rotulo: 'What changed', tipo: 'texto', max: 300, ajuda: 'One short line shown on the pages and in the "We updated our Terms" box, e.g. "Diamond purchases (section 7)".' },
    ],
  },
  aparicoes: {
    titulo: 'Story sightings', arquivo: 'sightings', forma: 'objeto',
    descricao: 'Legendary Pokémon that show themselves once per player (sightings.mjs). Ho-Oh flies across the sky over its area (needs a partner Pokémon out); Suicune runs across water; Lugia swims under you as a shadow while surfing. Each player sees each one once (saved as "aparicoes").',
    campos: [
      { k: 'ligado', rotulo: 'On', tipo: 'bool', ajuda: 'Off = no sightings at all.' },
      { k: 'lista', rotulo: 'Sightings', tipo: 'json', validar: v => Array.isArray(v) && v.length <= 20 && v.every(x => x && ['hooh', 'suicune', 'lugia'].includes(x.id) && typeof x.glb === 'string' && /^pm\d{4}_\d{2}$/.test(x.glb) && (x.area == null || Number.isInteger(x.area) || (Array.isArray(x.area) && x.area.every(Number.isInteger))) && (x.mapa == null || typeof x.mapa === 'string' || Array.isArray(x.mapa))) ? null : 'a list like [{ "id": "hooh", "glb": "pm0250_00", "mapa": "kanto", "area": 1201 }] — id is hooh, suicune or lugia',
        ajuda: 'id = the flight (hooh, suicune, lugia), glb = the model, mapa = the map, area = where it happens, one area or a list (Route 1 is 1201). One of each id.' },
    ],
  },
  skins_pokemon: {
    titulo: 'Pokémon skins', arquivo: 'pokemon_skins', forma: 'objeto',
    descricao: 'Pokémon skins for sale in the Diamond shop (Cosmetics → Pokémon skins). A skin is a model pmDDDD_NN in public/scenery/mon (00 is the normal form, 99 is not a skin); bought skins are turned on per species in the Wardrobe → Pokémon, and everyone sees them. Only skins whose model exists are sold.',
    campos: [
      { k: 'vitrine', rotulo: 'On sale', tipo: 'json', validar: v => Array.isArray(v) && v.every(x => typeof x === 'string' && /^pm\d{4}_\d{2}$/.test(x) && !/_(00|99)$/.test(x)) ? null : 'a list of model ids, e.g. ["pm0025_31", "pm0133_32"]', ajuda: 'The skins on sale, in this order.' },
      { k: 'padrao', rotulo: 'Default price (Diamonds)', tipo: 'num', int: true, min: 1, max: 100000, ajuda: 'For any skin without its own price.' },
      { k: 'precos', rotulo: 'Prices per skin', tipo: 'json', validar: v => v == null || (v && typeof v === 'object' && !Array.isArray(v) && Object.entries(v).every(([k, n]) => /^pm\d{4}_\d{2}$/.test(k) && Number.isSafeInteger(n) && n >= 1 && n <= 100000)) ? null : 'e.g. { "pm0025_31": 200 }' },
      { k: 'ate', rotulo: 'On sale until', tipo: 'texto', max: 24, validar: s => !s || /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,3})?Z$/.test(s) ? null : 'UTC like 2026-12-31T23:59:59Z, or empty', ajuda: 'Empty = always on sale.' },
    ],
  },
  balsa: {
    titulo: 'Ferry stops', arquivo: 'ferry', caminho: 'paradas', forma: 'lista', id: 'id',
    descricao: 'The Vermilion ferry: every stop shows in the ferry window, in this order. A stop opens from its dock door (walking onto it) or its Sailor NPC. Stops the player can\'t use yet show greyed out with a lock and the reason. "Not open yet" locks a stop for everyone (GMs too).',
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'texto', max: 24, col: true, obrigatorio: true, validar: s => /^[a-z0-9-]{1,24}$/.test(s) ? null : 'lowercase letters, numbers and dashes' },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'mapa', rotulo: 'Map', tipo: 'texto', max: 7, col: true, obrigatorio: true, validar: s => /^(kanto|\d{7})$/.test(s) ? null : 'kanto or a 7-digit map id', ajuda: 'kanto, or a map id such as 2500001 (Sevii), 2000001 (Johto), 9800002 (Competition Center).' },
      { k: 'porta', rotulo: 'Dock door (cfg)', tipo: 'num', int: true, min: 1, max: 999999999, col: true, obrigatorio: true, ajuda: 'Walking onto this door opens the ferry window. Each stop needs its own.' },
      { k: 'chegada', rotulo: 'Arrival (cfg)', tipo: 'num', int: true, min: 1, max: 999999999, obrigatorio: true, ajuda: 'Where the ferry lands you.' },
      { k: 'area', rotulo: 'Area', tipo: 'num', int: true, min: 1, max: 999999999 },
      { k: 'npc', rotulo: 'Sailor NPC (cfg)', tipo: 'num', int: true, min: 1, max: 999999999, ajuda: 'Talking to this NPC opens the ferry here; an anchor floats over him.' },
      { k: 'info', rotulo: 'Subtitle', tipo: 'texto', max: 28, ajuda: 'Small line under the name, e.g. Colosseum and tournaments.' },
      { k: 'insignias', rotulo: 'Badges needed', tipo: 'num', int: true, min: 1, max: 99, col: true },
      { k: 'campeao', rotulo: 'After the Elite Four', tipo: 'bool', col: true },
      { k: 'fechada', rotulo: 'Not open yet', tipo: 'bool', col: true },
      { k: 'texto', rotulo: 'Reason (not open yet)', tipo: 'texto', max: 80, ajuda: 'e.g. Sailings to Johto start soon.' },
    ],
  },
  travas: {
    titulo: 'Door locks', arquivo: 'locks', forma: 'lista', id: 'id',
    descricao: 'Doors that stay shut until a story mission is done, enough Badges, an item or the Champion title. The player sees the lock bubble with the reason; GM accounts walk through. Leaving a locked place always works.',
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'texto', max: 40, col: true, obrigatorio: true, validar: s => /^[\w-]{1,40}$/.test(s) ? null : 'letters, numbers and dashes' },
      { k: 'ligada', rotulo: 'On', tipo: 'bool', col: true },
      { k: 'titulo', rotulo: 'Bubble title', tipo: 'texto', max: 40, col: true, ajuda: 'e.g. Door locked, Gate closed' },
      { k: 'fala', rotulo: 'Line in chat', tipo: 'texto', max: 200 },
      { k: 'portas', rotulo: 'Doors (cfg list)', tipo: 'json', validar: v => v == null || (Array.isArray(v) && v.every(n => Number.isInteger(n))) ? null : 'a list of door cfgs, e.g. [6110305, 6110306]' },
      { k: 'areas', rotulo: 'Areas behind it', tipo: 'json', validar: v => v == null || (Array.isArray(v) && v.every(n => Number.isInteger(n))) ? null : 'a list of area numbers', ajuda: 'Any door into these areas is locked too; from inside them the doors work.' },
      { k: 'ate', rotulo: 'Opens after mission', tipo: 'num', int: true, min: 1, max: 999999999, col: true },
      { k: 'insignias', rotulo: 'Badges needed', tipo: 'num', int: true, min: 1, max: 99, col: true },
      { k: 'item', rotulo: 'Item needed', tipo: 'num', int: true, min: 1, max: 999999999 },
      { k: 'campeao', rotulo: 'Champion only', tipo: 'bool' },
      { k: 'fechada', rotulo: 'Always closed', tipo: 'bool', ajuda: 'Shut for everyone until this is turned off (a place that is not built yet).' },
      { k: 'motivo', rotulo: 'Reason (always closed)', tipo: 'texto', max: 120, ajuda: 'The bubble text when "Always closed" is on.' },
      { k: 'nota', rotulo: 'Note (staff only)', tipo: 'texto', max: 200 },
    ],
  },
  bolas: {
    titulo: 'Balls', arquivo: 'game_config', caminho: 'bolas', forma: 'mapa', idValido: /^\d{1,9}$/, idAjuda: 'the ball\'s item number (type Poké Ball in Items)',
    descricao: 'The Poké Balls the player can use and each one\'s catch power. Only balls in this list appear in the selector and can be thrown. The price is set on the Shops screen.',
    campos: [
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'taxa', rotulo: 'Catch multiplier', tipo: 'num', min: 0.1, max: 1000, col: true, obrigatorio: true,
        ajuda: 'Poké Ball 1 · Great Ball 1.5 · Ultra Ball 2. 255 = always catches (Master Ball).' },
    ],
  },
  elite: {
    titulo: 'Elite Four', arquivo: 'elite', forma: 'objeto',
    descricao: 'The five League rooms in order. The live client reads membros[].npc as the trainer standing in each room.',
    campos: [
      { k: 'membros', rotulo: 'Members', tipo: 'json', ajuda: 'List of { ordem, nome, titulo, tipo, npc, cena, glb, time, dinheiro, falaAntes, falaDerrota, falaVitoria, campeao, itens, maxTrocas }. itens = what the AI may use, e.g. { "2004": 2 } (two Full Restores); maxTrocas = how many times a battle it may switch. A team member may set its moves: { dex, lv, movs: ["surf", "icebeam"], ivs: 31, held }. After a player\'s first win, the Champion\'s room holds the last player who took the title (server/data/champion.json).' },
    ],
  },
  ginasios: {
    titulo: 'Gyms', arquivo: 'gyms', forma: 'mapa',
    descricao: 'Leader, team, reward and lines of each gym.',
    campos: [
      { k: 'numero', rotulo: 'No.', tipo: 'num', min: 1, max: 99, int: true, col: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 60, col: true, obrigatorio: true },
      { k: 'lider', rotulo: 'Leader', tipo: 'texto', max: 40, col: true },
      { k: 'cidade', rotulo: 'City', tipo: 'texto', max: 40, col: true },
      { k: 'tipo', rotulo: 'Type', tipo: 'texto', max: 20, col: true },
      { k: 'dinheiro', rotulo: 'Victory money', tipo: 'num', min: 0, max: 10000000, int: true },
      { k: 'time', rotulo: 'Leader\'s team', tipo: 'json', validar: timeNpc, resumo: v => (v || []).map(p => '#' + p.dex + ' Lv' + p.lv).join(', '), ajuda: 'List of { "dex", "lv", "glb" } (up to 6).' },
      // Fase 2: a insígnia que o ginásio dá (o save guarda o id; o nome e o ícone das insígnias são a tela Insígnias)
      { k: 'insignia', rotulo: 'Victory badge', tipo: 'json', obrigatorio: true, validar: insigniaGinasio, resumo: v => v?.nome || '',
        ajuda: '{ "id": 101, "nome": "Boulder Badge", "icone": "dghz_1" } — the id is the one on the Badges screen; the game counts badges by it.' },
      { k: 'cfgLider', rotulo: 'Leader NPC (cfg)', tipo: 'num', min: 1, max: 999999999, int: true, obrigatorio: true, ajuda: 'The NPC that becomes the leader ⚔ (the game finds the gym by this number).' },
      { k: 'cfgGuia', rotulo: 'Guide NPC (cfg)', tipo: 'num', min: 1, max: 999999999, int: true },
      { k: 'cena', rotulo: 'Interior scene', tipo: 'num', min: 1, max: 99999999, int: true },
      { k: 'glb', rotulo: 'Leader model', tipo: 'texto', max: 60, validar: s => /^[\w/-]{1,60}$/.test(s) ? null : 'model path, e.g. npc/NPC1004', ajuda: 'In scenery/, without .glb (e.g. npc/NPC1004 or pc/Girl_012).' },
      { k: 'glbReserva', rotulo: 'Stand-in model', tipo: 'texto', max: 60, validar: s => !s || /^[\w/-]{1,60}$/.test(s) ? null : 'model path, e.g. npc/fc0039_00', ajuda: 'Worn while the leader\'s own model file is missing (e.g. npc/fc0039_00).' },
      { k: 'acaso', rotulo: 'AI randomness (0–1)', tipo: 'num', min: 0, max: 1, ajuda: 'How often the leader picks a random move instead of its best one. Empty = 0.3. 0 = always the best move.' },
      { k: 'fala', rotulo: 'Line before battle', tipo: 'linhas', validar: listaDeTextos },
      { k: 'vitoria', rotulo: 'Line when the player wins', tipo: 'linhas', validar: listaDeTextos },
      { k: 'derrota', rotulo: 'Line when the player loses', tipo: 'linhas', validar: listaDeTextos },
      { k: 'cooldownMin', rotulo: 'Rematch wait (min)', tipo: 'numeros', min: 0, max: 100000, int: true },
      { k: 'resetMoedas', rotulo: 'Coins to skip the wait', tipo: 'num', min: 0, max: 10000000, int: true },
    ],
  },
  mochilas: {
    titulo: 'Backpacks', arquivo: 'bags', forma: 'lista', id: 'id',
    descricao: 'Cosmetic trainer backpacks. The preview puts the backpack on a trainer (drag to rotate) and says whether the model exists in this copy.',
    previa: '/admin/preview_bag.mjs',                   // Fase 3
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'num', min: 1, max: 99999999, int: true, col: true, obrigatorio: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 60, col: true },
      { k: 'glb', rotulo: 'Model (glb)', tipo: 'texto', max: 60, col: true, validar: s => /^[\w-]{1,60}$/.test(s) ? null : 'prefab name, e.g. Bag001', ajuda: 'Prefab at scenery/pc/<model>.glb (e.g. Bag001).' },
      { k: 'qualidade', rotulo: 'Quality', tipo: 'num', min: 0, max: 10, int: true, col: true },
      { k: 'sexo', rotulo: 'Who can use it', tipo: 'opcao', opcoes: [{ v: 0, rotulo: 'Everyone' }, { v: 1, rotulo: 'Boy' }, { v: 2, rotulo: 'Girl' }] },
      { k: 'icone', rotulo: 'Icon', tipo: 'texto', max: 60 },
      { k: 'glbOk', rotulo: 'Model exists', tipo: 'bool' },
    ],
  },
  skins_treinador: {
    titulo: 'Trainer skins', arquivo: 'trainer_skins', forma: 'lista', id: 'id',
    descricao: 'Trainer outfit sets. Click a row to see the model in 3D (drag to rotate).',
    previa: '/admin/preview_skin.mjs',                      // data.mjs carrega e mostra o modelo acima do formulário
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'num', min: 1, max: 99999999, int: true, col: true, obrigatorio: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 60, col: true },
      { k: 'sexo', rotulo: 'Gender', tipo: 'opcao', opcoes: [{ v: 'menino', rotulo: 'Boy' }, { v: 'menina', rotulo: 'Girl' }], col: true },
      { k: 'prefab', rotulo: 'Prefab', tipo: 'texto', max: 60, col: true, ajuda: 'Model at public/scenery/pc/<prefab>.glb.' },
      // as receitas (canais da máscara → partes) vivem no character.mjs (CANAIS/ROTULOS); o jogo lê este campo por prefab
      { k: 'tinta', rotulo: 'Editable colors', tipo: 'opcao', col: true, opcoes: [
        { v: 'fixo', rotulo: 'No (fixed look)' },
        { v: 'heroi', rotulo: 'Yes — Hero: skin, hair, cap and shirt, jacket and pants, eyes' },
        { v: 'heroina', rotulo: 'Yes — Heroine: skin, hair, dress, hat, eyes' },
        { v: 'misty', rotulo: 'Yes — Misty: hair and eyes' },
        { v: 'propria', rotulo: 'Yes — the model\'s own recipe (Color recipes)' },
      ], ajuda: 'The player picks these colors during character creation. Each recipe uses a mask made for ONE model — the preview above says whether it fits this one. "Own recipe" = the one on the Color recipes screen with the prefab\'s ID. Empty = the code default.' },
      { k: 'criacao', rotulo: 'Shown in character creation', tipo: 'bool', col: true,
        ajuda: 'Whether the skin is offered to the player on the character creation screen (and in Settings → ✎ Character). The usual 10 come first, the rest in this list\'s order; past 5 per gender, the screen gets pages. Requires the model to exist.' },
      { k: 'inicial', rotulo: 'Starter in the original game', tipo: 'bool', ajuda: 'Informational only (comes from the original game).' },
      { k: 'ok', rotulo: 'Unlocked', tipo: 'bool' },
      { k: 'glbOk', rotulo: 'Model exists', tipo: 'bool' },
    ],
  },
  receitas_cor: {
    titulo: 'Color recipes', arquivo: 'color_recipes', forma: 'mapa',
    descricao: 'The parts of each outfit the player can paint: the name they see and the default color. Generated from the original game\'s masks (tools/color_recipes.mjs); the ID is the prefab in lowercase. The preview shows edits live.',
    previa: '/admin/preview_skin.mjs',
    validar: receitaCompleta,
    campos: [
      { k: 'modelo', rotulo: 'Model (prefab)', tipo: 'texto', max: 60, col: true, obrigatorio: true },
      { k: 'rotulos', rotulo: 'Parts (name the player sees)', tipo: 'json', col: true, obrigatorio: true, validar: nomesDasPartes, resumo: v => Object.values(v).join(', '),
        ajuda: '{ "key": "name" } — the order here is the order on the creation screen, which fits about 15 characters per name. The keys pele, cabelo, olhos, roupa and roupa2 (skin, hair, eyes, clothes) get the game\'s ready-made palette.' },
      { k: 'padrao', rotulo: 'Default color of each part', tipo: 'json', obrigatorio: true, validar: coresDasPartes, ajuda: '{ "key": "#rrggbb" } — the color the outfit starts with (the original game\'s factory color).' },
      { k: 'texturas', rotulo: 'Mask channels (advanced)', tipo: 'json', obrigatorio: true, validar: canaisDaMascara,
        ajuda: 'Per model material: R/G/B/K = the key of the part that channel paints, [r, g, b] (0–1) for a fixed color, or null (keeps the texture). mask = file in scenery/npc/mask.' },
    ],
  },
  ...ESQUEMAS_F2,
  ...ESQUEMAS_F3,
  ...ESQUEMAS_BOSS,
};

const LIMITE_REGISTROS = 20000, LIMITE_REGISTRO_BYTES = 60000;

export function validarCampo(c, v) {
  const erro = m => ({ ok: false, erro: m });
  switch (c.tipo) {
    case 'texto': { const s = String(v).slice(0, c.max || 200), m = c.validar?.(s); return m ? erro(m) : { ok: true, v: s }; }
    case 'num': {
      const n = Number(v);
      if (!Number.isFinite(n)) return erro('must be a number');
      if (c.int && !Number.isInteger(n)) return erro('must be an integer');
      if (c.min != null && n < c.min) return erro(`minimum ${c.min}`);
      if (c.max != null && n > c.max) return erro(`maximum ${c.max}`);
      return { ok: true, v: n };
    }
    case 'bool': return { ok: true, v: v === true || v === 'true' || v === 1 };
    case 'opcao': {
      const o = (c.opcoes || []).find(o => String(o.v) === String(v));
      return o ? { ok: true, v: o.v } : erro('invalid option');
    }
    case 'numeros': {
      const arr = Array.isArray(v) ? v : String(v).split(/[,;\s]+/).filter(Boolean);
      const nums = arr.map(Number);
      if (nums.some(n => !Number.isFinite(n))) return erro('use comma-separated numbers');
      if (c.tam && nums.length !== c.tam) return erro(`needs ${c.tam} numbers`);
      for (const n of nums) {
        if (c.int && !Number.isInteger(n)) return erro('all must be integers');
        if (c.min != null && n < c.min) return erro(`minimum ${c.min}`);
        if (c.max != null && n > c.max) return erro(`maximum ${c.max}`);
      }
      return { ok: true, v: nums };
    }
    case 'linhas':
    case 'json': {
      let s; try { s = JSON.stringify(v); } catch { return erro('invalid value'); }
      if (s === undefined) return erro('invalid value');
      if (s.length > (c.max || 50000)) return erro('too large');
      const val = JSON.parse(s);
      const m = c.validar?.(val);
      return m ? erro(m) : { ok: true, v: val };
    }
    default: return erro('unknown field type');
  }
}

export function validarRegistro(esq, reg) {
  if (!reg || typeof reg !== 'object' || Array.isArray(reg)) return { ok: false, erro: 'invalid record' };
  const conhecidos = new Set(esq.campos.map(c => c.k)), out = {};
  for (const [k, v] of Object.entries(reg)) if (!conhecidos.has(k) && /^\w{1,40}$/.test(k)) out[k] = v;   // passa direto
  for (const c of esq.campos) {
    const v = reg[c.k];
    if (v === undefined || v === null || v === '') {
      if (c.obrigatorio) return { ok: false, erro: `${c.rotulo || c.k} is required` };
      continue;                                                                    // vazio = sem o campo (usa o padrão)
    }
    const r = validarCampo(c, v);
    if (!r.ok) return { ok: false, erro: `${c.rotulo || c.k}: ${r.erro}` };
    out[c.k] = r.v;
  }
  if (JSON.stringify(out).length > LIMITE_REGISTRO_BYTES) return { ok: false, erro: 'record too large' };
  const m = esq.validar?.(out);                                                    // regra que cruza campos (ex.: receita de cor)
  if (m) return { ok: false, erro: m };
  return { ok: true, v: out };
}

/** `registroLista` (ex.: uma loja = lista de produtos): cada elemento é validado pelos campos do esquema. */
export function validarLista(esq, lista) {
  if (!Array.isArray(lista)) return { ok: false, erro: 'expected a list' };
  if (lista.length > (esq.maxLista || 2000)) return { ok: false, erro: 'too many items in the list' };
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    const r = validarRegistro(esq, lista[i]);
    if (!r.ok) return { ok: false, erro: `[item ${i + 1}] ${r.erro}` };
    out.push(r.v);
  }
  return { ok: true, v: out };
}

export function validarColecao(esq, dados) {
  // Fase 2: conteúdo que não é feito de registros (ou regra entre registros) — o esquema valida tudo; `generica` = o caminho normal
  if (esq.colecao) return esq.colecao(dados, { validarCampo, validarRegistro, generica: d => validarColecao({ ...esq, colecao: null }, d) });
  if (esq.forma === 'objeto') return validarRegistro(esq, dados);
  if (esq.forma === 'mapa') {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return { ok: false, erro: 'expected an object { id: record }' };
    const ids = Object.keys(dados);
    if (ids.length > LIMITE_REGISTROS) return { ok: false, erro: 'too many records' };
    const out = {};
    for (const id of ids) {
      if (!(esq.idValido || /^[\w-]{1,40}$/).test(id)) return { ok: false, erro: `invalid id: ${id}` + (esq.idAjuda ? ` (${esq.idAjuda})` : '') };
      const r = esq.registroLista ? validarLista(esq, dados[id]) : validarRegistro(esq, dados[id]);
      if (!r.ok) return { ok: false, erro: `[${id}] ${r.erro}` };
      out[id] = r.v;
    }
    return { ok: true, v: out };
  }
  if (esq.forma === 'lista') {
    if (!Array.isArray(dados)) return { ok: false, erro: 'expected a list' };
    if (dados.length > LIMITE_REGISTROS) return { ok: false, erro: 'too many records' };
    const out = [], vistos = new Set();
    for (let i = 0; i < dados.length; i++) {
      const r = validarRegistro(esq, dados[i]);
      if (!r.ok) return { ok: false, erro: `[row ${i + 1}] ${r.erro}` };
      if (esq.id) {
        const id = r.v[esq.id];
        if (id === undefined || vistos.has(String(id))) return { ok: false, erro: `[row ${i + 1}] ${esq.id} empty or duplicated` };
        vistos.add(String(id));
      }
      out.push(r.v);
    }
    return { ok: true, v: out };
  }
  return { ok: false, erro: 'unknown schema shape' };
}
