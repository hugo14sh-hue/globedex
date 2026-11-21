// Körning 21: städer, regioner och platser i delade länder. Platsen har landet som parent_id (GB) och ett id
// som börjar med delens id (GB-eng-london hör till GB-eng). Appen räknar ut delen ur id:t (src/lib/delade.ts).
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../content/_texter.en.json';
import sv from '../../content/_texter.json';
import gb from '../../content/GB.json';
import { countedCountryOf, flagCode, parentOf, partOf, sameCountry, shownCountryOf } from './delade';
import { contentCountryOf, countryNameOf, countryOf, descendants, factPlaceIds, placesUnder, type Place } from './content';
import { countryIdFor } from './statusLogic';
import { groupPlaces } from './mapList';
import { placeOptions } from './placeOptions';
import { toEntry, matches, NO_FILTER, filterOptions, fromParams } from './upptack';
import { tripSeasons } from './smartMonth';
import { subtreeIds } from './idagLogic';
import { formatMoney, pricesOf, RATES, rateFor, rowSek } from './prices';
import { registerTexts, setLanguage, type TextFile } from './texter';
import { emptyInput, type ViInput } from '../features/vi/marken';
import { wrapped } from '../features/vi/viLogic';

// Texterna jämförs mot filerna, så att testet inte skriver egna texter.
const textOf = (file: unknown, k: string) => {
  const e = (file as TextFile).texter[k];
  return typeof e === 'string' ? e : (e as Record<string, string>).neutral;
};
const ENGLAND_SV = textOf(sv, 'land.GB-eng');
const ENGLAND_EN = textOf(en, 'land.GB-eng');

const place = (id: string, kind: Place['kind'], parent_id: string | null, name: string, data: Record<string, unknown> = {}): Place =>
  ({ id, kind, parent_id, name, layer: null, iso2: kind === 'country' && /^[A-Z]{2}$/.test(id) ? id : null, lat: null, lon: null, airport: null, smart_months: null, data }) as Place;

// Som i databasen efter importen: delarna är lätta länder under GB, London har GB som parent_id.
const PLACES: Place[] = [
  place('GB', 'country', null, 'Storbritannien', { day_budget_sek: 1500 }),
  place('GB-eng', 'country', 'GB', 'England', { light: true }),
  place('GB-sct', 'country', 'GB', 'Skottland', { light: true }),
  place('GB-eng-london', 'city', 'GB', 'London', { seasons: [{ name: 'Vinter', from: 12, to: 12 }] }),
  place('GB-eng-london-park', 'spot', 'GB-eng-london', 'Park'),
  place('SE', 'country', null, 'Sverige'),
  place('SE-stockholm', 'city', 'SE', 'Stockholm'),
];

afterEach(() => setLanguage('sv'));

describe('delen ur id:t', () => {
  it('GB-eng-london ger GB-eng, GB ger ingen, SE-stockholm ger ingen', () => {
    expect(partOf('GB-eng-london')).toBe('GB-eng');
    expect(partOf('GB')).toBeNull();
    expect(partOf('SE-stockholm')).toBeNull();
    // Delen själv och platser längre ned.
    expect(partOf('GB-eng')).toBeNull();
    expect(partOf('GB-eng-london-park')).toBe('GB-eng');
    // Ett id som bara börjar med delens bokstäver (utan bindestreck) hör inte till delen.
    expect(partOf('GB-england')).toBeNull();
  });

  it('föräldern: delen för en plats direkt under landet, annars parent_id', () => {
    expect(parentOf({ id: 'GB-eng-london', parent_id: 'GB' })).toBe('GB-eng');
    expect(parentOf({ id: 'GB-eng-london-park', parent_id: 'GB-eng-london' })).toBe('GB-eng-london');
    expect(parentOf({ id: 'GB-eng', parent_id: 'GB' })).toBe('GB');
    expect(parentOf({ id: 'SE-stockholm', parent_id: 'SE' })).toBe('SE');
    expect(parentOf({ id: 'GB', parent_id: null })).toBeNull();
  });

  it('landet som visas och landet som räknas', () => {
    expect(shownCountryOf('GB-eng-london')).toBe('GB-eng');
    expect(shownCountryOf('GB-eng')).toBe('GB-eng');
    expect(shownCountryOf('GB')).toBe('GB');
    expect(shownCountryOf('SE-stockholm')).toBe('SE');
    expect(countedCountryOf('GB-eng-london', true)).toBe('GB-eng');
    expect(countedCountryOf('GB-eng-london', false)).toBe('GB');
    expect(countryIdFor('GB-eng-london', true)).toBe('GB-eng');
    expect(countryIdFor('GB-eng-london', false)).toBe('GB');
    expect(countryIdFor('SE-stockholm', true)).toBe('SE');
    expect(sameCountry('GB-eng', 'GB')).toBe(true);
    expect(sameCountry('GB', 'GB-eng')).toBe(true);
    expect(sameCountry('GB-eng', 'GB-sct')).toBe(false);
  });

  it('London får Englands flagga', () => {
    expect(flagCode('GB-eng-london')).toBe('gb-eng');
    expect(flagCode('SE-stockholm')).toBe('se');
  });
});

