/* Cache map GLBs, scenery textures, and UI images so F5 / relog does not
   re-download tens of megabytes. Every request still talks to the server:
   If-None-Match / If-Modified-Since → 304 keeps the stored file, 200 replaces
   it. HTML, modules, and live JSON are never cached here. */
const CACHE = 'pv-static-v1';
const STATICO = /\.(glb|png|webp|jpe?g|gif|ogg|mp3|wav|ktx2|woff2?)$/i;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('pv-static-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('Range')) return;                                  // resume downloads stay on the network
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (!STATICO.test(url.pathname)) return;
  event.respondWith(responder(req));
});

async function responder(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const headers = new Headers(req.headers);
  if (hit){
    const etag = hit.headers.get('ETag');
    const lm = hit.headers.get('Last-Modified');
    if (etag) headers.set('If-None-Match', etag);
    if (lm) headers.set('If-Modified-Since', lm);
  }
  try {
    const r = await fetch(new Request(req, { headers, cache: 'no-cache' }));
    if (r.status === 304 && hit) return hit;
    if (r.ok) cache.put(req, r.clone()).catch(() => {});
    return r;
  } catch (e){
    if (hit) return hit;
    throw e;
  }
}
