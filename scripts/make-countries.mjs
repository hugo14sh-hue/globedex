// Bygger public/geo/lander.json: landsgränser för kartans statuslager.
// Källa: Natural Earth admin 0 countries 1:50m (public domain), https://www.naturalearthdata.com
// Körs sällan, resultatet ligger i git. Användning: node scripts/make-countries.mjs [lokal geojson]
import { readFile, writeFile, mkdir } from 'node:fs/promises';

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
  const p = f.properties;
  // ISO_A2_EH har koder även där ISO_A2 är -99 (t.ex. Frankrike och Norge).
  const iso = [p.ISO_A2_EH, p.ISO_A2].find((x) => typeof x === 'string' && /^[A-Z]{2}$/.test(x));
  if (!iso) continue;
  features.push({ type: 'Feature', id: features.length + 1, properties: { iso }, geometry: clean(f.geometry) });
}

await mkdir('public/geo', { recursive: true });
await writeFile('public/geo/lander.json', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`${features.length} länder skrivna till public/geo/lander.json`);
