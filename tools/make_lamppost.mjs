/* Pallet-style streetlight GLB: dark metal post + lantern glass. */
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
  name: 'post', color: 0x2a2e36, metalness: 0.72, roughness: 0.38,
});
const glassMat = () => new THREE.MeshStandardMaterial({
  name: 'glass', color: 0xdce6f2, emissive: 0xfff4d0, emissiveIntensity: 0,
  transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.05,
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

root.add(box(postM, 0.34, 0.16, 0.34, 0, 0.08, 0, 'post_base'));
root.add(box(postM, 0.22, 0.10, 0.22, 0, 0.20, 0, 'post_plinth'));
root.add(cyl(postM, 0.048, 0.055, 3.05, 1.78, 10, 'post_pole'));
root.add(box(postM, 0.16, 0.06, 0.16, 0, 3.34, 0, 'post_collar'));

const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 6, 1, true), postM);
frame.position.y = 3.62; frame.name = 'post_lantern';
root.add(frame);
root.add(box(postM, 0.36, 0.05, 0.36, 0, 3.40, 0, 'post_lantern_floor'));
root.add(box(postM, 0.34, 0.06, 0.34, 0, 3.84, 0, 'post_lantern_cap'));
root.add(cyl(postM, 0.01, 0.045, 0.22, 4.00, 6, 'post_spike'));

const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.36, 6), glassM);
glass.position.y = 3.62; glass.name = 'glass';
root.add(glass);

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
