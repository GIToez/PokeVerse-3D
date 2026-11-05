/* Shared-world fights on the battle engine (server_world_fight.mjs): a hit's effect lands on the wild, the real-time clock
   ticks burn / sandstorm, a sleeping wild can't attack. Run: node tools/test_world_fight.mjs */
import fs from 'node:fs';
import { createWorldFight } from '../server_world_fight.mjs';
import { hp as hpBase, stat as statBase } from '../individual.mjs';

let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + l + (x ? '  ' + x : '')); };
const dataDir = new URL('../public/data', import.meta.url).pathname;
const pdx = JSON.parse(fs.readFileSync(new URL('../public/pokedex.json', import.meta.url)));
const byDex = new Map(); for (const s of pdx.species) if (!byDex.has(s.n)) byDex.set(s.n, s);
const MOVES = JSON.parse(fs.readFileSync(dataDir + '/moves.json', 'utf8'));
const species = (d) => byDex.get(+d);
const ivs = [31, 31, 31, 31, 31, 31];
const F = createWorldFight({
  dataDir, moves: () => MOVES, species, struggle: { id: 'struggle', tipo: 'Normal', poder: 50, cat: 'fisico', precisao: 100 },
  statOfParty: (S, p, i) => statBase(S.bs[i], p.lv, ivs[i], 0, 'Hardy', i),
  statOfWild: (S, w, i) => statBase(S.bs[i], w.lv, ivs[i], 0, 'Hardy', i),
  prepParty: (p) => { if (!(p.maxHp > 0)) p.maxHp = hpBase(species(p.dex).bs[0], p.lv, 31); if (p.hp == null) p.hp = p.maxHp; return p; },
});
const wild = (dex, lv = 20) => { const S = species(dex), maxHp = hpBase(S.bs[0], lv, 31); return { id: 'w' + dex + Math.random(), dex, lv, ind: { ivs, natureza: 'Hardy' }, state: 'vagando', hp: maxHp, maxHp }; };
const mon = (dex, lv = 30) => ({ uid: 'p' + dex + Math.random(), dex, lv, nome: species(dex).name });

/* status from a move */
{
  const w = wild(19), p = mon(25);
  let r = null;
  for (let i = 0; i < 6 && !r?.st; i++) r = F.hitWild(p, w, MOVES.thunderwave, null);
  ok('Thunder Wave paralyzes a wild on the server', w.status?.id === 'paralysis' && r.st?.id === 'paralysis', JSON.stringify(w.status));
  const g = F.hitWild(p, w, MOVES.growl, null);
  ok('Growl lowers the wild\'s Attack (stages for the client)', g.estagios?.quem === 'ele' && g.estagios.mudancas[0]?.atributo === 'atk', JSON.stringify(g.estagios));
  const hp0 = w.hp, t = F.hitWild(p, w, MOVES.thundershock || MOVES.thunderbolt, null);
  ok('a damaging hit lowers the wild\'s HP', t.errou || w.hp < hp0, hp0 + ' → ' + w.hp);
}
/* real-time clock: burn and sandstorm tick */
{
  const w = wild(16), p = mon(4); let now = Date.now();
  for (let i = 0; i < 20 && w.status?.id !== 'burn'; i++) { w.hp = w.maxHp; F.hitWild(p, w, MOVES.ember, null, now); }
  w.hp = w.maxHp;
  if (w.status?.id !== 'burn') { w.status = { id: 'burn', n: 0 }; F.hitWild(p, w, MOVES.growl, null, now); }
  const hp0 = w.hp;
  now += 4000; const t = F.tick(w, null, now);
  ok('a burned wild loses HP on the server\'s clock', w.hp < hp0 && t?.danos?.some((x) => x.motivo === 'burn'), hp0 + ' → ' + w.hp);
  const w2 = wild(16), hp2 = w2.hp; F.hitWild(p, w2, MOVES.growl, 'areia', now);
  now += 3500; const t2 = F.tick(w2, 'areia', now);
  ok('sandstorm chips a Pidgey in the world', w2.hp < hp2 && t2?.danos?.some((x) => x.motivo === 'areia'), hp2 + ' → ' + w2.hp);
}
/* a sleeping wild can't attack */
{
  const w = wild(19), p = mon(25);
  F.hitWild(p, w, MOVES.growl, null);
  w.status = { id: 'sleep', n: 3, turnos: 3 };
  F.hitWild(p, w, MOVES.growl, null);
  const r = F.wildHits(w, p, MOVES.tackle, null);
  ok('an asleep wild cannot hit', r.parado === 'asleep' && r.dano === 0, JSON.stringify(r));
}
/* the wild's move lands its effect on the partner */
{
  const w = wild(23), p = mon(25); let got = null;
  for (let i = 0; i < 30 && !got; i++) { const r = F.wildHits(w, p, MOVES.poisonsting, null); if (r.status) got = r.status; }
  ok('Poison Sting can poison the partner (reported for the client)', got?.id === 'poison', JSON.stringify(got));
}
/* weather from the map */
{
  const w = wild(16), p = mon(7), w2 = wild(16);
  const dry = []; const wet = [];
  for (let i = 0; i < 8; i++) { w.hp = w.maxHp; w2.hp = w2.maxHp; const a = F.hitWild(p, w, MOVES.watergun, null); const b = F.hitWild(p, w2, MOVES.watergun, 'chuva'); if (!a.errou) dry.push(a.dano); if (!b.errou) wet.push(b.dano); }
  const avg = (l) => l.reduce((t, x) => t + x, 0) / Math.max(1, l.length);
  ok('rain powers up Water Gun in the world', avg(wet) > avg(dry) * 1.3, avg(dry).toFixed(1) + ' → ' + avg(wet).toFixed(1));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
