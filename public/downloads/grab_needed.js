/* PokeVerse: download the files we still need from PokeFable (updated 2026-11-05 for the Articuno raid).
   Run on a pokefableonline.com page while signed in: the bookmarklet, or paste this whole file into the F12 console.
   Best run while (or right after) you are in the raid, so the page has the raid's files open.
   It fetches: the gated raid files (r01 Articuno, r03 Zapdos, r05 Mewtwo), the r05 sounds, their current raid data and
   raid code; then everything the raid configs point to, and every raid / effect / sound file this page has loaded.
   Saves pokeverse-needed.zip (their folder names; Claude maps them). What it could not get is listed in _report.json. */
(async () => {
  const PATHS = ["cenario/raid/r01/r01_animacoes.json", "cenario/raid/r01/r01_config.json", "cenario/raid/r03/escudo_eletrico.png", "cenario/raid/r03/marcas/abrigo_ciano.png", "cenario/raid/r03/marcas/anel_borda.png", "cenario/raid/r03/marcas/area_circular.png", "cenario/raid/r03/marcas/cone_vento.png", "cenario/raid/r03/marcas/faixa_linha.png", "cenario/raid/r03/marcas/interagir_dourado.png", "cenario/raid/r03/marcas/marca_alvo.png", "cenario/raid/r03/marcas/polaridade_mais.png", "cenario/raid/r03/marcas/polaridade_menos.png", "cenario/raid/r03/r03_animacoes.json", "cenario/raid/r03/r03_arena.glb", "cenario/raid/r03/r03_pecas.glb", "cenario/raid/r03/r03_zapdos_anim.glb", "cenario/raid/r03/referencia/envelope-animacoes-v7.json", "cenario/raid/r03/referencia/envelope-zapdos.json", "cenario/raid/r05/r05_arena.glb", "cenario/raid/r05/r05_config.json", "cenario/raid/r05/ampliacao/config.json", "data/raid_r05.json", "cenario/raid/r01/colisoes.json"];
  const box = document.createElement('div');
  Object.assign(box.style, { position: 'fixed', zIndex: 2147483647, right: '12px', bottom: '12px', padding: '10px 14px', background: '#0b1630', color: '#fff', font: '13px sans-serif', border: '2px solid #f8c237', borderRadius: '10px', maxWidth: '360px', whiteSpace: 'pre-wrap' });
  document.body.appendChild(box);
  const say = t => { box.textContent = 'PokeVerse missing files\n' + t; };
  const files = new Map(), failed = [], queue = [...PATHS], seen = new Set(PATHS);
  const add = (p) => { p = String(p || '').replace(/^\/+/, '').split('?')[0]; if (p && !seen.has(p)) { seen.add(p); queue.push(p); } };
  /* everything this page already loaded from the raid, effect and sound folders */
  try { for (const e of performance.getEntriesByType('resource')) { const u = new URL(e.name, location.href); if (u.origin === location.origin && /^\/(cenario\/raid|som\/raid|particulas|data\/raid|raid)/.test(decodeURIComponent(u.pathname))) add(decodeURIComponent(u.pathname)); } } catch {}
  /* files named inside the JSON we get (raid configs, animation lists), relative to that file's folder */
  const follow = (p, bytes) => {
    if (!/\.json$/.test(p)) return;
    let txt = ''; try { txt = new TextDecoder().decode(bytes); } catch { return; }
    const dir = p.slice(0, p.lastIndexOf('/') + 1);
    let base = dir; try { const j = JSON.parse(txt); if (j?.arte?.base) base = j.arte.base; if (j?.arte?.sons?.base) for (const f of j.arte.sons.arquivos || []) add(j.arte.sons.base + f); } catch {}
    for (const m of txt.matchAll(/"([^"\s]{1,120}\.(?:glb|png|webp|jpg|json|ogg|mp3|wav|ktx2))"/g)) { const f = m[1]; add(/^(cenario|som|particulas|data|ui)\//.test(f) ? f : base + f); }
  };
  let n = 0;
  while (queue.length) {
    const p = queue.shift();
    say('Downloading ' + (++n) + ' / ' + (n + queue.length) + '\n' + p);
    try {
      const r = await fetch('/' + p.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
      if (!r.ok) { failed.push(p + ' (' + r.status + ')'); continue; }
      const b = new Uint8Array(await r.arrayBuffer());
      if (!/\.html?$/.test(p) && /^\s*<(!doctype|html)/i.test(new TextDecoder().decode(b.slice(0, 64)))) { failed.push(p + ' (not found: got a web page)'); continue; }   // a soft 404
      files.set(p, b); follow(p, b);
    } catch (e) { failed.push(p + ' (' + e.message + ')'); }
  }
  files.set('_report.json', new TextEncoder().encode(JSON.stringify({ when: new Date().toISOString(), got: [...files.keys()], failed }, null, 1)));
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const zip = list => {
    const parts = [], cen = []; let off = 0;
    for (const [name, data] of list) {
      const nb = new TextEncoder().encode(name), c = crc(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, c, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
      parts.push(h.buffer, nb, data);
      const e = new DataView(new ArrayBuffer(46));
      e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint32(16, c, true); e.setUint32(20, data.length, true); e.setUint32(24, data.length, true); e.setUint16(28, nb.length, true); e.setUint32(42, off, true);
      cen.push(e.buffer, nb); off += 30 + nb.length + data.length;
    }
    const size = cen.reduce((t, x) => t + (x.byteLength ?? x.length), 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, list.length, true); end.setUint16(10, list.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cen, end.buffer], { type: 'application/zip' });
  };
  const a = document.createElement('a'); a.href = URL.createObjectURL(zip([...files])); a.download = 'pokeverse-needed.zip';
  document.body.appendChild(a); a.click(); a.remove();
  say('Done: ' + (files.size - 1) + ' of ' + n + ' files in pokeverse-needed.zip.' + (failed.length ? '\nNot available (' + failed.length + '):\n' + failed.slice(0, 8).join('\n') + (failed.length > 8 ? '\n…' : '') : '') + '\nUpload the zip to Claude.');
})();
