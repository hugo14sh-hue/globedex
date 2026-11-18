import { describe, expect, it } from 'vitest';
import lists from '../../content/_landlistor.json';
import { BADGES } from './texter';
import { badgeStates, emptyInput, visitedContinents, visitedCountries, type ViInput } from '../features/vi/marken';
import { numbers, wrapped } from '../features/vi/viLogic';
import { bucketParts, visitedCount } from './bucketParts';
import { APP_COUNTRIES, countryListCodes, countryListTotal, countsAsCountry, DEFAULT_COUNTRY_LIST, outsideCountryList } from './landlistor';
import { sanitizeTheme } from '../theme/theme';
import type { CountryList } from '../config';
import type { PlaceStatus } from './statusLogic';

// Taiwan (TW) och Grönland (GL) finns i appens länder men inte i FN-listorna. Vatikanstaten (VA) är observatör.
const statuses: Record<string, PlaceStatus> = { SE: 'bor', TW: 'besokt', GL: 'besokt', VA: 'besokt', 'US-ca': 'besokt', NO: 'vill' };
const input = (countryList: CountryList, p: Partial<ViInput> = {}): ViInput => ({
  ...emptyInput('solo', '2026-11-15'),
  countryList,
  statuses: Object.entries(statuses).map(([place_id, status]) => ({ place_id, status, updated_at: '2026-05-01T10:00:00Z' })),
  ...p,
});

