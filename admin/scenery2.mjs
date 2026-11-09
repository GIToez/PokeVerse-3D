/* SCENERY STUDIO — the 3D scenery editor v2 (/admin/scenery2, Nov 8). The classic editor (/admin/scenery) stays untouched.
 *
 * A Roblox-Studio-style workspace for LIBRARY maps (every map but the assembled pallet_route1):
 *   • Toolbox with 3D thumbnails (this map's prefabs + the shared library), click or drag into the viewport, ghost preview.
 *   • Explorer (Terrain / Environment / Props / Paths, models, per-prefab folders, lock + visibility) and Properties.
 *   • Free transform: Select (slide over surfaces) / Move / Scale / Rotate gizmos, world or local axes, optional snap.
 *   • Fly camera: RMB look, WASD/QE, wheel zoom to cursor, MMB pan, F focus.
 *   • Paths: smooth irregular ribbons (spline), any angle, 6 styles.
 *   • Collision per piece: Auto (legacy 1 m grid), precise box, precise mesh or none; walkable surfaces. Visualised in the viewport.
 * Data: the same /admin/mapa-objetos lists (objetos / ambiente / areaEnv) + `caminhos`. New fields: sx/sy/sz, col, pi, g.
 * The game reads them through scenery_free.mjs (same module as here). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { carregar as carregarNomes, nomeMapa, nomeMapaComId, opcoesMapa, rotuloPrefab } from '/admin/map_names.mjs';
import * as Livre from '/scenery_free.mjs';

const BASE = location.protocol === 'https:' ? location.origin + '/servidor' : 'http://' + location.hostname + ':5190';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let token = localStorage.getItem('conta.token') || '';
const api = async (rota, metodo = 'GET', corpo) => {
  try { token = localStorage.getItem('conta.token') || token; } catch {}
  const r = await fetch(BASE + rota, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: corpo != null ? JSON.stringify(corpo) : undefined });
  let d = {}; try { d = await r.json(); } catch {} return { status: r.status, ok: r.ok, ...d };
};
const toast = (m, erro = false) => { const e = document.createElement('div'); if (erro) e.className = 'erro'; e.textContent = m; $('toast').appendChild(e); setTimeout(() => e.remove(), 4500); saida(m); };
const saida = m => { $('saida').textContent = m; };
const chaveNome = n => String(n || '').toLowerCase().replace(/^lib:?/, '').replace(/\s/g, '_').replace(/[\[\]\.:/]/g, '');
const G2R = THREE.MathUtils.degToRad, R2G = THREE.MathUtils.radToDeg;
const FX = -1;                                                       // library maps: world x = −file x
const r3 = v => +(+v).toFixed(3);
const normGraus = g => { g = Math.round((+g || 0) * 10) / 10; g = ((g % 360) + 360) % 360; g = Math.round(g * 10) / 10; return g > 180 ? g - 360 : g; };
const grausArquivo = g => { g = Math.round((((+g || 0) % 360) + 360) % 360 * 10) / 10; return g >= 360 ? 0 : g; };

/* the game's name rules (index.html instanciarBiblioteca) — only to PREDICT the collision in the viewport */
const EH_PISO = /floor|ground|tile|^sink|road|plane|bridge|pier|stair|leitai|mat_|carpet|arenen_wood|arenen_sand/;
const EH_AGUA = /shui|water|sea_floor|^sea$/;
const ATRAVESSA = /gimgrass|comgrass|flower|grass_0|leaf|yun|collide|rock_wr_dong|rock_winnerroad_[hn]_|slashtree/;
const infoNome = n => { const k = chaveNome(n); return { piso: EH_PISO.test(k), agua: EH_AGUA.test(k), atravessa: ATRAVESSA.test(k) }; };

const quem = await api('/admin/eu');
if (!quem.ok || !quem.gm) { location.href = '/admin'; throw new Error('GM only'); }

// ── Three ──────────────────────────────────────────────────────────────────────
const tela = $('tela');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fc4e8');
scene.fog = new THREE.Fog('#9fc4e8', 600, 2400);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6000); camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
tela.appendChild(renderer.domElement); renderer.domElement.tabIndex = 0;
scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a5040, 1.25));
const sol = new THREE.DirectionalLight(0xfff4e0, 1.9); sol.position.set(90, 160, 60); scene.add(sol);
const grade = new THREE.GridHelper(2000, 1000, 0x4a5a78, 0x2a3446); grade.position.y = 0.005; grade.visible = false; scene.add(grade);
grade.material.transparent = true; grade.material.opacity = 0.5;
const raizInst = new THREE.Group(); scene.add(raizInst);
const raizCam = new THREE.Group(); raizCam.name = 'caminhos'; scene.add(raizCam);
const raizSel = new THREE.Group(); scene.add(raizSel);
const raizCol = new THREE.Group(); scene.add(raizCol);
const raizAlcas = new THREE.Group(); scene.add(raizAlcas);
const proxy = new THREE.Object3D(); scene.add(proxy);
tela.addEventListener('contextmenu', ev => ev.preventDefault());
function resize() { const w = tela.clientWidth, h = tela.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h || 1; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(tela); resize();

// ── state ──────────────────────────────────────────────────────────────────────
/* item = piece { tipo:'peca', id, obj, lista, mats:[{geo,mat,local}], inst:[{im,i}] }  or path { tipo:'caminho', id, d, mesh } */
let pecas = [], caminhos = [], instGrupos = [];
let partes = new Map(), nomeDoPrefab = new Map(), tipos = [];
let sel = new Set(), principal = null, pontoSel = null;           // pontoSel = { cam, i } a path point under the gizmo
let mapaAtual = null, mapaRotulo = '', mapasDisponiveis = [], glbDoMapa = {}, sujo = false, proxId = 1;
let ferramenta = 'select';                                         // select | move | scale | rotate
let inserir = null;                                                // { tipo, ghost, rotY }
let desenho = null;                                                // path drawing { cam, novo, antes }
let verColisao = false;
const LISTAS = { areaEnv: { nome: 'Terrain', ico: '🟫' }, ambiente: { nome: 'Environment', ico: '🌊' }, objetos: { nome: 'Props', ico: '📦' } };
const travado = { areaEnv: true, ambiente: true, objetos: false, caminhos: false };
const visivel = { areaEnv: true, ambiente: true, objetos: true, caminhos: true };
const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const marcarSujo = () => { sujo = true; $('sujo').hidden = false; };
let travaPisos = true;                                              // floors / water are not clickable in the viewport (Explorer still selects them)
const ehPisoPeca = p => p.piso ??= (i => i.piso || i.agua)(infoNome(p.obj.n));
const travadoItem = it => it.tipo === 'caminho' ? travado.caminhos : travado[it.lista] || (travaPisos && ehPisoPeca(it));
const visivelItem = it => it.tipo === 'caminho' ? visivel.caminhos : visivel[it.lista];

// piece transform helpers (world space; the file keeps x mirrored)
const posMundo = p => new THREE.Vector3(FX * (+p.obj.x || 0), +p.obj.y || 0, +p.obj.z || 0);
const rotDe = p => ({ x: normGraus(p.obj.rx), y: normGraus(p.obj.r), z: normGraus(p.obj.rz) });
const escDe = p => Livre.escalaDe(p.obj);
const quatDe = p => { const r = rotDe(p); return new THREE.Quaternion().setFromEuler(_e.set(G2R(r.x), G2R(r.y), G2R(r.z), 'XYZ')); };
function setPosMundo(p, v) { p.obj.x = r3(FX * v.x); p.obj.y = r3(v.y); p.obj.z = r3(v.z); }
function setRot(p, r) { for (const [k, v] of [['rx', r.x], ['r', r.y], ['rz', r.z]]) { const g = grausArquivo(v); if (g) p.obj[k] = g; else delete p.obj[k]; } }
function setRotQuat(p, q) { _e.setFromQuaternion(q, 'XYZ'); setRot(p, { x: R2G(_e.x), y: R2G(_e.y), z: R2G(_e.z) }); }
function setEsc(p, s) { for (const [k, v] of [['sx', s.x], ['sy', s.y], ['sz', s.z]]) { const n = +Math.min(100, Math.max(0.01, Math.abs(+v || 1))).toFixed(3); if (n !== 1) p.obj[k] = n; else delete p.obj[k]; } }
const matrizDe = (p, local) => Livre.matrizColocacao(p.obj, FX, _m).multiply(local);
function caixaMundo(p, out = new THREE.Box3()) {
  out.makeEmpty(); const b = new THREE.Box3();
  for (const m of p.mats) { if (!m.geo.boundingBox) m.geo.computeBoundingBox(); b.copy(m.geo.boundingBox).applyMatrix4(matrizDe(p, m.local)); out.union(b); }
  if (out.isEmpty()) { const c = posMundo(p); out.setFromCenterAndSize(c, new THREE.Vector3(1, 1, 1)); }
  return out;
}
const ptsMundo = c => c.d.pts.map(p => new THREE.Vector3(FX * p[0], p[1], p[2]));
function caixaItem(it, out = new THREE.Box3()) {
  if (it.tipo === 'peca') return caixaMundo(it, out);
  out.setFromPoints(ptsMundo(it)); return out.expandByScalar(it.d.w / 2);
}

// ── snapshots / undo ───────────────────────────────────────────────────────────
const estadoDe = it => it.tipo === 'peca' ? { obj: { ...it.obj }, lista: it.lista } : { d: JSON.parse(JSON.stringify(it.d)) };
function aplicarEstado(it, e) {
  if (it.tipo === 'peca') { for (const k of Object.keys(it.obj)) delete it.obj[k]; Object.assign(it.obj, e.obj); it.lista = e.lista; }
  else { it.d = JSON.parse(JSON.stringify(e.d)); }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let historico = [], refazer = [];
function registrar(acao) { if (!acao) return; historico.push(acao); if (historico.length > 400) historico.shift(); refazer = []; botoesHist(); marcarSujo(); }
function acaoEstados(antes) {   // antes: Map(item → state)
  const itens = []; for (const [it, de] of antes) { const para = estadoDe(it); if (!igual(de, para)) itens.push([it, de, para]); }
  return itens.length ? { t: 'estado', itens } : null;
}
function botoesHist() { $('t-undo').disabled = !historico.length; $('t-redo').disabled = !refazer.length; }
function aplicarAcao(a, voltar) {
  if (a.t === 'grupo') { for (const s of (voltar ? [...a.acoes].reverse() : a.acoes)) aplicarAcao(s, voltar); return; }
  if (a.t === 'estado') for (const [it, de, para] of a.itens) aplicarEstado(it, voltar ? de : para);
  else if (a.t === 'add') { if (voltar) a.itens.forEach(it => tirarItem(it)); else a.itens.forEach(it => porItem(it)); }
  else if (a.t === 'del') { if (voltar) [...a.itens].reverse().forEach(([it, idx]) => porItem(it, idx)); else a.itens.forEach(([it]) => tirarItem(it)); }
}
const itensDaAcao = a => a.t === 'grupo' ? a.acoes.flatMap(itensDaAcao) : a.t === 'estado' ? a.itens.map(x => x[0]) : a.t === 'add' ? a.itens : a.itens.map(x => x[0]);
function desfazer() { if (transform.dragging || !historico.length) return; const a = historico.pop(); aplicarAcao(a, true); refazer.push(a); depoisHist(a); }
function refazerAcao() { if (transform.dragging || !refazer.length) return; const a = refazer.pop(); aplicarAcao(a, false); historico.push(a); depoisHist(a); }
function depoisHist(a) {
  reconstruir();
  const vivos = itensDaAcao(a).filter(existe);
  selecionarVarios(vivos);
  botoesHist(); marcarSujo();
}
const existe = it => it.tipo === 'peca' ? pecas.includes(it) : caminhos.includes(it);
function porItem(it, idx) {
  const l = it.tipo === 'peca' ? pecas : caminhos;
  if (l.includes(it)) return;
  l.splice(idx == null ? l.length : Math.min(idx, l.length), 0, it);
}
function tirarItem(it) {
  const l = it.tipo === 'peca' ? pecas : caminhos, i = l.indexOf(it);
  if (i >= 0) l.splice(i, 1);
  sel.delete(it); if (principal === it) principal = [...sel].pop() || null;
  if (pontoSel?.cam === it) pontoSel = null;
  return i;
}

// ── instancing ─────────────────────────────────────────────────────────────────
function rebuildInstancias() {
  for (const im of instGrupos) { raizInst.remove(im); im.dispose?.(); }
  instGrupos = [];
  for (const p of pecas) p.inst = [];
  const grupos = new Map();
  for (const p of pecas) {
    if (!visivel[p.lista]) continue;
    for (const m of p.mats) {
      const mk = Array.isArray(m.mat) ? m.mat.map(x => x.uuid).join(',') : m.mat.uuid;
      const k = m.geo.uuid + '|' + mk;
      let g = grupos.get(k); if (!g) grupos.set(k, g = { geo: m.geo, mat: m.mat, membros: [] });
      g.membros.push({ peca: p, local: m.local });
    }
  }
  for (const g of grupos.values()) {
    const im = new THREE.InstancedMesh(g.geo, g.mat, g.membros.length);
    im.frustumCulled = false; im.userData.membros = g.membros;
    g.membros.forEach((mb, i) => { im.setMatrixAt(i, matrizDe(mb.peca, mb.local)); mb.peca.inst.push({ im, i }); });
    im.instanceMatrix.needsUpdate = true; raizInst.add(im); instGrupos.push(im);
  }
}
function atualizarInst(p) {
  for (const { im, i } of p.inst) { im.setMatrixAt(i, matrizDe(p, im.userData.membros[i].local)); im.instanceMatrix.needsUpdate = true; im.boundingSphere = null; im.boundingBox = null; }
}
function rebuildCaminhos() {
  for (const c of caminhos) if (c.mesh) { raizCam.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); c.mesh = null; }
  caminhos.forEach((c, i) => {
    if (!visivel.caminhos || c.d.pts.length < 2) return;
    try { c.mesh = Livre.construirCaminho(c.d, { flipX: FX, seed: i + 1 }); c.mesh.userData.item = c; raizCam.add(c.mesh); }
    catch (e) { console.warn('path', e); }
  });
}
function atualizarCaminho(c) {
  const i = caminhos.indexOf(c); if (i < 0) return;
  if (c.mesh) { raizCam.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); c.mesh = null; }
  if (!visivel.caminhos || c.d.pts.length < 2) return;
  c.mesh = Livre.construirCaminho(c.d, { flipX: FX, seed: i + 1 }); c.mesh.userData.item = c; raizCam.add(c.mesh);
}
function atualizarItem(it) { if (it.tipo === 'peca') atualizarInst(it); else atualizarCaminho(it); }
function reconstruir() { rebuildInstancias(); rebuildCaminhos(); realcar(); agendarArvore(); }

