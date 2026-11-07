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
                                Pokédex (marked by the server on every catch) meets the title
   cosmetico{ tipo, id }        wardrobe / cosmetics shop (data/cosmeticos.json): buy an outfit or an effect for Coins, or
                                claim an Elite Four outfit. Coins only — there are no real-money payments in this game.
   validarPersonagem(c, p)      the server only stores and relays an outfit/effects the account owns (the client sent
                                any `personagem` before and the server passed it on) */
import fs from 'node:fs';
import nodePath from 'node:path';
import { Held } from './held.mjs';
import * as Regras from './item_rules.mjs';
import * as Ev from './ev.mjs';
import * as Status from './status.mjs';
import { maxHpOf } from './server_hp.mjs';
import { TITULOS } from './knowledge.mjs';
import * as Safari from './safari_rules.mjs';
import * as Tm from './tm.mjs';

const FRAGMENTO_TERA = 50112, COLETA_ESPERA_MS = 120000;                  // the same item and wait as the client (index.html falarCom, tipoNpc 9)

export function criarBolsa({ dadosPub, salvar, bloquearCura = () => false, eliteVencida = () => false, guarda }) {
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
  const novos = () => lerJson('itens_novos.json')?.itens || {};          // the new items (900001+): Medallions, the Premium Daily Pass, Rare Candy…
  const itemInfo = id => menu().itens?.[String(id)] || novos()[String(id)] || null;

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
  const retrato = c => { const s = saveDe(c); return { dinheiro: s.dinheiro ?? 0, bolas: s.bolas, itens: s.itens, insignias: s.insignias || [], safari: s.safari || null, ...(guarda ? (guarda.owned(s), { skins: [...s.skins], pecas: { mochila: [...s.pecas.mochila], peito: [...s.pecas.peito], rastro: [...s.pecas.rastro] } }) : {}) }; };
  const vida = p => ({ uid: p.uid, hp: p.hp, maxHp: p.maxHp, amizade: p.amizade, held: p.held ?? null, status: Status.exportar(p.status), ...(p.movs ? { movs: p.movs } : {}), ...(p.evs ? { evs: p.evs } : {}) });
  const tocarAmizade = (p, id) => {
    const d = Regras.amizadeDe(id);
    if (!d) return;
    const base = Number.isFinite(+p.amizade) ? +p.amizade : 70;
    p.amizade = Math.max(0, Math.min(255, base + d));
  };
  const maxDe = p => maxHpOf(p) || p.maxHp || 1;
  const reviver = (p, frac) => { const max = maxDe(p); p.hp = Math.max(1, Math.ceil(max * frac)); p.maxHp = max; p.status = null; };
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
    const uso = itemInfo(id)?.uso;
    if (uso && (uso.tipo === 'medalhao' || uso.tipo === 'passeDiario')) {    // account time: the Medallion adds 30 days up to 90 (Terms 7.2), the Premium Daily Pass up to 365
      const s = saveDe(c), campo = uso.tipo === 'medalhao' ? 'medalhaoAte' : 'passeDiarioAte', agora = Date.now(), maxDias = uso.tipo === 'medalhao' ? 90 : 365, teto = agora + maxDias * 86400e3;
      const base = Math.max(agora, +s[campo] || 0), dias = Math.max(1, +uso.dias || 30);
      if (uso.tipo === 'medalhao' && base + dias * 86400e3 > teto + 3600e3) return erro(c, `your Medallion time can't go past ${maxDias} days: use this one when you have ${maxDias - dias} days or less left`);
      if (base + 86400e3 > teto) return erro(c, `you already have the most time allowed (${maxDias} days)`);
      s[campo] = Math.min(teto, base + Math.max(1, +uso.dias || 30) * 86400e3);
      tirar(c, id, 1);
      return pronto(c, uso.tipo === 'medalhao' ? { medalhao: { ate: s[campo] } } : { passeDiario: { ate: s[campo] } });
    }
    const time = Array.isArray(saveDe(c).time) ? saveDe(c).time : [];
    if ((Regras.ehCura(id) || Regras.curaStatus(id) || Regras.ehReanima(id) || Regras.ehReanimaTime(id) || Regras.PP[id]) && bloquearCura(u)) return erro(c, 'no healing in the Elite Four: the five fights are one run');
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
    } else if (Regras.ehCura(id) || Regras.curaStatus(id)) {
      if (hp <= 0) return erro(c, p.nome + ' is fainted: use a Revive');
      const quais = Regras.statusDe(id);
      const tinha = Status.limpo(p.status);
      const curaEsse = !!(tinha && (quais === null || (Array.isArray(quais) && quais.includes(tinha.id))));
      const querHp = Regras.ehCura(id) && hp < max;
      if (!querHp && !curaEsse) {
        if (Regras.ehCura(id)) return erro(c, p.nome + "'s HP is already full");
        if (!tinha) return erro(c, p.nome + ' has no status to cure');
        return erro(c, p.nome + ' is ' + Status.nome(tinha.id));
      }
      if (querHp) { p.hp = Math.min(max, hp + Regras.CURA[id]); p.maxHp = max; }
      if (curaEsse) Status.curar(p, quais);
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

  /** Retired: outfits, bags and effects are bought in the Diamond shop now (server_shop.mjs + server_wardrobe.mjs). */
  function cosmetico(c) { return erro(c, 'outfits, bags and effects are in the Shop'); }
  /** The `personagem` the client wants to wear: null when its outfit is a catalog outfit the account doesn't own (the stored
      one stays); a bag or effect it doesn't own is dropped. Base characters are not in the catalog's pieces, so they always pass. */
  function validarPersonagem(c, p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return p ?? null;
    if (!guarda) return p;
    const s = saveDe(c);
    if (guarda.piece('roupa', p.tipo) && !guarda.has(s, 'roupa', p.tipo, c) && s.personagem?.tipo !== p.tipo) return null;
    const out = { ...p };
    if (out.efeitos != null) {
      const e = {};
      for (const slot of ['peito', 'rastro']) { const id = +out.efeitos?.[slot]; if (id && guarda.has(s, slot, id, c)) e[slot] = id; }
      out.efeitos = e;
    }
    for (const slot of ['peito', 'rastro']) if (out[slot] != null && !guarda.has(s, slot, out[slot], c)) out[slot] = null;
    if (out.mochila != null && !guarda.has(s, 'mochila', out.mochila, c)) out.mochila = null;
    return out;
  }
  /** One worn piece from the save sync (skin / mochila / peito / rastro): kept only when owned (or a base character). */
  function vestivel(c, key, v) {
    if (v == null || !guarda) return true;
    const tipo = key === 'skin' ? 'roupa' : key;
    return guarda.has(saveDe(c), tipo, v, c);
  }

  /* Safari visit. The client cannot grant itself balls: the fee and the stack live here.
     entrar  { zona, x, z }   500 Coins, 30 Safari Balls, 20 minutes, only next to that zone's warden
     passo   { n }            a clock check while walking in the paid grass (ends with 'tempo' after 20 minutes)
     bola    {}               one Safari Ball thrown
     sair    {}               walk out: leftover balls from this visit are removed
     expulsar{ zona }         no visit, standing in the grass: the answer carries the gate */
  function safariOp(c, m) {
    const s = saveDe(c);
    const acao = String(m.acao || '');
    const zona = +m.zona;
    /* The 20 minutes ran out: whatever the message, the visit ends here (leftover Safari Balls removed, walked to the gate). */
    if (Safari.acabouOTempo(s.safari)) {
      const zonaFim = +s.safari.zona;
      const fim = Safari.encerrar(s.bolas, { ...s.safari, fim: Date.now() + 1000 });
      s.bolas = fim.bolas;
      s.safari = null;
      if (acao !== 'entrar') return pronto(c, { fim: 'tempo', pouso: Safari.pouso(zonaFim, m.x), safari: null, tirou: fim.tirou });
    }
    if (acao === 'entrar') {
      if (!Safari.perto(zona, m.x, m.z)) return erro(c, 'Talk to the warden at the gate.');
      const r = Safari.entrar({ dinheiro: s.dinheiro || 0, bolas: s.bolas, sessao: s.safari, zona });
      if (!r.ok) return erro(c, r.erro);
      s.dinheiro = r.dinheiro;
      s.bolas = r.bolas;
      s.safari = r.sessao;
      return pronto(c, { safari: r.sessao });
    }
    if (acao === 'passo') {
      const r = Safari.passo(s.safari, m.n);
      if (!r.sessao) return erro(c, 'You are not on a Safari visit.');
      if (r.fim === 'passos' || r.fim === 'tempo') {
        const zonaFim = r.sessao.zona;
        const fim = Safari.encerrar(s.bolas, r.sessao);
        s.bolas = fim.bolas;
        s.safari = null;
        return pronto(c, { fim: r.fim, pouso: Safari.pouso(zonaFim, m.x), safari: null, tirou: fim.tirou });
      }
      s.safari = r.sessao;
      return pronto(c, { safari: r.sessao });
    }
    if (acao === 'bola') {
      const tinha = Safari.normalizar(s.safari);
      if (!tinha) return erro(c, 'You are not on a Safari visit.');
      if (!tirar(c, Safari.BOLA, 1)) return erro(c, 'no Safari Ball');
      const r = Safari.jogou(tinha);
      if (r.fim === 'bolas') {
        const fim = Safari.encerrar(s.bolas, r.sessao);
        s.bolas = fim.bolas;
        s.safari = null;
        return pronto(c, { fim: 'bolas', pouso: Safari.pouso(tinha.zona, m.x), safari: null, tirou: fim.tirou });
      }
      s.safari = r.sessao;
      return pronto(c, { safari: r.sessao });
    }
    if (acao === 'sair') {
      const tinha = Safari.normalizar(s.safari);
      if (!tinha) return erro(c, 'You are not on a Safari visit.');
      const fim = Safari.encerrar(s.bolas, tinha);
      s.bolas = fim.bolas;
      s.safari = null;
      return pronto(c, { fim: 'saiu', pouso: Safari.pouso(tinha.zona, m.x), safari: null, tirou: fim.tirou });
    }
    if (acao === 'expulsar') {
      if (Safari.vivo(s.safari)) return pronto(c, { safari: Safari.normalizar(s.safari) });
      if (!Safari.ehZona(zona)) return erro(c, 'There is no Safari Zone here.');
      return pronto(c, { pouso: Safari.pouso(zona, m.x), safari: null });
    }
    return erro(c, 'unknown safari action');
  }

  let tmCache = null;
  function catalogoTm(){
    const beta = lerJson('tm_beta.json');
    const learn = lerJson('biblioteca/candidatos/learnset_tm_beta.json');
    const regras = lerJson('tm_regras.json');
    const moves = lerJson('moves.json');
    if (tmCache && tmCache.beta === beta && tmCache.learn === learn && tmCache.regras === regras && tmCache.moves === moves) return tmCache.cat;
    const cat = Tm.catalogo({ beta, learnset: learn, regras, golpe: id => moves?.[id] || null });
    tmCache = { beta, learn, regras, moves, cat };
    return cat;
  }
  /* Celadon Department Store 2F. Coins, badge gate, learnset. The reply's vidas carry the new moves. */
  function tmOp(c, m){
    const cat = catalogoTm();
    if (!cat) return erro(c, 'The TM counter is not available.');
    const chave = String(m.chave || '');
    const entrada = m.tutor ? cat.tutor.get(chave) : cat.porChave.get(chave);
    if (!entrada) return erro(c, 'That move is not taught here.');
    const p = monDe(c, m.uid);
    if (!p) return erro(c, 'That Pokémon is not in your party or box.');
    const apr = Tm.podeAprender(cat, p, entrada);
    if (!apr.ok) return erro(c, apr.erro);
    const s = saveDe(c);
    const cob = Tm.cobrar(entrada, { insignias: s.insignias || [], dinheiro: s.dinheiro || 0 });
    if (!cob.ok) return erro(c, cob.erro);
    const fez = Tm.aplicar(p, entrada, m.esquecer || null);
    if (!fez.ok) return erro(c, fez.erro);
    s.dinheiro = Math.max(0, (s.dinheiro || 0) - cob.preco);
    return pronto(c, { vidas: [vida(p)], aprendeu: entrada.nome, esqueceu: fez.esqueceu || null });
  }

  /* TM screens from upcoming/ (tm_ui.mjs): {t:'tm_montar', item} builds a TM at the counter from its band's pieces and
     Coins (tm_regras.json montar); {t:'tm_ensinar', item, uid, esquecer?} teaches from a TM in the bag (single use; the badge
     lock is here); {t:'tm_tutor', golpe, uid, esquecer?} the move tutor, for Coins. Reply: {t:'tm', op, ok, erro?, falta?, trava?}
     plus the bag snapshot and the Pokémon (`bolsa`, `vidas`), which the client applies like any bag op. */
  function tmProtocolo(c, m) {
    const op = { tm_montar: 'montar', tm_ensinar: 'ensinar', tm_tutor: 'tutor' }[m.t];
    if (!op) return null;
    const falha = (erro, extra = {}) => ({ tm: { t: 'tm', op, ok: false, erro, ...extra }, bolsa: retrato(c) });
    const cat = catalogoTm(), regras = lerJson('tm_regras.json') || {};
    if (!cat) return falha('The TM counter is not available.');
    const s = saveDe(c);
    if (!s.itens || typeof s.itens !== 'object') s.itens = {};
    const entradaDoItem = item => [...cat.porChave.values()].find(e => +e.item === +item) || null;
    if (op === 'montar') {
      const e = entradaDoItem(m.item);
      if (!e) return falha('That TM is not made here.');
      const receita = regras.montar?.[e.faixa] || {};
      for (const [id, qtd] of Object.entries(receita.pecas || {})) if ((+s.itens[id] || 0) < +qtd) return falha('Missing pieces.', { falta: { item: +id, qtd: +qtd - (+s.itens[id] || 0) } });
      const preco = Math.max(0, Math.floor(+receita.dinheiro || 0));
      if ((s.dinheiro || 0) < preco) return falha('Not enough Coins.', { falta: { dinheiro: preco - (s.dinheiro || 0) } });
      for (const [id, qtd] of Object.entries(receita.pecas || {})) { s.itens[id] -= +qtd; if (s.itens[id] <= 0) delete s.itens[id]; }
      s.dinheiro = (s.dinheiro || 0) - preco;
      s.itens[e.item] = (+s.itens[e.item] || 0) + 1;
      const r = pronto(c);
      return { ...r, tm: { t: 'tm', op, ok: true, item: e.item } };
    }
    const tutor = op === 'tutor';
    const e = tutor ? cat.tutor.get(String(m.golpe || '')) : entradaDoItem(m.item);
    if (!e) return falha(tutor ? 'That move is not taught here.' : 'That TM is not taught here.');
    if (!tutor && !((+s.itens[e.item] || 0) > 0)) return falha("You don't have that TM.", { falta: { item: e.item, qtd: 1 } });
    const p = monDe(c, m.uid);
    if (!p) return falha('That Pokémon is not in your party or box.');
    const apr = Tm.podeAprender(cat, p, e);
    if (!apr.ok) return falha(apr.erro);
    const nIns = Array.isArray(s.insignias) ? s.insignias.length : 0;
    if (!tutor && nIns < e.trava) return falha('Not enough badges.', { trava: e.trava });
    const preco = tutor ? e.preco : 0;
    if ((s.dinheiro || 0) < preco) return falha('Not enough Coins.', { falta: { dinheiro: preco - (s.dinheiro || 0) } });
    const fez = Tm.aplicar(p, e, m.esquecer || null);
    if (!fez.ok) return falha(fez.erro, fez.cheio ? { cheio: true } : {});
    if (tutor) s.dinheiro = (s.dinheiro || 0) - preco;
    else { s.itens[e.item] -= 1; if (s.itens[e.item] <= 0) delete s.itens[e.item]; }   // the machine is single use
    const r = pronto(c, { vidas: [vida(p)] });
    return { ...r, tm: { t: 'tm', op, ok: true, golpe: e.chave, uid: p.uid, esquecido: fez.esqueceu || null } };
  }

  const OPS = { comprar, usar, descartar, segurar, tirar: tirarHeld, consumir, coleta, premio, safari: safariOp, cosmetico, tm: tmOp };
  return {
    /** Handles the op, or returns null when it isn't one of these. */
    tratar(c, op, m, u) { const f = OPS[op]; return f && c ? f(c, m, u) : null; },
    motorHeld,
    validarPersonagem,
    vestivel,
    tmProtocolo,
  };
}
