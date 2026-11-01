/* Rewrites the display text of ONE JSON file from Portuguese to English, using the exact entries of
 * public/data/locale/ui_en.json (plus nomes_en/conteudo_en). Only the listed fields are touched; ids, tags and paths stay.
 * Usage: node tools/locale_english_source.mjs <file.json> [field,field…]   (default fields: texto,exemplo)
 *
 * Text with no exact dictionary entry is left in Portuguese and listed at the end, so it can be added to ui_en.json and the
 * tool re-run. Run tools/locale_invert.mjs afterwards so the Portuguese dictionary covers the new English text.
 * Keeps the file's indentation (detected from the first indented line). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOC = path.join(RAIZ, 'public/data/locale');
const [arquivo, campos = 'texto,exemplo'] = process.argv.slice(2);
if (!arquivo) { console.error('usage: node tools/locale_english_source.mjs <file.json> [fields]'); process.exit(1); }
const CAMPOS = new Set(campos.split(','));

const dic = {};
for (const n of ['nomes', 'conteudo', 'ui']) Object.assign(dic, JSON.parse(fs.readFileSync(path.join(LOC, n + '_en.json'), 'utf8')));

const alvo = path.resolve(arquivo);
const bruto = fs.readFileSync(alvo, 'utf8');
const recuo = /\n/.test(bruto.trimEnd()) ? (/\n( +)"/.exec(bruto) || [, '  '])[1].length : 0;   // 0 = the file is one line: keep it compact
const final = bruto.endsWith('\n') ? '\n' : '';
let trocados = 0;
const faltam = new Map();

const INGLES = new Set(Object.values(dic));
function trocar(s) {
  const k = s.trim();
  if (INGLES.has(k)) return s;   // already English ("time" = playtime would otherwise become the Portuguese "time" = team)
  const v = dic[k];
  if (typeof v !== 'string' || /\{\w+\}/.test(k)) { if (/[A-Za-zÀ-ú]/.test(k)) faltam.set(k, (faltam.get(k) || 0) + 1); return s; }
  if (v === k) return s;
  trocados++;
  return k === s ? v : s.replace(k, v);
}
function andar(o) {
  if (Array.isArray(o)) { o.forEach(andar); return; }
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && CAMPOS.has(k) && !/\.(png|webp|jpe?g|svg|glb)$/i.test(v)) o[k] = trocar(v);
    else if (Array.isArray(v) && CAMPOS.has(k) && v.every(s => typeof s === 'string')) o[k] = v.map(trocar);   // e.g. NPC "falas": ["line", …]
    else andar(v);
  }
}
const obj = JSON.parse(bruto);
andar(obj);
fs.writeFileSync(alvo, JSON.stringify(obj, null, recuo) + final);
console.log(path.relative(RAIZ, alvo) + ': ' + trocados + ' strings rewritten in English, ' + faltam.size + ' unique strings without a dictionary entry');
for (const [k, n] of [...faltam].sort((a, b) => b[1] - a[1])) console.log('  ' + JSON.stringify(k) + (n > 1 ? '  x' + n : ''));
