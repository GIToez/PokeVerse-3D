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
  try { token = localStorage.getItem('conta.token') || token; } catch {}   // the freshest sign-in (the game may have signed in again)
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
/* DRAG (Nov 6): the gizmo moves / rotates EVERY selected piece (Ctrl+click picks several) — a move shifts them all by the same
   amount, a rotation turns them all around the main piece (the one the gizmo sits on). Holding Alt when the drag starts clones the
   selection first: the copies stay where the pieces were, and you carry the originals away. One drag = one undo step. */
let antesArraste = null, altNoClique = false, clonesArraste = null;
renderer.domElement.addEventListener('pointerdown', ev => { altNoClique = ev.altKey; }, true);
transform.addEventListener('dragging-changed', e => {
  orbit.enabled = !e.value;
  if (e.value) {
    clonesArraste = altNoClique && selPeca ? clonarSelecao({ deslocar: false, selecionarCopias: false }) : null;
    antesArraste = selPeca ? new Map([...selecao].map(p => [p, estadoDe(p)])) : null;
    if (clonesArraste?.length) toast(clonesArraste.length === 1 ? 'Cloned 1 piece (Alt + drag).' : 'Cloned ' + clonesArraste.length + ' pieces (Alt + drag).');
  } else {
    const acoes = [];
    for (const [p, de] of antesArraste || []) { const a = acaoMov(p, de); if (a) acoes.push(a); }
    if (clonesArraste?.length) acoes.unshift(...clonesArraste.map(peca => ({ t: 'add', peca, idx: pecas.indexOf(peca) })));
    if (acoes.length) registrar(acoes.length === 1 ? acoes[0] : { t: 'grupo', acoes });
    antesArraste = null; clonesArraste = null;
  }
});
transform.addEventListener('objectChange', () => {
  if (!selPeca) return;
  const base = antesArraste?.get(selPeca) || estadoDe(selPeca);
  if (transform.getMode() === 'rotate') {
    const e = proxy.rotation;                                              // proxy usa Euler XYZ, o mesmo do jogo
    const nova = { x: R2G(e.x), y: R2G(e.y), z: R2G(e.z) };
    if (selecao.size > 1 && antesArraste) {
      const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(G2R(base.r.x), G2R(base.r.y), G2R(base.r.z)));
      const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(G2R(nova.x), G2R(nova.y), G2R(nova.z)));
      girarGrupo(q1.multiply(q0.invert()), antesArraste);
    } else setRot(selPeca, nova);
    for (const p of selecao) atualizarInst(p);
    realcar(); marcarSujo(); atualizarCamposSel();
    return;
  }
  let x = proxy.position.x * fx, y = proxy.position.y, z = proxy.position.z;   // de world pra coords de edição (bib: flipX)
  if (snap) { x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2; z = Math.round(z * 2) / 2; proxy.position.set(x * fx, y, z); }
  const dx = x - base.p.x, dy = y - base.p.y, dz = z - base.p.z;
  for (const p of selecao) {
    const b = antesArraste?.get(p) || estadoDe(p);
    if (p === selPeca) setPos(p, x, y, z); else setPos(p, b.p.x + dx, b.p.y + dy, b.p.z + dz);
    atualizarInst(p);
  }
  realcar(); marcarSujo(); atualizarCamposSel();
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
let selPeca = null, boxHelper = null;   // selPeca = the main selected piece (the gizmo is on it)
let selecao = new Set();                // every selected piece (Ctrl+click adds / removes)
let caixas = [];                        // the yellow boxes around the selection
let sujo = false, mapaAtual = null, mapaRotulo = '', mapasDisponiveis = [], glbDoMapa = {}, ferramenta = 'sel', addTipo = null, snap = false;
const raycaster = new THREE.Raycaster();
const planoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _m4 = new THREE.Matrix4(), _T = new THREE.Matrix4();
const marcarSujo = () => { sujo = true; $('sujo').hidden = false; };
const _R = new THREE.Matrix4(), _E = new THREE.Euler(), _Q = new THREE.Quaternion(), _Q2 = new THREE.Quaternion();
const G2R = THREE.MathUtils.degToRad, R2G = THREE.MathUtils.radToDeg;
/* Rotação LIVRE da peça: peca.rot = {x,y,z} em graus, Euler XYZ no espaço do MUNDO (igual ao jogo: T × R × local).
   bib: vai em obj.rx / obj.r (Y, o campo antigo) / obj.rz, 0..360 com 1 casa, 0 não grava. montado: no node.rotation. */