// ── picking ───────────────────────────────────────────────────────────────────
function raioDe(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera({ x: ((ev.clientX - r.left) / r.width) * 2 - 1, y: -((ev.clientY - r.top) / r.height) * 2 + 1 }, camera);
  return raycaster;
}
/** First item under the cursor. excluir: Set of items to see through; travados: also locked lists. */
function pegar(ev, { excluir = null, travados = false, caminhosTambem = true, soPiso = false } = {}) {
  raioDe(ev);
  const alvos = caminhosTambem ? [...instGrupos, ...raizCam.children] : instGrupos;
  for (const h of raycaster.intersectObjects(alvos, false)) {
    const it = h.object.isInstancedMesh ? h.object.userData.membros[h.instanceId]?.peca : h.object.userData.item;
    if (!it || excluir?.has(it)) continue;
    if (!travados && travadoItem(it)) continue;
    if (soPiso && !(it.tipo === 'peca' && ehPisoPeca(it))) continue;
    return { it, ponto: h.point.clone(), normal: h.face?.normal ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0) };
  }
  return null;
}
/** Surface point under the cursor (any piece, locked or not), or the plane y = yPlano. */
function superficie(ev, { excluir = null, yPlano = null, soPiso = false } = {}) {
  const h = pegar(ev, { excluir, travados: true, caminhosTambem: false, soPiso });
  if (h) return h.ponto;
  const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(yPlano ?? chaoRef));
  const p = new THREE.Vector3(); return raycaster.ray.intersectPlane(pl, p) ? p : null;
}
let chaoRef = 0;

// ── selection ─────────────────────────────────────────────────────────────────
const doModelo = it => it.tipo === 'peca' && it.obj.g ? pecas.filter(p => p.obj.g === it.obj.g && p.lista === it.lista) : [it];
function selecionarVarios(lista, { somar = false } = {}) {
  if (!somar) sel = new Set();
  for (const it of lista) sel.add(it);
  principal = lista.length ? lista[lista.length - 1] : [...sel].pop() || null;
  if (pontoSel && !sel.has(pontoSel.cam)) pontoSel = null;
  depoisSelecao();
}
function alternar(lista) {
  const todos = lista.every(it => sel.has(it));
  for (const it of lista) todos ? sel.delete(it) : sel.add(it);
  principal = todos ? [...sel].pop() || null : lista[lista.length - 1];
  depoisSelecao();
}
function limparSelecao() { sel = new Set(); principal = null; pontoSel = null; depoisSelecao(); }
function depoisSelecao() { prenderGizmo(); realcar(); renderProps(); agendarArvore(); statusSel(); }
function statusSel() {
  const n = sel.size, np = [...sel].filter(i => i.tipo === 'peca').length;
  $('st-sel').innerHTML = n ? `<b>${n}</b> selected${np !== n ? ' (' + (n - np) + ' path' + (n - np > 1 ? 's' : '') + ')' : ''}` : '';
}
const _caixaUnit = (() => { const g = new THREE.BufferGeometry(); const v = []; const c = [[0,0,0],[1,0,0],[1,0,1],[0,0,1],[0,1,0],[1,1,0],[1,1,1],[0,1,1]]; for (const [a, b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) v.push(...c[a], ...c[b]); g.setAttribute('position', new THREE.Float32BufferAttribute(v.map(x => x - 0.5), 3)); return g; })();
const matSel = new THREE.LineBasicMaterial({ color: 0x3a8ef6, depthTest: false, transparent: true });
const matSel2 = new THREE.LineBasicMaterial({ color: 0x8fc0ff, depthTest: false, transparent: true, opacity: 0.8 });
/** Selection boxes follow the piece's own axes (a rotated piece gets a rotated box, like Studio). */
function realcar() {
  for (const o of [...raizSel.children]) { raizSel.remove(o); if (o.geometry !== _caixaUnit) o.geometry?.dispose(); }
  let n = 0;
  for (const it of sel) {
    if (++n > 400) break;
    if (it.tipo === 'peca') {
      const b = Livre.caixaLocal(it.mats); if (b.isEmpty()) b.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
      const s = b.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.05, 0.05, 0.05)), c = b.getCenter(new THREE.Vector3());
      const l = new THREE.LineSegments(_caixaUnit, it === principal ? matSel : matSel2);
      l.matrixAutoUpdate = false; l.matrix.copy(Livre.matrizColocacao(it.obj, FX, new THREE.Matrix4())).multiply(new THREE.Matrix4().compose(c, new THREE.Quaternion(), s));
      l.renderOrder = 20; raizSel.add(l);
    } else {
      const pts = ptsMundo(it); if (pts.length < 2) continue;
      const curva = new THREE.CatmullRomCurve3(pts, !!it.d.f, 'centripetal');
      const g = new THREE.BufferGeometry().setFromPoints(curva.getPoints(Math.max(8, pts.length * 12)).map(p => p.add(new THREE.Vector3(0, 0.08, 0))));
      const l = new THREE.Line(g, it === principal ? matSel : matSel2); l.renderOrder = 20; raizSel.add(l);
    }
  }
  alcas();
  if (verColisao) desenharColisao();
}
/* path handles (one sphere per point of each selected path) */
const geoAlca = new THREE.SphereGeometry(1, 12, 8);
const matAlca = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }), matAlcaOn = new THREE.MeshBasicMaterial({ color: 0x3a8ef6, depthTest: false });
function alcas() {
  for (const o of [...raizAlcas.children]) raizAlcas.remove(o);
  const lista = [...sel].filter(i => i.tipo === 'caminho'); if (desenho && !lista.includes(desenho.cam)) lista.push(desenho.cam);
  for (const c of lista) ptsMundo(c).forEach((p, i) => {
    const m = new THREE.Mesh(geoAlca, pontoSel?.cam === c && pontoSel.i === i ? matAlcaOn : matAlca);
    m.position.copy(p); m.renderOrder = 22; m.userData.alca = { cam: c, i }; raizAlcas.add(m);
  });
}

// ── gizmo ─────────────────────────────────────────────────────────────────────
const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform.getHelper());
transform.setSize(0.9);
let baseArraste = null, altNoClique = false;
renderer.domElement.addEventListener('pointerdown', ev => { altNoClique = ev.altKey; }, true);
function centroSel() {
  const b = new THREE.Box3(), t = new THREE.Box3();
  for (const it of sel) b.union(caixaItem(it, t));
  return b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
}
function prenderGizmo() {
  const modo = { move: 'translate', scale: 'scale', rotate: 'rotate' }[ferramenta];
  if (pontoSel && existe(pontoSel.cam)) {                         // a path point: move only
    const p = ptsMundo(pontoSel.cam)[pontoSel.i];
    if (!p) { pontoSel = null; return prenderGizmo(); }
    proxy.position.copy(p); proxy.quaternion.identity(); proxy.scale.set(1, 1, 1);
    transform.setMode('translate'); transform.attach(proxy); return;
  }
  if (!modo || !sel.size || inserir || desenho) { transform.detach(); return; }
  if (sel.size === 1 && principal?.tipo === 'peca') {
    proxy.position.copy(posMundo(principal)); proxy.quaternion.copy(quatDe(principal)); const s = escDe(principal); proxy.scale.set(s.x, s.y, s.z);
  } else { proxy.position.copy(centroSel()); proxy.quaternion.identity(); proxy.scale.set(1, 1, 1); }
  transform.setMode(modo); transform.attach(proxy);
}
transform.addEventListener('dragging-changed', e => {
  if (e.value) {
    let clones = null;
    if (altNoClique && transform.getMode() === 'translate' && !pontoSel) clones = clonar([...sel], false);
    baseArraste = { itens: new Map([...sel].map(it => [it, estadoDe(it)])), pos: proxy.position.clone(), quat: proxy.quaternion.clone(), esc: proxy.scale.clone(), clones,
      mundo: new Map([...sel].map(it => [it, it.tipo === 'peca' ? { p: posMundo(it), q: quatDe(it), s: escDe(it) } : { pts: ptsMundo(it) }])) };
    if (pontoSel) baseArraste.itens.set(pontoSel.cam, estadoDe(pontoSel.cam));
    if (clones?.length) toast('Cloned ' + clones.length + ' (Alt + drag).');
  } else if (baseArraste) {
    const a = acaoEstados(baseArraste.itens);
    const acoes = []; if (baseArraste.clones?.length) acoes.push({ t: 'add', itens: baseArraste.clones }); if (a) acoes.push(a);
    if (acoes.length) registrar(acoes.length === 1 ? acoes[0] : { t: 'grupo', acoes });
    baseArraste = null; prenderGizmo(); realcar(); renderProps(); agendarArvore();
  }
});
transform.addEventListener('objectChange', () => {
  const B = baseArraste; if (!B) return;
  if (pontoSel) {
    const c = pontoSel.cam, p = proxy.position;
    c.d.pts[pontoSel.i] = [r3(FX * p.x), r3(p.y), r3(p.z)];
    atualizarCaminho(c); realcar(); marcarSujo(); return;
  }
  const modo = transform.getMode();
  const dq = proxy.quaternion.clone().multiply(B.quat.clone().invert());
  const piv = B.pos, d = proxy.position.clone().sub(B.pos);
  const ratio = new THREE.Vector3(proxy.scale.x / B.esc.x, proxy.scale.y / B.esc.y, proxy.scale.z / B.esc.z);
  const unica = sel.size === 1 && principal?.tipo === 'peca';
  for (const it of sel) {
    const m = B.mundo.get(it); if (!m) continue;
    if (it.tipo === 'peca') {
      if (modo === 'translate') setPosMundo(it, m.p.clone().add(d));
      else if (modo === 'rotate') { setPosMundo(it, m.p.clone().sub(piv).applyQuaternion(dq).add(piv)); setRotQuat(it, dq.clone().multiply(m.q)); }
      else if (unica) setEsc(it, { x: proxy.scale.x, y: proxy.scale.y, z: proxy.scale.z });
      else { setEsc(it, { x: m.s.x * ratio.x, y: m.s.y * ratio.y, z: m.s.z * ratio.z }); setPosMundo(it, m.p.clone().sub(piv).multiply(ratio).add(piv)); }
      atualizarInst(it);
    } else {
      const novo = m.pts.map(p => modo === 'translate' ? p.clone().add(d) : modo === 'rotate' ? p.clone().sub(piv).applyQuaternion(dq).add(piv) : p.clone().sub(piv).multiply(ratio).add(piv));
      it.d.pts = novo.map(p => [r3(FX * p.x), r3(p.y), r3(p.z)]);
      atualizarCaminho(it);
    }
  }
  realcar(); marcarSujo(); renderPropsSeQuieto();
});
function aplicarSnap() {
  transform.setTranslationSnap($('snap-mov').checked ? Math.max(0.01, +$('snap-mov-v').value || 0.5) : null);
  transform.setRotationSnap($('snap-rot').checked ? G2R(Math.max(1, +$('snap-rot-v').value || 15)) : null);
  transform.setScaleSnap($('snap-mov').checked ? 0.05 : null);
}
const passoMov = () => $('snap-mov').checked ? Math.max(0.01, +$('snap-mov-v').value || 0.5) : 0;
function usarFerramenta(f) {
  ferramenta = f;
  for (const k of ['select', 'move', 'scale', 'rotate']) $('t-' + k).classList.toggle('on', k === f);
  if (f !== 'select' && inserir) cancelarInserir();
  prenderGizmo();
}

