/* 3D Scenery Editor — PokeVerse (local game). Supports BOTH map modes:
 *  • BIBLIOTECA (kanto e +71 mapas): o GLB tem os prefabs na origem ("lib:<nome>"); o cenário são os `objetos` do JSON
 *    ({n,x,y,z}, 42k no kanto). Edito os objetos e re-instancio os prefabs nas posições (igual ao `instanciarBiblioteca` do
 *    jogo). Salva em /admin/mapa-objetos (JSON).
 *  • MONTADO (só pallet_route1): o GLB já tem as peças posicionadas (os nós). Edito os nós. Salva o GLB (/admin/mapa-glb).
 * Render otimizado com InstancedMesh por tipo (1 draw call por tipo), pra aguentar os 42k do kanto. Só conta GM. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { carregar as carregarNomes, nomeMapa, nomeMapaComId, apelidosMapa, opcoesMapa, rotuloPrefab } from '/admin/map_names.mjs';

const BASE = location.protocol === 'https:' ? location.origin + '/servidor' : 'http://' + location.hostname + ':5190';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let token = localStorage.getItem('conta.token') || '';
const api = async (rota, metodo = 'GET', corpo) => {
  const r = await fetch(BASE + rota, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: corpo != null ? JSON.stringify(corpo) : undefined });
  let d = {}; try { d = await r.json(); } catch {} return { status: r.status, ok: r.ok, ...d };
};
const toast = (m, erro = false) => { const e = document.createElement('div'); if (erro) e.className = 'erro'; e.textContent = m; $('toast').appendChild(e); setTimeout(() => e.remove(), 4500); };
const chaveNome = n => n.toLowerCase().replace(/^lib:?/, '').replace(/\s/g, '_').replace(/[\[\]\.:/]/g, '');

const quem = await api('/admin/eu');
if (!quem.ok || !quem.gm) { location.href = '/admin'; throw new Error('precisa ser GM'); }

// ── Three ──────────────────────────────────────────────────────────────────────
const tela = $('tela');
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a0d12');
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 9000); camera.position.set(40, 40, 40);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
tela.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4a, 1.15));
const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(80, 140, 50); scene.add(sol);
const grade = new THREE.GridHelper(1400, 700, 0x3a4660, 0x1c2433); grade.position.y = -0.02; scene.add(grade);
const raizInst = new THREE.Group(); scene.add(raizInst);
const proxy = new THREE.Object3D(); scene.add(proxy);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.49;
orbit.zoomToCursor = true;
orbit.screenSpacePanning = false;                                         // keep the pivot on the ground plane — screen-space zoom left it hanging in the air
orbit.panSpeed = 1.6;
let chaoPivo = 0;                                                         // y of the map floor; Frame / pieces set this, orbit must not climb
orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
orbit.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
tela.addEventListener('contextmenu', ev => ev.preventDefault());
const pivo = (() => {
  const g = new THREE.Group(); g.name = 'orbitPivot';
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffcf3a, depthTest: false, depthWrite: false }));
  bola.renderOrder = 11; g.add(bola);
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.68, 40), new THREE.MeshBasicMaterial({ color: 0xffcf3a, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 }));
  anel.rotation.x = -Math.PI / 2; anel.renderOrder = 11; g.add(anel);
  const cruz = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.1, 0.02, 0), new THREE.Vector3(1.1, 0.02, 0),
    new THREE.Vector3(0, 0.02, -1.1), new THREE.Vector3(0, 0.02, 1.1),
  ]);
  const eixos = new THREE.LineSegments(cruz, new THREE.LineBasicMaterial({ color: 0xffcf3a, depthTest: false }));
  eixos.renderOrder = 11; g.add(eixos);
  scene.add(g); return g;
})();
function chaoDoMapa() {
  let y = 0, n = 0;
  for (const p of pecas){ y += p.pos.y; n++; }
  return n ? y / n : 0;                                                   // typical piece origin sits on the floor; bbox center was halfway up the map
}
const hastePivo = (() => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);
  const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffcf3a, depthTest: false, transparent: true, opacity: 0.75 }));
  ln.renderOrder = 10; scene.add(ln); return ln;
})();
function passoPivo() {
  const dist = camera.position.distanceTo(orbit.target);
  return THREE.MathUtils.clamp(dist * 0.04, 0.25, 12);
}
function subirPivo(dy) {
  if (!dy) return;
  orbit.target.y += dy;
  camera.position.y += dy;                                                // truck with the pivot so the view does not jump
  orbit.update();
  atualizarPivo();
}
function pivoNoChao() {
  const dy = chaoPivo - orbit.target.y;
  subirPivo(dy);
}
const _pivoF = new THREE.Vector3(), _pivoL = new THREE.Vector3();
function deslocarPivo(frente, lado) {
  if (!frente && !lado) return;
  camera.getWorldDirection(_pivoF);
  _pivoF.y = 0;
  if (_pivoF.lengthSq() < 1e-6) _pivoF.set(orbit.target.x - camera.position.x, 0, orbit.target.z - camera.position.z);
  if (_pivoF.lengthSq() < 1e-6) _pivoF.set(0, 0, -1);
  _pivoF.normalize();
  _pivoL.setFromMatrixColumn(camera.matrixWorld, 0);
  _pivoL.y = 0;
  if (_pivoL.lengthSq() < 1e-6) _pivoL.set(_pivoF.z, 0, -_pivoF.x);
  _pivoL.normalize();
  const s = passoPivo();
  const dx = _pivoF.x * frente * s + _pivoL.x * lado * s;
  const dz = _pivoF.z * frente * s + _pivoL.z * lado * s;
  orbit.target.x += dx; orbit.target.z += dz;
  camera.position.x += dx; camera.position.z += dz;
  orbit.update();
  atualizarPivo();
}
function atualizarPivo() {
  pivo.position.copy(orbit.target);
  const dist = camera.position.distanceTo(orbit.target);
  pivo.scale.setScalar(THREE.MathUtils.clamp(dist * 0.014, 0.5, 18));
  hastePivo.position.set(orbit.target.x, chaoPivo, orbit.target.z);
  hastePivo.scale.y = orbit.target.y - chaoPivo;
  hastePivo.visible = Math.abs(orbit.target.y - chaoPivo) > 0.05;
  if ($('hud-pivo')) $('hud-pivo').textContent = orbit.target.x.toFixed(1) + ', ' + orbit.target.y.toFixed(1) + ', ' + orbit.target.z.toFixed(1);
}
const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; });
transform.addEventListener('objectChange', () => {
  if (!selPeca) return;
  let x = proxy.position.x * fx, y = proxy.position.y, z = proxy.position.z;   // de world pra coords de edição (bib: flipX)
  if (snap) { x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2; z = Math.round(z * 2) / 2; proxy.position.set(x * fx, y, z); }
  setPos(selPeca, x, y, z); atualizarInst(selPeca); realcar(selPeca); marcarSujo(); atualizarCamposSel();
});
scene.add(transform.getHelper());

function resize() { const w = tela.clientWidth, h = tela.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h || 1; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(tela); resize();

// ── Estado ───────────────────────────────────────────────────────────────────
let modo = 'biblioteca';    // 'biblioteca' | 'montado'
let fx = -1;                // bib: flipX=-1 (mundo.x = -arquivo.x); montado: 1 (nó já em world)
let sceneGLB = null, mapaNode = null;
let partes = new Map();     // bib: chaveNome(prefab) → [{geo, mat, local}]
let nomeDoPrefab = new Map();
let pecas = [];             // lista unificada: { pos:Vector3, nome, mats:[{geo,mat,local}], inst:[{im,i}], obj?, node? }
let tipos = [];             // paleta: { id, nome, criar(pos)→peça }
let instGrupos = [];
let selPeca = null, boxHelper = null;
let sujo = false, mapaAtual = null, mapaRotulo = '', mapasDisponiveis = [], glbDoMapa = {}, ferramenta = 'sel', addTipo = null, snap = false;
const raycaster = new THREE.Raycaster();
const planoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _m4 = new THREE.Matrix4(), _T = new THREE.Matrix4();
const marcarSujo = () => { sujo = true; $('sujo').hidden = false; };
const matrizDe = (peca, local) => _m4.multiplyMatrices(_T.makeTranslation(fx * peca.pos.x, peca.pos.y, peca.pos.z), local);
function setPos(peca, x, y, z) {
  peca.pos.set(x, y, z);
  if (peca.obj) { peca.obj.x = x; peca.obj.y = y; peca.obj.z = z; }
  if (peca.node) peca.node.position.set(x, y, z);
}

(function loop() { requestAnimationFrame(loop); orbit.update(); atualizarPivo(); renderer.render(scene, camera); })();

// ── Carregar ──────────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
function aplicarSelecaoMapa() {
  const sel = $('sel-mapa');
  if (!sel) return;
  if (mapaRotulo) {
    const hit = [...sel.options].find(o => o.value === mapaAtual && o.textContent === mapaRotulo);
    if (hit) { hit.selected = true; return; }
  }
  sel.value = mapaAtual;
}

function montarOpcoesMapa() {
  const q = ($('mapa-busca')?.value || '').trim().toLowerCase();
  const opts = [];
  for (const m of mapasDisponiveis) opts.push(...opcoesMapa(m));
  opts.sort((a, b) => a.label.localeCompare(b.label, 'en'));
  let vis = q ? opts.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : opts;
  if (mapaAtual && !vis.some(o => o.value === mapaAtual && (!mapaRotulo || o.label === mapaRotulo))) {
    const keep = opts.find(o => o.value === mapaAtual && o.label === mapaRotulo) || opts.find(o => o.value === mapaAtual);
    if (keep) vis = [keep, ...vis];
  }
  $('sel-mapa').innerHTML = vis.map(o => `<option value="${esc(o.value)}" title="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  aplicarSelecaoMapa();
}

async function listarMapas() {
  await carregarNomes();
  const r = await api('/admin/mapas-glb');
  mapasDisponiveis = r.mapas || [];
  glbDoMapa = r.glb || {};
  montarOpcoesMapa();
  if (!mapasDisponiveis.length) { $('carregando').textContent = 'No maps with a local GLB.'; return; }
  await carregarMapa(mapasDisponiveis.includes('pallet_route1') ? 'pallet_route1' : mapasDisponiveis[0]);
}
async function carregarMapa(nome, rotulo) {
  $('carregando').hidden = false; $('carregando').textContent = 'loading ' + (rotulo || nomeMapa(nome)) + '…';
  mapaAtual = nome;
  if (rotulo) mapaRotulo = rotulo;
  else {
    const first = opcoesMapa(nome)[0];
    mapaRotulo = first?.label || nomeMapaComId(nome);
  }
  aplicarSelecaoMapa();
  deselecionar();
  for (const g of instGrupos) { raizInst.remove(g); g.dispose?.(); }
  instGrupos = []; pecas = []; partes = new Map(); nomeDoPrefab = new Map(); sceneGLB = null; mapaNode = null;
  let g;
  try { g = await loader.loadAsync('/scenery/' + (glbDoMapa[nome] || nome) + '.glb'); }
  catch (e) { $('carregando').textContent = 'could not load the GLB for ' + nome; return; }
  sceneGLB = g.scene; sceneGLB.updateMatrixWorld(true);
  mapaNode = g.scene.getObjectByName('Mapa') || g.scene;
  // o GLTFLoader tira o ":" dos nomes, então "lib:floor" chega como "libfloor": detecta biblioteca pela maioria dos nós começar com "lib"
  const amostra = mapaNode.children.slice(0, 10).map(n => n.name || '');
  modo = amostra.filter(nm => /^lib/i.test(nm)).length > amostra.length / 2 ? 'biblioteca' : 'montado';
  fx = modo === 'biblioteca' ? -1 : 1;
  if (modo === 'biblioteca') await montarBiblioteca(nome); else montarMontado();
  await extraLamppost();
  rebuildInstancias(); enquadrar(); renderPaleta();
  sujo = false; $('sujo').hidden = true; $('carregando').hidden = true; atualizarHud();
}

async function montarBiblioteca(nome) {
  for (const prefab of mapaNode.children) {   // prefabs "lib:..." na origem
    const lista = [];
    prefab.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) lista.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone() }); });
    if (lista.length) { const k = chaveNome(prefab.name); partes.set(k, lista); nomeDoPrefab.set(k, prefab.name.replace(/^lib:?/i, '')); }
  }
  const r = await api('/admin/mapa-objetos?map=' + encodeURIComponent(nome));
  // o cenário vem de 3 listas (o jogo monta na ordem areaEnv→ambiente→objetos): chão, água/céu, props
  const listas = { areaEnv: r.areaEnv || [], ambiente: r.ambiente || [], objetos: r.objetos || [] };
  for (const nomeL of ['areaEnv', 'ambiente', 'objetos']) for (const o of listas[nomeL]) {
    const obj = { ...o, n: o.n, x: +o.x || 0, y: +o.y || 0, z: +o.z || 0 };
    const k = chaveNome(obj.n); if (!nomeDoPrefab.has(k)) nomeDoPrefab.set(k, obj.n);
    pecas.push({ pos: new THREE.Vector3(obj.x, obj.y, obj.z), nome: obj.n, mats: partes.get(k) || [], inst: [], obj, lista: nomeL });
  }
  try {
    const extra = await loader.loadAsync('/scenery/prop/library_extra.glb');
    extra.scene.updateMatrixWorld(true);
    const mais = extra.scene.getObjectByName('Mapa') || extra.scene;
    for (const prefab of mais.children) {
      const lista = [];
      prefab.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) lista.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone() }); });
      if (!lista.length) continue;
      const k = chaveNome(prefab.name);
      partes.set(k, lista);
      nomeDoPrefab.set(k, prefab.name.replace(/^lib:?/i, ''));
      for (const p of pecas) if (chaveNome(p.nome) === k) p.mats = lista;
    }
  } catch (e) { console.warn('library extra:', e); }
  tipos = [...partes.keys()].sort().map(k => ({ id: k, nome: nomeDoPrefab.get(k) || k, criar: pos => criarBib(k, pos) }));
}
async function extraLamppost() {
  const k = chaveNome('prop/lamppost');
  try {
    if (!(partes.get(k) || []).length) {
      const g = await loader.loadAsync('/scenery/prop/lamppost.glb');
      g.scene.updateMatrixWorld(true);
      const lista = [];
      g.scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) lista.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone() }); });
      if (!lista.length) return;
      partes.set(k, lista);
    }
    const lista = partes.get(k);
    nomeDoPrefab.set(k, 'prop/lamppost');
    for (const p of pecas) if (chaveNome(p.nome) === k) p.mats = lista;
    if (modo === 'montado') {
      const r = await api('/admin/mapa-objetos?map=' + encodeURIComponent(mapaAtual));
      for (const o of (r.objetos || [])) {
        if (!/lamppost/i.test(o.n || '')) continue;
        const obj = { n: 'prop/lamppost', x: +o.x || 0, y: +o.y || 0, z: +o.z || 0 };
        pecas.push({ pos: new THREE.Vector3(obj.x, obj.y, obj.z), nome: obj.n, mats: lista, inst: [], obj, lista: 'objetos' });
      }
    }
    tipos = [{ id: k, nome: 'lamppost', criar: pos => criarBib(k, pos) }, ...tipos.filter(t => t.id !== k)];
  } catch (e) { console.warn('lamppost palette:', e); }
}
function montarMontado() {
  const vistosTipo = new Map();
  for (const node of mapaNode.children) {
    node.updateMatrixWorld(true);
    const mats = []; let geo0 = null;
    node.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) { if (!geo0) geo0 = o.geometry; mats.push({ geo: o.geometry, mat: o.material, local: new THREE.Matrix4().copy(node.matrixWorld).invert().multiply(o.matrixWorld) }); } });
    pecas.push({ pos: node.position.clone(), nome: node.name, mats, inst: [], node });
    if (geo0 && !vistosTipo.has(geo0.uuid)) vistosTipo.set(geo0.uuid, node);
  }
  tipos = [...vistosTipo.entries()].map(([id, node]) => ({ id, nome: node.name, criar: pos => criarMont(node, pos) })).sort((a, b) => a.nome.localeCompare(b.nome));
}

function rebuildInstancias() {
  for (const im of instGrupos) { raizInst.remove(im); im.dispose?.(); }
  instGrupos = [];
  for (const p of pecas) p.inst = [];
  const grupos = new Map();   // geo.uuid+'|'+matKey → { geo, mat, membros:[{peca, local}] }
  for (const peca of pecas) for (const m of peca.mats) {
    const matKey = Array.isArray(m.mat) ? m.mat.map(x => x.uuid).join(',') : m.mat.uuid;
    const chave = m.geo.uuid + '|' + matKey;
    let gr = grupos.get(chave); if (!gr) { gr = { geo: m.geo, mat: m.mat, membros: [] }; grupos.set(chave, gr); }
    gr.membros.push({ peca, local: m.local });
  }
  for (const gr of grupos.values()) {
    const im = new THREE.InstancedMesh(gr.geo, gr.mat, gr.membros.length);
    im.frustumCulled = false; im.userData.membros = gr.membros;
    gr.membros.forEach((mb, i) => { im.setMatrixAt(i, matrizDe(mb.peca, mb.local)); mb.peca.inst.push({ im, i }); });
    im.instanceMatrix.needsUpdate = true; raizInst.add(im); instGrupos.push(im);
  }
}
function atualizarInst(peca) {
  for (const { im, i } of peca.inst) { im.setMatrixAt(i, matrizDe(peca, im.userData.membros[i].local)); im.instanceMatrix.needsUpdate = true; }
}

// ── Seleção ──────────────────────────────────────────────────────────────────
function selecionar(peca) {
  if (!peca) return;
  selPeca = peca; proxy.position.set(fx * peca.pos.x, peca.pos.y, peca.pos.z); transform.attach(proxy); transform.setMode('translate'); realcar(peca);
  $('sem-sel').hidden = true; $('com-sel').hidden = false; atualizarCamposSel();
}
function deselecionar() { selPeca = null; transform.detach(); realcar(null); if ($('sem-sel')) { $('sem-sel').hidden = false; $('com-sel').hidden = true; } }
function realcar(peca) {
  if (boxHelper) { scene.remove(boxHelper); boxHelper.geometry.dispose(); boxHelper = null; }
  if (!peca || !peca.inst.length) return;
  const box = new THREE.Box3(), b = new THREE.Box3();
  for (const { im, i } of peca.inst) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); b.copy(im.geometry.boundingBox).applyMatrix4(matrizDe(peca, im.userData.membros[i].local)); box.union(b); }
  if (!box.isEmpty()) { boxHelper = new THREE.Box3Helper(box, 0xffcf3a); scene.add(boxHelper); }
}
function atualizarCamposSel() {
  if (!selPeca) return; const p = selPeca.pos;
  $('s-nome').textContent = rotuloPrefab(selPeca.nome);
  $('s-nome').title = selPeca.nome || '';
  $('s-x').value = +p.x.toFixed(3); $('s-y').value = +p.y.toFixed(3); $('s-z').value = +p.z.toFixed(3);
}

let down = null;
renderer.domElement.addEventListener('pointerdown', ev => { if (ev.button === 0) down = { x: ev.clientX, y: ev.clientY }; });
renderer.domElement.addEventListener('pointerup', ev => {
  if (ev.button !== 0 || !down) return;
  const moveu = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5; down = null;
  if (moveu || transform.dragging || !mapaNode) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera({ x: ((ev.clientX - rect.left) / rect.width) * 2 - 1, y: -((ev.clientY - rect.top) / rect.height) * 2 + 1 }, camera);
  if (ferramenta === 'add' && addTipo) {
    const pt = new THREE.Vector3();
    const hit = raycaster.intersectObjects(instGrupos, false)[0];
    if (hit) pt.copy(hit.point); else if (!raycaster.ray.intersectPlane(planoChao, pt)) return;
    addTipo.criar(pt); return;
  }
  const hit = raycaster.intersectObjects(instGrupos, false)[0];
  if (hit) selecionar(hit.object.userData.membros[hit.instanceId].peca); else deselecionar();
});
renderer.domElement.addEventListener('dblclick', ev => {
  if (transform.dragging) return;
  const pt = pontoSobCursor(ev);
  if (pt) irPivot(pt);
});

// ── Operações ──────────────────────────────────────────────────────────────────
function criarBib(chave, ponto) {   // ponto é world; obj guarda coords de arquivo (x = fx*world.x). Peça nova entra em `objetos` (props)
  const obj = { n: nomeDoPrefab.get(chave) || chave, x: +(fx * ponto.x).toFixed(3), y: +ponto.y.toFixed(3), z: +ponto.z.toFixed(3) };
  const peca = { pos: new THREE.Vector3(obj.x, obj.y, obj.z), nome: obj.n, mats: partes.get(chave) || [], inst: [], obj, lista: 'objetos' };
  pecas.push(peca); rebuildInstancias(); marcarSujo(); selecionar(peca); atualizarHud();
}
function criarMont(nodeExemplo, ponto) {
  const node = nodeExemplo.clone(true); node.position.copy(ponto); mapaNode.add(node); node.updateMatrixWorld(true);
  const mats = []; node.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) mats.push({ geo: o.geometry, mat: o.material, local: new THREE.Matrix4().copy(node.matrixWorld).invert().multiply(o.matrixWorld) }); });
  const peca = { pos: node.position.clone(), nome: node.name, mats, inst: [], node };
  pecas.push(peca); rebuildInstancias(); marcarSujo(); selecionar(peca); atualizarHud();
}
function duplicar() {
  if (!selPeca) return;
  const p = selPeca.pos;
  if (selPeca.obj) criarBib(chaveNome(selPeca.obj.n), new THREE.Vector3(fx * (p.x + 1.5 * fx), p.y, p.z));
  else criarMont(selPeca.node, new THREE.Vector3(p.x + 1.5, p.y, p.z));
}
function deletar() {
  if (!selPeca) return;
  const p = selPeca;
  if (p.node) mapaNode.remove(p.node);
  pecas.splice(pecas.indexOf(p), 1); deselecionar(); rebuildInstancias(); marcarSujo(); atualizarHud();   // bib: a peça sai de `pecas`; as listas são refeitas no salvar
}
function enquadrar() {
  const box = new THREE.Box3(), tmp = new THREE.Vector3();
  for (const p of pecas) box.expandByPoint(tmp.set(fx * p.pos.x, p.pos.y, p.pos.z));
  if (box.isEmpty()) { chaoPivo = 0; camera.position.set(40, 40, 40); orbit.target.set(0, 0, 0); orbit.update(); atualizarPivo(); return; }
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), r = Math.max(s.x, s.z, 10);
  chaoPivo = Number.isFinite(box.min.y) ? box.min.y : chaoDoMapa();      // floor, not the vertical middle of buildings
  orbit.target.set(c.x, chaoPivo, c.z);
  camera.position.set(c.x, chaoPivo + r * 0.8, c.z + r * 0.9);
  orbit.update(); atualizarPivo();
}
function pontoSobCursor(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera({ x: ((ev.clientX - rect.left) / rect.width) * 2 - 1, y: -((ev.clientY - rect.top) / rect.height) * 2 + 1 }, camera);
  const hit = raycaster.intersectObjects(instGrupos, false)[0];
  if (hit) return hit.point.clone();
  const pt = new THREE.Vector3();
  return raycaster.ray.intersectPlane(planoChao, pt) ? pt : null;
}
function irPivot(pt) {
  if (!pt) return;
  const dy = pt.y - orbit.target.y;
  orbit.target.set(pt.x, pt.y, pt.z);                                     // double-click: sit on the surface you hit (roof or floor)
  camera.position.y += dy;
  orbit.update();
  atualizarPivo();
}
function atualizarHud() {
  const aliases = apelidosMapa(mapaAtual);
  const shared = aliases.length > 1 ? ` · shared interior (${aliases.length} towns)` : '';
  $('hud').innerHTML = `<b>${pecas.length}</b> pieces · <b>${instGrupos.length}</b> types · <b>${modo === 'biblioteca' ? 'library' : 'assembled'}</b> · map <b title="${esc(aliases.join(', '))}">${esc(mapaRotulo || nomeMapa(mapaAtual))}</b>${shared} · pivot <b id="hud-pivo">${orbit.target.x.toFixed(1)}, ${orbit.target.y.toFixed(1)}, ${orbit.target.z.toFixed(1)}</b>`;
}

// ── Paleta ────────────────────────────────────────────────────────────────────
function renderPaleta() {
  const filtro = ($('pal-busca').value || '').toLowerCase();
  $('pal-qtd').textContent = '(' + tipos.length + ')';
  const vis = tipos.filter(t => {
    if (!filtro) return true;
    const en = rotuloPrefab(t.nome).toLowerCase();
    return en.includes(filtro) || String(t.nome).toLowerCase().includes(filtro);
  });
  $('paleta').innerHTML = vis.map(t => {
    const en = rotuloPrefab(t.nome);
    return `<button data-id="${esc(t.id)}" class="${addTipo && t.id === addTipo.id ? 'on' : ''}" title="${esc(t.nome)}">${esc(en)}</button>`;
  }).join('');
  for (const b of $('paleta').querySelectorAll('button')) b.onclick = () => { addTipo = tipos.find(t => t.id === b.dataset.id); usarFerramenta('add'); };
}
function usarFerramenta(f) {
  ferramenta = f;
  $('t-sel').classList.toggle('on', f === 'sel'); $('t-add').classList.toggle('on', f === 'add');
  $('add-dica').hidden = !(f === 'add' && addTipo);
  if (f === 'add' && addTipo) $('add-nome').textContent = rotuloPrefab(addTipo.nome);
  if (f === 'sel') addTipo = null;
  renderPaleta();
}

// ── Salvar ────────────────────────────────────────────────────────────────────
const exporter = new GLTFExporter();
const canal = new BroadcastChannel('p3d-admin');                  // a aba do jogo avisa "recarregue" se estiver neste mapa
const avisarJogo = () => canal.postMessage({ t: 'dados-mudaram', arquivo: mapaAtual, cenario: true });
async function salvar() {
  $('b-salvar').disabled = true; $('b-salvar').textContent = 'saving…';
  try {
    if (modo === 'biblioteca') {
      const listas = { objetos: [], ambiente: [], areaEnv: [] };   // refaz as 3 listas a partir das peças atuais
      for (const p of pecas) if (p.obj) listas[p.lista || 'objetos'].push(p.obj);
      const r = await api('/admin/mapa-objetos', 'POST', { mapa: mapaAtual, ...listas });
      if (!r.ok) { toast(r.erro || 'Failed to save.', true); return; }
      sujo = false; $('sujo').hidden = true; toast('Scenery saved (' + r.total + ' pieces). Press Ctrl+Shift+R in the game.'); avisarJogo();
    } else {
      transform.detach();
      const buf = await new Promise((res, rej) => exporter.parse(sceneGLB, res, rej, { binary: true, onlyVisible: false }));
      const r = await fetch(BASE + '/admin/mapa-glb?map=' + encodeURIComponent(mapaAtual), { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, body: buf });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.erro || 'Failed to save the GLB.', true); return; }
      const cur = await api('/admin/mapa-objetos?map=' + encodeURIComponent(mapaAtual));
      if (cur && (cur.objetos || cur.ambiente || cur.areaEnv)) {
        const objetos = (cur.objetos || []).filter(o => !/lamppost/i.test(o.n || ''));
        for (const p of pecas) if (p.obj && /lamppost/i.test(p.obj.n)) objetos.push(p.obj);
        await api('/admin/mapa-objetos', 'POST', { mapa: mapaAtual, objetos, ambiente: cur.ambiente || [], areaEnv: cur.areaEnv || [] });
      }
      sujo = false; $('sujo').hidden = true; toast('Scenery saved (' + (d.bytes / 1048576).toFixed(1) + ' MB). Ctrl+Shift+R in the game.'); avisarJogo();
    }
  } catch (e) { toast('Error saving: ' + e.message, true); }
  finally { $('b-salvar').disabled = false; $('b-salvar').textContent = 'Save scenery'; if (selPeca && modo === 'montado') transform.attach(proxy); }
}

// ── Ligações ──────────────────────────────────────────────────────────────────
$('t-sel').onclick = () => usarFerramenta('sel');
$('t-add').onclick = () => { if (!addTipo) toast('Pick a piece from the palette first.'); usarFerramenta('add'); };
$('t-foco').onclick = enquadrar;
$('t-pivo-up').onclick = () => subirPivo(passoPivo());
$('t-pivo-down').onclick = () => subirPivo(-passoPivo());
$('t-pivo-chao').onclick = pivoNoChao;
$('t-snap').onchange = e => { snap = e.target.checked; };
$('s-var').onclick = () => toast('Rotation is baked into the piece itself: use the palette to place the variant you want.');
$('s-dup').onclick = duplicar;
$('s-del').onclick = deletar;
for (const k of ['x', 'y', 'z']) $('s-' + k).addEventListener('input', () => { if (!selPeca) return; const p = selPeca.pos; setPos(selPeca, k === 'x' ? (+$('s-x').value || 0) : p.x, k === 'y' ? (+$('s-y').value || 0) : p.y, k === 'z' ? (+$('s-z').value || 0) : p.z); proxy.position.set(fx * selPeca.pos.x, selPeca.pos.y, selPeca.pos.z); atualizarInst(selPeca); realcar(selPeca); marcarSujo(); });
$('pal-busca').addEventListener('input', renderPaleta);
$('b-salvar').onclick = salvar;
$('b-recarregar').onclick = async () => { if (sujo && !confirm('Discard unsaved changes?')) return; await carregarMapa(mapaAtual, mapaRotulo); };
$('mapa-busca').addEventListener('input', montarOpcoesMapa);
$('sel-mapa').onchange = async e => {
  const opt = e.target.selectedOptions[0];
  if (sujo && !confirm('Switching maps discards unsaved changes. Continue?')) { aplicarSelecaoMapa(); return; }
  await carregarMapa(e.target.value, opt?.textContent || '');
};
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === 'Delete' || e.key === 'Backspace') deletar();
  else if (e.key === 'Escape') { usarFerramenta('sel'); deselecionar(); }
  else if (e.key === 'f' || e.key === 'F') enquadrar();
  else if (e.key === 'g' || e.key === 'G') { if (selPeca) irPivot(new THREE.Vector3(fx * selPeca.pos.x, selPeca.pos.y, selPeca.pos.z)); }
  else if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicar(); }
  else if (e.key === 'e' || e.key === 'E' || e.key === 'PageUp') { e.preventDefault(); subirPivo(passoPivo() * (e.shiftKey ? 0.25 : 1)); }
  else if (e.key === 'q' || e.key === 'Q' || e.key === 'PageDown') { e.preventDefault(); subirPivo(-passoPivo() * (e.shiftKey ? 0.25 : 1)); }
  else if (e.key === 'Home') { e.preventDefault(); pivoNoChao(); }
  else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { e.preventDefault(); deslocarPivo(e.shiftKey ? 0.25 : 1, 0); }
  else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { e.preventDefault(); deslocarPivo(e.shiftKey ? -0.25 : -1, 0); }
  else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { e.preventDefault(); deslocarPivo(0, e.shiftKey ? -0.25 : -1); }
  else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { e.preventDefault(); deslocarPivo(0, e.shiftKey ? 0.25 : 1); }
});
tela.addEventListener('wheel', e => {
  if (!e.shiftKey) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const dir = e.deltaY > 0 ? -1 : 1;
  subirPivo(dir * passoPivo() * (e.altKey ? 0.25 : 1));
}, { passive: false, capture: true });
addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

listarMapas();
