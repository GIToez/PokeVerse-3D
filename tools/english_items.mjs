/* Rewrite menu_data item names/descriptions (and related labels) to English source.
 * Leftover Portuguese keys stay in ui_en.json; run locale_invert.mjs after this. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(RAIZ, 'public/data/menu_data.json');
const uiPath = path.join(RAIZ, 'public/data/locale/ui_en.json');
const moves = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public/data/moves.json'), 'utf8'));
const dados = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const ui = JSON.parse(fs.readFileSync(uiPath, 'utf8'));

const MOVE_PT = {};
for (const m of Object.values(moves)) {
  if (m?.nomePt && m?.nome) MOVE_PT[m.nomePt] = m.nome;
}

const NAMES = {
  Moeda: 'Coin', Cristal: 'Crystal', HP: 'HP', 'Pontos de fadiga': 'Stamina',
  Experiência: 'Experience', 'Experiência da comunidade': 'Community XP',
  'Pontos de atividade da comunidade': 'Community activity points',
  'Essência da memória': 'Memory essence', 'Pontos da máquina de gacha': 'Gacha points',
  'Experiência VIP': 'VIP XP', 'Pontos de esforço': 'Effort points',
  'Pontos da arena': 'Arena points', 'Medalha da arena': 'Arena medal',
  'Pontos da arena de combate': 'Battle arena points', 'Pontos de duelos': 'Duel points',
  'Atividade diária obrigatória': 'Daily activity',
  'Pontos universais do cartão mensal': 'Monthly card points',
  'Moeda da comunidade': 'Community coin', 'Pontos da placa de escada': 'Ladder points',
  'Moeda brilhante da sorte': 'Lucky shiny coin',
  'Pontos de crescimento do festival de novos servidores': 'New-server festival growth points',
  'Pontos de desafio do festival de novos servidores': 'New-server festival challenge points',
  'Pontos de duelos em dupla': 'Tag-battle points',
  'Experiência do passe de batalha': 'Battle Pass XP',
  'Pontos do passe de batalha': 'Battle Pass points',
  'Pontos da competição dos elites': 'Elite contest points',
  'Pontos do Arena': 'Arena points', 'Pontos de batalha de comunidade': 'Community battle points',
  'Pontos de captura de insetos': 'Bug-catching points',
  'Moeda de captura de insetos': 'Bug-catching coin',
  'Moeda comemorativa': 'Commemorative coin', 'Moeda de Arena': 'Arena coin',
  'Estamina para Síntese': 'Synthesis stamina',
  'Pontos de Tecnologia da Comunidade': 'Community tech points',
  'ordem de rastrear': 'Tracking order', 'resto de joias': 'Leftover gems',
  'Pontos de Pesca': 'Fishing points', 'Moedas da quinta': 'Ranch coins',
  'Pontos de devolução': 'Return points', 'Moeda de Guilda Premium': 'Premium guild coin',
  'Pontos de Zongzi': 'Zongzi points',
  'Pontos de Seleção do Líder de Ginásio': 'Gym Leader pick points',
  'Pontos de Compra em Grupo': 'Group-buy points', 'Pontos Ativos': 'Active points',
  'Pontos do Passe de Temporada': 'Season Pass points',
  'EXP do Habitat, pode ser usado para subir de nível do jogador.': 'Habitat XP',
  'Moedas do Habitat, podem ser usadas para comprar itens do habitat.': 'Habitat coins',
  'Pontos de Gacha do SeasonChannel': 'Season Channel gacha points',
  'Moeda de Pesca Colorida': 'Colorful fishing coin',
  'Pontos de Talento Normais': 'Normal talent points',
  'Pontos de Talento Avançados': 'Advanced talent points',
  'Chama do dragão auspicioso': 'Auspicious dragon flame',
  'Flores em plena floração': 'Full-bloom flowers',
  'Fogo auspicioso': 'Auspicious fire', 'Boa sorte e felicidades': 'Good luck and happiness',
  'Fragmento de Pacote de Cartas': 'Card pack shard',
  Pokébola: 'Poké Ball', 'Grande Bola': 'Great Ball', 'Ultra Bola': 'Ultra Ball',
  'Bola Mestra': 'Master Ball', 'Bola Safári': 'Safari Ball', 'Bola Nível': 'Level Ball',
  'Bola Rede': 'Net Ball', 'Bola Ninho': 'Nest Ball', 'Bola Repetição': 'Repeat Ball',
  'Bola Rápida': 'Quick Ball', 'Bola Parque': 'Park Ball', 'bola brilhante': 'Cherish Ball',
  Poção: 'Potion', SuperPoção: 'Super Potion', HiperPoção: 'Hyper Potion',
  'Poção Máxima': 'Max Potion', 'Restaurador Total': 'Full Restore',
  Antídoto: 'Antidote', Antiueimadura: 'Burn Heal', Anticongelamento: 'Ice Heal',
  Antissono: 'Awakening', Antiparalisia: 'Paralyze Heal', 'cura Total': 'Full Heal',
  Reanimador: 'Revive', 'Reanimador Máximo': 'Max Revive',
  'Água Enriquecieda': 'Fresh Water', superbebida: 'Soda Pop', Energético: 'Lemonade',
  'Leite Moomoo': 'Moomoo Milk', 'Pó Energético': 'Energy Powder',
  'Raiz Energética': 'Energy Root', 'Pó curativo': 'Heal Powder',
  'Erva reanimadora': 'Revival Herb',
  'Pequeno Suplemento de PV (Individual)': 'Ether',
  'Suplemento Completo de PV (Individual)': 'Max Ether',
  'Pequeno Suplemento de PV (Múltiplo)': 'Elixir',
  'Suplemento Completo de PV (Múltiplo)': 'Max Elixir',
  'Doces furiosos': 'Rage Candy Bar', 'Bolinho de lava': 'Lava Cookie',
  'bolo da floresta': 'Old Gateau', 'Soevete de Castelia': 'Casteliacone',
  'crepe de lumiose': 'Lumiose Galette', 'pãozinho de shalour': 'Shalour Sable',
  'Sonho recheado': 'Big Malasada', 'salgadinhos de pewter': 'Pewter Crunchies',
  'Muffin Jubilife': 'Jubilife Muffin', 'suco de berry': 'Berry Juice',
  'Coraçãzinho doce': 'Sweet Heart', 'Cinzas secretas': 'Sacred Ash',
  'Mel Gigante': 'Max Honey', 'Medicina chinesa': 'Heal Powder mix',
  'Boa medicina chinesa': 'Energy Root mix', 'Grande medicina chinesa': 'Revival mix',
  'Defesa de Habilidade': 'Guard Spec.', 'Ataque Crítico': 'Dire Hit',
  'Aumento de Força': 'X Attack', 'Aumento de Defesa': 'X Defense',
  'Aumento de Ataque Especial': 'X Sp. Atk', 'Aumento de Defesa Especial': 'X Sp. Def',
  'Aumento de Velocidade': 'X Speed', 'Aumento de Precisão': 'X Accuracy',
  'Boneco de Pipi': 'Poké Doll', 'Cauda de Meowth': 'Fluffy Tail',
  'Brinquedo Poké': 'Poké Toy', 'Cogumelo Gigante': 'Max Mushrooms',
  'Pílula de Ataque': 'X Attack pill', 'Pílula de Defesa': 'X Defense pill',
  'Aumento Múltiplo': 'X Multi', 'Aumento de Esquiva': 'X Evasion',
  'Bolinho de massa à escolha': 'Choice dumpling',
  'Rabanete com duas especiarias': 'Double radish', 'Troca de lanche': 'Snack swap',
  'Pó Brilhante': 'Bright Powder', 'Garra Rápida': 'Quick Claw',
  'Pedra Rei': "King's Rock", 'Pó de prata': 'Silver Powder',
  'Faixa Focalizadora': 'Focus Band', 'Lente de Alcance': 'Scope Lens',
  'Revestimento Metálico': 'Metal Coat', Sobras: 'Leftovers',
  'Areia macia': 'Soft Sand', 'Pedra dura': 'Hard Stone',
  'Semente milagrosa': 'Miracle Seed', 'óculos pretos': 'Black Glasses',
  'Faixa Preta': 'Black Belt', ímanes: 'Magnet', 'Gotas misteriosas': 'Mystic Water',
  'Bico Afiado': 'Sharp Beak', 'Farpa Venenosa': 'Poison Barb',
  'Gelo Eterno': 'Never-Melt Ice', 'Talismã de Feitiço': 'Spell Tag',
  'Colher Torta': 'Twisted Spoon', Carvão: 'Charcoal', 'Presa do Dragão': 'Dragon Fang',
  'Banda Rosa': 'Pink Bow', 'Banda Polkadot': 'Polkadot Bow',
  'Lenço de seda': 'Silk Scarf', 'Soco da Sorte': 'Lucky Punch',
  'Osso Grosso': 'Thick Club', 'alho-francês': 'Leek',
  'Erva branca': 'White Herb', 'Erva Forte': 'Power Herb',
  'Faixa da Escolha': 'Choice Band', 'Óculos de Escolha': 'Choice Specs',
  'Lenço de escolha': 'Choice Scarf', 'gema da Alma': 'Soul Dew',
  'Sino de Concha': 'Shell Bell', 'Incenso do mar': 'Sea Incense',
  'incenso relaxante': 'Lax Incense', 'insenco Exótico': 'Odd Incense',
  'insenco de pedra': 'Rock Incense', 'insenco Cheia': 'Full Incense',
  'insenco da onda': 'Wave Incense', 'insenco da Flor': 'Rose Incense',
  'Gema de Diamante': 'Adamant Orb', 'Gema Brilhante': 'Lustrous Orb',
  'Gema Grisalha': 'Griseous Orb', 'Garra de Navalha': 'Razor Claw',
  'Presa Afiada': 'Razor Fang', 'Lente Ampla': 'Wide Lens',
  'Faixa Musculosa': 'Muscle Band', 'Óculos de Sabedoria': 'Wise Glasses',
  'Cinto de mestre': 'Expert Belt', 'Argila clara': 'Light Clay',
  'Gema da vida': 'Life Orb', 'Gema de veneno': 'Toxic Orb',
  'Gema de fogo': 'Flame Orb', 'Cinta de Foco': 'Focus Sash',
  'Lente de Zoom': 'Zoom Lens', Metrónomo: 'Metronome',
  'Bola de ferro': 'Iron Ball', 'Cauda atrasada': 'Lagging Tail',
  'Lama Negra': 'Black Sludge', 'Pedra gelada': 'Icy Rock',
  'pedra de areno': 'Smooth Rock', 'pedra quente': 'Heat Rock',
  'pedra molhada': 'Damp Rock', 'Garra de aperto': 'Grip Claw',
  Espinho: 'Sticky Barb', 'Concha do galpão': 'Shed Shell',
  'Raiz grande': 'Big Root', 'pedra leve': 'Float Stone',
  'Capacete de Pedra': 'Rocky Helmet', 'Cartão Vermelho': 'Red Card',
  'Alvo do anel': 'Ring Target', 'Faixa de ligação': 'Binding Band',
  'bulbo absorvente': 'Absorb Bulb', 'bateria recarregável': 'Cell Battery',
  'Botão de fuga': 'Eject Button', 'Gema de Fogo': 'Fire Gem',
  'Gema da Água': 'Water Gem', 'Gema da Eletricidade': 'Electric Gem',
  'Gema da Planta': 'Grass Gem', 'Gema de Gelo': 'Ice Gem',
  'Gema de Combate': 'Fighting Gem', 'Gema de Veneno': 'Poison Gem',
  'Gema da Terra': 'Ground Gem', 'Gema de Voo': 'Flying Gem',
  'Gema dos Superpoderes': 'Psychic Gem', 'Gema de Inseto': 'Bug Gem',
  'Gema de Pedra': 'Rock Gem', 'Gema de Fantasma': 'Ghost Gem',
  'Gema do Dragão': 'Dragon Gem', 'Gema do Noturno': 'Dark Gem',
  'Gema de Aço': 'Steel Gem', 'Gema normal': 'Normal Gem',
  'Gema da fada': 'Fairy Gem', 'Política de Fraqueza': 'Weakness Policy',
  'Seguro Contra Erro': 'Safety Goggles fail-safe', 'Colete de Ataque': 'Assault Vest',
  'Musgo luminoso': 'Luminous Moss', 'bola de neve': 'Snowball',
  'Óculos de proteção': 'Safety Goggles', 'Extensor de terreno': 'Terrain Extender',
  'Almofadas de proteção': 'Protective Pads',
  'Sementes Eléctricas': 'Electric Seed', 'Sementes Espirituais': 'Psychic Seed',
  'Sementes de Névoa': 'Misty Seed', 'Sementes de Erva': 'Grassy Seed',
  'Memória de Luta': 'Fighting Memory', 'Spray para garganta': 'Throat Spray',
  'Mochila de fuga': 'Eject Pack', 'Botas grossas': 'Heavy-Duty Boots',
  'Guarda-chuva utilitário': 'Utility Umbrella', 'Booster Energy': 'Booster Energy',
  'escudo de habilidade': 'Ability Shield', 'amuleto claro': 'Clear Amulet',
  'Espelho de ervas': 'Mirror Herb', 'luva de boxe': 'Punching Glove',
  'Capa Secreta': 'Covert Cloak', 'Dados carregados': 'Loaded Dice',
  'placa da criação': 'Legend Plate', aerolito: 'Eternatus aerolite',
  'gene sombrio': 'Shadow Mewtwo gene', 'poder da lua cheia': 'Dawn Wings power',
  'poder do sol cheio': 'Dusk Mane power', 'Balanças do céu': 'Sky Plate',
  'Serpente de Ferro Âmbar': 'Amber iron snake',
  'Faixa de cabeça Wing King': 'Koraidon headband',
  'Gema azul': 'Blue Orb', 'Gema vermelho': 'Red Orb',
  'Medalha final': 'Ultra Necrozma medal', 'Gema sombria': 'Shadow Lugia gem',
  'Espada Enferrujada': 'Rusted Sword', 'Escudo Enferrujado': 'Rusted Shield',
  'Gene Berserk': 'Mewtwo gene', 'Asa Arco-Íris': 'Rainbow Wing',
  'Asa de Prata': 'Silver Wing', 'Bola de luz': 'Light Ball', Cube: 'Zygarde Cube',
  'Garrafa Prisão': 'Prison Bottle', 'Estrela Ninja de Água': 'Water shuriken charm',
  'dispositivo de tempo': 'Adamant Crystal', 'Ponta DNA': 'DNA Splicers',
  'relâmpago negro': 'Dark Stone', 'fogo branco': 'Light Stone',
  'Arma de gelo': 'Ice Reins', 'névoa negra e fogo de fósforo': 'Spectrier reins',
  'ramo da destruição': 'Destroying angel', 'Coroa do Sol Nascente': 'Sunne Crown',
  'olho do lua': 'Moonne Eye', 'lenço rosa': 'Dada scarf',
  'pérola esploxiva': 'Flame pearl', 'pérola de onda': 'Wave pearl',
  'pérola de Trovão': 'Thunder pearl', 'luz colorida': 'Life dew',
  'Pinça gigante vermelha': 'Scizor pincer', 'máscara de planta': 'Teal Mask',
  'máscara de poço': 'Wellspring Mask', 'máscara de fogo': 'Hearthflame Mask',
  'máscara de pedra': 'Cornerstone Mask', 'Prisma de ondas': 'Lucario prism',
  'Máscara Hada': 'Gardevoir mask',
  Materiais: 'Materials', 'Itens transportados': 'Key items',
  'Máquina Técnica': 'TM', pacote: 'Pack', Fragmento: 'Shard',
  Recuperação: 'Medicine', Título: 'Title', traje: 'Outfit',
  montaria: 'Mount', Cupões: 'Coupons', Equipamento: 'Held item',
  'Chamando a Pedra': 'Evolution stone',
  'Edifícios do Habitat': 'Habitat buildings',
  'Materiais do Habitat': 'Habitat materials',
  'Comida do Habitat': 'Habitat food', 'Sementes do Habitat': 'Habitat seeds',
  'medalha Cinza': 'Boulder Badge', 'medalha Azul': 'Cascade Badge',
  'medalha Laranja': 'Thunder Badge', 'medalha Arco-Íris': 'Rainbow Badge',
  'medalha de Asas': 'Zephyr Badge', 'medalha de Inseto': 'Hive Badge',
  'medalha Regular': 'Plain Badge', 'medalha de Fantasma': 'Fog Badge',
  'medalha de Golpe': 'Storm Badge', 'medalha de Aço': 'Mineral Badge',
  'medalha de Gelo': 'Glacier Badge', 'medalha de Dragão Ascendente': 'Rising Badge',
  'medalha de Rocha': 'Stone Badge', 'medalha de Boxe': 'Knuckle Badge',
  'medalha de Elétrica': 'Dynamo Badge', 'medalha de Chamas': 'Heat Badge',
  'medalha de Balança': 'Balance Badge', 'medalha de Pena Branca': 'Feather Badge',
  'medalha de Psíquico': 'Mind Badge', 'medalha de gota de chuva': 'Rain Badge',
  'Medalha do Carvão': 'Coal Badge', 'Medalha da Floresta': 'Forest Badge',
  'Medalha da Pavimentação': 'Cobble Badge', 'Medalha do Pântano': 'Fen Badge',
  'Medalha das Ruínas': 'Relic Badge', 'Medalha da Mina': 'Mine Badge',
  'Medalha da Geleira': 'Icicle Badge', 'Medalha do Farol': 'Beacon Badge',
};

const DESC = {
  'Bola para capturar Pokémon selvagens, no formato de cápsula.':
    'A Ball used to catch wild Pokémon.',
  'Uma bola que é mais fácil a capturar Pokémon do que a Pokébola, o desempenho é bastante bom.':
    'A Ball with a higher catch rate than a Poké Ball.',
  'Uma bola que é mais fácil a capturar Pokémon do que a Grande Bola, o desempenho é bastante bom.':
    'A Ball with a higher catch rate than a Great Ball.',
  'Uma bola que garante 100% de sucesso em captura Pokémon selvagem':
    'The best Ball. It never fails to catch a wild Pokémon.',
  'uma Pokébola especial usada na Zona do Safari em Kanto e no Grande Pântano em Sinnoh.':
    'A special Ball used in the Safari Zone in Kanto and the Great Marsh in Sinnoh.',
  'Uma bola especial, usada para capturar pokémons com o nível inferior (abaixo) do pokémon que você está usando.':
    'A Ball that works better on Pokémon at a lower level than yours.',
  'Uma bola especial, usada para melhorar a captura de pokémons do tipo água ou do tipo inseto.':
    'A Ball that works better on Water- or Bug-type Pokémon.',
  'Uma bola especial, se o nível do pokémon que está tentando capturar for baixo, aumentam as chances de captura.':
    'A Ball that works better on lower-level Pokémon.',
  'Uma bola especial, usada para capturar pokémons que você já tem registrado como capturado em sua Pokédex.':
    'A Ball that works better on Pokémon already registered as caught in your Pokédex.',
  'Uma bola especial, funciona melhor se usada para capturar o pokémon logo no início da batalha':
    'A Ball that works best if used at the start of a battle.',
  'Uma bola especial uasada no Parque Amigo (Pal Park)':
    'A special Ball used in Pal Park.',
  'so pode usar essa bola especial na atividades':
    'A special Ball that can only be used in events.',
  'Moeda comum, usada para comprar alguns itens raros':
    'A common coin used to buy some rare items.',
  'Moeda rara, usada na loja para comprar diversos itens raros':
    'A rare crystal used in the shop to buy various rare items.',
  'Utilizada para capturar os Pokémon na natureza':
    'Used to catch wild Pokémon.',
  'Experiência do jogador, usada para aumentar o nível':
    'Player experience, used to raise your level.',
};

const AINDA_PT = /[àáâãéêíóôõúç]|Pokébola|\bBola \b|\bPoção\b|\bMoeda\b|\bpara \b|\bquando \b|\bPode ser\b|\busada \b|\bitens\b|\bhabilidade\b|\bmovimento\b|\bPrecisão\b|\bPoder:\b|\bturnos\b|\bcapturar\b|\bselvagem\b|\bmedalha\b|\bFragmento\b|\bMáquina\b/i;

const NAME_PHRASES = [
  [/Pokébola Ultra Gigante de /gi, 'Gigantamax Ball — '],
  [/Fragmento de /gi, 'Shard of '],
  [/\bBola Mestra\b/gi, 'Master Ball'],
  [/\bGrande Bola\b/gi, 'Great Ball'],
  [/\bUltra Bola\b/gi, 'Ultra Ball'],
  [/\bPokébolas\b/gi, 'Poké Balls'],
  [/\bPokébola\b/gi, 'Poké Ball'],
  [/\bBola Safári\b/gi, 'Safari Ball'],
  [/\bBola Nível\b/gi, 'Level Ball'],
  [/\bBola Rede\b/gi, 'Net Ball'],
  [/\bBola Ninho\b/gi, 'Nest Ball'],
  [/\bBola Repetição\b/gi, 'Repeat Ball'],
  [/\bBola Rápida\b/gi, 'Quick Ball'],
  [/\bBola Parque\b/gi, 'Park Ball'],
  [/\bSuperPoção\b/gi, 'Super Potion'],
  [/\bHiperPoção\b/gi, 'Hyper Potion'],
  [/\bPoção Máxima\b/gi, 'Max Potion'],
  [/\bPoção\b/gi, 'Potion'],
  [/\bReanimador Máximo\b/gi, 'Max Revive'],
  [/\bReanimador\b/gi, 'Revive'],
  [/\bPedra do Trovão\b/gi, 'Thunder Stone'],
  [/\bPedra da Lua\b/gi, 'Moon Stone'],
  [/\bPedra do Fogo\b/gi, 'Fire Stone'],
  [/\bPedra da Água\b/gi, 'Water Stone'],
  [/\bPedra da Folha\b/gi, 'Leaf Stone'],
  [/\bPedra do Trovão\b/gi, 'Thunder Stone'],
  [/\bPedra do Sol\b/gi, 'Sun Stone'],
  [/\bPedra do Alvorecer\b/gi, 'Dawn Stone'],
  [/\bPedra do Anoitecer\b/gi, 'Dusk Stone'],
  [/\bPedra Brilhante\b/gi, 'Shiny Stone'],
  [/\bPedra da Gelo\b/gi, 'Ice Stone'],
  [/\[Fragmento\]/gi, ' Shard'],
  [/\[MT\]/gi, ' [TM]'],
  [/\bMáquina de Aprendizagem\b/gi, 'TM'],
  [/\bExperiência\b/gi, 'Experience'],
  [/\bPontos\b/gi, 'Points'],
  [/\bMoedas\b/gi, 'Coins'],
  [/\bMoeda\b/gi, 'Coin'],
  [/\bmedalha\b/gi, 'Badge'],
  [/\bMedalha\b/gi, 'Badge'],
  [/\bFragmento\b/gi, 'Shard'],
];

const DESC_PHRASES = [
  [/Para aprender movimento de habilidade:\s*/gi, 'Teaches the move: '],
  [/Pode ser usado para aprender truques de habilidade:\s*/gi, 'Teaches the move: '],
  [/A medicina do tipo de pulverização para o tratamento de feridas\./gi, 'A spray-type medicine for treating wounds.'],
  [/A medicina do tipo de pulverização\./gi, 'A spray-type medicine.'],
  [/Pode ser utilizado para restaurar (\d+) HP para um Pokémon\.?/gi, 'Restores $1 HP to a Pokémon.'],
  [/Pode restaurar completamente o HP máximo de um Pokémon\./gi, 'Fully restores a Pokémon’s HP.'],
  [/e curar todas as anomalias\./gi, 'Also heals every status condition.'],
  [/Pode tirar os efeitos de envenenamento de um Pokémon\./gi, 'Cures a poisoned Pokémon.'],
  [/Pode curar um Pokémon que sofrendo de uma queimadura\./gi, 'Heals a burned Pokémon.'],
  [/Pode descongelar um Pokémon que foi congelado\./gi, 'Defrosts a frozen Pokémon.'],
  [/Pode despertar um Pokémon do sono\./gi, 'Wakes a sleeping Pokémon.'],
  [/Pode libertar um Pokémon que foi paralisado\./gi, 'Heals a paralyzed Pokémon.'],
  [/Cura qualquer um dos problemas de estado (dos pokémons|de um pokémon)\./gi, 'Cures any status condition.'],
  [/Restaura (\d+) HP de um Pokémon\.?/gi, 'Restores $1 HP to a Pokémon.'],
  [/Recupera (\d+) HP de um Pokémon/gi, 'Restores $1 HP to a Pokémon.'],
  [/Uma bola especial, /gi, 'A special Ball. '],
  [/usada para capturar/gi, 'used to catch'],
  [/usada para melhorar a captura/gi, 'used to improve the catch rate'],
  [/usada para comprar/gi, 'used to buy'],
  [/usada na loja para comprar diversos itens raros/gi, 'used in the shop to buy various rare items'],
  [/pode ser usado para/gi, 'can be used to'],
  [/Pode ser trocado/gi, 'Can be traded'],
  [/Pode ser usado/gi, 'Can be used'],
  [/Obtido ao /gi, 'Obtained by '],
  [/Obtido através /gi, 'Obtained through '],
  [/Obtido em /gi, 'Obtained from '],
  [/Recebido ao /gi, 'Received when '],
  [/Ganhado na /gi, 'Earned from the '],
  [/permite comprar itens raros/gi, 'lets you buy rare items'],
  [/para comprar itens raros/gi, 'to buy rare items'],
  [/na loja/gi, 'in the shop'],
  [/Pokémon selvagens/gi, 'wild Pokémon'],
  [/pokémons/gi, 'Pokémon'],
  [/Pokébolas/gi, 'Poké Balls'],
  [/Pokébola/gi, 'Poké Ball'],
  [/Grande Bola/gi, 'Great Ball'],
  [/Ultra Bola/gi, 'Ultra Ball'],
  [/Bola Mestra/gi, 'Master Ball'],
  [/\bPrecisão:\s*/gi, 'Accuracy: '],
  [/\bPoder:\s*/gi, 'Power: '],
  [/Pokémon recomendados:/gi, 'Recommended Pokémon:'],
  [/\bhabilidade\b/gi, 'Ability'],
  [/\bmovimento\b/gi, 'move'],
  [/\bturnos\b/gi, 'turns'],
  [/\bnível\b/gi, 'level'],
  [/\bdefesa\b/gi, 'Defense'],
  [/\bataque especial\b/gi, 'Sp. Atk'],
  [/\bdefesa especial\b/gi, 'Sp. Def'],
  [/\bvelocidade\b/gi, 'Speed'],
  [/\bprecisão\b/gi, 'accuracy'],
  [/\besquiva\b/gi, 'evasion'],
  [/\bataque\b/gi, 'Attack'],
  [/\benvenenamento\b/gi, 'poison'],
  [/\bqueimadura\b/gi, 'burn'],
  [/\bparalis/gi, 'paralysis'],
  [/\bcongel/gi, 'freeze'],
  [/\bcampo\b/gi, 'field'],
  [/\bquando equipado\b/gi, 'when held'],
  [/\bquando um Pokémon\b/gi, 'when a Pokémon'],
  [/\baumenta o poder\b/gi, 'raises the power'],
  [/\baumenta\b/gi, 'raises'],
  [/\bdiminui\b/gi, 'lowers'],
  [/\bcapturar\b/gi, 'catch'],
  [/\bselvagem\b/gi, 'wild'],
  [/\bitens\b/gi, 'items'],
  [/\bloja\b/gi, 'shop'],
  [/\bmoeda\b/gi, 'coin'],
  [/\bmoedas\b/gi, 'coins'],
  [/\bfragmentos\b/gi, 'shards'],
  [/\bfragmento\b/gi, 'shard'],
  [/\bexperiência\b/gi, 'experience'],
  [/\bpontos\b/gi, 'points'],
  [/\bmedalha\b/gi, 'badge'],
  [/\brecompensa/gi, 'reward'],
  [/\bcomunidade\b/gi, 'community'],
  [/\batividade\b/gi, 'activity'],
  [/\bdesafio\b/gi, 'challenge'],
  [/\bduelos\b/gi, 'duels'],
  [/\bpassar\b/gi, 'pass'],
  [/\bguilda\b/gi, 'guild'],
  [/\baresna\b/gi, 'arena'],
  [/\baren[ae]\b/gi, 'arena'],
];

