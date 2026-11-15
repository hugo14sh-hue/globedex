// Smart månad: månadens text (data.month_notes) och händelser (data.events). Ren logik, testas i smartMonth.test.ts.
import type { PlaceEvent } from './content';

/** Månaden (0–11) i ett datum ÅÅÅÅ-MM-DD. */
const monthOf = (iso: string) => Number(iso.slice(5, 7)) - 1;

/**
 * Händelser som börjar eller slutar i månaden (0–11) och inte har passerat (sista dagen är i dag
 * eller senare). Sorterade efter startdatum.
 */
export function eventsInMonth(events: PlaceEvent[] | null | undefined, month: number, today: string): PlaceEvent[] {
  return (events ?? [])
    .filter((e) => (monthOf(e.start) === month || monthOf(e.end) === month) && e.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Sant när platsen har en text för varje månad. Annars visas rutan som förut. */
export const hasMonthNotes = (notes: unknown): notes is string[] =>
  Array.isArray(notes) && notes.length === 12 && notes.every((n) => typeof n === 'string');

/** Månaden som är vald från början: innevarande månad. */
export const currentMonth = (today: string) => monthOf(today);
