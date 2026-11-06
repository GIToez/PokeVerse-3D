/* DIRECTOR mode (?diretor=1, admin → Cinema → Director mode): stage a scene and record it with OBS.
 * v3 (01/09): everything uses FIXED tournament positions: each map has a spot for Player 1 (south) and Player 2 (north, straight
 * across), and each player's Pokémon stands 3.5 m in front of its trainer. The panel is per player: outfit (🎲), nick (🎲),
 * Pokémon (dex 🎲 + level) and a reserve to switch to. Camera presets (behind P1 / P2, side, wide, close on the Pokémon) + mouse
 * (drag turns, wheel = zoom). Actions on keys 1–9 refer to P1/P2 (move, switch to the reserve, KO, get back up, flash, camera,
 * scoreboard HP). Automatic scoreboard. The scene is saved in localStorage `diretor.cena3` + export/import. H hides the panel. */
let ctx = null, painel = null, foco = null, banner = null, cards = null, flash = null;
let cena = null;                                                          // { mapa, banner, placar, jog: {1:{tr,mon,reserva,ativo},2:{…}}, slots }
const vivos = { 1: { tr: null, mon: null, reserva: null }, 2: { tr: null, mon: null, reserva: null } };   // atores montados (objetos do jogo)
let extras = [], moverExtra = false, selExtra = null;                     // figurantes soltos (avançado)
const teclasDir = new Set();
const DIST_FRENTE = 3.5;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = 'body.cinematica #barra,body.cinematica #hud,body.cinematica #chat,body.cinematica #menu-icones,body.cinematica #menu-btn,body.cinematica #skills,body.cinematica #atalhos,body.cinematica #missao,body.cinematica #joy,body.cinematica #cam-btns,body.cinematica #time-hud,body.cinematica #fila-parceiro,body.cinematica #fila-montaria,body.cinematica #ir-box,body.cinematica #cena-box,body.cinematica #teclas,body.cinematica .hud,body.cinematica #minimapa,body.cinematica #f-alvo,body.cinematica #f-parceiro,body.cinematica .ficha{display:none!important}'
  + '#dir{position:fixed;right:0;top:0;bottom:0;width:330px;z-index:60;background:#0b1020f2;color:#e6ecff;font:12px/1.4 system-ui,Segoe UI,sans-serif;overflow:auto;padding:10px 12px 30px;border-left:1px solid #2a3550;box-sizing:border-box}'
  + '#dir.esc{display:none}#dir h2{margin:12px 0 6px;font-size:12px;color:#ffe07a;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #2a3550;padding-bottom:3px}#dir h2 small{color:#8a95b0;text-transform:none;letter-spacing:0;margin-left:6px}'
  + '#dir label{display:flex;align-items:center;gap:6px;margin:4px 0}#dir label span{min-width:62px;color:#9aa5c0}'
  + '#dir input,#dir select{flex:1;min-width:0;padding:4px 6px;border:1px solid #2a3550;border-radius:6px;background:#101624;color:#e6ecff;font:inherit}#dir input[type=color]{flex:0 0 34px;padding:0;height:24px}#dir input[type=range]{padding:0}'
  + '#dir button{padding:4px 8px;border:1px solid #2a3550;border-radius:6px;background:#101624;color:#e6ecff;font:inherit;cursor:pointer}#dir button.ok{border-color:#b47622;background:#342317;color:#ffe6b0;font-weight:700}#dir button.perigo{border-color:#a0132f;color:#f58e8e}'
  + '#dir .linha{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;align-items:center}#dir .k{color:#8a95b0;font-size:11px}#dir .jog{border:1px solid #2a3550;border-radius:8px;padding:6px 8px;margin-top:6px}#dir .jog b.t{color:#ffd23a}#dir .estado{color:#86ef5f}#dir .estado.nao{color:#f58e8e}'
  + '#dir details{margin-top:10px}#dir summary{cursor:pointer;color:#ffe07a}'
  + '#dir ul{list-style:none;margin:4px 0;padding:0}#dir li{display:flex;align-items:center;gap:6px;padding:3px 6px;border:1px solid #2a3550;border-radius:6px;margin-top:3px;cursor:pointer}#dir li.on{border-color:#ffd23a;color:#ffe07a}'
  + '#dir .slot{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:11px}#dir .slot b{width:18px;height:18px;border-radius:4px;background:#1b2238;display:inline-flex;align-items:center;justify-content:center;color:#ffd23a;flex:none}'
  + '#tn-topo{position:fixed;left:0;right:0;top:4.5%;text-align:center;z-index:40;pointer-events:none;font-family:system-ui,Segoe UI,sans-serif;color:#fff;text-shadow:0 2px 8px #000,0 0 18px #000a}'
  + '#tn-topo b{display:block;font-size:min(7vw,54px);letter-spacing:.5px;line-height:1.05;white-space:pre-wrap}#tn-topo span{display:inline-block;margin-top:.9vw;padding:.6vw 2.6vw;border-radius:99px;background:#0b1020cc;border:1px solid #ffd23a88;color:#ffe07a;font-size:min(3.6vw,26px);font-weight:700}#tn-topo span:empty,#tn-topo b:empty{display:none}'
  + '#tn-cards{position:fixed;left:4%;right:4%;bottom:5%;z-index:40;pointer-events:none;display:flex;flex-direction:column;gap:1.6vw;font-family:system-ui,Segoe UI,sans-serif}#tn-cards.esc{display:none}'
  + '.tn-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:2.4vw;padding:2vw 3vw;border-radius:2.6vw;background:#0b1020e0;border:1px solid #2a3550}.tn-card.ko .n{opacity:.5;text-decoration:line-through}'
  + '.tn-card .ic{width:min(13vw,96px);height:min(13vw,96px);border-radius:50%;background:#101624 center/78% no-repeat;border:2px solid #2a3550}'
  + '.tn-card .n{color:#fff;font-weight:800;font-size:min(4.3vw,32px);text-shadow:0 1px 3px #000}.tn-card .n small{display:block;font-weight:600;color:#9aa5c0;font-size:min(3vw,21px)}'
  + '.tn-card .hp{height:min(2.2vw,14px);border-radius:99px;background:#26304a;overflow:hidden;margin-top:.7vw;border:1px solid #000a}.tn-card .hp b{display:block;height:100%;background:linear-gradient(90deg,#86ef5f,#3ecf5a);transition:width .25s}.tn-card .hp.baixo b{background:linear-gradient(90deg,#ff9b5b,#e45670)}'
  + '.tn-card .time{display:flex;gap:1vw}.tn-card .time i{width:min(2.6vw,18px);height:min(2.6vw,18px);border-radius:50%;background:#ffd23a;border:1px solid #000a}.tn-card .time i.fora{background:#6a7590}.tn-card .time i.ko{background:#3a3f55}'
  + '#tn-flash{position:fixed;left:0;right:0;top:40%;text-align:center;z-index:41;pointer-events:none;font-family:system-ui,Segoe UI,sans-serif;font-weight:900;color:#fff;text-shadow:0 3px 10px #000,0 0 30px #000;opacity:0;transform:scale(.7);transition:opacity .22s,transform .22s}'
  + '#tn-flash.on{opacity:1;transform:scale(1)}#tn-flash b{display:block;font-size:min(13vw,96px);line-height:1;color:#ffd23a;white-space:pre-wrap}#tn-flash span{display:block;margin-top:1vw;font-size:min(5.2vw,40px)}'
  + '#dir-dica{position:fixed;left:8px;bottom:6px;z-index:60;color:#ffffffaa;font:11px system-ui,sans-serif;text-shadow:0 1px 3px #000;pointer-events:none}body.dir-escondido #dir-dica{display:none}';
