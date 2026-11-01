/* Esquemas da Fase 2 do painel (conteúdo do jogo): insígnias, curvas de EXP, iniciais, montarias, golpes, missões, evoluções,
 * espécies e learnset. Entram no ESQUEMAS do admin/schemas.mjs (mesmo formato e mesmas regras — ver o cabeçalho de lá), então o
 * servidor valida por eles e só grava o que está aqui. Dois ganchos a mais:
 *   tela     = a edição é numa tela própria (admin/content.mjs, botão #lado [data-vista=tela]); o "Arquivos de dados" leva pra ela
 *   colecao  = (dados, { validarCampo, validarRegistro, generica }) → { ok, v } | { ok: false, erro } — valida o conteúdo inteiro
 *              quando ele NÃO é feito de registros (mapa de números, pares [golpe, nível], capítulos → missões → passos), ou
 *              quando precisa de uma regra que cruza registros (`generica` = a validação normal do esquema).
 * Fonte de verdade das missões: data/missions.json (o jogo em missions.mjs e o servidor em MISSOES). O menus_dados.missoes/passos
 * é o dump do jogo original, que ninguém lê — o painel não edita. */

const ok = v => ({ ok: true, v }), falha = erro => ({ ok: false, erro });
const ehObj = v => v && typeof v === 'object' && !Array.isArray(v);
const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const RE_ARQUIVO = /^[\w-]{1,60}$/;
const RE_GLB_MON = /^pm\d{4}_\d\d$/;
const RE_GOLPE = /^[a-z0-9]{1,40}$/;
const RE_DEX = /^\d{1,4}$/;
/** Chaves desconhecidas passam direto (igual ao validarRegistro): o arquivo pode ter campo que o painel ainda não edita. */
const extras = (o, conhecidas) => Object.fromEntries(Object.entries(o).filter(([k]) => !conhecidas.includes(k) && /^\w{1,40}$/.test(k)));

export const TIPOS = { Normal: 'Normal', Fighting: 'Fighting', Flying: 'Flying', Poison: 'Poison', Ground: 'Ground', Rock: 'Rock', Bug: 'Bug',
  Ghost: 'Ghost', Steel: 'Steel', Fire: 'Fire', Water: 'Water', Grass: 'Grass', Electric: 'Electric', Psychic: 'Psychic', Ice: 'Ice',
  Dragon: 'Dragon', Dark: 'Dark', Fairy: 'Fairy' };
const OPC_TIPOS = Object.entries(TIPOS).map(([v, rotulo]) => ({ v, rotulo }));
export const CURVAS = { slow: 'Slow', medium: 'Medium', fast: 'Fast', 'medium-slow': 'Medium-slow', 'slow-then-very-fast': 'Erratic', 'fast-then-very-slow': 'Fluctuating' };

/** Mapa { id: número } (alturas, sexos, tamanhos): cada valor validado por um campo `num`. */
const mapaDeNumeros = (reId, campo, ajudaId) => (d, { validarCampo }) => {
  if (!ehObj(d)) return falha('expected an object { id: number }');
  const out = {};
  for (const [id, v] of Object.entries(d)) {
    if (!reId.test(id)) return falha(`invalid id: ${id}` + (ajudaId ? ` (${ajudaId})` : ''));
    const r = validarCampo(campo, v);
    if (!r.ok) return falha(`[${id}] ${r.erro}`);
    out[id] = r.v;
  }
  return ok(out);
};
const mapaDeTextos = (reId, max) => d => {
  if (!ehObj(d)) return falha('expected an object { id: text }');
  const out = {};
  for (const [id, v] of Object.entries(d)) {
    if (!reId.test(id)) return falha(`invalid id: ${id}`);
    if (typeof v !== 'string' || v.length > max) return falha(`[${id}] text of up to ${max} characters`);
    out[id] = v;
  }
  return ok(out);
};

