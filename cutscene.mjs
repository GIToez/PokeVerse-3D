/* CUTSCENE RUNNER (Nov 5): plays a script of steps from a JSON file (public/data/cutscenes/<id>.json), so story scenes are data,
 * not code. index.html hands in its helpers (models, dialogue box, camera, sound) through `ctx`.
 *   await Cutscene.rodar(roteiro, ctx)        // resolves when the script ends or the player skips
 *
 * Positions are metres from the stage centre (where the player stood when the scene started); +z is towards the camera when
 * the camera's `giro` is 0. Steps (`op`):
 *   palco    { fundo: '#000' }                hide the map (a void stage with a soft spotlight), keep the lights
 *   restaurar {}                              bring the map back
 *   ator     { id, npc | mon | jogador, x, z, olhar, oculto }   load a model (npc: scenery/npc/<npc>.glb, mon: scenery/mon/<mon>.glb,
 *                                            jogador: the player's own character); olhar = 'camera' or another actor's id
 *   aparecer { id, bola }  ·  sumir { id, bola }   pop in / out (bola: the Poké Ball flash)
 *   encolher { id, seg }                     shrink away (the "your legend is about to unfold" exit)
 *   camera   { foco: id | [ids] | {x, z}, zoom, giro, sobe, seg }   move the camera there over `seg` s
 *   fala     { quem, linhas: [...] }          the game's dialogue box (Z / tap); {nome} = the player's name
 *   anim     { id, clipe, uma }               play a clip (uma: once, then back to Idle)
 *   olhar    { id, para }                     turn an actor to face 'camera' or another actor
 *   escuro   { seg, ate }                     fade to black (ate 1) or back (ate 0)
 *   flash    { seg, cor }                     a quick full-screen flash
 *   esperar  { seg } · som { nome, volume } · musica { nome }
 */
let parar = false;

