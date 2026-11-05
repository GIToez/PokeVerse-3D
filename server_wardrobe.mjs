/* WARDROBE on the server: who owns which outfit, bag, chest effect and trail, and the catalog the game reads.
 *
 * Catalog: public/data/catalogo_loja.json (admin panel → Data files → Shop catalog) { bases, pecas: [{ tipo, id, nome, icone,
 *   qualidade, sexo, glb, origens, exclusiva, aparece, ponto, preco, estacao, liberada }] }. Effects art: public/data/catalogo_efeitos.json.
 * Ownership lives in the save (the same keys the client syncs):
 *   save.skins = [outfit ids]           save.pecas = { mochila: [bag ids], peito: [effect ids], rastro: [effect ids] }
 *   worn: save.skin (outfit, null = the base character), save.mochila, save.peito, save.rastro
 * Older saves kept `save.cosmeticos { roupas, mochilas, efeitos }`; they are moved over the first time the account is touched.
 *
 *   GET /loja/catalogo?l=en   → { v, versao, lingua, equipe, bases, pecas: [... + chave, tem, aVenda, liberada], efeitos } */
import fs from 'node:fs';
import nodePath from 'node:path';
import { estacaoAgora } from './calendar.mjs';

export const KINDS = ['roupa', 'mochila', 'peito', 'rastro'];
const EFFECT_KINDS = new Set(['peito', 'rastro']);
/** The game's season today (calendar.mjs), which seasonal outfits (`estacao`) follow. */
export const seasonNow = () => estacaoAgora();
const normId = (tipo, id) => (EFFECT_KINDS.has(tipo) ? (Number.isSafeInteger(+id) && +id > 0 ? +id : null) : (typeof id === 'string' && /^[\w-]{1,40}$/.test(id) ? id : null));

export function createWardrobe({ dataDir }) {
  const readCached = (file) => {
    let cache = null, mt = -1;
    return () => {
      const p = nodePath.join(dataDir, file);
      try {
        const st = fs.statSync(p);
        if (st.mtimeMs !== mt) { cache = JSON.parse(fs.readFileSync(p, 'utf8')); mt = st.mtimeMs; }
      } catch (e) { if (!cache) console.warn('wardrobe: ' + file, e.message); }
      return { data: cache, mtime: mt };
    };
  };
  const catalogFile = readCached('catalogo_loja.json'), effectsFile = readCached('catalogo_efeitos.json');
  const catalog = () => { const d = catalogFile().data || {}; return { bases: Array.isArray(d.bases) ? d.bases : [], pecas: Array.isArray(d.pecas) ? d.pecas : [] }; };
  const piece = (tipo, id) => catalog().pecas.find(p => p.tipo === tipo && String(p.id) === String(id)) || null;
  const isBase = id => catalog().bases.some(b => b.tipo === id);

  /** The ownership lists on a save (creates them; moves an old `cosmeticos` block over). */
  function owned(save) {
    if (!Array.isArray(save.skins)) save.skins = [];
    if (!save.pecas || typeof save.pecas !== 'object' || Array.isArray(save.pecas)) save.pecas = {};
    for (const k of ['mochila', 'peito', 'rastro']) if (!Array.isArray(save.pecas[k])) save.pecas[k] = [];
    const old = save.cosmeticos;
    if (old && typeof old === 'object') {
      for (const id of Array.isArray(old.roupas) ? old.roupas : []) if (typeof id === 'string' && !save.skins.includes(id)) save.skins.push(id);
      for (const id of Array.isArray(old.mochilas) ? old.mochilas : []) if (typeof id === 'string' && !save.pecas.mochila.includes(id)) save.pecas.mochila.push(id);
      delete save.cosmeticos;   // the old effect ids (1–10) belonged to the retired drawn auras, so they are not carried over
    }
    return { roupa: save.skins, mochila: save.pecas.mochila, peito: save.pecas.peito, rastro: save.pecas.rastro };
  }
  /** GM accounts own everything (read live: nothing is written into the save, so taking GM away takes it back). */
  const isGm = c => !!(c && (c.gm || c.cargo === 'staff'));
  const has = (save, tipo, id, c = null) => isGm(c) || (tipo === 'roupa' && isBase(id)) || owned(save)[tipo]?.some(x => String(x) === String(id));
  /** Gives one piece (any source: shop, pass, mail, achievement). Returns true when it was new. */
  function give(save, tipo, id) {
    const n = normId(tipo, id);
    if (n == null || !KINDS.includes(tipo)) return false;
    const L = owned(save)[tipo];
    if (L.some(x => String(x) === String(n))) return false;
    L.push(n);
    return true;
  }
  /** On sale now: from the shop (origens has 'loja'), with a price, released, and in season. */
  function forSale(p, season = seasonNow()) {
    return !!p && Array.isArray(p.origens) && p.origens.includes('loja') && +p.preco > 0 && p.liberada !== false && (!p.estacao || p.estacao === season);
  }
  const saleList = () => { const s = seasonNow(); return catalog().pecas.filter(p => forSale(p, s)); };

  /** GET /loja/catalogo for one account (or a visitor: nothing owned). */
  function catalogFor(c, lang = 'en') {
    const C = catalog(), save = c?.save || null, s = seasonNow();
    const pecas = C.pecas.map(p => ({
      chave: p.tipo + ':' + p.id, tipo: p.tipo, id: p.id, nome: p.nome || String(p.id), icone: p.icone || null, qualidade: p.qualidade ?? null,
      sexo: p.sexo || null, glb: p.glb || null, origem: (p.origens || [])[0] || null, origens: p.origens || [], exclusiva: p.exclusiva || null,
      aparece: p.aparece || null, ponto: p.ponto || null, preco: forSale(p, s) ? +p.preco : null, aVenda: forSale(p, s),
      tem: save ? has(save, p.tipo, p.id, c) : false, liberada: p.liberada !== false, ...(p.estacao ? { estacao: p.estacao } : {}),
    }));
    return { v: 1, versao: Math.round(catalogFile().mtime), lingua: lang, equipe: !!(c?.gm || c?.cargo), bases: C.bases, pecas, efeitos: effectsFile().data || null };
  }
  return { catalog, piece, owned, has, isGm, give, forSale, saleList, catalogFor, isBase, seasonNow };
}
