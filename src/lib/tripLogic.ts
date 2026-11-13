// Ren logik för Resor: datum, nedräkning, fas, förslag och ordning på etapper. Testas i tripLogic.test.ts.

const DAY = 86_400_000;

/** Dagens datum som ÅÅÅÅ-MM-DD i lokal tid. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const utc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/** Hela dagar från a till b (b - a). */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);
}

export type Countdown = { key: 'resor.idag' } | { key: 'resor.imorgon' } | { key: 'resor.nedrakning'; dagar: number };

/** Nedräkning till avresan, eller null om resan redan har börjat eller saknar datum. */
export function countdown(start: string | null, today: string): Countdown | null {
  if (!start) return null;
  const d = daysBetween(today, start);
  if (d < 0) return null;
  if (d === 0) return { key: 'resor.idag' };
  if (d === 1) return { key: 'resor.imorgon' };
  return { key: 'resor.nedrakning', dagar: d };
}

export type TripPhase = 'kommande' | 'pagar' | 'avslutad';

export interface TripDates {
  status: 'planerad' | 'pagar' | 'klar';
  start_date: string | null;
  end_date: string | null;
}

/** Kommande, pågår eller avslutad, utifrån status och datum. */
export function tripPhase(t: TripDates, today: string): TripPhase {
  if (t.status === 'klar') return 'avslutad';
  const end = t.end_date ?? t.start_date;
  if (end && end < today) return 'avslutad';
  if (t.status === 'pagar' || (t.start_date && t.start_date <= today)) return 'pagar';
  return 'kommande';
}

/** Kommande och pågående resor med närmast avresa först, resor utan datum sist. Avslutade senast först. */
export function sortTrips<T extends TripDates & { created_at: string }>(trips: T[], today: string): { next: T[]; past: T[] } {
  const next = trips.filter((t) => tripPhase(t, today) !== 'avslutad');
  const past = trips.filter((t) => tripPhase(t, today) === 'avslutad');
  next.sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.created_at.localeCompare(b.created_at));
  past.sort((a, b) => (b.end_date ?? b.start_date ?? '').localeCompare(a.end_date ?? a.start_date ?? ''));
  return { next, past };
}

/** Nätter mellan två datum, eller null. */
export const nights = (start: string | null, end: string | null) => (start && end && end >= start ? daysBetween(start, end) : null);

/**
 * Förslag på datum för en månad (0 = januari): första dagen i månaden nästa gång den kommer,
 * men aldrig tidigare än i morgon. Hemresan läggs efter så många nätter.
 */
export function datesForMonth(month: number, nightCount: number, today: string): { start: string; end: string } {
  const [y, m] = today.split('-').map(Number);
  const year = month + 1 < m ? y + 1 : y;
  let start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const tomorrow = addDays(today, 1);
  if (start < tomorrow) start = tomorrow;
  return { start, end: addDays(start, Math.max(0, nightCount)) };
}

/** Ungefärlig budget: dagsbudget per person gånger dagar gånger personer. */
export const budgetSuggestion = (dayBudget: number | null | undefined, days: number, persons: number) =>
  dayBudget && days > 0 ? Math.round(dayBudget * days * Math.max(1, persons)) : null;

/** Bästa månaderna (betyg 5, annars högsta betyget) som index 0–11. */
export function bestMonths(scores: number[] | null | undefined): number[] {
  if (!scores || scores.length !== 12) return [];
  const top = Math.max(...scores);
  if (top <= 0) return [];
  return scores.map((s, i) => (s === top ? i : -1)).filter((i) => i >= 0);
}

// ---------- Etapper ----------

/** Flyttar en rad ett steg upp (-1) eller ned (+1) och numrerar om pos från 0. */
export function move<T extends { id: string; pos: number }>(list: T[], id: string, dir: -1 | 1): T[] {
  const sorted = [...list].sort((a, b) => a.pos - b.pos);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return sorted.map((x, k) => ({ ...x, pos: k }));
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((x, k) => ({ ...x, pos: k }));
}

/** Rader vars pos har ändrats, för att bara spara dem. */
export const changedPos = <T extends { id: string; pos: number }>(before: T[], after: T[]) =>
  after.filter((a) => before.find((b) => b.id === a.id)?.pos !== a.pos);

export interface Point {
  lat: number;
  lon: number;
}

/** Punkt en bit längs en rak linje mellan två punkter (f från 0 till 1). */
export const along = (a: Point, b: Point, f: number): Point => ({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f });

/** Finns platsen bland namnen (utan hänsyn till stora och små bokstäver)? Ger koordinaterna. */
export function findPoint(name: string, places: { name: string; lat: number | null; lon: number | null }[]): Point | null {
  const n = name.trim().toLocaleLowerCase('sv');
  if (!n) return null;
  const p = places.find((x) => x.name.toLocaleLowerCase('sv') === n && x.lat != null && x.lon != null);
  return p ? { lat: p.lat!, lon: p.lon! } : null;
}

// ---------- Packlista ----------

/** En rad i content/_packlista.json (formatet står i docs/FORMAT.md). */
export interface PackSuggestion {
  id: string;
  group: string;
  title: string;
  /** Gäller från så här många nätter. */
  min_nights?: number;
  /** Gäller till så här många nätter. */
  max_nights?: number;
  /** Månader 1–12 när saken behövs. Saknas: hela året. */
  months?: number[];
}

/**
 * Allmänna förslag som passar resans längd och månad, utan sådant som redan finns på listan.
 * Utan datum används bara förslag som gäller hela året och alla längder.
 */
export function packFor(list: PackSuggestion[], nightCount: number | null, month: number | null, existing: string[]): PackSuggestion[] {
  const have = new Set(existing.map((x) => x.trim().toLocaleLowerCase('sv')));
  return list.filter((s) => {
    if (have.has(s.title.trim().toLocaleLowerCase('sv'))) return false;
    if (s.min_nights != null || s.max_nights != null) {
      if (nightCount == null) return false;
      if (s.min_nights != null && nightCount < s.min_nights) return false;
      if (s.max_nights != null && nightCount > s.max_nights) return false;
    }
    if (s.months && s.months.length) {
      if (month == null) return false;
      if (!s.months.includes(month + 1)) return false;
    }
    return true;
  });
}