const ROT0 = Object.freeze({ x: 0, y: 0, z: 0 });
const rotDe = peca => peca.rot || ROT0;
const matrizDe = (peca, local) => { const r = rotDe(peca); return _m4.multiplyMatrices(_T.makeTranslation(fx * peca.pos.x, peca.pos.y, peca.pos.z), _R.makeRotationFromEuler(_E.set(G2R(r.x), G2R(r.y), G2R(r.z)))).multiply(local); };
const normGraus = g => { g = Math.round((+g || 0) * 10) / 10; g = ((g % 360) + 360) % 360; g = Math.round(g * 10) / 10; return g > 180 ? g - 360 : g; };   // -180..180
const grausArquivo = g => { g = Math.round((((+g || 0) % 360) + 360) % 360 * 10) / 10; return g >= 360 ? 0 : g; };          // 0..360, o que o jogo lê
function setRot(peca, rot) {   // rot: {x?,y?,z?} graus (o que faltar fica como está)
  const a = rotDe(peca);
  const r = { x: normGraus(rot.x ?? a.x), y: normGraus(rot.y ?? a.y), z: normGraus(rot.z ?? a.z) };
  peca.rot = r;
  if (peca.obj) for (const [k, v] of [['rx', r.x], ['r', r.y], ['rz', r.z]]) { const g = grausArquivo(v); if (g) peca.obj[k] = g; else delete peca.obj[k]; }
  if (peca.node) peca.node.rotation.set(G2R(r.x), G2R(r.y), G2R(r.z));
}
const rotDoArquivo = o => ({ x: normGraus(o?.rx), y: normGraus(o?.r), z: normGraus(o?.rz) });
const mesmaRot = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
const estadoDe = peca => ({ p: peca.pos.clone(), r: { ...rotDe(peca) } });
function setPos(peca, x, y, z) {
  peca.pos.set(x, y, z);
  if (peca.obj) { peca.obj.x = x; peca.obj.y = y; peca.obj.z = z; }
  if (peca.node) peca.node.position.set(x, y, z);
}

