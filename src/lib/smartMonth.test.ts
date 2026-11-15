import { describe, expect, it } from 'vitest';
import { currentMonth, eventsInMonth, hasMonthNotes, swipedMonth } from './smartMonth';

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
