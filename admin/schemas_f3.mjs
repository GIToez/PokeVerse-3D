/* Esquemas da Fase 3 do painel (cores de NPC, diálogos, traduções, raid e músicas). Entram no ESQUEMAS do schemas.mjs (`...ESQUEMAS_F3`),
 * então valem as mesmas regras de lá: o navegador monta a tela e o servidor valida/grava com backup pelos mesmos esquemas.
 * Os eventos ao vivo NÃO estão aqui: têm tela própria (admin/events.mjs) e rota própria (server_events.mjs), porque
 * salvar precisa empurrar pros jogadores online. */

const ehObjeto = v => v && typeof v === 'object' && !Array.isArray(v);

// ── Cores de NPC (npc_tintas.json) ─────────────────────────────────────────────────────────────────────────────────────
/** [r, g, b] ou [r, g, b, a], de 0 a 2 (o shader multiplica a textura: acima de 1 clareia). */
const corRGBA = v => (Array.isArray(v) && (v.length === 3 || v.length === 4) && v.every(n => typeof n === 'number' && n >= 0 && n <= 2))
  ? null : 'use [r, g, b, a] with numbers from 0 to 2 (1 = the texture as is) — or pick the color in the preview above';
export const corHex = v => Array.isArray(v) ? '#' + v.slice(0, 3).map(n => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0')).join('') : '';
const nomePng = s => /^[\w .()-]{1,80}\.png$/i.test(s) ? null : '.png file name (in scenery/npc/mask)';
const canaisNeutros = v => (Array.isArray(v) && v.length <= 3 && v.every(c => ['R', 'G', 'B'].includes(c))) ? null : 'list with "R", "G" and/or "B" — e.g. ["G"]';

// ── Textos ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const linhasCurtas = (max = 10, tam = 300) => v => (Array.isArray(v) && v.length >= 1 && v.length <= max && v.every(s => typeof s === 'string' && s.length <= tam))
  ? null : `1 to ${max} lines, each up to ${tam} characters`;
const chaves = s => [...String(s || '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
/** Tradução: as variáveis {x} da tradução têm que ser as mesmas do texto em português (senão o jogo mostra "{x}" cru). */
const traducaoCasa = r => {
  for (const l of ['en', 'es']) if (r[l] && chaves(r[l]) !== chaves(r.pt)) return `${l.toUpperCase()}: use the same variables as the Portuguese (${chaves(r.pt) ? '{' + chaves(r.pt).split(',').join('}, {') + '}' : 'none'})`;
  return null;
};

// ── Músicas (musicas.json): faixa = caminho em som/ sem .ogg ("bg/sound_road1") ──────────────────────────────────────────
const FAIXA = /^(bg|ui)\/[\w-]{1,60}$/;
const faixaOk = s => FAIXA.test(s) ? null : 'track in the format "bg/sound_road1" (file som/bg/sound_road1.ogg)';
const mapaDeFaixas = v => {
  if (!ehObjeto(v)) return 'must be { "id": "bg/track" }';
  for (const [k, f] of Object.entries(v)) {
    if (!/^\d{1,9}$/.test(k)) return `invalid id: ${k} (numbers only)`;
    if (typeof f !== 'string' || !FAIXA.test(f)) return `${k}: track in the format "bg/sound_road1"`;
  }
  return null;
};
const faixasFixas = ks => v => {
  if (!ehObjeto(v)) return `must be { ${ks.map(k => `"${k}": "bg/…"`).join(', ')} }`;
  for (const [k, f] of Object.entries(v)) if (!ks.includes(k) || typeof f !== 'string' || !FAIXA.test(f)) return `use only ${ks.join(', ')}, each with a "bg/…" track`;
  return null;
};

export const ESQUEMAS_F3 = {
  npc_tintas: {
    titulo: 'NPC colors', arquivo: 'npc_tintas', forma: 'mapa', idValido: /^[\w][\w .:()-]{0,79}$/, idAjuda: 'the model\'s material name (e.g. fc2013_00_nursejoy_hair_col) or "<model>:<material>"',
    descricao: 'The factory color of each part of NPCs, outfits and backpacks: the texture is nearly white and the color comes from here, through the mask\'s R/G/B/black channels. The preview shows the model (when it exists in this copy) with your edits.',
    previa: '/admin/preview_paint.mjs',
    campos: [
      { k: 'ColorR', rotulo: 'Mask red channel (R)', tipo: 'json', col: true, validar: corRGBA, resumo: corHex, ajuda: 'Without a mask, this is the tint of the whole piece.' },
      { k: 'ColorG', rotulo: 'Mask green channel (G)', tipo: 'json', col: true, validar: corRGBA, resumo: corHex },
      { k: 'ColorB', rotulo: 'Mask blue channel (B)', tipo: 'json', col: true, validar: corRGBA, resumo: corHex },
      { k: 'ColorBlack', rotulo: 'Mask black (the rest)', tipo: 'json', col: true, validar: corRGBA, resumo: corHex },
      { k: 'mask', rotulo: 'Mask', tipo: 'texto', max: 84, col: true, validar: s => s ? nomePng(s) : null, ajuda: 'PNG in scenery/npc/mask. Empty = no mask (only the R channel paints, as a base tint).' },
      { k: 'isMask', rotulo: 'Paint', tipo: 'opcao', opcoes: [{ v: 0, rotulo: 'Paints (normal)' }, { v: 1, rotulo: 'Doesn\'t paint (the texture is already colored)' }] },
      { k: 'neutralizar', rotulo: 'Recolor an already-painted texture (advanced)', tipo: 'json', validar: canaisNeutros,
        ajuda: 'Mask channels whose original color is replaced by gray before painting — to recolor hair that came already painted. E.g. ["G"].' },
      { k: 'ganho', rotulo: 'Gray brightness (with "Recolor")', tipo: 'num', min: 0.5, max: 4, ajuda: 'Default 1.6.' },
    ],
  },
  // as falas dos NPCs (npcs_glb.json) são a tela "NPCs (quem é quem)" da Fase 1; a Fase 3 só faz o jogo aberto aplicá-las na hora
  dialogos: {
    titulo: 'Game dialogues', arquivo: 'dialogos', forma: 'objeto', recarga: 'vivo',
    descricao: 'Lines that used to be hard-coded (Pallet gate, Professor Oak, starter choice, intro). Empty = the original text. {nome} = the Pokémon\'s name. The open game applies changes immediately.',
    campos: [
      { k: 'oakNome', rotulo: 'Professor\'s name in the lines', tipo: 'texto', max: 40, ajuda: 'Original: Professor Samuel.' },
      { k: 'portao', rotulo: 'Assistant at the Pallet gate (no Pokémon)', tipo: 'linhas', validar: linhasCurtas(6) },
      { k: 'portaoBalao', rotulo: 'Speech bubble when the assistant is far away', tipo: 'texto', max: 120 },
      { k: 'portaoChat', rotulo: 'Chat line (gate)', tipo: 'texto', max: 200 },
      { k: 'oakJaEscolheu', rotulo: 'Oak: starter already chosen', tipo: 'linhas', validar: linhasCurtas(4), ajuda: 'Original: You already chose {nome}. Take good care of it!' },
      { k: 'oakEntrega', rotulo: 'Oak: hands over the starter', tipo: 'linhas', validar: linhasCurtas(6) },
      { k: 'escolhaTitulo', rotulo: 'Starter choice: title', tipo: 'texto', max: 80 },
      { k: 'escolhaSub', rotulo: 'Starter choice: subtitle', tipo: 'texto', max: 160 },
      { k: 'jaVenceu', rotulo: 'Trainer already defeated (no line of their own)', tipo: 'texto', max: 120 },
      { k: 'introLiga', rotulo: 'Intro: caption 1', tipo: 'texto', max: 80 },
      { k: 'introRed', rotulo: 'Intro: Red\'s line', tipo: 'texto', max: 80 },
      { k: 'introMega', rotulo: 'Intro: Mega Evolution', tipo: 'texto', max: 80 },
    ],
  },
  traducoes: {
    titulo: 'Translations (EN/ES)', arquivo: 'traducoes', forma: 'lista', id: 'pt', recarga: 'vivo',
    descricao: 'English is the source language. Each row: the English text exactly as it appears in the game, and the Portuguese/Spanish translation. {x} matches any snippet (e.g. "You arrived in {x}."). These override the dictionaries in data/locale/. The open game applies changes immediately.',
    validar: traducaoCasa,
    campos: [
      { k: 'pt', rotulo: 'Portuguese (as it appears in the game)', tipo: 'texto', max: 400, col: true, obrigatorio: true, area: true },
      { k: 'en', rotulo: 'English', tipo: 'texto', max: 400, col: true, area: true },
      { k: 'es', rotulo: 'Español', tipo: 'texto', max: 400, col: true, area: true },
      { k: 'nota', rotulo: 'Where it appears (note)', tipo: 'texto', max: 80 },
    ],
  },
  musicas: {
    titulo: 'Music by area', arquivo: 'musicas', forma: 'objeto', recarga: 'vivo',
    descricao: 'The track that plays in each Kanto area, in each interior (scene) and in battles. Track = file in som/ without the .ogg. The preview lists the areas by name and plays the track; the open game switches immediately.',
    previa: '/admin/preview_music.mjs',
    campos: [
      { k: 'areas', rotulo: 'Areas (id → track)', tipo: 'json', validar: mapaDeFaixas, ajuda: 'Areas not in the list use the default area track.' },
      { k: 'cenas', rotulo: 'Interiors (scene → track)', tipo: 'json', validar: mapaDeFaixas, ajuda: 'Scenes not in the list use the default interior track.' },
      { k: 'padrao', rotulo: 'Default', tipo: 'json', validar: faixasFixas(['area', 'interior']), ajuda: '{ "area": "bg/…", "interior": "bg/…" }' },
      { k: 'batalha', rotulo: 'Battles', tipo: 'json', validar: faixasFixas(['treinador', 'ginasio', 'elite']), ajuda: '{ "treinador": "bg/…", "ginasio": "bg/…", "elite": "bg/…" }' },
      { k: 'login', rotulo: 'Login screen', tipo: 'texto', max: 64, validar: faixaOk },
    ],
  },
  raid: {
    titulo: 'Raid', arquivo: 'raid', forma: 'objeto',
    descricao: 'The arena and boss of the live raid. Arena, slots, boss name and size apply in the game (queue, boss bar, announcements and arena mode); HP, damage, shiny and prize belong to the raid server (server_raid.mjs, re-read on every /raid announcement; the chat /raid commands override only that raid).',
    previa: '/admin/preview_raid.mjs',
    validar: r => r.chefeGlb && r.chefeDex && +r.chefeGlb.slice(2, 6) !== r.chefeDex ? `model ${r.chefeGlb} belongs to species no. ${+r.chefeGlb.slice(2, 6)}, not ${r.chefeDex}` : null,
    campos: [
      { k: 'arena', rotulo: 'Arena scene', tipo: 'texto', max: 12, validar: s => /^\d{3,9}$/.test(s) ? null : 'the scene id (numbers only)', ajuda: 'Original: 4120009 (Lorelei\'s Room).' },
      { k: 'vagas', rotulo: 'Queue slots', tipo: 'num', min: 1, max: 50, int: true, ajuda: 'Original: 10.' },
      { k: 'chefeNome', rotulo: 'Boss name', tipo: 'texto', max: 30, ajuda: 'Original: Mew.' },
      { k: 'chefeDex', rotulo: 'Boss species (no.)', tipo: 'num', min: 1, max: 2000, int: true, ajuda: 'Original: 151.' },
      { k: 'chefeGlb', rotulo: 'Boss model', tipo: 'texto', max: 30, validar: s => /^pm\d{4}(_\d{2})?$/.test(s) ? null : 'e.g. pm0151_00', ajuda: 'scenery/mon/<model>.glb. Original: pm0151_00.' },
      { k: 'chefeNivel', rotulo: 'Boss level', tipo: 'num', min: 1, max: 100, int: true, ajuda: 'Original: 70.' },
      { k: 'chefeHp', rotulo: 'Boss HP', tipo: 'num', min: 0, max: 10000000, int: true, ajuda: '0 = automatic (by number of players). /raid hp N changes it for that raid only.' },
      { k: 'chefeDano', rotulo: 'Boss damage (×)', tipo: 'num', min: 0, max: 10, ajuda: '1 = normal. /raid dano F changes it for that raid only.' },
      { k: 'taxaShiny', rotulo: 'Prize shiny (1 in N)', tipo: 'num', min: 1, max: 1000000, int: true, ajuda: '/raid shiny N changes it for that raid only.' },
      { k: 'premio', rotulo: 'Prize', tipo: 'opcao', opcoes: [{ v: 'mew', rotulo: 'The boss (joins the team)' }, { v: 'sem-mew', rotulo: 'Items only (no boss)' }] },
      { k: 'altura', rotulo: 'Boss height in the arena (m)', tipo: 'num', min: 0.5, max: 20, ajuda: 'Original: 2.5.' },
      { k: 'flutua', rotulo: 'How high the boss floats (m)', tipo: 'num', min: 0, max: 10, ajuda: 'Original: 1.' },
    ],
  },
};
