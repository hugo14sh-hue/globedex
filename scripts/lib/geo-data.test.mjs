// Kartdatat i public/geo/lander.json mot appens länder (src/lib/countries.ts) och tabellen i src/lib/geoAreas.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../../src/lib/countries';
import { AREA_TO_COUNTRY } from '../../src/lib/geoAreas';
import { regionGeoIndex } from '../../src/lib/mapRegions';

const fc = JSON.parse(readFileSync(join(process.cwd(), 'public/geo/lander.json'), 'utf8'));
const known = new Set(COUNTRIES.map(([iso]) => iso));

describe('kartdatat', () => {
  it('varje yta hör till ett land i appen', () => {
    const missing = fc.features.map((f) => f.properties.iso).filter((iso) => !known.has(iso));
    expect(missing).toEqual([]);
  });

  it('Somaliland färgas som Somalia och Nordcypern som Cypern', () => {
    expect(AREA_TO_COUNTRY).toMatchObject({ SOL: 'SO', CYN: 'CY' });
    expect(fc.features.filter((f) => f.properties.iso === 'SO')).toHaveLength(2);
    expect(fc.features.filter((f) => f.properties.iso === 'CY')).toHaveLength(2);
  });
});

// USA:s delstater (public/geo/delstater.json, byggd av scripts/make-regions.mjs) mot platserna i content/US.json.
describe('delstaternas ytor', () => {
  const buf = readFileSync(join(process.cwd(), 'public/geo/delstater.json'));
  const states = JSON.parse(buf.toString('utf8'));
  const us = JSON.parse(readFileSync(join(process.cwd(), 'content/US.json'), 'utf8').replace(/^﻿/, ''));
  const codes = us.places.filter((p) => p.layer === 'delstat').map((p) => p.data?.iso_3166_2);

  it('filen är högst 300 kB', () => {
    expect(buf.length).toBeLessThanOrEqual(300 * 1024);
  });

  it('varje delstat i innehållet har en yta, och varje yta hör till en delstat', () => {
    expect(codes).toHaveLength(51);
    const geo = regionGeoIndex(states);
    expect(codes.filter((c) => !geo.boxes[c])).toEqual([]);
    expect(Object.keys(geo.boxes).sort()).toEqual([...codes].sort());
  });

  it('etiketten ligger inom ytans gränser', () => {
    const geo = regionGeoIndex(states);
    const outside = Object.entries(geo.labels).filter(([c, [x, y]]) => {
      const [w, s, e, n] = geo.boxes[c];
      return x < w || x > e || y < s || y > n;
    });
    expect(outside).toEqual([]);
  });
});

/** Ligger punkten inne i ytan (jämnt antal korsningar räknat över alla ringar, så att hål räknas bort)? */
function inside([x, y], geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.some((poly) => {
    let hit = false;
    for (const r of poly)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++)
        if (r[i][1] > y !== r[j][1] > y && x < r[j][0] + ((y - r[j][1]) * (r[i][0] - r[j][0])) / (r[i][1] - r[j][1])) hit = !hit;
    return hit;
  });
}

// Sveriges landskap (public/geo/landskap.json, byggd av scripts/make-landskap.mjs) mot platserna i content/SE.json.
// Ytorna är nycklade på platsens id eftersom landskapen saknar ISO 3166-2-kod.
describe('landskapens ytor', () => {
  const buf = readFileSync(join(process.cwd(), 'public/geo/landskap.json'));
  const land = JSON.parse(buf.toString('utf8'));
  const se = JSON.parse(readFileSync(join(process.cwd(), 'content/SE.json'), 'utf8').replace(/^﻿/, ''));
  const ids = se.places.filter((p) => p.layer === 'landskap').map((p) => p.id);
  const geo = regionGeoIndex(land);

  it('filen är högst 300 kB', () => {
    expect(buf.length).toBeLessThanOrEqual(300 * 1024);
  });

  it('alla 25 landskap i innehållet har en yta, och varje yta hör till ett landskap', () => {
    expect(ids).toHaveLength(25);
    expect(ids.filter((id) => !geo.boxes[id])).toEqual([]);
    expect(Object.keys(geo.boxes).sort()).toEqual([...ids].sort());
  });

  it('etiketten ligger inne i ytan', () => {
    const outside = land.features.filter((f) => !inside([f.properties.lx, f.properties.ly], f.geometry)).map((f) => f.properties.code);
    expect(outside).toEqual([]);
  });

  it('ingen yta krockar med en delstats kod', () => {
    const states = regionGeoIndex(JSON.parse(readFileSync(join(process.cwd(), 'public/geo/delstater.json'), 'utf8')));
    expect(Object.keys(geo.boxes).filter((c) => states.boxes[c])).toEqual([]);
  });
});

// Delarna i delade länder (public/geo/delade.json, byggd av scripts/make-delade.mjs) mot fältet delade.
describe('delade länders ytor', () => {
  const geo = JSON.parse(readFileSync(join(process.cwd(), 'public/geo/delade.json'), 'utf8'));
  const lists = JSON.parse(readFileSync(join(process.cwd(), 'content/_landlistor.json'), 'utf8').replace(/^﻿/, ''));

  it('varje del har en yta med landet som förälder, och landet finns i kartdatat', () => {
    const want = Object.entries(lists.delade).flatMap(([iso, parts]) => parts.map((p) => `${p}:${iso}`));
    expect(geo.features.map((f) => `${f.properties.iso}:${f.properties.parent}`).sort()).toEqual(want.sort());
    for (const iso of Object.keys(lists.delade)) expect(fc.features.some((f) => f.properties.iso === iso)).toBe(true);
  });

  it('samma format som lander.json: två decimaler', () => {
    const coords = JSON.stringify(geo.features.map((f) => f.geometry.coordinates));
    expect(coords).not.toMatch(/\.\d{3,}/);
  });
});
