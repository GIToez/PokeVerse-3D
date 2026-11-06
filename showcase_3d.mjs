/* SHOP 3D SHOWCASE (Nov 6) — the module upcoming/shop_ui.mjs loads for Pokémon skin and mount cards (`vitrine3d`); PokeFable never
 * shipped it to us, so this is ours with the same calls:
 *   instalar({ aplicarShiny?, qualidade? })        sincronizar([{ el, glb, shiny }])  → the cards showing a live 3D model now
 *   tocar(el)  → that card's model plays a move once       parar() → everything off
 * One WebGL renderer, off-screen, draws every model; each card gets a small 2D canvas that copies its picture, so there's a single
 * GL context however many cards there are, and the picture clips and scrolls inside the shop like any card art. While a model
 * loads (or if it fails), the card keeps its icon. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let dep = {}, R = null, raf = 0, ultimo = 0;
const itens = new Map();                        // el → { glb, shiny, cv, g2, cena, cam, pivo, mixer, acoes, pronto, bg0 }
const gltfs = new Map();                        // glb → Promise<gltf>
const loader = new GLTFLoader();
const QPS = 30;

export function instalar(d) { dep = { ...dep, ...(d || {}) }; }

function renderer() {
  if (R) return R;
  R = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setClearColor(0x000000, 0);
  R.outputColorSpace = THREE.SRGBColorSpace;
  return R;
}
const modelo = (glb) => {
  const k = String(glb).replace(/\.glb$/, '');
  if (!gltfs.has(k)) { const p = loader.loadAsync('./scenery/mon/' + k + '.glb'); p.catch(() => gltfs.delete(k)); gltfs.set(k, p); }
  return gltfs.get(k);
};

async function montar(el, it) {
  try {
    const g = await modelo(it.glb);
    if (itens.get(el) !== it) return;
    const raiz = SkeletonUtils.clone(g.scene);
    raiz.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); } });
    if (it.shiny) try { dep.aplicarShiny?.(raiz, true); } catch {}
    const pivo = new THREE.Group(); pivo.add(raiz);
    const cena = new THREE.Scene();
    cena.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.4); sol.position.set(2, 4, 3); cena.add(sol);
    cena.add(pivo);
    // fit: the model stands on y = 0, centred, about 1 unit tall
    pivo.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(raiz, true), tam = box.getSize(new THREE.Vector3()), meio = box.getCenter(new THREE.Vector3());
    const alto = Math.max(tam.y, tam.x * 0.8, tam.z * 0.6, 1e-3), k = 1 / alto;
    raiz.scale.multiplyScalar(k);
    raiz.position.set(-meio.x * k, -box.min.y * k, -meio.z * k);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    cam.position.set(0, 0.62, 2.55); cam.lookAt(0, 0.48, 0);
    const mixer = new THREE.AnimationMixer(raiz), acoes = new Map();
    for (const c of g.animations || []) acoes.set(c.name, mixer.clipAction(c));
    const idle = acoes.get('Idle') || acoes.get('Idling') || [...acoes.values()][0];
    idle?.play();
    Object.assign(it, { cena, cam, pivo, mixer, acoes, idle, pronto: true });
    it.bg0 = el.style.backgroundImage;
    el.style.backgroundImage = 'none';             // the live model replaces the icon
    it.cv.style.display = 'block';
  } catch (e) {
    console.warn('showcase 3D:', it.glb, e?.message || e);
  }
}

function adicionar(x) {
  const el = x.el;
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', display: 'none' });
  cv.className = 'vitrine3d';
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(cv);
  const it = { glb: String(x.glb), shiny: !!x.shiny, cv, g2: cv.getContext('2d'), giro: -0.6 + Math.random() * 0.3, pronto: false };
  itens.set(el, it);
  montar(el, it);
}
function remover(el) {
  const it = itens.get(el); if (!it) return;
  itens.delete(el);
  it.cv.remove();
  if (it.pronto && el.style.backgroundImage === 'none') el.style.backgroundImage = it.bg0 || '';
  it.mixer?.stopAllAction();
}

export function sincronizar(lista = []) {
  const agora = new Map((lista || []).filter((x) => x?.el && x.glb).map((x) => [x.el, x]));
  for (const [el, it] of [...itens]) { const x = agora.get(el); if (!x || String(x.glb) !== it.glb || !!x.shiny !== it.shiny) remover(el); }
  for (const [el, x] of agora) if (!itens.has(el)) adicionar(x);
  if (itens.size && !raf) { ultimo = performance.now(); raf = requestAnimationFrame(quadro); }
}
export function tocar(el) {
  const it = el && itens.get(el); if (!it?.pronto) return;
  const a = it.acoes.get('Attack') || it.acoes.get('Appear') || it.acoes.get('Buff');
  if (!a) return;
  it.idle?.fadeOut(0.15);
  a.reset().setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.fadeIn(0.15).play();
  const volta = (e) => { if (e.action !== a) return; it.mixer.removeEventListener('finished', volta); a.fadeOut(0.2); it.idle?.reset().fadeIn(0.2).play(); };
  it.mixer.addEventListener('finished', volta);
}
export function parar() {
  for (const el of [...itens.keys()]) remover(el);
  if (raf) cancelAnimationFrame(raf); raf = 0;
}

function quadro(t) {
  raf = 0;
  if (!itens.size) return;
  raf = requestAnimationFrame(quadro);
  if (t - ultimo < 1000 / QPS) return;
  const dt = Math.min(0.1, (t - ultimo) / 1000); ultimo = t;
  const r = renderer(), dpr = Math.min(2, devicePixelRatio || 1);
  for (const [el, it] of itens) {
    if (!el.isConnected) { remover(el); continue; }
    if (!it.pronto) continue;
    const q = el.getBoundingClientRect();
    if (q.width < 4 || q.height < 4 || q.bottom < 0 || q.top > innerHeight || q.right < 0 || q.left > innerWidth) continue;
    const w = Math.round(q.width * dpr), h = Math.round(q.height * dpr);
    if (it.cv.width !== w || it.cv.height !== h) { it.cv.width = w; it.cv.height = h; }
    it.giro += dt * 0.45;
    it.pivo.rotation.y = Math.sin(it.giro) * 0.6;       // a slow sway, facing the viewer
    it.mixer.update(dt);
    r.setSize(w, h, false);
    it.cam.aspect = w / h; it.cam.updateProjectionMatrix();
    r.render(it.cena, it.cam);
    it.g2.clearRect(0, 0, w, h);
    it.g2.drawImage(r.domElement, 0, 0, w, h);
  }
}
