/* Pokédex de CONHECIMENTO (01/09) — nível de conhecimento por espécie e por jogador, como prometido no devlog.
 * Sobe com: avistar, capturar (em rotas diferentes, ♂ e ♀), ver os golpes da espécie, ver evoluir, enfrentar muitas
 * vezes e achar shiny. Cada nível revela mais da ficha na Pokédex. Tudo no navegador (LS `conhecimento`); o ranking
 * entre jogadores fica pro servidor — aqui vale o placar do próprio jogador (Colecionador) e os títulos.
 *
 *   import * as Conhecimento from './knowledge.mjs';
 *   Conhecimento.instalar({ lerLS, gravarLS, porDex, avisar: txt => Chat.sistema(txt), premiar: (id, n) => …, titulo: t => … });
 *   Conhecimento.evento('visto', { dex, shiny });  'pego' { dex, area, shiny, sexo }  'luta' { dex }  'golpe' { dex, id }  'evoluiu' { de, para }
 *   Conhecimento.nivel(dex) → 0..5 · pontos(dex) · falta(dex) → [textos] · revela(dex) → { tipos, stats, captura, genero, learnset, mestre }
 *   Conhecimento.resumo(kantoAte = 151) → { vistos, pegos, shinies, mestres, titulos, … }
 * NUNCA mexe em chance de shiny (promessa pública: 1/4.096 igual pra todos). */
let io = null, dados = null;
const NIVEIS = ['unknown', 'Seen', 'Registered', 'Studied', 'Specialist', 'Master'];
const LIMIAR = [0, 1, 4, 10, 18, 28];                                      // pontos mínimos de cada nível (máx. teórico 36)
export const TITULOS = [                                                 // exported: server_bag.mjs checks and pays the `premio` of each title (once)
  /* Alpha Tester (12/09): não é de coleção — é a marca de quem jogou no alpha, que vem da CONTA (io.alfa). Fica em PRIMEIRO
     na lista de propósito: `tituloAtual` mostra o ÚLTIMO que a pessoa tem, então qualquer título de coleção ganho depois
     aparece no lugar dele (o Alpha Tester é a marca base, enquanto ainda não se conquistou nada). */
  { id: 'alphaTester',  nome: 'Alpha Tester',      cond: r => !!r.alfa,         desc: 'played the PokeVerse alpha' },
  { id: 'observador',   nome: 'Observer',          cond: r => r.vistos >= 25,   desc: '25 species seen' },
  { id: 'colecionador', nome: 'Collector',         cond: r => r.pegos >= 25,    desc: '25 species caught', premio: [1003, 5] },
  { id: 'shiny',        nome: 'Shiny Hunter',      cond: r => r.shinies >= 1,   desc: 'caught a shiny' },
  { id: 'estudioso',    nome: 'Scholar',           cond: r => r.estudadas >= 10, desc: '10 species at Studied or higher' },
  { id: 'mestreKanto',  nome: 'Kanto Master',      cond: r => r.pegosKanto >= 151, desc: 'all 151 Kanto species caught', premio: [1004, 1] },
  { id: 'professor',    nome: 'Professor',         cond: r => r.mestres >= 25,  desc: '25 species at Master' },
];
const SEXO_NENHUM = '-';

function carregar(){ if (!io) return { esp: {}, titulos: [], v: 1 };   // antes de instalar (ex.: rotularJogador no boot): vazio, sem cache
  if (!dados){ dados = io.lerLS('conhecimento', null) || { esp: {}, titulos: [], v: 1 }; dados.esp ||= {}; dados.titulos ||= []; } return dados; }
