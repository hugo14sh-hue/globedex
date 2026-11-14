// Ren logik för fliken Vi: siffror, Wrapped, tidslinje och texten till Exportera till Claude.
// Allt räknas ut i appen. Testas i viLogic.test.ts.
import type { BadgeState, TripLike, ViInput } from './marken';
import { doneTrips, tripDays, visitedContinents, visitedCountries, visitedRegions } from './marken';
import { countryIdFor } from '../../lib/statusLogic';
import { displayNames, LOCALE } from '../../lib/locale';

// ---------- Siffror ----------

export interface Numbers {
  lander: string[];
  kontinenter: string[];
  landskap: string[];
  landskapTotalt: number;
  resor: TripLike[];
  resdagar: number;
  fynd: number;
  fyndTotalt: number;
  bucket: number;
}

export function numbers(x: ViInput, compendiumTotal: number): Numbers {
  const resor = doneTrips(x);
  return {
    lander: Object.keys(visitedCountries(x)).sort(),
    kontinenter: Object.keys(visitedContinents(x)).sort(),
    landskap: Object.keys(visitedRegions(x)),
    landskapTotalt: x.seRegions.length,
    resor,
    resdagar: resor.reduce((s, t) => s + tripDays(t), 0),
    fynd: x.finds.length,
    fyndTotalt: compendiumTotal,
    bucket: x.bucket.filter((b) => b.done_on).length,
  };
}

/** Kontinentens namn från webbläsaren (UN M49-koder), ingen egen text. */
const M49: Record<string, string> = { EU: '150', AS: '142', AF: '002', NA: '003', SA: '005', OC: '009', AN: 'AQ' };
export function continentName(code: string): string {
  try {
    return displayNames('region').of(M49[code] ?? code) ?? code;
  } catch {
    return code;
  }
}

// ---------- Wrapped ----------

/** Resor som räknas för ett år: resor (inte utflykter) som har börjat det året och inte ligger i framtiden. */
export const tripsInYear = (x: ViInput, year: number) =>
  x.trips.filter((t) => t.kind === 'resa' && t.start_date && t.start_date <= x.today && Number(t.start_date.slice(0, 4)) === year);

/** År att välja i Wrapped: år med minst en resa, nyast först, och alltid innevarande år. */
export function wrappedYears(x: ViInput): number[] {
  const ys = new Set<number>([Number(x.today.slice(0, 4))]);
  for (const t of x.trips) if (t.kind === 'resa' && t.start_date && t.start_date <= x.today) ys.add(Number(t.start_date.slice(0, 4)));
  return [...ys].sort((a, b) => b - a);
}

export interface WrappedYear {
  year: number;
  trips: number;
  countries: string[];
  days: number;
  finds: number;
  bucket: number;
  longest: { trip: TripLike; days: number } | null;
}

/** Året i siffror, eller null om året saknar resor (då visas wrapped.tom). */
export function wrapped(x: ViInput, year: number): WrappedYear | null {
  const trips = tripsInYear(x, year);
  if (!trips.length) return null;
  const y = String(year);
  const countries = [...new Set(trips.filter((t) => t.place_id).map((t) => countryIdFor(t.place_id!)))].sort();
  let longest: WrappedYear['longest'] = null;
  for (const t of trips) {
    const d = tripDays(t);
    if (!longest || d > longest.days) longest = { trip: t, days: d };
  }
  return {
    year,
    trips: trips.length,
    countries,
    days: trips.reduce((s, t) => s + tripDays(t), 0),
    finds: x.finds.filter((f) => f.found_on?.startsWith(y)).length,
    bucket: x.bucket.filter((b) => b.done_on?.startsWith(y)).length,
    longest,
  };
}

// ---------- Tidslinje ----------

export type TimelineType = 'resa' | 'fynd' | 'marke' | 'bucket';

export interface TimelineEvent {
  date: string;
  type: TimelineType;
  title: string;
  /** Märkets nivå (1 och uppåt) när märket har flera nivåer. */
  level?: number;
  /** Resans id, för länken till resan. */
  tripId?: string;
}

/**
 * Resor (som har börjat), fynd, märken och avbockade bucketpunkter, nyast först.
 * Märken utan känt datum (till exempel en egen palett) kommer inte med.
 */
export function timeline(x: ViInput, badges: BadgeState[], findName: (id: string) => string): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const t of x.trips) if (t.start_date && t.start_date <= x.today) out.push({ date: t.start_date, type: 'resa', title: t.title, tripId: t.id });
  // Fynd utan datum (samling.vet-inte-nar) hör inte hemma på tidslinjen.
  for (const f of x.finds) if (f.found_on) out.push({ date: f.found_on, type: 'fynd', title: findName(f.compendium_id) });
  for (const b of x.bucket) if (b.done_on) out.push({ date: b.done_on, type: 'bucket', title: b.title });
  for (const s of badges)
    s.dates.forEach((d, i) => {
      if (d) out.push({ date: d, type: 'marke', title: s.badge.name, level: s.levels.length > 1 ? i + 1 : undefined });
    });
  const rank: Record<TimelineType, number> = { resa: 0, marke: 1, bucket: 2, fynd: 3 };
  return out.sort((a, b) => b.date.localeCompare(a.date) || rank[a.type] - rank[b.type] || a.title.localeCompare(b.title, LOCALE));
}

// ---------- Exportera till Claude ----------

export type ExportPart = 'resor' | 'status' | 'listor' | 'omdomen';
export const EXPORT_PARTS: ExportPart[] = ['resor', 'status', 'listor', 'omdomen'];

/** Det som kan följa med i exporten. Valvet finns inte här och kan aldrig följa med. */
export interface ExportData {
  trips: { title: string; place: string | null; start: string | null; end: string | null; phase: string }[];
  statuses: { label: string; places: string[] }[];
  lists: { label: string; items: string[] }[];
  reviews: { name: string; place: string | null; rating: number | null; note: string | null }[];
}

/**
 * Bygger texten. Rubrikerna kommer från gränssnittets texter (heading), allt annat är användarens egen data.
 * Tomma delar hoppas över.
 */
export function exportText(d: ExportData, parts: ExportPart[], heading: (p: ExportPart) => string, rating: (n: number) => string): string {
  const blocks: string[] = [];
  const add = (p: ExportPart, lines: string[]) => {
    if (parts.includes(p) && lines.length) blocks.push([heading(p), ...lines].join('\n'));
  };
  add(
    'resor',
    d.trips.map((t) => {
      const when = t.start ? (t.end && t.end !== t.start ? `${t.start} – ${t.end}` : t.start) : '';
      return `- ${[t.title, t.place, when, t.phase].filter(Boolean).join(', ')}`;
    }),
  );
  add(
    'status',
    d.statuses.filter((s) => s.places.length).map((s) => `- ${s.label}: ${s.places.join(', ')}`),
  );
  add(
    'listor',
    d.lists.filter((l) => l.items.length).map((l) => `- ${l.label}: ${l.items.join(', ')}`),
  );
  add(
    'omdomen',
    d.reviews.map((r) => {
      const head = [r.name, r.place].filter(Boolean).join(', ');
      const tail = [r.rating != null ? rating(r.rating) : null, r.note].filter(Boolean).join('. ');
      return `- ${head}${tail ? `: ${tail}` : ''}`;
    }),
  );
  return blocks.join('\n\n');
}
