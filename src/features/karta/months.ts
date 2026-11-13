/** Månadernas namn från webbläsaren (svenska), januari först. Ingen egen text. */
export function monthNames(): { short: string; long: string }[] {
  const long = new Intl.DateTimeFormat('sv-SE', { month: 'long', timeZone: 'UTC' });
  const short = new Intl.DateTimeFormat('sv-SE', { month: 'narrow', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(2026, i, 15));
    return { short: short.format(d).toUpperCase(), long: long.format(d) };
  });
}
