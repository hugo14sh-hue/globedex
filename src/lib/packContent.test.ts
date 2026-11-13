import { describe, expect, it } from 'vitest';
import { PACK_SUGGESTIONS } from './packContent';
import { PRETRIP_SUGGESTIONS } from './pretripContent';
import { packFor, pretripMissing } from './tripLogic';

// Filerna i content/ läses in vid bygget. Testet kontrollerar att Hämta förslag får rader ur dem.
describe('förslag ur content/', () => {
  it('packlistan ger förslag för en resa med datum', () => {
    expect(PACK_SUGGESTIONS.length).toBeGreaterThan(0);
    expect(packFor(PACK_SUGGESTIONS, 4, 6, []).length).toBeGreaterThan(0);
    expect(packFor(PACK_SUGGESTIONS, null, null, []).every((s) => s.min_nights == null && s.max_nights == null && !s.months?.length)).toBe(true);
  });

  it('innan avresa ger alla punkter på en tom lista och inga när alla finns', () => {
    expect(PRETRIP_SUGGESTIONS.length).toBeGreaterThan(0);
    expect(pretripMissing(PRETRIP_SUGGESTIONS, [])).toHaveLength(PRETRIP_SUGGESTIONS.length);
    expect(pretripMissing(PRETRIP_SUGGESTIONS, PRETRIP_SUGGESTIONS.map((s) => s.title))).toEqual([]);
  });
});
