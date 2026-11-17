// Bygger public/geo/landskap.json: Sveriges 25 landskap för kartläget Regioner.
// Källa: perliedman/svenska-landskap (svenska-landskap-klippt.geo.json), byggd på Lantmäteriets Distriktskarta,
// CC0 enligt projektets README. https://github.com/perliedman/svenska-landskap
// Landskapen har ingen ISO 3166-2-kod. Varje yta kopplas därför via namnet till platsen med layer landskap
// i content/SE.json, och ytans code blir platsens id (till exempel SE-skane). Skriptet avbryter om något
// landskap saknar yta eller någon yta saknar landskap. Ytorna förenklas och avrundas som delstaternas,
// så att filen blir högst 300 kB. Filen laddas först när läget Regioner väljs.
// Körs sällan, resultatet ligger i git. Användning: node scripts/make-landskap.mjs [lokal geojson]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cleanGeometry, r2 } from './lib/geo-simplify.mjs';

const URL_SRC = 'https://raw.githubusercontent.com/perliedman/svenska-landskap/master/svenska-landskap-klippt.geo.json';
const OUT = 'public/geo/landskap.json';
const MAX_BYTES = 300 * 1024;
/** Tolerans i grader för förenklingen, samma som för delstaterna. */
const TOLERANCE = 0.01;

const src = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(URL_SRC)).json();
const se = JSON.parse((await readFile('content/SE.json', 'utf8')).replace(/^﻿/, ''));

const key = (s) => String(s ?? '').normalize('NFC').trim().toLocaleLowerCase('sv-SE');
const places = new Map(se.places.filter((p) => p.layer === 'landskap').map((p) => [key(p.name), p]));

/** Ytan av en ring (skosnöresformeln), för att hitta den största delen av ett landskap. */
function area(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}

/**
 * Etikettens punkt: inne i ytan, inte bara mitt i gränserna (Bohuslän och Lappland är sneda).
 * Vågräta linjer genom den största delen. Mitten av den bredaste sträckan inne i ytan (med hål) vinner.
 */
function labelPoint(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const poly = polys.reduce((a, b) => (area(b[0]) > area(a[0]) ? b : a));
  const ys = poly[0].map((p) => p[1]);
  const [s, n] = [Math.min(...ys), Math.max(...ys)];
  let best = null;
  for (let k = 1; k < 20; k++) {
    // Linjen läggs mellan avrundade värden så att den aldrig går genom en hörnpunkt.
    const y = s + ((n - s) * k) / 20 + 0.00123;
    const xs = [];
    for (const r of poly)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [a, b] = [r[j], r[i]];
        if (a[1] > y !== b[1] > y) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      // Breddgraden väger in så att punkten hellre hamnar mot mitten än i en bred kant.
      const w = (xs[i + 1] - xs[i]) * (1 - Math.abs(k - 10) / 20);
      if (!best || w > best.w) best = { w, x: (xs[i] + xs[i + 1]) / 2, y };
    }
  }
  return [r2(best.x), r2(best.y)];
}

const features = [];
const unmatched = [];
for (const f of src.features) {
  const name = f.properties?.landskap;
  const place = places.get(key(name));
  if (!place) {
    unmatched.push(name);
    continue;
  }
  places.delete(key(name));
  const geometry = cleanGeometry(f.geometry, TOLERANCE);
  if (!geometry.coordinates.length) throw new Error(`${name}: ytan försvann vid förenklingen`);
  const [lx, ly] = labelPoint(geometry);
  features.push({ type: 'Feature', properties: { code: place.id, lx, ly }, geometry });
}
const missing = [...places.values()].map((p) => p.name);
if (unmatched.length || missing.length)
  throw new Error(`Ytor utan landskap i content/SE.json: ${unmatched.join(', ') || 'inga'}. Landskap utan yta: ${missing.join(', ') || 'inga'}.`);
features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

const json = JSON.stringify({ type: 'FeatureCollection', features });
if (json.length > MAX_BYTES) throw new Error(`${OUT} blev ${json.length} byte, högst ${MAX_BYTES}. Höj TOLERANCE.`);
await mkdir('public/geo', { recursive: true });
await writeFile(OUT, json);
console.log(`${features.length} landskap skrivna till ${OUT} (${Math.round(json.length / 1024)} kB)`);
