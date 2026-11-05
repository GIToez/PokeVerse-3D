/* LOGIN SCENE (concept G, 2026-11-05): the login and sign-up screens' background and title, drawn by code instead of the
 * mockup's painted images. An anime-style route (sky, drifting clouds, hills, a ROUTE 1 sign, swaying tall grass, wind and
 * leaves) where, every 7 s, one clump of grass rustles, eyes peek out, a "!" pops and the screen flashes — a wild encounter.
 * The title is the PokeVerse wordmark with the tagline "The Pokémon universe, together".
 *
 *   LoginScene.dress(pop)  — screens.mjs calls it after mounting `login` / `cadastro`: fills [data-fig="img/fundo"] and
 *                            [data-fig="img/logo"] (and hides the old BETA plate). Everything else (the panel, the buttons,
 *                            the language and Discord buttons) stays the mockup's, which is already the in-game UI.
 *
 * The scene is laid out on a 1440×810 stage and scaled to cover the background box, so it works for the PC (1920×1080) and the
 * phone (844×475) mockups alike. `prefers-reduced-motion` stops the movement. */

const W = 1440, H = 810;
const rnd = (i, m) => ((Math.sin(i * 12.9898 + m * 78.233) * 43758.5453) % 1 + 1) % 1;

const CSS = `
.ls-stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;overflow:hidden;pointer-events:none;
  background:linear-gradient(180deg,#3a9bff 0%,#66b8ff 28%,#a9dcff 52%,#e6f7ff 60%,#5dbf63 60.2%,#3f9e4c 100%)}
.pf-tela [data-fig="titulo-painel"],.pf-tela [data-fig="titulo-painel"] *{z-index:200!important;opacity:1!important;filter:none!important;color:#fff!important;text-shadow:0 2px 0 #0a1830}
.pf-tela [data-fig="txt/versao"]{color:#e9f4ff!important;text-shadow:0 1px 2px #0a1830,0 0 6px #0a1830}
.ls-stage *{box-sizing:border-box}
@keyframes lsCloud{from{transform:translateX(-420px)}to{transform:translateX(1860px)}}
@keyframes lsWave{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(4deg)}}
@keyframes lsWind{0%{transform:translateX(-200px);opacity:0}15%{opacity:.8}100%{transform:translateX(1600px);opacity:0}}
@keyframes lsRustle{0%,62%,100%{transform:rotate(0) translateY(0)}65%{transform:rotate(-7deg) translateY(-2px)}68%{transform:rotate(7deg)}71%{transform:rotate(-6deg)}74%{transform:rotate(5deg)}77%{transform:rotate(0)}}
@keyframes lsEyes{0%,64%,100%{opacity:0;transform:translateY(16px)}72%,92%{opacity:1;transform:translateY(0)}}
@keyframes lsBang{0%,70%,100%{opacity:0;transform:scale(0) translateY(10px)}74%{opacity:1;transform:scale(1.35) translateY(0)}78%,94%{opacity:1;transform:scale(1)}}
@keyframes lsFlash{0%,73%,100%{opacity:0}74%{opacity:.6}76%{opacity:0}77%{opacity:.4}79%{opacity:0}}
@keyframes lsLeaf{0%{transform:translate(0,0) rotate(0);opacity:0}10%{opacity:1}100%{transform:translate(1500px,-160px) rotate(720deg);opacity:0}}
@keyframes lsShine{0%{background-position:-180% 0}100%{background-position:180% 0}}
@keyframes lsHop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.ls-cloud{position:absolute;left:0;animation:lsCloud linear infinite}
.ls-clump{position:absolute;width:170px;height:140px;transform-origin:50% 100%;animation:lsWave 3.6s ease-in-out infinite}
.ls-clump.ls-enc{animation:lsRustle 7s ease-in-out infinite}
.ls-wind{position:absolute;left:0;width:120px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);animation:lsWind 5s linear infinite}
.ls-leaf{position:absolute;left:-40px;width:16px;height:10px;border-radius:12px 0;background:#8fdc5a;border:2px solid #2f7a32;animation:lsLeaf linear infinite}
.ls-eyes{position:absolute;left:58px;top:54px;display:flex;gap:14px;animation:lsEyes 7s ease-in-out infinite}
.ls-eye{width:15px;height:21px;border-radius:50%;background:#0c1730}
.ls-eye::after{content:"";display:block;width:6px;height:6px;margin:4px 0 0 5px;border-radius:50%;background:#fff}
.ls-bang{position:absolute;width:50px;height:60px;transform-origin:50% 100%;animation:lsBang 7s ease-in-out infinite;
  clip-path:polygon(20% 0,80% 0,100% 20%,100% 80%,80% 100%,20% 100%,0 80%,0 20%);background:#0a1830;display:flex;align-items:center;justify-content:center}
.ls-bang b{width:42px;height:52px;clip-path:polygon(20% 0,80% 0,100% 20%,100% 80%,80% 100%,20% 100%,0 80%,0 20%);background:#F8C237;
  display:flex;align-items:center;justify-content:center;font:800 40px/1 "Baloo 2",system-ui,sans-serif;color:#0a1830}
.ls-flash{position:absolute;inset:0;background:#fff;animation:lsFlash 7s linear infinite}
.ls-logo{position:absolute;left:50%;top:50%;width:640px;height:240px;transform-origin:0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.ls-hop{display:flex;flex-direction:column;align-items:center;animation:lsHop 5s ease-in-out infinite}
.ls-word{position:relative;display:flex;align-items:baseline;filter:drop-shadow(0 6px 0 #0a1830) drop-shadow(0 14px 22px rgba(10,24,48,.45))}
.ls-word span{font:800 128px/1 "Baloo 2",system-ui,sans-serif;letter-spacing:-2px;white-space:nowrap}
.ls-poke{color:#F8C237;-webkit-text-stroke:10px #0a1830;paint-order:stroke fill}
.ls-verse{position:relative}
.ls-verse i{position:absolute;inset:0;font-style:normal;color:transparent;-webkit-text-stroke:10px #0a1830}
.ls-verse em{position:relative;font-style:normal;background:linear-gradient(100deg,#fff 0%,#fff3c4 35%,#fff 50%,#ffe28a 65%,#fff 100%);background-size:200% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:lsShine 7s linear infinite}
.ls-tag{margin-top:14px;display:flex;align-items:center;height:40px;padding:0 24px;background:#0E1F33;color:#F8C237;white-space:nowrap;
  clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,14px 100%,0 50%);font:800 17px "Baloo 2",system-ui,sans-serif;letter-spacing:3px}
@media (prefers-reduced-motion: reduce){.ls-stage *,.ls-logo *{animation:none!important}.ls-flash,.ls-bang,.ls-eyes{display:none}}`;

