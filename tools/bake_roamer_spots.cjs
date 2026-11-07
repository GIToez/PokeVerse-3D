/* Bakes public/data/roamer_spots.json: where a roaming legendary (server_roamers.mjs) may stop — clear, flat walkable ground
 * 2 m all around, read from the game's own collision grid in a headless browser. Re-run after big scenery changes:
 *   node server.mjs & (and a static server on 8765), then: node tools/bake_roamer_spots.cjs <dir with gmtoken.txt> public/data/roamer_spots.json */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const S = process.argv[2], out = process.argv[3], fs = require('fs'), T = fs.readFileSync(S + '/gmtoken.txt', 'utf8').trim();
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 800, height: 500 } });
  await ctx.addInitScript(([t, u]) => { localStorage.setItem('conta.token', t); localStorage.setItem('conta.usuario', u); localStorage.setItem('idioma.escolha', 'en'); localStorage.setItem('aviso-gpu-visto', '1'); }, [T, 'gmtest']);
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/?idioma=en&servidor=ws://127.0.0.1:5190', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__dbg?.jogo?.ativo && window.__dbg.jogo.pika, null, { timeout: 300000 }); await sleep(8000);
  const kanto = JSON.parse(fs.readFileSync('public/data/kanto.json', 'utf8'));
  const res = await p.evaluate(caixas => {
    const D = window.__dbg, R = 2, F = D.flipX;   // the map is mirrored on x (flipX −1): box x in the file is −x in the world
    const areaAt = (x, z) => { const c = caixas.find(c => c.sx > 0 && Math.abs(x - F * c.x) <= c.sx / 2 && Math.abs(z - c.z) <= c.sz / 2); return c ? c.a : null; };   // the game's areaAtual   // clear ground 2 m all around: a 5 × 5 m square with nothing in it
    const ok = new Map(), key = (x, z) => x + ',' + z;
    const cell = (x, z) => { const k = key(x, z); if (!ok.has(k)) ok.set(k, D.livre(x + 0.5, z + 0.5) && !D.bloqueio.has(k)); return ok.get(k); };
    const out = {};
    const seen = new Set();
    for (const b of caixas) {
      const bx = F * b.x;
      for (let x = Math.ceil(bx - b.sx / 2) + R; x < bx + b.sx / 2 - R; x += 2) for (let z = Math.ceil(b.z - b.sz / 2) + R; z < b.z + b.sz / 2 - R; z += 2) {
        let good = true;
        for (let dx = -R; dx <= R && good; dx++) for (let dz = -R; dz <= R; dz++) if (!cell(x + dx, z + dz)) { good = false; break; }
        if (!good) continue;
        const y0 = D.chaoEm(x + 0.5, z + 0.5);
        // flat: the ground in the square differs by under 0.6 m (no ledge or stairs under the body)
        let flat = true;
        for (const [dx, dz] of [[-R, -R], [R, -R], [-R, R], [R, R]]) { const y = D.chaoEm(x + dx + 0.5, z + dz + 0.5); if (y == null || Math.abs(y - y0) > 0.6) { flat = false; break; } }
        const a = areaAt(x + 0.5, z + 0.5);
        if (flat && a != null && !seen.has(key(x, z))) { seen.add(key(x, z)); (out[a] || (out[a] = [])).push([x + 0.5, z + 0.5]); }
      }
    }
    return out;
  }, kanto.caixas);
  const areas = {};
  for (const [a, L] of Object.entries(res)) if (L.length) areas[a] = L.length > 300 ? L.filter((_, i) => i % Math.ceil(L.length / 300) === 0) : L;
  fs.writeFileSync(out, JSON.stringify({ sobre: 'Where a roaming legendary may stop (server_roamers.mjs): world points (x already mirrored) with clear, flat walkable ground 2 m all around, baked from the game\'s collision grid (tools/bake_roamer_spots.cjs); the area is the one the game says you are in there. Re-bake after big scenery changes.', mapa: 'kanto', areas }) + '\n');
  console.log(Object.entries(areas).map(([a, L]) => a + ':' + L.length).join(' '));
  await b.close();
})();