function tidy(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\s([,.!?:;])/g, '$1')
    .replace(/^\w/, c => c.toUpperCase ? c : c)
    .trim();
}

function translateName(s) {
  if (s == null) return s;
  const raw = String(s);
  if (NAMES[raw]) return NAMES[raw];
  const tm = raw.match(/^(.+?)\s*\[MT\]$/i);
  if (tm) {
    const move = MOVE_PT[tm[1].trim()] || translateName(tm[1].trim());
    return move + ' [TM]';
  }
  const frag = raw.match(/^(.+?)\s*\[Fragmento\]$/i);
  if (frag) {
    const move = MOVE_PT[frag[1].trim()] || translateName(frag[1].trim());
    return move + ' Shard';
  }
  if (ui[raw] && !AINDA_PT.test(ui[raw])) return ui[raw];
  let out = raw;
  for (const [re, to] of NAME_PHRASES) out = out.replace(re, to);
  return tidy(out);
}

function translateDesc(s) {
  if (s == null) return s;
  const raw = String(s);
  if (DESC[raw]) return DESC[raw];
  if (ui[raw] && !AINDA_PT.test(ui[raw])) return ui[raw];
  let out = raw;
  const tm = out.match(/\[([^\]]+)\]/);
  if (tm && MOVE_PT[tm[1]]) out = out.replace(tm[0], '[' + MOVE_PT[tm[1]] + ']');
  for (const [re, to] of DESC_PHRASES) out = out.replace(re, to);
  return tidy(out);
}

