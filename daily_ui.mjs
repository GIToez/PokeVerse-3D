/* DAILY REWARDS window (Nov 5, v2 popup `trilha`): Day 1–6 tickets (free on top, premium below) and the Day 7 grand prize.
 * Days already collected get the stamp, today's ticket is highlighted, later days are dimmed; the premium row is padlocked
 * without the Premium Daily Pass. The designer's raid-ticket counters are hidden (our raids don't use tickets).
 * The server pays the day on the first login (server_daily.mjs) and sends { t: 'diario', vista, novo }.
 *   instalar({ tr, nomeItem(id), loja() })  ·  abrir(vista) → false when the layout has no window */
import * as Hud from './hud.mjs';
import * as Popup from './popup.mjs';

let ctx = {}, pop = null, ICONES = null;
export function instalar(c) {
  ctx = c || {};
  fetch('./data/menu_data.json').then((r) => (r.ok ? r.json() : null)).then((d) => { ICONES = d?.itens || {}; }).catch(() => { ICONES = {}; });
}
const tr = (s, v) => ctx.tr?.(s, v) ?? s;
const icone = (id) => (ICONES?.[id]?.i ? './ui/itens/' + ICONES[id].i + '.png' : './ui/itens/ic_' + id + '.png');
function def() {
  if (new URLSearchParams(location.search).get('popup') === '0') return null;
  const m = document.body.classList.contains('mobile'), p = m ? (Hud.presetAtual() === 'celular_deitado' ? 'deitado' : null) : 'pc';
  return p ? Hud.layoutAtual?.()?.popups?.[p]?.trilha || null : null;
}
const no = (raiz, nome) => raiz?.querySelector('[data-fig="' + nome + '"]') || null;
const some = (el) => { if (el) el.style.display = 'none'; };
/** A label inside a group: the `rotulo` node (it can share the group's name) gets the text, never the group itself. */
const rotulo = (raiz, grupo, nome, txt) => { const g = no(raiz, grupo); const el = g?.querySelector(':scope > [data-fig="' + nome + '"]') || (g && g.dataset.fig === nome && !g.children.length ? g : null); if (el) el.textContent = txt; };
/** A ticket redrawn from its state reference (children, size), so a day can be stamped, today's or still ahead. */
function reconstruir(el, ref, estado, d) {
  if (el.dataset.estadoDiario === estado) return;
  el.replaceChildren();
  Object.assign(el.style, { width: d.w + 'px', height: d.h + 'px' });
  Popup.filhosDoRef(pop, el, ref, estado);
  Popup.mostrarDoRef(el, estado);
  el.dataset.estadoDiario = estado;
}
/** One prize ({ item: n }) into a ticket: the first item's icon and count. */
function encher(el, premio, prefixo = '') {
  const itens = Object.entries(premio || {});
  const [id, n] = itens[0] || [];
  Popup.imagem(pop, 'item', id ? icone(id) : null, el);
  Popup.textoCru(pop, 'qtd', id ? '×' + n : '', el);
  const nome = itens.map(([k, q]) => tr(ctx.nomeItem?.(k) || 'item ' + k) + ' ×' + q).join(', ');
  el.title = prefixo + nome;
  some(no(el, 'linha-ticket'));
}
export function abrir(v) {
  const d = def();
  if (!d || !v?.dias?.length) return false;
  if (!pop || pop.__def !== d || !pop.isConnected) {
    pop?.remove();
    pop = Popup.montar(d, { acao: (n) => { if (n === 'ver-medalhao') { Popup.fechar(pop); ctx.loja?.(); } }, fechar: () => {} });
    if (!pop) return false;
    pop.__def = d;
  }
  const seq = Math.max(1, Math.min(7, +v.seq || 1)), prem = !!v.premium;
  Popup.textoCru(pop, 'titulo', tr('Daily Rewards'));
  Popup.textoCru(pop, 'regra', tr('Log in every day in a row: each day gives items. Miss a day and the streak goes back to Day 1.'));
  Popup.textoCru(pop, 'sequencia', tr(seq === 1 ? 'Streak: 1 day' : 'Streak: {n} days', { n: seq }));
  Popup.textoCru(pop, 'aviso', seq < 7 ? tr('Come back tomorrow for Day {n}!', { n: seq + 1 }) : tr('Grand prize collected! Tomorrow starts again at Day 1.'));
  Popup.textoCru(pop, 'grande-premio', tr('GRAND PRIZE'));
  rotulo(pop, 'rotulo-gratis', 'rotulo-gratis-txt', tr('FREE'));
  rotulo(pop, 'rotulo-premium', 'rotulo-premium', tr('PREMIUM'));
  rotulo(pop, 'btn-ver-medalhao', 'txt-btn', tr('Get the Premium Pass'));
  rotulo(pop, 'btn-continuar', 'txt-btn', tr('Continue'));
  some(no(pop, 'ticket-raid')); some(no(pop, 'selo-mais-tickets'));
  if (prem) some(no(pop, 'btn-ver-medalhao'));
  /* The mock-up draws the row for a 3-day streak (days 1–2 stamped and small, day 3 big, 4–6 dimmed): each column is rebuilt
     from the ticket's state reference at that state's size, and the columns are laid out again left to right. */
  const estado = (n) => (n < seq ? 'pego' : n === seq ? 'hoje' : 'futuro');
  const TOPO = { pego: 32, hoje: 0, futuro: 25, fora: 25 }, LINHA_PREMIUM = 173, VAO = 8;
  let x = 0;
  for (let n = 1; n <= 6; n++) {
    const g = no(pop, 'dia-' + n); if (!g) continue;
    const dia = v.dias[n - 1] || {}, eg = estado(n), ep = prem ? eg : 'trancado';
    const fg = no(g, 'ingresso-gratis'), fp = no(g, 'ingresso-premium');
    const dg = pop.__refs?.['ingresso-gratis']?.[eg], dp = pop.__refs?.['ingresso-premium']?.[ep];
    const w = dg?.w || 104;
    Object.assign(g.style, { left: x + 'px', top: '0px', width: w + 'px', height: '309px' });
    x += w + VAO;
    if (fg && dg) { reconstruir(fg, 'ingresso-gratis', eg, dg); Object.assign(fg.style, { left: '0px', top: TOPO[eg] + 'px' }); Popup.textoCru(pop, 'dia', tr('Day {n}', { n }), fg); encher(fg, dia.gratis); }
    if (fp && dp) { reconstruir(fp, 'ingresso-premium', ep, dp); const k = Math.min(1, 136 / dp.h); Object.assign(fp.style, { left: Math.round((w - dp.w) / 2) + 'px', top: LINHA_PREMIUM + 'px', transform: k < 1 ? 'scale(' + k.toFixed(3) + ')' : '', transformOrigin: '50% 0' }); /* today's tall premium ticket shrinks to the row's height */ Popup.textoCru(pop, 'dia', tr('Day {n}', { n }), fp); encher(fp, dia.premium, tr('Premium: ')); }
  }
  const g7 = no(pop, 'ingresso-7');
  if (g7) {
    if (seq === 7) Popup.estadoRef(pop, g7, 'ingresso-7', 'hoje');
    Popup.textoCru(pop, 'dia', tr('Day {n}', { n: 7 }), g7);
    const d7 = v.dias[6] || {};
    const sg = no(g7, 'secao-gratis'), sp = no(g7, 'secao-premium');
    if (sg) encher(sg, d7.gratis);
    if (sp) {
      const itens = Object.entries(d7.premium || {}), imgs = sp.querySelectorAll('[data-var="item"]'), qtds = sp.querySelectorAll('[data-txt="qtd"]');
      imgs.forEach((el, i) => { const [id] = itens[i] || []; el.style.backgroundImage = id ? 'url(' + icone(id) + ')' : 'none'; });
      qtds.forEach((el, i) => { const [, q] = itens[i] || []; el.textContent = q ? '×' + q : ''; });
      sp.querySelectorAll('[data-txt="tickets"]').forEach((el) => { el.closest('[data-fig="selo-qtd"]')?.style.setProperty('display', 'none'); });
      sp.title = tr('Premium: ') + itens.map(([k, q]) => tr(ctx.nomeItem?.(k) || 'item ' + k) + ' ×' + q).join(', ');
    }
    if (sg) sg.querySelectorAll('[data-txt="tickets"]').forEach((el) => { el.closest('[data-fig="selo-qtd"]')?.style.setProperty('display', 'none'); });
    g7.querySelectorAll('[data-fig*="ticket"]').forEach(some);   // the designer's raid tickets: our raids don't use them
    const cad = no(g7, 'cadeado'); if (cad) cad.style.display = prem ? 'none' : '';
  }
  Popup.abrir(pop);
  return true;
}