function style() {
  if (document.getElementById('login-scene-css')) return;
  const s = document.createElement('style'); s.id = 'login-scene-css'; s.textContent = CSS; document.head.appendChild(s);
}

const CLOUD = '<svg viewBox="0 0 300 130" width="100%" height="100%"><path d="M30 120C0 120 0 80 34 80 30 44 80 34 98 58c10-38 72-44 84-4 18-22 68-14 64 24 44-2 50 42 16 42Z" fill="#fff"/><path d="M30 120c-20-2-18-20 6-20 84 12 164 4 226 0 24 4 22 20 0 20Z" fill="#d7ecff"/></svg>';
const CLUMP = '<svg viewBox="0 0 170 140" width="170" height="140" aria-hidden="true">'
  + '<path d="M6 140 14 64l14 40 8-70 16 62 10-74 14 70 10-82 12 80 12-64 10 70 14-56 10 64 14-44 6 80Z" fill="#2c8f3c" stroke="#16552a" stroke-width="5" stroke-linejoin="round"/>'
  + '<path d="M22 140 30 92l10 28 10-50 12 48 10-60 12 58 12-64 10 66 12-48 10 50 12-28 8 48Z" fill="#45b54f"/>'
  + '<path d="M38 112 50 76l6 28M72 102l12-40 6 36M106 104l12-30 4 26" fill="none" stroke="#9be36a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HILLS = '<svg viewBox="0 0 1440 420" width="1440" height="420" style="position:absolute;left:0;top:330px" aria-hidden="true">'
  + '<path d="M0 150C150 110 280 140 420 112s280 18 440-8 320 16 580-8V420H0Z" fill="#5dbf63"/>'
  + '<g fill="#2f8f45"><circle cx="80" cy="120" r="34"/><circle cx="130" cy="108" r="42"/><circle cx="182" cy="122" r="30"/><circle cx="1210" cy="92" r="38"/><circle cx="1262" cy="80" r="46"/><circle cx="1320" cy="96" r="34"/><circle cx="1380" cy="88" r="40"/></g>'
  + '<g fill="#3fa956"><circle cx="118" cy="98" r="20"/><circle cx="1250" cy="70" r="22"/><circle cx="1370" cy="78" r="18"/></g>'
  + '<path d="M0 210c200-34 380 2 600-22s440 18 840-12V420H0Z" fill="#4fb35a"/>'
  + '<path d="M640 420c40-80 72-140 102-174 14-16 30-24 48-24-20 24-38 78-44 198Z" fill="#f3dca0"/>'
  + '<path d="M650 420c40-76 70-132 98-168" fill="none" stroke="#e2c27c" stroke-width="4"/>'
  + '<g transform="translate(520 196)"><rect x="-4" y="0" width="8" height="44" fill="#7a4a22"/><rect x="-46" y="-30" width="92" height="36" rx="6" fill="#a86a33" stroke="#5a3415" stroke-width="4"/>'
  + '<text x="0" y="-6" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="18" fill="#fff6dd">ROUTE 1</text></g></svg>';

