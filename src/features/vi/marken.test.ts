import { describe, expect, it } from 'vitest';
import { BADGES } from '../../lib/texter';
import { badgeState, badgeStates, emptyInput, METRICS, parseRule, tripDays, type TripLike, type ViInput } from './marken';

const TODAY = '2026-11-13';
const base = (p: Partial<ViInput> = {}): ViInput => ({ ...emptyInput('par', TODAY), memberIds: ['a', 'b'], ...p });
const badge = (id: string) => {
  const b = BADGES.find((x) => x.id === id);
  if (!b) throw new Error(`Märket ${id} saknas i _texter.json`);
  return b;
};
const st = (id: string, p: Partial<ViInput>) => badgeState(badge(id), base(p));

let n = 0;
const trip = (p: Partial<TripLike> = {}): TripLike => ({
  id: `t${++n}`,
  title: 'Resa',
  place_id: 'NL',
  kind: 'resa',
  status: 'planerad',
  start_date: '2026-05-01',
  end_date: '2026-05-05',
  budget: {},
  created_at: '2026-01-01T10:00:00Z',
  ...p,
});
const status = (place_id: string, s: 'besokt' | 'bor' | 'vill' | 'mellan' = 'besokt', updated_at = '2026-02-01T08:00:00Z') => ({
  place_id,
  status: s,
  updated_at,
});
const exp = (paid_by: string, amount: number, split: string[] = []) => ({ amount, rate_to_sek: 1, paid_by, split_between: split });

describe('listan med märken', () => {
  it('har 24 märken och en uträkning för varje regel', () => {
    expect(BADGES).toHaveLength(24);
    for (const b of BADGES) expect(METRICS, b.id).toHaveProperty(parseRule(b).metric);
  });

  it('döljer Samma tanke och Kvitt i solo', () => {
    const solo = badgeStates(BADGES, emptyInput('solo', TODAY)).map((s) => s.badge.id);
    expect(solo).not.toContain('marke-match');
    expect(solo).not.toContain('marke-kvitt');
    expect(solo).toHaveLength(22);
    expect(badgeStates(BADGES, base())).toHaveLength(24);
  });

  it('räknar resdagar med hemresedagen', () => {
    expect(tripDays({ start_date: '2026-05-01', end_date: '2026-05-05' })).toBe(5);
    expect(tripDays({ start_date: '2026-05-01', end_date: null })).toBe(1);
    expect(tripDays({ start_date: null, end_date: null })).toBe(0);
  });
});

