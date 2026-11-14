// Valutakurser för resekassan. Källa: Frankfurter (api.frankfurter.dev), som visar Europeiska
// centralbankens referenskurser. Gratis, ingen nyckel, öppen för anrop från webbläsaren.
// Villkor kontrollerade 2026-11-13, se slutrapporten för Körning 4:
// - Frankfurter: koden är MIT, inga kvoter, men begränsning mot missbruk. Datan följer leverantörens villkor.
// - ECB: fri att använda om ECB anges som källa och siffrorna återges korrekt. Kurserna är
//   referenskurser "for information purposes only", inte kurser för transaktioner.
// Kursen hämtas en gång när utgiften sparas och lagras på raden (expenses.rate_to_sek). Den ändras aldrig i efterhand.
import { LOCALE } from './locale';

export const RATE_SOURCE = { name: 'ECB', via: 'Frankfurter', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html' };

const API = 'https://api.frankfurter.dev/v2/providers/ecb/rate';

/** Valutor som ECB publicerar kurs för (ISO 4217). SEK först. */
export const CURRENCIES = [
  'SEK', 'EUR', 'NOK', 'DKK', 'ISK', 'GBP', 'USD', 'CHF', 'PLN', 'CZK', 'HUF', 'RON', 'TRY',
  'AUD', 'NZD', 'CAD', 'JPY', 'CNY', 'HKD', 'SGD', 'KRW', 'THB', 'MYR', 'IDR', 'PHP', 'INR',
  'ILS', 'MXN', 'BRL', 'ZAR',
] as const;

/** Valutans namn på svenska från webbläsaren. */
export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames([LOCALE], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface Rate {
  /** Kronor per en enhet av valutan. */
  rate: number;
  /** Datumet kursen gäller (närmast föregående bankdag). */
  date: string;
}

const cache = new Map<string, Rate>();

/**
 * Kursen till kronor för ett datum. Datum i framtiden räknas som idag (källan har bara publicerade kurser).
 * Svarar null om kursen inte går att hämta (offline, okänd valuta eller fel hos källan).
 */
export async function fetchRate(currency: string, date: string, today: string): Promise<Rate | null> {
  const code = currency.toUpperCase();
  if (code === 'SEK') return { rate: 1, date };
  if (!/^[A-Z]{3}$/.test(code)) return null;
  const day = date > today ? today : date;
  const key = `${code}:${day}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const res = await fetch(`${API}/${code.toLowerCase()}/sek?date=${day}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { rate?: unknown; date?: unknown };
    const rate = Number(j.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const out = { rate: Math.round(rate * 1e6) / 1e6, date: typeof j.date === 'string' ? j.date : day };
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}
