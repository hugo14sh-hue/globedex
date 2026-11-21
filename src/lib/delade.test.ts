import { describe, expect, it } from 'vitest';
import lists from '../../content/_landlistor.json';
import {
  continentOf,
  DEFAULT_SPLIT,
  flagCode,
  isCountryId,
  isoOf,
  showsStatusPicker,
  shownStatuses,
  SPLIT,
  splitParts,
  splitGeo,
  splitSuggestion,
  statusShown,
  withSplit,
} from './delade';
import { SPLIT_GEO } from './deladeGeo';
import { APP_COUNTRIES, countryListCodes, countryListTotal, countsAsCountry, outsideCountryList } from './landlistor';
import { countryIdFor, type PlaceStatus } from './statusLogic';
import { sanitizeTheme } from '../theme/theme';
import { DEFAULT_THEME, type CountryList } from '../config';
import { emptyInput, visitedContinents, visitedCountries, type ViInput } from '../features/vi/marken';
import { numbers, wrapped } from '../features/vi/viLogic';
import { bucketParts, visitedCount } from './bucketParts';
import { groupPlaces } from './mapList';
import { countryOptions, focusBounds, parseFocus } from './mapFocus';
import { viewStatuses, type StatusRow } from './togetherLogic';

const PARTS = ['GB-eng', 'GB-sct', 'GB-wls', 'GB-nir'];
const LISTS: CountryList[] = ['fn', 'fn-plus', 'fn-tw-xk', 'alla'];

const vi = (statuses: Record<string, PlaceStatus>, countryList: CountryList, splitCountries: boolean, p: Partial<ViInput> = {}): ViInput => ({
  ...emptyInput('solo', '2026-11-18'),
  countryList,
  splitCountries,
  statuses: Object.entries(statuses).map(([place_id, status]) => ({ place_id, status, updated_at: '2026-05-01T10:00:00Z' })),
  ...p,
});

describe('delade länder: fältet i _landlistor.json', () => {
  it('GB delas i England, Skottland, Wales och Nordirland', () => {
    expect(SPLIT).toEqual({ GB: PARTS });
    expect(lists.delade).toEqual({ GB: PARTS });
  });

  it('varje del har yta, mittpunkt och utsnitt (src/lib/deladeGeo.ts)', () => {
    expect(Object.keys(SPLIT_GEO).sort()).toEqual([...PARTS].sort());
    for (const p of PARTS) expect(parseFocus(p)).toEqual({ kind: 'country', iso: p });
    expect(focusBounds('GB-sct')).toEqual(SPLIT_GEO['GB-sct'].box);
  });
});

describe('totalerna för de fyra listorna', () => {
  it('med valet på ökar varje lista där GB ingår med tre', () => {
    expect(countryListTotal('fn', true)).toBe(196);
    expect(countryListTotal('fn-plus', true)).toBe(198);
    expect(countryListTotal('fn-tw-xk', true)).toBe(200);
    expect(countryListTotal('alla', true)).toBe(240);
    expect(APP_COUNTRIES.length + 3).toBe(240);
  });

  it('med valet av är totalerna som förut', () => {
    expect(countryListTotal('fn', false)).toBe(193);
    expect(countryListTotal('fn-plus', false)).toBe(195);
    expect(countryListTotal('fn-tw-xk', false)).toBe(197);
    expect(countryListTotal('alla', false)).toBe(237);
  });

  it('listorna innehåller antingen GB eller delarna, aldrig båda', () => {
    for (const l of LISTS) {
      const on = countryListCodes(l, true);
      const off = countryListCodes(l, false);
      expect(on).not.toContain('GB');
      expect(PARTS.every((p) => on.includes(p))).toBe(true);
      expect(off).toContain('GB');
      expect(PARTS.some((p) => off.includes(p))).toBe(false);
      expect(new Set(on).size).toBe(on.length);
    }
  });

  it('förvalet är på', () => {
    expect(DEFAULT_SPLIT).toBe(true);
    expect(DEFAULT_THEME.splitCountries).toBe(true);
    expect(countryListTotal('fn')).toBe(196);
  });
});

