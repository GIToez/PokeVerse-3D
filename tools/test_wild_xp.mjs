/** Server-rolled wilds: the species and the experience come from the server. */
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarWilds } from '../server_wild.mjs';

const root = nodePath.join(nodePath.dirname(fileURLToPath(import.meta.url)), '..');
const habitats = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/habitats.json'), 'utf8'));
const kanto = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/kanto.json'), 'utf8'));
const box = kanto.caixas.find(c => c.a === 1201);
if (!box) throw new Error('Route 1 box missing');

const models = new Set(fs.readdirSync(nodePath.join(root, 'public/scenery/mon')).filter(f => f.endsWith('.glb')));
const sent = [];
const contas = {
  tester: { save: { time: [{ uid: 'pika', dex: 25, lv: 5, exp: 125, hp: 40, amizade: 70 }], insignias: [], seguidorUid: 'pika' } },
};
const wilds = criarWilds({
  dir: root,
  contas,
  enviar: (_ws, obj) => sent.push(obj),
  salvarContas: () => {},
  expMult: () => 1,
  modelos: () => models,
});

const ws = { _usuario: 'tester', _mapa: 'kanto', _info: { x: -box.x, z: box.z } };
wilds.roll(ws, { area: 1201, water: false, hour: 12 });
const spawn = sent.at(-1);
if (!spawn?.ok) throw new Error('roll failed: ' + JSON.stringify(spawn));
const legal = (habitats.areas['1201'] || []).filter(e => !e.agua);
if (!legal.some(e => e.dex === spawn.dex)) throw new Error('species ' + spawn.dex + ' is not a Route 1 land encounter');
const row = legal.find(e => e.dex === spawn.dex);
const lo = row.lvMin || 2, hi = row.lvMax || 5;
if (spawn.lv < lo || spawn.lv > hi) throw new Error('level ' + spawn.lv + ' outside ' + lo + '-' + hi);

const before = contas.tester.save.time[0].exp;
wilds.defeat(ws, { id: spawn.id });
const pay = sent.at(-1);
if (pay?.t !== 'wild_exp' || !(pay.gained > 0)) throw new Error('no experience: ' + JSON.stringify(pay));
if (contas.tester.save.time[0].exp !== before + pay.gained && pay.banked === 0) {
  throw new Error('saved exp ' + contas.tester.save.time[0].exp + ' != ' + before + ' + ' + pay.gained);
}
if (pay.exp !== contas.tester.save.time[0].exp) throw new Error('message exp does not match the save');

const after = contas.tester.save.time[0].exp;
wilds.defeat(ws, { id: spawn.id });
if (contas.tester.save.time[0].exp !== after) throw new Error('the same wild paid twice');

const far = { _usuario: 'tester', _mapa: 'kanto', _info: { x: 5000, z: 5000 } };
wilds.roll(far, { area: 1201, water: false, hour: 12 });
if (sent.at(-1)?.ok) throw new Error('a roll far from Route 1 was accepted');

const expTab = JSON.parse(fs.readFileSync(nodePath.join(root, 'public/data/exp.json'), 'utf8'));
const atCap = { dex: 25, lv: 20, exp: expTab.curvas.medium[21] - 1, amizade: 70 };
const capped = wilds._test.grant(atCap, { insignias: [] }, 143, 40, 1);
if (atCap.lv !== 20 || !(atCap.expReserva > 0) || capped.banked <= 0) throw new Error('badge cap did not bank the overflow');

console.log('wild xp ok', { dex: spawn.dex, lv: spawn.lv, gained: pay.gained, exp: pay.exp, banked: capped.banked });
