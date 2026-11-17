import { describe, expect, it } from 'vitest';
import { MAP_BOUNDS } from '../config';
import { CONTINENT_BOXES, countryOptions, currentFocus, DEFAULT_FOCUS, focusBounds, focusPadding, parseFocus, WORLD, type Box } from './mapFocus';

const inside = (b: Box, lon: number, lat: number) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];

describe('kartans fokus: utsnittet', () => {
  it('hela världen och Europa är samma utsnitt som före Körning 16', () => {
    expect(focusBounds(WORLD)).toEqual(MAP_BOUNDS.varlden);
    expect(focusBounds('150')).toEqual(MAP_BOUNDS.europa);
    expect(DEFAULT_FOCUS).toBe('150');
  });

  it('en världsdel ger sin ruta (M49-kod)', () => {
    expect(focusBounds('142')).toEqual(CONTINENT_BOXES.AS);
    const asia = focusBounds('142');
    for (const [lon, lat] of [[139.7, 35.7], [77.2, 28.6], [100.5, 13.8], [35.2, 31.8]]) expect(inside(asia, lon, lat)).toBe(true);
    expect(inside(asia, 2.35, 48.85)).toBe(false);
    const sa = focusBounds('005');
    for (const [lon, lat] of [[-43.2, -22.9], [-58.4, -34.6], [-74.1, 4.7]]) expect(inside(sa, lon, lat)).toBe(true);
  });

  it('ett land ger landets yta, utan avlägsna delar', () => {
    const se = focusBounds('SE');
    expect(inside(se, 18.07, 59.33)).toBe(true);
    expect(inside(se, 20.26, 67.86)).toBe(true);
    expect(inside(se, 10.75, 59.91)).toBe(false);
    // Frankrike utan Franska Guyana, USA utan Hawaii.
    expect(focusBounds('FR')[0]).toBeGreaterThan(-10);
    expect(inside(focusBounds('US'), -157.8, 21.3)).toBe(false);
    expect(inside(focusBounds('US'), -74, 40.7)).toBe(true);
    // Ett litet land får också ett utsnitt.
    expect(inside(focusBounds('MC'), 7.42, 43.74)).toBe(true);
  });

  it('världsdelar och länder krockar inte (AS är Amerikanska Samoa, 142 är Asien)', () => {
    expect(parseFocus('AS')).toEqual({ kind: 'country', iso: 'AS' });
    expect(parseFocus('142')).toMatchObject({ kind: 'continent', code: 'AS' });
    expect(parseFocus('010')).toBeNull();
    expect(parseFocus('XX')).toBeNull();
    expect(parseFocus('')).toBeNull();
  });

  it('okänt fokus ger Europa, och ett land får lite mer marginal', () => {
    expect(focusBounds('nonsens')).toEqual(MAP_BOUNDS.europa);
    expect(focusPadding('SE')).toBeGreaterThan(focusPadding('150'));
    expect(focusPadding(WORLD)).toBe(8);
  });
});

describe('kartans fokus: vilket värde som gäller', () => {
  it('adressen före det sparade, det sparade före Europa', () => {
    expect(currentFocus('SE', '142')).toBe('SE');
    expect(currentFocus(null, '142')).toBe('142');
    expect(currentFocus(null, null)).toBe('150');
    expect(currentFocus('trams', '005')).toBe('005');
  });

  it('det gamla ?utsnitt= tolkas när ?fokus= saknas', () => {
    expect(currentFocus(null, '142', 'varlden')).toBe(WORLD);
    expect(currentFocus(null, '142', 'europa')).toBe('150');
    expect(currentFocus('SE', '142', 'varlden')).toBe('SE');
  });
});

describe('kartans fokus: länderna i rullgardinen', () => {
  const names: Record<string, string> = { SE: 'Sverige', AT: 'Österrike', DK: 'Danmark', AX: 'Åland', IS: 'Island' };
  const nameOf = (iso: string) => names[iso] ?? '';

  it('i bokstavsordning på valt språk', () => {
    expect(countryOptions(Object.keys(names), nameOf, 'sv-SE').map((o) => o.label)).toEqual(['Danmark', 'Island', 'Sverige', 'Åland', 'Österrike']);
    expect(countryOptions(['AT', 'AX'], (i) => (i === 'AT' ? 'Austria' : 'Åland Islands'), 'en-GB').map((o) => o.value)).toEqual(['AX', 'AT']);
  });

  it('sökningen bryr sig inte om stora bokstäver och accenter, och ingen träff ger en tom lista', () => {
    expect(countryOptions(Object.keys(names), nameOf, 'sv-SE', 'ost').map((o) => o.value)).toEqual(['AT']);
    expect(countryOptions(Object.keys(names), nameOf, 'sv-SE', 'SVER').map((o) => o.value)).toEqual(['SE']);
    expect(countryOptions(Object.keys(names), nameOf, 'sv-SE', 'zz')).toEqual([]);
  });
});