const DEX_RAND = [1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 17, 18, 19, 20, 25, 26, 34, 37, 38, 39, 40, 54, 55, 58, 59, 63, 64, 65, 66, 67, 68, 74, 75, 76, 92, 93, 94, 95, 104, 105, 111, 112, 113, 120, 121, 123, 124, 125, 126, 127, 128, 129, 130, 131, 133, 134, 135, 136, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 249, 250];
const NICKS = ['KsL_Hunter', 'aKa_Luh', 'Mihzinha', 'ZeraTM', 'DarkKaio77', 'PedroHxD', 'Yuri_Catch', 'PatyGamer', 'NandoTV', 'Lele_22', 'xXFireXx', 'Camillinha', 'TioMew', 'Lolzin', 'BiaCatch', 'Rafa_PvP'];
const CORES = ['#8ef58e', '#c9a0ff', '#ff9bd7', '#ffe07a', '#ffb46b', '#7ad7ff', '#6ea8ff', '#ffd23a', '#ff8a5b', '#a0ffcf'];
const hex = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
const rnd = a => a[Math.floor(Math.random() * a.length)];
const nomeDex = n => ctx.porDex.get(+n)?.name || ('#' + n);
const icone = n => './ui/mon/pm' + String(n).padStart(4, '0') + '.png';
const status = t => { const s = $('dir-status'); if (s) s.textContent = t; };

/** roupa aleatória: skin sorteada; se tintável, cores sorteadas */
export function roupaAleatoria(){
  const s = rnd(ctx.Personagem.SKINS); const p = { tipo: s.id };
  if (s.tinta){ p.cores = {}; for (const k of Object.keys(ctx.Personagem.PADRAO[s.tinta] || {})) p.cores[k] = k === 'pele' ? rnd(['#ffcbaa', '#f2b58e', '#c98c62', '#8d5a3c']) : hex(); }
  return p;
}

/* ---------------------------------------------------------------- posições fixas do torneio */
function spots(){
  const n = ctx.mapaNome;
  if (n === '4120013') return { c: { x: 1.6, z: -3.5 }, 1: { x: 1.6, z: 4.0 }, 2: { x: 1.6, z: -10.5 } };   // Quarto do Campeão (eixo z, como na abertura; J2 1,5 m à frente do lugar do Mewtwo senão a arquibancada tapa ele na câmera de trás)
  if (n === 'casa') return { c: { x: -30, z: -33 }, 1: { x: -30, z: -25 }, 2: { x: -30, z: -41 } };        // platô do terreno
  const a = ctx.jogo.ash; return { c: { x: a.x, z: a.z - 7 }, 1: { x: a.x, z: a.z }, 2: { x: a.x, z: a.z - 14 } };   // outro mapa: em volta do spawn
}
const giroPara = (de, para) => Math.atan2(para.x - de.x, para.z - de.z);
function chao(x, z){
  if (ctx.relevo){ ctx.rc.set(new ctx.THREE.Vector3(x, 60, z), new ctx.THREE.Vector3(0, -1, 0)); const h = ctx.rc.intersectObjects(ctx.alvosChao, false)[0]; if (h) return h.point.y; }
  return ctx.chaoEm(x, z) ?? ctx.jogo.ash?.y ?? 0;
}
function por(e, x, z, giro){ e.x = x; e.z = z; e.y = chao(x, z); e.vx = x; e.vz = z; e.vy = e.y; e.giro = giro; e.pivo.position.set(x, e.y, z); e.pivo.rotation.y = giro; ctx.tocarAnim(e, 'Idle'); }
const outro = n => n === 1 ? 2 : 1;
function lugarTreinador(n){ const S = spots(); return { x: S[n].x, z: S[n].z, giro: giroPara(S[n], S[outro(n)]) }; }
function lugarMon(n){ const t = lugarTreinador(n); return { x: t.x + Math.sin(t.giro) * DIST_FRENTE, z: t.z + Math.cos(t.giro) * DIST_FRENTE, giro: t.giro }; }
function sinc(){ ctx.jogo.cinem = [...[1, 2].flatMap(n => [vivos[n].tr, vivos[n].mon, vivos[n].reserva].filter(Boolean)), ...extras.map(a => a.e)]; }

