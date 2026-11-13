import { describe, expect, it } from 'vitest';
import { searchReviews, visibleReviews } from './reviews';

const rows = [
  { id: '1', name: 'Pierogarnia', note: 'Ta de stekta med svamp', place_id: 'PL', visibility: 'grupp' as const, created_by: 'a' },
  { id: '2', name: 'Torvehallerne', note: null, place_id: 'DK', visibility: 'privat' as const, created_by: 'b' },
  { id: '3', name: 'Kafé', note: 'Kanelbulle', place_id: null, visibility: 'privat' as const, created_by: 'a' },
];
const names: Record<string, string> = { PL: 'Polen', DK: 'Danmark' };

describe('Vår guide', () => {
  it('visar egna privata omdömen men inte andras', () => {
    expect(visibleReviews(rows, 'a').map((r) => r.id)).toEqual(['1', '3']);
    expect(visibleReviews(rows, 'b').map((r) => r.id)).toEqual(['1', '2']);
  });
  it('söker i namn, anteckning och plats', () => {
    const s = (q: string) => searchReviews(rows, q, (id) => names[id]).map((r) => r.id);
    expect(s('SVAMP')).toEqual(['1']);
    expect(s('danmark')).toEqual(['2']);
    expect(s('kaf')).toEqual(['3']);
    expect(s('  ')).toEqual(['1', '2', '3']);
  });
});
