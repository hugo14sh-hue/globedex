import { describe, expect, it } from 'vitest';
import {
  addDays,
  packPatch,
  packingStats,
  bestMonths,
  budgetSuggestion,
  changedPos,
  countdown,
  datesForMonth,
  daysBetween,
  findPoint,
  move,
  nights,
  packFor,
  sortTrips,
  tripPhase,
  type PackSuggestion,
  daysBeforeFor,
  daysBeforeLabel,
  pretripMissing,
  sortPretrip,
  type PretripSuggestion,
} from './tripLogic';

describe('datum och nedräkning', () => {
  it('räknar dagar över månads- och årsskiften', () => {
    expect(daysBetween('2026-11-13', '2026-11-14')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(addDays('2027-02-27', 2)).toBe('2027-03-01');
  });

  it('säger idag, i morgon eller antal dagar', () => {
    expect(countdown('2026-11-13', '2026-11-13')).toEqual({ key: 'resor.idag' });
    expect(countdown('2026-11-14', '2026-11-13')).toEqual({ key: 'resor.imorgon' });
    expect(countdown('2027-04-04', '2026-11-13')).toEqual({ key: 'resor.nedrakning', dagar: 142 });
    expect(countdown('2026-11-01', '2026-11-13')).toBeNull();
    expect(countdown(null, '2026-11-13')).toBeNull();
  });

  it('vet om resan är kommande, pågår eller är avslutad', () => {
    const today = '2026-11-13';
    expect(tripPhase({ status: 'planerad', start_date: '2026-12-01', end_date: '2026-12-05' }, today)).toBe('kommande');
    expect(tripPhase({ status: 'planerad', start_date: '2026-11-10', end_date: '2026-11-15' }, today)).toBe('pagar');
    expect(tripPhase({ status: 'planerad', start_date: '2026-11-01', end_date: '2026-11-05' }, today)).toBe('avslutad');
    expect(tripPhase({ status: 'klar', start_date: '2027-01-01', end_date: null }, today)).toBe('avslutad');
    expect(tripPhase({ status: 'planerad', start_date: null, end_date: null }, today)).toBe('kommande');
  });

  it('sorterar närmast avresa först och avslutade senast först', () => {
    const r = (id: string, start_date: string | null, end_date: string | null, status: 'planerad' | 'klar' = 'planerad') => ({
      id,
      status,
      start_date,
      end_date,
      created_at: '2026-01-01',
    });
    const { next, past } = sortTrips(
      [r('utan', null, null), r('sen', '2027-05-01', '2027-05-05'), r('snart', '2026-12-01', '2026-12-03'), r('gammal', '2025-01-01', '2025-01-03'), r('nyare', '2026-06-01', '2026-06-04', 'klar')],
      '2026-11-13',
    );
    expect(next.map((x) => x.id)).toEqual(['snart', 'sen', 'utan']);
    expect(past.map((x) => x.id)).toEqual(['nyare', 'gammal']);
  });

  it('räknar nätter', () => {
    expect(nights('2027-05-13', '2027-05-17')).toBe(4);
    expect(nights('2027-05-13', null)).toBeNull();
    expect(nights('2027-05-13', '2027-05-01')).toBeNull();
  });
});

describe('förslag i planeraren', () => {
  it('föreslår datum i vald månad nästa gång den kommer', () => {
    expect(datesForMonth(4, 4, '2026-11-13')).toEqual({ start: '2027-05-01', end: '2027-05-05' });
    expect(datesForMonth(11, 3, '2026-11-13')).toEqual({ start: '2026-12-01', end: '2026-12-04' });
    // Samma månad: tidigast i morgon.
    expect(datesForMonth(10, 2, '2026-11-13')).toEqual({ start: '2026-11-14', end: '2026-11-16' });
  });

  it('räknar ungefärlig budget och saknar förslag utan dagsbudget', () => {
    expect(budgetSuggestion(900, 5, 2)).toBe(9000);
    expect(budgetSuggestion(900, 5, 0)).toBe(4500);
    expect(budgetSuggestion(undefined, 5, 2)).toBeNull();
    expect(budgetSuggestion(900, 0, 2)).toBeNull();
  });

  it('hittar bästa månaderna, och inga utan innehåll', () => {
    expect(bestMonths([1, 1, 2, 5, 5, 4, 3, 3, 4, 3, 1, 2])).toEqual([3, 4]);
    expect(bestMonths([1, 1, 2, 4, 3, 4, 3, 3, 2, 3, 1, 2])).toEqual([3, 5]);
    expect(bestMonths(null)).toEqual([]);
    expect(bestMonths([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toEqual([]);
  });
});

describe('etapper', () => {
  const legs = [
    { id: 'a', pos: 0 },
    { id: 'b', pos: 1 },
    { id: 'c', pos: 2 },
  ];

  it('flyttar upp och ned och numrerar om', () => {
    expect(move(legs, 'c', -1).map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(move(legs, 'a', 1).map((x) => `${x.id}${x.pos}`)).toEqual(['b0', 'a1', 'c2']);
    expect(move(legs, 'a', -1).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('sparar bara rader som flyttats', () => {
    expect(changedPos(legs, move(legs, 'c', -1)).map((x) => x.id)).toEqual(['c', 'b']);
  });

  it('hittar koordinater för ett känt namn', () => {
    const places = [
      { name: 'Amsterdam', lat: 52.37, lon: 4.9 },
      { name: 'Utan', lat: null, lon: null },
    ];
    expect(findPoint(' amsterdam ', places)).toEqual({ lat: 52.37, lon: 4.9 });
    expect(findPoint('Utan', places)).toBeNull();
    expect(findPoint('', places)).toBeNull();
  });
});

describe('packlistans förslag', () => {
  const list: PackSuggestion[] = [
    { id: 'laddare', group: 'g', title: 'Laddare' },
    { id: 'regn', group: 'g', title: 'Regnjacka', months: [4, 5, 10] },
    { id: 'tvatt', group: 'g', title: 'Tvättmedel', min_nights: 7 },
    { id: 'kort', group: 'g', title: 'Kort', max_nights: 2 },
  ];

  it('väljer efter längd och månad', () => {
    expect(packFor(list, 4, 4, []).map((x) => x.id)).toEqual(['laddare', 'regn']);
    expect(packFor(list, 10, 6, []).map((x) => x.id)).toEqual(['laddare', 'tvatt']);
    expect(packFor(list, 1, 0, []).map((x) => x.id)).toEqual(['laddare', 'kort']);
  });

  it('tar bara allmänna förslag när datum saknas', () => {
    expect(packFor(list, null, null, []).map((x) => x.id)).toEqual(['laddare']);
  });

  it('hoppar över det som redan finns på listan', () => {
    expect(packFor(list, 4, 4, [' laddare']).map((x) => x.id)).toEqual(['regn']);
  });
});

describe('innan avresa', () => {
  const list: PretripSuggestion[] = [
    { id: 'a', title: 'Pass', days_before: 60 },
    { id: 'b', title: 'Laddare', days_before: 0 },
    { id: 'c', title: 'Valuta', days_before: 7 },
  ];

  it('lägger bara till punkter som saknas', () => {
    expect(pretripMissing(list, [' pass ', 'Egen punkt']).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('sorterar på dagar före, egna rader sist', () => {
    const rows = [
      { title: 'Egen', pos: 0 },
      { title: 'Laddare', pos: 1 },
      { title: 'pass', pos: 2 },
      { title: 'Valuta', pos: 3 },
      { title: 'Egen två', pos: 4 },
    ];
    expect(sortPretrip(rows, list).map((r) => r.title)).toEqual(['pass', 'Valuta', 'Laddare', 'Egen', 'Egen två']);
    expect(daysBeforeFor(list, 'Okänd')).toBeNull();
  });

  it('väljer rätt text', () => {
    expect(daysBeforeLabel(0)).toEqual({ key: 'innan.samma-dag' });
    expect(daysBeforeLabel(1)).toEqual({ key: 'innan.dagen-fore' });
    expect(daysBeforeLabel(14)).toEqual({ key: 'innan.dagar-fore', antal: 14 });
  });
});

describe('packed_at', () => {
  it('sätts när raden bockas av och nollas när bocken tas bort', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    expect(packPatch(true, now)).toEqual({ packed: true, packed_at: '2026-11-14T10:00:00.000Z' });
    expect(packPatch(false, now)).toEqual({ packed: false, packed_at: null });
  });

  it('packingStats ger senaste tidpunkten, och null om någon packad rad saknar den', () => {
    const s = packingStats([
      { trip_id: 'a', packed: true, packed_at: '2026-11-10T10:00:00Z' },
      { trip_id: 'a', packed: true, packed_at: '2026-11-12T10:00:00Z' },
      { trip_id: 'a', packed: false, packed_at: null },
      { trip_id: 'b', packed: true, packed_at: null },
      { trip_id: 'b', packed: true, packed_at: '2026-11-12T10:00:00Z' },
    ]);
    expect(s.a).toEqual([2, 3, '2026-11-12T10:00:00Z']);
    expect(s.b).toEqual([2, 2, null]);
  });
});
