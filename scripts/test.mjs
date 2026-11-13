// Kör vitest. På Windows startas den från sökvägen med stor enhetsbokstav (C:),
// annars laddar vitest samma moduler två gånger när terminalen står i c:\.
import { spawnSync } from 'node:child_process';

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const r = spawnSync('npx', ['vitest', 'run', ...process.argv.slice(2)], { cwd, stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
