/* BDSP-style streetlight: gray tapered post, open 4-pane lantern, hipped roof. */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof FileReader === 'undefined'){
  globalThis.FileReader = class {
    readAsArrayBuffer(blob){
      Promise.resolve(blob.arrayBuffer ? blob.arrayBuffer() : blob).then(ab => {
        this.result = ab;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const metal = () => new THREE.MeshStandardMaterial({
  name: 'post', color: 0x4a4e56, metalness: 0.42, roughness: 0.48,
});
const glassMat = () => new THREE.MeshStandardMaterial({
  name: 'glass',
  color: 0xc5d0b4,
  emissive: 0xffe7a0,
  emissiveIntensity: 0.08,
  transparent: true,
  opacity: 0.58,
  roughness: 0.16,
  metalness: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});

function box(mat, w, h, d, x, y, z, name){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.name = name; return m;
}
function cyl(mat, rTop, rBot, h, y, segs, name){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
  m.position.y = y; m.name = name; return m;
}

const scene = new THREE.Scene();
const root = new THREE.Group();
root.name = 'lamppost';
const postM = metal(), glassM = glassMat();

root.add(box(postM, 0.38, 0.09, 0.38, 0, 0.045, 0, 'post_base'));
root.add(cyl(postM, 0.055, 0.07, 0.12, 0.14, 12, 'post_neck'));
root.add(cyl(postM, 0.034, 0.042, 2.52, 1.46, 12, 'post_pole'));
root.add(cyl(postM, 0.055, 0.05, 0.07, 2.755, 12, 'post_collar'));

const floorY = 2.82;
root.add(box(postM, 0.44, 0.045, 0.44, 0, floorY, 0, 'post_lantern_floor'));

const paneH = 0.48, paneY = floorY + 0.022 + paneH / 2, half = 0.175;
for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]){
  root.add(box(postM, 0.038, paneH + 0.02, 0.038, sx * half, paneY, sz * half, 'post_corner'));
}
root.add(box(postM, 0.39, 0.03, 0.03, 0, paneY + paneH / 2 - 0.01, half, 'post_rail'));
root.add(box(postM, 0.39, 0.03, 0.03, 0, paneY + paneH / 2 - 0.01, -half, 'post_rail'));
root.add(box(postM, 0.03, 0.03, 0.39, half, paneY + paneH / 2 - 0.01, 0, 'post_rail'));
root.add(box(postM, 0.03, 0.03, 0.39, -half, paneY + paneH / 2 - 0.01, 0, 'post_rail'));

root.add(box(glassM, 0.31, paneH - 0.04, 0.016, 0, paneY, half - 0.01, 'glass'));
root.add(box(glassM, 0.31, paneH - 0.04, 0.016, 0, paneY, -(half - 0.01), 'glass'));
root.add(box(glassM, 0.016, paneH - 0.04, 0.31, half - 0.01, paneY, 0, 'glass'));
root.add(box(glassM, 0.016, paneH - 0.04, 0.31, -(half - 0.01), paneY, 0, 'glass'));

const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glassM);
bulb.position.y = paneY;
bulb.name = 'glass_bulb';
root.add(bulb);

const capY = paneY + paneH / 2 + 0.022;
root.add(box(postM, 0.46, 0.04, 0.46, 0, capY, 0, 'post_lantern_cap'));

const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.30, 4), postM);
roof.rotation.y = Math.PI / 4;
roof.position.y = capY + 0.17;
roof.name = 'post_roof';
root.add(roof);

const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), postM);
knob.position.y = capY + 0.34;
knob.name = 'post_finial_knob';
root.add(knob);
root.add(cyl(postM, 0.006, 0.016, 0.22, capY + 0.46, 8, 'post_spike'));

scene.add(root);

const dests = [
  path.resolve('public/scenery/prop/lamppost.glb'),
  path.resolve('scenery/prop/lamppost.glb'),
];
const exporter = new GLTFExporter();
const buf = await exporter.parseAsync(scene, { binary: true });
const bytes = Buffer.from(buf);
for (const d of dests){
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.writeFileSync(d, bytes);
  console.log('wrote', d, bytes.length);
}
