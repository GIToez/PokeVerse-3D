(async () => {
  /* PokeVerse: the Competition Center and anything new linked to it (the Colosseum). Run on a logged-in PokeFable tab. */
  const OURS = new Set([1000001, 2000001, 1000002, 2100001, 2100002, 2100003, 2100004, 2100005, 2100006, 2100007, 2100008, 2100009, 2100010, 2100011, 2100012, 2100013, 2500001, 2520001, 2520002, 2520003, 2520004, 2520005, 2520006, 2520007, 2540001, 2540002, 4110001, 4110002, 4110003, 4110004, 4110006, 4110007, 4110008, 4110009, 4110010, 4110011, 4110012, 4110013, 4110014, 4110015, 4110016, 4110017, 4110018, 4110019, 4110020, 4120001, 4120002, 4120003, 4120004, 4120005, 4120006, 4120007, 4120008, 4120009, 4120010, 4120011, 4120012, 4120013, 4120014, 4120015, 4120016, 4120017, 4120018, 4120019, 4120020, 4220010, 4220013, 4400007, 4400008, 4400014, 4440001, 4440037, 4700001, 9700001, 9100001]);
  const PATHS = ['data/cenas.json', 'data/portas.json', 'data/kanto.json', 'data/npcs_glb.json', 'data/npcs_falas.json', 'cenario/kanto_chao.json', 'cenario/kanto.glb','data/9800002.json','cenario/9800002.glb','cenario/9800002_chao.json'];
  const box = document.createElement('div');
  Object.assign(box.style, { position: 'fixed', zIndex: 2147483647, right: '12px', bottom: '12px', padding: '10px 14px', background: '#0b1630', color: '#fff', font: '13px sans-serif', border: '2px solid #f8c237', borderRadius: '10px', maxWidth: '360px', whiteSpace: 'pre-wrap' });
  document.body.appendChild(box);
  const say = t => { box.textContent = 'PokeVerse: Competition Center\n' + t; };
  const files = new Map(), failed = [], queue = [...PATHS], seen = new Set(PATHS);
  const add = (p) => { p = String(p || '').replace(/^\/+/, '').split('?')[0]; if (p && !seen.has(p)) { seen.add(p); queue.push(p); } };
  /* anything this page loaded whose name mentions the Colosseum or the Competition Center */
  try { for (const e of performance.getEntriesByType('resource')) { const u = new URL(e.name, location.href), p = decodeURIComponent(u.pathname); if (u.origin === location.origin && /colise|colosse|competi|torneio|tournament/i.test(p)) add(p); } } catch {}
  const novas = [];
  let n = 0;
  while (queue.length) {
    const p = queue.shift();
    say('Downloading ' + (++n) + ' / ' + (n + queue.length) + '\n' + p);
    try {
      const r = await fetch('/' + p.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
      if (!r.ok) { failed.push(p + ' (' + r.status + ')'); continue; }
      const b = new Uint8Array(await r.arrayBuffer());
      if (!/\.html?$/.test(p) && /^\s*<(!doctype|html)/i.test(new TextDecoder().decode(b.slice(0, 64)))) { failed.push(p + ' (not found: got a web page)'); continue; }
      files.set(p, b);
      if (p === 'data/cenas.json') {                                   /* every scene we don't have yet: its data, model and floor */
        try { const j = JSON.parse(new TextDecoder().decode(b)); for (const c of (j.cenas || [])) if (c && !OURS.has(+c.id)) { novas.push(c.id + ' ' + (c.nome || '')); add('data/' + c.id + '.json'); add('cenario/' + c.id + '.glb'); add('cenario/' + c.id + '_chao.json'); } } catch {}
      }
    } catch (e) { failed.push(p + ' (' + e.message + ')'); }
  }
  files.set('_new_scenes.txt', new TextEncoder().encode(novas.join('\n') || '(none)'));
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(zip([...files])); a.download = 'pokeverse-competition-center.zip';
  document.body.appendChild(a); a.click(); a.remove();
  say('Done: ' + (files.size - 1) + ' of ' + n + ' files in pokeverse-competition-center.zip.' + (failed.length ? '\nNot available (' + failed.length + '):\n' + failed.slice(0, 8).join('\n') + (failed.length > 8 ? '\n…' : '') : '') + '\nUpload the zip to Claude.');
})();