export async function rodar(roteiro, ctx) {
  const { THREE, cena, jogo } = ctx;
  const passos = Array.isArray(roteiro?.passos) ? roteiro.passos : [];
  parar = false;
  const ash = jogo.ash, c0 = { x: ash.x, y: ash.y, z: ash.z };
  const atores = new Map();
  const escondidos = [];
  let disco = null, fundoAntes = null, nevoaAntes = null;

  /* the screen: only the canvas and the dialogue box stay */
  const css = document.createElement('style');
  css.textContent = '#cs-veu{position:fixed;inset:0;background:#000;opacity:1;pointer-events:none;z-index:39;transition:opacity .6s}'
    + '#cs-flash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:42;transition:opacity .25s}'
    + '#cs-pular{position:fixed;right:18px;top:14px;z-index:43;background:#0009;color:#fff;border:1px solid #fff6;border-radius:8px;padding:6px 12px;font:600 13px system-ui,sans-serif;cursor:pointer}'
    + '#fala{z-index:41}';
  document.head.appendChild(css);
  const veu = Object.assign(document.createElement('div'), { id: 'cs-veu' });
  const flashEl = Object.assign(document.createElement('div'), { id: 'cs-flash' });
  const pular = Object.assign(document.createElement('button'), { id: 'cs-pular', textContent: ctx.t('Skip ▸') });
  const manter = new Set([ctx.tela, document.getElementById('fala'), document.getElementById('boot'), veu, flashEl, pular]);
  const esconderTela = () => {                                            // runs again while the scene plays: the HUD can still be building, and the team panel re-shows itself
    for (const el of [...document.body.children]) {
      if (manter.has(el) || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.contains(ctx.tela)) continue;
      if (!el.dataset.csEscondido) { el.dataset.csEscondido = '1'; escondidos.push([el, el.style.display]); }
      if (el.style.display !== 'none') el.style.display = 'none';
    }
  };
  esconderTela();
  document.body.append(veu, flashEl, pular);
  let pulou = null; const pulo = new Promise(r => { pulou = r; });
  const pularAgora = () => { parar = true; pulou(); ctx.pularFala?.(); };
  pular.onclick = pularAgora;
  const tecla = e => { if (e.code === 'Escape') pularAgora(); };
  addEventListener('keydown', tecla);

  ctx.travar(true);                                                       // no walking, no music changes, no camera follow
  ash.pivo.visible = false; if (jogo.pika) jogo.pika.pivo.visible = false;   // only hidden (the watch keeps it so): marking it 'recalled' made the game send out the next team member
  const nomeTag = ash.rotuloNome; if (nomeTag) nomeTag.visible = false;   // the player's floating name stays off in the scene
  let emPalco = false;
  /* WATCH: while the void stage is up, anything the game adds or shows on its own (the partner coming out of its ball, the mission
     arrow, NPCs) stays hidden, and so does the HUD */
  const vigia = setInterval(() => {
    esconderTela();
    if (jogo.pika) jogo.pika.pivo.visible = false;
    if (ash.rotuloNome) ash.rotuloNome.visible = false;
    if (!emPalco) return;
    for (const o of cena.children) { if (o.isLight || o === ash.pivo || o.userData?.cutscene) continue; if (o.visible) { o.userData.__csVisivel = true; o.visible = false; } }
  }, 100);
  const foco = { vx: c0.x, vy: c0.y + 0.5, vz: c0.z }; jogo.foco = foco;
  jogo.cinem = [];

  const pos = p => ({ x: c0.x + (+p?.x || 0), z: c0.z + (+p?.z || 0) });
  const camGiro = () => ctx.cam.giro;
  const virarPara = (e, para) => {
    if (para === 'camera') { e.giro = camGiro(); return; }
    const o = atores.get(para); if (o) e.giro = Math.atan2(o.x - e.x, o.z - e.z);
  };
  const texto = s => ctx.t(String(s ?? '')).replace(/\{nome\}/g, ctx.nomeJogador());
  const esperar = seg => Promise.race([ctx.esperarSeg(Math.max(0, +seg || 0)), pulo]);
  const tween = async (seg, fn) => {
    const n = Math.max(1, Math.round((+seg || 0) / 0.03));
    for (let i = 1; i <= n && !parar; i++) { fn(i / n); await ctx.esperarSeg(0.03); }
    if (parar) fn(1);
  };
  const suave = k => k * k * (3 - 2 * k);
  const escala = (e, s) => { e.pivo.scale.setScalar(e.escala0 * Math.max(0.001, s)); };
  const flash = async (seg = 0.25, cor = '#fff') => {
    flashEl.style.background = cor; flashEl.style.transitionDuration = (seg / 2) + 's'; flashEl.style.opacity = '1';
    await esperar(seg / 2); flashEl.style.opacity = '0'; await esperar(seg / 2);
  };
  const centroDe = f => {
    if (Array.isArray(f)) { const l = f.map(i => atores.get(i)).filter(Boolean); if (!l.length) return null; return { x: l.reduce((s, e) => s + e.x, 0) / l.length, z: l.reduce((s, e) => s + e.z, 0) / l.length, y: Math.max(...l.map(e => e.y)) }; }
    if (typeof f === 'string') { const e = atores.get(f); return e ? { x: e.x, z: e.z, y: e.y } : null; }
    if (f && typeof f === 'object') { const p = pos(f); return { ...p, y: c0.y }; }
    return null;
  };

  const passo = {
    async palco(p) {
      fundoAntes = cena.background; nevoaAntes = cena.fog ? cena.fog.color.clone() : null;
      const cor = new THREE.Color(p.fundo || '#000');
      for (const o of cena.children) { if (o.isLight || o === ash.pivo || o.userData?.cutscene) continue; if (o.visible) { o.userData.__csVisivel = true; o.visible = false; } }
      cena.background = cor; if (cena.fog) cena.fog.color.copy(cor); emPalco = true;
      /* a soft pool of light on an invisible floor, so the actors don't float in the void */
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.55, 'rgba(200,210,255,.18)'); gr.addColorStop(1, 'rgba(200,210,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      disco = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, fog: false }));
      disco.rotation.x = -Math.PI / 2; disco.position.set(c0.x, c0.y + 0.02, c0.z); disco.userData.cutscene = true; cena.add(disco);
    },
    async restaurar() {
      emPalco = false;
      for (const o of cena.children) if (o.userData?.__csVisivel) { o.visible = true; delete o.userData.__csVisivel; }
      if (fundoAntes !== null) cena.background = fundoAntes; if (nevoaAntes && cena.fog) cena.fog.color.copy(nevoaAntes);
      if (disco) { cena.remove(disco); disco = null; }
    },
    async ator(p) {
      let e;
      if (p.jogador) { e = ash; e.pivo.visible = !p.oculto; e.escala0 = e.escala0 || e.pivo.scale.x; }
      else {
        const arq = p.npc ? './scenery/npc/' + p.npc + '.glb' : './scenery/mon/' + p.mon + '.glb';
        e = await ctx.montarPersonagem(arq, null, 0);
        if (p.mon) ctx.configurarSeguidor(e, p.mon);
        e.npc = true; e.chefe = true; e.maxHp = e.hp = 99999;
        e.pivo.userData.cutscene = true; cena.add(e.pivo);
        e.escala0 = e.pivo.scale.x;
        e.pivo.visible = !p.oculto;
        jogo.cinem.push(e);
      }
      const q = pos(p); e.x = e.vx = q.x; e.z = e.vz = q.z; e.y = e.vy = ctx.chao(q.x, q.z) ?? c0.y;
      virarPara(e, p.olhar || 'camera');
      e.pivo.position.set(e.x, e.y, e.z); e.pivo.rotation.y = e.giro;
      if (p.jogador) { e.pivo.rotation.y = e.giro; ash.travaCena = true; }
      ctx.tocarAnim(e, 'Idle');
      atores.set(p.id, e);
    },
    async aparecer(p) {
      const e = atores.get(p.id); if (!e) return;
      if (p.bola) { ctx.Som.tocar('skill/Wind1', { volume: 0.5 }); await flash(0.3, '#ffffff'); }
      escala(e, 0.01); e.pivo.visible = true;
      if (e.acoes?.has('Appear')) ctx.tocarUma(e, 'Appear');
      await tween(p.seg ?? 0.35, k => escala(e, suave(k)));
    },
    async sumir(p) {
      const e = atores.get(p.id); if (!e) return;
      if (p.bola) ctx.Som.tocar('skill/Wind1', { volume: 0.4 });
      await tween(p.seg ?? 0.3, k => escala(e, 1 - suave(k)));
      e.pivo.visible = false; escala(e, 1);
      if (p.bola) await flash(0.2, '#ff5a5a');
    },
    async encolher(p) {
      const e = atores.get(p.id); if (!e) return;
      ctx.Som.tocar('ui/sound_successful', { volume: 0.5 });
      await tween(p.seg ?? 1.2, k => escala(e, 1 - 0.9 * suave(k)));
      await flash(0.5, '#ffffff');
      e.pivo.visible = false; escala(e, 1);
    },
    async camera(p) {
      const alvo = centroDe(p.foco) || { x: foco.vx, z: foco.vz, y: c0.y };
      const de = { x: foco.vx, y: foco.vy, z: foco.vz, zoom: ctx.cam.zoom, giro: ctx.cam.giro };
      const para = { x: alvo.x, y: alvo.y + (+p.sobe || 0.6), z: alvo.z, zoom: p.zoom ?? de.zoom, giro: p.giro ?? de.giro };
      await tween(p.seg ?? 0, k => {
        const s = suave(k);
        foco.vx = de.x + (para.x - de.x) * s; foco.vy = de.y + (para.y - de.y) * s; foco.vz = de.z + (para.z - de.z) * s;
        ctx.cam.zoom = de.zoom + (para.zoom - de.zoom) * s; ctx.cam.giro = de.giro + (para.giro - de.giro) * s;
      });
    },
    async fala(p) {
      const linhas = (p.linhas || []).map(texto);
      await Promise.race([ctx.mostrarFala(ctx.t(p.quem || ''), linhas, null), pulo]);
    },
    async anim(p) { const e = atores.get(p.id); if (!e) return; if (p.uma) ctx.tocarUma(e, p.clipe); else ctx.tocarAnim(e, p.clipe); },
    async olhar(p) { const e = atores.get(p.id); if (e) virarPara(e, p.para || 'camera'); },
    async escuro(p) { veu.style.transitionDuration = (p.seg ?? 0.6) + 's'; veu.style.opacity = String(p.ate ?? 1); await esperar(p.seg ?? 0.6); },
    async flash(p) { await flash(p.seg, p.cor); },
    async esperar(p) { await esperar(p.seg); },
    async som(p) { ctx.Som.tocar(p.nome, { volume: p.volume ?? 0.6 }); },
    async musica(p) { ctx.Som.musica(p.nome); },
  };

  try {
    for (const p of passos) {
      if (parar) break;
      const f = passo[p?.op];
      if (!f) { console.warn('cutscene: unknown step', p); continue; }
      await f(p);
    }
  } finally {
    /* always leave the game playable, even after Skip or an error */
    try { await passo.restaurar(); } catch {}
    for (const e of jogo.cinem || []) { try { cena.remove(e.pivo); } catch {} }
    jogo.cinem = null; jogo.foco = null;
    ash.pivo.visible = true; ash.pivo.scale.setScalar(ash.escala0 || ash.pivo.scale.x); ash.travaCena = false;
    ash.x = ash.vx = c0.x; ash.z = ash.vz = c0.z; ash.y = ash.vy = c0.y;
    clearInterval(vigia);
    if (jogo.pika && !jogo.pika.recolhido) jogo.pika.pivo.visible = true;
    if (ash.rotuloNome) ash.rotuloNome.visible = true;
    for (const [el, d] of escondidos) { el.style.display = d; delete el.dataset.csEscondido; }
    veu.style.transitionDuration = '0.8s'; veu.style.opacity = '0';
    setTimeout(() => { veu.remove(); flashEl.remove(); css.remove(); }, 900);
    pular.remove(); removeEventListener('keydown', tecla);
    ctx.travar(false);
  }
}