// ── Undo / Redo ────────────────────────────────────────────────────────────────
// ações: { t:'mov', peca, de, para } · { t:'add', peca, idx } · { t:'del', peca, idx }
const LIMITE_HIST = 300;
let historico = [], refazer = [];
function registrar(acao) {
  historico.push(acao); if (historico.length > LIMITE_HIST) historico.shift();
  refazer = []; atualizarBotoesHist();
}
function acaoMov(peca, de) {
  if (!de) return null;
  const para = estadoDe(peca);
  if (de.p.equals(para.p) && mesmaRot(de.r, para.r)) return null;
  return { t: 'mov', peca, de, para };
}
function registrarMov(peca, de) { const a = acaoMov(peca, de); if (a) registrar(a); }
function limparHist() { historico = []; refazer = []; atualizarBotoesHist(); }
function atualizarBotoesHist() {
  if ($('t-undo')) { $('t-undo').disabled = !historico.length; $('t-undo').title = 'Undo (Ctrl+Z)' + (historico.length ? ' · ' + historico.length + ' step(s)' : ''); }
  if ($('t-redo')) { $('t-redo').disabled = !refazer.length; $('t-redo').title = 'Redo (Ctrl+Y / Ctrl+Shift+Z)' + (refazer.length ? ' · ' + refazer.length + ' step(s)' : ''); }
}
function moverPara(peca, est, quieto = false) {
  setPos(peca, est.p.x, est.p.y, est.p.z); setRot(peca, est.r); atualizarInst(peca);
  if (quieto) return;
  if (selPeca === peca) { sincronizarProxy(); realcar(); atualizarCamposSel(); }
  else selecionar(peca);
}
function sincronizarProxy() {
  if (!selPeca) return;
  proxy.position.set(fx * selPeca.pos.x, selPeca.pos.y, selPeca.pos.z);
  const r = rotDe(selPeca);
  proxy.rotation.set(G2R(r.x), G2R(r.y), G2R(r.z));
}
function aplicarRot(rot) {
  if (!selPeca || transform.dragging) return;
  const de = estadoDe(selPeca);
  setRot(selPeca, rot); atualizarInst(selPeca); sincronizarProxy(); realcar(); marcarSujo(); atualizarCamposSel();
  registrarMov(selPeca, de);
}
/** Turn every selected piece by the world rotation `dq` around the main piece (`base` = their states before). */
function girarGrupo(dq, base) {
  const c = base.get(selPeca) || estadoDe(selPeca), cw = new THREE.Vector3(fx * c.p.x, c.p.y, c.p.z), v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const p of selecao) {
    const b = base.get(p) || estadoDe(p);
    v.set(fx * b.p.x, b.p.y, b.p.z).sub(cw).applyQuaternion(dq).add(cw);
    setPos(p, fx * v.x, v.y, v.z);
    q.setFromEuler(e.set(G2R(b.r.x), G2R(b.r.y), G2R(b.r.z))).premultiply(dq);
    e.setFromQuaternion(q, 'XYZ');
    setRot(p, { x: R2G(e.x), y: R2G(e.y), z: R2G(e.z) });
  }
}
const _eixos = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
function girar(delta, eixo = 'y') {   // botões e tecla R: gira em torno do eixo do MUNDO, mesmo com a peça inclinada
  if (!selPeca) return;
  if (selecao.size > 1) {                                                // several selected: the whole group turns around the main piece
    if (transform.dragging) return;
    const base = new Map([...selecao].map(p => [p, estadoDe(p)]));
    girarGrupo(new THREE.Quaternion().setFromAxisAngle(_eixos[eixo], G2R(delta)), base);
    for (const p of selecao) atualizarInst(p);
    sincronizarProxy(); realcar(); marcarSujo(); atualizarCamposSel();
    const acoes = [...base].map(([p, de]) => acaoMov(p, de)).filter(Boolean);
    if (acoes.length) registrar({ t: 'grupo', acoes });
    return;
  }
  const r = rotDe(selPeca);
  _Q.setFromEuler(_E.set(G2R(r.x), G2R(r.y), G2R(r.z)));
  _Q2.setFromAxisAngle(_eixos[eixo], G2R(delta)).multiply(_Q);
  _E.setFromQuaternion(_Q2, 'XYZ');
  aplicarRot({ x: R2G(_E.x), y: R2G(_E.y), z: R2G(_E.z) });
}
function modoGizmo(m) {
  transform.setMode(m);
  $('t-mover').classList.toggle('on', m === 'translate'); $('t-girar').classList.toggle('on', m === 'rotate');
}
function inserirPeca(peca, idx, quieto = false) {
  if (peca.node) mapaNode.add(peca.node);
  pecas.splice(Math.min(idx, pecas.length), 0, peca);
  if (!quieto) { rebuildInstancias(); selecionar(peca); }
}
function removerPeca(peca, quieto = false) {
  const i = pecas.indexOf(peca); if (i < 0) return;
  if (peca.node) mapaNode.remove(peca.node);
  pecas.splice(i, 1);
  if (selecao.has(peca)) { selecao.delete(peca); if (selPeca === peca) selPeca = [...selecao].pop() || null; }
  if (!quieto) { rebuildInstancias(); if (selPeca) selecionar(selPeca, { manter: true }); else deselecionar(); }
}
function aplicarUma(acao, voltar) {
  if (acao.t === 'mov') moverPara(acao.peca, voltar ? acao.de : acao.para, true);
  else if ((acao.t === 'add') === voltar) removerPeca(acao.peca, true);   // desfazer add / refazer del
  else inserirPeca(acao.peca, acao.idx, true);                             // desfazer del / refazer add
}
function aplicarHist(acao, voltar) {
  const lista = acao.t === 'grupo' ? (voltar ? [...acao.acoes].reverse() : acao.acoes) : [acao];
  for (const a of lista) aplicarUma(a, voltar);
  rebuildInstancias();
  const vivas = lista.map(a => a.peca).filter(p => pecas.includes(p));      // select what the step touched (that still exists)
  if (vivas.length) { selecao = new Set(vivas); selPeca = vivas[vivas.length - 1]; selecionar(selPeca, { manter: true }); } else deselecionar();
  marcarSujo(); atualizarHud();
}
function desfazer() {
  if (transform.dragging || !historico.length) return;
  const a = historico.pop(); aplicarHist(a, true); refazer.push(a); atualizarBotoesHist();
}
function refazerAcao() {
  if (transform.dragging || !refazer.length) return;
  const a = refazer.pop(); aplicarHist(a, false); historico.push(a); atualizarBotoesHist();
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
  sujo = false; $('sujo').hidden = true; $('carregando').hidden = true; atualizarHud(); limparHist();
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
    pecas.push({ pos: new THREE.Vector3(obj.x, obj.y, obj.z), rot: rotDoArquivo(obj), nome: obj.n, mats: partes.get(k) || [], inst: [], obj, lista: nomeL });
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
        for (const k of ['rx', 'r', 'rz']) if (+o[k]) obj[k] = +o[k];
        pecas.push({ pos: new THREE.Vector3(obj.x, obj.y, obj.z), rot: rotDoArquivo(obj), nome: obj.n, mats: lista, inst: [], obj, lista: 'objetos' });
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
    pecas.push({ pos: node.position.clone(), rot: { x: normGraus(R2G(node.rotation.x)), y: normGraus(R2G(node.rotation.y)), z: normGraus(R2G(node.rotation.z)) }, nome: node.name, mats, inst: [], node });
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
/** Select a piece. `somar` (Ctrl+click) adds it to the selection, or takes it out if it was in; `manter` keeps the current set. */
function selecionar(peca, { somar = false, manter = false } = {}) {
  if (!peca) return;
  if (somar && selecao.has(peca) && selecao.size > 1) {
    selecao.delete(peca);
    if (selPeca === peca) selPeca = [...selecao].pop();
  } else {
    if (!somar && !manter) selecao = new Set();
    selecao.add(peca); selPeca = peca;
  }
  sincronizarProxy(); transform.attach(proxy); realcar();
  $('sem-sel').hidden = true; $('com-sel').hidden = false; atualizarCamposSel();
}
function deselecionar() { selPeca = null; selecao = new Set(); transform.detach(); realcar(); if ($('sem-sel')) { $('sem-sel').hidden = false; $('com-sel').hidden = true; } }
/** Yellow box around each selected piece (the main one brighter). */
function realcar() {
  for (const h of caixas) { scene.remove(h); h.geometry.dispose(); }
  caixas = []; boxHelper = null;
  for (const peca of [...selecao].slice(-300)) {
    if (!peca.inst.length) continue;
    const box = new THREE.Box3(), b = new THREE.Box3();
    for (const { im, i } of peca.inst) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); b.copy(im.geometry.boundingBox).applyMatrix4(matrizDe(peca, im.userData.membros[i].local)); box.union(b); }
    if (box.isEmpty()) continue;
    const h = new THREE.Box3Helper(box, peca === selPeca ? 0xffcf3a : 0xc9932a); scene.add(h); caixas.push(h);
    if (peca === selPeca) boxHelper = h;
  }
}
function atualizarCamposSel() {
  if (!selPeca) return; const p = selPeca.pos;
  $('s-nome').textContent = rotuloPrefab(selPeca.nome) + (selecao.size > 1 ? ' + ' + (selecao.size - 1) + ' more' : '');
  $('s-nome').title = selPeca.nome || '';
  $('s-x').value = +p.x.toFixed(3); $('s-y').value = +p.y.toFixed(3); $('s-z').value = +p.z.toFixed(3);
  const r = rotDe(selPeca);
  for (const k of ['x', 'y', 'z']) if (document.activeElement !== $('s-r' + k)) $('s-r' + k).value = +r[k].toFixed(1);
}

