/* Renders a boss model (public/scenery/mon/<glb>.glb) in its Idle pose on a transparent background, for the Events board art.
   Needs the static server on the repo (e.g. port 8765). Usage: node tools/raid_art/render.cjs pm0144_00 out.png [giro] [port] */
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [, , glb, out, giro = '0.6', port = '8765'] = process.argv;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/tools/raid_art/render.html?glb=${glb}&giro=${giro}&w=2400&h=2400`);
  await p.waitForFunction(() => window.__png, null, { timeout: 90000 }).catch(() => {});
  const d = await p.evaluate(() => window.__png);
  if (!d) { console.log('render failed', errs); process.exit(1); }
  fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64')); console.log('rendered', out);
  await b.close();
})();
