/* Garden and berry catalog (data/ev.json). The battle EV module stays in ev.mjs. */
export const ERRO = {
  OUTRA_CASA: "another player's house",
  MOCHILA_CHEIA: 'bag full',
  FORA_DO_TERRENO: 'outside the plot',
};
let D = null;
export async function carregar(url = './data/ev.json', buscar = fetch){
  if (D) return D;
  const r = await buscar(url);
  D = r.ok ? await r.json() : {};
  return D;
}
export const dados = () => D;
export function itemDe(id){
  return D?.itens?.[String(id)] || null;
}
