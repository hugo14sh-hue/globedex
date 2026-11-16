// Smart månad: månadens text (data.month_notes), händelser (data.events) och säsonger (data.seasons). Ren logik, testas i smartMonth.test.ts.
import type { PlaceEvent, PlaceSeason } from './content';

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

/** Minsta sträcka i pixlar för att ett svep över diagrammet ska byta månad. */
export const SWIPE_MIN = 40;

/**
 * Månaden efter ett svep över diagrammet: åt vänster nästa månad, åt höger föregående.
 * Svepet måste vara mer vågrätt än lodrätt och minst SWIPE_MIN långt. Stannar vid januari och december.
 */
export function swipedMonth(month: number, dx: number, dy: number): number {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return month;
  return Math.min(11, Math.max(0, month + (dx < 0 ? 1 : -1)));
}

/** Sant när säsongen pågår i månaden (0–11). from större än to går över årsskiftet, from lika med to är en månad. */
export function seasonCovers(s: Pick<PlaceSeason, 'from' | 'to'>, month: number): boolean {
  const m = month + 1;
  return s.from <= s.to ? m >= s.from && m <= s.to : m >= s.from || m <= s.to;
}

/** Säsonger som pågår i månaden (0–11), i filens ordning. */
export const seasonsInMonth = (seasons: PlaceSeason[] | null | undefined, month: number): PlaceSeason[] =>
  (seasons ?? []).filter((s) => seasonCovers(s, month));

/** Säsonger som pågår i någon av månaderna (0–11), i filens ordning. */
export const seasonsInMonths = (seasons: PlaceSeason[] | null | undefined, months: number[]): PlaceSeason[] =>
  (seasons ?? []).filter((s) => months.some((m) => seasonCovers(s, m)));

/** Sant när platsen har minst en säsong. */
export const hasSeasons = (seasons: unknown): seasons is PlaceSeason[] => Array.isArray(seasons) && seasons.length > 0;

/**
 * Månaderna (0–11) som en resa går under, från startdatum till slutdatum (ÅÅÅÅ-MM-DD). Utan slutdatum
 * bara startmånaden. Över ett år blir det alla tolv.
 */
export function monthsBetween(start: string, end?: string | null): number[] {
  const a = Number(start.slice(0, 4)) * 12 + monthOf(start);
  const b = end && end >= start ? Number(end.slice(0, 4)) * 12 + monthOf(end) : a;
  const out: number[] = [];
  for (let i = a; i <= Math.min(b, a + 11); i++) out.push(i % 12);
  return out;
}
