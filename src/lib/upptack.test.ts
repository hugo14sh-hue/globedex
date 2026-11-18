import { describe, expect, it } from 'vitest';
import discover from '../../content/_upptack.json';
import type { Place } from './content';
import {
  altHeadingKey,
  alternativeRows,
  applyFilter,
  bestMonths,
  discoverEntries,
  toEntry,
  filterCount,
  filterOptions,
  fromParams,
  indexLine,
  isLight,
  monthList,
  nextCount,
  PAGE_SIZE,
  NO_FILTER,
  showsAltLink,
  sortEntries,
  toParams,
  visibleEntries,
  type DiscoverFilter,
} from './upptack';

// Påhittade platser med platshållartext. Landskoderna är riktiga så att världsdelen går att slå upp.
const light = (id: string, d: Partial<Place['data']> = {}, name = id): Place => ({
  id,
  kind: 'city',
  parent_id: id.slice(0, 2),
  layer: null,
  name,
  iso2: null,
  lat: 1,
  lon: 2,
  airport: null,
  smart_months: null,
  data: { light: true, level: 2, climate: 'kust', best_months: [5, 6], tags: ['mat'], gem: false, why: 'w', ...d },
});
const city = (id: string, level: number, smart: number[], d: Partial<Place['data']> = {}, name = id): Place => ({
  ...light(id, {}, name),
  smart_months: smart,
  data: { prices: { currency: 'EUR', level, checked: '2026-01-01', rows: [], sources: ['https://example.org'] }, ...d },
});

