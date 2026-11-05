/* MAP WEATHER on the server: the same weather the player sees in the overworld (weather.mjs paraHora on the server's clock),
 * so battles can use it. Indoors (houses, labs, caves, gyms…) there is no weather — the same test the client uses
 * (index.html INTERIOR: a scene whose areas are all non-outdoor). Staff can test another weather: their client sends it
 * along (chat /weather), and only for GM / staff accounts is it believed.
 *
 *   weatherOf(mapa, { account, forced }) → 'chuva' | 'chuva_forte' | 'sol' | 'areia' | 'granizo' | 'neve' | 'nevoeiro' | null
 *   forEngine(w) → the battle engine's id (heavy rain counts as rain) */
import fs from 'node:fs';
import nodePath from 'node:path';
import * as Weather from './weather.mjs';

/** The overworld names the server uses for its open maps (server_doors.mjs MUNDO). */
const OUTDOOR_ALIAS = { kanto: 1000001, pallet_route1: 1000001, johto: 2000001 };
const serverHour = (now = Date.now()) => ((now % 3600000) / 3600000) * 24;

export function createMapWeather({ dataDir }) {
  let outdoor = null;
  function outdoorSet() {
    if (outdoor) return outdoor;
    outdoor = new Set([1000001, 2000001, 2500001]);
    try {
      const d = JSON.parse(fs.readFileSync(nodePath.join(dataDir, 'scenes.json'), 'utf8'));
      for (const c of d.cenas || d || []) {
        const areas = c?.areas || [];
        if (!areas.length || areas.some((a) => a?.tipo === 1)) outdoor.add(+c.id);
      }
    } catch (e) { console.warn('[weather] scenes.json:', e.message); }
    return outdoor;
  }
  const isOutdoor = (mapa) => outdoorSet().has(+(OUTDOOR_ALIAS[mapa] ?? mapa));
  const isStaff = (c) => !!(c && (c.gm || c.cargo === 'staff'));

  function weatherOf(mapa, { account = null, forced, now = Date.now() } = {}) {
    if (!isOutdoor(mapa ?? 'kanto')) return null;
    if (forced !== undefined && isStaff(account)) {
      const w = Weather.ler(forced);
      if (w !== undefined) return w;
    }
    return Weather.paraHora(serverHour(now), now) || null;
  }
  const forEngine = (w) => (w === 'chuva_forte' ? 'chuva' : w || null);
  return { weatherOf, forEngine, isOutdoor };
}
