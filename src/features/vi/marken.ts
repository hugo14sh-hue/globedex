// Märken: uträkningen för varje märke i listan marken i content/_texter.json. Allt räknas ut i appen.
// Varje mått ger en lista med händelser (ett datum per sak som räknas). Värdet är antalet, och datumet
// då en nivå nåddes är händelsen med samma nummer i datumordning. Det ger märkena en plats i tidslinjen
// utan någon tabell. Testas i marken.test.ts.
import type { TravelMode } from '../../config';
import { balances, settle, spent, type ExpenseLike } from '../../lib/kassa';
import type { Badge } from '../../lib/texter';
import { CONTINENT_OF } from '../../lib/continents';
import { tripPhase, todayIso } from '../../lib/tripLogic';
import type { PlaceStatus } from '../../lib/statusLogic';
import type { Rarity } from '../../lib/content';

/** Statusar som räknas som besökt. Mellanlandat räknas inte. */
export const VISITED: PlaceStatus[] = ['bor', 'bott', 'besokt'];

export interface TripLike {
  id: string;
  title: string;
  place_id: string | null;
  kind: 'resa' | 'utflykt';
  status: 'planerad' | 'pagar' | 'klar';
  start_date: string | null;
  end_date: string | null;
  budget: Record<string, number>;
  created_at: string;
}

/** Allt som märken, siffror, Wrapped och tidslinjen räknas från. */
export interface ViInput {
  mode: TravelMode;
  today: string;
  /** Egen platsstatus, med senaste ändring. */
  statuses: { place_id: string; status: PlaceStatus; updated_at: string | null }[];
  /** Sveriges landskap i innehållet (places med layer landskap). */
  seRegions: string[];
  /** Gruppens resor. */
  trips: TripLike[];
  legCounts: Record<string, number>;
  finds: { compendium_id: string; found_on: string | null; place_id: string | null }[];
  rarity: Record<string, Rarity>;
  /** Listpunkter per plats (place_items). */
  itemsByPlace: Record<string, string[]>;
  checks: { item_id: string; done_on: string }[];
  bucket: { id: string; catalog_id: string | null; title: string; done_on: string | null }[];
  /** Gemensamma ja i swipe, med när den sista rösten kom. */
  matches: { id: string; date: string | null }[];
  savedIdeas: { done_at?: string | null }[];
  reviews: { created_at: string }[];
  collectionEntries: { got_on: string }[];
  expensesByTrip: Record<string, ExpenseLike[]>;
  memberIds: string[];
  /** Packlistan per resa: [packat, totalt, när sista raden packades (null eller saknas: okänt)]. */
  packing: Record<string, [number, number, (string | null)?]>;
  vault: { updated_at: string | null }[];
  customPalette: boolean;
}

export const emptyInput = (mode: TravelMode = 'solo', today = todayIso()): ViInput => ({
  mode,
  today,
  statuses: [],
  seRegions: [],
  trips: [],
  legCounts: {},
  finds: [],
  rarity: {},
  itemsByPlace: {},
  checks: [],
  bucket: [],
  matches: [],
  savedIdeas: [],
  reviews: [],
  collectionEntries: [],
  expensesByTrip: {},
  memberIds: [],
  packing: {},
  vault: [],
  customPalette: false,
});

/** Ett datum som ÅÅÅÅ-MM-DD, eller null. */
const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);

/** Dagen i lokal tid för en tidpunkt (ÅÅÅÅ-MM-DD). */
export const localDay = (iso: string) => todayIso(new Date(iso));

/** En händelse: datumet då saken räknades (null om det inte går att veta). */
export type Events = (string | null)[];

// ---------- Hjälp för resor ----------

/** Resans dagar, hemresedagen inräknad. Utan slutdatum: en dag. */
export function tripDays(t: Pick<TripLike, 'start_date' | 'end_date'>): number {
  if (!t.start_date) return 0;
  const end = t.end_date && t.end_date >= t.start_date ? t.end_date : t.start_date;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${t.start_date}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Genomförda resor (inte utflykter). */
export const doneTrips = (x: ViInput) => x.trips.filter((t) => t.kind === 'resa' && tripPhase(t, x.today) === 'avslutad');

const tripDate = (t: TripLike) => t.end_date ?? t.start_date ?? day(t.created_at);

/** Besökta länder med datum (ISO-kod -> senaste ändring). */
export function visitedCountries(x: ViInput): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const s of x.statuses) if (/^[A-Z]{2}$/.test(s.place_id) && VISITED.includes(s.status)) out[s.place_id] = day(s.updated_at);
  return out;
}