const PLACES: Place[] = [
  light('BA-a', { level: 1, climate: 'kontinentalt', tags: ['mat', 'historia'], gem: true, best_months: [4, 5, 9] }, 'Bravo'),
  light('PT-b', { level: 2, climate: 'medelhav', tags: ['strand', 'mat'], best_months: [6, 7] }, 'Alfa'),
  light('FR-c', { level: 4, climate: 'medelhav', tags: ['strand'], best_months: [5] }, 'Charlie'),
  city('MC-d', 5, [2, 2, 3, 4, 3, 3, 3, 3, 5, 4, 2, 2], {
    climate: 'medelhav',
    tags: ['glamour'],
    alternatives: [
      { place: 'FR-c', why: 'w1', cheaper: true },
      { place: 'XX-saknas', why: 'w2', cheaper: true },
    ],
  }, 'Delta'),
  // Stad utan klimat och taggar: hör inte till Upptäck.
  city('NL-e', 4, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
  { ...light('PL', {}), kind: 'country', parent_id: null, data: { light: true } },
];
const ENTRIES = discoverEntries(PLACES);
const ids = (f: Partial<DiscoverFilter>, statuses = {}) => applyFilter(ENTRIES, { ...NO_FILTER, ...f }, statuses).map((e) => e.id).sort();

describe('Upptäck: platserna', () => {
  it('lätta platser och befintliga städer med klimat eller taggar, inga länder', () => {
    expect(ENTRIES.map((e) => e.id).sort()).toEqual(['BA-a', 'FR-c', 'MC-d', 'PT-b']);
    expect(isLight(PLACES[0])).toBe(true);
    expect(isLight(PLACES[3])).toBe(false);
  });

  it('bästa månader för befintliga städer: där smart_months är 4 eller 5', () => {
    expect(bestMonths([2, 2, 3, 4, 3, 3, 3, 3, 5, 4, 2, 2])).toEqual([4, 9, 10]);
    expect(bestMonths(null)).toEqual([]);
    expect(ENTRIES.find((e) => e.id === 'MC-d')).toMatchObject({ level: 5, months: [4, 9, 10], climate: 'medelhav', why: null, light: false });
  });

  it('befintliga städer visar why när den finns (existing i _upptack.json)', () => {
    const p = { ...PLACES[3], data: { ...PLACES[3].data, why: 'En mening.' } };
    expect(toEntry(p)?.why).toBe('En mening.');
  });

  it('lätta platser tar nivå och månader ur data', () => {
    expect(ENTRIES.find((e) => e.id === 'BA-a')).toMatchObject({ level: 1, months: [4, 5, 9], gem: true, why: 'w', light: true });
  });
});

describe('Upptäck: varje filter för sig', () => {
  it('inget filter visar allt', () => {
    expect(ids({})).toEqual(['BA-a', 'FR-c', 'MC-d', 'PT-b']);
    expect(filterCount(NO_FILTER)).toBe(0);
  });
  it('prisnivå, flera kan väljas', () => {
    expect(ids({ prices: [1] })).toEqual(['BA-a']);
    expect(ids({ prices: [1, 5] })).toEqual(['BA-a', 'MC-d']);
  });
  it('månad: platsen matchar när månaden finns bland bästa månader', () => {
    expect(ids({ month: 5 })).toEqual(['BA-a', 'FR-c']);
    expect(ids({ month: 9 })).toEqual(['BA-a', 'MC-d']);
    expect(ids({ month: 1 })).toEqual([]);
  });
  it('klimat', () => {
    expect(ids({ climates: ['kontinentalt'] })).toEqual(['BA-a']);
    expect(ids({ climates: ['medelhav'] })).toEqual(['FR-c', 'MC-d', 'PT-b']);
  });
  it('typ: platsen ska ha alla valda taggar', () => {
    expect(ids({ tags: ['mat'] })).toEqual(['BA-a', 'PT-b']);
    expect(ids({ tags: ['mat', 'strand'] })).toEqual(['PT-b']);
    expect(ids({ tags: ['glamour', 'strand'] })).toEqual([]);
  });
  it('världsdel och land', () => {
    expect(ids({ continent: 'EU' })).toEqual(['BA-a', 'FR-c', 'MC-d', 'PT-b']);
    expect(ids({ continent: 'AS' })).toEqual([]);
    expect(ids({ country: 'PT' })).toEqual(['PT-b']);
  });
  it('bara smultronställen', () => {
    expect(ids({ gem: true })).toEqual(['BA-a']);
  });
  it('dölj besökta: besökt, bor och har bott döljs, vill åka och planerad syns', () => {
    const st = { 'BA-a': 'besokt', 'PT-b': 'bor', 'FR-c': 'bott', 'MC-d': 'vill' } as const;
    expect(ids({ unvisited: true }, st)).toEqual(['MC-d']);
    expect(ids({ unvisited: true }, { 'BA-a': 'planerad' })).toEqual(['BA-a', 'FR-c', 'MC-d', 'PT-b']);
  });
  it('världsdelar och länder i filtren: bara de som har minst en plats', () => {
    expect(filterOptions(ENTRIES)).toEqual({ continents: ['EU'], countries: ['BA', 'FR', 'MC', 'PT'] });
  });
});

describe('Upptäck: två filter ihop', () => {
  it('prisnivå och månad', () => {
    expect(ids({ prices: [1, 2], month: 6 })).toEqual(['PT-b']);
    expect(ids({ prices: [4, 5], month: 5 })).toEqual(['FR-c']);
  });
  it('klimat och typ', () => {
    expect(ids({ climates: ['medelhav'], tags: ['strand'] })).toEqual(['FR-c', 'PT-b']);
  });
});

describe('Upptäck: sortering', () => {
  it('förvalet: lägst prisnivå först, sedan namn', () => {
    const tie = discoverEntries([light('PT-x', { level: 2 }, 'Beta'), light('PT-y', { level: 2 }, 'Alfa'), light('PT-z', { level: 1 }, 'Zulu')]);
    expect(sortEntries(tie, 'pris', 'sv').map((e) => e.name)).toEqual(['Zulu', 'Alfa', 'Beta']);
    expect(sortEntries(ENTRIES, 'pris', 'sv').map((e) => e.id)).toEqual(['BA-a', 'PT-b', 'FR-c', 'MC-d']);
  });
  it('namn', () => {
    expect(sortEntries(ENTRIES, 'namn', 'sv').map((e) => e.name)).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta']);
  });
});

describe('Upptäck: filtren i adressen', () => {
  const allowed = { tags: ['mat', 'strand'], climates: ['kust', 'medelhav'] };
  it('fram och tillbaka', () => {
    const f: DiscoverFilter = { prices: [2, 1], month: 6, climates: ['kust'], tags: ['mat', 'strand'], continent: 'EU', country: 'PT', gem: true, unvisited: true };
    const p = toParams(f, 'namn');
    expect(p).toEqual({ pris: '1,2', manad: '6', klimat: 'kust', typ: 'mat,strand', kontinent: 'EU', land: 'PT', smultron: '1', obesokt: '1', sortera: 'namn' });
    expect(fromParams(new URLSearchParams(p), allowed)).toEqual({ filter: { ...f, prices: [1, 2] }, sort: 'namn' });
  });
  it('inget valt ger en ren adress, och okända värden hoppas över', () => {
    expect(toParams(NO_FILTER, 'pris')).toEqual({});
    expect(fromParams(new URLSearchParams('pris=0,3,9&manad=13&klimat=tropiskt&typ=mat,okand&land=x'), allowed)).toEqual({
      filter: { ...NO_FILTER, prices: [3], tags: ['mat'] },
      sort: 'pris',
    });
  });
});

describe('Upptäck: alternativ', () => {
  it('rubriken: billigare när minst ett alternativ är billigare, annars liknande', () => {
    expect(altHeadingKey([{ cheaper: false }, { cheaper: true }])).toBe('upptack.alt.rubrik');
    expect(altHeadingKey([{ cheaper: false }])).toBe('upptack.alt.rubrik.lika');
  });
  it('raderna får namn, land och prisnivå ur places, och saknade alternativ hoppas över', () => {
    expect(alternativeRows(PLACES[3], PLACES)).toEqual([{ id: 'FR-c', name: 'Charlie', country: 'FR', level: 4, why: 'w1' }]);
  });
  it('länken till alternativen visas på kort med nivå 4 eller 5 som har alternativ', () => {
    const e = ENTRIES.find((x) => x.id === 'MC-d')!;
    expect(showsAltLink(e)).toBe(true);
    expect(showsAltLink({ ...e, level: 3 })).toBe(false);
    expect(showsAltLink({ ...e, alternatives: [] })).toBe(false);
  });
});

describe('Upptäck: resten av världen (Körning 18)', () => {
  const SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  it('källraden: Eurostat utan basis, Världsbanken med basis icp', () => {
    expect(indexLine({ pli: 59, pli_year: 2025 }, 'Bosnien')).toEqual({ key: 'upptack.index', values: { plats: 'Bosnien', antal: 59, ar: 2025 } });
    expect(indexLine({ basis: 'icp', pli: 95.6, pli_year: 2021 }, 'Singapore')).toEqual({
      key: 'upptack.index.varlden',
      values: { plats: 'Singapore', antal: 95.6, ar: 2021 },
    });
    expect(indexLine({ basis: 'icp' }, 'Singapore')).toBeNull();
  });

  it('månader över årsskiftet står i filens ordning och matchar månadsfiltret', () => {
    const e = discoverEntries([light('TH-a', { best_months: [11, 12, 1, 2] })])[0];
    expect(e.months).toEqual([11, 12, 1, 2]);
    expect(monthList(e.months, SHORT)).toBe('nov, dec, jan, feb');
    for (const m of [11, 12, 1, 2]) expect(applyFilter([e], { ...NO_FILTER, month: m })).toHaveLength(1);
    for (const m of [3, 10]) expect(applyFilter([e], { ...NO_FILTER, month: m })).toHaveLength(0);
  });

  it('de första 30 korten, och 30 till per laddning tills listan är slut', () => {
    const list = Array.from({ length: 140 }, (_, i) => i);
    expect(PAGE_SIZE).toBe(30);
    expect(visibleEntries(list, PAGE_SIZE)).toEqual(list.slice(0, 30));
    const steps = [PAGE_SIZE];
    while (steps[steps.length - 1] < list.length) steps.push(nextCount(steps[steps.length - 1], list.length));
    expect(steps).toEqual([30, 60, 90, 120, 140]);
    expect(visibleEntries(list, 140)).toHaveLength(140);
    // Kortare lista än en sida: alla visas.
    expect(visibleEntries([1, 2], PAGE_SIZE)).toEqual([1, 2]);
  });

  it('världsdelarna i filtret: alla sex bebodda världsdelar när platserna finns där', () => {
    const e = discoverEntries(['SE-a', 'TH-a', 'ZA-a', 'US-a', 'BR-a', 'AU-a'].map((id) => light(id)));
    expect(filterOptions(e).continents).toEqual(['AF', 'AS', 'EU', 'NA', 'OC', 'SA']);
  });

  it('den riktiga filen: platser i alla sex bebodda världsdelar, och de nya klimaten och taggarna finns', () => {
    const e = discoverEntries(discover.places.map((p) => light(p.id, { best_months: p.best_months })));
    expect(filterOptions(e).continents).toEqual(['AF', 'AS', 'EU', 'NA', 'OC', 'SA']);
    expect(filterOptions(e).countries.length).toBeGreaterThan(20);
    expect(discover.climates).toEqual(expect.arrayContaining(['tropiskt', 'subtropiskt', 'oken']));
    expect(discover.tags).toEqual(expect.arrayContaining(['djurliv', 'dykning', 'tempel', 'oar']));
  });
});
