import { describe, expect, it } from 'vitest';
import { higher, mergeStatuses, STATUSES, statusesFor } from './statusLogic';

describe('sammanslagning av gruppens kartor', () => {
  it('rangordnar bor, har bott, besökt, planerad, vill åka, mellanlandat', () => {
    expect(STATUSES).toEqual(['bor', 'bott', 'besokt', 'planerad', 'vill', 'mellan']);
    expect(higher('vill', 'besokt')).toBe('besokt');
    expect(higher('bor', 'bott')).toBe('bor');
    expect(higher('mellan', 'vill')).toBe('vill');
    expect(higher(undefined, 'mellan')).toBe('mellan');
    expect(higher('planerad', undefined)).toBe('planerad');
    expect(higher(undefined, undefined)).toBeUndefined();
  });

  it('ger varje land den högsta status någon i gruppen har satt', () => {
    const jag = { SE: 'bor', DK: 'vill', NL: 'mellan' } as const;
    const hon = { SE: 'besokt', DK: 'besokt', PL: 'planerad' } as const;
    const tredje = { NL: 'bott', DK: 'mellan' } as const;
    expect(mergeStatuses([jag, hon, tredje])).toEqual({ SE: 'bor', DK: 'besokt', NL: 'bott', PL: 'planerad' });
  });

  it('beror inte på ordningen mellan medlemmarna', () => {
    const a = { FR: 'vill', ES: 'besokt' } as const;
    const b = { FR: 'planerad', ES: 'mellan' } as const;
    expect(mergeStatuses([a, b])).toEqual(mergeStatuses([b, a]));
  });

  it('hoppar över okända värden och tomma kartor', () => {
    expect(mergeStatuses([])).toEqual({});
    expect(mergeStatuses([{}, { IT: 'okand' as never }, { IT: 'vill' }])).toEqual({ IT: 'vill' });
  });

  it('väljer rätt karta', () => {
    const mine = { SE: 'bor' } as const;
    const others = { u2: { SE: 'besokt', NO: 'vill' } as const };
    expect(statusesFor('min', mine, others)).toEqual({ SE: 'bor' });
    expect(statusesFor('var', mine, others)).toEqual({ SE: 'bor', NO: 'vill' });
    expect(statusesFor('u2', mine, others)).toEqual({ SE: 'besokt', NO: 'vill' });
    expect(statusesFor('borta', mine, others)).toEqual({});
  });
});

describe('status när en resa skapas', () => {
  it('sätter planerad bara om status är tom eller vill åka', async () => {
    const { shouldMarkPlanned, countryIdFor } = await import('./statusLogic');
    expect(shouldMarkPlanned(undefined)).toBe(true);
    expect(shouldMarkPlanned('vill')).toBe(true);
    for (const s of ['bor', 'bott', 'besokt', 'planerad', 'mellan'] as const) expect(shouldMarkPlanned(s)).toBe(false);
    expect(countryIdFor('SE-vastergotland', true)).toBe('SE');
    expect(countryIdFor('NL', false)).toBe('NL');
  });
});
