/* BAG OPERATIONS the server owns (Nov 2). The client already asked for these (`bolsa_comprar`, `bolsa_usar`, …) but only
   `missao` and `ginasioreset` had code: everything else got the old bag back. With an account that meant the Pokémart
   took no money and gave nothing, and a Potion healed on screen while the server kept the old HP and the old count (the
   next bag snapshot put the Potion back). Here the server checks and applies each one and answers with the new bag and,
   when a Pokémon changed, its new HP / held item (`vidas`, which network.mjs already applies).

   comprar  { loja, item, n }   price and badges from the shop data (+ item_rules ESTOQUE_EXTRA)
   usar     { item, uid }       medicine on that Pokémon (HP, revive, PP, EV items)
   descartar{ item, n }
   segurar  { item, uid }       give a held item (held.mjs); what it held goes back to the bag
   tirar    { uid }             take the held item back
   consumir { uid, item }       the battle used it up (Focus Sash, gems)
   coleta   { ponto }           a Tera crystal on the map (cfg@x,z): one Normal Tera Shard, then that spot waits 2 min
   premio   { titulo }          a knowledge title's reward (knowledge.mjs TITULOS), paid once, only if the account's own
                                Pokédex (marked by the server on every catch) meets the title */
import fs from 'node:fs';
import nodePath from 'node:path';
import { Held } from './held.mjs';
import * as Regras from './item_rules.mjs';
import * as Ev from './ev.mjs';
import { maxHpOf } from './server_hp.mjs';
import { TITULOS } from './knowledge.mjs';

const FRAGMENTO_TERA = 50112, COLETA_ESPERA_MS = 120000;                  // the same item and wait as the client (index.html falarCom, tipoNpc 9)

