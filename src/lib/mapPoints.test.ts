import { describe, expect, it } from 'vitest';
import geoRaw from '../../public/geo/lander.json?raw';
import { COUNTRIES } from './countries';
import { countryBounds, pointCountries } from './mapPoints';

const square = (iso: string, x: number, y: number, s: number) => ({
  properties: { iso },
  geometry: { type: 'Polygon', coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] },
});

describe('länder som punkt på kartan', () => {
  it('räknar ut ytans utsträckning per land', () => {
    const b = countryBounds({ features: [square('AA', 0, 0, 2), square('AA', 5, 5, 1)] });
    expect(b.get('AA')).toEqual([0, 0, 6, 6]);
  });

  it('små länder och länder utan yta blir punkter, stora inte', () => {
    const b = countryBounds({ features: [square('AA', 0, 0, 2), square('BB', 0, 0, 0.1)] });
    const list = pointCountries(b, [
      { iso: 'AA', lat: 1, lon: 1 },
      { iso: 'BB', lat: 0, lon: 0 },
      { iso: 'CC', lat: 3, lon: 3 },
      { iso: 'CC', lat: 9, lon: 9 },
    ]);
    expect(list).toEqual([
      { iso: 'BB', lat: 0, lon: 0 },
      { iso: 'CC', lat: 3, lon: 3 },
    ]);
  });

  it('Monaco är för litet att träffa i kartdatat och blir en punkt, Frankrike inte', () => {
    const fc = JSON.parse(geoRaw);
    const b = countryBounds(fc);
    expect(b.has('MC')).toBe(true);
    const isos = pointCountries(b, COUNTRIES.map(([iso, lat, lon]) => ({ iso, lat, lon }))).map((c) => c.iso);
    expect(isos).toContain('MC');
    expect(isos).toContain('VA');
    expect(isos).not.toContain('FR');
    expect(isos).not.toContain('SE');
  });
});