let down = null;
renderer.domElement.addEventListener('pointerdown', ev => { if (ev.button === 0) down = { x: ev.clientX, y: ev.clientY }; ultimoCursor = ev; });
renderer.domElement.addEventListener('pointermove', ev => { ultimoCursor = ev; });
let ultimoCursor = null;   // where Ctrl+V pastes
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
  const somar = ev.ctrlKey || ev.metaKey;                                // Ctrl+click: add to / take out of the selection
  if (hit) selecionar(hit.object.userData.membros[hit.instanceId].peca, { somar });
  else if (!somar) deselecionar();
});
renderer.domElement.addEventListener('dblclick', ev => {
  if (transform.dragging) return;
  const pt = pontoSobCursor(ev);
  if (pt) irPivot(pt);
});

// ── Operações ──────────────────────────────────────────────────────────────────
function criarBib(chave, ponto, rot = ROT0, { quieto = false, lista = 'objetos', extra = null } = {}) {   // ponto é world; obj guarda coords de arquivo (x = fx*world.x). Peça nova entra em `objetos` (props)
  const obj = { ...(extra || {}), n: nomeDoPrefab.get(chave) || chave, x: +(fx * ponto.x).toFixed(3), y: +ponto.y.toFixed(3), z: +ponto.z.toFixed(3) };
  const peca = { pos: new THREE.Vector3(obj.x, obj.y, obj.z), nome: obj.n, mats: partes.get(chave) || [], inst: [], obj, lista };
  setRot(peca, rot);
  pecas.push(peca);
  if (quieto) return peca;
  registrar({ t: 'add', peca, idx: pecas.length - 1 }); rebuildInstancias(); marcarSujo(); selecionar(peca); atualizarHud();
  return peca;
}
function criarMont(nodeExemplo, ponto, rot = ROT0, { quieto = false } = {}) {
  const node = nodeExemplo.clone(true); node.position.copy(ponto); node.rotation.set(0, 0, 0); mapaNode.add(node); node.updateMatrixWorld(true);
  const mats = []; node.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) mats.push({ geo: o.geometry, mat: o.material, local: new THREE.Matrix4().copy(node.matrixWorld).invert().multiply(o.matrixWorld) }); });
  const peca = { pos: node.position.clone(), nome: node.name, mats, inst: [], node };
  setRot(peca, rot);
  pecas.push(peca);
  if (quieto) return peca;
  registrar({ t: 'add', peca, idx: pecas.length - 1 }); rebuildInstancias(); marcarSujo(); selecionar(peca); atualizarHud();
  return peca;
}
/** A copy of one piece at world point `w`, same rotation, same list (ground stays ground, props stay props). Not registered. */
function copiaDe(peca, w) {
  if (peca.obj) { const { n, x, y, z, r, rx, rz, ...resto } = peca.obj; return criarBib(chaveNome(peca.obj.n), w, peca.rot, { quieto: true, lista: peca.lista || 'objetos', extra: resto }); }
  return peca.node ? criarMont(peca.node, w, peca.rot, { quieto: true }) : null;
}
const mundoDe = p => new THREE.Vector3(fx * p.pos.x, p.pos.y, p.pos.z);
/** Clone every selected piece. deslocar: 1.5 m to the side (Ctrl+D), or in place (Alt+drag). Returns the copies. */
function clonarSelecao({ deslocar = true, selecionarCopias = true } = {}) {
  if (!selPeca) return [];
  const copias = [];
  for (const p of selecao) { const w = mundoDe(p); if (deslocar) w.x += 1.5; const c = copiaDe(p, w); if (c) copias.push(c); }
  rebuildInstancias(); marcarSujo(); atualizarHud();
  if (selecionarCopias && copias.length) { selecao = new Set(copias); selPeca = copias[copias.length - 1]; selecionar(selPeca, { manter: true }); }
  else if (selPeca) selecionar(selPeca, { manter: true });              // the instances were rebuilt: the boxes too
  return copias;
}
function duplicar() {
  const copias = clonarSelecao({ deslocar: true });
  if (copias.length) registrar(copias.length === 1 ? { t: 'add', peca: copias[0], idx: pecas.indexOf(copias[0]) } : { t: 'grupo', acoes: copias.map(peca => ({ t: 'add', peca, idx: pecas.indexOf(peca) })) });
}
/* COPY / PASTE (Nov 6): Ctrl+C keeps the selection (prefab, offset from the main piece, rotation, list); Ctrl+V drops it under the
   mouse (or beside the originals). It also survives switching maps in this browser: a prefab the other map's library lacks is skipped. */
