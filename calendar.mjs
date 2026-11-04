/* Game calendar, shared by the server and the client. The time of day runs on the sped-up game clock (clock.mjs: one in-game
   day per real hour), but the date, the weekday and the season follow the real calendar in Pacific time, so a "Friday only"
   Pokémon is out all Friday and a winter one all winter. Seasons are whole months: Dec–Feb winter, Mar–May spring,
   Jun–Aug summer, Sep–Nov fall (the Diamond Shop's seasonal outfits use the same calendar).

   Spawn rules a habitat row can carry (public/data/habitats.json), all optional; a row without them spawns any time:
     hora:     ['manha'|'dia'|'noite']                   time of day on the game clock
     estacoes: ['spring'|'summer'|'fall'|'winter']        real season
     dias:     ['sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'] real weekday
     climas:   ['clear'|'chuva'|'chuva_forte'|'sol'|'areia'|'granizo'|'neve'|'nevoeiro']   current weather ('clear' = none) */

export const FUSO = 'America/Los_Angeles';
export const ESTACOES = ['spring', 'summer', 'fall', 'winter'];
export const NOME_ESTACAO = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };
export const ICONE_ESTACAO = { spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️' };
export const DIAS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const NOME_DIA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const NOME_DIA_CURTO = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const NOME_MES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const NOME_MES_CURTO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ESTACAO_DO_MES = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];

let fmt = null;
try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }); } catch {}

/** Today's real date in Pacific time: { ano, mes (1–12), dia, semana (0 = Sunday), estacao }. */
export function hoje(agora = Date.now()) {
  let ano, mes, dia, semana;
  if (fmt) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(agora)).map(x => [x.type, x.value]));
    ano = +p.year; mes = +p.month; dia = +p.day; semana = NOME_DIA_CURTO.indexOf(p.weekday);
  }
  if (!(ano > 0) || semana < 0) {                     // no time-zone data (very old runtime): standard time all year
    const x = new Date(agora - 8 * 3600e3);
    ano = x.getUTCFullYear(); mes = x.getUTCMonth() + 1; dia = x.getUTCDate(); semana = x.getUTCDay();
  }
  return { ano, mes, dia, semana, estacao: ESTACAO_DO_MES[mes - 1] };
}
export const estacaoAgora = (agora = Date.now()) => hoje(agora).estacao;

let fmtHora = null;
try { fmtHora = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }); } catch {}
/** Pacific time's offset from UTC at that instant, in ms (−8 h in winter, −7 h in summer). */
export function desvioPt(agora = Date.now()) {
  if (!fmtHora) return -8 * 3600e3;
  const p = Object.fromEntries(fmtHora.formatToParts(new Date(agora)).map(x => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute) - Math.floor(agora / 60000) * 60000;
}
/** The instant of a Pacific wall-clock time (month 1–12). */
export function instantePt(ano, mes, dia, hora = 0, minuto = 0) {
  const local = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let t = local - desvioPt(local);
  t = local - desvioPt(t);
  return t;
}
/** Pacific wall-clock parts of an instant: { ano, mes, dia, hora, minuto, semana }. */
export function partesPt(agora = Date.now()) {
  const x = new Date(agora + desvioPt(agora));
  return { ano: x.getUTCFullYear(), mes: x.getUTCMonth() + 1, dia: x.getUTCDate(), hora: x.getUTCHours(), minuto: x.getUTCMinutes(), semana: x.getUTCDay() };
}

/** Spawn time of day for a game-clock hour, lined up with the sky (daynight.mjs: dark from 18 to 6). */
export function periodoSpawn(hora) {
  const h = ((+hora % 24) + 24) % 24;
  if (h >= 6 && h < 10) return 'manha';
  if (h >= 10 && h < 18) return 'dia';
  return 'noite';
}

const lista = v => (v == null ? null : (Array.isArray(v) ? v : [v]).map(x => String(x).toLowerCase()));
/** Whether a habitat row may spawn now. `quando` = { periodo, estacao, semana, clima } (clima null = clear). */
export function podeAparecer(row, quando) {
  const h = lista(row.hora);
  if (h && !h.includes(quando.periodo)) return false;
  const e = lista(row.estacoes);
  if (e && !e.includes(quando.estacao)) return false;
  const d = lista(row.dias);
  if (d && !d.includes(DIAS[quando.semana])) return false;
  const c = lista(row.climas);
  if (c && !c.includes(quando.clima || 'clear')) return false;
  return true;
}

/* Species whose look follows the season (Deerling and Sawsbuck, Gen V): the wild one wears the current season's form.
   A caught one keeps the form it was caught in. */
export const FORMA_DA_ESTACAO = {
  585: { spring: 'pm0585_00', summer: 'pm0585_11', fall: 'pm0585_12', winter: 'pm0585_13' },
  586: { spring: 'pm0586_00', summer: 'pm0586_11', fall: 'pm0586_12', winter: 'pm0586_13' },
};
// Habitat rows name the model with its extension (pm0585_00.glb), party Pokémon without it: the answer keeps the caller's style.
const semExt = glb => String(glb || '').replace(/\.glb$/i, '');
const mesmaExt = (modelo, glb) => (/\.glb$/i.test(String(modelo || '')) ? glb + '.glb' : glb);
export function glbDaEstacao(dex, glb, estacao) {
  const f = FORMA_DA_ESTACAO[+dex]?.[estacao];
  return f ? mesmaExt(glb, f) : glb;
}
/** The season a seasonal form belongs to ('fall' for pm0585_12), or null. */
export function estacaoDaForma(glb) {
  const g0 = semExt(glb);
  for (const formas of Object.values(FORMA_DA_ESTACAO)) for (const [e, g] of Object.entries(formas)) if (g === g0) return e;
  return null;
}
/** The same season's form of another species of the line (a Fall Deerling evolves into a Fall Sawsbuck). */
export function formaNaEvolucao(glbAntes, dexDepois) {
  const e = estacaoDaForma(glbAntes), f = e && FORMA_DA_ESTACAO[+dexDepois]?.[e];
  return f ? mesmaExt(glbAntes, f) : null;
}

/** "Nov 4" / "Fall · Wed" for the minimap strip. */
export const textoData = (d = hoje()) => NOME_MES_CURTO[d.mes - 1] + ' ' + d.dia;
export const textoEstacaoDia = (d = hoje()) => NOME_ESTACAO[d.estacao] + ' · ' + NOME_DIA_CURTO[d.semana];
