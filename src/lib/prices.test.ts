import { describe, expect, it } from 'vitest';
import { setLocale } from './locale';
import { basis, domainOf, formatMoney, priceView, pricesOf, rateFor, roundSek, rowSek, type Prices, type RateFile } from './prices';

// Påhittade tal, bara för uträkningarna.
const rates: RateFile = { checked: '2026-01-01', source: 'https://example.org', sek_per: { EUR: 11 } };
const prices = (extra: Partial<Prices> = {}): Prices => ({
  currency: 'EUR',
  level: 3,
  checked: '2026-01-01',
  rows: [{ key: 'kaffe', typical: 3 }],
  sources: ['https://www.example.org/a'],
  ...extra,
});

describe('priser i kronor', () => {
  it('räknar om typical med kursen', () => {
    expect(rowSek({ key: 'kaffe', typical: 3.3 }, 'EUR', rates)).toBe(36);
  });

  it('avrundar till jämna tiotal över 100 kr och till hela kronor under', () => {
    expect(roundSek(36.3)).toBe(36);
    expect(roundSek(99.6)).toBe(100);
    expect(roundSek(192.5)).toBe(190);
    expect(roundSek(4125)).toBe(4130);
    expect(rowSek({ key: 'hotell-3', low: 200, high: 450, typical: 375 }, 'EUR', rates)).toBe(4130);
    expect(rowSek({ key: 'enkel-maltid', typical: 17.5 }, 'EUR', rates)).toBe(190);
  });

  it('rad med bara typical räknas på typical', () => {
    expect(basis({ key: 'lask', typical: 5.4 })).toBe(5.4);
    expect(rowSek({ key: 'lask', typical: 5.4 }, 'EUR', rates)).toBe(59);
  });

  it('rad med bara spann räknas på mitten av spannet', () => {
    expect(basis({ key: 'ol', low: 4, high: 8 })).toBe(6);
    expect(rowSek({ key: 'ol', low: 4, high: 8 }, 'EUR', rates)).toBe(66);
    expect(rowSek({ key: 'hotell-4', low: 300, high: 900 }, 'EUR', rates)).toBe(6600);
  });

  it('valuta utan kurs ger inget belopp i kronor', () => {
    expect(rateFor('CHF', rates)).toBeNull();
    expect(rowSek({ key: 'kaffe', typical: 4 }, 'CHF', rates)).toBeNull();
    expect(rateFor('SEK', rates)).toBe(1);
  });

  it('belopp formateras efter appens språk', () => {
    setLocale('sv');
    expect(formatMoney(17.5, 'EUR').replace(/\s/g, ' ')).toBe('17,50 €');
    expect(formatMoney(2, 'EUR').replace(/\s/g, ' ')).toBe('2 €');
    setLocale('en');
    expect(formatMoney(17.5, 'EUR')).toBe('€17.50');
    setLocale('sv');
  });

  it('visar domännamnet utan www', () => {
    expect(domainOf('https://www.example.org/a/b')).toBe('example.org');
  });
});

describe('prissektionen', () => {
  const city = (id: string, p?: Prices) => ({ id, kind: 'city', data: p ? { prices: p } : {} });

  it('plats utan prices får ingen sektion', () => {
    expect(pricesOf({})).toBeNull();
    expect(pricesOf(null)).toBeNull();
    expect(priceView(city('XX-a'))).toBeNull();
  });

  it('plats med prices visar dem', () => {
    const p = prices();
    expect(priceView(city('XX-a', p))).toEqual({ own: p });
  });

  it('nivå utanför 1–5 visas inte', () => {
    expect(pricesOf({ prices: prices({ level: 6 }) })).toBeNull();
  });

  it('land utan egna priser visar städerna som har priser', () => {
    const p = prices({ level: 5 });
    const land = { id: 'XX', kind: 'country', data: {} };
    const a = city('XX-a', p);
    expect(priceView(land, [a, city('XX-b')])).toEqual({ cities: [{ place: a, prices: p }] });
    expect(priceView(land, [city('XX-b')])).toBeNull();
  });

  it('land med egna priser visar sina egna', () => {
    const own = prices({ level: 2 });
    expect(priceView({ id: 'XX', kind: 'country', data: { prices: own } }, [city('XX-a', prices())])).toEqual({ own });
  });
});
