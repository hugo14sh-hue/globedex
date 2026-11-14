import { dateFormat } from '../../lib/locale';

/** Månadernas namn från webbläsaren på valt språk, januari först. Ingen egen text. */
export function monthNames(): { short: string; long: string }[] {
  const long = dateFormat({ month: 'long', timeZone: 'UTC' });
  const short = dateFormat({ month: 'narrow', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(2026, i, 15));
    return { short: short.format(d).toUpperCase(), long: long.format(d) };
  });
}