export function criarBolsa({ dadosPub, salvar, bloquearCura = () => false }) {
  const lerJson = (() => {
    const cache = new Map();
    return arq => {
      const caminho = nodePath.join(dadosPub, arq);
      try {
        const mt = fs.statSync(caminho).mtimeMs, c = cache.get(arq);
        if (c && c.mt === mt) return c.dados;
        const dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
        cache.set(arq, { mt, dados });
        return dados;
      } catch { return null; }
    };
  })();
  let held = null, heldDados = null, uidAtual = null;                     // held.mjs cuts the uid to 12 chars; ours have 17, so it gets the full one of this op
  const motorHeld = () => {
    const d = lerJson('held.json');
    if (d && d !== heldDados) { heldDados = d; try { held = new Held(d, { bolsa: BOLSA, ficha: (c, u12) => String(uidAtual ?? '').slice(0, 12) === u12 ? monDe(c, uidAtual) : null }); } catch (e) { console.warn('[bolsa] held.json:', e.message); held = null; } }
    return held;
  };
  const menu = () => lerJson('menu_data.json') || {};
  const itemInfo = id => menu().itens?.[String(id)] || null;

  const saveDe = c => { if (!c.save) c.save = {}; const s = c.save; if (!s.itens || typeof s.itens !== 'object') s.itens = {}; if (!s.bolas || typeof s.bolas !== 'object') s.bolas = {}; return s; };
  const ehBola = id => itemInfo(id)?.t === 7;
  const cofre = (c, id) => ehBola(id) ? saveDe(c).bolas : saveDe(c).itens;
  const quantos = (c, id) => Math.max(0, Math.floor(+cofre(c, id)[String(id)] || 0));
  const por = (c, id, n) => { const k = cofre(c, id); k[String(id)] = quantos(c, id) + n; return true; };
  const tirar = (c, id, n) => { if (quantos(c, id) < n) return false; const k = cofre(c, id), v = quantos(c, id) - n; if (v > 0) k[String(id)] = v; else delete k[String(id)]; return true; };
  /* held.mjs talks to the bag through this: items given from the bag are account-bound (`preso`), there is no tradable stack yet. */
  const BOLSA = {
    quantos: (c, id, { preso } = {}) => preso === false ? 0 : quantos(c, id),
    tirar: (c, id, n, { preso } = {}) => preso !== false && tirar(c, id, n),
    por: (c, id, n) => por(c, id, n),
  };
  function monDe(c, uid) {
    if (uid == null) return null;
    const s = saveDe(c);
    for (const lista of [s.time, s.caixa]) for (const p of Array.isArray(lista) ? lista : []) if (p && String(p.uid) === String(uid)) return p;
    return null;
  }
  const retrato = c => { const s = saveDe(c); return { dinheiro: s.dinheiro ?? 0, bolas: s.bolas, itens: s.itens, insignias: s.insignias || [] }; };
  const vida = p => ({ uid: p.uid, hp: p.hp, maxHp: p.maxHp, amizade: p.amizade, held: p.held ?? null, ...(p.movs ? { movs: p.movs } : {}), ...(p.evs ? { evs: p.evs } : {}) });
  const tocarAmizade = (p, id) => {
    const d = Regras.amizadeDe(id);
    if (!d) return;
    const base = Number.isFinite(+p.amizade) ? +p.amizade : 70;
    p.amizade = Math.max(0, Math.min(255, base + d));
  };
  const maxDe = p => maxHpOf(p) || p.maxHp || 1;
  const reviver = (p, frac) => { const max = maxDe(p); p.hp = Math.max(1, Math.ceil(max * frac)); p.maxHp = max; };
  const erro = (c, texto) => ({ erro: texto, bolsa: retrato(c) });       // the snapshot undoes what the client already took off locally
  const pronto = (c, extra = {}) => { c.rev = (c.rev || 0) + 1; salvar(); return { bolsa: retrato(c), ...extra }; };

  function comprar(c, m) {
    const n = Math.max(1, Math.min(99, Math.floor(+m.n || 1)));
    const nIns = (saveDe(c).insignias || []).length;
    const r = Regras.linhaDaLoja(menu().lojas, String(m.loja), m.item, nIns);
    if (!r) return erro(c, 'that shop does not sell this item');
    if (!r.liberado) return erro(c, 'this item unlocks with ' + r.linha.insignias + ' badge' + (r.linha.insignias === 1 ? '' : 's'));
    if (+r.linha.moeda !== 1) return erro(c, 'this item is not sold for Coins');
    const custo = Math.max(0, Math.floor(+r.linha.preco || 0)) * n, s = saveDe(c);
    if ((s.dinheiro || 0) < custo) return erro(c, 'not enough Coins');
    s.dinheiro = (s.dinheiro || 0) - custo;
    por(c, r.linha.item, (Math.max(1, +r.linha.n || 1)) * n);
    return pronto(c);
  }

  function usar(c, m, u) {
    const id = +m.item;
    if (!itemInfo(id)) return erro(c, 'unknown item');
    if (quantos(c, id) < 1) return erro(c, "you don't have that item");
    const time = Array.isArray(saveDe(c).time) ? saveDe(c).time : [];
    if ((Regras.ehCura(id) || Regras.ehReanima(id) || Regras.ehReanimaTime(id) || Regras.PP[id]) && bloquearCura(u)) return erro(c, 'no healing in the Elite Four: the five fights are one run');
    if (Regras.ehReanimaTime(id)) {
      const caidos = time.filter(p => p && +p.hp === 0);
      if (!caidos.length) return erro(c, 'nobody is fainted');
      for (const p of caidos) { reviver(p, Regras.REANIMA_TIME[id]); tocarAmizade(p, id); }
      tirar(c, id, 1);
      return pronto(c, { vidas: caidos.map(vida) });
    }
    const p = monDe(c, m.uid) || time[0];
    if (!p) return erro(c, 'no Pokémon to use it on');
    const max = maxDe(p);
    const hp = Number.isFinite(+p.hp) ? +p.hp : max;
    if (Regras.ehReanima(id)) {
      if (hp > 0) return erro(c, p.nome + ' is not fainted');
      reviver(p, Regras.REANIMA[id]);
    } else if (Regras.ehCura(id)) {
      if (hp <= 0) return erro(c, p.nome + ' is fainted: use a Revive');
      if (hp >= max) return erro(c, p.nome + "'s HP is already full");
      p.hp = Math.min(max, hp + Regras.CURA[id]); p.maxHp = max;
    } else if (Regras.PP[id]) {
      const R = Regras.PP[id], movs = (p.movs || []).filter(x => x && x.id);
      const cheio = x => (x.pp || 0) >= (x.ppMax ?? x.pp ?? 0);
      const alvos = R.todos ? movs : movs.filter(x => !cheio(x)).sort((a, b) => (a.pp || 0) - (b.pp || 0)).slice(0, 1);
      if (!alvos.length || alvos.every(cheio)) return erro(c, 'PP is already full');
      for (const x of alvos) { const top = x.ppMax ?? x.pp ?? 0; x.pp = R.pp === 'cheio' ? top : Math.min(top, (x.pp || 0) + R.pp); }
    } else if (Ev.itemDe(id)) {
      const r = Ev.usarItem(p, id);
      if (!r.ok) return erro(c, p.nome + ': ' + r.motivo);
      const novo = maxHpOf(p); if (novo) { p.hp = Math.min(novo, hp + Math.max(0, novo - (p.maxHp || novo))); p.maxHp = novo; }
    } else return erro(c, "this item can't be used here");
    tocarAmizade(p, id);
    tirar(c, id, 1);
    return pronto(c, { vidas: [vida(p)] });
  }

  function descartar(c, m) {
    const id = +m.item, info = itemInfo(id);
    if (!info || info.t === 3 || info.t === 7) return erro(c, "that item can't be thrown away");
    const n = Math.max(1, Math.min(quantos(c, id), Math.floor(+m.n || 1)));
    if (!tirar(c, id, n)) return erro(c, "you don't have that item");
    return pronto(c);
  }

  function segurar(c, m) {
    const H = motorHeld(); if (!H) return erro(c, 'held items are not set up on this server');
    uidAtual = m.uid; const r = H.equiparNaConta(c, m.uid, m.item, { trocar: true }); uidAtual = null;
    if (!r.ok) return erro(c, r.motivo);
    return pronto(c, { vidas: [vida(monDe(c, m.uid))] });
  }
  function tirarHeld(c, m) {
    const H = motorHeld(); if (!H) return erro(c, 'held items are not set up on this server');
    uidAtual = m.uid; const r = H.desequiparNaConta(c, m.uid); uidAtual = null;
    if (!r.ok) return erro(c, r.motivo);
    return pronto(c, { vidas: [vida(monDe(c, m.uid))] });
  }
  /* Consumed in battle: the client reports it, the server only clears an item that really is consumable and really is there. */
  function consumir(c, m) {
    const H = motorHeld(), p = monDe(c, m.uid);
    const h = p?.held && typeof p.held === 'object' ? p.held : null;
    const ef = H?.efeito(m.item)?.efeito;
    if (!p || !h || +h.id !== +m.item || !(ef?.consome)) return erro(c, 'nothing to use up');
    p.held = null;
    return pronto(c, { vidas: [vida(p)] });
  }

  function coleta(c, m) {
    const ponto = String(m.ponto ?? '');
    if (!/^\d{1,9}@-?\d{1,6},-?\d{1,6}$/.test(ponto)) return erro(c, 'invalid crystal spot');
    const s = saveDe(c), agora = Date.now();
    if (!s.coletas || typeof s.coletas !== 'object' || Array.isArray(s.coletas)) s.coletas = {};
    for (const [k, ate] of Object.entries(s.coletas)) if (!(+ate > agora)) delete s.coletas[k];   // expired spots: the list stays small
    if (+s.coletas[ponto] > agora) return erro(c, "that crystal hasn't grown back yet");
    s.coletas[ponto] = agora + COLETA_ESPERA_MS;
    por(c, FRAGMENTO_TERA, 1);
    return pronto(c);
  }
  function premio(c, m) {
    const t = TITULOS.find(x => x.id === String(m.titulo ?? '') && Array.isArray(x.premio));
    if (!t) return erro(c, 'that title has no reward');
    const s = saveDe(c);
    if (!Array.isArray(s.titulosPagos)) s.titulosPagos = [];
    if (s.titulosPagos.includes(t.id)) return { bolsa: retrato(c), jaPago: true };   // already paid (a reset of the device's Pokédex asks again): nothing, quietly
    const pegos = new Set();
    for (const [k, v] of Object.entries(s.dex && typeof s.dex === 'object' ? s.dex : {})) if (v === 'pego' || v === 'caught') pegos.add(+k);
    for (const p of [...(s.time || []), ...(s.caixa || [])]) if (p?.dex != null) pegos.add(+p.dex);
    const r = { pegos: pegos.size, pegosKanto: [...pegos].filter(d => d >= 1 && d <= 151).length, kantoAte: 151 };
    if (!t.cond(r)) return erro(c, t.nome + ': not earned yet (' + t.desc + ')');
    const [id, n] = t.premio;
    if (!itemInfo(id)) return erro(c, 'unknown reward item');
    por(c, id, Math.max(1, Math.floor(+n || 1)));
    s.titulosPagos.push(t.id);
    return pronto(c);
  }

  const OPS = { comprar, usar, descartar, segurar, tirar: tirarHeld, consumir, coleta, premio };
  return {
    /** Handles the op, or returns null when it isn't one of these. */
    tratar(c, op, m, u) { const f = OPS[op]; return f && c ? f(c, m, u) : null; },
    motorHeld,
  };
}
