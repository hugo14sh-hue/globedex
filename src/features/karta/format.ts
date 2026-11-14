// Format för belopp, procent och datum efter appens språk (LOCALE). Ingen egen text.
// Kronor visas som kr på svenska och SEK på engelska (webbläsarens format för en-GB).
import { dateFormat, numberFormat } from '../../lib/locale';
const sek = () => numberFormat({ style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
const date = () => dateFormat({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const pct = () => numberFormat({ style: 'percent', maximumFractionDigits: 0 });

export const formatSek = (n: number) => sek().format(n);
/** Procent efter appens språk. n är 0–100. */
export const formatPercent = (n: number) => pct().format(n / 100);
/** Valutans symbol efter appens språk, till exempel kr för SEK på svenska. */
export const currencySymbol = (code: string) =>
  numberFormat({ style: 'currency', currency: code }).formatToParts(0).find((x) => x.type === 'currency')?.value ?? code;

export function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : date().format(d);
}