describe('landlistor', () => {
  // Utan delade länder (valet landlista.delade.val av). Med valet: se delade.test.ts.
  it('nämnaren: 193, 195 och alla länder i appen', () => {
    expect(countryListTotal('fn', false)).toBe(193);
    expect(countryListTotal('fn-plus', false)).toBe(195);
    expect(countryListTotal('alla', false)).toBe(APP_COUNTRIES.length);
    expect(countryListCodes('fn', false)).toHaveLength(193);
    expect(countryListCodes('fn-plus', false)).toEqual([...new Set([...lists.fn, ...lists.fn_observatorer])].sort());
  });

  it('FN, observatörer, Taiwan och Kosovo: 197 länder', () => {
    expect(countryListTotal('fn-tw-xk', false)).toBe(197);
    expect(countryListCodes('fn-tw-xk', false)).toHaveLength(197);
    expect(countryListCodes('fn-tw-xk', false)).toEqual([...new Set([...lists.fn, ...lists.fn_observatorer, ...lists.fn_plus_tw_xk])].sort());
    expect(['SE', 'VA', 'TW', 'XK', 'GL'].map((c) => countsAsCountry(c, 'fn-tw-xk'))).toEqual([true, true, true, true, false]);
    expect(Object.keys(visitedCountries(input('fn-tw-xk'))).sort()).toEqual(['SE', 'TW', 'VA']);
    expect(sanitizeTheme({ countryList: 'fn-tw-xk' }).countryList).toBe('fn-tw-xk');
  });

  it('förvalet är alla, så att inget ändras för den som inte väljer', () => {
    expect(DEFAULT_COUNTRY_LIST).toBe('alla');
    expect(sanitizeTheme({}).countryList).toBe('alla');
    expect(sanitizeTheme({ countryList: 'fn' }).countryList).toBe('fn');
    expect(sanitizeTheme({ countryList: 'okand' }).countryList).toBe('alla');
  });

  it('vilka koder som räknas i varje lista', () => {
    expect(['SE', 'VA', 'TW', 'GL'].map((c) => countsAsCountry(c, 'fn'))).toEqual([true, false, false, false]);
    expect(['SE', 'VA', 'TW', 'GL'].map((c) => countsAsCountry(c, 'fn-plus'))).toEqual([true, true, false, false]);
    expect(['SE', 'VA', 'TW', 'GL'].map((c) => countsAsCountry(c, 'alla'))).toEqual([true, true, true, true]);
    // Regioner räknas aldrig som länder.
    for (const l of ['fn', 'fn-plus', 'fn-tw-xk', 'alla'] as const) expect(countsAsCountry('US-ca', l)).toBe(false);
  });

  it('märkningen utanför listan gäller bara länder', () => {
    expect(outsideCountryList('TW', 'fn')).toBe(true);
    expect(outsideCountryList('TW', 'alla')).toBe(false);
    expect(outsideCountryList('US-ca', 'fn')).toBe(false);
  });

  it('besökta länder och kontinenter i varje lista', () => {
    expect(Object.keys(visitedCountries(input('fn'))).sort()).toEqual(['SE']);
    expect(Object.keys(visitedCountries(input('fn-plus'))).sort()).toEqual(['SE', 'VA']);
    expect(Object.keys(visitedCountries(input('alla'))).sort()).toEqual(['GL', 'SE', 'TW', 'VA']);
    // Grönland räknas till Nordamerika och Taiwan till Asien, bara när de ingår i listan.
    expect(Object.keys(visitedContinents(input('fn'))).sort()).toEqual(['EU']);
    expect(Object.keys(visitedContinents(input('alla'))).sort()).toEqual(['AS', 'EU', 'NA']);
  });

  it('siffrorna på Jag och Vi: antal och nämnare', () => {
    const off = { splitCountries: false };
    const fn = numbers(input('fn', off), 0);
    expect([fn.lander.length, fn.landerTotalt]).toEqual([1, 193]);
    const plus = numbers(input('fn-plus', off), 0);
    expect([plus.lander.length, plus.landerTotalt]).toEqual([2, 195]);
    const alla = numbers(input('alla', off), 0);
    expect([alla.lander.length, alla.landerTotalt]).toEqual([4, APP_COUNTRIES.length]);
    // Med valet (förvalt) ökar bara nämnaren: inga delar eller GB bland statusarna.
    expect(numbers(input('fn'), 0).landerTotalt).toBe(196);
  });

  it('märken med länder följer listan', () => {
    const value = (l: CountryList) => badgeStates(BADGES, input(l)).find((s) => s.badge.rule === 'countries_visited')?.value;
    expect(value('fn')).toBe(1);
    expect(value('fn-plus')).toBe(2);
    expect(value('alla')).toBe(4);
    const continents = (l: CountryList) => badgeStates(BADGES, input(l)).find((s) => s.badge.rule === 'continents_visited')?.value;
    expect(continents('fn')).toBe(1);
    expect(continents('alla')).toBe(3);
  });

  it('bucketmål av typen antal och checklistan besokta-lander följer listan', () => {
    expect(visitedCount('countries_visited', statuses, 'fn')).toBe(1);
    expect(visitedCount('countries_visited', statuses, 'fn-plus')).toBe(2);
    expect(visitedCount('countries_visited', statuses, 'alla')).toBe(4);
    expect(visitedCount('countries_visited', statuses)).toBe(4);
    expect(visitedCount('continents_visited', statuses, 'fn')).toBe(1);
    const ctx = (countryList: CountryList) => ({ places: [], statuses, name: (id: string) => id, countryList });
    const rows = (l: CountryList) => {
      const v = bucketParts({ type: 'platser', source: 'besokta-lander' }, null, ctx(l));
      return v?.kind === 'rader' ? v.rows.map((r) => r.placeId) : [];
    };
    expect(rows('fn')).toEqual([]);
    expect(rows('fn-plus')).toEqual(['VA']);
    expect(rows('alla').sort()).toEqual(['GL', 'TW', 'VA']);
  });

  it('Wrapped räknar bara länder i listan', () => {
    const trips = [
      { id: 'a', title: 'a', place_id: 'TW', kind: 'resa' as const, status: 'klar' as const, start_date: '2026-03-01', end_date: '2026-03-05', budget: {}, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', title: 'b', place_id: 'NO', kind: 'resa' as const, status: 'klar' as const, start_date: '2026-04-01', end_date: '2026-04-03', budget: {}, created_at: '2026-01-01T00:00:00Z' },
    ];
    expect(wrapped(input('fn', { trips }), 2026)?.countries).toEqual(['NO']);
    expect(wrapped(input('alla', { trips }), 2026)?.countries).toEqual(['NO', 'TW']);
  });
});
