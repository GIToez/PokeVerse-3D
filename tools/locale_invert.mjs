/* Generates public/data/locale/{ui,conteudo,nomes}_pt.json (keyed by English) from the matching *_en.json files (keyed by
 * the old Portuguese text). Usage: node tools/locale_invert.mjs
 *
 * English is the source language: code and layout text are being rewritten in English, and the Portuguese dictionaries
 * translate that English back. Re-run this after editing any *_en.json. When two Portuguese keys share one English value
 * ("Entrar" / "Login" → "Log in"), the first one in the file wins. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public/data/locale');

for (const nome of ['ui', 'content', 'names']) {
  const en = JSON.parse(fs.readFileSync(path.join(DIR, nome + '_en.json'), 'utf8'));
  const pt = {};
  for (const [k, v] of Object.entries(en)) {
    if (typeof v !== 'string' || !v.trim() || k.startsWith('_')) continue;
    if (v === k || v in pt) continue;
    pt[v] = k;
  }
  fs.writeFileSync(path.join(DIR, nome + '_pt.json'), JSON.stringify(pt, null, 2) + '\n');
  console.log(nome + '_pt.json', Object.keys(pt).length);
}
