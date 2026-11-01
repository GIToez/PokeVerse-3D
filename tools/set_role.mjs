#!/usr/bin/env node
/* Set an account role on the live box.
 *   node tools/set_role.mjs <username> <admin|staff|mod|player>
 * Tries the running server first (in-memory). If it is down, edits server/data/contas.json. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLES, applyRole } from './roles.mjs';

const ARQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server/data/contas.json');
const [usuario, role] = process.argv.slice(2);

if (!usuario || usuario === '--help' || !role || !ROLES[role]) {
  console.error('usage: node tools/set_role.mjs <username> <admin|staff|mod|player>');
  process.exit(1);
}

const u = usuario.toLowerCase().trim();
if (!/^[a-z0-9_]{3,20}$/.test(u)) {
  console.error('Username must be 3–20 letters, numbers, or _.');
  process.exit(1);
}

async function viaServer() {
  const r = await fetch('http://127.0.0.1:5190/local/role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: u, role }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || ('HTTP ' + r.status));
  return d;
}

function viaFile() {
  if (!fs.existsSync(ARQ)) throw new Error('No accounts file. Create the account in the game first.');
  const contas = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
  if (!contas[u]) throw new Error('Account "' + u + '" not found. Existing: ' + Object.keys(contas).join(', '));
  const depois = applyRole(contas[u], role);
  fs.writeFileSync(ARQ, JSON.stringify(contas, null, 2));
  return { ok: true, usuario: u, via: 'file', ...depois };
}

try {
  const d = await viaServer();
  console.log(JSON.stringify({ ...d, via: 'server' }));
} catch (e) {
  try {
    const d = viaFile();
    console.log(JSON.stringify(d));
    console.log('Edited the file because the server was not reachable. Restart pokeverse-3d if it is running so it reloads.');
  } catch (e2) {
    console.error(e2.message || e2);
    process.exit(1);
  }
}
