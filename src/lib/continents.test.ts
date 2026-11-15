import { describe, expect, it } from 'vitest';
import lists from '../../content/_landlistor.json';
import { CONTINENT_OF } from './continents';

describe('kontinenter', () => {
  it('alla länder i content/_landlistor.json (fn och fn_observatorer) har en kontinent', () => {
    const missing = [...lists.fn, ...lists.fn_observatorer].filter((iso) => !CONTINENT_OF[iso]);
    expect(missing).toEqual([]);
  });

  it('Mauritius och Seychellerna hör till Afrika, Maldiverna till Asien', () => {
    expect([CONTINENT_OF.MU, CONTINENT_OF.SC, CONTINENT_OF.MV]).toEqual(['AF', 'AF', 'AS']);
  });
});