/** The animated route, built once per screen. */
function stage() {
  const el = document.createElement('div'); el.className = 'ls-stage'; el.setAttribute('aria-hidden', 'true');
  let h = '';
  for (let i = 0; i < 4; i++) {
    const w = 220 + rnd(i, 2) * 160;
    h += `<div class="ls-cloud" style="top:${(24 + rnd(i, 1) * 170).toFixed(0)}px;width:${w.toFixed(0)}px;height:${(w * 0.43).toFixed(0)}px;animation-duration:${(70 + rnd(i, 3) * 40).toFixed(0)}s;animation-delay:${(-rnd(i, 4) * 100).toFixed(0)}s">${CLOUD}</div>`;
  }
  h += HILLS;
  for (let i = 0; i < 4; i++) h += `<div class="ls-wind" style="top:${(480 + rnd(i, 5) * 200).toFixed(0)}px;animation-delay:${(-rnd(i, 6) * 5).toFixed(2)}s"></div>`;
  for (let i = 0; i < 5; i++) h += `<div class="ls-leaf" style="top:${(500 + rnd(i, 7) * 220).toFixed(0)}px;animation-duration:${(8 + rnd(i, 8) * 6).toFixed(1)}s;animation-delay:${(-rnd(i, 9) * 12).toFixed(1)}s"></div>`;
  const spots = [[-40, 10], [90, 60], [210, 0], [330, 50], [450, -10], [880, 40], [990, 90], [1010, 0], [1130, 50], [1250, 0], [1340, 60], [560, -40], [760, -40], [150, -40]];
  spots.forEach(([x, b], i) => {
    const enc = i === 6;
    h += `<div class="ls-clump${enc ? ' ls-enc' : ''}" style="left:${x}px;bottom:${b}px;animation-delay:${enc ? 0 : (-rnd(i, 10) * 3.6).toFixed(2)}s">${CLUMP}${enc ? '<div class="ls-eyes"><div class="ls-eye"></div><div class="ls-eye"></div></div>' : ''}</div>`;
  });
  h += '<div class="ls-bang" style="left:1052px;bottom:214px"><b>!</b></div><div class="ls-flash"></div>';
  el.innerHTML = h;
  return el;
}

