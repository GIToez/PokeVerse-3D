/* The Terms / Privacy pages show the current version, date and "what changed" from public/data/legal.json (admin → Data files →
   Terms of Use version), so changing the version in the admin is all it takes. */
fetch('../data/legal.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(L => {
  if (!L) return;
  const set = (k, v) => { for (const el of document.querySelectorAll('[data-legal="' + k + '"]')) el.textContent = v; };
  if (L.versao) set('versao', L.versao);
  if (L.data) {
    const d = new Date(L.data + 'T12:00:00Z');
    set('data', isNaN(d) ? L.data : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }));
  }
  if (L.mudou) { set('mudou', L.mudou); for (const el of document.querySelectorAll('[data-legal="mudou-bloco"]')) el.hidden = false; }
}).catch(() => {});
