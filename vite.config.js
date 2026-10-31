import { defineConfig } from 'vite'

/* GM panel: /admin (with or without a trailing slash, even "//admin") opens admin/index.html, and /admin/scenery
   (or the legacy /admin/cenario) opens the 3D scenery editor. The pages use absolute paths (/admin/admin.mjs,
   /data/...) because without the trailing slash the browser would resolve "./" against the site root. */
const adminRoute = {
  name: 'admin-route',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const mc = req.url && req.url.match(/^\/+admin\/(?:scenery|cenario)\/?(\?.*)?$/);
      if (mc) { req.url = '/admin/scenery.html' + (mc[1] || ''); return next(); }
      const m = req.url && req.url.match(/^\/+admin\/?(\?.*)?$/);
      if (m) req.url = '/admin/index.html' + (m[1] || '');
      next();
    });
  },
};

export default defineConfig({
  appType: 'mpa',
  plugins: [adminRoute],
  server: {
    port: 5300,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0
  }
})
