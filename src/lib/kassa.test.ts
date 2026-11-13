import { describe, expect, it } from 'vitest';
import { balances, settle, share, splitOre, spent, toOre, type ExpenseLike } from './kassa';

const exp = (amount: number, paid_by: string, split_between: string[] = [], rate_to_sek = 1, category: string | null = null): ExpenseLike => ({
  amount,
  rate_to_sek,
  paid_by,
  split_between,
  category,
});

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('delning och avrundning', () => {
  it('räknar om med kursen på raden till hela ören', () => {
    expect(toOre({ amount: 64, rate_to_sek: 11.5 })).toBe(73600);
    expect(toOre({ amount: '10.10', rate_to_sek: '1' })).toBe(1010);
    expect(toOre({ amount: 0.1, rate_to_sek: 0.2948 })).toBe(3);
  });

  it('delar lika och ger överblivna ören till de första', () => {
    expect(splitOre(1000, ['b', 'a'])).toEqual({ a: 500, b: 500 });
    expect(splitOre(1000, ['c', 'a', 'b'])).toEqual({ a: 334, b: 333, c: 333 });
    expect(splitOre(2, ['a', 'b', 'c'])).toEqual({ a: 1, b: 1, c: 0 });
    expect(splitOre(500, [])).toEqual({});
  });

  it('tappar aldrig ett öre', () => {
    for (const total of [1, 7, 100, 9999, 123457]) for (const n of [1, 2, 3, 4, 7]) {
      const people = Array.from({ length: n }, (_, i) => `p${i}`);
      expect(sum(splitOre(total, people))).toBe(total);
    }
  });

  it('räknar dubbletter i listan bara en gång', () => {
    expect(splitOre(900, ['a', 'a', 'b'])).toEqual({ a: 450, b: 450 });
  });
});

describe('saldon', () => {
  const members = ['du', 'hon'];

  it('delar på alla när ingen är vald', () => {
    expect(balances([exp(100, 'du')], members)).toEqual({ du: 5000, hon: -5000 });
  });

  it('delar bara på de valda, även om betalaren inte är med', () => {
    expect(balances([exp(90, 'du', ['hon'])], members)).toEqual({ du: 9000, hon: -9000 });
    expect(balances([exp(90, 'du', ['du'])], members)).toEqual({ du: 0, hon: 0 });
  });

  it('räknar med kursen och går alltid jämnt ut', () => {
    const list = [exp(2400, 'du'), exp(2100, 'hon'), exp(64, 'du', [], 11.5), exp(36, 'hon', [], 11.5), exp(358, 'du')];
    const b = balances(list, members);
    expect(sum(b)).toBe(0);
    expect(b.du).toBe(((2400 + 736 + 358 - 2100 - 414) / 2) * 100);
  });

  it('hoppar över utgifter utan betalare', () => {
    expect(balances([{ ...exp(100, 'du'), paid_by: null }], members)).toEqual({ du: 0, hon: 0 });
  });

  it('går jämnt ut med udda belopp och tre personer', () => {
    const b = balances([exp(100, 'a'), exp(0.01, 'b'), exp(33.33, 'c', ['a', 'b'])], ['a', 'b', 'c']);
    expect(sum(b)).toBe(0);
  });
});

describe('skulder', () => {
  it('ger inga betalningar när alla är kvitt', () => {
    expect(settle({ a: 0, b: 0 })).toEqual([]);
    expect(settle({})).toEqual([]);
  });

  it('ger en betalning för två personer', () => {
    expect(settle({ du: 5000, hon: -5000 })).toEqual([{ from: 'hon', to: 'du', ore: 5000 }]);
  });

  it('använder så få betalningar som möjligt', () => {
    // a och b går jämnt ut för sig, c och d för sig: två betalningar räcker, inte tre.
    const t = settle({ a: 1000, b: -1000, c: 300, d: -300 });
    expect(t).toHaveLength(2);
    expect(t).toEqual(expect.arrayContaining([{ from: 'b', to: 'a', ore: 1000 }, { from: 'd', to: 'c', ore: 300 }]));
  });

  it('hittar par som går jämnt ut även när den enkla metoden skulle ta fler', () => {
    // Största mot största ger fyra betalningar här. Grupperna {a,d,e} och {b,c} ger tre.
    const bal = { a: 600, b: 500, c: -500, d: -400, e: -200 };
    const t = settle(bal);
    expect(t).toHaveLength(3);
    const after = { ...bal } as Record<string, number>;
    for (const x of t) {
      after[x.from] += x.ore;
      after[x.to] -= x.ore;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it('gör upp alla saldon för en grupp på fyra', () => {
    const members = ['a', 'b', 'c', 'd'];
    const b = balances([exp(1000, 'a'), exp(250, 'b', ['a', 'b']), exp(77.77, 'c'), exp(12, 'd', ['c'])], members);
    const t = settle(b);
    expect(t.length).toBeLessThanOrEqual(3);
    const after = { ...b };
    for (const x of t) {
      expect(x.ore).toBeGreaterThan(0);
      after[x.from] += x.ore;
      after[x.to] -= x.ore;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
});

describe('budget', () => {
  it('summerar totalt och per kategori', () => {
    const r = spent([exp(100, 'a', [], 1, 'mat'), exp(10, 'a', [], 11.5, 'mat'), exp(50, 'a')]);
    expect(r.total).toBe(10000 + 11500 + 5000);
    expect(r.byCategory).toEqual({ mat: 21500, '': 5000 });
  });

  it('räknar andel av budget mellan 0 och 100', () => {
    expect(share(50, 200)).toBe(25);
    expect(share(300, 200)).toBe(100);
    expect(share(10, 0)).toBe(0);
  });
});