/* ---------------------------------------------------------------- montagem */
async function montarTreinador(perso, nick, cor, lugar){
  const e = await ctx.montarPersonagem('./scenery/pc/' + ctx.Personagem.glbDe(perso) + '.glb', null, 0);
  await ctx.Personagem.aplicar(e.pivo, perso); e.nome = nick; e.npc = true;
  const r = ctx.rotuloSprite(nick, cor, 2.0); r.position.set(0, (e.altura || 1.6) + 0.35, 0); e.pivo.add(r);
  ctx.cena.add(e.pivo); por(e, lugar.x, lugar.z, lugar.giro); return e;
}
async function montarMon(dex, lv, lugar, tam){
  const glb = 'pm' + String(dex).padStart(4, '0') + '_00';
  const e = await ctx.montarPersonagem('./scenery/mon/' + glb + '.glb', null, 0);
  ctx.configurarSeguidor(e, glb); e.lv = lv || 50; e.maxHp = 99999; e.hp = 99999; e.chefe = true; e.npc = true;
  if (tam && e.altura){ e.pivo.scale.multiplyScalar(tam / e.altura); e.altura = tam; }
  ctx.cena.add(e.pivo); por(e, lugar.x, lugar.z, lugar.giro); return e;
}
function tirar(e){ if (e) ctx.cena.remove(e.pivo); }
async function criarTreinador(n){
  const j = cena.jog[n]; if (!j.tr) return;
  tirar(vivos[n].tr); vivos[n].tr = null; pintarJog();
  try { vivos[n].tr = await montarTreinador(j.tr.perso, j.tr.nick, j.tr.cor, lugarTreinador(n)); } catch (e){ status('trainer ' + n + ' failed to load: ' + (e?.message || e)); }
  sinc(); pintarJog(); pintarCards();
}
async function criarMon(n, papel){                                        // papel: 'mon' | 'reserva'
  const j = cena.jog[n], d = j[papel]; if (!d) return;
  tirar(vivos[n][papel]); vivos[n][papel] = null; pintarJog();
  try { const e = await montarMon(d.dex, d.lv, lugarMon(n), d.tam || 0); if (papel === 'reserva') e.pivo.visible = false; vivos[n][papel] = e; }
  catch (e){ status(nomeDex(d.dex) + ' failed to load: ' + (e?.message || e)); }
  sinc(); pintarJog(); pintarCards();
}
async function montarTudo(){ for (const n of [1, 2]){ await criarTreinador(n); await criarMon(n, 'mon'); await criarMon(n, 'reserva'); } }

/* ---------------------------------------------------------------- textos e placar */
function pintarBanner(){ banner.innerHTML = '<b>' + esc(cena.banner.titulo) + '</b><span>' + esc(cena.banner.sub) + '</span>'; }
function pintarCards(){
  cards.classList.toggle('esc', !cena.placar.on);
  cards.innerHTML = [2, 1].map(n => { const j = cena.jog[n]; if (!j.tr || !j.mon) return ''; const d = j.ativo === 'reserva' && j.reserva ? j.reserva : j.mon; const hp = cena.placar.hp[n] ?? 100; return `<div class="tn-card${hp <= 0 ? ' ko' : ''}"><div class="ic" style="background-image:url(${icone(d.dex)})"></div><div class="n">${esc(j.tr.nick)}<small>${esc(nomeDex(d.dex))} · Lv ${d.lv || 50}</small><div class="hp${hp < 35 ? ' baixo' : ''}"><b style="width:${Math.max(0, Math.min(100, hp))}%"></b></div></div><div class="time">${j.reserva ? (j.ativo === 'reserva' ? '<i class="ko"></i><i></i>' : '<i></i><i class="fora"></i>') : '<i></i>'}</div></div>`; }).join('');
}
let flashT = 0;
function mostrarFlash(a, b, seg){ flash.innerHTML = '<b>' + esc(a) + '</b><span>' + esc(b) + '</span>'; flash.classList.add('on'); const meu = ++flashT; setTimeout(() => { if (meu === flashT) flash.classList.remove('on'); }, (seg || 1.5) * 1000); }

