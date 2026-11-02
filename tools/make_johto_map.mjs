/* Delegate to the HGSS overworld builder. */
import { spawnSync } from 'node:child_process';

const r = spawnSync('python3', ['tools/make_johto_hgss.py'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