/** The PokeVerse wordmark and tagline. */
function logo(tagline) {
  const el = document.createElement('div'); el.className = 'ls-logo';
  el.innerHTML = '<div class="ls-hop"><div class="ls-word" role="img" aria-label="PokeVerse"><span class="ls-poke">Poke</span>'
    + '<span class="ls-verse"><i>Verse</i><em>Verse</em></span></div><div class="ls-tag"></div></div>';
  el.querySelector('.ls-tag').textContent = tagline;
  return el;
}

/** Scales `child` (laid out at w×h) to cover (`cover`) or fit inside the box `box`, centred. */
function encaixar(box, child, w, h, cover) {
  const bw = box.clientWidth || parseFloat(box.style.width) || w, bh = box.clientHeight || parseFloat(box.style.height) || h;
  const k = cover ? Math.max(bw / w, bh / h) : Math.min(bw / w, bh / h);
  child.style.transform = `translate(${((bw - w * k) / 2).toFixed(1)}px, ${((bh - h * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`;
  if (!cover) { child.style.left = '0'; child.style.top = '0'; }
}

/* TWILIGHT (concept I, 2026-11-05, the one in use): the art is the player-supplied animated pixel scene (ui/login/background.png,
   48 frames) and the animated PokeVerse logo (ui/login/logo.png), centred at the top with the tagline; the login panel (the
   mockup's in-game panel) moves to the bottom centre; falling autumn petals over the scene. The route scene above stays here as
   the other option (STYLE = 'route'). */
const STYLE = 'twilight';
const TW_CSS = `
.lt-fundo{background:url(./ui/login/background.png) center/cover no-repeat!important;image-rendering:pixelated}
.lt-veu{position:absolute;inset:0;pointer-events:none;background:radial-gradient(70% 60% at 50% 30%,rgba(30,10,60,0) 40%,rgba(20,8,40,.55) 100%)}
@keyframes ltPetal{0%{transform:translate(0,0) rotate(0);opacity:0}10%{opacity:1}100%{transform:translate(-46vw,110vh) rotate(540deg);opacity:0}}
.lt-petal{position:absolute;top:-3%;width:.8%;aspect-ratio:3/2;border-radius:60% 0;animation:ltPetal linear infinite;pointer-events:none}
@keyframes ltDrop{0%{transform:translateY(-30px) scale(.9);opacity:0}60%{transform:translateY(6px) scale(1.02);opacity:1}100%{transform:none;opacity:1}}
@keyframes ltSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes ltUp{0%{transform:translateY(40px);opacity:0}100%{transform:none;opacity:1}}
.lt-logo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;pointer-events:none;animation:ltDrop 1.1s ease-out both}
.lt-logo img{width:100%;height:auto;animation:ltSway 7s ease-in-out 1.2s infinite;filter:drop-shadow(0 10px 20px rgba(30,10,60,.6))}
.lt-logo span{margin-top:.4em;font:800 17px "Baloo 2",system-ui,sans-serif;letter-spacing:.35em;color:#ffe2b0;white-space:nowrap;text-shadow:0 2px 8px rgba(30,10,60,.85)}
.lt-sobe{animation:ltUp 1s ease-out .5s both}
.pf-tela [data-fig="titulo-painel"],.pf-tela [data-fig="titulo-painel"] *{z-index:200!important;opacity:1!important;filter:none!important;color:#fff!important;text-shadow:0 2px 0 #0a1830}
.pf-tela [data-fig="txt/versao"]{color:#e9f4ff!important;text-shadow:0 1px 2px #0a1830,0 0 6px #0a1830}
@media (prefers-reduced-motion: reduce){.lt-petal{display:none}.lt-logo,.lt-logo img,.lt-sobe{animation:none!important}}`;

