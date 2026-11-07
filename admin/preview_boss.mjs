/* Prévia do BOSS (esquemas `bosses` e `boss_niveis`): o emblema exatamente como o jogo desenha em cima do boss (boss_ui.mjs), e —
 * para um boss — um controle "Pokémon mais forte do jogador: Lv N" que mostra o time com os níveis que ele teria e o prêmio já
 * multiplicado pela cor (boss_rules.mjs, as mesmas contas do servidor). */
import * as BossR from '/boss_rules.mjs';
import { desenharEmblema } from '/boss_ui.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let raiz = null, ultimo = null, lvJogador = 30, dados = null, especies = null, itens = null;
const carregar = async () => {
  dados = await fetch('/data/bosses.json?t=' + Date.now()).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  especies ||= fetch('/pokedex.json').then(r => r.json()).then(p => new Map((p.species || []).filter(s => !s.base).map(s => [+s.n, s.name]))).catch(() => new Map());
  itens ||= fetch('/data/menu_data.json').then(r => r.json()).then(d => d.itens || {}).catch(() => ({}));
};

export function mostrar(caixa, r) {
  if (!raiz) { raiz = document.createElement('div'); raiz.style.cssText = 'margin-bottom:10px;padding:10px;background:#0f131b;border:1px solid var(--borda);border-radius:8px'; }
  caixa.prepend(raiz);
  carregar().then(() => atualizar(r));
}

export async function atualizar(r) {
  if (!raiz) return;
  ultimo = r;
  if (!dados) await carregar();
  if (!raiz.querySelector('.b-sl')) {
    raiz.innerHTML = `<div class="fraco" style="font-size:12px;margin-bottom:6px">In-game badge (above the boss):</div><div class="b-cv"></div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px">Player's strongest Pokémon: <b>Lv <span class="b-lv"></span></b>
        <input type="range" class="b-sl" min="1" max="100" style="flex:1"></label>
      <div class="b-info" style="margin-top:6px;font-size:13px"></div>`;
    const sl = raiz.querySelector('.b-sl');
    sl.value = lvJogador;
    sl.oninput = e => { lvJogador = +e.target.value; pintar(); };
  }
  await pintar();
}

async function pintar() {
  const r = ultimo;
  const ehNivel = r && r.bonus !== undefined && r.time === undefined;   // a record of Boss tiers
  const tiers = BossR.niveis(dados);
  const tier = ehNivel ? { ...BossR.NIVEIS_PADRAO.cinza, ...r } : (tiers[r?.nivel] || tiers.cinza);
  const nomes = await especies, cat = await itens;
  const boss = ehNivel ? { nome: 'Example boss', nivel: '_', time: [{ dex: 25 }] } : (r || {});
  const dadosPrev = { ...dados, niveis: { ...(dados?.niveis || {}), [boss.nivel || 'cinza']: tier } };
  let time = [];
  try { time = BossR.montarTime(dadosPrev, boss, lvJogador); } catch {}
  const lv = time.length ? Math.max(...time.map(m => m.lv)) : null;
  const cv = desenharEmblema({ nome: boss.nome || '(unnamed)', nivel: tier, lv, shiny: boss.tipo === 'pokemon' && !!time[0]?.shiny });
  cv.style.cssText = 'width:320px;max-width:100%;height:auto;display:block;background:repeating-conic-gradient(#1a2030 0 25%,#222a3c 0 50%) 0 0/16px 16px;border-radius:6px';
  const R = BossR.recompensa(dadosPrev, boss), cap = BossR.captura(boss);
  const nomeItem = id => cat?.[id]?.n || ('item ' + id);
  raiz.querySelector('.b-cv').replaceChildren(cv);
  raiz.querySelector('.b-lv').textContent = lvJogador;
  raiz.querySelector('.b-info').innerHTML = ehNivel
    ? `Bosses of this color fight at <b>Lv ${Math.min(100, lvJogador + (+tier.bonus || 0))}</b> (+${esc(tier.bonus)}). Money ×${esc(tier.multDinheiro ?? 1)}, items ×${esc(tier.multItens ?? 1)}, IVs ${esc(tier.ivs ?? 15)}.`
    : `<b>Team:</b> ${time.map(m => esc((m.shiny ? '✨' : '') + (nomes.get(m.dex) || '#' + m.dex)) + ' Lv ' + m.lv).join(', ') || '—'}
      <br><b>Prize:</b> ${R.dinheiro} Coins${R.itens.length ? ' · ' + R.itens.map(i => esc(i.qtd + '× ' + nomeItem(i.item)) + (i.chance < 1 ? ' (' + Math.round(i.chance * 100) + '%)' : '')).join(', ') : ''}
      ${cap ? `<br><b>Catch:</b> ${cap.modo === 'garantida' ? 'guaranteed' : 'ball bonus ×' + cap.bonus + ', ' + cap.tentativas + ' throw(s)'} in ${cap.janelaS} s${cap.umaVez ? ', once per account' : ''} — becomes an ordinary ${boss.shiny || time[0]?.shiny ? 'shiny ' : ''}Pokémon.` : ''}`;
}
