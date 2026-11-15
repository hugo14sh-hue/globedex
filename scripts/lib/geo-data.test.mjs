// Kartdatat i public/geo/lander.json mot appens länder (src/lib/countries.ts) och tabellen i src/lib/geoAreas.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../../src/lib/countries';
import { AREA_TO_COUNTRY } from '../../src/lib/geoAreas';

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