/** Besökta kontinenter med datum för första landet där. */
export function visitedContinents(x: ViInput): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [iso, d] of Object.entries(visitedCountries(x))) {
    const c = CONTINENT_OF[iso];
    if (!c) continue;
    if (!(c in out) || (d && (!out[c] || d < out[c]!))) out[c] = d;
  }
  return out;
}

export function visitedRegions(x: ViInput): Record<string, string | null> {
  const set = new Set(x.seRegions);
  const out: Record<string, string | null> = {};
  for (const s of x.statuses) if (set.has(s.place_id) && VISITED.includes(s.status)) out[s.place_id] = day(s.updated_at);
  return out;
}

/** Platser där allt på listan är avbockat, med dagen då sista punkten bockades av. */
export function fullyChecked(x: ViInput): Record<string, string | null> {
  const done = new Map(x.checks.map((c) => [c.item_id, c.done_on]));
  const out: Record<string, string | null> = {};
  for (const [place, items] of Object.entries(x.itemsByPlace)) {
    if (!items.length || !items.every((i) => done.has(i))) continue;
    out[place] = items.map((i) => done.get(i)!).sort().pop() ?? null;
  }
  return out;
}

const RARITY_RANK: Record<Rarity, number> = { vanlig: 0, ovanlig: 1, sallsynt: 2, legendarisk: 3 };

