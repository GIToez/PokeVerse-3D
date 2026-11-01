/* Second pass: leftover Portuguese item names after english_items.mjs. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(RAIZ, 'public/data/menu_data.json');
const uiPath = path.join(RAIZ, 'public/data/locale/ui_en.json');
const dados = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const ui = JSON.parse(fs.readFileSync(uiPath, 'utf8'));

const MOVE = {
  'Lágrimas de Crocodilo': 'Fake Tears', 'Ataque de Lama': 'Mud-Slap', Proteção: 'Protect',
  'Presa Trovão': 'Thunder Fang', 'Vibração de Água': 'Water Pulse', 'Spray Ácido': 'Acid Spray',
  'Raio de Confusão': 'Confuse Ray', 'Água Gelada': 'Chilling Water', 'Carga de Raio': 'Charge Beam',
  'Giro de Fogo': 'Fire Spin', Feitiçaria: 'Hex', 'Garra de Metal': 'Metal Claw',
  'Folha Mágica': 'Magical Leaf', 'Rajada de Lama': 'Mud Shot', 'Enterrada de Pedras': 'Rock Tomb',
  'Carga de Chamas': 'Flame Charge', 'Lâmina de Ar': 'Air Cutter', 'Cauda do Dragão': 'Dragon Tail',
  'Troca de Raio': 'U-turn', 'Dia de Sol': 'Sunny Day', 'Dança da Chuva': 'Rain Dance',
  'Tempestade de Areia': 'Sandstorm', 'Choque Psíquico': 'Psyshock', 'Rajada de Sementes': 'Bullet Seed',
  'Cabeçada Zen': 'Zen Headbutt', 'Garra das Sombras': 'Shadow Claw', 'presa Psíquica': 'Psychic Fangs',
  'Aumento de Massa': 'Bulk Up', 'Jogo de Corpo': 'Body Press', 'Soco de Trovão': 'Thunder Punch',
  'Bomba de Semente': 'Seed Bomb', 'Explosão de Rochas': 'Rock Blast', 'Garra do Dragão': 'Dragon Claw',
  'Clarão Deslumbrant': 'Dazzling Gleam', 'Onda de Trovão': 'Thunder Wave', 'Enjeção Venenosa': 'Poison Jab',
  'Pisoteada de Birra': 'Stomping Tantrum', 'Deslizamento de Rochas': 'Rock Slide', Irritação: 'Taunt',
  'Dança de Espadas': 'Swords Dance', 'Apertão Corporal': 'Body Slam', Imprisão: 'Imprison',
  'Canhão de Luz': 'Flash Cannon', 'Vibração Sombria': 'Dark Pulse', 'Dreno de Energia': 'Giga Drain',
  'Troca de Habilidades': 'Skill Swap', 'Cabeça de Ferro': 'Iron Head', 'Dança do Dragão': 'Dragon Dance',
  'Poder da Jóia': 'Power Gem', Substituição: 'Substitute', 'Defesa de Ferro': 'Iron Defense',
  'Corrida de Broca': 'Drill Run', Aquaríete: 'Aqua Jet', 'Esfera de Aura': 'Aura Sphere',
  'Cauda de Vento': 'Tailwind', 'Bola das Sombras': 'Shadow Ball', 'Vibração do Dragã': 'Dragon Pulse',
  'Vibração do Dragão': 'Dragon Pulse', 'Pedra Oculta': 'Stealth Rock', 'Onde de Calor': 'Heat Wave',
  'Esfera de Energia': 'Energy Ball', Repetição: 'Encore', 'Girador de Gelo': 'Ice Spinner',
  'Lança Chamas': 'Flamethrower', 'Mão Amiga': 'Helping Hand', 'Bola de Pólen': 'Pollen Puff',
  'Passar o Bastão': 'Baton Pass', 'Força da Terra': 'Earth Power', 'Campo de Plantas': 'Grassy Terrain',
  'campo Psíquico': 'Psychic Terrain', 'Ação Desagradável': 'Nasty Plot',
  'Promessa de Fogo': 'Fire Pledge', 'Promessa de Água': 'Water Pledge', 'Rajada Tóxica': 'Sludge Wave',
  'Explosão Incineradora': 'Blast Burn', 'Hidro Canhão': 'Hydro Cannon', 'Ataque de Raiva': 'Outrage',
  'Explosão Focalizada': 'Focus Blast', 'Tempestade de Folhas': 'Leaf Storm', Furacão: 'Hurricane',
  'Truque de Agilidade': 'Agility', 'Zumbido de Inseto': 'Bug Buzz', 'Fúria dos Pássaros': 'Brave Bird',
  'Bombardeio de Chamas': 'Flare Blitz', 'Meteoro do Dragão': 'Draco Meteor', 'Feixe de Aço': 'Steel Beam',
  'Explosão Tera': 'Tera Blast', Rugído: 'Roar', 'Dia do Pagamento': 'Pay Day',
  'Lâmina Solar': 'Solar Blade', 'Poder Cósmico': 'Cosmic Power', Infestação: 'Infestation',
  'Super Sônico': 'Supersonic', 'Cauda de Ferro': 'Iron Tail', Atração: 'Attract',
  'Asa de Aço': 'Steel Wing', Frustração: 'Frustration', Respiração: 'Roost',
  'Enterrada de Areia': 'Sand Tomb', 'Esfera Climática': 'Weather Ball', 'Troca de Defesas': 'Guard Swap',
  'truque da Maravilha': 'Wonder Room', 'Truque da Magia': 'Magic Room', 'Corte Psíquico': 'Psycho Cut',
  'Balanço Violento': 'Brutal Swing', Intimidação: 'Scary Face', 'Troca de Poder': 'Power Swap',
  'Fogo Místico': 'Mystical Fire', 'Lança de Gelo': 'Ice Beam', 'Troca de Velocidade': 'Speed Swap',
  'Lâmina de Concha': 'Razor Shell', Retaliação: 'Retaliate', 'cruz de Veneno': 'Cross Poison',
  'Cruz de Veneno': 'Cross Poison', 'Tapa de Cauda': 'Tail Slap', 'Polidor de Rocha': 'Rock Polish',
  'Comedor de Sonhos': 'Dream Eater', 'Esmagamento de Rocha': 'Stone Edge', 'Carga Psíquica': 'Psyshock',
  'Troca de Aliado': 'Ally Switch', 'Lâmina de Folha': 'Leaf Blade', 'Chicote do Poder': 'Power Whip',
  'Colisão de Chamas': 'Heat Crash', Força: 'Strength', 'Mar de Lama': 'Muddy Water',
  Confidência: 'Confide', 'Poder da Natureza': 'Nature Power', 'Golpe Enfeitiçado': 'Spirit Break',
  'Potência Equina': 'High Horsepower', 'Visão Futura': 'Future Sight',
  'Ciúmes Ardente': 'Burning Jealousy', 'Confusão da Noite': 'Night Daze',
  'Abismo das Sombras': 'Phantom Force', 'Sanções de destruição': 'Punishment', Esforço: 'Endeavor',
  'Som de Metal': 'Metal Sound', maldição: 'Curse', 'Força Vasta': 'Expanding Force',
  'Explosão de Névoa': 'Misty Explosion', 'Dupla Batida de Asa': 'Dual Wingbeat',
  'Ruído Psíquico': 'Psychic Noise', 'Mão Superior': 'Upper Hand', 'Pressão Massiva': 'Heavy Slam',
  'Raio Meteórico': 'Meteor Beam', 'torcida Dracônica': 'Dragon Cheer',
  'Explosão de Temperamento': 'Temper Flare', 'Onda de Vácuo': 'Vacuum Wave',
  'Virar rápido': 'Flip Turn', 'Nevasca de Pétalas': 'Petal Blizzard', 'Dança da Pena': 'Feather Dance',
  'Canção da Ruína': 'Perish Song', 'Vinculo do Destino': 'Destiny Bond', Espóro: 'Spore',
  'Esmagamento de Concha': 'Shell Smash', Cobiçar: 'Covet', 'Troca de Tema': 'Conversion',
  "Cauda d'Água": 'Aqua Tail', 'Fogo da Terra': 'Scorching Sands',
  'Explosão Metálica': 'Steel Beam', 'Cabeça grande chocante': 'Headlong Rush',
  punir: 'Punishment', arrogante: 'Swagger', 'fogo da turquesa': 'Torch Song',
  'veredicto final': 'Judgment', 'Desejo Curativo': 'Heal Pulse',
  'Enxame Cristalino': 'Power Gem', Apertar: 'Bind',
  'Ataque interdimensional': 'Hyperspace Fury', 'Controlo da terra': 'Earth Power',
  'Vapor Místico': 'Steam Eruption', 'Sentença da Dimensão Mental': 'Psycho Boost',
  'Alta Velocidade': 'Extreme Speed', 'Luz da Ruína': 'Light of Ruin',
  'Luz da Aniquilação': 'Doom Desire', 'Bloqueio de Cura': 'Heal Block',
  'Rugido Ártico': 'Ice Beam',
};

const EXTRA = {
  'coração de sangrenta': 'Bloody Heart',
  'Anel Mágico das Sombras': 'Shadow Magic Ring',
  'Amuleto da Tempestade': 'Storm Amulet',
  'Coroa Cristalina das Cores': 'Prism Crown',
  'Prisma da Convergência': 'Convergence Prism',
  'núcleo solar intenso': 'Blazing Solar Core',
  'Núcleo Secreto da Oração Estrela': 'Star Prayer Core',
  'Autoridade Ártica': 'Arctic Authority',
  'Cristal Sagrado da Escala do Dragon': 'Sacred Dragon-Scale Crystal',
  'Stone Secreta do Dragon Flamejante': 'Secret Flame Dragon Stone',
  'Orbe da Rocha Dark': 'Dark Rock Orb',
  'Asas de Dragon Celestial': 'Celestial Dragon Wings',
  'Fruto de Granadas': 'Pomeg Berry',
  'Fruto de Algas': 'Kelpsy Berry',
  'Fruto de Biba': 'Qualot Berry',
  'Fruto de Melão': 'Hondew Berry',
  'Fruto de Uva': 'Grepa Berry',
  'Fruto de Tomate': 'Tamato Berry',
  'Asa da Vitalidade': 'Health Wing',
  'Asa da Força': 'Muscle Wing',
  'Asa da Resistência': 'Resist Wing',
  'Asa da Inteligência': 'Genius Wing',
  'Asa da Espiritualidade': 'Clever Wing',
  'Asa da Rapidez': 'Swift Wing',
  'Reforço de PV': 'HP Up',
  'Stone do Anoitecer': 'Dusk Stone',
  'Stone do Ice': 'Ice Stone',
  'Stone do Brilho': 'Shiny Stone',
  'Stone do Sol': 'Sun Stone',
  'Stone do Amanhecer': 'Dawn Stone',
  'Maçã doce': 'Sweet Apple',
  'Maçã Ácida': 'Tart Apple',
  'Cartão de Ativação de Bicicleta Vermelha': 'Red Bicycle voucher',
  'Cartão de Ativação de Bicicleta Verde': 'Green Bicycle voucher',
  'Fragment de Formiga de Ferro': 'Durant Shard',
  'Faixa de Escolha Shard': 'Choice Band Shard',
  'Gema do Mal Shard': 'Dark Gem Shard',
};

function suffix(s) {
  const tm = s.match(/^(.*?)\s*\[TM\]$/i);
  if (tm && MOVE[tm[1].trim()]) return MOVE[tm[1].trim()] + ' [TM]';
  const sh = s.match(/^(.*?)\s+Shard$/);
  if (sh && MOVE[sh[1].trim()]) return MOVE[sh[1].trim()] + ' Shard';
  return null;
}

function translate(s) {
  if (!s) return s;
  if (EXTRA[s]) return EXTRA[s];
  const suf = suffix(s);
  if (suf) return suf;
  let out = s
    .replace(/^Fragment de /g, '')
    .replace(/^Shard of /g, '');
  if (out !== s && !/Shard$/.test(out)) out = out.replace(/ de Alola$/, ' (Alola)') + ' Shard';
  out = out
    .replace(/^【([^】]+)】Máquina de Aprendizado$/i, (_, m) => (MOVE[m] || m) + ' [TM]')
    .replace(/^\{([^}]+)\}\s*máquina de estudar$/i, (_, m) => (MOVE[m.trim()] || m.trim()) + ' [TM]')
    .replace(/^<([^>]+)>\s*máquina de estudar$/i, (_, m) => (MOVE[m.trim()] || m.trim()) + ' [TM]')
    .replace(/^Máquinas Técnicas \[([^\]]+)\]$/i, (_, m) => (MOVE[m] || m) + ' [TM]')
    .replace(/^Máquina Técnica \[([^\]]+)\]$/i, (_, m) => (MOVE[m] || m) + ' [TM]')
    .replace(/^\[([^\]]+)\] (peça|TM)$/i, (_, m) => (MOVE[m] || m) + ' [TM]')
    .replace(/^TM de (.+)$/i, (_, m) => (MOVE[m] || m) + ' [TM]')
    .replace(/^Fragment de Teracristal(?: (.+))?$/i, (_, t) => (t ? t + ' Tera Shard' : 'Tera Shard'))
    .replace(/^Shard of Teracristal(?: (.+))?$/i, (_, t) => (t ? t + ' Tera Shard' : 'Tera Shard'))
    .replace(/superpoder/gi, 'Psychic')
    .replace(/\bÁgua\b/g, 'Water')
    .replace(/\bVenenoso\b/g, 'Poison')
    .replace(/\bStone\b/g, 'Rock');
  if (out === 'Rock' && /Teracristal Stone|Fragment de Teracristal Stone/.test(s)) out = 'Rock Tera Shard';
  return out;
}

let n = 0;
for (const it of Object.values(dados.itens || {})) {
  if (!it?.n) continue;
  const next = translate(it.n);
  if (next !== it.n) { ui[it.n] = next; it.n = next; n++; }
}
fs.writeFileSync(dataPath, JSON.stringify(dados));
fs.writeFileSync(uiPath, JSON.stringify(ui, null, 2) + '\n');
console.log('renamed', n);