describe('innehållsfilen GB.json följer regeln', () => {
  it('London har GB som parent_id och ett id under GB-eng', () => {
    const london = gb.places.find((p) => p.id === 'GB-eng-london')!;
    expect(london.parent_id).toBe('GB');
    expect(partOf(london.id)).toBe('GB-eng');
  });
});

describe('delens sida', () => {
  it('med platser: England listar London, Storbritannien listar London via delen', () => {
    expect(placesUnder(PLACES, 'GB-eng').map((p) => p.id)).toEqual(['GB-eng-london']);
    expect(descendants(PLACES, 'GB-eng').map((p) => p.id)).toEqual(['GB-eng-london', 'GB-eng-london-park']);
    expect(placesUnder(PLACES, 'GB').map((p) => p.id)).toEqual(['GB-eng-london']);
    expect(placesUnder(PLACES, 'SE').map((p) => p.id)).toEqual(['SE-stockholm']);
  });

  it('utan platser: Skottland listar inga platser', () => {
    expect(placesUnder(PLACES, 'GB-sct')).toEqual([]);
    expect(descendants(PLACES, 'GB-sct')).toEqual([]);
  });

  it('landets fakta och presenttips visas på varje dels sida, inte på stadens', () => {
    expect(factPlaceIds('GB-eng', ['GB-eng', 'GB-eng-london'])).toEqual(['GB-eng', 'GB-eng-london', 'GB']);
    expect(factPlaceIds('GB-sct', ['GB-sct'])).toEqual(['GB-sct', 'GB']);
    expect(factPlaceIds('GB-eng-london', ['GB-eng-london'])).toEqual(['GB-eng-london']);
    expect(factPlaceIds('SE', ['SE', 'SE-stockholm'])).toEqual(['SE', 'SE-stockholm']);
    // GB:s inresefakta och presenttips ligger på landet i filen.
    const ids = factPlaceIds('GB-eng', ['GB-eng', 'GB-eng-london']);
    expect(gb.facts.filter((f) => ids.includes(f.place_id)).map((f) => f.id)).toContain('GB-fakta-inresa');
    expect(gb.gifts.every((g) => ids.includes(g.place_id))).toBe(true);
  });

  it('landet som London ligger i är England, innehållet faller tillbaka på Storbritannien', () => {
    expect(countryOf(PLACES, 'GB-eng-london')?.id).toBe('GB-eng');
    expect(countryOf(PLACES, 'GB-eng-london-park')?.id).toBe('GB-eng');
    expect(contentCountryOf(PLACES, 'GB-eng-london')?.id).toBe('GB');
    expect(contentCountryOf(PLACES, 'SE-stockholm')?.id).toBe('SE');
    // Finns delen inte bland platserna ligger London i landet.
    expect(countryOf(PLACES.filter((p) => p.id !== 'GB-eng'), 'GB-eng-london')?.id).toBe('GB');
  });
});

describe('landsnamnet för London', () => {
  it('på svenska', () => {
    expect(countryNameOf(PLACES, 'GB-eng-london')).toBe(ENGLAND_SV);
    expect(placeOptions(PLACES, ['GB-eng-london']).map((o) => o.countryName)).toEqual([ENGLAND_SV]);
    expect(countryNameOf(PLACES, 'SE-stockholm')).toBe('Sverige');
    expect(countryNameOf(PLACES, 'GB-eng')).toBeNull();
  });

  it('på engelska', () => {
    registerTexts('en', en as unknown as TextFile);
    setLanguage('en');
    expect(countryNameOf(PLACES, 'GB-eng-london')).toBe(ENGLAND_EN);
    expect(placeOptions(PLACES, ['GB-eng-london']).map((o) => o.countryName)).toEqual([ENGLAND_EN]);
  });
});

