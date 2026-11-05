/* PokeVerse: download every file on public/downloads/pokefable_needed.txt (the gated raid files, re-checked when PokeFable opens them).
   Run on a pokefableonline.com page while signed in: the bookmarklet, or paste this whole file into the F12 console.
   Saves pokeverse-needed.zip (their folder names; Claude maps them). Files you can't open yet (gated) are listed in _report.json. */
(async () => {
  const PATHS = ["cenario/raid/r01/marcas/abrigo_ciano.png", "cenario/raid/r01/marcas/anel_borda.png", "cenario/raid/r01/marcas/area_circular.png", "cenario/raid/r01/marcas/cone_vento.png", "cenario/raid/r01/marcas/interagir_dourado.png", "cenario/raid/r01/marcas/marca_alvo.png", "cenario/raid/r01/r01_animacoes.json", "cenario/raid/r01/r01_arena.glb", "cenario/raid/r01/r01_articuno_anim.glb", "cenario/raid/r01/r01_config.json", "cenario/raid/r01/r01_pecas.glb", "cenario/raid/r03/escudo_eletrico.png", "cenario/raid/r03/marcas/abrigo_ciano.png", "cenario/raid/r03/marcas/anel_borda.png", "cenario/raid/r03/marcas/area_circular.png", "cenario/raid/r03/marcas/cone_vento.png", "cenario/raid/r03/marcas/faixa_linha.png", "cenario/raid/r03/marcas/interagir_dourado.png", "cenario/raid/r03/marcas/marca_alvo.png", "cenario/raid/r03/marcas/polaridade_mais.png", "cenario/raid/r03/marcas/polaridade_menos.png", "cenario/raid/r03/r03_animacoes.json", "cenario/raid/r03/r03_arena.glb", "cenario/raid/r03/r03_pecas.glb", "cenario/raid/r03/r03_zapdos_anim.glb", "cenario/raid/r03/referencia/envelope-animacoes-v7.json", "cenario/raid/r03/referencia/envelope-zapdos.json", "cenario/raid/r05/r05_arena.glb"];
  const box = document.createElement('div');
  Object.assign(box.style, { position: 'fixed', zIndex: 2147483647, right: '12px', bottom: '12px', padding: '10px 14px', background: '#0b1630', color: '#fff', font: '13px sans-serif', border: '2px solid #f8c237', borderRadius: '10px', maxWidth: '360px', whiteSpace: 'pre-wrap' });
  document.body.appendChild(box);
  const say = t => { box.textContent = 'PokeVerse missing files\n' + t; };
  const files = new Map(), failed = [];
  let n = 0;
  for (const p of PATHS) {
    say('Downloading ' + (++n) + ' / ' + PATHS.length + '\n' + p);
    try {
      const r = await fetch('/' + p.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
      if (!r.ok) { failed.push(p + ' (' + r.status + ')'); continue; }
      files.set(p, new Uint8Array(await r.arrayBuffer()));
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
  say('Done: ' + (files.size - 1) + ' of ' + PATHS.length + ' files in pokeverse-needed.zip.' + (failed.length ? '\nNot available (' + failed.length + '):\n' + failed.slice(0, 8).join('\n') + (failed.length > 8 ? '\n…' : '') : '') + '\nUpload the zip to Claude.');
})();
