import type { PlaceSeason } from '../../lib/content';
import { dateFormat } from '../../lib/locale';
import type { Values } from '../../lib/texter';

/** Månadernas namn från webbläsaren på valt språk, januari först. Ingen egen text. */
export function monthNames(): { short: string; long: string }[] {
  const long = dateFormat({ month: 'long', timeZone: 'UTC' });
  const short = dateFormat({ month: 'narrow', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(2026, i, 15));
    return { short: short.format(d).toUpperCase(), long: long.format(d) };
  });
}

/** Korta månadsnamn från webbläsaren på valt språk (till exempel "jan."), januari först. Ingen egen text. */
export function shortMonthNames(): string[] {
  const f = dateFormat({ month: 'short', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2026, i, 15))));
}

/** Säsongens period med korta månadsnamn (smart.sasong.period). Bara månadens namn när from är lika med to. */
export function seasonPeriod(s: Pick<PlaceSeason, 'from' | 'to'>, t: (key: string, values?: Values) => string, names = shortMonthNames()): string {
  return s.from === s.to ? names[s.from - 1] : t('smart.sasong.period', { fran: names[s.from - 1], till: names[s.to - 1] });
}
