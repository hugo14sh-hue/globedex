// Bygger public/geo/delade.json och src/lib/deladeGeo.ts: gränserna för delarna i delade länder
// (content/_landlistor.json, fältet delade), till exempel England, Skottland, Wales och Nordirland för GB.
// Källa: Natural Earth admin 0 map units 1:50m (public domain), https://www.naturalearthdata.com
// Samma detaljnivå och format som public/geo/lander.json (scripts/make-countries.mjs): 1:50m, koordinater
// avrundade till två decimaler, ingen förenkling. Varje del kopplas till sin yta via landets kod (ISO_A2_EH)
// och delens kod efter bindestrecket i versaler mot GU_A3 (GB-eng -> ENG). Skriptet avbryter om någon del
// saknar yta. Körs när fältet delade ändras, resultatet ligger i git.
// Användning: node scripts/make-delade.mjs [lokal geojson]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { roundGeometry } from './lib/geo-round.mjs';

const URL_50M = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_units.geojson';
const OUT_GEO = 'public/geo/delade.json';
const OUT_TS = 'src/lib/deladeGeo.ts';

const lists = JSON.parse((await readFile('content/_landlistor.json', 'utf8')).replace(/^﻿/, ''));
const split = lists.delade ?? {};

const src = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(URL_50M)).json();

const r2 = (n) => Math.round(n * 100) / 100;

/** Utsträckningen över alla delar av ytan: [väst, syd, öst, nord]. */
function bbox(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of polys)
    for (const [x, y] of poly[0]) {
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    }
  return b;
}

const features = [];
const meta = {};
const missing = [];
for (const [parent, parts] of Object.entries(split)) {
  for (const part of parts) {
    const unit = part.slice(parent.length + 1).toUpperCase();
    const f = src.features.find((x) => {
      const p = x.properties ?? {};
      return (p.ISO_A2_EH === parent || p.ISO_A2 === parent) && p.GU_A3 === unit;
    });
    if (!f) {
      missing.push(part);
      continue;
    }
    const geometry = roundGeometry(f.geometry);
    if (!geometry.coordinates.length) throw new Error(`${part}: ytan försvann vid avrundningen`);
    features.push({ type: 'Feature', id: features.length + 1, properties: { iso: part, parent }, geometry });
    const p = f.properties;
    // Mittpunkten är Natural Earths etikettpunkt (inne i ytan), annars mitten av utsträckningen.
    const b = bbox(geometry);
    const lon = typeof p.LABEL_X === 'number' ? r2(p.LABEL_X) : r2((b[0] + b[2]) / 2);
    const lat = typeof p.LABEL_Y === 'number' ? r2(p.LABEL_Y) : r2((b[1] + b[3]) / 2);
    meta[part] = { lat, lon, box: b };
  }
}
if (missing.length) throw new Error(`Ingen yta i Natural Earth admin 0 map units för: ${missing.join(', ')}`);

await mkdir('public/geo', { recursive: true });
await writeFile(OUT_GEO, JSON.stringify({ type: 'FeatureCollection', features }));

const rows = Object.entries(meta)
  .map(([id, m]) => `  '${id}': { lat: ${m.lat}, lon: ${m.lon}, box: [${m.box.join(', ')}] },`)
  .join('\n');
await writeFile(
  OUT_TS,
  `// Mittpunkt och utsnitt för delarna i delade länder (content/_landlistor.json, fältet delade). Byggd av
// scripts/make-delade.mjs ur Natural Earth admin 0 map units (public domain), samma källa som public/geo/delade.json.
// Ingen innehållstext. Utsnittet är [väst, syd, öst, nord].
export const SPLIT_GEO: Record<string, { lat: number; lon: number; box: [number, number, number, number] }> = {
${rows}
};
`,
);
console.log(`${features.length} delar skrivna till ${OUT_GEO} (${Math.round(JSON.stringify({ features }).length / 1024)} kB) och ${OUT_TS}`);
