// Kopierar landsflaggor (SVG, 4:3) från paketet flag-icons till public/flags.
// Licens: MIT, Copyright (c) 2013 Panayiotis Lipiridis, https://github.com/lipis/flag-icons
// Licenstexten följer med som public/flags/LICENSE.txt. Flaggorna ligger utanför huvudpaketet:
// appen hämtar bara de som visas (src/components/Flag.tsx). Körs efter uppdatering av flag-icons.
// Användning: npm run flags
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = 'node_modules/flag-icons';
const OUT = 'public/flags';

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let n = 0;
for (const f of await readdir(join(SRC, 'flags/4x3'))) {
  // Bara landskoder (två bokstäver), inte regionflaggor som gb-eng eller es-ct.
  if (!/^[a-z]{2}\.svg$/.test(f)) continue;
  await copyFile(join(SRC, 'flags/4x3', f), join(OUT, f));
  n++;
}
await copyFile(join(SRC, 'LICENSE'), join(OUT, 'LICENSE.txt'));
console.log(`${n} flaggor kopierade till ${OUT}`);