describe('listor, Upptäck, Idag, resor och Wrapped', () => {
  it('listan Platser: London under England med valet på, under Storbritannien med valet av', () => {
    const name = (id: string) => id;
    const on = groupPlaces({ 'GB-eng-london': 'besokt' }, [], name, () => 'Europa', 'sv-SE', () => 'city', true);
    expect(on[0].countries.map((c) => [c.id, c.children.map((x) => x.id)])).toEqual([['GB-eng', ['GB-eng-london']]]);
    const off = groupPlaces({ 'GB-eng-london': 'besokt' }, [], name, () => 'Europa', 'sv-SE', () => 'city', false);
    expect(off[0].countries.map((c) => [c.id, c.children.map((x) => x.id)])).toEqual([['GB', ['GB-eng-london']]]);
  });

  it('Upptäck: London hör till England, också i filtren', () => {
    const e = toEntry(place('GB-eng-london', 'city', 'GB', 'London', { climate: 'tempererat', tags: ['stad'] }))!;
    expect(e.country).toBe('GB-eng');
    expect(matches(e, { ...NO_FILTER, continent: 'EU' })).toBe(true);
    expect(matches(e, { ...NO_FILTER, country: 'GB-eng' })).toBe(true);
    expect(filterOptions([e])).toEqual({ continents: ['EU'], countries: ['GB-eng'] });
    expect(fromParams(new URLSearchParams('land=GB-eng'), { climates: [], tags: [] }).filter.country).toBe('GB-eng');
  });

  it('Idag: Londons idéer ligger under England', () => {
    expect([...subtreeIds(PLACES, 'GB-eng')].sort()).toEqual(['GB-eng', 'GB-eng-london', 'GB-eng-london-park']);
    expect(subtreeIds(PLACES, 'GB').has('GB-eng-london')).toBe(true);
  });

  it('resor: säsongerna i London visas för en resa till England och till Storbritannien', () => {
    expect(tripSeasons(PLACES as never, 'GB-eng', [11]).map((s) => s.city)).toEqual(['London']);
    expect(tripSeasons(PLACES as never, 'GB', [11]).map((s) => s.city)).toEqual(['London']);
    expect(tripSeasons(PLACES as never, 'GB-sct', [11])).toEqual([]);
  });

  it('Wrapped: en resa till London räknas till England med valet på och till Storbritannien med valet av', () => {
    const trips = [{ id: 't1', kind: 'resa', place_id: 'GB-eng-london', start_date: '2026-03-01', end_date: '2026-03-05', created_at: '2026-01-01' }] as ViInput['trips'];
    const x = (splitCountries: boolean): ViInput => ({ ...emptyInput('solo', '2026-11-18'), countryList: 'fn', splitCountries, trips });
    expect(wrapped(x(true), 2026)?.countries).toEqual(['GB-eng']);
    expect(wrapped(x(false), 2026)?.countries).toEqual(['GB']);
  });
});

describe('priserna i London står i pund', () => {
  it('kursen för GBP finns i _valutor.json och räknas om som DKK och PLN', () => {
    const london = gb.places.find((p) => p.id === 'GB-eng-london')!;
    const prices = pricesOf(london.data)!;
    expect(prices.currency).toBe('GBP');
    const rate = rateFor('GBP');
    expect(rate).toBe(RATES.sek_per.GBP);
    expect(rate).toBeGreaterThan(0);
    const row = prices.rows.find((r) => r.typical != null)!;
    expect(rowSek(row, 'GBP')).toBe(rowSek(row, 'GBP', { ...RATES, sek_per: { GBP: rate! } }));
    expect(rowSek(row, 'GBP')).not.toBeNull();
    for (const c of ['DKK', 'PLN', 'GBP']) expect(rateFor(c)).not.toBeNull();
    // Beloppet i pund formateras efter appens språk, som DKK och PLN (sv-SE: 3,10 GBP, en: £3.10).
    expect(formatMoney(3.1, 'GBP')).toBe(new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(3.1));
    expect(formatMoney(3.1, 'GBP')).toContain('3,10');
  });
});
