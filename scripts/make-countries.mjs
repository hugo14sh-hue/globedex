// Bygger public/geo/lander.json: landsgränser för kartans statuslager.
// Källa: Natural Earth admin 0 countries 1:50m (public domain), https://www.naturalearthdata.com
// Körs sällan, resultatet ligger i git. Användning: node scripts/make-countries.mjs [lokal geojson]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { isoForArea } from '../src/lib/geoAreas.ts';

const URL_50M = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

const src = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(URL_50M)).json();

const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round));

/** Tar bort punkter som blev dubbletter efter avrundningen. */
function dedupe(ring) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  return out;
}

function clean(geom) {
  const poly = (rings) => rings.map((r) => dedupe(round(r))).filter((r) => r.length >= 4);
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: poly(geom.coordinates) };
  return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly).filter((p) => p.length) };
}

const features = [];
for (const f of src.features) {
  // Landets kod, eller landet som ytan hör till enligt ISO 3166 (Somaliland till SO, Nordcypern till CY).
  const iso = isoForArea(f.properties);
  if (!iso) {
    console.log(`Hoppar över ${f.properties.ADMIN} (${f.properties.ADM0_A3}): inget land i ISO 3166`);
    continue;
  }
  features.push({ type: 'Feature', id: features.length + 1, properties: { iso }, geometry: clean(f.geometry) });
}

await mkdir('public/geo', { recursive: true });
await writeFile('public/geo/lander.json', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`${features.length} länder skrivna till public/geo/lander.json`);
