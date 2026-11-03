/**
 * A same-map door may land hundreds of metres away (a route gate, a cave, the
 * underground). That landing is stored only when `chegada` is a real arrival
 * and the player is standing on it. Anything else stays a walk, capped at
 * POS_PULO_M, so a client cannot invent a warp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DADOS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public/data');
/** Spawn steps off the marker (into the room, or onto the free side of a gate). */
export const PORTA_FOLGA_M = 24;

const MUNDO = {
  kanto: 'kanto',
  pallet_route1: 'kanto',
  '1000001': 'kanto',
  johto: '2000001',
  '2000001': '2000001',
  '2500001': '2500001',
};

let portas = null;
const marcadores = new Map();

function carregarPortas(){
  if (portas) return portas;
  portas = new Map();
  let bruto = {};
  try { bruto = JSON.parse(fs.readFileSync(path.join(DADOS, 'doors.json'), 'utf8')); } catch { return portas; }
  for (const [id, p] of Object.entries(bruto)){
    if (p && p.t === 7) portas.set(+id, p);
  }
  return portas;
}

function arquivoDoMapa(mapa){
  const nome = MUNDO[String(mapa)] || String(mapa || '');
  if (!/^[\w.-]{1,40}$/.test(nome)) return null;
  const arq = path.join(DADOS, nome + '.json');
  if (!arq.startsWith(DADOS + path.sep)) return null;
  return arq;
}

function pontos(mapa, chegada){
  const chave = String(mapa);
  if (!marcadores.has(chave)){
    const achados = new Map();
    const arq = arquivoDoMapa(mapa);
    if (arq){
      try {
        const dados = JSON.parse(fs.readFileSync(arq, 'utf8'));
        for (const n of dados.npcs || []){
          if (!n || !Number.isFinite(+n.x) || !Number.isFinite(+n.z)) continue;
          const id = +n.cfg;
          if (!carregarPortas().has(id)) continue;
          if (!achados.has(id)) achados.set(id, []);
          achados.get(id).push({ x: +n.x, z: +n.z });
        }
      } catch { /* map file missing: no marker to trust */ }
    }
    marcadores.set(chave, achados);
  }
  return marcadores.get(chave).get(+chegada) || [];
}

function perto(x, z, px, pz){
  for (const f of [-1, 1]){
    if (Math.hypot(x - f * px, z - pz) <= PORTA_FOLGA_M) return true;
  }
  return false;
}

/** True when (x, z) on `mapa` is the arrival `chegada` (either X mirror). */
export function chegadaConfere(mapa, x, z, chegada){
  const id = +chegada;
  if (!carregarPortas().has(id)) return false;
  if (!Number.isFinite(+x) || !Number.isFinite(+z)) return false;
  return pontos(mapa, id).some(p => perto(+x, +z, p.x, p.z));
}
