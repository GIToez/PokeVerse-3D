/* Diálogos fixos do jogo (Fase 3 do painel → Arquivos de dados → Diálogos do jogo): saíram do index.html pro data/dialogos.json.
 * PADRAO = o texto que estava no código — vale pra chave que faltar no arquivo, ou sem o arquivo. {nome} = o nome do Pokémon.
 * Quem fala passa o texto pelo i18n depois (mostrarFala/legenda), então a tradução continua casando pelo português.
 * O painel avisa a aba do jogo ao salvar (dados-mudaram) e o index chama recarregar(): vale na próxima fala, sem F5. */
export const PADRAO = {
  oakNome: 'Professor Samuel',
  portao: ['Wait! Without a Pokémon, the tall grass on Route 1 is dangerous.', 'Talk to Professor Oak in the lab before leaving Pallet.'],
  portaoBalao: 'Talk to Professor Oak before you leave!',
  portaoChat: 'Professor\'s assistant: talk to Professor Oak before leaving Pallet.',
  oakJaEscolheu: ['You already chose {nome}. Take good care of it!'],
  oakEntrega: ['{nome} is yours! Take good care of it.', 'There are wild Pokémon on Route 1: knock one out and throw a ball (F) to catch it.'],
  escolhaTitulo: 'Choose the Pokémon you want.',
  escolhaSub: 'The Start of the Journey · your pick becomes your partner (Lv 5) and joins your team',
  jaVenceu: 'You already beat me!',
  introLiga: 'Indigo League — the championship final',
  introRed: 'Red: — It\'s not over yet.',
  introMega: 'Mega Charizard X!',
};
let D = { ...PADRAO };
function aplicar(j) {
  D = { ...PADRAO };
  if (!j || typeof j !== 'object' || Array.isArray(j)) return;
  for (const [k, p] of Object.entries(PADRAO)) {                          // só o formato certo entra (lista onde era lista, texto onde era texto)
    const v = j[k];
    if (Array.isArray(p) ? Array.isArray(v) && v.length && v.every(s => typeof s === 'string') : typeof v === 'string' && v.trim()) D[k] = v;
  }
}
const baixar = (bust = '') => fetch('./data/dialogos.json' + bust, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(aplicar).catch(() => {});
await baixar();
/** O painel salvou: relê (a próxima fala já sai nova). */
export const recarregar = () => baixar('?t=' + Date.now());

const preencher = (s, v) => String(s).replace(/\{(\w+)\}/g, (tudo, k) => (k in v ? String(v[k]) : tudo));
/** Lista de falas (pro mostrarFala). */
export const falas = (k, v = {}) => (Array.isArray(D[k]) ? D[k] : [D[k] ?? '']).map(s => preencher(s, v));
/** Um texto só (listas viram uma frase). */
export const texto = (k, v = {}) => preencher(Array.isArray(D[k]) ? D[k].join(' ') : D[k] ?? '', v);
/** O texto escapado pra entrar num innerHTML. */
export const textoHtml = (k, v = {}) => texto(k, v).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
