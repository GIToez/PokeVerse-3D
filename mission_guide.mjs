/* Ground arrow for the current mission. The minimap already draws the same pins.
   Dump coordinates are mirrored into the world with flipX. A NPC standing in this
   scene wins, because that body is already in world space. */
export function modo(){
  try { return localStorage.getItem('guia.modo') === 'desligado' ? 'desligado' : 'ligado'; }
  catch { return 'ligado'; }
}
export function definirModo(m){
  try { localStorage.setItem('guia.modo', m === 'desligado' ? 'desligado' : 'ligado'); } catch {}
}
export function alvoDe(pins, npcs, flipX){
  const lista = Array.isArray(pins) ? pins : [];
  const pin = lista.find(p => p && p.x != null && p.z != null && !p.start) || lista.find(p => p && p.x != null && p.z != null);
  if (!pin) return null;
  const n = pin.cfg != null ? (npcs || []).find(x => x && +x.cfg === +pin.cfg) : null;
  if (n && Number.isFinite(+n.x) && Number.isFinite(+n.z)) return { x: +n.x, z: +n.z };
  return { x: flipX * +pin.x, z: +pin.z };
}

let pivo = null, cenaAtual = null, relogio = 0, proxima = 0, alvo = null, visivel = false;
function arte(THREE){
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 64);
  g.fillStyle = '#f8c237';
  g.strokeStyle = '#1a1204';
  g.lineWidth = 8;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(18, 8);
  g.lineTo(108, 32);
  g.lineTo(18, 56);
  g.closePath();
  g.fill();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function garantir(THREE, cena){
  if (pivo && cenaAtual === cena) return pivo;
  if (pivo?.parent) pivo.parent.remove(pivo);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.58),
    new THREE.MeshBasicMaterial({ map: arte(THREE), transparent: true, depthWrite: false, depthTest: false, opacity: 0.9, fog: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 999;
  const g = new THREE.Group();
  g.add(m);
  g.name = 'guia-missao';
  g.visible = false;
  cena.add(g);
  pivo = g;
  cenaAtual = cena;
  return g;
}
/** Move the arrow. `ocupado` hides it during a talk or a turn battle. */
export function quadro(dt, { THREE, cena, ash, pins, npcs, flipX, chao, ocupado, voando }){
  if (!cena || !ash || modo() === 'desligado'){
    if (pivo) pivo.visible = false;
    visivel = false;
    return;
  }
  relogio += dt || 0;
  if (relogio >= proxima){
    proxima = relogio + 0.7;
    try { alvo = alvoDe(pins, npcs, flipX); } catch { alvo = null; }
  }
  let mostrar = false;
  let dist = Infinity;
  if (alvo && !ocupado && !voando){
    dist = Math.hypot(alvo.x - ash.x, alvo.z - ash.z);
    mostrar = visivel ? dist > 6 : dist > 10;
  }
  visivel = mostrar;
  if (!mostrar){
    if (pivo) pivo.visible = false;
    return;
  }
  const g = garantir(THREE, cena);
  const dx = alvo.x - ash.x, dz = alvo.z - ash.z, d = Math.hypot(dx, dz) || 1;
  const alcance = 2.6;
  const x = ash.x + (dx / d) * alcance, z = ash.z + (dz / d) * alcance;
  const y = (typeof chao === 'function' ? chao(x, z) : null);
  g.position.set(x, (y == null ? ash.y : y) + 0.08, z);
  g.rotation.y = Math.atan2(-dz, dx);
  const s = 1 + Math.sin(relogio * 4) * 0.06;
  g.scale.set(s, 1, s);
  g.visible = true;
}