function salvar(){ if (io && dados) io.gravarLS('conhecimento', dados); }
function vazio(){ return { v: 0, p: 0, ar: [], sx: '', gl: [], ev: 0, lu: 0, sh: 0, shp: 0 }; }
/** A live record, or a legacy 0–5 level number the old server stored. Numbers count: 1 = seen, 2+ = caught. */
export function comoRegistro(raw){
  if (raw && typeof raw === 'object'){
    const r = vazio();
    r.v = Math.max(0, Math.round(+raw.v || 0));
    r.p = Math.max(0, Math.round(+raw.p || 0));
    r.ar = Array.isArray(raw.ar) ? [...new Set(raw.ar.map(x => +x).filter(x => Number.isFinite(x)))].slice(0, 8) : [];
    r.sx = typeof raw.sx === 'string' ? [...new Set([...raw.sx].filter(c => c === 'm' || c === 'f' || c === '-'))].slice(0, 3).join('') : '';
    r.gl = Array.isArray(raw.gl) ? [...new Set(raw.gl.map(x => String(x).slice(0, 40)).filter(Boolean))].slice(0, 24) : [];
    r.ev = raw.ev ? 1 : 0;
    r.lu = Math.max(0, Math.round(+raw.lu || 0));
    r.sh = raw.sh ? 1 : 0;
    r.shp = raw.shp ? 1 : 0;
    return r;
  }
  const n = Math.round(+raw);
  if (n >= 1 && n <= 5) return { v: 1, p: n >= 2 ? 1 : 0, ar: [], sx: '', gl: [], ev: 0, lu: 0, sh: 0, shp: 0 };
  return vazio();
}
const registroVivo = raw => !!(raw && typeof raw === 'object' && Array.isArray(raw.ar) && typeof raw.v === 'number');
function reg(dex){
  const d = carregar();
  const cur = d.esp[dex];
  if (cur == null){ const r = vazio(); d.esp[dex] = r; return r; }
  if (registroVivo(cur)) return cur;
  const r = comoRegistro(cur); d.esp[dex] = r; return r;
}
function classicoDe(r){ return r?.p ? 'pego' : r?.v ? 'visto' : null; }
function publicarDex(dex){
  const r = carregar().esp[dex];
  const st = classicoDe(r);
  if (st) io?.marcarDex?.(dex, st);
}
const temGenero = dex => (io.sexos?.[dex] ?? 50) >= 0;
function promoverSalvos(){
  const d = carregar(); let mudou = false;
  for (const k of Object.keys(d.esp)){
    if (registroVivo(d.esp[k])) continue;
    d.esp[k] = comoRegistro(d.esp[k]); mudou = true;
  }
  if (mudou) salvar();
  for (const [k, st] of Object.entries(estadoAntigo())) io?.marcarDex?.(k, st);
}

export function instalar(ctx){ io = ctx; carregar(); promoverSalvos(); try { conferirTitulos(); } catch {} }   // reconcilia os títulos no boot (12/09: tira o "Caçador de Shiny" dado por VER um shiny, agora só vale CAPTURAR)
/** The account save arrived again. Re-read it so a numeric level from the old server becomes a record the dex can show. */
export function recarregar(){ if (!io) return; dados = null; carregar(); promoverSalvos(); }

