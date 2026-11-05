/* Weather in battles: the engine rules (battle_engine.mjs + PokeVerse map weather), the server's map weather
   (server_weather.mjs) and a turn battle that reads it. Run: node tools/test_weather.mjs */
import fs from 'node:fs';
import * as BE from '../battle_engine.mjs';
import { createMapWeather } from '../server_weather.mjs';
import { criarBatalha } from '../server_battle.mjs';

let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const J = (f) => JSON.parse(fs.readFileSync(new URL('../public/data/' + f, import.meta.url), 'utf8'));
BE.usar({ status: J('biblioteca/status.json'), golpes: J('biblioteca/golpes.json').golpes });

const mon = (id, tipos, extra = {}) => BE.preparar({ id, nome: id, dex: 1, tipos, lv: 50, maxHp: 200, hp: 200, atk: 100, def: 100, spa: 100, spd: 100, spe: 100, ...extra });
const rng0 = () => 0.5;   // fixed rolls: same damage roll every time, no crits (critical chance < 0.5), accuracy rolls pass
/** Damage the first move of A does to B under a given map weather. */
function hit(move, tA, tB, clima, extraB = {}) {
  const a = mon('a', tA), b = mon('b', tB, extraB);
  a.est.climaMapa = clima; b.est.climaMapa = clima;
  const ev = BE.turno(a, BE.golpe(move), b, null, { rng: rng0 });
  return { dano: ev.filter((e) => e.t === 'dano' && e.alvo === 'b' && !e.motivo).reduce((s, e) => s + e.v, 0), ev, a, b };
}

/* power */
const surf0 = hit('surf', ['normal'], ['normal'], null).dano, surfR = hit('surf', ['normal'], ['normal'], 'chuva').dano, surfS = hit('surf', ['normal'], ['normal'], 'sol').dano;
ok('rain powers up Water moves (×1.5)', surfR > surf0 * 1.35 && surfR < surf0 * 1.65, surf0 + ' → ' + surfR);
ok('harsh sun weakens Water moves (×0.5)', surfS < surf0 * 0.6, surf0 + ' → ' + surfS);
const fl0 = hit('flamethrower', ['normal'], ['normal'], null).dano, flS = hit('flamethrower', ['normal'], ['normal'], 'sol').dano;
ok('harsh sun powers up Fire moves', flS > fl0 * 1.35, fl0 + ' → ' + flS);
const sb0 = hit('solar-beam', ['normal'], ['normal'], null).dano, sbR = hit('solar-beam', ['normal'], ['normal'], 'chuva').dano, sbF = hit('solar-beam', ['normal'], ['normal'], 'nevoeiro').dano;
ok('Solar Beam is halved in rain, not in fog', sbR < sb0 * 0.6 && sbF === sb0, sb0 + ' / rain ' + sbR + ' / fog ' + sbF);
const wb0 = hit('weather-ball', ['normal'], ['normal'], null), wbR = hit('weather-ball', ['normal'], ['fire'], 'chuva');
ok('Weather Ball turns Water and 100 power in rain', wbR.dano > wb0.dano * 2.5, wb0.dano + ' → ' + wbR.dano + ' (vs Fire)');

/* defense */
const rs0 = hit('surf', ['normal'], ['rock'], null).dano, rsA = hit('surf', ['normal'], ['rock'], 'areia').dano;
ok('sandstorm: Rock-types take less from special moves', rsA < rs0 * 0.8, rs0 + ' → ' + rsA);
const ip0 = hit('tackle', ['normal'], ['ice'], null).dano, ipN = hit('tackle', ['normal'], ['ice'], 'neve').dano;
ok('snow: Ice-types take less from physical moves', ipN < ip0 * 0.8, ip0 + ' → ' + ipN);

/* accuracy */
const missRoll = () => 0.75;   // a 70 % move misses with this roll
const thunderIn = (clima) => { const a = mon('a', ['normal']), b = mon('b', ['normal']); a.est.climaMapa = clima; b.est.climaMapa = clima; return BE.turno(a, BE.golpe('thunder'), b, null, { rng: missRoll }); };
ok('rain: Thunder never misses', !thunderIn('chuva').some((e) => e.t === 'errou') && thunderIn(null).some((e) => e.t === 'errou'));
const tackleFog = (() => { const a = mon('a', ['normal']), b = mon('b', ['normal']); a.est.climaMapa = 'nevoeiro'; return BE.turno(a, BE.golpe('tackle'), b, null, { rng: () => 0.7 }); })();
ok('fog: accuracy ×0.6 (a 100 % move can miss)', tackleFog.some((e) => e.t === 'errou'));

