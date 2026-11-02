/* Delegate to the HGSS-silhouette builder. */
import { spawnSync } from 'node:child_process';

const r = spawnSync('python3', ['tools/make_johto_map.py'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