/** Pontos de conhecimento da espécie (ver tabela no diário 01/09). */
export function pontos(dex){
  if (carregar().esp[dex] == null) return 0;
  const r = reg(dex); if (!r) return 0;
  let p = 0;
  if (r.v > 0 || r.p > 0) p += 1;
  if (r.p > 0) p += 3;
  p += Math.min(2, Math.max(0, r.ar.length - 1)) * 2;                     // até 3 áreas distintas
  if (r.p > 0 && !temGenero(dex)) p += 4; else p += (r.sx.includes('m') ? 2 : 0) + (r.sx.includes('f') ? 2 : 0);
  p += Math.min(8, r.gl.length);
  if (r.ev) p += 4;
  p += Math.min(5, Math.floor(r.lu / 3));
  if (r.sh) p += 5;
  return p;
}
export function nivel(dex){ const p = pontos(dex); let n = 0; for (let i = 1; i < LIMIAR.length; i++) if (p >= LIMIAR[i]) n = i; return n; }
export const nomeNivel = n => NIVEIS[n] || NIVEIS[0];
export function registro(dex){ return carregar().esp[dex] == null ? null : reg(dex); }
/** O que a ficha pode mostrar neste nível. */
export function revela(dex){
  const n = nivel(dex);
  return { nome: n >= 1, tipos: n >= 1, onde: n >= 1, stats: n >= 2, evolucao: n >= 2, fraquezas: n >= 2, captura: n >= 3, habilidades: n >= 3, genero: n >= 4, learnset: n >= 4, oculta: n >= 4, mestre: n >= 5, nivel: n, pontos: pontos(dex), proximo: LIMIAR[n + 1] ?? null };
}
/** Lista curta do que ainda falta pra subir (pra mostrar na ficha). */
export function falta(dex){
  const r = registro(dex) || vazio(), f = [];
  if (!r.p) f.push('catch one');
  if (r.p && r.ar.length < 3) f.push('catch on another route (' + r.ar.length + '/3)');
  if (temGenero(dex)){ if (!r.sx.includes('m')) f.push('catch a ♂'); if (!r.sx.includes('f')) f.push('catch a ♀'); }
  if (r.gl.length < 8) f.push('see more of the species\' moves (' + r.gl.length + '/8)');
  if (!r.ev) f.push('see the species evolve');
  if (r.lu < 15) f.push('battle it more times (' + r.lu + '/15)');
  if (!r.sh) f.push('find a shiny ✨');
  return f;
}

/** Evento do jogo. Devolve o nível novo se subiu (pra quem chamou avisar), senão null. */
export function evento(tipo, e = {}){
  if (!io) return null;
  const dex = +(e.dex ?? e.de); if (!dex) return null;
  const antes = nivel(dex);
  const tinha = carregar().esp[dex];
  const antesEstado = classicoDe(tinha && registroVivo(tinha) ? tinha : (tinha == null ? null : comoRegistro(tinha)));
  const shAntes = !!(tinha && typeof tinha === 'object' && tinha.sh);
  const r = reg(dex);
  let dexMudou = false;
  if (tipo === 'visto'){ r.v++; if (e.shiny) r.sh = 1; }
  else if (tipo === 'pego'){
    r.p++; if (e.shiny){ r.sh = 1; r.shp = 1; }   // shp = shiny CAPTURADO (o título/ranking usam este; `sh` = shiny só VISTO, vale pra Pokédex)
    if (e.area != null && !r.ar.includes(e.area)) r.ar.push(e.area);
    if (e.sexo === 'm' || e.sexo === 'f'){ if (!r.sx.includes(e.sexo)) r.sx += e.sexo; }
    else if (!temGenero(dex)) r.sx = SEXO_NENHUM;
  }
  else if (tipo === 'luta') r.lu++;
  else if (tipo === 'golpe'){ if (e.id && !r.gl.includes(e.id)) r.gl.push(e.id); else if (!e.id) return null; }
  else if (tipo === 'evoluiu'){
    r.ev = 1;
    if (e.para){
      const para = +e.para, cru = carregar().esp[para];
      const antesPara = classicoDe(cru == null ? null : (registroVivo(cru) ? cru : comoRegistro(cru)));
      const r2 = reg(para); r2.v = Math.max(r2.v, 1);
      if (classicoDe(r2) !== antesPara){ publicarDex(para); dexMudou = true; }
    }
  }
  else return null;
  salvar();
  const depoisEstado = classicoDe(r);
  if (depoisEstado && depoisEstado !== antesEstado) publicarDex(dex);
  if (dexMudou || depoisEstado !== antesEstado || (!!r.sh && !shAntes)) io.mudou?.();
  const depois = nivel(dex);
  if (depois > antes){
    const S = io.porDex?.get(dex);
    io.avisar?.(`📖 ${S?.name || '#' + dex}: knowledge level ${depois} (${NIVEIS[depois]})${depois < 5 ? ' — ' + (['', 'the entry shows types and habitat', 'reveals stats, height and weight', 'reveals catch rate and abilities', 'reveals gender, full learnset and hidden ability'][depois] || '') : ' — you know EVERYTHING about the species!'}`);
  }
  conferirTitulos();
  return depois > antes ? depois : null;
}

