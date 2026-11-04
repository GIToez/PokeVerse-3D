/* Keep map GLBs, scenery textures, and UI images so F5 / relog does not
   re-download tens of megabytes. Every request still talks to the server:
   If-None-Match / If-Modified-Since → 304 keeps the stored file, 200 replaces it.

   The page, modules, and JSON are never stored here, but they are always
   revalidated: without a Cache-Control header the browser guesses a freshness
   window and phones kept running week-old scripts after a deploy. */
const CACHE = 'pv-static-v1';
const STATIC_FILE = /\.(glb|png|webp|jpe?g|gif|ogg|mp3|wav|ktx2|woff2?)$/i;
const CODE_FILE = /\.(m?js|json|css|html|webmanifest)$/i;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('pv-static-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('Range')) return;                                  // resumed downloads stay on the network
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/servidor')) return;                      // game API
  if (req.mode === 'navigate'){
    if (url.pathname === '/' || url.pathname === '/index.html') event.respondWith(freshPage(req));
    return;
  }
  if (CODE_FILE.test(url.pathname)) { event.respondWith(freshCode(req)); return; }
  if (STATIC_FILE.test(url.pathname)) event.respondWith(cachedAsset(req));
});

async function freshPage(req){
  try {
    const r = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
    if (!r.redirected) return r;
  } catch {}
  return fetch(req);
}

async function freshCode(req){
  try { return await fetch(req, { cache: 'no-cache' }); }
  catch { return fetch(req); }
}

async function cachedAsset(req){
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