// ── camera (Studio-style fly) ─────────────────────────────────────────────────
const cam = { yaw: 0, pitch: -0.5, teclas: new Set(), olhando: false, panando: false, ultimo: null };
function aplicarCam() { camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ'); }
function olharPara(alvo, dist) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  camera.position.copy(alvo).addScaledVector(dir, -dist);
}
function enquadrarTudo() {
  const b = new THREE.Box3(), t = new THREE.Vector3();
  for (const p of pecas) b.expandByPoint(posMundo(p));
  for (const c of caminhos) for (const p of ptsMundo(c)) b.expandByPoint(p);
  if (b.isEmpty()) { camera.position.set(30, 25, 30); cam.yaw = Math.PI / 4; cam.pitch = -0.6; aplicarCam(); return; }
  const c = b.getCenter(t), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.z, 20);
  chaoRef = b.min.y;
  cam.yaw = 0; cam.pitch = -0.75; aplicarCam();
  olharPara(new THREE.Vector3(c.x, b.min.y, c.z), Math.min(r * 0.75, 400));
}
function focar() {
  if (!sel.size) { enquadrarTudo(); return; }
  const b = new THREE.Box3(), t = new THREE.Box3(); for (const it of sel) b.union(caixaItem(it, t));
  const s = b.getSize(new THREE.Vector3()).length();
  olharPara(b.getCenter(new THREE.Vector3()), Math.max(4, s * 1.4));
}
renderer.domElement.addEventListener('pointerdown', ev => {
  renderer.domElement.focus({ preventScroll: true });
  if (ev.button === 2) { cam.olhando = true; cam.ultimo = [ev.clientX, ev.clientY]; renderer.domElement.setPointerCapture(ev.pointerId); }
  else if (ev.button === 1) { ev.preventDefault(); cam.panando = true; cam.ultimo = [ev.clientX, ev.clientY]; renderer.domElement.setPointerCapture(ev.pointerId); }
});
renderer.domElement.addEventListener('pointermove', ev => {
  if (!cam.ultimo || (!cam.olhando && !cam.panando)) return;
  const dx = ev.clientX - cam.ultimo[0], dy = ev.clientY - cam.ultimo[1]; cam.ultimo = [ev.clientX, ev.clientY];
  if (cam.olhando) { cam.yaw -= dx * 0.004; cam.pitch = THREE.MathUtils.clamp(cam.pitch - dy * 0.004, -1.55, 1.55); aplicarCam(); }
  else {
    const k = Math.max(0.02, alturaCam() * 0.0025 + 0.01);
    const dir = new THREE.Vector3(), dir2 = new THREE.Vector3();
    dir.setFromMatrixColumn(camera.matrixWorld, 0); dir2.setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(dir, -dx * k).addScaledVector(dir2, dy * k);
  }
});
const soltarCam = ev => { if (ev.button === 2) cam.olhando = false; if (ev.button === 1) cam.panando = false; if (!cam.olhando && !cam.panando) cam.ultimo = null; };
renderer.domElement.addEventListener('pointerup', soltarCam);
renderer.domElement.addEventListener('pointercancel', () => { cam.olhando = cam.panando = false; cam.ultimo = null; });
const alturaCam = () => Math.max(1, Math.abs(camera.position.y - chaoRef));
renderer.domElement.addEventListener('wheel', ev => {
  ev.preventDefault();
  raioDe(ev);
  const h = raycaster.intersectObjects(instGrupos, false)[0];
  const dist = h ? h.distance : alturaCam() * 1.5;
  const passo = Math.max(0.4, dist * 0.14) * (ev.deltaY > 0 ? -1 : 1) * (ev.shiftKey ? 0.3 : 1);
  if (passo > 0 && h && h.distance - passo < 0.8) return;
  camera.position.addScaledVector(raycaster.ray.direction, passo);
}, { passive: false });
let tAnterior = performance.now();
function voar(dt) {
  if (!cam.teclas.size || document.activeElement?.closest?.('input,select,textarea')) return;
  const v = (+$('cam-vel').value || 20) * (cam.teclas.has('ShiftLeft') || cam.teclas.has('ShiftRight') ? 0.25 : 1) * dt;
  const f = new THREE.Vector3(), r = new THREE.Vector3(); camera.getWorldDirection(f); r.setFromMatrixColumn(camera.matrixWorld, 0);
  const m = new THREE.Vector3();
  if (cam.teclas.has('KeyW')) m.add(f); if (cam.teclas.has('KeyS')) m.sub(f);
  if (cam.teclas.has('KeyD')) m.add(r); if (cam.teclas.has('KeyA')) m.sub(r);
  if (cam.teclas.has('KeyE')) m.y += 1; if (cam.teclas.has('KeyQ')) m.y -= 1;
  if (m.lengthSq()) camera.position.addScaledVector(m.normalize(), v);
}
// axis widget
const eixosCtx = $('eixos').getContext('2d');
function desenharEixos() {
  const g = eixosCtx, W = 128; g.clearRect(0, 0, W, W);
  const inv = camera.quaternion.clone().invert();
  const ax = [['X', new THREE.Vector3(1, 0, 0), '#ff5a5a'], ['Y', new THREE.Vector3(0, 1, 0), '#5aff7a'], ['Z', new THREE.Vector3(0, 0, 1), '#5aa0ff']]
    .map(([n, v, c]) => [n, v.applyQuaternion(inv), c]).sort((a, b) => a[1].z - b[1].z);
  for (const [n, v, c] of ax) {
    const x = 64 + v.x * 42, y = 64 - v.y * 42;
    g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(x, y); g.stroke();
    g.fillStyle = c; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 13px Segoe UI'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, x, y + 1);
  }
}
(function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - tAnterior) / 1000); tAnterior = t;
  voar(dt);
  for (const m of raizAlcas.children) m.scale.setScalar(Math.max(0.12, camera.position.distanceTo(m.position) * 0.012));
  renderer.render(scene, camera);
  desenharEixos();
  $('st-cam').textContent = 'cam ' + camera.position.x.toFixed(0) + ', ' + camera.position.y.toFixed(0) + ', ' + camera.position.z.toFixed(0);
})(performance.now());

// ── viewport mouse: select / slide / marquee / place / path ───────────────────
let gesto = null;   // { tipo:'clique'|'arrastar'|'caixa', x, y, ... }
renderer.domElement.addEventListener('pointerdown', ev => {
  if (ev.button !== 0 || transform.dragging || transform.axis) return;
  const base = { x: ev.clientX, y: ev.clientY, ctrl: ev.ctrlKey || ev.metaKey || ev.shiftKey, alt: ev.altKey, id: ev.pointerId };
  if (inserir) { gesto = { ...base, tipo: 'inserir' }; return; }
  if (desenho) { gesto = { ...base, tipo: 'ponto' }; return; }
  raioDe(ev);
  const a = raycaster.intersectObjects(raizAlcas.children, false)[0];
  if (a) { pontoSel = a.object.userData.alca; sel.add(pontoSel.cam); principal = pontoSel.cam; depoisSelecao(); gesto = null; return; }
  const h = pegar(ev);
  gesto = { ...base, tipo: h ? 'peca' : 'vazio', hit: h };
});
/* the raycasts of the mouse move (ghost, path preview, slide) run once per frame: Kanto has 42k pieces */
let movPend = null, movAgendado = false;
function agendarMov(ev) {
  movPend = ev; if (movAgendado) return; movAgendado = true;
  requestAnimationFrame(() => { movAgendado = false; const e = movPend; movPend = null; if (!e) return; if (inserir) moverFantasma(e); if (desenho) previaDesenho(e); if (gesto?.tipo === 'deslize') deslizar(e); });
}
renderer.domElement.addEventListener('pointermove', ev => {
  if (inserir || desenho) agendarMov(ev);
  if (!gesto || cam.olhando || cam.panando) return;
  const moveu = Math.hypot(ev.clientX - gesto.x, ev.clientY - gesto.y) > 4;
  if (!moveu) return;
  if (gesto.tipo === 'peca' && ferramenta !== 'scale' && ferramenta !== 'rotate') iniciarDeslize(ev);
  else if (gesto.tipo === 'vazio' || (gesto.tipo === 'peca' && (ferramenta === 'scale' || ferramenta === 'rotate'))) { gesto.tipo = 'caixa'; renderer.domElement.setPointerCapture(ev.pointerId); }
  if (gesto.tipo === 'deslize') agendarMov(ev);
  else if (gesto.tipo === 'caixa') { const m = $('marquee'), r = tela.getBoundingClientRect(); m.hidden = false; m.style.left = Math.min(gesto.x, ev.clientX) - r.left + 'px'; m.style.top = Math.min(gesto.y, ev.clientY) - r.top + 'px'; m.style.width = Math.abs(ev.clientX - gesto.x) + 'px'; m.style.height = Math.abs(ev.clientY - gesto.y) + 'px'; }
});
renderer.domElement.addEventListener('pointerup', ev => {
  if (ev.button !== 0 || !gesto) return;
  const g = gesto; gesto = null;
  if (g.tipo === 'inserir') { if (Math.hypot(ev.clientX - g.x, ev.clientY - g.y) < 5) colocarFantasma(ev, ev.shiftKey); return; }
  if (g.tipo === 'ponto') { if (Math.hypot(ev.clientX - g.x, ev.clientY - g.y) < 5) adicionarPontoDesenho(ev); return; }
  if (g.tipo === 'deslize') { fimDeslize(g); return; }
  if (g.tipo === 'caixa') { $('marquee').hidden = true; selecionarCaixa(g, ev); return; }
  if (g.tipo === 'peca') { const grupo = g.alt ? [g.hit.it] : doModelo(g.hit.it); if (g.ctrl) alternar(grupo); else selecionarVarios(grupo); return; }
  if (g.tipo === 'vazio' && !g.ctrl) limparSelecao();
});
renderer.domElement.addEventListener('dblclick', ev => { if (desenho) { terminarDesenho(); return; } });
function selecionarCaixa(g, ev) {
  const r = renderer.domElement.getBoundingClientRect();
  const x0 = Math.min(g.x, ev.clientX) - r.left, x1 = Math.max(g.x, ev.clientX) - r.left, y0 = Math.min(g.y, ev.clientY) - r.top, y1 = Math.max(g.y, ev.clientY) - r.top;
  const v = new THREE.Vector3(), achados = [], b = new THREE.Box3();
  const dentro = p => { v.copy(p).project(camera); if (v.z > 1 || v.z < -1) return false; const sx = (v.x + 1) / 2 * r.width, sy = (1 - v.y) / 2 * r.height; return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; };
  for (const p of pecas) if (visivel[p.lista] && !travadoItem(p) && dentro(caixaMundo(p, b).getCenter(_v))) achados.push(p);
  if (visivel.caminhos && !travado.caminhos) for (const c of caminhos) if (ptsMundo(c).some(dentro)) achados.push(c);
  const comModelos = [...new Set(achados.flatMap(it => g.alt ? [it] : doModelo(it)))];
  if (g.ctrl) selecionarVarios(comModelos, { somar: true }); else selecionarVarios(comModelos);
  saida(comModelos.length + ' selected by box');
}
/* SLIDE (the Studio drag): the piece follows the cursor over the surfaces under it, bottom resting on what it hits */
function iniciarDeslize(ev) {
  const g = gesto, it = g.hit.it;
  if (!sel.has(it)) { if (g.ctrl) alternar(g.alt ? [it] : doModelo(it)); else selecionarVarios(g.alt ? [it] : doModelo(it)); }
  let clones = null;
  if (g.alt) clones = clonar([...sel], false);
  const b = new THREE.Box3(), t = new THREE.Box3(); for (const s of sel) b.union(caixaItem(s, t));
  g.tipo = 'deslize';
  g.base = new Map([...sel].map(s => [s, estadoDe(s)]));
  g.mundo = new Map([...sel].map(s => [s, s.tipo === 'peca' ? posMundo(s) : ptsMundo(s)]));
  g.agarre = g.hit.ponto.clone(); g.minY = b.min.y; g.clones = clones;
  renderer.domElement.setPointerCapture(ev.pointerId);
  transform.detach();
}
function deslizar(ev) {
  const g = gesto;
  const colar = $('colar-sup').checked;
  let alvo = colar ? superficie(ev, { excluir: sel, yPlano: g.minY }) : null;
  if (!alvo) { raioDe(ev); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -g.agarre.y); alvo = new THREE.Vector3(); if (!raycaster.ray.intersectPlane(pl, alvo)) return; alvo.y = g.minY + (g.agarre.y - g.minY); }
  const d = new THREE.Vector3(alvo.x - g.agarre.x, colar ? alvo.y - g.minY : 0, alvo.z - g.agarre.z);
  const passo = passoMov(); if (passo) { d.x = Math.round(d.x / passo) * passo; d.z = Math.round(d.z / passo) * passo; }
  for (const it of sel) {
    const m = g.mundo.get(it); if (!m) continue;
    if (it.tipo === 'peca') setPosMundo(it, m.clone().add(d)); else it.d.pts = m.map(p => [r3(FX * (p.x + d.x)), r3(p.y + d.y), r3(p.z + d.z)]);
    atualizarItem(it);
  }
  realcar(); marcarSujo(); renderPropsSeQuieto();
}
function fimDeslize(g) {
  const a = g.base ? acaoEstados(g.base) : null, acoes = [];
  if (g.clones?.length) acoes.push({ t: 'add', itens: g.clones });
  if (a) acoes.push(a);
  if (acoes.length) registrar(acoes.length === 1 ? acoes[0] : { t: 'grupo', acoes });
  prenderGizmo(); realcar(); renderProps(); agendarArvore();
}

