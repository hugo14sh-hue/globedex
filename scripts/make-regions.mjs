// Bygger public/geo/delstater.json: USA:s delstater och Washington D.C. för kartläget Regioner.
// Källa: Natural Earth admin 1 states and provinces 1:50m (public domain), https://www.naturalearthdata.com
// Bara USA. Ytorna kopplas till platserna i content/US.json via data.iso_3166_2 (till exempel US-CA).
// Ytorna förenklas (Douglas-Peucker) och avrundas så att filen blir högst 300 kB. Filen laddas först
// när läget Regioner väljs och ligger inte i huvudpaketet.
// Körs sällan, resultatet ligger i git. Användning: node scripts/make-regions.mjs [lokal geojson]
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const URL_50M = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const OUT = 'public/geo/delstater.json';
const MAX_BYTES = 300 * 1024;
/** Tolerans i grader för förenklingen. */
const TOLERANCE = 0.01;

const src = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], 'utf8'))
  : await (await fetch(URL_50M)).json();

const r2 = (n) => Math.round(n * 100) / 100;

/** Avstånd i kvadrat från p till sträckan a–b. */
function segDist2(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker utan rekursion. Första och sista punkten behålls. */
function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(points[i], points[first], points[last]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx > 0 && max > t2) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ring(r) {
  const out = [];
  for (const p of simplify(r, TOLERANCE)) {
    const q = [r2(p[0]), r2(p[1])];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  // En ring behöver minst fyra punkter (den sista är samma som den första).
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out.length >= 4 ? out : null;
}

function clean(geom) {
  const poly = (rings) => {
    const list = rings.map(ring);
    // Faller ytterringen bort (en liten ö) faller hela ytan bort.
    return list[0] ? list.filter(Boolean) : [];
  };
  const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).map(poly).filter((p) => p.length);
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}

const features = [];
for (const f of src.features) {
  const p = f.properties;
  if (p.iso_a2 !== 'US' || !/^US-[A-Z]{2}$/.test(p.iso_3166_2 ?? '')) continue;
  const geometry = clean(f.geometry);
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
