import { describe, expect, it } from 'vitest';
import type { Idea, Place } from './content';
import {
  applyFilter,
  distanceKm,
  formatMinutes,
  ideasHere,
  nearby,
  outingDates,
  pickNext,
  resolvePlace,
  subtreeIds,
  toggleIn,
} from './idagLogic';

// Påhittade platser och idéer, bara för logiken.
const place = (id: string, kind: Place['kind'], parent: string | null, lat: number, lon: number, name = id): Place => ({
  id,
  kind,
  parent_id: parent,
  layer: null,
  name,
  iso2: kind === 'country' ? id : null,
  lat,
  lon,
  airport: null,
  smart_months: null,
  data: {},
});

const places: Place[] = [
  place('XX', 'country', null, 57, 12),
  place('XX-region', 'region', 'XX', 57.5, 12.5),
  place('XX-stad', 'city', 'XX-region', 57.72, 12.94, 'Stad'),
  place('XX-stad-park', 'spot', 'XX-stad', 57.73, 12.95),
  place('XX-granne', 'city', 'XX-region', 57.71, 13.47, 'Granne'),
  place('XX-fjarran', 'city', 'XX', 59.33, 18.07, 'Fjärran'),
];

const idea = (id: string, kind: string, placeId: string | null, extra: Partial<Idea> = {}): Idea => ({
  id,
  place_id: placeId,
  kind,
  title: id,
  body: null,
  duration: null,
  cost_level: null,
  tags: [],
  drive_minutes: null,
  lat: null,
  lon: null,
  ...extra,
});

const ideas: Idea[] = [
  idea('hemma', 'hemma', null),
  idea('svang', 'ut-en-svang', null),
  idea('stan', 'i-stan', 'XX-stad', { cost_level: 'gratis', tags: ['ute', 'gratis'] }),
  idea('park', 'ut-en-svang', 'XX-stad-park', { cost_level: 'billigt', tags: ['ute'] }),
  idea('helg', 'helg', 'XX-stad'),
  idea('granne', 'dagstripp', 'XX-granne', { drive_minutes: 45 }),
  idea('fjarran', 'utflykt', 'XX-fjarran'),
];

describe('vald plats', () => {
  it('känner igen namnet', () => {
    expect(resolvePlace({ name: ' stad ', lat: null, lon: null }, places)?.id).toBe('XX-stad');
  });

  it('väljer närmaste stad eller plats inom 25 km', () => {
    expect(resolvePlace({ name: 'Där jag är', lat: 57.721, lon: 12.941 }, places)?.id).toBe('XX-stad');
    expect(resolvePlace({ name: '', lat: 50, lon: 5 }, places)).toBeNull();
  });

  it('räknar avstånd fågelvägen', () => {
    expect(Math.round(distanceKm({ lat: 57.72, lon: 12.94 }, { lat: 59.33, lon: 18.07 }))).toBe(347);
  });

  it('hittar platser under en plats', () => {
    expect([...subtreeIds(places, 'XX-region')].sort()).toEqual(['XX-granne', 'XX-region', 'XX-stad', 'XX-stad-park']);
  });
});

describe('idéer för platsen', () => {
  const ids = (l: Idea[]) => l.map((i) => i.id).sort();

  it('hemma idag: hemmaidéer, idéer utan plats och platsens idéer', () => {
    expect(ids(ideasHere(ideas, places, 'XX-stad', true, 'idag'))).toEqual(['hemma', 'park', 'stan', 'svang']);
  });

  it('hemmaidéer bara hemma och bara idag, helgidéer bara i helgen', () => {
    expect(ids(ideasHere(ideas, places, 'XX-stad', false, 'idag'))).toEqual(['park', 'stan', 'svang']);
    expect(ids(ideasHere(ideas, places, 'XX-stad', true, 'helg'))).toEqual(['helg', 'park', 'stan', 'svang']);
  });

  it('okänd plats: bara idéer som fungerar överallt', () => {
    expect(ids(ideasHere(ideas, places, null, false, 'idag'))).toEqual(['svang']);
  });

  it('filtrerar på typ, kostnad och taggar', () => {
    const here = ideasHere(ideas, places, 'XX-stad', true, 'idag');
    expect(ids(applyFilter(here, { kinds: ['ut-en-svang'], costs: [], tags: [] }))).toEqual(['park', 'svang']);
    expect(ids(applyFilter(here, { kinds: [], costs: ['gratis', 'billigt'], tags: [] }))).toEqual(['park', 'stan']);
    expect(ids(applyFilter(here, { kinds: [], costs: [], tags: ['ute', 'gratis'] }))).toEqual(['stan']);
    expect(toggleIn(toggleIn([], 'a'), 'a')).toEqual([]);
  });
});