// ── clone / duplicate / delete / copy-paste ───────────────────────────────────
function novaPeca(chave, obj, lista = 'objetos') {
  return { tipo: 'peca', id: proxId++, obj, lista, mats: partes.get(chave) || [], inst: [] };
}
function clonarItem(it) {
  if (it.tipo === 'peca') return novaPeca(chaveNome(it.obj.n), { ...it.obj }, it.lista);
  return { tipo: 'caminho', id: proxId++, d: JSON.parse(JSON.stringify(it.d)), mesh: null };
}
/** Copies of `itens`, inserted (not registered). Models get a fresh group name. */
function clonar(itens, deslocar = true) {
  const novosG = new Map(), copias = [];
  for (const it of itens) {
    const c = clonarItem(it);
    if (c.tipo === 'peca' && c.obj.g) { if (!novosG.has(c.obj.g)) novosG.set(c.obj.g, nomeModeloLivre(c.obj.g)); c.obj.g = novosG.get(c.obj.g); }
    if (deslocar) { if (c.tipo === 'peca') c.obj.x = r3(c.obj.x + FX * 2); else c.d.pts = c.d.pts.map(p => [r3(p[0] + FX * 2), p[1], p[2]]); }
    porItem(c); copias.push(c);
  }
  reconstruir(); marcarSujo();
  return copias;
}
function nomeModeloLivre(base = 'Model') {
  const usados = new Set(pecas.map(p => p.obj.g).filter(Boolean));
  base = String(base).replace(/\s*\d+$/, '') || 'Model';
  for (let i = 1; ; i++) { const n = base + i; if (!usados.has(n)) return n; }
}
function duplicar() {
  if (!sel.size) return;
  const c = clonar([...sel], true);
  registrar({ t: 'add', itens: c }); selecionarVarios(c); toast('Duplicated ' + c.length + '.');
}
function deletar() {
  if (pontoSel) {                                                  // a path point
    const c = pontoSel.cam; if (c.d.pts.length <= 2) { toast('A path needs at least 2 points — delete the path instead.', true); return; }
    const antes = new Map([[c, estadoDe(c)]]); c.d.pts.splice(pontoSel.i, 1); pontoSel = null;
    atualizarCaminho(c); registrar(acaoEstados(antes)); depoisSelecao(); return;
  }
  if (!sel.size) return;
  const itens = [...sel].map(it => [it, (it.tipo === 'peca' ? pecas : caminhos).indexOf(it)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]);
  for (const [it] of itens) tirarItem(it);
  registrar({ t: 'del', itens: itens.reverse() });
  limparSelecao(); reconstruir(); toast('Deleted ' + itens.length + '.');
}
let prancheta = null;
const CHAVE_COPIA = 'studio3d.copia';
function copiar() {
  if (!sel.size) return;
  const c0 = centroSel();
  prancheta = [...sel].map(it => it.tipo === 'peca'
    ? { tipo: 'peca', prefab: chaveNome(it.obj.n), obj: { ...it.obj }, lista: it.lista, d: posMundo(it).sub(c0).toArray() }
    : { tipo: 'caminho', d: JSON.parse(JSON.stringify(it.d)), c0: c0.toArray() });
  try { localStorage.setItem(CHAVE_COPIA, JSON.stringify(prancheta)); } catch {}
  toast('Copied ' + prancheta.length + ' (Ctrl+V pastes under the mouse).');
}
let ultimoMouse = null;
renderer.domElement.addEventListener('pointermove', ev => { ultimoMouse = ev; });
async function colar() {
  let P = prancheta; if (!P) try { P = JSON.parse(localStorage.getItem(CHAVE_COPIA) || 'null'); } catch {}
  if (!P?.length) { toast('Nothing copied yet.', true); return; }
  await Promise.all([...new Set(P.filter(x => x.tipo === 'peca').map(x => x.prefab))].map(garantirPrefab));
  const alvo = (ultimoMouse && superficie(ultimoMouse)) || centroSel();
  const novosG = new Map(), copias = [];
  for (const x of P) {
    if (x.tipo === 'peca') {
      if (!(partes.get(x.prefab) || []).length) continue;
      const obj = { ...x.obj }; const w = alvo.clone().add(new THREE.Vector3(...x.d));
      obj.x = r3(FX * w.x); obj.y = r3(w.y); obj.z = r3(w.z);
      if (obj.g) { if (!novosG.has(obj.g)) novosG.set(obj.g, nomeModeloLivre(obj.g)); obj.g = novosG.get(obj.g); }
      const p = novaPeca(x.prefab, obj, x.lista); porItem(p); copias.push(p);
    } else {
      const c0 = new THREE.Vector3(...x.c0), d = alvo.clone().sub(c0);
      const c = { tipo: 'caminho', id: proxId++, d: { ...x.d, pts: x.d.pts.map(p => [r3(p[0] + FX * d.x), r3(p[1] + d.y), r3(p[2] + d.z)]) }, mesh: null };
      porItem(c); copias.push(c);
    }
  }
  if (!copias.length) { toast('None of the copied pieces exist in any library.', true); return; }
  reconstruir(); registrar({ t: 'add', itens: copias }); selecionarVarios(copias); toast('Pasted ' + copias.length + '.');
}

// ── transforms by key / buttons ───────────────────────────────────────────────
function girarSel(eixo, graus) {
  if (!sel.size || transform.dragging) return;
  const antes = new Map([...sel].map(it => [it, estadoDe(it)]));
  const piv = sel.size === 1 && principal?.tipo === 'peca' ? posMundo(principal) : centroSel();
  const dq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(eixo === 'x' ? 1 : 0, eixo === 'y' ? 1 : 0, eixo === 'z' ? 1 : 0), G2R(graus));
  for (const it of sel) {
    if (it.tipo === 'peca') { setPosMundo(it, posMundo(it).sub(piv).applyQuaternion(dq).add(piv)); setRotQuat(it, dq.clone().multiply(quatDe(it))); }
    else it.d.pts = ptsMundo(it).map(p => p.sub(piv).applyQuaternion(dq).add(piv)).map(p => [r3(FX * p.x), r3(p.y), r3(p.z)]);
    atualizarItem(it);
  }
  registrar(acaoEstados(antes)); prenderGizmo(); realcar(); renderProps();
}
/** Drop every selected piece straight down onto what is under it. */
function soltarNoChao() {
  const pecasSel = [...sel].filter(i => i.tipo === 'peca'); if (!pecasSel.length) return;
  const antes = new Map(pecasSel.map(it => [it, estadoDe(it)])), b = new THREE.Box3(); let n = 0;
  for (const it of pecasSel) {
    caixaMundo(it, b); const c = b.getCenter(new THREE.Vector3());
    raycaster.set(new THREE.Vector3(c.x, b.max.y + 0.05, c.z), new THREE.Vector3(0, -1, 0));
    const h = raycaster.intersectObjects(instGrupos, false).find(h => { const p = h.object.userData.membros[h.instanceId]?.peca; return p && !sel.has(p); });
    const y = h ? h.point.y : chaoRef;
    const p = posMundo(it); p.y += y - b.min.y; setPosMundo(it, p); atualizarInst(it); n++;
  }
  registrar(acaoEstados(antes)); prenderGizmo(); realcar(); renderProps(); saida('Dropped ' + n + ' onto the surface.');
}
function agrupar() {
  const ps = [...sel].filter(i => i.tipo === 'peca'); if (ps.length < 1) { toast('Select pieces to group.', true); return; }
  const antes = new Map(ps.map(it => [it, estadoDe(it)])), nome = nomeModeloLivre('Model');
  for (const p of ps) p.obj.g = nome;
  registrar(acaoEstados(antes)); renderProps(); agendarArvore(); toast('Grouped ' + ps.length + ' into ' + nome + '. Click selects the model, Alt+click a single part.');
}
function desagrupar() {
  const ps = [...sel].filter(i => i.tipo === 'peca' && i.obj.g); if (!ps.length) return;
  const antes = new Map(ps.map(it => [it, estadoDe(it)]));
  for (const p of ps) delete p.obj.g;
  registrar(acaoEstados(antes)); renderProps(); agendarArvore(); toast('Ungrouped ' + ps.length + '.');
}