/* end of turn */
const chip = (clima, tipos) => { const a = mon('a', tipos), b = mon('b', ['normal']); a.est.climaMapa = clima; b.est.climaMapa = clima; BE.turno(a, BE.golpe('growl'), b, null, { rng: rng0 }); return 200 - a.hp; };
ok('sandstorm hurts 1/16 a turn', chip('areia', ['normal']) === 12, String(chip('areia', ['normal'])));
ok('…but not Rock, Ground or Steel', chip('areia', ['rock']) === 0 && chip('areia', ['steel']) === 0);
ok('hail hurts all but Ice-types', chip('granizo', ['normal']) === 12 && chip('granizo', ['ice']) === 0);

/* healing */
const heal = (clima) => { const a = mon('a', ['grass'], { hp: 20 }), b = mon('b', ['normal']); a.est.climaMapa = clima; BE.turno(a, BE.golpe('synthesis'), b, null, { rng: rng0 }); return a.hp - 20; };
ok('Synthesis: ½ clear, ⅔ sun, ¼ rain', heal(null) === 100 && heal('sol') === 133 && heal('chuva') === 50, heal(null) + ' / ' + heal('sol') + ' / ' + heal('chuva'));

/* a weather move covers both sides and outlasts the map's */
{
  const a = mon('a', ['normal']), b = mon('b', ['normal']);
  a.est.climaMapa = 'sol'; b.est.climaMapa = 'sol';
  BE.turno(a, BE.golpe('rain-dance'), b, null, { rng: rng0 });
  ok('Rain Dance covers the whole field over the map\'s sun', BE.climaAtivo(a) === 'chuva' && BE.climaAtivo(b) === 'chuva');
}

/* server map weather */
const W = createMapWeather({ dataDir: new URL('../public/data', import.meta.url).pathname });
ok('indoors there is no weather', W.weatherOf('4110001') === null && W.weatherOf('4110001', { account: { gm: true }, forced: 'rain' }) === null);
ok('staff can test a weather outdoors; others cannot', W.weatherOf('kanto', { account: { gm: true }, forced: 'sandstorm' }) === 'areia' && W.weatherOf('kanto', { account: {}, forced: 'sandstorm' }) !== 'areia' || W.weatherOf('kanto') === 'areia');
ok('heavy rain is rain for the engine', W.forEngine('chuva_forte') === 'chuva');

/* a turn battle reads the map weather */
{
  const m = (uid, dex, nome, lv, movs) => ({ uid, dex, nome, lv, exp: 0, hp: 999, maxHp: 999, ivs: [31, 31, 31, 31, 31, 31], natureza: 'Hardy', movs: movs.map((id) => ({ id, pp: 20, ppMax: 20 })) });
  const contas = { ash: { gm: true, save: { dinheiro: 0, itens: {}, bolas: {}, insignias: [], treinadorPago: [], time: [m('p1', 25, 'Pikachu', 50, ['growl'])] }, rev: 1 } };
  const sent = [], ws = { _id: '1', _usuario: 'ash', _info: { token: 't', nome: 'ash', x: 0, z: 0 }, _mapa: 'kanto', readyState: 1 };
  const B = criarBatalha({ contas, sessoes: new Map([['t', 'ash']]), conexoes: new Map([['1', ws]]), enviar: (w, o) => sent.push(o), socketsDe: () => [ws], salvarContas() {}, aplicarEvento: () => null, enviarMissao() {} });
  B.receber(ws, { t: 'bat_desafiar', tipo: 'ginasio', id: 101, clima: 'sandstorm' });
  const open = sent.at(-1);
  ok('the battle tells the client its weather', open?.clima?.id === 'areia', JSON.stringify(open?.clima));
  const hp0 = contas.ash.save.time[0].hp;
  B.receber(ws, { t: 'bat_acao', acao: 'golpe', golpe: 'growl', vez: open.vez });
  const r = sent.at(-1);
  ok('sandstorm chips the player\'s Pikachu in a gym battle', contas.ash.save.time[0].hp < hp0 && (r.log || []).some((x) => /sandstorm/i.test(x)), (r.log || []).join(' | '));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