describe('slumpa', () => {
  it('visar alla en gång innan någon kommer igen', () => {
    const pool = ['a', 'b', 'c', 'd'];
    let seen: string[] = [];
    let cur: string | null = null;
    const shown: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = pickNext(pool, seen, cur, () => 0.99);
      seen = r.seen;
      cur = r.id;
      shown.push(r.id!);
    }
    expect([...shown].sort()).toEqual(pool);
  });

  it('samma idé kommer aldrig två gånger i rad', () => {
    const pool = ['a', 'b', 'c'];
    let seen: string[] = [];
    let cur: string | null = null;
    for (let i = 0; i < 50; i++) {
      const r = pickNext(pool, seen, cur);
      expect(r.id).not.toBe(cur);
      seen = r.seen;
      cur = r.id;
    }
  });

  it('klarar en och noll idéer', () => {
    expect(pickNext(['a'], ['a'], 'a').id).toBe('a');
    expect(pickNext([], [], null).id).toBeNull();
  });
});

describe('nära', () => {
  const origin = { lat: 57.72, lon: 12.94 };

  it('tar med idéer och platser inom avståndet, närmast först', () => {
    const near = nearby(origin, 'XX-stad', ideas, places, '1h', 'idag');
    expect(near.map((n) => n.key)).toEqual(['i:stan', 'i:park', 'p:XX-stad-park', 'i:granne', 'p:XX-granne']);
  });

  it('använder drive_minutes bara från idéns egen plats', () => {
    const fromGranne = nearby({ lat: 57.71, lon: 13.47 }, 'XX-granne', ideas, places, '1h', 'idag');
    expect(fromGranne.find((n) => n.key === 'i:granne')?.minutes).toBe(45);
    const fromStad = nearby(origin, 'XX-stad', ideas, places, '1h', 'idag');
    expect(fromStad.find((n) => n.key === 'i:granne')?.minutes).toBeNull();
  });

  it('längre avstånd tar med mer', () => {
    expect(nearby(origin, 'XX-stad', ideas, places, '1h', 'idag').some((n) => n.key === 'i:fjarran')).toBe(false);
    expect(nearby(origin, 'XX-stad', ideas, places, 'helg', 'idag').some((n) => n.key === 'i:fjarran')).toBe(true);
  });

  it('tar inte med idéer som fungerar överallt eller helgidéer på en vardag', () => {
    const keys = nearby(origin, 'XX-stad', ideas, places, 'helg', 'idag').map((n) => n.key);
    expect(keys).not.toContain('i:svang');
    expect(keys).not.toContain('i:helg');
    expect(nearby(origin, 'XX-stad', ideas, places, 'helg', 'helg').map((n) => n.key)).toContain('i:helg');
  });
});

describe('format och datum', () => {
  it('skriver restid', () => {
    expect(formatMinutes(45)).toMatch(/^45\smin$/);
    expect(formatMinutes(75)).toMatch(/^1\s\S+\s15\smin$/);
  });

  it('datum för en utflykt', () => {
    expect(outingDates('idag', '2026-11-13')).toEqual({ start: '2026-11-13', end: '2026-11-13' });
    expect(outingDates('helg', '2026-11-13')).toEqual({ start: '2026-11-14', end: '2026-11-15' });
    expect(outingDates('helg', '2026-11-14')).toEqual({ start: '2026-11-14', end: '2026-11-15' });
    expect(outingDates('helg', '2026-11-15')).toEqual({ start: '2026-11-15', end: '2026-11-15' });
  });
});