// ── loading ───────────────────────────────────────────────────────────────────
function partesDe(raiz) { const l = []; raiz.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) l.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone(), nome: o.name }); }); return l; }
let indiceLib = null;
async function carregarIndiceLib() {
  if (indiceLib) return indiceLib;
  try { const r = await fetch('/scenery/lib/index.json', { cache: 'no-cache' }); indiceLib = r.ok ? (await r.json()).prefabs || {} : {}; } catch { indiceLib = {}; }
  return indiceLib;
}
const carregandoLib = new Map();
function garantirPrefab(k) {
  if ((partes.get(k) || []).length) return Promise.resolve(true);
  if (!carregandoLib.has(k)) carregandoLib.set(k, (async () => {
    const e = (await carregarIndiceLib())[k]; if (!e) return false;
    const dono = partes;
    try {
      const g = await loader.loadAsync('/scenery/lib/' + e.f); if (dono !== partes) return false;
      g.scene.updateMatrixWorld(true); const l = partesDe(g.scene); if (!l.length) return false;
      partes.set(k, l); if (!nomeDoPrefab.has(k)) nomeDoPrefab.set(k, e.n);
      for (const p of pecas) if (chaveNome(p.obj.n) === k) p.mats = l;
      return true;
    } catch (err) { console.warn('shared prefab', k, err); carregandoLib.delete(k); return false; }
  })());
  return carregandoLib.get(k);
}
function aplicarSelecaoMapa() { const s = $('sel-mapa'); const hit = [...s.options].find(o => o.value === mapaAtual && (!mapaRotulo || o.textContent === mapaRotulo)); if (hit) hit.selected = true; else s.value = mapaAtual; }
function montarOpcoesMapa() {
  const q = ($('mapa-busca').value || '').trim().toLowerCase();
  const opts = []; for (const m of mapasDisponiveis) opts.push(...opcoesMapa(m));
  opts.sort((a, b) => a.label.localeCompare(b.label, 'en'));
  let vis = q ? opts.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : opts;
  if (mapaAtual && !vis.some(o => o.value === mapaAtual)) { const k = opts.find(o => o.value === mapaAtual); if (k) vis = [k, ...vis]; }
  $('sel-mapa').innerHTML = vis.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  aplicarSelecaoMapa();
}
async function listarMapas() {
  await carregarNomes();
  const r = await api('/admin/mapas-glb');
  mapasDisponiveis = (r.mapas || []).filter(m => m !== 'pallet_route1');   // the one assembled map stays in the classic editor
  glbDoMapa = r.glb || {};
  montarOpcoesMapa();
  if (!mapasDisponiveis.length) { $('carregando').textContent = 'No library maps found.'; return; }
  const pedido = new URLSearchParams(location.search).get('map');
  let ultimo = null; try { ultimo = localStorage.getItem('studio3d.mapa'); } catch {}
  await carregarMapa([pedido, ultimo, 'kanto'].find(m => m && mapasDisponiveis.includes(m)) || mapasDisponiveis[0]);
}
async function carregarMapa(nome, rotulo) {
  $('carregando').hidden = false; $('carregando').textContent = 'loading ' + (rotulo || nomeMapa(nome)) + '…';
  mapaAtual = nome; mapaRotulo = rotulo || opcoesMapa(nome)[0]?.label || nomeMapaComId(nome); aplicarSelecaoMapa();
  try { localStorage.setItem('studio3d.mapa', nome); } catch {}
  cancelarInserir(); terminarDesenho(true); limparSelecao();
  pecas = []; caminhos = []; partes = new Map(); nomeDoPrefab = new Map(); carregandoLib.clear(); historico = []; refazer = []; botoesHist();
  reconstruir();
  let g; try { g = await loader.loadAsync('/scenery/' + (glbDoMapa[nome] || nome) + '.glb'); }
  catch (e) { $('carregando').textContent = 'Could not load the GLB of ' + nome + '.'; return; }
  g.scene.updateMatrixWorld(true);
  const mapaNode = g.scene.getObjectByName('Mapa') || g.scene;
  const amostra = mapaNode.children.slice(0, 10).map(n => n.name || '');
  if (amostra.filter(n => /^lib/i.test(n)).length <= amostra.length / 2) {
    $('carregando').innerHTML = 'This map is an <b>assembled</b> GLB (not a prefab library).<br>Edit it in the <a href="/admin/scenery">classic editor</a>.'; return;
  }
  for (const prefab of mapaNode.children) { const l = partesDe(prefab); if (l.length) { const k = chaveNome(prefab.name); partes.set(k, l); nomeDoPrefab.set(k, prefab.name.replace(/^lib:?/i, '')); } }
  for (const extra of ['/scenery/prop/library_extra.glb', '/scenery/prop/lamppost.glb']) {
    try {
      const x = await loader.loadAsync(extra); x.scene.updateMatrixWorld(true);
      if (/lamppost/.test(extra)) { const l = partesDe(x.scene); if (l.length) { partes.set(chaveNome('prop/lamppost'), l); nomeDoPrefab.set(chaveNome('prop/lamppost'), 'prop/lamppost'); } continue; }
      for (const prefab of (x.scene.getObjectByName('Mapa') || x.scene).children) { const l = partesDe(prefab); if (l.length) { const k = chaveNome(prefab.name); partes.set(k, l); nomeDoPrefab.set(k, prefab.name.replace(/^lib:?/i, '')); } }
    } catch (e) { console.warn(extra, e); }
  }
  const r = await api('/admin/mapa-objetos?map=' + encodeURIComponent(nome));
  if (!r.ok) { $('carregando').textContent = r.erro || 'Could not read the map objects.'; return; }
  for (const lista of ['areaEnv', 'ambiente', 'objetos']) for (const o of r[lista] || []) {
    const obj = { ...o, x: +o.x || 0, y: +o.y || 0, z: +o.z || 0 }; const k = chaveNome(obj.n);
    if (!nomeDoPrefab.has(k)) nomeDoPrefab.set(k, obj.n);
    pecas.push(novaPeca(k, obj, lista));
  }
  caminhos = (r.caminhos || []).map(d => Livre.limparCaminho(d)).filter(Boolean).map(d => ({ tipo: 'caminho', id: proxId++, d, mesh: null }));
  const proprios = new Set(partes.keys()), indice = await carregarIndiceLib();
  const faltam = [...new Set(pecas.map(p => chaveNome(p.obj.n)))].filter(k => !proprios.has(k) && indice[k]);
  if (faltam.length) { $('carregando').textContent = 'loading ' + faltam.length + ' shared prefab(s)…'; await Promise.all(faltam.map(garantirPrefab)); }
  tipos = [...proprios].sort().map(k => ({ id: k, nome: nomeDoPrefab.get(k) || k, ext: false }));
  for (const k of Object.keys(indice).sort()) if (!proprios.has(k)) tipos.push({ id: k, nome: indice[k].n, de: indice[k].de, ext: true });
  reconstruir(); enquadrarTudo(); renderToolbox(); renderProps();
  sujo = false; $('sujo').hidden = true; $('carregando').hidden = true;
  const livres = pecas.filter(p => Livre.ehLivre(p.obj)).length;
  $('st-mapa').innerHTML = `<b>${esc(mapaRotulo)}</b> · ${pecas.length} pieces · ${caminhos.length} paths${livres ? ' · ' + livres + ' free' : ''}`;
  saida('Loaded ' + nome + '.');
}

// ── toolbox (with lazy 3D thumbnails) ─────────────────────────────────────────
const thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbR.setSize(128, 128); thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.toneMapping = THREE.ACESFilmicToneMapping;
const thumbScene = new THREE.Scene(); thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x666655, 1.6)); { const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(3, 5, 4); thumbScene.add(d); }
const thumbCam = new THREE.PerspectiveCamera(35, 1, 0.01, 5000);
const thumbs = new Map(), filaThumb = []; let gerando = false;
function pedirThumb(k, el) { if (thumbs.has(k)) { el.style.backgroundImage = `url(${thumbs.get(k)})`; el.textContent = ''; return; } filaThumb.push([k, el]); if (!gerando) gerarThumbs(); }
async function gerarThumbs() {
  gerando = true;
  while (filaThumb.length) {
    const [k, el] = filaThumb.pop();
    if (!el.isConnected) continue;
    if (!thumbs.has(k)) {
      if (!(partes.get(k) || []).length && !(await garantirPrefab(k))) { thumbs.set(k, ''); continue; }
      const g = new THREE.Group();
      for (const m of partes.get(k)) { const me = new THREE.Mesh(m.geo, m.mat); me.matrixAutoUpdate = false; me.matrix.copy(m.local); g.add(me); }
      thumbScene.add(g); g.updateMatrixWorld(true);
      const b = Livre.caixaLocal(partes.get(k)), c = b.getCenter(new THREE.Vector3()), r = Math.max(0.3, b.getSize(new THREE.Vector3()).length() / 2);
      const dist = r / Math.sin(G2R(thumbCam.fov / 2)) * 1.02;
      thumbCam.position.copy(c).add(new THREE.Vector3(0.8, 0.62, 1).normalize().multiplyScalar(dist)); thumbCam.near = dist / 100; thumbCam.far = dist * 4; thumbCam.updateProjectionMatrix(); thumbCam.lookAt(c);
      thumbR.render(thumbScene, thumbCam);
      thumbs.set(k, thumbR.domElement.toDataURL('image/png'));
      thumbScene.remove(g);
      await new Promise(r => setTimeout(r, 0));
    }
    if (thumbs.get(k)) { el.style.backgroundImage = `url(${thumbs.get(k)})`; el.textContent = ''; }
  }
  gerando = false;
}
const obsThumb = new IntersectionObserver(ents => { for (const e of ents) if (e.isIntersecting) { obsThumb.unobserve(e.target); pedirThumb(e.target.dataset.k, e.target); } }, { root: $('tb-grade'), rootMargin: '120px' });
let limiteTb = 240;
function renderToolbox() {
  const f = ($('tb-busca').value || '').trim().toLowerCase(), esc0 = $('tb-escopo').value;
  const vis = tipos.filter(t => (esc0 === 'mapa' ? !t.ext : esc0 === 'outros' ? t.ext : true) && (!f || rotuloPrefab(t.nome).toLowerCase().includes(f) || String(t.nome).toLowerCase().includes(f)));
  $('tb-qtd').textContent = vis.length + ' / ' + tipos.length;
  const grade = $('tb-grade'); obsThumb.disconnect(); grade.innerHTML = '';
  for (const t of vis.slice(0, limiteTb)) {
    const d = document.createElement('div'); d.className = 'carta' + (t.ext ? ' ext' : '') + (inserir?.tipo.id === t.id ? ' on' : '');
    d.title = rotuloPrefab(t.nome) + '\n' + t.nome + (t.ext ? '\nshared library · from ' + (nomeMapa(t.de) || t.de) : '');
    d.draggable = true; d.dataset.id = t.id;
    d.innerHTML = `<div class="th" data-k="${esc(t.id)}">◇</div><div class="nm">${esc(rotuloPrefab(t.nome))}</div>`;
    d.onclick = () => iniciarInserir(t);
    d.ondragstart = ev => { ev.dataTransfer.setData('text/x-prefab', t.id); ev.dataTransfer.effectAllowed = 'copy'; };
    grade.appendChild(d); obsThumb.observe(d.firstChild);
  }
  if (vis.length > limiteTb) { const b = document.createElement('button'); b.className = 'btn tb-mais'; b.textContent = 'Show ' + Math.min(240, vis.length - limiteTb) + ' more…'; b.onclick = () => { limiteTb += 240; renderToolbox(); }; grade.appendChild(b); }
}
$('tb-busca').addEventListener('input', () => { limiteTb = 240; renderToolbox(); });
$('tb-escopo').addEventListener('change', () => { limiteTb = 240; renderToolbox(); });
tela.addEventListener('dragover', ev => { if ([...ev.dataTransfer.types].includes('text/x-prefab')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
tela.addEventListener('drop', async ev => {
  const id = ev.dataTransfer.getData('text/x-prefab'); if (!id) return; ev.preventDefault();
  const t = tipos.find(x => x.id === id); if (!t) return;
  await iniciarInserir(t); moverFantasma(ev); colocarFantasma(ev, false);
});

/* PLACE: a ghost of the prefab follows the cursor, resting on the surface. Click places, Shift+click keeps placing, R turns. */
async function iniciarInserir(t) {
  cancelarInserir(); terminarDesenho();
  if (!(partes.get(t.id) || []).length) { saida('Loading ' + rotuloPrefab(t.nome) + '…'); if (!await garantirPrefab(t.id)) { toast('Could not load ' + t.nome + '.', true); return; } }
  const g = new THREE.Group();
  for (const m of partes.get(t.id)) { const me = new THREE.Mesh(m.geo, m.mat); me.matrixAutoUpdate = false; me.matrix.copy(m.local); g.add(me); }
  g.visible = false; scene.add(g);
  const b = Livre.caixaLocal(partes.get(t.id));
  inserir = { tipo: t, ghost: g, rotY: 0, base: b.isEmpty() ? 0 : -b.min.y };
  transform.detach();
  $('banner').hidden = false; $('banner').innerHTML = `Placing <b>${esc(rotuloPrefab(t.nome))}</b> · click to place · Shift+click keeps placing · R turns 90° (Alt: 15°) · Esc cancels`;
  renderToolbox();
}
function cancelarInserir() {
  if (!inserir) return;
  scene.remove(inserir.ghost); inserir = null; $('banner').hidden = true; renderToolbox(); prenderGizmo();
}
function moverFantasma(ev) {
  if (!inserir) return;
  const p = superficie(ev); if (!p) { inserir.ghost.visible = false; return; }
  const passo = passoMov(); if (passo) { p.x = Math.round(p.x / passo) * passo; p.z = Math.round(p.z / passo) * passo; }
  inserir.ghost.visible = true; inserir.ghost.position.set(p.x, p.y + inserir.base, p.z); inserir.ghost.rotation.set(0, G2R(inserir.rotY), 0);
  inserir.ponto = inserir.ghost.position.clone();
}
function colocarFantasma(ev, continuar) {
  if (!inserir) return;
  moverFantasma(ev); if (!inserir.ponto) return;
  const t = inserir.tipo, k = t.id, w = inserir.ponto;
  const obj = { n: nomeDoPrefab.get(k) || t.nome, x: r3(FX * w.x), y: r3(w.y), z: r3(w.z) };
  if (inserir.rotY) obj.r = grausArquivo(inserir.rotY);
  const info = infoNome(obj.n), b = Livre.caixaLocal(partes.get(k)), s = b.getSize(new THREE.Vector3());
  /* precise collision by default for new props — except floors, water, walk-through plants and room shells / huge pieces, which the
     legacy rules handle (doors open in the grid, room shells only block their border) */
  if (novaPrecisa && !info.piso && !info.agua && !info.atravessa && !/wall|barriergate/.test(chaveNome(obj.n)) && Math.max(s.x, s.z) < 20) obj.col = 'caixa';
  const p = novaPeca(k, obj, 'objetos'); porItem(p);
  rebuildInstancias(); registrar({ t: 'add', itens: [p] });
  if (!continuar) { cancelarInserir(); selecionarVarios([p]); } else { agendarArvore(); }
  saida('Placed ' + rotuloPrefab(t.nome) + '.');
}

// ── paths ─────────────────────────────────────────────────────────────────────
const linhaPrevia = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.3, depthTest: false }));
linhaPrevia.renderOrder = 23; linhaPrevia.visible = false; scene.add(linhaPrevia);
function iniciarDesenho() {
  if (desenho) { terminarDesenho(); return; }
  cancelarInserir();
  const alvo = sel.size === 1 && principal?.tipo === 'caminho' ? principal : null;
  if (alvo) desenho = { cam: alvo, novo: false, antes: estadoDe(alvo) };
  else { const c = { tipo: 'caminho', id: proxId++, d: { pts: [], w: +$('cam-larg')?.value || 2.4, est: 'terra', irr: 0.35 }, mesh: null }; desenho = { cam: c, novo: true }; }
  $('t-caminho').classList.add('on'); transform.detach(); pontoSel = null;
  $('banner').hidden = false; $('banner').innerHTML = (alvo ? 'Extending the path' : 'New path') + ' · click the ground to add points · Backspace removes the last · <b>Enter</b> / double-click ends · Esc ends';
  alcas();
}
function adicionarPontoDesenho(ev) {
  const p = superficie(ev, { soPiso: true }); if (!p) return;   // paths stick to floors, not to walls or trees
  const c = desenho.cam; c.d.pts.push([r3(FX * p.x), r3(p.y), r3(p.z)]);
  if (desenho.novo && c.d.pts.length === 1) { /* not in the list until it has 2 points */ }
  if (desenho.novo && c.d.pts.length === 2) porItem(c);
  if (existe(c)) atualizarCaminho(c);
  alcas(); marcarSujo();
}
function previaDesenho(ev) {
  const c = desenho.cam, n = c.d.pts.length; if (!n) { linhaPrevia.visible = false; return; }
  const p = superficie(ev, { soPiso: true }); if (!p) return;
  const a = ptsMundo(c)[n - 1];
  linhaPrevia.geometry.setFromPoints([a.clone().add(new THREE.Vector3(0, 0.1, 0)), p.add(new THREE.Vector3(0, 0.1, 0))]); linhaPrevia.computeLineDistances(); linhaPrevia.visible = true;
}
function terminarDesenho(silencioso = false) {
  if (!desenho) return;
  const { cam: c, novo, antes } = desenho; desenho = null;
  linhaPrevia.visible = false; $('t-caminho').classList.remove('on'); $('banner').hidden = true;
  if (novo) {
    if (c.d.pts.length >= 2) { registrar({ t: 'add', itens: [c] }); if (!silencioso) { selecionarVarios([c]); toast('Path created (' + c.d.pts.length + ' points). Tune width, style and irregularity in Properties.'); } }
    else tirarItem(c);
  } else if (antes) { const a = acaoEstados(new Map([[c, antes]])); if (a) registrar(a); }
  alcas(); prenderGizmo(); renderProps(); agendarArvore();
}
function inserirPontoDepois() {
  if (!pontoSel) return; const c = pontoSel.cam, i = pontoSel.i, pts = c.d.pts;
  const j = i + 1 < pts.length ? i + 1 : (c.d.f ? 0 : -1);
  const antes = new Map([[c, estadoDe(c)]]);
  const a = pts[i], b = j >= 0 ? pts[j] : [a[0] + (a[0] - (pts[i - 1] || a)[0]) || a[0] + FX, a[1], a[2] + (a[2] - (pts[i - 1] || a)[2])];
  pts.splice(i + 1, 0, [r3((a[0] + b[0]) / 2), r3((a[1] + b[1]) / 2), r3((a[2] + b[2]) / 2)]);
  pontoSel = { cam: c, i: i + 1 }; atualizarCaminho(c); registrar(acaoEstados(antes)); depoisSelecao();
}