describe('GB och delarna räknas aldrig samtidigt', () => {
  it('countsAsCountry', () => {
    for (const l of LISTS) {
      expect(countsAsCountry('GB', l, true)).toBe(false);
      expect(countsAsCountry('GB', l, false)).toBe(true);
      for (const p of PARTS) {
        expect(countsAsCountry(p, l, true)).toBe(true);
        expect(countsAsCountry(p, l, false)).toBe(false);
      }
    }
    // Städer i landet räknas aldrig som länder.
    expect(countsAsCountry('GB-london', 'alla', true)).toBe(false);
  });

  it('besökta länder, kontinenter och siffror med både GB och delar markerade', () => {
    const s: Record<string, PlaceStatus> = { GB: 'besokt', 'GB-sct': 'besokt', 'GB-wls': 'bor', SE: 'bor' };
    for (const l of LISTS) {
      expect(Object.keys(visitedCountries(vi(s, l, true))).sort()).toEqual(['GB-sct', 'GB-wls', 'SE']);
      expect(Object.keys(visitedCountries(vi(s, l, false))).sort()).toEqual(['GB', 'SE']);
      // Delarna ligger i Europa, som GB.
      expect(Object.keys(visitedContinents(vi(s, l, true)))).toEqual(['EU']);
    }
    expect(numbers(vi(s, 'fn', true), 0).lander).toHaveLength(3);
    expect(numbers(vi(s, 'fn', false), 0).lander).toHaveLength(2);
    expect(visitedCount('countries_visited', s, 'fn', true)).toBe(3);
    expect(visitedCount('countries_visited', s, 'fn', false)).toBe(2);
  });

  it('Vi i alla lägen: tillsammans, någon av oss, jag och den andra', () => {
    const rows: StatusRow[] = [
      { user_id: 'a', place_id: 'GB', status: 'besokt', together_group: null, updated_at: null },
      { user_id: 'a', place_id: 'GB-eng', status: 'besokt', together_group: 'g', updated_at: null },
      { user_id: 'b', place_id: 'GB-eng', status: 'besokt', together_group: 'g', updated_at: null },
      { user_id: 'b', place_id: 'GB-sct', status: 'besokt', together_group: null, updated_at: null },
    ];
    for (const view of ['tillsammans', 'nagon', 'jag', 'b']) {
      const x = { ...vi({}, 'fn', true), statuses: viewStatuses(view, rows, 'a', ['a', 'b'], 'g') };
      const counted = Object.keys(visitedCountries(x));
      expect(counted).not.toContain('GB');
      const y = { ...x, splitCountries: false };
      expect(Object.keys(visitedCountries(y)).some((c) => PARTS.includes(c))).toBe(false);
    }
  });

  it('märken, bucketmål och Wrapped', () => {
    const s: Record<string, PlaceStatus> = { GB: 'besokt', 'GB-eng': 'besokt' };
    const ctx = (split: boolean) => ({ places: [], statuses: s, name: (id: string) => id, countryList: 'alla' as const, splitCountries: split });
    const ids = (split: boolean) => {
      const v = bucketParts({ type: 'platser', source: 'besokta-lander' }, [], ctx(split));
      return v?.kind === 'rader' ? v.rows.map((r) => r.placeId) : [];
    };
    expect(ids(true)).toEqual(['GB-eng']);
    expect(ids(false)).toEqual(['GB']);
    const trips = [
      { id: 't1', kind: 'resa', place_id: 'GB-eng', start_date: '2026-03-01', end_date: '2026-03-05', created_at: '2026-01-01' },
      { id: 't2', kind: 'resa', place_id: 'GB', start_date: '2026-04-01', end_date: '2026-04-03', created_at: '2026-01-01' },
    ] as ViInput['trips'];
    expect(wrapped(vi({}, 'fn', true, { trips }), 2026)?.countries).toEqual(['GB-eng']);
    expect(wrapped(vi({}, 'fn', false, { trips }), 2026)?.countries).toEqual(['GB']);
  });
});