// ── Missões: capítulos → missões → passos (os tipos que o missions.mjs e o servidor conhecem) ──────────────────────────────
export const TIPOS_PASSO = {
  falar:    'Talk to an NPC',
  ir:       'Go to an area',
  inicial:  'Choose the starter',
  capturar: 'Catch Pokémon',
  derrotar: 'Defeat (wild or trainer)',
  nivel:    'Have a Pokémon at a level',
  curar:    'Heal the team (Nurse Joy)',
  insignia: 'Have N badges',
  entregar: 'Deliver an item to an NPC',
  item:     'Have an item in the bag',
};
const listaInt = (v, min, max, tam = 50) => Array.isArray(v) && v.length >= 1 && v.length <= tam && v.every(n => inteiro(n, min, max));
const falas = v => Array.isArray(v) && v.length <= 12 && v.every(s => typeof s === 'string' && s.length <= 400);
function validarPasso(p) {
  if (!ehObj(p)) return 'invalid step';
  if (!TIPOS_PASSO[p.tipo]) return `unknown step type: ${p.tipo}`;
  if (typeof p.texto !== 'string' || !p.texto.trim() || p.texto.length > 200) return 'missing step text (up to 200 characters) — it\'s what the player reads in the tracker';
  if (p.onde != null && (typeof p.onde !== 'string' || p.onde.length > 120)) return '"onde": text of up to 120 characters';
  if (p.fala != null && !falas(p.fala)) return '"fala": up to 12 lines of text';
  const cfg = v => v == null || inteiro(v, 1, 999999999) || listaInt(v, 1, 999999999, 20);
  if (!cfg(p.cfg)) return '"cfg": the NPC number (or a list)';
  if (p.cfgs != null && !listaInt(p.cfgs, 1, 999999999, 20)) return '"cfgs": list of NPC numbers';
  if (p.n != null && !inteiro(p.n, 1, 9999)) return '"n": quantity from 1 to 9999';
  if (p.area != null && !inteiro(p.area, 1, 99999999)) return '"area": the area number';
  if (p.dex != null && !listaInt(p.dex, 1, 2000, 200)) return '"dex": list of Pokédex numbers';
  if (p.item != null && !inteiro(p.item, 1, 999999999)) return '"item": the item number';
  if (p.cena != null && !inteiro(p.cena, 1, 99999999)) return '"cena": the scene number';
  for (const k of ['selvagem', 'treinador']) if (p[k] != null && typeof p[k] !== 'boolean') return `"${k}": yes or no`;
  switch (p.tipo) {
    case 'falar': if (p.cfg == null && p.cfgs == null) return 'talk: say which NPC (cfg)'; break;
    case 'entregar': if (p.cfg == null || p.item == null) return 'deliver: needs the NPC (cfg) and the item'; break;
    case 'item': if (p.item == null) return 'item: say which item'; break;
    case 'ir': if (p.area == null) return 'go: say which area'; break;
    case 'nivel': if (!inteiro(p.lv, 1, 100)) return 'level: "lv" from 1 to 100'; break;
    case 'insignia': if (!inteiro(p.n, 1, 99)) return 'badges: "n" from 1 to 99'; break;
  }
  return null;
}
function validarRecompensa(r) {
  if (!ehObj(r)) return 'invalid reward';
  for (const k of ['dinheiro', 'exp']) if (r[k] != null && !inteiro(r[k], 0, 1e9)) return `reward: "${k}" integer from 0 to 1 billion`;
  for (const k of ['itens', 'bolas']) if (r[k] != null) {
    if (!ehObj(r[k]) || Object.keys(r[k]).length > 50) return `reward: "${k}" = { "item id": quantity }`;
    for (const [id, n] of Object.entries(r[k])) if (!/^\d{1,9}$/.test(id) || !inteiro(n, 1, 999999)) return `reward ${k}: item ${id} × ${n} is invalid`;
  }
  return null;
}
function validarGrupos(d, ids, rotulo) {
  if (!Array.isArray(d)) return falha(`expected the list of ${rotulo}s`);
  if (d.length > 200) return falha(`too many ${rotulo}s`);
  const grupos = new Set(), out = [];
  for (const [ci, c] of d.entries()) {
    const onde = `[${rotulo} ${ci + 1}]`;
    if (!ehObj(c)) return falha(onde + ' invalid');
    if (!inteiro(c.id, 1, 99999) || grupos.has(c.id)) return falha(onde + ' "id" empty or duplicated');
    grupos.add(c.id);
    if (typeof c.nome !== 'string' || !c.nome.trim() || c.nome.length > 80) return falha(onde + ' missing name (up to 80 characters)');
    if (!Array.isArray(c.missoes) || c.missoes.length > 200) return falha(onde + ' "missoes" must be a list');
    const missoes = [];
    for (const [mi, m] of c.missoes.entries()) {
      const om = `${onde} [quest ${mi + 1}]`;
      if (!ehObj(m)) return falha(om + ' invalid');
      if (!inteiro(m.id, 1, 999999999) || ids.has(m.id)) return falha(om + ' "id" empty or duplicated (the id is unique across the whole game: the save stores it)');
      ids.add(m.id);
      if (typeof m.nome !== 'string' || !m.nome.trim() || m.nome.length > 100) return falha(om + ' missing name (up to 100 characters)');
      if (m.des != null && (typeof m.des !== 'string' || m.des.length > 400)) return falha(om + ' description of up to 400 characters');
      if (m.npc != null && !inteiro(m.npc, 1, 999999999)) return falha(om + ' "npc": the quest giver cfg');
      let exige = null;
      if (m.exige != null) {
        const arr = Array.isArray(m.exige) ? m.exige : [m.exige];
        if (arr.length > 20) return falha(om + ' "exige": up to 20 mission ids');
        for (const id of arr) if (!inteiro(id, 1, 999999999)) return falha(om + ' "exige": mission ids that must be finished first');
        if (arr.map(Number).includes(m.id)) return falha(om + ' "exige" cannot include its own id');
        exige = arr.map(Number);
      }
      if (!Array.isArray(m.passos) || !m.passos.length || m.passos.length > 40) return falha(om + ' needs 1 to 40 steps');
      const passos = [];
      for (const [pi, p] of m.passos.entries()) {
        const e = validarPasso(p);
        if (e) return falha(`${om} [step ${pi + 1}] ${e}`);
        passos.push(JSON.parse(JSON.stringify(p)));
      }
      if (m.recompensa != null) { const e = validarRecompensa(m.recompensa); if (e) return falha(om + ' ' + e); }
      missoes.push({ ...extras(m, ['id', 'nome', 'des', 'npc', 'exige', 'passos', 'recompensa']), id: m.id, nome: m.nome, ...(m.des != null ? { des: m.des } : {}), ...(m.npc != null ? { npc: m.npc } : {}), ...(exige ? { exige } : {}), passos,
        ...(m.recompensa != null ? { recompensa: JSON.parse(JSON.stringify(m.recompensa)) } : {}) });
    }
    out.push({ ...extras(c, ['id', 'nome', 'missoes']), id: c.id, nome: c.nome, missoes });
  }
  return ok(out);
}
function validarArquivoMissoes(d) {
  const raw = Array.isArray(d) ? { capitulos: d, laterais: [] } : d;
  if (!ehObj(raw)) return falha('expected { capitulos, laterais }');
  const ids = new Set();
  const caps = validarGrupos(raw.capitulos || [], ids, 'chapter');
  if (!caps.ok) return caps;
  const sides = validarGrupos(raw.laterais || [], ids, 'side quest group');
  if (!sides.ok) return sides;
  const out = { ...extras(raw, ['capitulos', 'laterais']), capitulos: caps.v, laterais: sides.v };
  if (JSON.stringify(out).length > 3e6) return falha('quests too large');
  return ok(out);
}