// ── collision preview ─────────────────────────────────────────────────────────
const matColV = new THREE.LineBasicMaterial({ color: 0xff4d4d, depthTest: false, transparent: true, opacity: 0.9 });
const matColP = new THREE.LineBasicMaterial({ color: 0x3ee07a, depthTest: false, transparent: true, opacity: 0.55 });
const matColL = new THREE.LineBasicMaterial({ color: 0xff9b2e, depthTest: false, transparent: true, opacity: 0.9 });
function desenharColisao() {
  for (const o of [...raizCol.children]) { raizCol.remove(o); o.geometry.dispose(); }
  if (!verColisao) return;
  const V = [], P = [], L = [];
  let n = 0;
  for (const it of sel) {
    if (it.tipo !== 'peca' || ++n > 150) continue;
    const info = infoNome(it.obj.n);
    if (Livre.ehLivre(it.obj)) {
      const C = Livre.criarColisao(), M = Livre.matrizColocacao(it.obj, FX);
      const secas = it.mats.filter(m => !EH_AGUA.test(String(m.nome || '').toLowerCase()));
      C.adicionar(secas, M, Livre.modoColisao(it.obj, info), Livre.ehAndavel(it.obj, info));
      for (const f of C.formas) {
        if (f.t === 'seg') { V.push(f.a[0], f.y0, f.a[1], f.b[0], f.y0, f.b[1], f.a[0], f.y1, f.a[1], f.b[0], f.y1, f.b[1]); continue; }
        for (let a = 0, b = f.h.length - 1; a < f.h.length; b = a++) for (const y of [f.y0, f.y1]) V.push(f.h[b][0], y, f.h[b][1], f.h[a][0], y, f.h[a][1]);
        for (const p of f.h) V.push(p[0], f.y0, p[1], p[0], f.y1, p[1]);
      }
      for (const t of C.pisos.slice(0, 20000)) P.push(t[0], t[1] + 0.02, t[2], t[3], t[4] + 0.02, t[5], t[3], t[4] + 0.02, t[5], t[6], t[7] + 0.02, t[8], t[6], t[7] + 0.02, t[8], t[0], t[1] + 0.02, t[2]);
    } else {
      /* the legacy 1 m grid, as instanciarBiblioteca rasterizes it (simplified: tall non-floor = blocked cells) */
      const b = Livre.caixaLocal(it.mats); if (b.isEmpty()) continue;
      const wx = FX * it.obj.x, y = (+it.obj.y || 0) + 0.04;
      if (info.piso || info.agua) continue;
      if (b.max.y - b.min.y <= 0.6 || info.atravessa) continue;
      const x0 = Math.floor(wx + b.min.x + 0.15), x1 = Math.max(x0, Math.floor(wx + b.max.x - 0.15)), z0 = Math.floor(it.obj.z + b.min.z + 0.15), z1 = Math.max(z0, Math.floor(it.obj.z + b.max.z - 0.15));
      if (x1 - x0 > 60 || z1 - z0 > 60) continue;
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) L.push(x, y, z, x + 1, y, z, x + 1, y, z, x + 1, y, z + 1, x + 1, y, z + 1, x, y, z + 1, x, y, z + 1, x, y, z, x, y, z, x + 1, y, z + 1);
    }
  }
  for (const [arr, mat] of [[V, matColV], [P, matColP], [L, matColL]]) if (arr.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const l = new THREE.LineSegments(g, mat); l.renderOrder = 21; raizCol.add(l); }
}

