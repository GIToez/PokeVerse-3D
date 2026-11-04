/* Player trading floor. Mounts the v2 mercado window. Listings need the server, so the
 * sheet opens in English with the sample rows hidden. The city Pokémart stays on the
 * menu key `mercado`; this window is `feira`. */
import * as Popup from './popup.mjs';
import * as Mercado from './market.mjs';

const NOTA = 'Player trading needs the server. There are no listings yet.';
let dep = { defPopup: () => null, aviso: () => {}, fecharMenu: () => {}, aoFecharJanela: () => {} };
let pop = null, defUsado = null;

export function instalar(d){ dep = { ...dep, ...(d || {}) }; }
export const aberto = () => !!(pop && Popup.aberto(pop));
export function fechar(){ if (pop && Popup.aberto(pop)) Popup.fechar(pop); }

function notaEm(raiz){
  const n = raiz?.querySelector(':scope > [data-fig="nota-taxa"], :scope > [data-fig="nota"]');
  if (n) n.textContent = NOTA;
}
function esconder(raiz, sel){
  raiz?.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
}
function pintar(){
  if (!pop) return;
  Popup.texto(pop, 'titulo', 'Market');
  for (const a of pop.querySelectorAll(':scope > [data-fig^="aba-"]')) Popup.rotulo(pop, 'aba', a);
  const buy = pop.querySelector(':scope > [data-fig="conteudo-comprar"]');
  esconder(buy, ':scope > [data-fig="lista-ofertas"] > [data-fig^="oferta-"]');
  notaEm(buy);
  const saldo = buy?.querySelector('[data-txt="saldo"]');
  if (saldo) saldo.textContent = '—';
  for (const nome of ['conteudo-vender', 'conteudo-minhas-ofertas', 'conteudo-precos']){
    const ex = Popup.extra(pop, nome);
    if (!ex) continue;
    esconder(ex, '[data-fig^="item-"], [data-fig^="minha-oferta-"], [data-fig^="venda-"]');
    const nomeItem = ex.querySelector('[data-txt="item-nome"]');
    if (nomeItem) nomeItem.textContent = '';
    const slots = ex.querySelector('[data-txt="slots-venda"]');
    if (slots) slots.textContent = 'listings: 0 of 20';
    const medio = ex.querySelector('[data-txt="preco-medio"]');
    if (medio) medio.textContent = '';
    notaEm(ex);
  }
  const cat = Mercado.catalogo();
  if (cat?.regras?.taxa != null){
    const n = buy?.querySelector(':scope > [data-fig="nota-taxa"]');
    if (n) n.textContent = NOTA + ' Fee ' + Math.round(cat.regras.taxa * 100) + '%.';
  }
}
export async function abrir(){
  const def = dep.defPopup('mercado');
  if (!def?.v2) return false;
  try { dep.fecharMenu?.(); } catch {}
  if (!pop || defUsado !== def){
    pop?.remove();
    defUsado = def;
    pop = Popup.montar(def, {
      acao: () => dep.aviso?.(NOTA),
      aba: () => pintar(),
      fechar: () => { try { dep.aoFecharJanela?.(); } catch {} },
    });
  }
  Popup.abrir(pop);
  pintar();
  Mercado.carregar().then(() => { if (aberto()) pintar(); }).catch(() => {});
  return true;
}