// ── Learnset: { dex: [[golpe, nível], …] } ───────────────────────────────────────────────────────────────────────────────
function validarLearnset(d) {
  if (!ehObj(d)) return falha('expected { "dex no.": [["move", level], …] }');
  const out = {};
  for (const [dex, l] of Object.entries(d)) {
    if (!RE_DEX.test(dex)) return falha(`invalid dex no.: ${dex}`);
    if (!Array.isArray(l) || l.length > 120) return falha(`[${dex}] must be a list (up to 120 moves)`);
    for (const [i, par] of l.entries())
      if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== 'string' || !RE_GOLPE.test(par[0]) || !inteiro(par[1], 1, 120))
        return falha(`[${dex}] move ${i + 1}: use ["move id", level from 1 to 120]`);
    out[dex] = l.map(([g, n]) => [g, n]).sort((a, b) => a[1] - b[1]);   // o jogo pega "os últimos 4 até o nível": a ordem é por nível
  }
  return ok(out);
}

const regraEvolucao = r => {
  if (r.gatilho === 'item' && !r.item && !r.itemNome) return 'use item: say which item (or just its name, if it doesn\'t exist in the game yet)';
  if (r.item === 0 && !r.itemNome) return 'item that doesn\'t exist yet (0): write its name, it\'s what the player reads';
  if (r.segurando === 0 && !r.segurandoNome) return 'held item that doesn\'t exist yet (0): write its name';
  if (r.golpe != null && !r.golpeNome) return 'knows move: also fill in the move name (it\'s what the player reads)';
  return null;
};