describe('varje märke', () => {
  it('Första stämpeln: ett besökt land, inte vill åka eller mellanlandat', () => {
    expect(st('marke-forsta-landet', { statuses: [status('NL', 'vill'), status('DE', 'mellan'), status('SE-skane')] }).earned).toBe(false);
    const s = st('marke-forsta-landet', { statuses: [status('NL', 'besokt', '2025-06-01T00:00:00Z')] });
    expect(s.earned).toBe(true);
    expect(s.dates).toEqual(['2025-06-01']);
  });

  it('Stämpelsamlaren: nivåer 5, 10, 25, 50 och datum per nivå', () => {
    const statuses = ['NL', 'DE', 'DK', 'NO', 'FI', 'SE'].map((c, i) => status(c, i === 5 ? 'bor' : 'besokt', `2026-0${i + 1}-01T00:00:00Z`));
    const s = st('marke-lander', { statuses });
    expect(s.value).toBe(6);
    expect(s.level).toBe(1);
    expect(s.next).toBe(10);
    expect(s.dates).toEqual(['2026-05-01']);
  });

  it('Kontinenthopparen: kontinenter ur besökta länder', () => {
    const s = st('marke-kontinenter', { statuses: [status('NL'), status('DE'), status('US'), status('AU')] });
    expect(s.value).toBe(3);
    expect(s.level).toBe(2);
  });

  it('Nordenrundan: alla fem nordiska länder', () => {
    const four = ['SE', 'NO', 'DK', 'FI'].map((c) => status(c));
    expect(st('marke-norden', { statuses: four }).earned).toBe(false);
    const s = st('marke-norden', { statuses: [...four, status('IS', 'besokt', '2026-08-09T00:00:00Z')] });
    expect(s.earned).toBe(true);
    expect(s.dates).toEqual(['2026-08-09']);
  });

  it('Landskapsjägaren: bara landskap i innehållet räknas', () => {
    const seRegions = ['SE-skane', 'SE-halland', 'SE-smaland', 'SE-blekinge', 'SE-oland'];
    expect(st('marke-landskap', { seRegions, statuses: seRegions.slice(0, 4).map((r) => status(r)) }).earned).toBe(false);
    expect(st('marke-landskap', { seRegions, statuses: [...seRegions.map((r) => status(r)), status('SE-okand')] }).value).toBe(5);
  });

  it('Vanresenären: genomförda resor, inte utflykter eller kommande', () => {
    const trips = [trip(), trip({ kind: 'utflykt' }), trip({ start_date: '2027-01-01', end_date: '2027-01-03' }), trip({ status: 'klar', start_date: null, end_date: null })];
    const s = st('marke-resor', { trips });
    expect(s.value).toBe(2);
    expect(s.level).toBe(1);
  });

  it('Långliggaren: en resa på minst 14 dagar', () => {
    expect(st('marke-lang-resa', { trips: [trip({ start_date: '2026-06-01', end_date: '2026-06-13' })] }).earned).toBe(false);
    const s = st('marke-lang-resa', { trips: [trip({ start_date: '2026-06-01', end_date: '2026-06-14' })] });
    expect(s.earned).toBe(true);
    expect(s.dates).toEqual(['2026-06-14']);
  });

  it('Luffaren: en resa med minst fyra etapper', () => {
    const t = trip();
    expect(st('marke-etapper', { trips: [t], legCounts: { [t.id]: 3 } }).earned).toBe(false);
    expect(st('marke-etapper', { trips: [t], legCounts: { [t.id]: 4 } }).earned).toBe(true);
  });

  it('Fyndaren: fynd i samlingsboken med nivåer', () => {
    const finds = Array.from({ length: 12 }, (_, i) => ({ compendium_id: `c${i}`, found_on: `2026-03-${String(i + 1).padStart(2, '0')}`, place_id: null }));
    const s = st('marke-fynd', { finds });
    expect(s.level).toBe(1);
    expect(s.dates).toEqual(['2026-03-10']);
    expect(s.next).toBe(50);
  });

  it('Skarpa ögon: sällsynt eller rarare', () => {
    const finds = [{ compendium_id: 'x', found_on: '2026-01-01', place_id: null }];
    expect(st('marke-sallsynt', { finds, rarity: { x: 'ovanlig' } }).earned).toBe(false);
    expect(st('marke-sallsynt', { finds, rarity: { x: 'sallsynt' } }).earned).toBe(true);
    expect(st('marke-sallsynt', { finds, rarity: { x: 'legendarisk' } }).earned).toBe(true);
  });

  it('Legenden: något legendariskt', () => {
    const finds = [{ compendium_id: 'x', found_on: '2026-01-01', place_id: null }];
    expect(st('marke-legendarisk', { finds, rarity: { x: 'sallsynt' } }).earned).toBe(false);
    expect(st('marke-legendarisk', { finds, rarity: { x: 'legendarisk' } }).earned).toBe(true);
  });

  it('Hela listan: allt avbockat på en plats, datum för sista punkten', () => {
    const itemsByPlace = { NL: ['a', 'b'], DE: [] };
    expect(st('marke-plats-klar', { itemsByPlace, checks: [{ item_id: 'a', done_on: '2026-04-01' }] }).earned).toBe(false);
    const s = st('marke-plats-klar', {
      itemsByPlace,
      checks: [
        { item_id: 'a', done_on: '2026-04-01' },
        { item_id: 'b', done_on: '2026-04-03' },
      ],
    });
    expect(s.earned).toBe(true);
    expect(s.dates).toEqual(['2026-04-03']);
  });

  it('Gjort är gjort: avbockade bucketpunkter', () => {
    const bucket = [
      { id: '1', catalog_id: 'b1', title: 'A', done_on: '2026-02-02' },
      { id: '2', catalog_id: null, title: 'B', done_on: null },
    ];
    const s = st('marke-bucket', { bucket });
    expect(s.value).toBe(1);
    expect(s.earned).toBe(true);
  });

  it('Egen dröm: en egen punkt avbockad', () => {
    expect(st('marke-bucket-egen', { bucket: [{ id: '1', catalog_id: 'b1', title: 'A', done_on: '2026-02-02' }] }).earned).toBe(false);
    expect(st('marke-bucket-egen', { bucket: [{ id: '1', catalog_id: null, title: 'A', done_on: '2026-02-02' }] }).earned).toBe(true);
  });

  it('Samma tanke: gemensamma ja i swipe', () => {
    const s = st('marke-match', { matches: [{ id: 'x', date: '2026-07-01T10:00:00Z' }] });
    expect(s.level).toBe(1);
    expect(s.dates).toEqual(['2026-07-01']);
  });

  it('Vardagsäventyraren: sparade idéer med done_at', () => {
    expect(st('marke-idag', { savedIdeas: [{ done_at: null }, {}] }).earned).toBe(false);
    expect(st('marke-idag', { savedIdeas: [{ done_at: '2026-10-10T18:00:00Z' }] }).dates).toEqual(['2026-10-10']);
  });

  it('Recensenten: omdömen i guiden', () => {
    expect(st('marke-omdome', { reviews: [{ created_at: '2026-09-01T00:00:00Z' }] }).level).toBe(1);
  });

  it('Samlaren: föremål i egna samlingar', () => {
    const collectionEntries = Array.from({ length: 10 }, () => ({ got_on: '2026-01-05' }));
    expect(st('marke-samlare', { collectionEntries }).level).toBe(2);
  });

  it('Kvitt: avslutad resa där alla skulder är reglerade', () => {
    const t = trip();
    expect(st('marke-kvitt', { trips: [t], expensesByTrip: { [t.id]: [exp('a', 100)] } }).earned).toBe(false);
    // b betalar tillbaka sin halva: a har lagt 100 för båda, b lägger 50 som bara gäller a.
    expect(st('marke-kvitt', { trips: [t], expensesByTrip: { [t.id]: [exp('a', 100), exp('b', 50, ['a'])] } }).earned).toBe(true);
    expect(st('marke-kvitt', { trips: [t], expensesByTrip: {} }).earned).toBe(false);
  });

  it('Under budget: avslutad resa där utgifterna inte går över budgeten', () => {
    const t = trip({ budget: { total: 1000 } });
    expect(st('marke-budget', { trips: [t], expensesByTrip: { [t.id]: [exp('a', 1000)] } }).earned).toBe(true);
    expect(st('marke-budget', { trips: [t], expensesByTrip: { [t.id]: [exp('a', 1000.5)] } }).earned).toBe(false);
    expect(st('marke-budget', { trips: [trip()], expensesByTrip: {} }).earned).toBe(false);
  });

  it('Färdigpackad: hela packlistan packad', () => {
    const t = trip({ start_date: '2026-12-01', end_date: '2026-12-03' });
    expect(st('marke-packad', { trips: [t], packing: { [t.id]: [3, 4] } }).earned).toBe(false);
    expect(st('marke-packad', { trips: [t], packing: { [t.id]: [0, 0] } }).earned).toBe(false);
    const s = st('marke-packad', { trips: [t], packing: { [t.id]: [4, 4] } });
    expect(s.earned).toBe(true);
    expect(s.dates).toEqual([TODAY]);
  });

  it('Året runt: resor i alla tolv månader, även över månadsskiften', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => trip({ start_date: `2025-${String(i + 1).padStart(2, '0')}-10`, end_date: `2025-${String(i + 1).padStart(2, '0')}-12` }));
    expect(st('marke-manader', { trips: eleven }).value).toBe(11);
    const s = st('marke-manader', { trips: [...eleven, trip({ start_date: '2025-11-28', end_date: '2025-12-02' })] });
    expect(s.earned).toBe(true);
    expect(s.dates).toEqual(['2025-12-01']);
    // Kommande resor räknas inte.
    expect(st('marke-manader', { trips: [...eleven, trip({ start_date: '2026-12-20', end_date: '2026-12-24' })] }).earned).toBe(false);
  });

  it('Ordning och reda: något i Valvet', () => {
    expect(st('marke-valvet', { vault: [] }).earned).toBe(false);
    expect(st('marke-valvet', { vault: [{ updated_at: '2026-11-01T00:00:00Z' }] }).earned).toBe(true);
  });

  it('Egen stil: egen palett, utan datum', () => {
    expect(st('marke-eget-tema', { customPalette: false }).earned).toBe(false);
    const s = st('marke-eget-tema', { customPalette: true });
    expect(s.earned).toBe(true);
    expect(s.dates).toEqual([null]);
  });
});