/* ---------------------------------------------------------------- ações (J1 / J2) */
const monAtivo = n => cena.jog[n].ativo === 'reserva' ? (vivos[n].reserva || vivos[n].mon) : vivos[n].mon;
const dadosAtivo = n => cena.jog[n].ativo === 'reserva' && cena.jog[n].reserva ? cena.jog[n].reserva : cena.jog[n].mon;
function encarar(){ for (const n of [1, 2]){ const a = monAtivo(n), b = monAtivo(outro(n)); if (a && b) a.giro = giroPara(a, b); } }
async function golpe(de, golpeId, dano){
  const at = monAtivo(de), al = monAtivo(outro(de)), g = ctx.GOLPES[golpeId], tr = vivos[de].tr;
  if (!at || !al || !g) return status('move: one of the players has no Pokémon');
  encarar(); if (tr?.acoes?.has('Attack')) ctx.tocarUma(tr, 'Attack');
  if (cena.placar.nomeGolpe) mostrarFlash(g.nome, (cena.jog[de].tr?.nick || 'P' + de) + ' · ' + nomeDex(dadosAtivo(de).dex), 1.1);
  if (g.contato) ctx.golpeTurno(at, al, g).catch(() => {}); else { ctx.tocarUma(at, g.anim); ctx.lancarGolpe(at, al, g); }
  ctx.jogo.tremor = 0.3;
  if (dano){ const o = outro(de); cena.placar.hp[o] = Math.max(0, (cena.placar.hp[o] ?? 100) - dano); pintarCards(); salvar(); }
}
async function troca(n){
  const j = cena.jog[n], tr = vivos[n].tr, sai = monAtivo(n), entra = j.ativo === 'reserva' ? vivos[n].mon : vivos[n].reserva;
  if (!sai || !entra) return status('switch: player ' + n + ' needs a Pokémon and a reserve');
  if (tr?.acoes?.has('Attack')) ctx.tocarUma(tr, 'Attack');
  ctx.efeito('FX_Evolution2', sai.peito, sai.altura, { escala: 1.2 }); await ctx.esperarSeg(0.35); sai.pivo.visible = false;
  const L = lugarMon(n); entra.x = L.x; entra.z = L.z; entra.y = chao(L.x, L.z); entra.giro = L.giro; entra.travaAnim = 0; entra.anim = null; entra.pivo.rotation.x = 0;
  if (tr){ try { await ctx.bolaLancada(tr, entra.x, entra.z); } catch {} }
  entra.pivo.visible = true; if (entra.acoes?.has('Appear')) ctx.tocarUma(entra, 'Appear');
  j.ativo = j.ativo === 'reserva' ? 'mon' : 'reserva'; cena.placar.hp[n] = 100; encarar(); pintarCards(); pintarJog(); salvar();
  mostrarFlash('GO, ' + nomeDex(dadosAtivo(n).dex).toUpperCase() + '!', j.tr?.nick || '', 1.3);
}
function ko(n){
  const e = monAtivo(n); if (!e) return;
  ctx.jogo.tremor = 0.7;
  if (e.acoes?.has('Dead')){ ctx.tocarUma(e, 'Dead'); e.travaAnim = 9e9; }
  else { ctx.tocarUma(e, 'Wound'); e.travaAnim = 9e9; let k = 0; const t = setInterval(() => { k = Math.min(1, k + 0.08); e.pivo.rotation.x = -1.35 * k; if (k >= 1) clearInterval(t); }, 30); }
  cena.placar.hp[n] = 0; pintarCards(); salvar();
}
function levantar(n){ const e = monAtivo(n); if (!e) return; e.travaAnim = 0; e.anim = null; e.pivo.rotation.x = 0; e.pivo.visible = true; ctx.tocarAnim(e, 'Idle'); cena.placar.hp[n] = 100; pintarCards(); salvar(); }
function camera(modo, n, zoom){
  const c = ctx.cam, S = spots(), tr = vivos[n]?.tr, m = monAtivo(n);
  if (modo === 'atras'){ const L = lugarTreinador(n); foco.vx = L.x + Math.sin(L.giro) * 3.5; foco.vz = L.z + Math.cos(L.giro) * 3.5; foco.vy = chao(foco.vx, foco.vz) + 1.1; c.giro = L.giro + Math.PI; c.zoom = zoom || 1.15; }   // câmera colada nas costas (na arena, mais atrás ela entra na parede)
  else if (modo === 'pokemon' && m){ foco.vx = m.x; foco.vy = m.y + (m.altura || 1.5) * 0.45; foco.vz = m.z; c.zoom = zoom || 0.85; }
  else if (modo === 'treinador' && tr){ foco.vx = tr.x; foco.vy = tr.y + 1.0; foco.vz = tr.z; c.zoom = zoom || 0.8; }
  else if (modo === 'lateral'){ const L = lugarTreinador(1); foco.vx = S.c.x; foco.vz = S.c.z; foco.vy = chao(S.c.x, S.c.z) + 1.0; c.giro = L.giro + Math.PI / 2; c.zoom = zoom || 2.3; }
  else if (modo === 'aberta'){ const L = lugarTreinador(1); foco.vx = S.c.x; foco.vz = S.c.z; foco.vy = chao(S.c.x, S.c.z) + 1.4; c.giro = L.giro + Math.PI; c.zoom = zoom || 2.1; }
}
function executar(s){
  if (!s) return;
  if (s.tipo === 'golpe') golpe(+s.de, s.golpe, +s.dano || 0);
  else if (s.tipo === 'troca') troca(+s.de);
  else if (s.tipo === 'ko') ko(+s.de);
  else if (s.tipo === 'levantar') levantar(+s.de);
  else if (s.tipo === 'flash') mostrarFlash(s.a, s.b, +s.seg || 1.5);
  else if (s.tipo === 'cam') camera(s.modo, +s.de || 1, +s.zoom || 0);
  else if (s.tipo === 'hp'){ cena.placar.hp[+s.de] = +s.valor; pintarCards(); salvar(); }
}
function resumo(s){
  const J = n => 'P' + n;
  if (s.tipo === 'golpe') return `${J(s.de)} uses ${ctx.GOLPES[s.golpe]?.nome || s.golpe} on ${J(outro(+s.de))}${s.dano ? ' (−' + s.dano + '%)' : ''}`;
  if (s.tipo === 'troca') return `${J(s.de)} switches Pokémon`;
  if (s.tipo === 'ko') return `${J(s.de)}'s Pokémon faints`;
  if (s.tipo === 'levantar') return `${J(s.de)}'s Pokémon gets back up`;
  if (s.tipo === 'flash') return `flash "${s.a}"`;
  if (s.tipo === 'cam') return `camera ${s.modo}${s.modo !== 'lateral' && s.modo !== 'aberta' ? ' ' + J(s.de) : ''}`;
  if (s.tipo === 'hp') return `${J(s.de)} HP = ${s.valor}%`;
  return s.tipo;
}

/* ---------------------------------------------------------------- persistência (só dados; posições são fixas) */
function salvar(){ ctx.gravarLS('diretor.cena3', cena); }
function limparTudo(){ for (const n of [1, 2]){ for (const k of ['tr', 'mon', 'reserva']){ tirar(vivos[n][k]); vivos[n][k] = null; } cena.jog[n] = { tr: null, mon: null, reserva: null, ativo: 'mon' }; } for (const a of extras) tirar(a.e); extras = []; cena.slots = {}; cena.placar.hp = { 1: 100, 2: 100 }; sinc(); pintarJog(); pintarSlots(); pintarCards(); salvar(); }