let areaTransf = null;
const CHAVE_COPIA = 'editor3d.copia';
function copiar() {
  if (!selPeca) return;
  const c0 = mundoDe(selPeca);
  areaTransf = { mapa: mapaAtual, itens: [...selecao].map(p => { const w = mundoDe(p).sub(c0); return { peca: p, prefab: p.obj ? chaveNome(p.obj.n) : null, nome: p.nome, lista: p.lista || 'objetos', d: [w.x, w.y, w.z], r: { ...rotDe(p) }, extra: p.obj ? (({ n, x, y, z, r, rx, rz, ...e }) => e)(p.obj) : null }; }) };
  try { localStorage.setItem(CHAVE_COPIA, JSON.stringify({ mapa: mapaAtual, itens: areaTransf.itens.map(({ peca, ...i }) => i) })); } catch {}
  toast(selecao.size === 1 ? 'Copied 1 piece (Ctrl+V pastes under the mouse).' : 'Copied ' + selecao.size + ' pieces (Ctrl+V pastes under the mouse).');
}
function colar() {
  let A = areaTransf;
  if (!A) try { A = JSON.parse(localStorage.getItem(CHAVE_COPIA) || 'null'); } catch {}
  if (!A?.itens?.length) { toast('Nothing copied yet: select pieces and press Ctrl+C.', true); return; }
  let alvo = ultimoCursor ? pontoSobCursor(ultimoCursor) : null;
  if (!alvo) { const p = A.itens[0].peca; alvo = p && pecas.includes(p) ? mundoDe(p).add(new THREE.Vector3(1.5, 0, 0)) : orbit.target.clone(); }
  const copias = []; let faltou = 0;
  for (const it of A.itens) {
    const w = new THREE.Vector3(alvo.x + it.d[0], (it.d[1] || 0) + (A.itens.length === 1 ? alvo.y : alvo.y + 0), alvo.z + it.d[2]);
    let c = null;
    if (it.peca && pecas.includes(it.peca) && A.mapa === mapaAtual) { c = copiaDe(it.peca, w); if (c) setRot(c, it.r); }
    else if (it.prefab && partes.has(it.prefab)) c = criarBib(it.prefab, w, it.r, { quieto: true, lista: it.lista, extra: it.extra });
    else if (!it.prefab) { const t = tipos.find(t => t.nome === it.nome); if (t && modo === 'montado') { const n = mapaNode.children.find(n => n.name === it.nome); if (n) c = criarMont(n, w, it.r, { quieto: true }); } }
    if (c) copias.push(c); else faltou++;
  }
  if (!copias.length) { toast('None of the copied pieces exist in this map\'s library.', true); return; }
  rebuildInstancias(); marcarSujo(); atualizarHud();
  selecao = new Set(copias); selPeca = copias[0]; selecionar(selPeca, { manter: true });
  registrar(copias.length === 1 ? { t: 'add', peca: copias[0], idx: pecas.indexOf(copias[0]) } : { t: 'grupo', acoes: copias.map(peca => ({ t: 'add', peca, idx: pecas.indexOf(peca) })) });
  toast('Pasted ' + copias.length + (copias.length === 1 ? ' piece' : ' pieces') + (faltou ? ' · ' + faltou + ' skipped (not in this map\'s library)' : '') + '.');
}
function deletar() {
  if (!selPeca) return;
  const alvos = [...selecao], acoes = [];
  for (const p of alvos) {
    const idx = pecas.indexOf(p); if (idx < 0) continue;
    if (p.node) mapaNode.remove(p.node);
    pecas.splice(idx, 1); acoes.push({ t: 'del', peca: p, idx });
  }
  if (acoes.length) registrar(acoes.length === 1 ? acoes[0] : { t: 'grupo', acoes });
  deselecionar(); rebuildInstancias(); marcarSujo(); atualizarHud();   // bib: a peça sai de `pecas`; as listas são refeitas no salvar
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
      try { token = localStorage.getItem('conta.token') || token; } catch {}
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
$('t-undo').onclick = desfazer;
$('t-redo').onclick = refazerAcao;
$('t-foco').onclick = enquadrar;
$('t-pivo-up').onclick = () => subirPivo(passoPivo());
$('t-pivo-down').onclick = () => subirPivo(-passoPivo());
$('t-pivo-chao').onclick = pivoNoChao;
$('t-snap').onchange = e => { snap = e.target.checked; transform.setRotationSnap(snap ? THREE.MathUtils.degToRad(15) : null); };
$('t-mover').onclick = () => modoGizmo('translate');
$('t-girar').onclick = () => modoGizmo('rotate');
$('s-rot-esq').onclick = () => girar(90);
$('s-rot-dir').onclick = () => girar(-90);
$('s-rot-nivel').onclick = () => aplicarRot({ x: 0, z: 0 });
$('s-rot-zero').onclick = () => aplicarRot({ x: 0, y: 0, z: 0 });
$('t-espaco').onclick = () => { const l = transform.space === 'world'; transform.setSpace(l ? 'local' : 'world'); $('t-espaco').textContent = l ? '⌖ Local' : '🌐 World'; };
$('s-var').onclick = () => toast('Rotation is baked into the piece itself: use the palette to place the variant you want.');
$('s-dup').onclick = duplicar;
$('s-del').onclick = deletar;
let posAntesCampo = null;
for (const k of ['x', 'y', 'z']) {
  $('s-' + k).addEventListener('focus', () => { posAntesCampo = selPeca ? { peca: selPeca, de: estadoDe(selPeca) } : null; });
  $('s-' + k).addEventListener('change', () => { if (posAntesCampo && posAntesCampo.peca === selPeca) { registrarMov(selPeca, posAntesCampo.de); posAntesCampo.de = estadoDe(selPeca); } });
}
for (const k of ['x', 'y', 'z']) {
  const el = $('s-r' + k);
  el.addEventListener('focus', () => { posAntesCampo = selPeca ? { peca: selPeca, de: estadoDe(selPeca) } : null; });
  el.addEventListener('input', () => { if (!selPeca) return; setRot(selPeca, { [k]: +el.value || 0 }); sincronizarProxy(); atualizarInst(selPeca); realcar(selPeca); marcarSujo(); });
  el.addEventListener('change', () => { if (posAntesCampo && posAntesCampo.peca === selPeca) { registrarMov(selPeca, posAntesCampo.de); posAntesCampo.de = estadoDe(selPeca); } });
}
for (const k of ['x', 'y', 'z']) $('s-' + k).addEventListener('input', () => { if (!selPeca) return; const p = selPeca.pos; setPos(selPeca, k === 'x' ? (+$('s-x').value || 0) : p.x, k === 'y' ? (+$('s-y').value || 0) : p.y, k === 'z' ? (+$('s-z').value || 0) : p.z); sincronizarProxy(); atualizarInst(selPeca); realcar(selPeca); marcarSujo(); });
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
  const k = e.key.toLowerCase();
  const campoTexto = e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox');
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'y') && !campoTexto) {   // em campo de texto fica o undo nativo do navegador
    e.preventDefault();
    if (k === 'y' || e.shiftKey) refazerAcao(); else desfazer();
    return;
  }
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'c') { e.preventDefault(); copiar(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'v') { e.preventDefault(); colar(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'a') { e.preventDefault(); if (pecas.length) { selecao = new Set(pecas.filter(p => p.lista === 'objetos' || p.node)); selPeca = [...selecao].pop() || null; if (selPeca) selecionar(selPeca, { manter: true }); } return; }
  if (e.key === 'Delete' || e.key === 'Backspace') deletar();
  else if (e.key === 'Escape') { usarFerramenta('sel'); deselecionar(); }
  else if (k === 'r' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); girar((e.shiftKey ? -1 : 1) * (e.altKey ? 15 : 90)); }
  else if (k === 't' && !e.ctrlKey && !e.metaKey) modoGizmo(transform.getMode() === 'rotate' ? 'translate' : 'rotate');
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

window.__editor3d = { pecas: () => pecas.length, selecionadas: () => selecao.size, historico: () => historico.length,
  gizmoNaTela: () => { const r = renderer.domElement.getBoundingClientRect(), v = proxy.position.clone().project(camera); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  posicoes: () => [...selecao].map(p => [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)]) };   // console / tests
listarMapas();
