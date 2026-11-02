/** Party HP stays where the fight left it. A refresh must not fill the bar, and the client cannot. */
import { maxHpOf, mergeHp, healMon, grantLevelHp } from '../server_hp.mjs';

const pikachu = { uid: 'pika', dex: 25, lv: 5, ivs: [0, 0, 0, 0, 0, 0], evs: [0, 0, 0, 0, 0, 0], hp: 40 };
const max = maxHpOf(pikachu);
if (!(max > 40)) throw new Error('expected a max above the damaged bar, got ' + max);

mergeHp(pikachu, { hp: max });
if (pikachu.hp !== 40) throw new Error('a party sync healed: ' + pikachu.hp);

mergeHp(pikachu, { hp: 22 });
if (pikachu.hp !== 22) throw new Error('damage did not stick: ' + pikachu.hp);

mergeHp(pikachu, { hp: 9999 });
if (pikachu.hp !== 22) throw new Error('an out-of-range report healed: ' + pikachu.hp);

const fresh = { uid: 'new', dex: 25, lv: 5, ivs: [0, 0, 0, 0, 0, 0], evs: [0, 0, 0, 0, 0, 0] };
mergeHp(fresh, { hp: 30 });
if (fresh.hp !== 30) throw new Error('the first real HP was dropped: ' + fresh.hp);
mergeHp(fresh, { hp: max });
if (fresh.hp !== 30) throw new Error('the second sync healed: ' + fresh.hp);

const growing = { uid: 'up', dex: 25, lv: 5, ivs: [0, 0, 0, 0, 0, 0], evs: [0, 0, 0, 0, 0, 0], hp: 40 };
mergeHp(growing, { hp: 40 });
const before = maxHpOf(growing);
growing.lv = 6;
grantLevelHp(growing, 1);
const after = maxHpOf(growing);
if (growing.hp !== 40 + (after - before)) throw new Error('level-up HP ' + growing.hp + ' != ' + (40 + (after - before)));
mergeHp(growing, { hp: after });
if (growing.hp !== 40 + (after - before)) throw new Error('a full bar after the level-up was accepted: ' + growing.hp);

const fainted = { uid: 'ko', dex: 25, lv: 8, ivs: [0, 0, 0, 0, 0, 0], evs: [0, 0, 0, 0, 0, 0], hp: 0 };
grantLevelHp(fainted, 1);
if (fainted.hp !== 0) throw new Error('a level revived a fainted Pokémon');

healMon(pikachu);
if (pikachu.hp !== maxHpOf(pikachu)) throw new Error('center heal left ' + pikachu.hp + ' / ' + maxHpOf(pikachu));

const legacy = { uid: 'old', dex: 1, lv: 12, ivs: [15, 0, 0, 0, 0, 0], evs: [0, 0, 0, 0, 0, 0] };
healMon(legacy);
if (legacy.hp === 100 || legacy.hp !== maxHpOf(legacy)) throw new Error('center heal used a stand-in max: ' + legacy.hp);

console.log('party hp ok', { damaged: 22, max, leveled: growing.hp, healed: pikachu.hp });
