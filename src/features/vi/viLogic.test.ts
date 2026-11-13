import { describe, expect, it } from 'vitest';
import { BADGES } from '../../lib/texter';
import { badgeStates, emptyInput, type TripLike, type ViInput } from './marken';
import { exportText, numbers, timeline, wrapped, wrappedYears } from './viLogic';

const TODAY = '2026-11-13';
const input = (p: Partial<ViInput> = {}): ViInput => ({ ...emptyInput('solo', TODAY), ...p });
const trip = (id: string, p: Partial<TripLike> = {}): TripLike => ({
  id,
  title: id,
  place_id: 'NL-amsterdam',
  kind: 'resa',
  status: 'planerad',
  start_date: '2026-05-01',
  end_date: '2026-05-05',
  budget: {},
  created_at: '2026-01-01T00:00:00Z',
  ...p,
});

describe('siffror', () => {
  it('räknar länder, kontinenter, landskap, resor, dagar, fynd och bucket', () => {
    const x = input({
      statuses: [
        { place_id: 'SE', status: 'bor', updated_at: null },
        { place_id: 'US', status: 'besokt', updated_at: null },
        { place_id: 'DE', status: 'vill', updated_at: null },
        { place_id: 'SE-skane', status: 'besokt', updated_at: null },
      ],
      seRegions: ['SE-skane', 'SE-halland'],
      trips: [trip('a'), trip('b', { start_date: '2026-08-01', end_date: '2026-08-02' }), trip('c', { start_date: '2027-01-01', end_date: null })],
      finds: [{ compendium_id: 'x', found_on: '2026-01-01', place_id: null }],
      bucket: [
        { id: '1', catalog_id: null, title: 'A', done_on: '2026-01-01' },
        { id: '2', catalog_id: null, title: 'B', done_on: null },
      ],
    });
    const n = numbers(x, 40);
    expect(n.lander).toEqual(['SE', 'US']);
    expect(n.kontinenter).toEqual(['EU', 'NA']);
    expect(n.landskap).toEqual(['SE-skane']);
    expect(n.landskapTotalt).toBe(2);
    expect(n.resor.map((t) => t.id)).toEqual(['a', 'b']);
    expect(n.resdagar).toBe(7);
    expect([n.fynd, n.fyndTotalt, n.bucket]).toEqual([1, 40, 1]);
  });
});

describe('Wrapped', () => {
  const x = input({
    trips: [
      trip('kort', { place_id: 'NL-amsterdam', start_date: '2026-03-01', end_date: '2026-03-03' }),
      trip('lang', { place_id: 'DE', start_date: '2026-07-01', end_date: '2026-07-10' }),
      trip('utflykt', { kind: 'utflykt', place_id: 'SE', start_date: '2026-04-01', end_date: '2026-04-01' }),
      trip('framtid', { place_id: 'FR', start_date: '2026-12-20', end_date: '2026-12-24' }),
      trip('ifjol', { place_id: 'DK', start_date: '2025-06-01', end_date: '2025-06-03' }),
    ],
    finds: [
      { compendium_id: 'a', found_on: '2026-03-02', place_id: null },
      { compendium_id: 'b', found_on: '2025-03-02', place_id: null },
    ],
    bucket: [{ id: '1', catalog_id: null, title: 'A', done_on: '2026-07-05' }],
  });

  it('summerar året', () => {
    const w = wrapped(x, 2026)!;
    expect(w.trips).toBe(2);
    expect(w.countries).toEqual(['DE', 'NL']);
    expect(w.days).toBe(13);
    expect(w.finds).toBe(1);
    expect(w.bucket).toBe(1);
    expect(w.longest?.trip.id).toBe('lang');
    expect(w.longest?.days).toBe(10);
  });

  it('kräver minst en resa under året', () => {
    expect(wrapped(x, 2024)).toBeNull();
    expect(wrapped(input({ trips: [trip('u', { kind: 'utflykt' })] }), 2026)).toBeNull();
  });

  it('erbjuder år med resor och innevarande år', () => {
    expect(wrappedYears(x)).toEqual([2026, 2025]);
    expect(wrappedYears(input())).toEqual([2026]);
  });
});

describe('tidslinje', () => {
  it('blandar resor, fynd, märken och bucket, nyast först', () => {
    const x = input({
      statuses: [{ place_id: 'NL', status: 'besokt', updated_at: '2026-05-03T00:00:00Z' }],
      trips: [trip('Amsterdam'), trip('Senare', { start_date: '2027-01-01', end_date: null })],
      finds: [{ compendium_id: 'stroop', found_on: '2026-05-02', place_id: 'NL' }],
      bucket: [{ id: '1', catalog_id: null, title: 'Nyår', done_on: '2026-01-01' }],
    });
    const tl = timeline(x, badgeStates(BADGES, x), (id) => id.toUpperCase());
    expect(tl.map((e) => [e.type, e.date, e.title])).toEqual([
      ['marke', '2026-05-05', 'Vanresenären'],
      ['marke', '2026-05-03', 'Första stämpeln'],
      ['fynd', '2026-05-02', 'STROOP'],
      ['resa', '2026-05-01', 'Amsterdam'],
      // Samma dag: märken före bucketpunkten. En egen punkt ger också Egen dröm.
      ['marke', '2026-01-01', 'Egen dröm'],
      ['marke', '2026-01-01', 'Gjort är gjort'],
      ['bucket', '2026-01-01', 'Nyår'],
    ]);
    expect(tl.find((e) => e.title === 'Vanresenären')?.level).toBe(1);
  });
});

describe('export', () => {
  const d = {
    trips: [{ title: 'Amsterdam', place: 'Nederländerna', start: '2026-05-01', end: '2026-05-05', phase: 'Tidigare' }],
    statuses: [
      { label: 'Besökt', places: ['Nederländerna', 'Tyskland'] },
      { label: 'Vill åka', places: [] },
    ],
    lists: [{ label: 'Bucketlist', items: ['Norrsken'] }],
    reviews: [{ name: 'Pierogarnia', place: 'Polen', rating: 9, note: 'Ta de stekta.' }],
  };
  const h = (p: string) => p.toUpperCase();
  const r = (n: number) => `${n} av 10`;

  it('tar med valda delar och hoppar över tomma', () => {
    expect(exportText(d, ['resor', 'status', 'listor', 'omdomen'], h, r)).toBe(
      [
        'RESOR\n- Amsterdam, Nederländerna, 2026-05-01 – 2026-05-05, Tidigare',
        'STATUS\n- Besökt: Nederländerna, Tyskland',
        'LISTOR\n- Bucketlist: Norrsken',
        'OMDOMEN\n- Pierogarnia, Polen: 9 av 10. Ta de stekta.',
      ].join('\n\n'),
    );
    expect(exportText(d, ['omdomen'], h, r)).toBe('OMDOMEN\n- Pierogarnia, Polen: 9 av 10. Ta de stekta.');
    expect(exportText(d, [], h, r)).toBe('');
  });
});
