/* Grants (or removes) the GM flag on an existing account in server/data/contas.json.
 * Usage: node tools/make_gm.mjs <username> [--remove]
 *
 * Stop the game server first: it keeps accounts in memory and rewrites contas.json when it exits, which would undo this. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ARQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server/data/contas.json');
const [usuario, opcao] = process.argv.slice(2);
if (!usuario) { console.error('usage: node tools/make_gm.mjs <username> [--remove]'); process.exit(1); }
if (!fs.existsSync(ARQ)) { console.error('No accounts yet: start the server, create an account in the game, stop the server, then run this.'); process.exit(1); }

const contas = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const u = usuario.toLowerCase();
if (!contas[u]) { console.error('Account "' + u + '" not found. Existing accounts: ' + Object.keys(contas).join(', ')); process.exit(1); }
if (opcao === '--remove') delete contas[u].gm; else contas[u].gm = true;
fs.writeFileSync(ARQ, JSON.stringify(contas, null, 2));
console.log(u + (opcao === '--remove' ? ' is no longer a GM.' : ' is now a GM. Start the server and log in again.'));