describe('vad som visas med valet', () => {
  it('statusen på GB döljs med valet på och delarnas med valet av, raderna finns kvar', () => {
    const s = { GB: 'besokt', 'GB-eng': 'vill', 'GB-london': 'vill', SE: 'bor' };
    expect(shownStatuses(s, true)).toEqual({ 'GB-eng': 'vill', 'GB-london': 'vill', SE: 'bor' });
    expect(shownStatuses(s, false)).toEqual({ GB: 'besokt', 'GB-london': 'vill', SE: 'bor' });
    expect(s).toHaveProperty('GB');
    expect(statusShown('SE', true) && statusShown('SE', false)).toBe(true);
  });

  it('landssidan för GB: statusväljaren döljs med valet på och visas med valet av, delarna visas i stället', () => {
    expect(showsStatusPicker('GB', true)).toBe(false);
    expect(showsStatusPicker('GB', false)).toBe(true);
    expect(splitParts('GB')).toEqual(['GB-eng', 'GB-sct', 'GB-wls', 'GB-nir']);
    for (const id of ['GB-eng', 'GB-nir', 'GB-london', 'SE']) {
      expect(showsStatusPicker(id, true)).toBe(true);
      expect(showsStatusPicker(id, false)).toBe(true);
    }
  });

  it('listan Platser: delarna är egna länder i Europa', () => {
    const g = groupPlaces({ 'GB-eng': 'besokt', 'GB-sct': 'vill' }, [], (id) => id, () => 'Europa', 'sv-SE');
    expect(g).toHaveLength(1);
    expect(g[0].code).toBe('EU');
    expect(g[0].countries.map((c) => [c.id, c.key, c.children.length])).toEqual([
      ['GB-eng', 'besokt', 0],
      ['GB-sct', 'vill', 0],
    ]);
  });

  it('fokusval och sök: delarna i stället för GB', () => {
    const on = withSplit(APP_COUNTRIES, true);
    expect(on).not.toContain('GB');
    expect(on).toEqual(expect.arrayContaining(PARTS));
    expect(withSplit(APP_COUNTRIES, false)).toEqual([...APP_COUNTRIES]);
    const names: Record<string, string> = { 'GB-sct': 'Skottland', 'GB-eng': 'England' };
    expect(countryOptions(on, (iso) => names[iso] ?? iso, 'sv-SE', 'skott').map((o) => o.value)).toEqual(['GB-sct']);
  });

  it('delarna är länder, med GB:s världsdel och egna flaggor utom Nordirland', () => {
    expect(PARTS.every(isCountryId)).toBe(true);
    expect(isCountryId('GB-london')).toBe(false);
    expect(PARTS.map(continentOf)).toEqual(['EU', 'EU', 'EU', 'EU']);
    expect(PARTS.map(flagCode)).toEqual(['gb-eng', 'gb-sct', 'gb-wls', 'gb']);
    expect(flagCode('GB')).toBe('gb');
    expect(flagCode('SE-skane')).toBe('se');
    expect(PARTS.map(isoOf)).toEqual(['GB', 'GB', 'GB', 'GB']);
    expect(countryIdFor('GB-eng', true)).toBe('GB-eng');
    expect(countryIdFor('GB-eng', false)).toBe('GB-eng');
    expect(countryIdFor('GB-london', true)).toBe('GB');
  });

  it('märkningen utanför listan', () => {
    expect(outsideCountryList('GB-eng', 'fn', false)).toBe(true);
    expect(outsideCountryList('GB-eng', 'fn', true)).toBe(false);
    expect(outsideCountryList('GB', 'fn', true)).toBe(true);
  });

  it('kartan: delarnas ytor ersätter GB:s med valet på', () => {
    const lander = { features: [{ properties: { iso: 'GB' } }, { properties: { iso: 'SE' } }] };
    const parts = { features: PARTS.map((iso) => ({ properties: { iso } })) };
    const iso = (split: boolean, p = parts) => splitGeo(lander, p, split).features.map((f) => f.properties.iso);
    expect(iso(true)).toEqual(['SE', ...PARTS]);
    expect(iso(false)).toEqual(['GB', 'SE']);
    // Gick delarnas fil inte att hämta ritas GB som helhet.
    expect(splitGeo(lander, null, true).features.map((f) => f.properties?.iso)).toEqual(['GB', 'SE']);
  });
});

describe('förvalet för befintliga användare', () => {
  it('inställningar utan valet (sparade före Körning 19) får valet på', () => {
    expect(sanitizeTheme({ countryList: 'fn' }).splitCountries).toBe(true);
    expect(sanitizeTheme({}).splitCountries).toBe(true);
    expect(sanitizeTheme(null).splitCountries).toBe(true);
    expect(sanitizeTheme({ splitCountries: 'nej' }).splitCountries).toBe(true);
  });

  it('ett gjort val behålls', () => {
    expect(sanitizeTheme({ splitCountries: false }).splitCountries).toBe(false);
    expect(sanitizeTheme({ splitCountries: true }).splitCountries).toBe(true);
  });
});

describe('förslaget från GB:s gamla status (karta.delade.flytta)', () => {
  it('varje del föreslår GB:s status tills någon del har fått en status', () => {
    const s: Record<string, PlaceStatus> = { GB: 'besokt' };
    for (const p of PARTS) expect(splitSuggestion(p, s, true)).toBe('besokt');
    expect(splitSuggestion('GB-sct', { GB: 'bor' }, true)).toBe('bor');
    // En del har fått status: inga fler förslag, inte heller för de andra delarna.
    const after: Record<string, PlaceStatus> = { GB: 'besokt', 'GB-eng': 'vill' };
    for (const p of PARTS) expect(splitSuggestion(p, after, true)).toBeNull();
  });

  it('inget förslag med valet av, utan status på GB eller för andra platser', () => {
    expect(splitSuggestion('GB-eng', { GB: 'besokt' }, false)).toBeNull();
    expect(splitSuggestion('GB-eng', {}, true)).toBeNull();
    expect(splitSuggestion('GB', { GB: 'besokt' }, true)).toBeNull();
    expect(splitSuggestion('SE-skane', { SE: 'bor' }, true)).toBeNull();
  });
});
