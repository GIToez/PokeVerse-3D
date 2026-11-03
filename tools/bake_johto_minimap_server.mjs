/**
 * One-shot server for tools/bake_johto_minimap.html. Writes ui/minimapa_johto.jpg
 * and the ruler json, then exits.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = Number(process.env.BAKE_PORT) || 8771;

function send(res, code, body, type){
  res.writeHead(code, { 'content-type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function arquivo(urlPath){
  const rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (rel.includes('..')) return null;
  const tentativas = [
    path.join(ROOT, 'public', rel),
    path.join(ROOT, rel),
  ];
  for (const p of tentativas){
    if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/log'){
    let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { console.log(b); send(res, 204, ''); });
    return;
  }
  if (req.method === 'POST' && req.url === '/save'){
    let b = ''; req.on('data', c => { b += c; });
    req.on('end', () => {
      const d = JSON.parse(b);
      const jpeg = Buffer.from(String(d.jpeg).replace(/^data:image\/jpeg;base64,/, ''), 'base64');
      fs.writeFileSync(path.join(ROOT, 'ui/minimapa_johto.jpg'), jpeg);
      const regua = { x0: d.x0, z0: d.z0, esc: d.esc, w: d.w, h: d.h };
      fs.writeFileSync(path.join(ROOT, 'ui/minimapa_johto.json'), JSON.stringify(regua) + '\n');
      console.log('wrote', jpeg.length, 'bytes', JSON.stringify(regua));
      send(res, 200, 'ok');
      setTimeout(() => process.exit(0), 200);
    });
    return;
  }
  const p = arquivo(req.url === '/' ? '/tools/bake_johto_minimap.html' : req.url);
  if (!p){ send(res, 404, 'missing ' + req.url); return; }
  res.writeHead(200, { 'content-type': tipos[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => console.log('bake server http://127.0.0.1:' + PORT));
