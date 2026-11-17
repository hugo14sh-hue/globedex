// Bygger public/geo/delstater.json: USA:s delstater och Washington D.C. för kartläget Regioner.
// Källa: Natural Earth admin 1 states and provinces 1:50m (public domain), https://www.naturalearthdata.com
// Bara USA. Ytorna kopplas till platserna i content/US.json via data.iso_3166_2 (till exempel US-CA).
// Ytorna förenklas (Douglas-Peucker) och avrundas så att filen blir högst 300 kB. Filen laddas först
// när läget Regioner väljs och ligger inte i huvudpaketet.
// Körs sällan, resultatet ligger i git. Användning: node scripts/make-regions.mjs [lokal geojson]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cleanGeometry, r2 } from './lib/geo-simplify.mjs';

const URL_50M = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const OUT = 'public/geo/delstater.json';
const MAX_BYTES = 300 * 1024;
/** Tolerans i grader för förenklingen. */
const TOLERANCE = 0.01;

const src = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(URL_50M)).json();

const features = [];
for (const f of src.features) {
  const p = f.properties;
  if (p.iso_a2 !== 'US' || !/^US-[A-Z]{2}$/.test(p.iso_3166_2 ?? '')) continue;
  const geometry = cleanGeometry(f.geometry, TOLERANCE);
  if (!geometry.coordinates.length) throw new Error(`${p.iso_3166_2}: ytan försvann vid förenklingen`);
  // Etikettens punkt (Natural Earths label point), så att etiketten hamnar i ytan och inte på de ungefärliga koordinaterna i innehållet.
  features.push({ type: 'Feature', properties: { code: p.iso_3166_2, lx: r2(p.longitude), ly: r2(p.latitude) }, geometry });
}
features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

const json = JSON.stringify({ type: 'FeatureCollection', features });
if (json.length > MAX_BYTES) throw new Error(`${OUT} blev ${json.length} byte, högst ${MAX_BYTES}. Höj TOLERANCE.`);
await mkdir('public/geo', { recursive: true });
await writeFile(OUT, json);
console.log(`${features.length} delstater skrivna till ${OUT} (${Math.round(json.length / 1024)} kB)`);