export const ESQUEMAS_F2 = {
  insignias: {
    titulo: 'Badges', arquivo: 'menu_data', caminho: 'insignias', forma: 'lista', id: 'id',
    descricao: 'Name and icon of each badge. The game shows generation 1 (Kanto) badges in the Trainer card; which one each gym gives is set on the Gyms screen.',
    previa: '/admin/preview_badge.mjs',
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'num', int: true, min: 1, max: 9999999, col: true, obrigatorio: true, ajuda: 'The player\'s save stores this number: don\'t change it for a badge that already exists.' },
      { k: 'n', rotulo: 'Name', tipo: 'texto', max: 60, col: true, obrigatorio: true },
      { k: 'i', rotulo: 'Icon', tipo: 'texto', max: 60, col: true, validar: s => RE_ARQUIVO.test(s) ? null : 'file name, without .png', ajuda: 'File ui/icones/<icon>.png (Kanto\'s are dghz_1 … dghz_8).' },
      { k: 'gen', rotulo: 'Generation (region)', tipo: 'num', int: true, min: 1, max: 9, col: true, obrigatorio: true, ajuda: '1 = Kanto (the only one the game shows for now).' },
    ],
  },
  exp_curvas: {
    titulo: 'EXP curves', arquivo: 'exp', caminho: 'curvas', forma: 'objeto',
    descricao: 'Total EXP to reach each level, in the 6 official curves. Each species uses one of them (Species screen → EXP).',
    validar: r => {
      for (const [k, c] of Object.entries(r)) {
        if (!CURVAS[k]) continue;
        if (c[0] !== 0 || c[1] !== 0) return `${CURVAS[k]}: the first two numbers (index 0 and Lv 1) must be 0`;
        for (let i = 2; i < c.length; i++) if (c[i] < c[i - 1]) return `${CURVAS[k]}: Lv ${i} (${c[i]}) is lower than Lv ${i - 1} (${c[i - 1]}) — EXP can only grow`;
      }
      return null;
    },
    campos: Object.entries(CURVAS).map(([k, nome]) => ({ k, rotulo: `${nome} (${k})`, tipo: 'numeros', tam: 101, int: true, min: 0, max: 100000000, obrigatorio: true,
      ajuda: '101 comma-separated numbers: index 0, Lv 1 … Lv 100 (total EXP at the start of the level).' })),
  },
  iniciais: {
    titulo: 'Starters', arquivo: 'starters', forma: 'lista', id: 'dex',
    descricao: 'The Pokémon Oak\'s lab offers, by generation. The game shows these and the server only accepts choosing one of them.',
    colecao: (d, { generica }) => {
      const r = generica(d); if (!r.ok) return r;
      if (!r.v.some(x => x.gen === 1)) return falha('needs at least one generation 1 starter (Oak\'s table and Amanda\'s pop-up use generation 1)');
      return r;
    },
    campos: [
      { k: 'gen', rotulo: 'Generation', tipo: 'num', int: true, min: 1, max: 9, col: true, obrigatorio: true, ajuda: 'One tab per generation in the starter choice; 1 is the one on Oak\'s table.' },
      { k: 'dex', rotulo: 'No. (dex)', tipo: 'num', int: true, min: 1, max: 2000, col: true, obrigatorio: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'glb', rotulo: 'Model', tipo: 'texto', max: 20, col: true, obrigatorio: true, validar: s => RE_GLB_MON.test(s) ? null : 'Pokémon model, e.g. pm0001_00', ajuda: 'File scenery/mon/<model>.glb.' },
      { k: 'tipos', rotulo: 'Types', tipo: 'linhas', obrigatorio: true, resumo: v => (v || []).map(t => TIPOS[t] || t).join(' / '),
        validar: v => v.length >= 1 && v.length <= 2 && v.every(t => TIPOS[t]) ? null : 'one or two, one per line, in English: ' + Object.keys(TIPOS).join(', ') },
    ],
  },
  montarias: {
    titulo: 'Mounts', arquivo: 'mounts', forma: 'lista', id: 'glb',
    descricao: 'The Pokémon you can ride (M key and shortcuts 5–9): trainer pose, size, speed and where they can go.',
    campos: [
      { k: 'glb', rotulo: 'Model', tipo: 'texto', max: 20, col: true, obrigatorio: true, validar: s => RE_GLB_MON.test(s) ? null : 'Pokémon model, e.g. pm0249_00' },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'livre', rotulo: 'Unlocked for everyone', tipo: 'bool', col: true, ajuda: 'Unchecked = staff only (until the mount shop exists). Playing without an account can ride them all.' },
      { k: 'meio', rotulo: 'Moves on', tipo: 'opcao', col: true, obrigatorio: true, opcoes: [{ v: 'terra', rotulo: 'Land' }, { v: 'agua', rotulo: 'Water (enters from the shore)' }, { v: 'anfibia', rotulo: 'Land and water' }] },
      { k: 'voa', rotulo: 'Flies', tipo: 'bool', col: true, ajuda: 'Rises and passes over everything (crosses water through the air).' },
      { k: 'escala', rotulo: 'Size when ridden (×)', tipo: 'num', min: 0.1, max: 5, col: true, obrigatorio: true, ajuda: 'Model scale with the trainer on top (Lugia 0.6).' },
      { k: 'vel', rotulo: 'Speed', tipo: 'num', int: true, min: 1000, max: 200000, col: true, obrigatorio: true, ajuda: 'In 1/10000 of walking speed: 25000 = 2.5× (Charizard), 37500 = 3.75× (Lugia).' },
      { k: 'poseIdle', rotulo: 'Trainer pose when idle', tipo: 'opcao', obrigatorio: true, opcoes: ['RideIdle', 'RideIdle1', 'RideIdle2', 'RideIdle3', 'RideIdle4', 'RideIdle5'].map(v => ({ v })) },
      { k: 'poseRun', rotulo: 'Trainer pose when moving', tipo: 'opcao', obrigatorio: true, opcoes: ['Ride', 'Ride1', 'Ride2', 'Ride3', 'Ride4', 'Ride5'].map(v => ({ v })) },
    ],
  },
  golpes: {
    titulo: 'Moves', arquivo: 'moves', forma: 'mapa', idValido: RE_GOLPE, idAjuda: 'lowercase letters and numbers, e.g. thunderbolt',
    descricao: 'Moves with 3D effects: power, type, PP, range, cooldown and the effect/sound/animation. The learnset (who learns what) is on the Learnset screen.',
    campos: [
      { k: 'nome', rotulo: 'Name (English)', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'nomePt', rotulo: 'Portuguese name', tipo: 'texto', max: 60, col: true },
      { k: 'tipo', rotulo: 'Type', tipo: 'opcao', col: true, obrigatorio: true, opcoes: OPC_TIPOS },
      { k: 'cat', rotulo: 'Category', tipo: 'opcao', col: true, obrigatorio: true, opcoes: [{ v: 'fisico', rotulo: 'Physical' }, { v: 'especial', rotulo: 'Special' }, { v: 'status', rotulo: 'Status' }] },
      { k: 'poder', rotulo: 'Power', tipo: 'num', int: true, min: 0, max: 300, col: true, obrigatorio: true },
      { k: 'pp', rotulo: 'PP', tipo: 'num', int: true, min: 1, max: 99, col: true, ajuda: 'Empty = the one from the old learnset.json (or 20).' },
      { k: 'precisao', rotulo: 'Accuracy (%)', tipo: 'num', int: true, min: 0, max: 100 },
      { k: 'alcance', rotulo: 'Range (m)', tipo: 'num', min: 0, max: 40, obrigatorio: true, ajuda: '1.3 = melee; 6–8 = ranged; 0 = self.' },
      { k: 'recarga', rotulo: 'Cooldown (s)', tipo: 'num', min: 0, max: 60, obrigatorio: true },
      { k: 'atraso', rotulo: 'Delay until hit (s)', tipo: 'num', min: 0, max: 5, obrigatorio: true, ajuda: 'Animation time until the move lands (projectile flight time is added on top).' },
      { k: 'prioridade', rotulo: 'Priority', tipo: 'num', int: true, min: -7, max: 7 },
      { k: 'efeito', rotulo: '3D effect (id)', tipo: 'texto', max: 8, obrigatorio: true, validar: s => /^\d{5}$/.test(s) ? null : '5 digits, e.g. 00085', ajuda: 'The original game\'s effect prefab (00085_Hit…).' },
      { k: 'anim', rotulo: 'Pokémon animation', tipo: 'opcao', obrigatorio: true, opcoes: [{ v: 'Attack', rotulo: 'Attack (strike)' }, { v: 'Cast', rotulo: 'Cast (launch)' }, { v: 'Buff', rotulo: 'Buff (self)' }] },
      { k: 'som', rotulo: 'Move sound', tipo: 'texto', max: 40, validar: s => /^[\w .-]{1,40}$/.test(s) ? null : 'sound name' },
      { k: 'somAcerto', rotulo: 'Hit sound', tipo: 'texto', max: 40, validar: s => /^[\w .-]{1,40}$/.test(s) ? null : 'sound name' },
      { k: 'contato', rotulo: 'Contact (melee lunge)', tipo: 'bool' },
      { k: 'inicio', rotulo: 'Start phase on the attacker (Start)', tipo: 'bool' },
      { k: 'voo', rotulo: 'Projectile that flies to the target (Fly)', tipo: 'bool' },
      { k: 'ataque', rotulo: 'Attack phase on the attacker (Atk)', tipo: 'bool' },
      { k: 'proprio', rotulo: 'Used on self', tipo: 'bool' },
      { k: 'acerto', rotulo: 'Has a hit effect (Hit)', tipo: 'bool' },
      { k: 'descricao', rotulo: 'Description', tipo: 'texto', max: 400, area: true },
    ],
  },
  learnset: {
    titulo: 'Learnset', arquivo: 'learnset', caminho: 'learnset', forma: 'mapa', tela: 'learnset', naLista: true,
    descricao: 'Which moves each species learns and at what level (own screen).',
    colecao: validarLearnset,
    campos: [],
  },
  missoes: {
    titulo: 'Quests', arquivo: 'missions', forma: 'objeto', tela: 'missoes', naLista: true,
    descricao: 'Main story chapters and side quest groups: quests, steps and rewards (own screen).',
    colecao: validarArquivoMissoes,
    campos: [],
  },
  evolucoes: {
    titulo: 'Evolutions', arquivo: 'evolutions', caminho: 'por', forma: 'mapa', registroLista: true, tela: 'evolucoes', naLista: true, idValido: RE_DEX, idAjuda: 'the dex no.',
    descricao: 'How each species evolves (own screen).',
    validar: regraEvolucao,
    campos: [
      { k: 'para', rotulo: 'Evolves into (no.)', tipo: 'num', int: true, min: 1, max: 2000, obrigatorio: true },
      { k: 'nome', rotulo: 'Evolution name', tipo: 'texto', max: 40, obrigatorio: true },
      { k: 'gatilho', rotulo: 'How', tipo: 'opcao', obrigatorio: true, opcoes: [
        { v: 'nivel', rotulo: 'Level up' }, { v: 'item', rotulo: 'Use an item (stone)' }, { v: 'troca', rotulo: 'Trade (or use the item)' },
        { v: 'muda', rotulo: 'Alongside another evolution (Shedinja)' }, { v: 'outro', rotulo: 'Special (not possible here)' }] },
      { k: 'texto', rotulo: 'Text for the player', tipo: 'texto', max: 160, obrigatorio: true, ajuda: 'What the info card shows, e.g. "Lv 16" or "use Water Stone".' },
      { k: 'nivel', rotulo: 'Minimum level', tipo: 'num', int: true, min: 1, max: 100 },
      { k: 'amizade', rotulo: 'Minimum friendship', tipo: 'num', int: true, min: 0, max: 255, ajuda: '160 = high friendship (the games\' default).' },
      { k: 'horario', rotulo: 'Time of day', tipo: 'opcao', opcoes: [{ v: 'dia', rotulo: 'Daytime only (6:00–17:59)' }, { v: 'noite', rotulo: 'Night only' }] },
      { k: 'item', rotulo: 'Item used', tipo: 'num', int: true, min: 0, max: 999999999, item: true, ajuda: 'Stone, cable or trade item. 0 = doesn\'t exist in the game yet (then the player reads the name below).' },
      { k: 'itemNome', rotulo: 'Name of the item used', tipo: 'texto', max: 60 },
      { k: 'segurando', rotulo: 'Holding the item', tipo: 'num', int: true, min: 0, max: 999999999, item: true, ajuda: '0 = doesn\'t exist in the game yet.' },
      { k: 'segurandoNome', rotulo: 'Name of the held item', tipo: 'texto', max: 60 },
      { k: 'golpe', rotulo: 'Knowing the move (id)', tipo: 'num', int: true, min: 1, max: 99999, ajuda: 'The move\'s id in the Pokédex (dex_extra), e.g. 10246 = Ancient Power.' },
      { k: 'golpeNome', rotulo: 'Move name', tipo: 'texto', max: 60 },
      { k: 'tipoGolpe', rotulo: 'Knowing a move of type', tipo: 'opcao', opcoes: OPC_TIPOS },
      { k: 'noTime', rotulo: 'With this Pokémon in the team (no.)', tipo: 'num', int: true, min: 1, max: 2000 },
      { k: 'tipoNoTime', rotulo: 'With a Pokémon of this type in the team', tipo: 'opcao', opcoes: OPC_TIPOS },
      { k: 'genero', rotulo: 'One gender only', tipo: 'opcao', opcoes: [{ v: 'm', rotulo: '♂ male' }, { v: 'f', rotulo: '♀ female' }], ajuda: 'Informational: the game doesn\'t check it yet.' },
      { k: 'stats', rotulo: 'Atk × Def (Tyrogue)', tipo: 'opcao', opcoes: [{ v: 1, rotulo: 'Atk > Def' }, { v: 0, rotulo: 'Atk = Def' }, { v: -1, rotulo: 'Atk < Def' }], ajuda: 'Informational: the game doesn\'t check it yet.' },
      { k: 'extra', rotulo: 'Special rule (free text)', tipo: 'texto', max: 60 },
    ],
  },
  evolucoes_itens: {
    titulo: 'Evolution items', arquivo: 'evolutions', caminho: 'itens', forma: 'mapa', tela: 'evolucoes', idValido: /^\d{1,9}$/, idAjuda: 'the item id',
    descricao: 'The items the game lets you use on a Pokémon to evolve it (the Evolutions screen keeps this list up to date on its own).',
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'num', int: true, min: 1, max: 999999999, obrigatorio: true },
      { k: 'n', rotulo: 'Name', tipo: 'texto', max: 200, obrigatorio: true },
      { k: 'd', rotulo: 'Description', tipo: 'texto', max: 3000 },
      { k: 't', rotulo: 'Type', tipo: 'num', int: true, min: 0, max: 99 },
      { k: 'i', rotulo: 'Icon', tipo: 'texto', max: 60 },
      { k: 'q', rotulo: 'Quality', tipo: 'num', int: true, min: 0, max: 10 },
    ],
  },
  // ── Espécies (tela própria: admin/content.mjs junta tudo por nº da dex e grava em cada arquivo o que mudou) ─────────────
  especies: {
    titulo: 'Species', arquivo: 'species', forma: 'mapa', tela: 'especies', naLista: true, idValido: RE_DEX, idAjuda: 'the dex no.',
    descricao: 'Model names, size, height, gender, description and EXP of each species (own screen). This file stores the adjustments that don\'t exist in the data generated from the original game (currently: the in-field size).',
    campos: [
      { k: 'escala', rotulo: 'In-field size adjustment (×)', tipo: 'num', min: 0.1, max: 5, ajuda: 'Multiplies the size derived from the height (proportional scale, the default mode). 1 = no adjustment.' },
    ],
  },
  alturas: {
    titulo: 'Heights', arquivo: 'heights', forma: 'mapa', tela: 'especies', descricao: 'Real height of each species (m).',
    colecao: mapaDeNumeros(RE_DEX, { tipo: 'num', min: 0.01, max: 200 }, 'the dex no.'), campos: [],
  },
  sexos: {
    titulo: 'Gender', arquivo: 'genders', forma: 'mapa', tela: 'especies', descricao: '% male of each species (-1 = genderless).',
    colecao: mapaDeNumeros(RE_DEX, { tipo: 'num', min: -1, max: 100 }, 'the dex no.'), campos: [],
  },
  tamanhos: {
    titulo: 'Sizes (game mode)', arquivo: 'sizes', forma: 'mapa', tela: 'especies', descricao: 'The original game\'s MapSize per model (only in the "game" size mode).',
    colecao: mapaDeNumeros(/^pm\d{4}(_\d\d){0,2}$/, { tipo: 'num', min: 0.01, max: 50 }, 'pm0025 or pm0025_61'), campos: [],
  },
  descricoes_pt: {
    titulo: 'Pokédex descriptions (pt)', arquivo: 'idioma/dex_pt', forma: 'mapa', tela: 'especies', descricao: 'The Pokédex entry text in Portuguese.',
    colecao: mapaDeTextos(/^\d{1,5}$/, 6000), campos: [],
  },
  dex_extra: {
    titulo: 'Pokédex (extra data)', arquivo: 'dex_extra', caminho: 'especies', forma: 'mapa', tela: 'especies', idValido: RE_DEX,
    descricao: 'Extra Pokédex entry data (displayed gender and height, level-up moves on the entry…).',
    campos: [
      { k: 'm', rotulo: '% male', tipo: 'num', min: -1, max: 100 },
      { k: 'f', rotulo: '% female', tipo: 'num', min: -1, max: 100 },
      { k: 'a', rotulo: 'Height (m)', tipo: 'num', min: 0.01, max: 200 },
    ],
  },
  elenco: {
    titulo: 'Cast (models)', arquivo: 'cast', forma: 'lista', id: 'glb', tela: 'especies',
    descricao: 'Every 3D Pokémon model the game has (forms, megas, gigantamax).',
    campos: [
      { k: 'n', rotulo: 'No. (dex)', tipo: 'num', int: true, min: 1, max: 2000, obrigatorio: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, obrigatorio: true },
      { k: 'glb', rotulo: 'Model', tipo: 'texto', max: 30, obrigatorio: true, validar: s => /^pm\d{4}[\w-]{0,20}$/.test(s) ? null : 'e.g. pm0025_00' },
      { k: 'nota', rotulo: 'Form', tipo: 'texto', max: 40 },
      { k: 'altura', rotulo: 'Model height (m)', tipo: 'num', min: 0, max: 200 },
    ],
  },
  exp_especies: {
    titulo: 'EXP by species', arquivo: 'exp', caminho: 'especies', forma: 'mapa', tela: 'especies', idValido: RE_DEX,
    descricao: 'EXP curve, base EXP (how much it gives when defeated) and base friendship of each species.',
    campos: [
      { k: 'c', rotulo: 'EXP curve', tipo: 'opcao', obrigatorio: true, opcoes: Object.entries(CURVAS).map(([v, rotulo]) => ({ v, rotulo })) },
      { k: 'b', rotulo: 'Base EXP', tipo: 'num', int: true, min: 1, max: 1000, obrigatorio: true },
      { k: 'a', rotulo: 'Base friendship', tipo: 'num', int: true, min: 0, max: 255, obrigatorio: true },
    ],
  },
};
