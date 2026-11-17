// Bygger src/lib/countryBoxes.ts: utsnittet per land för kartans fokusval (Körning 16), ur public/geo/lander.json.
// Utsnittet börjar med landets största yta och tar med andra delar som ligger högst GAP grader från en del som
// redan är med, tills inget mer tillkommer. Avlägsna delar (Franska Guyana för Frankrike, Hawaii för USA) och delar på andra sidan
// datumlinjen kommer därför inte med, så att landet fyller kartytan. Körs sällan, resultatet ligger i git.
// Användning: node scripts/make-focus.mjs
import { readFile, writeFile } from 'node:fs/promises';

const GAP = 5;
const src = JSON.parse(await readFile(new URL('../public/geo/lander.json', import.meta.url), 'utf8'));

/** Ytan i grader², vägd med cos(latitud) så att polerna inte blir för stora. */
function area(ring) {
  let a = 0;
  let lat = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
    lat += ring[i][1];
  }
  return Math.abs(a / 2) * Math.cos(((lat / ring.length) * Math.PI) / 180);
}

function box(ring) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  return b;
}

const near = (a, b) => b[0] <= a[2] + GAP && b[2] >= a[0] - GAP && b[1] <= a[3] + GAP && b[3] >= a[1] - GAP;
const r2 = (n) => Math.round(n * 100) / 100;

const out = {};
for (const f of src.features) {
  const iso = f.properties?.iso;
  const g = f.geometry;
  if (typeof iso !== 'string' || !g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const parts = polys.filter((p) => p[0]?.length).map((p) => ({ box: box(p[0]), area: area(p[0]) }));
  if (out[iso]) parts.push({ box: out[iso], area: Infinity });
  if (!parts.length) continue;
  parts.sort((a, b) => b.area - a.area);
  const b = [...parts[0].box];
  const taken = [parts[0].box];
  const left = parts.slice(1);
  for (let grew = true; grew; ) {
    grew = false;
    for (let i = left.length - 1; i >= 0; i--) {
      if (!taken.some((t) => near(t, left[i].box))) continue;
      const x = left.splice(i, 1)[0].box;
      taken.push(x);
      b[0] = Math.min(b[0], x[0]);
      b[1] = Math.min(b[1], x[1]);
      b[2] = Math.max(b[2], x[2]);
      b[3] = Math.max(b[3], x[3]);
      grew = true;
    }
  }
  out[iso] = b;
}

const rows = Object.keys(out)
  .sort()
  .map((k) => `  ${k}: [${out[k].map(r2).join(', ')}],`)
  .join('\n');
const file = `// Utsnittet per land för kartans fokusval: [väst, syd, öst, nord]. Byggd av scripts/make-focus.mjs ur
// public/geo/lander.json (Natural Earth, public domain). Ingen innehållstext. Länder som saknas här får ett
// utsnitt runt sin mittpunkt (src/lib/mapFocus.ts).
export const COUNTRY_BOXES: Record<string, [number, number, number, number]> = {
${rows}
};
`;
await writeFile(new URL('../src/lib/countryBoxes.ts', import.meta.url), file);
console.log(`${Object.keys(out).length} länder`);
