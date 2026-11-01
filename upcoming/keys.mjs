export const VERSAO = 1;
export const CHAVE_TECLAS = 'controles.teclas',
  CHAVE_MOUSE = 'controles.mouse';
export const GRUPOS = [
  { id: 'andar', nome: 'Movement', cor: '#43D17C' },
  { id: 'camera', nome: 'Camera', cor: '#9DBBFF' },
  { id: 'combate', nome: 'Combat', cor: '#FF7A2E' },
  { id: 'atalhos', nome: 'Shortcuts', cor: '#FF7ACB' },
  { id: 'janelas', nome: 'Windows', cor: '#9A6BFF' },
  { id: 'conversa', nome: 'Talk', cor: '#FCF2DA' },
];
export const COR = Object.fromEntries(GRUPOS.map((g) => [g.id, g.cor]));
export function corClara(a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(a || ''));
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16),
    b = (c) =>
      Math.round(c * 0.45 + 255 * 0.55)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
  return '#' + b(n >> 16) + b((n >> 8) & 255) + b(n & 255);
}
const A = (b, c, d, e, p = null, a = null, f = {}) => ({ grupo: b, id: c, nome: d, detalhe: e, p, a, ...f });
const vezes = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));
export const ACOES = [
  A('andar', 'andar-frente', 'Move forward', 'relative to the camera', 'KeyW', 'ArrowUp', {
    segura: true,
    icone: { glifo: 'andar-frente' },
    semTecla: 'no key: click the ground only',
  }),
  A('andar', 'andar-tras', 'Move back', 'relative to the camera', 'KeyS', 'ArrowDown', {
    segura: true,
    icone: { glifo: 'andar-tras' },
    semTecla: 'no key: click the ground only',
  }),
  A('andar', 'andar-esquerda', 'Move left', 'relative to the camera', 'KeyA', 'ArrowLeft', {
    segura: true,
    icone: { glifo: 'andar-esquerda' },
    semTecla: 'no key: click the ground only',
  }),
  A('andar', 'andar-direita', 'Move right', 'relative to the camera', 'KeyD', 'ArrowRight', {
    segura: true,
    icone: { glifo: 'andar-direita' },
    semTecla: 'no key: click the ground only',
  }),
  A('andar', 'montar', 'Mount and dismount', 'the mount in use or the 1st shortcut', 'KeyM', null, {
    icone: { arte: './ui/icones/montaria.png' },
    semTecla: 'no key: mount shortcut only',
  }),
  A('camera', 'camera-esquerda', 'Rotate left', 'hold to rotate', 'KeyQ', null, {
    segura: true,
    icone: { glifo: 'camera-esquerda' },
    semTecla: "no key: the camera won't rotate",
  }),
  A('camera', 'camera-direita', 'Rotate right', 'hold to rotate', 'KeyE', null, {
    segura: true,
    icone: { glifo: 'camera-direita' },
    semTecla: "no key: the camera won't rotate",
  }),
  A('camera', 'zoom-mais', 'Zoom in', 'also on the mouse wheel', 'Equal', 'NumpadAdd', {
    repete: true,
    icone: { glifo: 'zoom-mais' },
    semTecla: 'no key: mouse wheel only',
  }),
  A('camera', 'zoom-menos', 'Zoom out', 'also on the mouse wheel', 'Minus', 'NumpadSubtract', {
    repete: true,
    icone: { glifo: 'zoom-menos' },
    semTecla: 'no key: mouse wheel only',
  }),
  ...vezes(4, (n) =>
    A('combate', 'golpe-' + n, 'Move ' + n, 'on-field Pokémon move', 'Digit' + n, null, {
      icone: { jogo: 'golpe' },
      semTecla: 'no key: click the move only',
    }),
  ),
  A('combate', 'pokebola', 'Throw Poké Ball', 'current ball and count', 'KeyF', null, {
    icone: { jogo: 'bola' },
    semTecla: 'no key: click the ball only',
  }),
  A('combate', 'trocar-bola', 'Switch ball type', 'cycles through the balls you have', 'Shift+KeyF', null, {
    icone: { glifo: 'trocar-bola' },
    semTecla: 'no key: only via the ball ⇄',
  }),
  A('combate', 'proximo-alvo', 'Next target', 'targets the next wild Pokémon', 'Tab', null, {
    icone: { glifo: 'proximo-alvo' },
    semTecla: 'no key: click the wild Pokémon only',
  }),
  A('combate', 'trocar-pokemon', 'Switch Pokémon', 'the next healthy team member', 'Shift+KeyZ', null, {
    icone: { glifo: 'trocar-pokemon' },
    semTecla: 'no key: click the team only',
  }),
  A('combate', 'transformar', 'Transform', "the on-field Ditto's list", 'KeyT', null, {
    exato: true,
    icone: { arte: './ui/mon/pm0132.png' },
    semTecla: 'no key: Ditto has no list',
  }),
  ...vezes(6, (n) =>
    A('combate', 'time-' + n, 'Send out team slot ' + n, 'empty slot', null, null, {
      icone: { jogo: 'time' },
    }),
  ),
  A('combate', 'ordem-subir', 'Team up', 'with the team card focused', 'Alt+ArrowUp', null, {
    fixa: 'pa',
    contexto: 'time',
    icone: { glifo: 'ordem-subir' },
  }),
  A('combate', 'ordem-descer', 'Team down', 'with the team card focused', 'Alt+ArrowDown', null, {
    fixa: 'pa',
    contexto: 'time',
    icone: { glifo: 'ordem-descer' },
  }),
  ...vezes(5, (n) =>
    A('atalhos', 'atalho-' + n, 'Shortcut ' + n, 'empty: opens the picker', 'Digit' + (n + 4), null, {
      icone: { jogo: 'atalho' },
      semTecla: 'no key: click the shortcut only',
    }),
  ),
  A('janelas', 'janela-pokemon', 'Pokémon', 'party and box', 'KeyP', null, {
    janela: 'pokemon',
    icone: { dock: 'pokemon' },
    semTecla: 'no key: menu only',
  }),
  A('janelas', 'janela-mochila', 'Bag', 'items and balls', 'KeyI', null, {
    janela: 'mochila',
    icone: { dock: 'mochila' },
    semTecla: 'no key: menu only',
  }),
  A('janelas', 'janela-missoes', 'Missions', 'the journey through Kanto', 'KeyJ', null, {
    janela: 'missoes',
    icone: { dock: 'missoes' },
    semTecla: 'no key: menu only',
  }),
  A('janelas', 'janela-mapa', 'Mapa', 'Kanto', 'KeyK', null, {
    janela: 'mapa',
    icone: { dock: 'mapa' },
    semTecla: 'no key: menu only',
  }),
  A('janelas', 'janela-pokedex', 'Pokédex', 'seen and caught', 'KeyX', null, {
    janela: 'pokedex',
    icone: { dock: 'pokedex' },
    semTecla: 'no key: menu only',
  }),
  A('janelas', 'janela-treinador', 'Trainer', 'badges, money', 'KeyU', null, {
    janela: 'treinador',
    icone: { dock: 'treinador' },
    semTecla: 'no key: menu only',
  }),
  A('janelas', 'janela-config', 'Settings', 'sound, graphics, HUD', 'KeyO', null, {
    janela: 'config',
    icone: { dock: 'config' },
    semTecla: 'no key: menu only',
  }),
  A('janelas', 'menu-grade', 'Menu', 'the grid with every window', null, null, { icone: { glifo: 'menu-grade' } }),
  A('janelas', 'fechar', 'Close and go back', 'closes, drops the target or opens the Menu', 'Escape', null, {
    fixa: 'p',
    icone: { glifo: 'fechar' },
  }),
  A('janelas', 'janela-mercado', 'Market', 'buying and selling between trainers', null, null, {
    recurso: 'mercado',
    icone: { dock: 'mercado' },
  }),
  A('janelas', 'janela-social', 'Social', 'chat, friends, mail', null, null, {
    recurso: 'social',
    icone: { dock: 'social' },
  }),
  A('janelas', 'janela-guilda', 'Guild', 'your guild', null, null, { recurso: 'guilda', icone: { dock: 'guilda' } }),
  A('janelas', 'janela-eventos', 'Events', 'the server schedule', null, null, {
    recurso: 'eventos',
    icone: { dock: 'calendario' },
  }),
  A('janelas', 'janela-loja', 'Shop', 'coming soon', null, null, { recurso: 'loja', icone: { dock: 'loja' } }),
  A('janelas', 'janela-correio', 'Mail', 'account mail and rewards', null, null, {
    recurso: 'correio',
    icone: { dock: 'correio' },
  }),
  A('janelas', 'janela-batalha', 'Battle', 'PvP, ranking', null, null, {
    recurso: 'batalha',
    icone: { dock: 'batalha' },
  }),
  A('janelas', 'janela-raid', 'Live Raid', 'only opens during a raid', null, null, {
    recurso: 'raid',
    icone: { dock: 'batalha' },
  }),
  A('janelas', 'janela-fliperama', 'Arcade', 'the minigames (coming soon)', null, null, {
    recurso: 'fliperama',
    icone: { dock: 'fliperama' },
  }),
  A('conversa', 'interagir', 'Talk and interact', 'advances dialogue; with no NPC, pets', 'KeyZ', null, {
    icone: { glifo: 'interagir' },
    semTecla: 'no key: click the NPC only',
  }),
  A('conversa', 'chat', 'Open chat', 'puts the cursor in the chat box', 'Enter', null, {
    icone: { glifo: 'chat' },
    semTecla: 'no key: click the chat only',
  }),
  A('conversa', 'chat-enviar', 'Send in chat', 'inside chat', 'Enter', null, {
    fixa: 'pa',
    contexto: 'chat',
    icone: { glifo: 'chat-enviar' },
  }),
  A('conversa', 'chat-sair', 'Leave chat', 'inside chat', 'Escape', null, {
    fixa: 'pa',
    contexto: 'chat',
    icone: { glifo: 'chat-sair' },
  }),
];
const POR_ID = new Map(ACOES.map((a) => [a.id, a]));
export const acao = (a) => POR_ID.get(a) || null;
export const doGrupo = (g) => ACOES.filter((a) => a.grupo === g);
const contextoDe = (a) => a.contexto || 'jogo';
export function fixa(b, c) {
  const a = acao(b);
  return !!a?.fixa && (a.fixa === 'pa' || a.fixa === c);
}
export const temAlternativa = (a) => acao(a)?.fixa !== 'pa';
const MODS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const CODIGOS_MOD = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'Fn',
  'FnLock',
]);
export const MOUSE = { 1: 'MouseMeio', 3: 'Mouse4', 4: 'Mouse5' };
const ehMouse = (c) => /^Mouse(Meio|4|5)$/.test(c);
export function partes(a) {
  const s = String(a || ''),
    b = s.split('+'),
    c = b.pop() || '';
  return { mods: MODS.filter((m) => b.includes(m)), code: c };
}
const montar = (a, b) => [...MODS.filter((m) => a.includes(m)), b].join('+');
export function valido(a) {
  if (typeof a !== 'string' || a.length > 40) return false;
  const b = a.split('+'),
    c = b.pop();
  if (!c || !/^[A-Za-z][A-Za-z0-9]*$/.test(c) || CODIGOS_MOD.has(c)) return false;
  if (ehMouse(c)) return b.length === 0;
  return b.every((m) => MODS.includes(m)) && new Set(b).size === b.length;
}
export function comboDe(a) {
  const b = String(a?.code || '');
  if (!b) return '';
  if (CODIGOS_MOD.has(b) || ehMouse(b)) return b;
  const c = [];
  if (a.ctrlKey) c.push('Ctrl');
  if (a.altKey) c.push('Alt');
  if (a.shiftKey) c.push('Shift');
  if (a.metaKey) c.push('Meta');
  return montar(c, b);
}
export const comboDoMouse = (a) => MOUSE[a?.button] || null;
const ABNT2 = {
  Minus: '-',
  Equal: '+',
  BracketLeft: '´',
  BracketRight: '[',
  Backslash: ']',
  Semicolon: 'Ç',
  Quote: '~',
  Comma: ',',
  Period: '.',
  Slash: ';',
  Backquote: "'",
  IntlBackslash: '\\',
  IntlRo: '/',
};
const SETAS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const NOMES = {
  Escape: ['Esc', 'Esc', 'Esc'],
  Enter: ['Enter', 'Ent', 'Enter'],
  Tab: ['Tab', 'Tab', 'Tab'],
  Space: ['Space', 'Spc', 'Space'],
  Backspace: ['Delete', 'Del', 'Delete'],
  CapsLock: ['Caps', 'Cps', 'Caps'],
  ShiftLeft: ['Shift', '⇧', 'Shift'],
  ShiftRight: ['Shift', '⇧', 'Shift'],
  ControlLeft: ['Ctrl', 'Ctl', 'Ctrl'],
  ControlRight: ['Ctrl', 'Ctl', 'Ctrl'],
  AltLeft: ['Alt', 'Alt', 'Alt'],
  AltRight: ['Alt Gr', 'AGr', 'Alt Gr'],
  Insert: ['Insert', 'Ins', 'Ins'],
  Delete: ['Delete', 'Del', 'Del'],
  Home: ['Home', 'Hom', 'Home'],
  End: ['End', 'End', 'End'],
  PageUp: ['PgUp', 'PgU', 'PgUp'],
  PageDown: ['PgDn', 'PgD', 'PgDn'],
  ContextMenu: ['Menu', 'Mnu', 'Menu'],
  NumpadEnter: ['Num Enter', 'NEn', 'N Ent'],
  NumpadAdd: ['Num +', 'N+', 'N+'],
  NumpadSubtract: ['Num -', 'N-', 'N-'],
  NumpadMultiply: ['Num *', 'N*', 'N*'],
  NumpadDivide: ['Num /', 'N/', 'N/'],
  NumpadDecimal: ['Num ,', 'N,', 'N,'],
  MouseMeio: ['Middle', 'M3', 'Middle'],
  Mouse4: ['Mouse 4', 'M4', 'M4'],
  Mouse5: ['Mouse 5', 'M5', 'M5'],
};
const PALAVRAS = new Set(['Space', 'Delete', 'Middle', 'Spc']);
const MODO = { lista: 0, hud: 1, mapa: 2 };
let LAYOUT = null;
export function usarLayout(a) {
  const b = a && typeof a.get === 'function' ? a : null;
  if (b === LAYOUT) return false;
  LAYOUT = b;
  avisarTodos();
  return true;
}
export function rotuloCodigo(a, b = 'lista', c = null) {
  const k = MODO[b] ?? 0,
    T = (s) => (c && PALAVRAS.has(s) ? c(s) : s);
  if (!a) return '';
  if (NOMES[a]) return T(NOMES[a][k]);
  if (SETAS[a]) return SETAS[a];
  const d = () => {
    const v = LAYOUT?.get?.(a);
    return typeof v === 'string' && v.trim() && v.length <= 2 ? v.toUpperCase() : null;
  };
  let m;
  if ((m = /^Key([A-Z])$/.exec(a))) return d() || m[1];
  if ((m = /^Digit(\d)$/.exec(a))) return d() || m[1];
  if ((m = /^Numpad(\d)$/.exec(a))) return k === 0 ? 'Num ' + m[1] : 'N' + m[1];
  if ((m = /^F(\d{1,2})$/.exec(a))) return 'F' + m[1];
  if (a === 'Equal') {
    const v = d();
    return !v || v === '=' ? '+' : v;
  }
  if (ABNT2[a]) return d() || ABNT2[a];
  return a.length <= 6 ? a : a.slice(0, 6);
}
export function rotulo(a, b = 'lista', c = null) {
  if (!a) return b === 'hud' ? '' : '—';
  const { mods: d, code: e } = partes(a),
    f = rotuloCodigo(e, b, c);
  if (!d.length) return f;
  if (b === 'hud') return d.map((m) => ({ Shift: '⇧', Alt: '⌥', Ctrl: '^', Meta: '⌘' })[m]).join('') + f;
  return d.join('+') + '+' + f;
}
const DO_NAVEGADOR = new Set(['F5', 'F11', 'F12']),
  DA_EQUIPE = new Set(['F7', 'F8']);
