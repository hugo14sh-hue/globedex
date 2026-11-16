import { describe, expect, it } from 'vitest';
import { currentMonth, eventsInMonth, hasMonthNotes, hasSeasons, monthsBetween, seasonAriaKey, tripSeasons, seasonCovers, seasonsInMonth, seasonsInMonths, swipedMonth } from './smartMonth';

// Påhittade händelser för logiken, inget innehåll.
const ev = (name: string, start: string, end: string) => ({ name, start, end, text: 't', source: 'https://example.org' });

describe('Smart månad', () => {
  const list = [ev('b', '2027-06-04', '2027-06-06'), ev('a', '2027-05-30', '2027-06-02'), ev('c', '2027-07-01', '2027-07-01'), ev('gammal', '2026-06-01', '2026-06-02')];

  it('visar händelser som börjar eller slutar i månaden', () => {
    expect(eventsInMonth(list, 5, '2026-11-15').map((e) => e.name)).toEqual(['a', 'b']);
    expect(eventsInMonth(list, 4, '2026-11-15').map((e) => e.name)).toEqual(['a']);
    expect(eventsInMonth(list, 6, '2026-11-15').map((e) => e.name)).toEqual(['c']);
    expect(eventsInMonth(list, 0, '2026-11-15')).toEqual([]);
  });

  it('visar inte händelser som har passerat', () => {
    expect(eventsInMonth(list, 5, '2027-06-03').map((e) => e.name)).toEqual(['b']);
    expect(eventsInMonth(list, 5, '2027-06-06').map((e) => e.name)).toEqual(['b']);
    expect(eventsInMonth(list, 5, '2027-06-07')).toEqual([]);
  });

  it('klarar att events saknas', () => {
    expect(eventsInMonth(undefined, 5, '2026-11-15')).toEqual([]);
  });

  it('kräver tolv texter', () => {
    expect(hasMonthNotes(Array(12).fill('x'))).toBe(true);
    expect(hasMonthNotes(Array(11).fill('x'))).toBe(false);
    expect(hasMonthNotes(undefined)).toBe(false);
  });

  it('väljer innevarande månad', () => {
    expect(currentMonth('2026-11-15')).toBe(10);
    expect(currentMonth('2027-01-01')).toBe(0);
  });
});

describe('Smart månad: svep', () => {
  it('svep åt vänster ger nästa månad, åt höger föregående', () => {
    expect(swipedMonth(5, -60, 5)).toBe(6);
    expect(swipedMonth(5, 60, -5)).toBe(4);
  });
  it('korta och lodräta svep byter inte månad', () => {
    expect(swipedMonth(5, -20, 0)).toBe(5);
    expect(swipedMonth(5, -60, 80)).toBe(5);
  });
  it('stannar vid januari och december', () => {
    expect(swipedMonth(0, 80, 0)).toBe(0);
    expect(swipedMonth(11, -80, 0)).toBe(11);
  });
});

describe('Säsonger', () => {
  // Påhittade säsonger för logiken, inget innehåll.
  const sa = (name: string, from: number, to: number) => ({ name, from, to });
  const list = [sa('sommar', 4, 8), sa('vinter', 11, 3), sa('april', 4, 4)];

  it('säsong över årsskiftet pågår i båda ändarna och däremellan', () => {
    for (const m of [10, 11, 0, 1, 2]) expect(seasonCovers(sa('v', 11, 3), m)).toBe(true);
    for (const m of [3, 6, 9]) expect(seasonCovers(sa('v', 11, 3), m)).toBe(false);
  });

  it('säsong på en månad pågår bara den månaden', () => {
    expect([...Array(12).keys()].filter((m) => seasonCovers(sa('a', 4, 4), m))).toEqual([3]);
  });

  it('månad utan säsong ger tom lista, annars i filens ordning', () => {
    expect(seasonsInMonth(list, 9)).toEqual([]);
    expect(seasonsInMonth(list, 3).map((s) => s.name)).toEqual(['sommar', 'april']);
    expect(seasonsInMonth(list, 11).map((s) => s.name)).toEqual(['vinter']);
    expect(seasonsInMonth(undefined, 3)).toEqual([]);
  });

  it('plats utan month_notes men med seasons har ändå säsonger att visa', () => {
    const data = { seasons: list };
    expect(hasMonthNotes((data as { month_notes?: unknown }).month_notes)).toBe(false);
    expect(hasSeasons(data.seasons)).toBe(true);
    expect(hasSeasons([])).toBe(false);
    expect(seasonsInMonth(data.seasons, 6).map((s) => s.name)).toEqual(['sommar']);
  });

  it('resans månader och säsongerna under dem', () => {
    expect(monthsBetween('2027-07-10')).toEqual([6]);
    expect(monthsBetween('2027-12-28', '2028-01-04')).toEqual([11, 0]);
    expect(monthsBetween('2027-01-01', '2029-01-01')).toHaveLength(12);
    expect(seasonsInMonths(list, monthsBetween('2027-08-25', '2027-09-03')).map((s) => s.name)).toEqual(['sommar']);
    expect(seasonsInMonths(list, [9])).toEqual([]);
  });
});

describe('Säsonger: singular och resans plats', () => {
  it('stapelns tillägg är singular vid exakt en säsong', () => {
    expect(seasonAriaKey(1)).toBe('smart.sasong.aria.en');
    expect(seasonAriaKey(2)).toBe('smart.sasong.aria');
    expect(seasonAriaKey(6)).toBe('smart.sasong.aria');
  });

  // Påhittade platser för logiken, inget innehåll.
  const sa = (name: string, from: number, to: number) => ({ name, from, to });
  const pl = (id: string, kind: 'country' | 'region' | 'city', parent_id: string | null, seasons?: ReturnType<typeof sa>[]) => ({
    id,
    kind,
    parent_id,
    name: `Namn ${id}`,
    data: seasons ? { seasons } : {},
  });
  const places = [
    pl('XX', 'country', null),
    pl('XX-a', 'city', 'XX', [sa('sommar', 6, 8), sa('vinter', 12, 2)]),
    pl('XX-r', 'region', 'XX'),
    pl('XX-b', 'city', 'XX-r', [sa('sommar', 6, 8)]),
    pl('XX-c', 'city', 'XX'),
    pl('YY', 'country', null, [sa('egen', 7, 7)]),
    pl('YY-a', 'city', 'YY', [sa('stad', 7, 7)]),
    pl('ZZ-a', 'city', 'ZZ', [sa('annat land', 7, 7)]),
  ];
  const show = (r: { season: { name: string }; city?: string }[]) => r.map((x) => (x.city ? `${x.city}: ${x.season.name}` : x.season.name));

  it('ett land utan egna säsonger visar städernas, en gång per stad', () => {
    expect(show(tripSeasons(places, 'XX', [6]))).toEqual(['Namn XX-a: sommar', 'Namn XX-b: sommar']);
    expect(show(tripSeasons(places, 'XX', [0]))).toEqual(['Namn XX-a: vinter']);
    expect(tripSeasons(places, 'XX', [3])).toEqual([]);
  });

  it('en plats med egna säsonger visar bara dem, utan stadens namn', () => {
    expect(show(tripSeasons(places, 'YY', [6]))).toEqual(['egen']);
    expect(show(tripSeasons(places, 'XX-a', [6]))).toEqual(['sommar']);
  });

  it('en stad utan säsonger och en okänd plats ger inget', () => {
    expect(tripSeasons(places, 'XX-c', [6])).toEqual([]);
    expect(tripSeasons(places, 'QQ', [6])).toEqual([]);
    expect(tripSeasons(places, null, [6])).toEqual([]);
  });
});
