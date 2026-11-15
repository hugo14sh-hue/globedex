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
