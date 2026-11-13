// Bygger src/lib/continents.ts: kontinent per land (ISO-kod), för siffran Kontinenter och märket Kontinenthopparen.
// Källa: Natural Earth admin 0 countries 1:50m (public domain), fältet CONTINENT, samma fil som scripts/make-countries.mjs.
// Körs sällan, resultatet ligger i git. Användning: node scripts/make-continents.mjs [lokal geojson]
import { readFile, writeFile } from 'node:fs/promises';

const URL_50M = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const src = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : await (await fetch(URL_50M)).json();

const CODE = {
  Europe: 'EU',
  Asia: 'AS',
  Africa: 'AF',
  'North America': 'NA',
  'South America': 'SA',
  Oceania: 'OC',
  Antarctica: 'AN',
};

const out = {};
for (const f of src.features) {
  const p = f.properties;
  const iso = [p.ISO_A2_EH, p.ISO_A2].find((x) => typeof x === 'string' && /^[A-Z]{2}$/.test(x));
  const c = CODE[p.CONTINENT];
  if (iso && c && !out[iso]) out[iso] = c;
}

const rows = Object.keys(out)
  .sort()
  .map((k) => `  ${k}: '${out[k]}',`)
  .join('\n');
await writeFile(
  'src/lib/continents.ts',
  `// Kontinent per land (ISO-kod). Byggd av scripts/make-continents.mjs ur Natural Earth (public domain), ingen innehållstext.
// Natural Earth räknar till exempel Ryssland till Europa och Turkiet och Cypern till Asien.
export type Continent = 'EU' | 'AS' | 'AF' | 'NA' | 'SA' | 'OC' | 'AN';

export const CONTINENT_OF: Record<string, Continent> = {
${rows}
};
`,
);
console.log(Object.keys(out).length, 'länder');
