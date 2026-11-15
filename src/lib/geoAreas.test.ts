import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';
import { AREA_TO_COUNTRY, isoForArea } from './geoAreas';

describe('ytor utan egen ISO-kod', () => {
  it('räknar Somaliland till Somalia och Nordcypern till Cypern', () => {
    expect(isoForArea({ ISO_A2: '-99', ISO_A2_EH: '-99', ADM0_A3: 'SOL' })).toBe('SO');
    expect(isoForArea({ ISO_A2: '-99', ISO_A2_EH: '-99', ADM0_A3: 'CYN' })).toBe('CY');
  });

  it('använder ytans egen kod när den finns', () => {
    expect(isoForArea({ ISO_A2: 'SO', ISO_A2_EH: 'SO', ADM0_A3: 'SOM' })).toBe('SO');
    expect(isoForArea({ ISO_A2: '-99', ISO_A2_EH: 'FR', ADM0_A3: 'FRA' })).toBe('FR');
  });

  it('lämnar okända ytor utan land', () => {
    expect(isoForArea({ ISO_A2: '-99', ISO_A2_EH: '-99', ADM0_A3: 'KAS' })).toBeNull();
    expect(isoForArea(null)).toBeNull();
  });

  it('pekar bara på länder som finns i appen', () => {
    const known = new Set(COUNTRIES.map(([iso]) => iso));
    for (const iso of Object.values(AREA_TO_COUNTRY)) expect(known.has(iso)).toBe(true);
  });

});