// ── explorer ──────────────────────────────────────────────────────────────────
const abertos = new Set(['ws', 'L:objetos', 'L:caminhos']);
let arvoreAgendada = false;
function agendarArvore() { if (arvoreAgendada) return; arvoreAgendada = true; requestAnimationFrame(() => { arvoreAgendada = false; renderArvore(); }); }
function renderArvore() {
  const f = ($('ex-busca').value || '').trim().toLowerCase();
  const linhas = [];
  const no = (nivel, o) => linhas.push(`<div class="no${o.sel ? ' sel' : ''}${o.cls ? ' ' + o.cls : ''}" style="padding-left:${4 + nivel * 14}px" data-k="${esc(o.k)}"${o.title ? ` title="${esc(o.title)}"` : ''}><span class="seta">${o.seta ?? ''}</span><span class="ico">${o.ico || ''}</span><span class="rot">${esc(o.rot)}</span>${o.cnt != null ? `<span class="cnt">${o.cnt}</span>` : ''}${o.tg || ''}</div>`);
  const tog = l => `<span class="tg"><span class="${visivel[l] ? 'on' : ''}" data-vis="${l}" title="Show / hide in the editor">👁</span><span class="${travado[l] ? 'on' : ''}" data-trava="${l}" title="Locked: cannot be clicked or box-selected in the viewport">🔒</span></span>`;
  no(0, { k: 'ws', rot: 'Workspace', ico: '🌍', seta: abertos.has('ws') ? '▾' : '▸' });
  if (abertos.has('ws')) {
    for (const l of ['areaEnv', 'ambiente', 'objetos']) {
      const ps = pecas.filter(p => p.lista === l), k = 'L:' + l, ab = abertos.has(k) || !!f;
      no(1, { k, rot: LISTAS[l].nome, ico: LISTAS[l].ico, cnt: ps.length, seta: ab ? '▾' : '▸', tg: tog(l) });
      if (!ab) continue;
      const modelos = new Map(), porPrefab = new Map();
      for (const p of ps) { if (p.obj.g) { if (!modelos.has(p.obj.g)) modelos.set(p.obj.g, []); modelos.get(p.obj.g).push(p); } else { const kp = chaveNome(p.obj.n); if (!porPrefab.has(kp)) porPrefab.set(kp, []); porPrefab.get(kp).push(p); } }
      for (const [g, lista] of [...modelos].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (f && !g.toLowerCase().includes(f) && !lista.some(p => rotuloPrefab(p.obj.n).toLowerCase().includes(f))) continue;
        const km = 'M:' + l + ':' + g, abm = abertos.has(km);
        no(2, { k: km, rot: g, ico: '🧩', cnt: lista.length, seta: abm ? '▾' : '▸', sel: lista.every(p => sel.has(p)) });
        if (abm) for (const p of lista.slice(0, 300)) no(3, { k: 'P:' + p.id, rot: rotuloPrefab(p.obj.n), ico: Livre.ehLivre(p.obj) ? '◆' : '▫', sel: sel.has(p), title: p.obj.n });
      }
      for (const [kp, lista] of [...porPrefab].sort((a, b) => rotuloPrefab(a[1][0].obj.n).localeCompare(rotuloPrefab(b[1][0].obj.n)))) {
        const rot = rotuloPrefab(lista[0].obj.n);
        if (f && !rot.toLowerCase().includes(f) && !kp.includes(f)) continue;
        const kf = 'F:' + l + ':' + kp, abf = abertos.has(kf);
        no(2, { k: kf, rot, ico: '📁', cnt: lista.length, seta: abf ? '▾' : '▸', title: lista[0].obj.n + ' — double-click selects all ' + lista.length });
        if (abf) {
          for (const p of lista.slice(0, 300)) no(3, { k: 'P:' + p.id, rot: rot + ' #' + p.id, ico: Livre.ehLivre(p.obj) ? '◆' : '▫', sel: sel.has(p), title: (Livre.ehLivre(p.obj) ? 'free placement (precise collision)' : 'legacy grid collision') });
          if (lista.length > 300) no(3, { k: 'x', rot: '+' + (lista.length - 300) + ' more (select with a box or double-click the folder)', cls: 'mais' });
        }
      }
    }
    const k = 'L:caminhos', ab = abertos.has(k) || !!f;
    no(1, { k, rot: 'Paths', ico: '〰️', cnt: caminhos.length, seta: ab ? '▾' : '▸', tg: tog('caminhos') });
    if (ab) caminhos.forEach((c, i) => { const rot = c.d.nome || 'Path ' + (i + 1); if (!f || rot.toLowerCase().includes(f)) no(2, { k: 'C:' + c.id, rot, ico: '〰', cnt: c.d.pts.length + ' pts', sel: sel.has(c) }); });
  }
  $('arvore').innerHTML = linhas.join('');
  $('ex-qtd').textContent = pecas.length + caminhos.length;
}
const itemPorChave = k => k.startsWith('P:') ? pecas.find(p => p.id === +k.slice(2)) : k.startsWith('C:') ? caminhos.find(c => c.id === +k.slice(2)) : null;
function itensDoNo(k) {
  if (k.startsWith('M:')) { const [, l, ...g] = k.split(':'); const nome = g.join(':'); return pecas.filter(p => p.lista === l && p.obj.g === nome); }
  if (k.startsWith('F:')) { const [, l, ...kp] = k.split(':'); const kk = kp.join(':'); return pecas.filter(p => p.lista === l && !p.obj.g && chaveNome(p.obj.n) === kk); }
  if (k.startsWith('L:')) { const l = k.slice(2); return l === 'caminhos' ? [...caminhos] : pecas.filter(p => p.lista === l); }
  const it = itemPorChave(k); return it ? [it] : [];
}
$('arvore').addEventListener('click', ev => {
  const t = ev.target;
  if (t.dataset.vis) { visivel[t.dataset.vis] = !visivel[t.dataset.vis]; reconstruir(); return; }
  if (t.dataset.trava) { travado[t.dataset.trava] = !travado[t.dataset.trava]; agendarArvore(); saida((LISTAS[t.dataset.trava]?.nome || 'Paths') + (travado[t.dataset.trava] ? ' locked' : ' unlocked')); return; }
  const row = t.closest('.no'); if (!row) return; const k = row.dataset.k;
  const ehPasta = k === 'ws' || k.startsWith('L:') || k.startsWith('F:') || (k.startsWith('M:') && t.classList.contains('seta'));
  if (ehPasta) { abertos.has(k) ? abertos.delete(k) : abertos.add(k); agendarArvore(); return; }
  const itens = itensDoNo(k); if (!itens.length) return;
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey) alternar(itens); else selecionarVarios(itens);
});
$('arvore').addEventListener('dblclick', ev => {
  const row = ev.target.closest('.no'); if (!row) return; const k = row.dataset.k;
  if (k.startsWith('F:') || k.startsWith('M:')) { selecionarVarios(itensDoNo(k)); focar(); }
  else if (k.startsWith('P:') || k.startsWith('C:')) focar();
});
$('ex-busca').addEventListener('input', agendarArvore);