/* ---------------------------------------------------------------- painel */
function pintarJog(){
  for (const n of [1, 2]){
    const j = cena.jog[n];
    $('j' + n + '-tr-est').textContent = j.tr ? (vivos[n].tr ? '● ' + j.tr.nick + ' (' + ctx.Personagem.nomeDe(j.tr.perso) + ')' : '… loading') : 'not created yet';
    $('j' + n + '-tr-est').className = 'estado' + (j.tr && vivos[n].tr ? '' : ' nao');
    $('j' + n + '-mon-est').textContent = j.mon ? (vivos[n].mon ? '● ' + nomeDex(j.mon.dex) + ' Lv ' + j.mon.lv : '… loading') : 'not created yet';
    $('j' + n + '-mon-est').className = 'estado' + (j.mon && vivos[n].mon ? '' : ' nao');
    $('j' + n + '-res-est').textContent = j.reserva ? (vivos[n].reserva ? '● ' + nomeDex(j.reserva.dex) + ' Lv ' + j.reserva.lv + (j.ativo === 'reserva' ? ' (on the field)' : ' (in its ball)') : '… loading') : 'no reserve';
    $('j' + n + '-res-est').className = 'estado' + (j.reserva && vivos[n].reserva ? '' : ' nao');
  }
}
function pintarSlots(){
  $('dir-slots').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => { const s = cena.slots[k]; return `<div class="slot"><b>${k}</b>${s ? esc(resumo(s)) : '<span class="k">empty</span>'}${s ? ` <button data-run="${k}">▶</button><button data-del="${k}" class="perigo">×</button>` : ''}</div>`; }).join('');
  $('dir-slots').querySelectorAll('[data-run]').forEach(b => b.onclick = () => executar(cena.slots[b.dataset.run]));
  $('dir-slots').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { delete cena.slots[b.dataset.del]; pintarSlots(); salvar(); });
}
function pintarExtras(){ const ul = $('x-lista'); ul.innerHTML = extras.map(a => `<li class="${a.id === selExtra ? 'on' : ''}" data-id="${a.id}">${a.tipo === 'tr' ? '🧢' : '🔴'} ${esc(a.nome)}</li>`).join('') || '<li class="k">none</li>'; ul.querySelectorAll('li[data-id]').forEach(li => li.onclick = () => { selExtra = +li.dataset.id; pintarExtras(); }); }
function blocoJogador(n, skins){
  return `<div class="jog"><b class="t">Player ${n}</b> <span class="k">${n === 1 ? '(south: the "behind P1" camera sits at their back)' : '(north: straight across)'}</span>
    <label><span>outfit</span><select id="j${n}-skin">${skins}</select><button id="j${n}-rand" title="random skin and colours">🎲</button></label>
    <label><span>nick</span><input id="j${n}-nick" placeholder="name"><input type="color" id="j${n}-cor" value="${n === 1 ? '#8ef58e' : '#c9a0ff'}"><button id="j${n}-nick-rand">🎲</button></label>
    <div class="linha"><button id="j${n}-tr-ok" class="ok">create / change trainer</button><span id="j${n}-tr-est" class="estado nao">not created yet</span></div>
    <label><span>Pokémon</span><input type="number" id="j${n}-dex" value="${n === 1 ? 6 : 9}" min="1" max="1010" style="flex:.5"><span id="j${n}-dex-nome" style="min-width:0;flex:1"></span><button id="j${n}-dex-rand">🎲</button></label>
    <label><span>level</span><input type="number" id="j${n}-lv" value="60" min="1" max="100" style="flex:.5"><span>size m</span><input type="number" id="j${n}-tam" placeholder="auto" step="0.1" style="flex:.5"></label>
    <div class="linha"><button id="j${n}-mon-ok" class="ok">create / change Pokémon</button><span id="j${n}-mon-est" class="estado nao">not created yet</span></div>
    <label><span>reserve</span><input type="number" id="j${n}-rdex" value="${n === 1 ? 149 : 59}" min="1" max="1010" style="flex:.5"><span id="j${n}-rdex-nome" style="min-width:0;flex:1"></span><button id="j${n}-rdex-rand">🎲</button><input type="number" id="j${n}-rlv" value="60" min="1" max="100" style="flex:.5" title="level"></label>
    <div class="linha"><button id="j${n}-res-ok">create reserve (stays in its ball until the switch)</button><span id="j${n}-res-est" class="estado nao">no reserve</span></div>
  </div>`;
}
function montarPainel(){
  const skins = ctx.Personagem.SKINS.map(s => `<option value="${s.id}">${esc(s.nome)} (${s.sexo === 'menina' ? 'girl' : 'boy'})</option>`).join('');
  const golpes = Object.values(ctx.GOLPES).filter(g => g && g.id && g.efeito).sort((a, b) => a.nome.localeCompare(b.nome)).map(g => `<option value="${g.id}">${esc(g.nome)}${g.contato ? ' ⚔' : ''}</option>`).join('');
  painel = document.createElement('div'); painel.id = 'dir';
  painel.innerHTML = `
    <div class="linha"><b style="color:#ffe07a">🎬 Director</b> <span class="k">H hides · 1–9 play actions · Space = flash</span></div>
    <div id="dir-status" class="k">ready</div>
    <h2>Scene</h2>
    <label><span>map</span><select id="c-mapa"><option value="4120013|7170501">League arena</option><option value="casa|">Plot (plateau)</option><option value="pallet_route1|">Pallet + Route 1</option><option value="kanto|">All of Kanto</option></select><button id="c-ir">go</button></label>
    <div class="linha"><button id="c-exportar">Export scene</button><button id="c-importar">Import</button><input type="file" id="c-arq" accept="application/json" hidden><button id="c-limpar" class="perigo">Clear all</button></div>
    <div class="k">fixed positions: P1 to the south, P2 to the north (across from P1), each Pokémon 3.5 m in front. Everything you create lands in place and is saved.</div>
    <h2>Players</h2>
    ${blocoJogador(1, skins)}${blocoJogador(2, skins)}
    <h2>Text</h2>
    <label><span>title</span><input id="t-titulo"></label>
    <label><span>subtitle</span><input id="t-sub"></label>
    <label><span>flash</span><input id="t-fa" placeholder="big"><input id="t-fb" placeholder="small" style="flex:.8"><button id="t-flash">▶</button></label>
    <label><input type="checkbox" id="t-cards"> show the scoreboard (automatic: nick, Pokémon, level, HP, reserve)</label>
    <label><input type="checkbox" id="t-nomegolpe"> show the move name on every attack</label>
    <h2>Actions <small>saved on keys 1–9</small></h2>
    <label><span>type</span><select id="s-tipo"><option value="golpe">move</option><option value="troca">switch (the one on the field leaves, the reserve comes in)</option><option value="ko">KO</option><option value="levantar">get back up</option><option value="flash">text flash</option><option value="cam">camera</option><option value="hp">scoreboard HP</option></select></label>
    <label id="s-de-box"><span>player</span><select id="s-de"><option value="1">Player 1</option><option value="2">Player 2</option></select></label>
    <div id="s-golpe"><label><span>move</span><select id="s-golpe-id">${golpes}</select></label><label><span>damage %</span><input type="number" id="s-dano" value="25" min="0" max="100" style="flex:.5"><span class="k" style="min-width:0">taken from the other player's Pokémon</span></label></div>
    <div id="s-flashbox" hidden><label><span>big</span><input id="s-fa"></label><label><span>small</span><input id="s-fb"></label><label><span>seconds</span><input type="number" id="s-seg" value="1.5" step="0.1" style="flex:.5"></label></div>
    <div id="s-cambox" hidden><label><span>mode</span><select id="s-cam-modo"><option value="atras">behind the player</option><option value="pokemon">close on the player's Pokémon</option><option value="treinador">close on the trainer</option><option value="lateral">side (whole arena)</option><option value="aberta">wide (behind P1, far)</option></select></label><label><span>zoom</span><input type="number" id="s-cam-zoom" placeholder="auto" step="0.05" style="flex:.5"></label></div>
    <div id="s-hpbox" hidden><label><span>value %</span><input type="number" id="s-hp-valor" value="50" min="0" max="100" style="flex:.5"></label></div>
    <label><span>save to</span><select id="s-n">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<option>${k}</option>`).join('')}</select><button id="s-gravar" class="ok">save</button><button id="s-testar">try now</button></label>
    <div id="dir-slots"></div>
    <h2>Camera</h2>
    <div class="linha"><button id="c-atras1" class="ok">behind P1</button><button id="c-atras2">behind P2</button><button id="c-lateral">side</button><button id="c-aberta">wide</button></div>
    <label><span>turn</span><input type="range" id="c-giro" min="-180" max="180" step="1"><span id="c-girov"></span></label>
    <label><span>zoom</span><input type="range" id="c-zoom" min="0.3" max="4" step="0.05"><span id="c-zoomv"></span></label>
    <div class="k">drag in the game to turn · mouse wheel = zoom · Q/E turn · WASD moves the camera · +/− zoom</div>
    <details><summary>Advanced: extras</summary>
      <div class="k">free actors (crowd, more Pokémon). They appear in the middle of the arena; WASD moves the selected one.</div>
      <label><span>type</span><select id="x-tipo"><option value="mon">Pokémon</option><option value="tr">trainer (🎲 outfit/nick)</option></select><input type="number" id="x-dex" value="25" min="1" max="1010" style="flex:.5" title="dex"><button id="x-add">+ create</button></label>
      <ul id="x-lista"></ul>
      <div class="linha"><button id="x-mover">WASD moves: the camera</button><button id="x-remover" class="perigo">remove selected</button></div>
    </details>
    <div class="k" style="margin-top:10px">OBS: set the Chrome window to 9:16 (or crop in OBS), press H to hide the panel, then record.</div>`;
  document.body.appendChild(painel);
  const dica = document.createElement('div'); dica.id = 'dir-dica'; dica.textContent = 'H: panel · 1–9: actions · Space: flash · mouse/QE: turn · wheel: zoom'; document.body.appendChild(dica);
  // jogadores
  for (const n of [1, 2]){
    const j = cena.jog[n];
    if (j.tr){ $('j' + n + '-skin').value = j.tr.perso.tipo; $('j' + n + '-skin').dataset.cores = JSON.stringify(j.tr.perso.cores || null); $('j' + n + '-nick').value = j.tr.nick; $('j' + n + '-cor').value = j.tr.cor; }
    if (j.mon){ $('j' + n + '-dex').value = j.mon.dex; $('j' + n + '-lv').value = j.mon.lv; if (j.mon.tam) $('j' + n + '-tam').value = j.mon.tam; }
    if (j.reserva){ $('j' + n + '-rdex').value = j.reserva.dex; $('j' + n + '-rlv').value = j.reserva.lv; }
    const nomes = () => { $('j' + n + '-dex-nome').textContent = nomeDex($('j' + n + '-dex').value); $('j' + n + '-rdex-nome').textContent = nomeDex($('j' + n + '-rdex').value); };
    nomes(); $('j' + n + '-dex').oninput = nomes; $('j' + n + '-rdex').oninput = nomes;
    $('j' + n + '-rand').onclick = () => { const p = roupaAleatoria(); $('j' + n + '-skin').value = p.tipo; $('j' + n + '-skin').dataset.cores = JSON.stringify(p.cores || null); status('J' + n + ': ' + ctx.Personagem.nomeDe(p) + (p.cores ? ' with random colours' : '')); };
    $('j' + n + '-skin').onchange = () => { delete $('j' + n + '-skin').dataset.cores; };
    $('j' + n + '-nick-rand').onclick = () => { $('j' + n + '-nick').value = rnd(NICKS); $('j' + n + '-cor').value = rnd(CORES); };
    $('j' + n + '-dex-rand').onclick = () => { $('j' + n + '-dex').value = rnd(DEX_RAND); nomes(); };
    $('j' + n + '-rdex-rand').onclick = () => { $('j' + n + '-rdex').value = rnd(DEX_RAND); nomes(); };
    $('j' + n + '-tr-ok').onclick = async () => { const cores = $('j' + n + '-skin').dataset.cores ? JSON.parse($('j' + n + '-skin').dataset.cores) : null; j.tr = { perso: { tipo: $('j' + n + '-skin').value, ...(cores ? { cores } : {}) }, nick: $('j' + n + '-nick').value.trim() || rnd(NICKS), cor: $('j' + n + '-cor').value }; $('j' + n + '-nick').value = j.tr.nick; salvar(); status('loading trainer ' + n + '…'); await criarTreinador(n); salvar(); status('P' + n + ' ready in place'); };
    $('j' + n + '-mon-ok').onclick = async () => { j.mon = { dex: +$('j' + n + '-dex').value, lv: +$('j' + n + '-lv').value || 50, tam: +$('j' + n + '-tam').value || 0 }; j.ativo = 'mon'; cena.placar.hp[n] = 100; salvar(); status('loading ' + nomeDex(j.mon.dex) + '…'); await criarMon(n, 'mon'); if (vivos[n].reserva) vivos[n].reserva.pivo.visible = false; encarar(); salvar(); status(nomeDex(j.mon.dex) + ' in front of P' + n); };
    $('j' + n + '-res-ok').onclick = async () => { j.reserva = { dex: +$('j' + n + '-rdex').value, lv: +$('j' + n + '-rlv').value || 50 }; salvar(); status('loading reserve…'); await criarMon(n, 'reserva'); salvar(); status('P' + n + ' reserve ready (in its ball)'); };
  }
  // textos
  $('t-titulo').value = cena.banner.titulo; $('t-sub').value = cena.banner.sub;
  $('t-titulo').oninput = () => { cena.banner.titulo = $('t-titulo').value; pintarBanner(); salvar(); };
  $('t-sub').oninput = () => { cena.banner.sub = $('t-sub').value; pintarBanner(); salvar(); };
  $('t-flash').onclick = () => mostrarFlash($('t-fa').value, $('t-fb').value, 1.6);
  $('t-cards').checked = !!cena.placar.on; $('t-cards').onchange = () => { cena.placar.on = $('t-cards').checked; pintarCards(); salvar(); };
  $('t-nomegolpe').checked = !!cena.placar.nomeGolpe; $('t-nomegolpe').onchange = () => { cena.placar.nomeGolpe = $('t-nomegolpe').checked; salvar(); };
  // ações
  const caixas = { golpe: 's-golpe', flash: 's-flashbox', cam: 's-cambox', hp: 's-hpbox' };
  const mostrarCaixas = () => { const t = $('s-tipo').value; for (const id of Object.values(caixas)) $(id).hidden = true; if (caixas[t]) $(caixas[t]).hidden = false; $('s-de-box').style.display = t === 'flash' ? 'none' : ''; };
  $('s-tipo').onchange = mostrarCaixas; mostrarCaixas();
  const lerSlot = () => { const t = $('s-tipo').value, de = +$('s-de').value; if (t === 'golpe') return { tipo: t, de, golpe: $('s-golpe-id').value, dano: +$('s-dano').value }; if (t === 'flash') return { tipo: t, a: $('s-fa').value, b: $('s-fb').value, seg: +$('s-seg').value }; if (t === 'cam') return { tipo: t, de, modo: $('s-cam-modo').value, zoom: +$('s-cam-zoom').value || 0 }; if (t === 'hp') return { tipo: t, de, valor: +$('s-hp-valor').value }; return { tipo: t, de }; };
  $('s-gravar').onclick = () => { cena.slots[$('s-n').value] = lerSlot(); pintarSlots(); salvar(); status('action saved on key ' + $('s-n').value); };
  $('s-testar').onclick = () => executar(lerSlot());
  // câmera
  $('c-atras1').onclick = () => camera('atras', 1); $('c-atras2').onclick = () => camera('atras', 2); $('c-lateral').onclick = () => camera('lateral', 1); $('c-aberta').onclick = () => camera('aberta', 1);
  $('c-zoom').oninput = () => { ctx.cam.zoom = +$('c-zoom').value; }; $('c-giro').oninput = () => { ctx.cam.giro = +$('c-giro').value * Math.PI / 180; };
  // cena
  $('c-mapa').value = cena.mapa || '4120013|7170501';
  $('c-ir').onclick = () => { const [mapa, chegada] = $('c-mapa').value.split('|'); cena.mapa = $('c-mapa').value; salvar(); const u = new URL(location.href); u.searchParams.set('mapa', mapa); if (chegada) u.searchParams.set('chegada', chegada); else u.searchParams.delete('chegada'); location.href = u.toString(); };
  $('c-exportar').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(cena, null, 1)], { type: 'application/json' })); a.download = 'cena_diretor.json'; a.click(); };
  $('c-importar').onclick = () => $('c-arq').click();
  $('c-arq').onchange = () => { const f = $('c-arq').files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(String(r.result)); Object.assign(cena, { banner: d.banner || cena.banner, placar: d.placar || cena.placar, jog: d.jog || cena.jog, slots: d.slots || {} }); salvar(); location.reload(); } catch { status('invalid JSON'); } }; r.readAsText(f); };
  $('c-limpar').onclick = limparTudo;
  // avançado
  $('x-add').onclick = async () => {
    const S = spots(), tipo = $('x-tipo').value; status('loading…');
    try {
      const L = { x: S.c.x + (Math.random() - 0.5) * 4, z: S.c.z + (Math.random() - 0.5) * 4, giro: Math.random() * Math.PI * 2 };
      const e = tipo === 'tr' ? await montarTreinador(roupaAleatoria(), rnd(NICKS), rnd(CORES), L) : await montarMon(+$('x-dex').value, 50, L, 0);
      extras.push({ id: Date.now(), tipo, e, nome: tipo === 'tr' ? e.nome : nomeDex(+$('x-dex').value) }); sinc(); pintarExtras(); status('extra created in the middle');
    } catch (err){ status('failed to load: ' + (err?.message || err)); }
  };
  $('x-mover').onclick = () => { moverExtra = !moverExtra; $('x-mover').textContent = 'WASD moves: ' + (moverExtra ? 'the selected extra' : 'the camera'); };
  $('x-remover').onclick = () => { const a = extras.find(x => x.id === selExtra); if (!a) return; tirar(a.e); extras = extras.filter(x => x !== a); selExtra = null; sinc(); pintarExtras(); };
  pintarJog(); pintarSlots(); pintarExtras();
}

/* ---------------------------------------------------------------- teclado, mouse e laço */
function controles(){
  const digitando = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
  window.addEventListener('keydown', e => { if (!digitando(e)) teclasDir.add(e.code); }, true);
  window.addEventListener('keyup', e => teclasDir.delete(e.code), true);
  window.addEventListener('blur', () => teclasDir.clear());
  let arr = null;
  ctx.tela.addEventListener('pointerdown', e => { arr = { x: e.clientX, g: ctx.cam.giro }; }, true);
  window.addEventListener('pointermove', e => { if (arr) ctx.cam.giro = arr.g - (e.clientX - arr.x) * 0.008; }, true);
  window.addEventListener('pointerup', () => { arr = null; }, true);
  ctx.tela.addEventListener('wheel', e => { ctx.cam.zoom = Math.min(4, Math.max(0.3, ctx.cam.zoom * (e.deltaY > 0 ? 1.08 : 0.92))); e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (digitando(e)) return;
    if (e.code === 'KeyH'){ painel.classList.toggle('esc'); document.body.classList.toggle('dir-escondido', painel.classList.contains('esc')); e.preventDefault(); return; }
    if (e.code === 'Space'){ mostrarFlash($('t-fa').value, $('t-fb').value, 1.6); e.preventDefault(); return; }
    const m = e.code.match(/^Digit([1-9])$/); if (m && !e.repeat){ executar(cena.slots[m[1]]); e.preventDefault(); }
  }, true);
  let ultimo = performance.now();
  setInterval(() => {
    const agora = performance.now(), dt = Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
    if (ctx.jogo.pika?.pivo) ctx.jogo.pika.pivo.visible = false;          // the player's partner comes out of its ball after boot: keep it off the stage
    const T = teclasDir, c = ctx.cam, vel = 5 * dt;
    if (T.has('KeyQ')) c.giro -= 2.6 * dt; if (T.has('KeyE')) c.giro += 2.6 * dt;
    if (T.has('Equal') || T.has('NumpadAdd')) c.zoom = Math.max(0.3, c.zoom - 1.2 * dt); if (T.has('Minus') || T.has('NumpadSubtract')) c.zoom = Math.min(4, c.zoom + 1.2 * dt);
    let dx = 0, dz = 0; if (T.has('KeyW')) dz -= 1; if (T.has('KeyS')) dz += 1; if (T.has('KeyA')) dx -= 1; if (T.has('KeyD')) dx += 1;
    if (dx || dz){
      const g = c.giro, fx = -Math.sin(g), fz = -Math.cos(g);
      const mx = (fx * -dz + fz * dx) * vel, mz = (fz * -dz - fx * dx) * vel;
      const a = moverExtra ? extras.find(x => x.id === selExtra) : null;
      if (a){ a.e.x += mx; a.e.z += mz; a.e.y = chao(a.e.x, a.e.z); } else { foco.vx += mx; foco.vz += mz; foco.vy = chao(foco.vx, foco.vz) + 1.1; }
    }
    if ($('c-zoom') && document.activeElement !== $('c-zoom')){ $('c-zoom').value = c.zoom; $('c-zoomv').textContent = c.zoom.toFixed(2); }
    if ($('c-giro') && document.activeElement !== $('c-giro')){ const gd = ((c.giro * 180 / Math.PI) % 360 + 540) % 360 - 180; $('c-giro').value = Math.round(gd); $('c-girov').textContent = Math.round(gd) + '°'; }
  }, 33);
}

export async function abrir(c){
  ctx = c;
  document.body.classList.add('cinematica');
  const manter = new Set(['boot', 'dir', 'dir-dica', 'tn-topo', 'tn-cards', 'tn-flash', 'sobre']);
  const esconder = raiz => { for (const el of [...raiz.children]){ if (el === ctx.tela || manter.has(el.id)) continue; if (el.contains(ctx.tela)) esconder(el); else if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') el.style.display = 'none'; } };
  esconder(document.body);
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  banner = document.createElement('div'); banner.id = 'tn-topo'; document.body.appendChild(banner);
  cards = document.createElement('div'); cards.id = 'tn-cards'; document.body.appendChild(cards);
  flash = document.createElement('div'); flash.id = 'tn-flash'; document.body.appendChild(flash);
  ctx.jogo.ash.pivo.visible = false; ctx.jogo.pika.pivo.visible = false; ctx.jogo.pika.recolhido = true; ctx.portaOcupado(true);
  if (ctx.relevo){ ctx.rc = new ctx.THREE.Raycaster(); ctx.alvosChao = []; ctx.cena.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.isSprite) ctx.alvosChao.push(o); }); }
  const salvo = ctx.lerLS('diretor.cena3', null);
  cena = { mapa: salvo?.mapa || '4120013|7170501', banner: salvo?.banner || { titulo: '🏆 KANTO TOURNAMENT', sub: 'FINAL · Indigo League' }, placar: salvo?.placar || { on: true, nomeGolpe: true, hp: { 1: 100, 2: 100 } }, jog: salvo?.jog || { 1: { tr: null, mon: null, reserva: null, ativo: 'mon' }, 2: { tr: null, mon: null, reserva: null, ativo: 'mon' } }, slots: salvo?.slots || {} };
  for (const n of [1, 2]) cena.jog[n].ativo = cena.jog[n].ativo || 'mon';
  const S = spots(); foco = { vx: S.c.x, vy: chao(S.c.x, S.c.z) + 1.1, vz: S.c.z }; ctx.jogo.foco = foco;
  if (!ctx.jogo.cinem) ctx.jogo.cinem = [];                                  // a cinematic is running: the game keeps the mission arrow off
  montarPainel(); pintarBanner(); pintarCards(); controles();
  camera('atras', 1);
  $('boot').hidden = true;
  if (cena.jog[1].tr || cena.jog[2].tr){ status('building the saved scene…'); await montarTudo(); encarar(); pintarCards(); status('scene ready'); }
  window.__diretor = { cena: () => cena, vivos, executar, camera, roupaAleatoria, montarTudo, criarTreinador, criarMon, spots, lugarTreinador, lugarMon, foco };
}