/** Den första dagen i varje kalendermånad (1–12) som någon påbörjad resa har pågått. */
export function tripMonths(x: ViInput): Record<number, string> {
  const out: Record<number, string> = {};
  for (const t of x.trips) {
    if (!t.start_date || t.start_date > x.today) continue;
    const days = Math.min(tripDays(t), 400);
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.parse(`${t.start_date}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
      if (d > x.today) break;
      const m = Number(d.slice(5, 7));
      if (!out[m] || d < out[m]) out[m] = d;
    }
  }
  return out;
}

// ---------- Måtten ----------

type Metric = (x: ViInput, arg: string[]) => Events;

export const METRICS: Record<string, Metric> = {
  countries_visited: (x) => Object.values(visitedCountries(x)),
  continents_visited: (x) => Object.values(visitedContinents(x)),
  visited_all: (x, list) => {
    const v = visitedCountries(x);
    return list.filter((c) => c in v).map((c) => v[c]);
  },
  se_regions_visited: (x) => Object.values(visitedRegions(x)),
  trips_done: (x) => doneTrips(x).map(tripDate),
  // Tröskeln gäller en enskild resa: arg är minsta antal dagar eller etapper.
  longest_trip_days: (x, [min]) => doneTrips(x).filter((t) => tripDays(t) >= Number(min ?? 1)).map(tripDate),
  max_legs_in_trip: (x, [min]) =>
    x.trips.filter((t) => (x.legCounts[t.id] ?? 0) >= Number(min ?? 1)).map((t) => t.start_date ?? day(t.created_at)),
  finds_total: (x) => x.finds.map((f) => f.found_on),
  finds_rarity_sallsynt: (x) => x.finds.filter((f) => RARITY_RANK[x.rarity[f.compendium_id] ?? 'vanlig'] >= RARITY_RANK.sallsynt).map((f) => f.found_on),
  finds_rarity_legendarisk: (x) => x.finds.filter((f) => x.rarity[f.compendium_id] === 'legendarisk').map((f) => f.found_on),
  places_fully_checked: (x) => Object.values(fullyChecked(x)),
  bucket_done: (x) => x.bucket.filter((b) => b.done_on).map((b) => b.done_on),
  bucket_custom_done: (x) => x.bucket.filter((b) => b.done_on && !b.catalog_id).map((b) => b.done_on),
  swipe_matches: (x) => x.matches.map((m) => day(m.date)),
  saved_ideas_done: (x) => x.savedIdeas.filter((i) => i.done_at).map((i) => day(i.done_at)),
  reviews_total: (x) => x.reviews.map((r) => day(r.created_at)),
  collection_entries_total: (x) => x.collectionEntries.map((e) => e.got_on),
  trip_settled: (x) =>
    doneTrips(x)
      .filter((t) => {
        const ex = x.expensesByTrip[t.id] ?? [];
        return x.memberIds.length > 1 && ex.length > 0 && settle(balances(ex, x.memberIds)).length === 0;
      })
      .map(tripDate),
  trip_under_budget: (x) =>
    doneTrips(x)
      .filter((t) => {
        const total = Number(t.budget?.total ?? 0);
        const ex = x.expensesByTrip[t.id] ?? [];
        return total > 0 && ex.length > 0 && spent(ex).total <= total * 100;
      })
      .map(tripDate),
  // Hela listan packad, och sista raden bockad (packed_at) före avresedagen. Datumet är den dagen.
  // Rader som bockades innan packed_at fanns ger ingen tidpunkt: då räknas listan som packad före
  // avresan, med avresedagen (eller i dag för en kommande resa) som datum.
  packing_all_done_before_departure: (x) =>
    x.trips.flatMap((t) => {
      const p = x.packing[t.id];
      if (!p || p[1] === 0 || p[0] !== p[1]) return [];
      const last = p[2] ? localDay(p[2]) : null;
      if (!last) return [t.start_date && t.start_date <= x.today ? t.start_date : x.today];
      return !t.start_date || last < t.start_date ? [last] : [];
    }),
  distinct_trip_months: (x) => Object.values(tripMonths(x)),
  vault_items: (x) => x.vault.map((v) => day(v.updated_at)),
  custom_palette: (x) => (x.customPalette ? [null] : []),
};

export interface ParsedRule {
  metric: string;
  arg: string[];
  levels: number[];
}

/** Mått där tröskeln gäller en enskild resa (en resa på minst 14 dagar), inte ett antal. */
const PER_TRIP = new Set(['longest_trip_days', 'max_legs_in_trip']);

/** Tolkar rule ur _texter.json: "mått", "mått >= n", "mått == true" eller "visited_all: A, B". */
export function parseRule(b: Pick<Badge, 'rule' | 'levels'>): ParsedRule {
  const r = b.rule.trim();
  const all = /^visited_all:\s*(.+)$/.exec(r);
  if (all) {
    const list = all[1].split(',').map((s) => s.trim()).filter(Boolean);
    return { metric: 'visited_all', arg: list, levels: [list.length] };
  }
  const ge = /^(\w+)\s*>=\s*(\d+)$/.exec(r);
  if (ge) {
    const n = Number(ge[2]);
    if (PER_TRIP.has(ge[1])) return { metric: ge[1], arg: [ge[2]], levels: [1] };
    return { metric: ge[1], arg: [], levels: [n] };
  }
  const eq = /^(\w+)\s*==\s*true$/.exec(r);
  if (eq) return { metric: eq[1], arg: [], levels: [1] };
  return { metric: r, arg: [], levels: b.levels?.length ? b.levels : [1] };
}

/** Händelserna för ett märke. */
export function badgeEvents(p: ParsedRule, x: ViInput): Events {
  const m = METRICS[p.metric];
  return m ? m(x, p.arg) : [];
}

/** Märken som bara gäller par och grupp (döljs i solo). */
export const GROUP_ONLY = new Set(['swipe_matches', 'trip_settled']);

export interface BadgeState {
  badge: Badge;
  value: number;
  levels: number[];
  /** Antal nådda nivåer (0 = låst). */
  level: number;
  /** Nästa nivås tröskel, eller null när alla är klara. */
  next: number | null;
  earned: boolean;
  /** Datum då varje nådd nivå nåddes (null om det inte går att veta). */
  dates: (string | null)[];
}

/** Sorterar händelser: kända datum först i datumordning, okända sist. */
const sortEvents = (e: Events) => [...e].sort((a, b) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0));

export function badgeState(b: Badge, x: ViInput): BadgeState {
  const p = parseRule(b);
  const ev = sortEvents(badgeEvents(p, x));
  const value = ev.length;
  const level = p.levels.filter((l) => value >= l).length;
  // Datumet då nivån nåddes: den händelse som gjorde att antalet nådde tröskeln. Okända datum gör nivåns datum okänt.
  const dates = p.levels.slice(0, level).map((l) => (ev.slice(0, l).some((d) => !d) ? null : ev[l - 1]));
  return { badge: b, value, levels: p.levels, level, next: p.levels[level] ?? null, earned: level > 0, dates };
}

/** Alla märken som visas i reseläget. */
export function badgeStates(list: Badge[], x: ViInput): BadgeState[] {
  return list.filter((b) => x.mode !== 'solo' || !GROUP_ONLY.has(parseRule(b).metric)).map((b) => badgeState(b, x));
}