function dressTwilight(pop, t) {
  if (!document.getElementById('login-twilight-css')) { const st = document.createElement('style'); st.id = 'login-twilight-css'; st.textContent = TW_CSS; document.head.appendChild(st); }
  const fundo = pop.querySelector('[data-fig="img/fundo"]'), marca = pop.querySelector('[data-fig="img/logo"]'), painel = pop.querySelector('[data-fig^="painel-"]');
  const raiz = fundo?.parentElement;
  const W0 = parseFloat(fundo?.style.width) || fundo?.clientWidth || 1920, H0 = parseFloat(fundo?.style.height) || fundo?.clientHeight || 1080;
  const y0 = -(parseFloat(raiz?.style.top) || 0);   // the 16:9 art is cropped to the screen: y0 = how far down the visible part starts
  const vis = Math.min(H0, H0 - 2 * y0 > 0 ? H0 - 2 * y0 : H0);
  if (fundo && !fundo.classList.contains('lt-fundo')) {
    fundo.classList.add('lt-fundo'); fundo.style.overflow = 'hidden';
    const v = document.createElement('div'); v.className = 'lt-veu'; fundo.appendChild(v);
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div'); p.className = 'lt-petal';
      p.style.left = (62 + rnd(i, 1) * 38).toFixed(1) + '%'; p.style.background = i % 2 ? '#e8673a' : '#c94a6a';
      p.style.animationDuration = (9 + rnd(i, 2) * 7).toFixed(1) + 's'; p.style.animationDelay = (-rnd(i, 3) * 16).toFixed(1) + 's';
      fundo.appendChild(p);
    }
  }
  if (marca && !marca.querySelector('.lt-logo')) {
    const lw = W0 * 0.34, lh = lw * 261 / 640 + 40;
    Object.assign(marca.style, { backgroundImage: 'none', overflow: 'visible', width: lw + 'px', height: lh + 'px', left: ((W0 - lw) / 2) + 'px', top: (y0 + vis * 0.035) + 'px' });
    const l = document.createElement('div'); l.className = 'lt-logo';
    l.innerHTML = '<img src="./ui/login/logo.png" alt="PokeVerse" draggable="false"><span></span>';
    const tag = l.querySelector('span'); tag.textContent = t('The Pokémon universe, together').toUpperCase(); tag.style.fontSize = Math.max(9, W0 * 0.0088) + 'px';
    marca.appendChild(l);
  }
  if (painel && !painel.classList.contains('lt-sobe')) {
    const pw = parseFloat(painel.style.width) || painel.clientWidth, ph = parseFloat(painel.style.height) || painel.clientHeight;
    painel.style.left = ((W0 - pw) / 2) + 'px';
    painel.style.top = (y0 + vis - ph - vis * 0.06) + 'px';
    painel.classList.add('lt-sobe');
  }
  const beta = pop.querySelector('[data-fig="placa-beta"]'); if (beta) beta.style.display = 'none';
}

/** Dresses a mounted login / sign-up screen. `t` translates the tagline. */
export function dress(pop, t = (s) => s) {
  if (!pop || typeof document === 'undefined') return;
  if (STYLE === 'twilight') return dressTwilight(pop, t);
  style();
  const fundo = pop.querySelector('[data-fig="img/fundo"]'), marca = pop.querySelector('[data-fig="img/logo"]');
  if (fundo && !fundo.querySelector('.ls-stage')) {
    fundo.style.backgroundImage = 'none'; fundo.style.overflow = 'hidden';
    const s = stage(); fundo.appendChild(s); encaixar(fundo, s, W, H, true);
  }
  if (marca && !marca.querySelector('.ls-logo')) {
    marca.style.backgroundImage = 'none'; marca.style.overflow = 'visible';
    const l = logo(t('The Pokémon universe, together').toUpperCase()); marca.appendChild(l); encaixar(marca, l, 640, 240, false);
  }
  const beta = pop.querySelector('[data-fig="placa-beta"]'); if (beta) beta.style.display = 'none';
  /* Re-fit on resize (the mockup rescales its boxes when the window changes). */
  if (!pop.__lsResize) {
    pop.__lsResize = () => {
      const s = fundo?.querySelector('.ls-stage'); if (s) encaixar(fundo, s, W, H, true);
      const l = marca?.querySelector('.ls-logo'); if (l) encaixar(marca, l, 640, 240, false);
    };
    addEventListener('resize', pop.__lsResize);
    setTimeout(pop.__lsResize, 300);
  }
}