/** Placar do próprio jogador (Kanto = até 151 por padrão). */
export function resumo(kantoAte = 151){
  const d = carregar(); let vistos = 0, pegos = 0, pegosKanto = 0, vistosKanto = 0, shinies = 0, mestres = 0, estudadas = 0, pontosTotal = 0;
  for (const k of Object.keys(d.esp)){
    const r = reg(k);
    const dex = +k, n = nivel(dex); pontosTotal += pontos(dex);
    if (r.v || r.p){ vistos++; if (dex <= kantoAte) vistosKanto++; }
    if (r.p){ pegos++; if (dex <= kantoAte) pegosKanto++; }
    if (r.shp) shinies++;   // shinies = espécies CAPTURADAS em shiny (12/09; era `sh && p` = viu shiny + pegou a espécie, dava o título sem capturar shiny)
    if (n >= 5) mestres++; if (n >= 3) estudadas++;
  }
  const alfa = !!(io && io.alfa && io.alfa());                             // Alpha Tester (12/09): vem da conta, não da coleção
  return { vistos, pegos, vistosKanto, pegosKanto, kantoAte, shinies, mestres, estudadas, pontosTotal, alfa, titulos: d.titulos.slice(), tituloAtual: tituloAtual() };
}
export function tituloAtual(){ const d = carregar(); const t = TITULOS.filter(x => d.titulos.includes(x.id)); return t.length ? t[t.length - 1].nome : ''; }
export function listaTitulos(){ const d = carregar(); const r = resumo(); return TITULOS.map(t => ({ ...t, tem: d.titulos.includes(t.id), ok: !!t.cond(r) })); }
function conferirTitulos(){
  const d = carregar(), r = resumo(); let novo = false;
  for (const t of TITULOS){
    if (d.titulos.includes(t.id) || !t.cond(r)) continue;
    d.titulos.push(t.id); novo = true;
    io.avisar?.(`🏅 Title earned: ${t.nome} (${t.desc})${t.premio ? ' — got ' + t.premio[1] + '× ' + (io.nomeItem?.(t.premio[0]) || 'item') : ''}`);
    if (t.premio) io.premiar?.(t.premio[0], t.premio[1], t.id);   // o id do título vai junto: com conta é o SERVIDOR que paga (uma vez cada)
  }
  /* Auto-correção (12/09): tira título que não é mais merecido — as condições são de coleção e não regridem, então o único caso é
     um título dado por uma regra antiga com bug (o "Caçador de Shiny" saía por VER um shiny; agora só por CAPTURAR). Nunca paga
     de novo ao reganhar (o servidor guarda quem já recebeu o prêmio). */
  const tirar = d.titulos.filter(id => { if (id === 'alphaTester') return false; const t = TITULOS.find(x => x.id === id); return t && !t.cond(r); });   // 14/09: a marca do alpha nunca sai por auto-correção (vem da conta; se o flag ainda não chegou, não é motivo pra tirar)
  if (tirar.length){ d.titulos = d.titulos.filter(id => !tirar.includes(id)); novo = true; }
  if (novo){ salvar(); io.titulo?.(tituloAtual()); }
}
/** Sorteia o sexo de um indivíduo pela razão ♂ da espécie ('m' | 'f' | '-'). */
export function sortearSexo(dex){ const m = io?.sexos?.[dex]; if (m == null) return Math.random() < 0.5 ? 'm' : 'f'; if (m < 0) return SEXO_NENHUM; return Math.random() * 100 < m ? 'm' : 'f'; }
export const simboloSexo = s => s === 'm' ? '♂' : s === 'f' ? '♀' : '';
/** Compatibilidade com a Pokédex antiga (LS `dex`: 'visto' | 'pego'). */
export function estadoAntigo(){ const d = carregar(), out = {}; for (const k of Object.keys(d.esp)){ const r = reg(k); if (r.p) out[k] = 'pego'; else if (r.v) out[k] = 'visto'; } return out; }
/** Own a Pokémon (starter, trade, gift, evolution). First time only — does not farm catch points. */
export function possuir(e = {}){
  if (!io) return null;
  const dex = +(e.dex ?? 0); if (!dex) return null;
  const r = reg(dex);
  if (e.shiny){ r.sh = 1; r.shp = 1; }
  if (e.sexo === 'm' || e.sexo === 'f'){ if (!r.sx.includes(e.sexo)) r.sx += e.sexo; }
  else if (!temGenero(dex) && !r.sx) r.sx = SEXO_NENHUM;
  if (r.p > 0){ salvar(); publicarDex(dex); return null; }
  return evento('pego', e);
}
function unir(a, b, cap, map){
  const out = [], visto = new Set();
  for (const x of [...(a || []), ...(b || [])]){
    const v = map(x);
    if (v == null || v === '' || visto.has(v)) continue;
    visto.add(v); out.push(v);
    if (out.length >= cap) break;
  }
  return out;
}
function fundirRegistro(a, b){
  const A = comoRegistro(a), B = comoRegistro(b), r = vazio();
  r.v = Math.max(A.v, B.v); r.p = Math.max(A.p, B.p); r.lu = Math.max(A.lu, B.lu);
  r.ev = A.ev || B.ev ? 1 : 0; r.sh = A.sh || B.sh ? 1 : 0; r.shp = A.shp || B.shp ? 1 : 0;
  r.ar = unir(A.ar, B.ar, 8, x => { const n = +x; return Number.isFinite(n) ? n : null; });
  r.gl = unir(A.gl, B.gl, 24, x => { const s = String(x || '').slice(0, 40); return s || null; });
  r.sx = [...new Set([...(A.sx || ''), ...(B.sx || '')].filter(c => c === 'm' || c === 'f' || c === '-'))].slice(0, 3).join('');
  return r;
}
const registroVazio = r => !r.v && !r.p && !r.lu && !r.ev && !r.sh && !r.shp && !r.ar.length && !r.gl.length && !r.sx;
/** Monotonic merge of the rich per-species record. A legacy level number upgrades; an object is never coerced to 0. */
export function fundirSave(atual, novo){
  const base = (atual && typeof atual === 'object') ? atual : { esp: {}, titulos: [], v: 1 };
  const srcA = (base.esp && typeof base.esp === 'object') ? base.esp : {};
  const srcB = (novo && typeof novo === 'object' && novo.esp && typeof novo.esp === 'object') ? novo.esp : {};
  const esp = {};
  for (const k of new Set([...Object.keys(srcA), ...Object.keys(srcB)])){
    if (!/^\d+$/.test(k)) continue;
    const merged = fundirRegistro(srcA[k], srcB[k]);
    if (!registroVazio(merged)) esp[k] = merged;
  }
  const titulos = Array.isArray(base.titulos) ? base.titulos.slice() : [];
  if (novo && Array.isArray(novo.titulos))
    for (const t of novo.titulos){ const s = String(t).slice(0, 60); if (s && !titulos.includes(s) && titulos.length < 300) titulos.push(s); }
  return { esp, titulos, v: Math.max(1, Math.round(+(base.v || novo?.v) || 1)) };
}
/** Page-hide used to nest `{ dex, conhecimento }` inside `conhecimento`. Either shape is a save. */
export function pacoteConhecimento(msg){
  const m = msg || {};
  const inner = m.conhecimento;
  const aninhado = !!(inner && typeof inner === 'object' && !inner.esp && (inner.conhecimento !== undefined || inner.dex !== undefined));
  if (aninhado) return { dex: m.dex !== undefined ? m.dex : inner.dex, conhecimento: inner.conhecimento };
  return { dex: m.dex, conhecimento: m.conhecimento };
}
export function possuirLista(lista){
  if (!io || !lista) return;
  for (const p of lista) if (p?.dex) possuir(p);
}
export function tudo(){ return carregar(); }
