/* Official English for Pokémart stock, evolution items, and leftover held text.
   Also undoes the Stone→Rock rename that broke Thunder Stone / Leaf Stone / etc. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(RAIZ, 'public/data/menu_data.json');
const uiEnPath = path.join(RAIZ, 'public/data/locale/ui_en.json');
const uiPtPath = path.join(RAIZ, 'public/data/locale/ui_pt.json');
const dados = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const uiEn = JSON.parse(fs.readFileSync(uiEnPath, 'utf8'));
const uiPt = JSON.parse(fs.readFileSync(uiPtPath, 'utf8'));

const NAMES = {
  20011: 'Hard Stone',
  20077: 'Float Stone',
  20155: 'Dark Stone',
  20156: 'Light Stone',
  20184: 'Dark Stone Orb',
  50119: 'Rock Tera Shard',
  50241: 'Mega Stone Shard',
  50242: 'Venusaurite',
  50304: 'Thunder Stone',
  50306: 'Water Stone',
  50307: 'Leaf Stone',
  50308: 'Moon Stone',
  50309: 'Fire Stone',
  50311: 'Auspicious Armor',
  50312: 'Malicious Armor',
  50315: 'Cracked Pot',
  50318: 'Black Augurite',
  50321: 'Metal Alloy',
};

const KEEP_ROCK = /^(King's Rock|Icy Rock|Smooth Rock|Heat Rock|Damp Rock|Rocky Helmet|Rock Incense|Rock Gem|Rock Tomb|Rock Blast|Rock Slide|Stealth Rock|Rock Polish|Cornerstone Mask)$/;

const DESC = {
  1001: 'A Ball used to catch a wild Pokémon.',
  1002: 'A Ball with a higher catch rate than a Poké Ball.',
  1003: 'A Ball with a high catch rate.',
  1004: 'The best Ball. It never fails to catch a wild Pokémon.',
  2001: 'A spray-type medicine for treating wounds. Restores 50 HP to a Pokémon.',
  2002: 'A spray-type medicine for treating wounds. Restores 150 HP to a Pokémon.',
  2003: 'A spray-type medicine for treating wounds. Restores 300 HP to a Pokémon.',
  2004: 'A spray-type medicine for treating wounds. Fully restores a Pokémon’s HP.',
  2006: 'A spray-type medicine. Cures a poisoned Pokémon.',
  2007: 'A spray-type medicine. Heals a burned Pokémon.',
  2008: 'A spray-type medicine. Defrosts a frozen Pokémon.',
  2009: 'A spray-type medicine. Wakes a sleeping Pokémon.',
  2010: 'A spray-type medicine. Heals a paralyzed Pokémon.',
  2011: 'A spray-type medicine. Heals all status conditions of one Pokémon.',
  2012: 'Revives a fainted Pokémon and restores half of its max HP.',
  2013: 'Revives a fainted Pokémon and fully restores its HP.',
  20001: 'An item to be held by a Pokémon. Lowers the accuracy of moves used against the holder.',
  20002: 'An item to be held by a Pokémon. Occasionally allows the holder to move first.',
  20003: 'An item to be held by a Pokémon. When the holder hits, the target may flinch.',
  20005: 'An item to be held by a Pokémon. The holder may survive an attack that would faint it, with 1 HP.',
  20007: 'An item to be held by a Pokémon. Raises the holder’s critical-hit ratio.',
  20008: 'An item to be held by a Pokémon. Boosts the power of Steel-type moves.',
  20009: 'An item to be held by a Pokémon. The holder recovers a little HP every turn.',
  20011: 'An item to be held by a Pokémon. Boosts the power of Rock-type moves.',
  20015: 'An item to be held by a Pokémon. Boosts the power of Electric-type moves.',
  20016: 'An item to be held by a Pokémon. Boosts the power of Water-type moves.',
  20023: 'An item to be held by a Pokémon. Boosts the power of Dragon-type moves.',
  20027: 'An item to be held by Chansey. Sharply raises its critical-hit ratio.',
  20028: 'An item to be held by Cubone or Marowak. Raises Attack.',
  20029: 'An item to be held by Farfetch’d or Sirfetch’d. Sharply raises its critical-hit ratio.',
  20030: 'An item to be held by a Pokémon. Restores any lowered stat at once.',
  20032: 'An item to be held by a Pokémon. The holder can use a charging move in one turn.',
  20033: 'An item to be held by a Pokémon. Raises Attack, but only the first move chosen can be used.',
  20034: 'An item to be held by a Pokémon. Raises Sp. Atk, but only the first move chosen can be used.',
  20035: 'An item to be held by a Pokémon. Raises Speed, but only the first move chosen can be used.',
  20036: 'An item to be held by Latias or Latios. Boosts Psychic- and Dragon-type moves.',
  20039: 'An item to be held by a Pokémon. The holder recovers some HP when it deals damage.',
  20040: 'An item to be held by a Pokémon. Boosts the power of Water-type moves.',
  20043: 'An item to be held by a Pokémon. Boosts the power of Rock-type moves.',
  20044: 'An item to be held by a Pokémon. The holder always moves last among moves with the same priority.',
  20045: 'An item to be held by a Pokémon. Boosts the power of Water-type moves.',
  20049: 'An item to be held by Dialga. Boosts Steel- and Dragon-type moves.',
  20050: 'An item to be held by Palkia. Boosts Water- and Dragon-type moves.',
  20051: 'An item to be held by Giratina. Boosts Ghost- and Dragon-type moves.',
  20052: 'An item to be held by a Pokémon. Raises the critical-hit ratio. Evolves Sneasel into Weavile at night.',
  20053: 'An item to be held by a Pokémon. When the holder hits, the target may flinch.',
  20054: 'An item to be held by a Pokémon. Slightly raises the accuracy of moves.',
  20055: 'An item to be held by a Pokémon. Boosts the power of physical moves.',
  20057: 'An item to be held by a Pokémon. Boosts the power of super-effective moves.',
  20058: 'An item to be held by a Pokémon. Extends Light Screen, Reflect, and Aurora Veil.',
  20059: 'An item to be held by a Pokémon. Boosts move power, but the holder loses some HP after attacking.',
  20060: 'An item to be held by a Pokémon. Badly poisons the holder at the end of a turn.',
  20061: 'An item to be held by a Pokémon. Burns the holder at the end of a turn.',
  20062: 'An item to be held by a Pokémon. If the holder has full HP, it may survive a KO with 1 HP. Used once.',
  20063: 'An item to be held by a Pokémon. Raises accuracy if the holder moves after the target.',
  20064: 'An item to be held by a Pokémon. Boosts a move used consecutively.',
  20065: 'An item to be held by a Pokémon. Lowers Speed and grounds the holder.',
  20066: 'An item to be held by a Pokémon. The holder always moves last among moves with the same priority.',
  20067: 'An item to be held by a Pokémon. Poison-types recover HP each turn; others lose HP.',
  20068: 'An item to be held by a Pokémon. Extends hail or snow.',
  20069: 'An item to be held by a Pokémon. Extends sandstorm.',
  20070: 'An item to be held by a Pokémon. Extends harsh sunlight.',
  20071: 'An item to be held by a Pokémon. Extends rain.',
  20072: 'An item to be held by a Pokémon. Binding moves always last 7 turns.',
  20073: 'An item to be held by a Pokémon. The holder loses HP each turn.',
  20074: 'An item to be held by a Pokémon. Lets the holder switch out even if trapped.',
  20075: 'An item to be held by a Pokémon. Boosts HP recovered by draining moves.',
  20077: 'An item to be held by a Pokémon. Halves the holder’s weight.',
  20078: 'An item to be held by a Pokémon. Damages attackers that make direct contact.',
  20080: 'An item to be held by a Pokémon. When hit, the attacker is forced to switch out.',
  20081: 'An item to be held by a Pokémon. Negates type immunities against the holder.',
  20082: 'An item to be held by a Pokémon. Binding moves deal more damage each turn.',
  20083: 'An item to be held by a Pokémon. Raises Sp. Atk if hit by a Water-type move.',
  20084: 'An item to be held by a Pokémon. Raises Attack if hit by an Electric-type move.',
  20085: 'An item to be held by a Pokémon. The holder switches out after taking damage.',
  20097: 'A gem that boosts a Rock-type move once.',
  20104: 'An item to be held by a Pokémon. Sharply raises Attack and Sp. Atk when hit by a super-effective move.',
  20106: 'An item to be held by a Pokémon. Raises Sp. Def, but only damaging moves can be used.',
  20107: 'An item to be held by a Pokémon. Raises Sp. Def if hit by a Water-type move.',
  20109: 'An item to be held by a Pokémon. Protects from weather damage and powder moves.',
  20111: 'An item to be held by a Pokémon. Extends terrains.',
  20112: 'An item to be held by a Pokémon. Protects the holder from contact effects.',
  20113: 'An item to be held by a Pokémon. Raises Defense on Electric Terrain.',
  20114: 'An item to be held by a Pokémon. Raises Sp. Def on Psychic Terrain.',
  20115: 'An item to be held by a Pokémon. Raises Sp. Def on Misty Terrain.',
  20116: 'An item to be held by a Pokémon. Raises Defense on Grassy Terrain.',
  20120: 'An item to be held by a Pokémon. Raises Sp. Atk after a sound-based move.',
  20121: 'An item to be held by a Pokémon. The holder switches out if a stat is lowered.',
  20122: 'An item to be held by a Pokémon. Protects from entry hazards.',
  20124: 'An item to be held by a Pokémon. Protects from sun and rain effects.',
  50301: 'A peculiar stone that makes certain species of Pokémon evolve. It is as dark as the night sky. Evolves Murkrow and Misdreavus.',
  50302: 'A peculiar stone that makes certain species of Pokémon evolve. It has an unmistakable snowflake pattern. Evolves Eevee into Glaceon.',
  50303: 'A peculiar stone that makes certain species of Pokémon evolve. It shines with a dazzling light. Evolves Togetic and Roselia.',
  50304: 'A peculiar stone that makes certain species of Pokémon evolve. It sparks with electricity. Evolves Pikachu, Eevee, Eelektrik, and Nosepass.',
  50305: 'A peculiar stone that makes certain species of Pokémon evolve. It burns as red as the evening sun. Evolves Gloom and Sunkern.',
  50306: 'A peculiar stone that makes certain species of Pokémon evolve. It is a clear, light blue. Evolves Poliwhirl, Shellder, Staryu, Eevee, and Lombre.',
  50307: 'A peculiar stone that makes certain species of Pokémon evolve. It has an unmistakable leaf pattern. Evolves Gloom, Weepinbell, Exeggcute, and Nuzleaf.',
  50308: 'A peculiar stone that makes certain species of Pokémon evolve. It is as black as the night sky. Evolves Nidorina, Nidorino, Clefairy, and Jigglypuff.',
  50309: 'A peculiar stone that makes certain species of Pokémon evolve. It glows orange. Evolves Vulpix, Growlithe, and Eevee.',
  50310: 'A peculiar stone that makes certain species of Pokémon evolve. It sparkles like a glittering eye. Evolves Kirlia into Gallade and Snorunt into Froslass.',
  50311: 'A peculiar set of armor filled with congratulatory feelings. Evolves Charcadet into Armarouge.',
  50312: 'A peculiar set of armor filled with grudgy feelings. Evolves Charcadet into Ceruledge.',
  50313: 'A peculiar apple that makes Applin evolve into Appletun.',
  50314: 'A peculiar apple that makes Applin evolve into Flapple.',
  50315: 'A peculiar pot that makes a phony Sinistea evolve into Polteageist.',
  50317: 'A mysterious cable that makes certain Pokémon evolve. Evolves Kadabra, Machoke, Graveler, and Haunter.',
  50318: 'A sharp black stone that makes Scyther evolve into Kleavor.',
  50319: 'A block of peat that makes Ursaring evolve into Ursaluna during a full moon.',
  50321: 'A peculiar hunk of metal that makes Duraludon evolve into Archaludon.',
};

function fixStoneName(n) {
  if (!n || KEEP_ROCK.test(n.replace(/\s+Shard$/i, ''))) return n;
  return n
    .replace(/\bThunder Rock\b/g, 'Thunder Stone')
    .replace(/\bWater Rock\b/g, 'Water Stone')
    .replace(/\bLeaf Rock\b/g, 'Leaf Stone')
    .replace(/\bMoon Rock\b/g, 'Moon Stone')
    .replace(/\bFire Rock\b/g, 'Fire Stone')
    .replace(/\bHard Rock\b/g, 'Hard Stone')
    .replace(/\bFloat Rock\b/g, 'Float Stone')
    .replace(/\bDark Rock\b/g, 'Dark Stone')
    .replace(/\bLight Rock\b/g, 'Light Stone')
    .replace(/\bMega Rock Shard\b/g, 'Mega Stone Shard')
    .replace(/\bmetal composto\b/gi, 'Metal Alloy');
}

function leftover(s) {
  return /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\b(quando|uma pedra|permite que|este item|para evoluir|Ao equipar|Used em|Used para|carrega|dentro da|do Pokémon|o move|em battle)\b/i
    .test(String(s || '').replace(/Pokémon|Poké Ball|Pokédex/g, ''));
}

function patternDesc(it) {
  const d = it.d || '';
  const mega = d.match(/permite que (.+?) evolua para Mega (.+?) durante/i);
  if (mega) return `Hold this to Mega Evolve ${mega[1].trim()} into Mega ${mega[2].trim()} in battle.`;
  const used = d.match(/^Used em (.+?) para evoluí-lo para (.+?)\.?$/i);
  if (used) return `Use on ${used[1].trim()} to evolve it into ${used[2].trim()}.`;
  const tera = d.match(/Teracristaliza\w*.*tipo:\s*(.+)$/i);
  if (tera || /Used para converter a Teracristal/i.test(d) || /Used para a Teracristal/i.test(d)) {
    const type = (d.match(/tipo:\s*(.+)$/i) || [])[1];
    return type ? `Changes a Pokémon’s Tera Type to ${type.trim()}.` : 'Used for Terastallizing a Pokémon.';
  }
  if (/Uma pedra mágica/i.test(d)) {
    return 'A peculiar stone that makes certain species of Pokémon evolve.';
  }
  if (/Um item mágico que permite a evolução/i.test(d)) {
    return 'A mysterious item that makes certain species of Pokémon evolve.';
  }
  if (/Uma armadura mágica/i.test(d)) {
    return 'A peculiar set of armor that makes certain species of Pokémon evolve.';
  }
  if (it.t === 14 || it.t === 3) return 'An item to be held by a Pokémon.';
  return null;
}

let names = 0, descs = 0;
for (const [id, it] of Object.entries(dados.itens || {})) {
  if (!it) continue;
  const n0 = it.n;
  if (NAMES[+id]) it.n = NAMES[+id];
  else it.n = fixStoneName(it.n);
  if (it.n !== n0) {
    if (!uiPt[it.n]) uiPt[it.n] = n0;
    names++;
  }
  const d0 = it.d;
  if (DESC[+id]) it.d = DESC[+id];
  else if (leftover(it.d)) {
    const next = patternDesc(it);
    if (next) it.d = next;
  }
  if (it.d !== d0) {
    if (d0 && !uiEn[d0]) uiEn[d0] = it.d;
    if (!uiPt[it.d]) uiPt[it.d] = d0 || it.d;
    descs++;
  }
}

const BAD_EN = {
  'Thunder Stone': 'Thunder Stone',
  'Water Stone': 'Water Stone',
  'Leaf Stone': 'Leaf Stone',
  'Moon Stone': 'Moon Stone',
  'Fire Stone': 'Fire Stone',
  'Hard Stone': 'Hard Stone',
  'Float Stone': 'Float Stone',
  'Dark Stone': 'Dark Stone',
  'Light Stone': 'Light Stone',
  'Hard Stone Shard': 'Hard Stone Shard',
  'Float Stone Shard': 'Float Stone Shard',
};
for (const [k, v] of Object.entries(BAD_EN)) uiEn[k] = v;
uiEn['Pedra do Trovão'] = 'Thunder Stone';
uiEn['Pedra da Água'] = 'Water Stone';
uiEn['Pedra da Folha'] = 'Leaf Stone';
uiEn['Pedra da Lua'] = 'Moon Stone';
uiEn['Pedra do Fogo'] = 'Fire Stone';
uiEn['Pedra dura'] = 'Hard Stone';
uiEn['pedra leve'] = 'Float Stone';
uiEn['Pedra dura [Fragmento]'] = 'Hard Stone Shard';
uiEn['pedra leve [Fragmento]'] = 'Float Stone Shard';
uiPt['Thunder Stone'] = 'Pedra do Trovão';
uiPt['Water Stone'] = 'Pedra da Água';
uiPt['Leaf Stone'] = 'Pedra da Folha';
uiPt['Moon Stone'] = 'Pedra da Lua';
uiPt['Fire Stone'] = 'Pedra do Fogo';
uiPt['Hard Stone'] = 'Pedra Dura';
uiPt['Float Stone'] = 'Pedra Leve';
uiPt['Metal Alloy'] = 'Liga de Metal';

fs.writeFileSync(dataPath, JSON.stringify(dados));
fs.writeFileSync(uiEnPath, JSON.stringify(uiEn, null, 2) + '\n');
fs.writeFileSync(uiPtPath, JSON.stringify(uiPt, null, 2) + '\n');

const shop = (dados.lojas['2150101'] || []).map((l) => {
  const it = dados.itens[l.item];
  return { id: l.item, n: it.n, d: it.d, leftover: leftover(it.d) || leftover(it.n) };
});
console.log(JSON.stringify({ names, descs, shop }, null, 2));