export const MOTIVOS = {
  modificador: "Shift, Ctrl, Alt and Cmd alone don't count: press them with another key.",
  combinacao: 'Ctrl, Alt and Cmd belong to the browser: pick another key (Shift + key works).',
  reservada: 'That key belongs to the browser: pick another.',
  bastidor: "That key isn't allowed: pick another.",
  desconhecida: "Couldn't read that key: pick another.",
  fixa: 'That key is fixed: pick another.',
  travada: 'That key is fixed.',
};
export const recusaDoNavegador = (a) => a === 'reservada' || a === 'combinacao';
export function capturar(a) {
  const b = String(a?.code || '');
  if (ehMouse(b)) return { tipo: 'combo', combo: b };
  if (!b || b === 'Unidentified') return { tipo: 'recusa', motivo: 'desconhecida' };
  if (b === 'Escape') return { tipo: 'cancelar' };
  if (b === 'Backspace') return { tipo: 'limpar' };
  if (CODIGOS_MOD.has(b)) return { tipo: 'recusa', motivo: 'modificador' };
  if (a.ctrlKey || a.altKey || a.metaKey) return { tipo: 'recusa', motivo: 'combinacao' };
  if (DO_NAVEGADOR.has(b)) return { tipo: 'recusa', motivo: 'reservada' };
  if (DA_EQUIPE.has(b)) return { tipo: 'recusa', motivo: 'bastidor' };
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(b)) return { tipo: 'recusa', motivo: 'desconhecida' };
  return { tipo: 'combo', combo: a.shiftKey ? 'Shift+' + b : b };
}
export function daCaptura(a) {
  if (!valido(a)) return false;
  const { mods: b, code: c } = partes(a);
  if (ehMouse(c)) return true;
  return (
    b.every((m) => m === 'Shift') &&
    !CODIGOS_MOD.has(c) &&
    !DO_NAVEGADOR.has(c) &&
    !DA_EQUIPE.has(c) &&
    c !== 'Escape' &&
    c !== 'Backspace' &&
    c !== 'Unidentified'
  );
}
const memoria = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      m.set(k, String(v));
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
};
function armazenamentoPadrao() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {}
  return memoria();
}
const OUVINTES_GLOBAIS = new Set();
function avisarTodos() {
  for (const f of OUVINTES_GLOBAIS)
    try {
      f();
    } catch {}
}
export function criar({ armazenamento: b = null } = {}) {
  const g = b || armazenamentoPadrao();
  let h = null,
    i = null,
    j = false;
  const l = new Set();
  const q = (k) => {
    try {
      return JSON.parse(g.getItem(k) || 'null');
    } catch {
      return null;
    }
  };
  const r = (k, v) => {
    try {
      if (v == null) g.removeItem(k);
      else g.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  };
  const t = () => {
    for (const f of l)
      try {
        f();
      } catch (e) {
        console.warn('keys: aoMudar', e);
      }
  };
  function u() {
    const b = q(CHAVE_TECLAS),
      d = b && b.versao === VERSAO && b.acoes && typeof b.acoes === 'object' && !Array.isArray(b.acoes) ? b.acoes : {};
    const m = new Map(),
      f = new Map();
    const g = (a, c) => {
      const b = contextoDe(a);
      if (!f.has(b)) f.set(b, new Set());
      const s = f.get(b);
      if (!c || s.has(c)) return false;
      s.add(c);
      return true;
    };
    for (const a of ACOES) for (const s of ['p', 'a']) if (a[s] && fixa(a.id, s)) g(a, a[s]);
    const j = ACOES.filter((a) => Object.hasOwn(d, a.id)),
      k = ACOES.filter((a) => !Object.hasOwn(d, a.id));
    for (const a of [...j, ...k]) {
      const e = Object.hasOwn(d, a.id) && d[a.id] && typeof d[a.id] === 'object' ? d[a.id] : null;
      const n = (s) => {
        const b = a[s];
        if (fixa(a.id, s) || !e || !Object.hasOwn(e, s)) return b;
        const v = e[s];
        return v === null ? null : daCaptura(v) ? v : b;
      };
      let p = n('p'),
        o = n('a');
      if (p && !fixa(a.id, 'p') && !g(a, p)) p = null;
      if (o && (o === p || (!fixa(a.id, 'a') && !g(a, o)))) o = null;
      m.set(a.id, { p, a: o });
    }
    h = m;
    const l = q(CHAVE_MOUSE);
    i = { andarClique: !(l && l.andarClique === false) };
  }
  const w = () => {
    if (!h) u();
    return h;
  };
  function x() {
    const b = {};
    for (const a of ACOES) {
      const v = w().get(a.id);
      if (v.p !== a.p || v.a !== a.a) b[a.id] = { p: v.p, a: v.a };
    }
    r(CHAVE_TECLAS, Object.keys(b).length ? { versao: VERSAO, acoes: b } : null);
  }
  const y = () => {
    x();
    t();
  };
  const z = (a) => {
    const v = w().get(a);
    return v ? { ...v } : null;
  };
  function _(b, c = 'jogo') {
    if (!b) return null;
    for (const a of ACOES) {
      if (contextoDe(a) !== c) continue;
      const v = w().get(a.id);
      if (v.p === b) return { id: a.id, slot: 'p' };
      if (v.a === b) return { id: a.id, slot: 'a' };
    }
    return null;
  }
  function $(a, b = 'jogo') {
    const c = comboDe(a);
    if (!c) return null;
    const d = _(c, b);
    if (d) return d.id;
    const { mods: e, code: f } = partes(c);
    if (e.length === 1 && e[0] === 'Shift') {
      const g = _(f, b);
      if (g && !acao(g.id).exato) return g.id;
    }
    return null;
  }
  function aa(b, d) {
    const v = w().get(b);
    if (!v || !d) return false;
    const e = d.has('ShiftLeft') || d.has('ShiftRight');
    return [v.p, v.a].some((c) => {
      if (!c) return false;
      const { mods: a, code: b } = partes(c);
      return d.has(b) && (!a.includes('Shift') || e);
    });
  }
  function ba(b, d) {
    const v = w().get(b),
      e = String(d?.code || '');
    if (!v || !e) return false;
    return [v.p, v.a].some((c) => c && partes(c).code === e);
  }
  function ca(b, c, e) {
    const a = acao(b);
    if (!a || !e) return null;
    const d = _(e, contextoDe(a));
    if (!d) return null;
    if (d.id === b) return d.slot === c ? null : { mesma: true, slot: d.slot };
    if (fixa(d.id, d.slot)) return { fixa: true, id: d.id, slot: d.slot };
    return { id: d.id, slot: d.slot, antiga: w().get(b)[c] || null };
  }
  function da(b, d, e) {
    const a = acao(b);
    if (!a || (d !== 'p' && d !== 'a') || fixa(b, d)) return false;
    if (e != null && !daCaptura(e)) return false;
    if (e) {
      const c = ca(b, d, e);
      if (c && !c.mesma) return false;
    }
    const v = w().get(b);
    if (e && v[d === 'p' ? 'a' : 'p'] === e) v[d === 'p' ? 'a' : 'p'] = v[d];
    v[d] = e || null;
    y();
    return true;
  }
  function ea(b, d, e) {
    const c = ca(b, d, e);
    if (!c || c.mesma) return da(b, d, e);
    if (c.fixa) return false;
    const v = w().get(b),
      o = w().get(c.id);
    o[c.slot] = c.antiga;
    if (o.p && o.p === o.a) o.a = null;
    v[d] = e;
    y();
    return true;
  }
  function fa(b, d, e) {
    const c = ca(b, d, e);
    if (!c || c.mesma) return { ok: da(b, d, e), semTecla: null };
    if (c.fixa) return { ok: false, semTecla: null };
    const v = w().get(b),
      o = w().get(c.id);
    o[c.slot] = null;
    if (c.slot === 'p' && o.a) {
      o.p = o.a;
      o.a = null;
    }
    v[d] = e;
    y();
    return { ok: true, semTecla: !o.p && !o.a ? c.id : null };
  }
  function ga() {
    r(CHAVE_TECLAS, null);
    h = null;
    u();
    t();
  }
  const ha = (b) => {
    const a = acao(b),
      v = w().get(b);
    return !!a && !!(a.p || a.a) && !v.p && !v.a;
  };
  const ia = (b, c = 'lista', d = null) => {
    const v = w().get(b);
    return rotulo(v ? v.p || v.a : null, c, d);
  };
  function ja(b) {
    let d = null,
      e = 9;
    for (const a of ACOES) {
      const v = w().get(a.id);
      for (const s of ['p', 'a']) {
        const c = v[s];
        if (!c) continue;
        const f = partes(c);
        if (f.code !== b) continue;
        const n = (f.mods.length ? 2 : 0) + (contextoDe(a) === 'jogo' ? 0 : 4) + (s === 'p' ? 0 : 1);
        if (n < e) {
          e = n;
          d = { id: a.id, slot: s, grupo: a.grupo, combo: c };
        }
      }
    }
    return d;
  }
  return {
    carregar: u,
    teclas: z,
    donoDe: _,
    acaoDe: $,
    segura: aa,
    daAcao: ba,
    conflito: ca,
    definir: da,
    trocarAsDuas: ea,
    usarAqui: fa,
    restaurar: ga,
    semTecla: ha,
    rotuloAcao: ia,
    usoDoCodigo: ja,
    todas: () => Object.fromEntries([...w()].map(([k, v]) => [k, { ...v }])),
    gravado: () => q(CHAVE_TECLAS),
    andarClique: () => {
      w();
      return i.andarClique;
    },
    definirAndarClique: (v) => {
      w();
      i.andarClique = !!v;
      r(CHAVE_MOUSE, i.andarClique ? null : { andarClique: false });
      t();
      return i.andarClique;
    },
    capturando: () => j,
    definirCapturando: (v) => {
      j = !!v;
    },
    aoMudar: (a) => {
      if (typeof a !== 'function') return () => {};
      l.add(a);
      return () => l.delete(a);
    },
    _avisar: t,
  };
}
export function indice(a, b) {
  if (typeof a !== 'string' || !a.startsWith(b)) return -1;
  const n = Number(a.slice(b.length));
  return Number.isInteger(n) && n >= 1 ? n - 1 : -1;
}
const PADRAO = criar();
OUVINTES_GLOBAIS.add(() => PADRAO._avisar());
export const carregar = () => PADRAO.carregar();
export const teclas = (a) => PADRAO.teclas(a);
export const todas = () => PADRAO.todas();
export const donoDe = (c, a) => PADRAO.donoDe(c, a);
export const acaoDe = (a, b) => PADRAO.acaoDe(a, b);
export const segura = (a, b) => PADRAO.segura(a, b);
export const daAcao = (a, b) => PADRAO.daAcao(a, b);
export const conflito = (a, s, c) => PADRAO.conflito(a, s, c);
export const definir = (a, s, c) => PADRAO.definir(a, s, c);
export const trocarAsDuas = (a, s, c) => PADRAO.trocarAsDuas(a, s, c);
export const usarAqui = (a, s, c) => PADRAO.usarAqui(a, s, c);
export const restaurar = () => PADRAO.restaurar();
export const recarregar = () => {
  PADRAO.carregar();
  PADRAO._avisar();
};
export const semTecla = (a) => PADRAO.semTecla(a);
export const rotuloAcao = (a, b, c) => PADRAO.rotuloAcao(a, b, c);
export const usoDoCodigo = (a) => PADRAO.usoDoCodigo(a);
export const gravado = () => PADRAO.gravado();
export const andarClique = () => PADRAO.andarClique();
export const definirAndarClique = (v) => PADRAO.definirAndarClique(v);
export const capturando = () => PADRAO.capturando();
export const definirCapturando = (v) => PADRAO.definirCapturando(v);
export const aoMudar = (a) => PADRAO.aoMudar(a);
