/* Adds English entries for dump item/badge/type names that ui_en still lacks, then the caller should run locale_invert. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiPath = path.join(RAIZ, 'public/data/locale/ui_en.json');
const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public/data/menus_dados.json'), 'utf8'));
const ui = JSON.parse(fs.readFileSync(uiPath, 'utf8'));
const conteudo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public/data/locale/conteudo_en.json'), 'utf8'));
const nomes = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public/data/locale/nomes_en.json'), 'utf8'));
const tem = k => (ui[k] || conteudo[k] || nomes[k]);

const FIXOS = {
  'Bola Rede': 'Net Ball',
  'Bola Ninho': 'Nest Ball',
  'Bola Rápida': 'Quick Ball',
  'Bola Parque': 'Park Ball',
  'bola brilhante': 'Cherish Ball',
  'Moeda': 'Coins',
  'Materiais': 'Materials',
  'Itens transportados': 'Key items',
  'Máquina Técnica': 'TM',
  'pacote': 'Pack',
  'Pokébola': 'Poké Ball',
  'Fragmento': 'Shard',
  'Recuperação': 'Medicine',
  'Título': 'Title',
  'traje': 'Outfit',
  'montaria': 'Mount',
  'Cupões': 'Coupons',
  'Equipamento': 'Held item',
  'Chamando a Pedra': 'Evolution stone',
  'Edifícios do Habitat': 'Habitat buildings',
  'Materiais do Habitat': 'Habitat materials',
  'Comida do Habitat': 'Habitat food',
  'Sementes do Habitat': 'Habitat seeds',
  'medalha de Asas': 'Zephyr Badge',
  'medalha de Inseto': 'Hive Badge',
  'medalha Regular': 'Plain Badge',
  'medalha de Fantasma': 'Fog Badge',
  'medalha de Golpe': 'Storm Badge',
  'medalha de Aço': 'Mineral Badge',
  'medalha de Gelo': 'Glacier Badge',
  'medalha de Dragão Ascendente': 'Rising Badge',
  'medalha de Rocha': 'Stone Badge',
  'medalha de Boxe': 'Knuckle Badge',
  'medalha de Elétrica': 'Dynamo Badge',
  'medalha de Chamas': 'Heat Badge',
  'medalha de Balança': 'Balance Badge',
  'medalha de Pena Branca': 'Feather Badge',
  'medalha de Psíquico': 'Mind Badge',
  'medalha de gota de chuva': 'Rain Badge',
  'Medalha do Carvão': 'Coal Badge',
  'Medalha da Floresta': 'Forest Badge',
  'Medalha da Pavimentação': 'Cobble Badge',
  'Medalha do Pântano': 'Fen Badge',
  'Medalha das Ruínas': 'Relic Badge',
  'Medalha da Mina': 'Mine Badge',
  'Medalha da Geleira': 'Icicle Badge',
  'Medalha do Farol': 'Beacon Badge',
  'Poção Máxima': 'Max Potion',
  'Restaurador Total': 'Full Restore',
  'Antiueimadura': 'Burn Heal',
  'Anticongelamento': 'Ice Heal',
  'Antissono': 'Awakening',
  'Antiparalisia': 'Paralyze Heal',
  'cura Total': 'Full Heal',
  'Água Enriquecieda': 'Fresh Water',
  'superbebida': 'Soda Pop',
  'Energético': 'Lemonade',
  'Leite Moomoo': 'Moomoo Milk',
  'Pó Energético': 'Energy Powder',
  'Raiz Energética': 'Energy Root',
  'Pó curativo': 'Heal Powder',
  'Erva reanimadora': 'Revival Herb',
  'Pó Brilhante': 'Bright Powder',
  'Garra Rápida': 'Quick Claw',
  'Pedra Rei': "King's Rock",
  'Pó de prata': 'Silver Powder',
  'Faixa Focalizadora': 'Focus Band',
  'Lente de Alcance': 'Scope Lens',
  'Revestimento Metálico': 'Metal Coat',
  'Areia macia': 'Soft Sand',
  'Pedra dura': 'Hard Stone',
  'Semente milagrosa': 'Miracle Seed',
  'óculos pretos': 'Black Glasses',
  'Faixa Preta': 'Black Belt',
  'ímanes': 'Magnet',
  'Gotas misteriosas': 'Mystic Water',
  'Bico Afiado': 'Sharp Beak',
  'Farpa Venenosa': 'Poison Barb',
  'Gelo Eterno': 'Never-Melt Ice',
  'Talismã de Feitiço': 'Spell Tag',
  'Colher Torta': 'Twisted Spoon',
  'Carvão': 'Charcoal',
  'Presa do Dragão': 'Dragon Fang',
  'Soco da Sorte': 'Lucky Punch',
  'Osso Grosso': 'Thick Club',
  'alho-francês': 'Stick',
  'Faixa da Escolha': 'Choice Band',
  'Óculos de Escolha': 'Choice Specs',
  'Lenço de escolha': 'Choice Scarf',
  'gema da Alma': 'Soul Dew',
  'in Poké Ball': 'in Poké Ball',
  'fainted': 'fainted',
  'in battle': 'in battle',
  'following': 'following',
  'catch': 'catch',
  '· fainted {n}s · F catch': '· fainted {n}s · F catch',
  'no target — click a wild Pokémon or ': 'no target — click a wild Pokémon or ',
  'Use on F': 'Use on F',
  'Use on partner': 'Use on partner',
  'Shortcut': 'Shortcut',
  'pin to the first free shortcut (5–8)': 'pin to the first free shortcut (5–8)',
  'evolves your partner if its rule uses this item': 'evolves your partner if its rule uses this item',
  'original game prices': 'original game prices',
  'Pin to': 'Pin to',
  'Nothing here yet. The town Pokémart (talk to the clerk) sells balls and medicine; mission items arrive as rewards.':
    'Nothing here yet. The town Pokémart (talk to the clerk) sells balls and medicine; mission items arrive as rewards.',
  'Nothing to pin: potions and balls show up here when they are in the Bag (Shop).':
    'Nothing to pin: potions and balls show up here when they are in the Bag (Shop).',
  'na Pokébola': 'in Poké Ball',
  desmaiado: 'fainted',
  'em batalha': 'in battle',
  seguindo: 'following',
  captura: 'catch',
};

const PALAVRAS = [
  [/\[Fragmento\]/gi, '[Fragment]'],
  [/\bFragmento\b/gi, 'Fragment'],
  [/\bPokébola\b/gi, 'Poké Ball'],
  [/\bPokébolas\b/gi, 'Poké Balls'],
  [/\bGrande Bola\b/gi, 'Great Ball'],
  [/\bUltra Bola\b/gi, 'Ultra Ball'],
  [/\bBola Mestra\b/gi, 'Master Ball'],
  [/\bPoção\b/gi, 'Potion'],
  [/\bReanimador\b/gi, 'Revive'],
  [/\bExperiência\b/gi, 'Experience'],
  [/\bPontos\b/gi, 'Points'],
  [/\bMoeda\b/gi, 'Coin'],
  [/\bMoedas\b/gi, 'Coins'],
  [/\bmedalha\b/gi, 'Badge'],
  [/\bMedalha\b/gi, 'Badge'],
  [/\bGema\b/gi, 'Gem'],
  [/\bSemente\b/gi, 'Seed'],
  [/\bSementes\b/gi, 'Seeds'],
  [/\bPedra\b/gi, 'Stone'],
  [/\bFaixa\b/gi, 'Band'],
  [/\bÓculos\b/gi, 'Glasses'],
  [/\bLenço\b/gi, 'Scarf'],
  [/\bGarra\b/gi, 'Claw'],
  [/\bPresa\b/gi, 'Fang'],
  [/\bAtaque\b/gi, 'Attack'],
  [/\bDefesa\b/gi, 'Defense'],
  [/\bVelocidade\b/gi, 'Speed'],
  [/\bPrecisão\b/gi, 'Accuracy'],
  [/\bEsquiva\b/gi, 'Evasion'],
  [/\bHabilidade\b/gi, 'Ability'],
  [/\bEnergia\b/gi, 'Energy'],
  [/\bFogo\b/gi, 'Fire'],
  [/\bÁgua\b/gi, 'Water'],
  [/\bPlanta\b/gi, 'Grass'],
  [/\bElétric\w*/gi, 'Electric'],
  [/\bGelo\b/gi, 'Ice'],
  [/\bLutador|Combate|Luta\b/gi, 'Fighting'],
  [/\bVeneno\b/gi, 'Poison'],
  [/\bTerra\b/gi, 'Ground'],
  [/\bVoo|Voador\b/gi, 'Flying'],
  [/\bPsíquico\b/gi, 'Psychic'],
  [/\bInseto\b/gi, 'Bug'],
  [/\bPedra\b/gi, 'Rock'],
  [/\bFantasma\b/gi, 'Ghost'],
  [/\bDragão\b/gi, 'Dragon'],
  [/\bSombri\w*|Noturno\b/gi, 'Dark'],
  [/\bAço\b/gi, 'Steel'],
  [/\bFada\b/gi, 'Fairy'],
  [/\bNormal\b/gi, 'Normal'],
  [/\bcomunidade\b/gi, 'community'],
  [/\bHabitat\b/gi, 'Habitat'],
  [/\bPasse\b/gi, 'Pass'],
  [/\bTemporada\b/gi, 'Season'],
  [/\bArena\b/gi, 'Arena'],
  [/\bGuilda\b/gi, 'Guild'],
  [/\bdiária\b/gi, 'daily'],
  [/\batividade\b/gi, 'activity'],
  [/\bdesafio\b/gi, 'challenge'],
  [/\bduelos\b/gi, 'duels'],
  [/\bcaptura\b/gi, 'capture'],
  [/\bcomemorativa\b/gi, 'commemorative'],
  [/\bbrilhante\b/gi, 'shiny'],
  [/\bresto de joias\b/gi, 'leftover gems'],
];

function traduzir(s) {
  if (FIXOS[s]) return FIXOS[s];
  let out = s;
  for (const [re, to] of PALAVRAS) out = out.replace(re, to);
  return out;
}

let add = 0;
function por(k, v) {
  if (!k || typeof k !== 'string') return;
  if (tem(k) || ui[k]) return;
  ui[k] = v;
  add++;
}

for (const [k, v] of Object.entries(FIXOS)) por(k, v);
for (const i of Object.values(dados.itens || {})) {
  if (i?.n) por(i.n, traduzir(i.n));
  if (i?.d) por(i.d, traduzir(i.d));
}
for (const t of Object.values(dados.tipos || {})) por(t, traduzir(t));
for (const b of dados.insignias || []) if (b?.n) por(b.n, traduzir(b.n));

fs.writeFileSync(uiPath, JSON.stringify(ui, null, 2) + '\n');
console.log('added', add, 'ui_en keys');