function setUi(oldV, newV) {
  if (!oldV || typeof oldV !== 'string' || oldV === newV) return;
  ui[oldV] = newV;
}

let names = 0, descs = 0, labels = 0;

for (const [k, v] of Object.entries(dados.tipos || {})) {
  const n = translateName(v);
  if (n !== v) { setUi(v, n); dados.tipos[k] = n; labels++; }
}
for (const [k, v] of Object.entries(dados.moedas || {})) {
  const n = translateName(v);
  if (n !== v) { setUi(v, n); dados.moedas[k] = n; labels++; }
}
for (const b of dados.insignias || []) {
  if (!b?.n) continue;
  const n = translateName(b.n);
  if (n !== b.n) { setUi(b.n, n); b.n = n; labels++; }
}
for (const it of Object.values(dados.itens || {})) {
  if (it?.n) {
    const n = translateName(it.n);
    if (n !== it.n) { setUi(it.n, n); it.n = n; names++; }
  }
  if (it?.d) {
    const n = translateDesc(it.d);
    if (n !== it.d) { setUi(it.d, n); it.d = n; descs++; }
  }
}
for (const m of dados.missoes || []) {
  if (m?.nome) { const n = ui[m.nome] && !AINDA_PT.test(ui[m.nome]) ? ui[m.nome] : translateName(m.nome); if (n !== m.nome) { setUi(m.nome, n); m.nome = n; labels++; } }
  if (m?.des) { const n = ui[m.des] && !AINDA_PT.test(ui[m.des]) ? ui[m.des] : translateDesc(m.des); if (n !== m.des) { setUi(m.des, n); m.des = n; labels++; } }
}
for (const p of dados.passos || []) {
  if (p?.nome) { const n = ui[p.nome] && !AINDA_PT.test(ui[p.nome]) ? ui[p.nome] : translateName(p.nome); if (n !== p.nome) { setUi(p.nome, n); p.nome = n; labels++; } }
  if (p?.des) { const n = ui[p.des] && !AINDA_PT.test(ui[p.des]) ? ui[p.des] : translateDesc(p.des); if (n !== p.des) { setUi(p.des, n); p.des = n; labels++; } }
}

fs.writeFileSync(dataPath, JSON.stringify(dados));
fs.writeFileSync(uiPath, JSON.stringify(ui, null, 2) + '\n');

let leftNames = 0, leftDescs = 0;
const sample = [];
for (const it of Object.values(dados.itens || {})) {
  if (it.n && AINDA_PT.test(it.n)) { leftNames++; if (sample.length < 12) sample.push('N ' + it.n); }
  if (it.d && AINDA_PT.test(it.d)) { leftDescs++; if (sample.length < 20) sample.push('D ' + String(it.d).slice(0, 90)); }
}
console.log({ names, descs, labels, leftNames, leftDescs });
for (const s of sample) console.log(s);
