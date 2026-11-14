// Prisnivå och exempelpriser för en plats (places.data.prices, formatet står i docs/FORMAT.md).
// Kurserna till kronor kommer från content/_valutor.json och läses in vid bygget, inte från databasen.
// Ren logik utan text: namnen och etiketterna kommer från t() i komponenten.
import rates from '../../content/_valutor.json';
import { numberFormat } from './locale';

export const PRICE_KEYS = [
  'enkel-maltid', 'middag-for-tva', 'snabbmat', 'ol', 'kaffe', 'lask', 'vatten', 'lokalresa', 'hotell-3', 'hotell-4',
] as const;
export type PriceKey = (typeof PRICE_KEYS)[number];

export interface PriceRow {
  key: PriceKey;
  low?: number;
  high?: number;
  typical?: number;
  note?: string;
}

export interface Prices {
  currency: string;
  level: number;
  checked: string;
  summary?: string;
  rows: PriceRow[];
  tips?: string[];
  sources: string[];
  own_judgment?: string[];
}

export interface RateFile {
  checked: string;
  source: string;
  sek_per: Record<string, number>;
}

export const RATES = rates as RateFile;

/** Platsens priser när de finns och går att visa (nivå 1–5 och en lista med rader), annars null. */
export function pricesOf(data: { prices?: unknown } | null | undefined): Prices | null {
  const p = data?.prices as Prices | undefined;
  if (!p || typeof p !== 'object' || !Array.isArray(p.rows)) return null;
  if (!Number.isInteger(p.level) || p.level < 1 || p.level > 5) return null;
  return p;
}

/** Kronor per en enhet av valutan, eller null när kursen saknas. SEK är alltid 1. */
export function rateFor(currency: string, file: RateFile = RATES): number | null {
  if (currency === 'SEK') return 1;
  const r = file.sek_per?.[currency];
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null;
}

/** Beloppet som räknas om: typical, annars mitten av spannet. */
export function basis(row: PriceRow): number | null {
  if (row.typical != null) return row.typical;
  if (row.low != null && row.high != null) return (row.low + row.high) / 2;
  return null;
}

/** Avrundning till kronor: jämna tiotal över 100 kr, hela kronor under. */
export function roundSek(n: number): number {
  return n > 100 ? Math.round(n / 10) * 10 : Math.round(n);
}

/** Radens belopp i kronor, eller null när kursen eller beloppet saknas. */
export function rowSek(row: PriceRow, currency: string, file: RateFile = RATES): number | null {
  const r = rateFor(currency, file);
  const b = basis(row);
  return r == null || b == null ? null : roundSek(b * r);
}

/** Har raden ett spann (både low och high)? */
export const hasRange = (row: PriceRow) => row.low != null && row.high != null;

/** Belopp i lokal valuta efter appens språk (APP_LOCALE). Decimaler bara när beloppet har det. */
export const formatMoney = (n: number, currency: string) =>
  numberFormat({ style: 'currency', currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);

/** Kronor efter appens språk, utan decimaler. */
export const formatKr = (n: number) => numberFormat({ style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);

/** Domännamnet i en källa, utan www. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface PricedPlace {
  kind: string;
  data: { prices?: unknown } | null;
}

/**
 * Vad prissektionen visar för en plats. En plats med egna priser visar dem. Ett land utan egna
 * priser visar städerna som har priser. Annars null: ingen sektion.
 */
export function priceView<T extends PricedPlace>(
  place: T,
  cities: T[] = [],
): { own: Prices } | { cities: { place: T; prices: Prices }[] } | null {
  const own = pricesOf(place.data);
  if (own) return { own };
  if (place.kind !== 'country') return null;
  const list = cities.flatMap((c) => {
    const p = c.kind === 'city' ? pricesOf(c.data) : null;
    return p ? [{ place: c, prices: p }] : [];
  });
  return list.length ? { cities: list } : null;
}
