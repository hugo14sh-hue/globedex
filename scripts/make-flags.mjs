// Kopierar landsflaggor (SVG, 4:3) från paketet flag-icons till public/flags.
// Licens: MIT, Copyright (c) 2013 Panayiotis Lipiridis, https://github.com/lipis/flag-icons
// Licenstexten följer med som public/flags/LICENSE.txt. Flaggorna ligger utanför huvudpaketet:
// appen hämtar bara de som visas (src/components/Flag.tsx). Körs efter uppdatering av flag-icons.
// Användning: npm run flags
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { NO_OWN_FLAG as NO_OWN } from '../src/lib/flagParts.ts';

const SRC = 'node_modules/flag-icons';
// Delar av delade länder (content/_landlistor.json, fältet delade) som har en egen flagga i flag-icons,
// till exempel gb-eng. Delarna i src/lib/flagParts.ts (Nordirland) visas med sitt lands flagga.
const NO_OWN_FLAG = new Set(NO_OWN);
const lists = JSON.parse(readFileSync('content/_landlistor.json', 'utf8').replace(/^﻿/, ''));
const PART_FLAGS = new Set(
  Object.values(lists.delade ?? {})
    .flat()
    .filter((id) => !NO_OWN_FLAG.has(id))
    .map((id) => `${id.toLowerCase()}.svg`),
);
const OUT = 'public/flags';

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let n = 0;
for (const f of await readdir(join(SRC, 'flags/4x3'))) {
  // Bara landskoder (två bokstäver) och delarna av delade länder, inte andra regionflaggor som es-ct.
  if (!/^[a-z]{2}\.svg$/.test(f) && !PART_FLAGS.has(f)) continue;
  await copyFile(join(SRC, 'flags/4x3', f), join(OUT, f));
  n++;
}
await copyFile(join(SRC, 'LICENSE'), join(OUT, 'LICENSE.txt'));
console.log(`${n} flaggor kopierade till ${OUT}`);