// ── properties ────────────────────────────────────────────────────────────────
function renderPropsSeQuieto() { if (!$('props').contains(document.activeElement)) renderProps(); }
function comum(vals) { return vals.every(v => v === vals[0]) ? vals[0] : null; }
const fmt = v => v == null ? '' : String(+(+v).toFixed(3));
function renderProps() {
  const P = $('props'), itens = [...sel];
  $('pr-qtd').textContent = itens.length > 1 ? itens.length + ' items' : '';
  if (!itens.length) { P.innerHTML = `<div class="pvazio">Select something in the viewport or the Explorer.<br><br><b>New pieces</b><label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="col-nova" ${novaPrecisa ? 'checked' : ''}> precise collision by default</label></div>`; $('col-nova').onchange = e => { novaPrecisa = e.target.checked; try { localStorage.setItem('studio3d.colNova', novaPrecisa ? '1' : '0'); } catch {} }; return; }
  const ps = itens.filter(i => i.tipo === 'peca'), cs = itens.filter(i => i.tipo === 'caminho');
  let h = '';
  if (pontoSel) {
    const p = pontoSel.cam.d.pts[pontoSel.i] || [0, 0, 0];
    h += `<div class="pcat">Path point ${pontoSel.i + 1} / ${pontoSel.cam.d.pts.length}</div>
      <div class="prow"><label>Position</label><div class="xyz"><input type="number" step="0.1" data-pt="0" value="${fmt(FX * p[0])}"><input type="number" step="0.1" data-pt="1" value="${fmt(p[1])}"><input type="number" step="0.1" data-pt="2" value="${fmt(p[2])}"></div></div>
      <div class="pacoes"><button class="btn" data-acao="ins-ponto">Insert point after</button><button class="btn" data-acao="del-ponto">Delete point</button><button class="btn" data-acao="sair-ponto">Done</button></div>`;
  }
  if (ps.length) {
    const nomes = comum(ps.map(p => p.obj.n)), lista = comum(ps.map(p => p.lista)), g = comum(ps.map(p => p.obj.g || ''));
    const pos = ps.map(posMundo), rot = ps.map(rotDe), es = ps.map(escDe);
    const c3 = (arr, k) => comum(arr.map(v => +(+v[k]).toFixed(3)));
    const col = comum(ps.map(p => p.obj.col || '')), pi = comum(ps.map(p => p.obj.pi == null ? '' : String(p.obj.pi)));
    const livres = ps.filter(p => Livre.ehLivre(p.obj)).length;
    const efeito = ps.length === 1
      ? (Livre.ehLivre(ps[0].obj) ? 'Game: precise ' + ({ caixa: 'box', malha: 'mesh', nada: 'none' }[Livre.modoColisao(ps[0].obj, infoNome(ps[0].obj.n))]) + (Livre.ehAndavel(ps[0].obj, infoNome(ps[0].obj.n)) ? ' · walkable surface' : '') : 'Game: legacy 1 m grid (the piece is not rotated, scaled or set to a precise mode)')
      : `${livres} of ${ps.length} use precise collision, the rest the legacy 1 m grid.`;
    h += `<div class="pcat">Data</div>
      <div class="prow"><label>Name</label><div><span title="${esc(nomes || '')}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nomes ? rotuloPrefab(nomes) : '— mixed —')}</span></div></div>
      ${nomes ? `<div class="prow"><label>Prefab</label><div><span class="fraco" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px" title="${esc(nomes)}">${esc(nomes)}</span></div></div>` : ''}
      <div class="prow"><label>Parent</label><div><select data-campo="lista">${lista ? '' : '<option value="">— mixed —</option>'}${Object.entries(LISTAS).map(([k, v]) => `<option value="${k}" ${lista === k ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></div></div>
      <div class="prow"><label>Model</label><div><input type="text" data-campo="g" value="${esc(g ?? '')}" placeholder="${g === null ? '— mixed —' : '(none)'}"></div></div>
      <div class="pcat">Transform${ps.length > 1 ? ' <span class="fraco">(each piece)</span>' : ''}</div>
      <div class="prow"><label title="World coordinates (what the player sees)">Position</label><div class="xyz">${['x', 'y', 'z'].map(k => `<input type="number" step="0.1" data-pos="${k}" value="${fmt(c3(pos, k))}" placeholder="—">`).join('')}</div></div>
      <div class="prow"><label title="Degrees, Euler XYZ in world (Y = turn)">Orientation</label><div class="xyz">${['x', 'y', 'z'].map(k => `<input type="number" step="5" data-rot="${k}" value="${fmt(c3(rot, k))}" placeholder="—">`).join('')}</div></div>
      <div class="prow"><label title="Scale factor per axis (1 = original size)">Scale</label><div class="xyz">${['x', 'y', 'z'].map(k => `<input type="number" step="0.1" min="0.01" data-esc="${k}" value="${fmt(c3(es, k))}" placeholder="—">`).join('')}</div></div>
      <div class="prow"><label>Uniform</label><div><input type="number" step="0.1" min="0.01" data-uni="1" placeholder="set all three" title="Type a factor to set X, Y and Z at once"></div></div>
      <div class="pcat">Collision</div>
      <div class="prow"><label>Collision</label><div><select data-campo="col">${col === null ? '<option value="?">— mixed —</option>' : ''}
        <option value="" ${col === '' ? 'selected' : ''}>Auto</option>
        <option value="caixa" ${col === 'caixa' ? 'selected' : ''}>Precise box</option>
        <option value="malha" ${col === 'malha' ? 'selected' : ''}>Precise mesh</option>
        <option value="nada" ${col === 'nada' ? 'selected' : ''}>None (walk through)</option></select></div></div>
      <div class="prow"><label>Walkable</label><div><select data-campo="pi">${pi === null ? '<option value="?">— mixed —</option>' : ''}
        <option value="" ${pi === '' ? 'selected' : ''}>Auto (floors)</option><option value="1" ${pi === '1' ? 'selected' : ''}>Yes — stand on top</option><option value="0" ${pi === '0' ? 'selected' : ''}>No</option></select></div></div>
      <div class="pnota">${esc(efeito)}<br><b>Auto</b> keeps the legacy 1 m grid unless the piece is rotated or scaled. <b>Mesh</b> follows the real shape (fences, arches, rocks).</div>
      <div class="pacoes"><button class="btn" data-acao="dup">Duplicate</button><button class="btn" data-acao="soltar">Drop to surface</button><button class="btn" data-acao="zrot">Reset rotation</button><button class="btn" data-acao="zesc">Reset scale</button><button class="btn" data-acao="del" style="color:var(--erro)">Delete</button></div>`;
  }
  if (cs.length) {
    const d = k => comum(cs.map(c => c.d[k] ?? ''));
    h += `<div class="pcat">Path${cs.length > 1 ? 's (' + cs.length + ')' : ''}</div>
      ${cs.length === 1 ? `<div class="prow"><label>Name</label><div><input type="text" data-cam="nome" value="${esc(cs[0].d.nome || '')}" placeholder="Path ${caminhos.indexOf(cs[0]) + 1}"></div></div>` : ''}
      <div class="prow"><label>Style</label><div><select data-cam="est">${d('est') === null ? '<option value="?">— mixed —</option>' : ''}${Object.entries(Livre.ESTILOS).map(([k, v]) => `<option value="${k}" ${d('est') === k ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></div></div>
      <div class="prow"><label>Width (m)</label><div><input type="number" step="0.2" min="0.2" max="40" data-cam="w" value="${fmt(d('w'))}" placeholder="—"></div></div>
      <div class="prow"><label title="0 = clean edges, 1 = very ragged, wandering edges">Irregularity</label><div><input type="range" min="0" max="1" step="0.05" data-cam="irr" value="${d('irr') ?? 0.35}" style="width:100%"></div></div>
      <div class="prow"><label title="Also counts as floor in the game (a dirt bridge over a gap). Off = just paint on the ground.">Walkable</label><div><input type="checkbox" data-cam="pi" ${d('pi') ? 'checked' : ''}></div></div>
      <div class="prow"><label>Closed loop</label><div><input type="checkbox" data-cam="f" ${d('f') ? 'checked' : ''}></div></div>
      ${cs.length === 1 ? `<div class="pnota">${cs[0].d.pts.length} points · click a white handle to move it · the game lays the ribbon onto the real floor</div>` : ''}
      <div class="pacoes">${cs.length === 1 ? '<button class="btn" data-acao="estender">Add points</button>' : ''}<button class="btn" data-acao="inverter">Reverse</button><button class="btn" data-acao="dup">Duplicate</button><button class="btn" data-acao="del" style="color:var(--erro)">Delete</button></div>`;
  }
  P.innerHTML = h;
}
let novaPrecisa = (() => { try { return localStorage.getItem('studio3d.colNova') !== '0'; } catch { return true; } })();
function mudarSel(fn) {   // apply fn(item) to every selected item, one undo step
  const antes = new Map([...sel].map(it => [it, estadoDe(it)]));
  for (const it of sel) { fn(it); }
  const a = acaoEstados(antes); if (!a) return;
  const mudouLista = a.itens.some(([it, de]) => it.tipo === 'peca' && de.lista !== it.lista);
  if (mudouLista) rebuildInstancias(); else for (const [it] of a.itens) atualizarItem(it);
  registrar(a); prenderGizmo(); realcar(); renderProps(); agendarArvore();
}
$('props').addEventListener('change', ev => {
  const t = ev.target, v = t.value;
  if (t.dataset.pt != null) {
    const c = pontoSel?.cam; if (!c) return; const antes = new Map([[c, estadoDe(c)]]);
    const p = c.d.pts[pontoSel.i], i = +t.dataset.pt; p[i] = r3(i === 0 ? FX * (+v || 0) : +v || 0);
    atualizarCaminho(c); registrar(acaoEstados(antes)); prenderGizmo(); realcar(); return;
  }
  if (t.dataset.pos) { if (v === '') return; mudarSel(it => { if (it.tipo !== 'peca') return; const p = posMundo(it); p[t.dataset.pos] = +v || 0; setPosMundo(it, p); }); return; }
  if (t.dataset.rot) { if (v === '') return; mudarSel(it => { if (it.tipo !== 'peca') return; const r = rotDe(it); r[t.dataset.rot] = +v || 0; setRot(it, r); }); return; }
  if (t.dataset.esc) { if (v === '') return; mudarSel(it => { if (it.tipo !== 'peca') return; const s = escDe(it); s[t.dataset.esc] = +v || 1; setEsc(it, s); }); return; }
  if (t.dataset.uni) { if (v === '') return; mudarSel(it => { if (it.tipo === 'peca') setEsc(it, { x: +v, y: +v, z: +v }); }); return; }
  if (t.dataset.campo === 'lista') { if (!LISTAS[v]) return; mudarSel(it => { if (it.tipo === 'peca') it.lista = v; }); return; }
  if (t.dataset.campo === 'g') { const n = v.trim().replace(/[^\w .\-]/g, '').slice(0, 40); mudarSel(it => { if (it.tipo !== 'peca') return; if (n) it.obj.g = n; else delete it.obj.g; }); return; }
  if (t.dataset.campo === 'col') { if (v === '?') return; mudarSel(it => { if (it.tipo !== 'peca') return; if (v) it.obj.col = v; else delete it.obj.col; }); return; }
  if (t.dataset.campo === 'pi') { if (v === '?') return; mudarSel(it => { if (it.tipo !== 'peca') return; if (v === '') delete it.obj.pi; else it.obj.pi = +v; }); return; }
  if (t.dataset.cam) {
    const k = t.dataset.cam; if (v === '?') return;
    mudarSel(it => {
      if (it.tipo !== 'caminho') return;
      if (k === 'pi' || k === 'f') { if (t.checked) it.d[k] = 1; else delete it.d[k]; }
      else if (k === 'w') it.d.w = Math.min(40, Math.max(0.2, +v || 2));
      else if (k === 'irr') it.d.irr = Math.min(1, Math.max(0, +v));
      else if (k === 'nome') { const n = v.trim().slice(0, 40); if (n) it.d.nome = n; else delete it.d.nome; }
      else it.d[k] = v;
    });
  }
});
$('props').addEventListener('input', ev => {   // live preview of the irregularity slider and width
  const t = ev.target; if (t.dataset.cam !== 'irr' && t.dataset.cam !== 'w') return;
  for (const it of sel) if (it.tipo === 'caminho') { it.d[t.dataset.cam] = t.dataset.cam === 'w' ? Math.min(40, Math.max(0.2, +t.value || 2)) : +t.value; atualizarCaminho(it); }
});
$('props').addEventListener('click', ev => {
  const a = ev.target.dataset?.acao; if (!a) return;
  if (a === 'dup') duplicar();
  else if (a === 'del') deletar();
  else if (a === 'soltar') soltarNoChao();
  else if (a === 'zrot') mudarSel(it => { if (it.tipo === 'peca') setRot(it, { x: 0, y: 0, z: 0 }); });
  else if (a === 'zesc') mudarSel(it => { if (it.tipo === 'peca') setEsc(it, { x: 1, y: 1, z: 1 }); });
  else if (a === 'estender') iniciarDesenho();
  else if (a === 'inverter') mudarSel(it => { if (it.tipo === 'caminho') it.d.pts.reverse(); });
  else if (a === 'ins-ponto') inserirPontoDepois();
  else if (a === 'del-ponto') deletar();
  else if (a === 'sair-ponto') { pontoSel = null; depoisSelecao(); }
});

// ── save ──────────────────────────────────────────────────────────────────────
const canal = new BroadcastChannel('p3d-admin');
async function salvar() {
  if (desenho) terminarDesenho();
  $('b-salvar').disabled = true; $('b-salvar').textContent = 'publishing…';
  try {
    const listas = { objetos: [], ambiente: [], areaEnv: [] };
    for (const p of pecas) listas[p.lista || 'objetos'].push(p.obj);
    const r = await api('/admin/mapa-objetos', 'POST', { mapa: mapaAtual, ...listas, caminhos: caminhos.map(c => c.d) });
    if (!r.ok) { toast(r.erro || 'Failed to save.', true); return; }
    const chk = await api('/admin/mapa-objetos?map=' + encodeURIComponent(mapaAtual));
    const perdeu = caminhos.length && !(chk.caminhos || []).length;
    const semEscala = pecas.some(p => p.obj.sx || p.obj.col) && ![...(chk.objetos || []), ...(chk.ambiente || []), ...(chk.areaEnv || [])].some(o => o.sx || o.col);
    if (perdeu || semEscala) toast('Saved, but the server dropped the new fields (paths / scale / collision). Restart the game server so it picks up the new rules.', true);
    else toast('Published ' + r.total + ' pieces' + (caminhos.length ? ' + ' + caminhos.length + ' paths' : '') + '. Reload the game tab (Ctrl+Shift+R).');
    sujo = false; $('sujo').hidden = true;
    canal.postMessage({ t: 'dados-mudaram', arquivo: mapaAtual, cenario: true });
  } catch (e) { toast('Error saving: ' + e.message, true); }
  finally { $('b-salvar').disabled = false; $('b-salvar').textContent = 'Publish scenery'; }
}

// ── wiring ────────────────────────────────────────────────────────────────────
for (const k of ['select', 'move', 'scale', 'rotate']) $('t-' + k).onclick = () => usarFerramenta(k);
$('t-undo').onclick = desfazer; $('t-redo').onclick = refazerAcao;
$('t-espaco').onclick = () => { const l = transform.space === 'world'; transform.setSpace(l ? 'local' : 'world'); $('t-espaco-tx').textContent = l ? 'Local' : 'World'; $('t-espaco').classList.toggle('on', l); };
for (const id of ['snap-mov', 'snap-mov-v', 'snap-rot', 'snap-rot-v']) $(id).addEventListener('change', aplicarSnap);
aplicarSnap();
$('t-caminho').onclick = iniciarDesenho;
$('t-agrupar').onclick = agrupar; $('t-desagrupar').onclick = desagrupar; $('t-chao').onclick = soltarNoChao;
$('t-colisao').onclick = () => { verColisao = !verColisao; $('t-colisao').classList.toggle('on', verColisao); desenharColisao(); if (verColisao && !sel.size) saida('Select pieces to see their collision.'); };
$('t-grade').onclick = () => { grade.visible = !grade.visible; grade.position.y = chaoRef + 0.005; $('t-grade').classList.toggle('on', grade.visible); };
$('t-foco').onclick = focar;
$('t-trava-piso').onclick = () => { travaPisos = !travaPisos; $('t-trava-piso').classList.toggle('on', travaPisos); saida(travaPisos ? 'Floors and water locked: clicks go through them (the Explorer still selects them).' : 'Floors and water can be clicked.'); };
$('b-salvar').onclick = salvar;
$('b-descartar').onclick = async () => { if (sujo && !confirm('Discard unsaved changes?')) return; await carregarMapa(mapaAtual, mapaRotulo); };
$('mapa-busca').addEventListener('input', montarOpcoesMapa);
$('sel-mapa').onchange = async e => { if (sujo && !confirm('Switching maps discards unsaved changes. Continue?')) { aplicarSelecaoMapa(); return; } await carregarMapa(e.target.value, e.target.selectedOptions[0]?.textContent || ''); };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  const digitando = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'range';
  if (ctrl && k === 's') { e.preventDefault(); salvar(); return; }
  if (digitando) { if (e.key === 'Escape') e.target.blur(); return; }
  if (ctrl && (k === 'z' || k === 'y')) { e.preventDefault(); if (k === 'y' || e.shiftKey) refazerAcao(); else desfazer(); return; }
  if (ctrl && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); usarFerramenta(['select', 'move', 'scale', 'rotate'][+e.key - 1]); return; }
  if (ctrl && k === 'l') { e.preventDefault(); $('t-espaco').click(); return; }
  if (ctrl && k === 'c') { e.preventDefault(); copiar(); return; }
  if (ctrl && k === 'v') { e.preventDefault(); colar(); return; }
  if (ctrl && k === 'x') { e.preventDefault(); copiar(); deletar(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); duplicar(); return; }
  if (ctrl && k === 'g') { e.preventDefault(); agrupar(); return; }
  if (ctrl && k === 'u') { e.preventDefault(); desagrupar(); return; }
  if (ctrl && k === 'r') { e.preventDefault(); girarSel('y', (e.shiftKey ? -1 : 1) * (e.altKey ? 15 : 90)); return; }
  if (ctrl && k === 't') { e.preventDefault(); girarSel('x', (e.shiftKey ? -1 : 1) * (e.altKey ? 15 : 90)); return; }
  if (ctrl && k === 'a') { e.preventDefault(); selecionarVarios(pecas.filter(p => !travadoItem(p) && visivel[p.lista])); return; }
  if (ctrl) return;
  if (desenho && e.key === 'Enter') { terminarDesenho(); return; }
  if (desenho && e.key === 'Backspace') { e.preventDefault(); const c = desenho.cam; c.d.pts.pop(); if (desenho.novo && c.d.pts.length < 2) tirarItem(c); if (existe(c)) atualizarCaminho(c); else if (c.mesh) { raizCam.remove(c.mesh); c.mesh = null; } alcas(); return; }
  if (e.key === 'Escape') { if (inserir) cancelarInserir(); else if (desenho) terminarDesenho(); else if (pontoSel) { pontoSel = null; depoisSelecao(); } else limparSelecao(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deletar(); return; }
  if (inserir && k === 'r') { inserir.rotY = (inserir.rotY + (e.shiftKey ? -1 : 1) * (e.altKey ? 15 : 90)) % 360; if (ultimoMouse) moverFantasma(ultimoMouse); return; }
  if (k === 'r' && !inserir) { girarSel('y', (e.shiftKey ? -1 : 1) * (e.altKey ? 15 : 90)); return; }
  if (k === 'f') { focar(); return; }
  if (k === 'p') { iniciarDesenho(); return; }
  if (e.key === 'End') { e.preventDefault(); soltarNoChao(); return; }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { cam.teclas.add(e.code); if (e.code.startsWith('Key')) e.preventDefault(); }
});
addEventListener('keyup', e => cam.teclas.delete(e.code));
addEventListener('blur', () => cam.teclas.clear());
addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

window.__studio = { pecas: () => pecas, caminhos: () => caminhos, sel: () => [...sel], camera, scene, Livre, selecionarVarios, focar, iniciarDesenho, terminarDesenho, salvar };
listarMapas();
