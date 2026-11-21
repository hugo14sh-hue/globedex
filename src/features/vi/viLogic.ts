// Ren logik för fliken Vi: siffror, Wrapped, tidslinje och texten till Exportera till Claude.
// Allt räknas ut i appen. Testas i viLogic.test.ts.
import type { BadgeState, TripLike, ViInput } from './marken';
import { badgeStates, doneTrips, parseRule, tripDays, visitedContinents, visitedCountries, visitedRegions } from './marken';
import type { Badge } from '../../lib/texter';
import { isPersonView, viewStatuses, type StatusRow, type ViView } from '../../lib/togetherLogic';
import { countryIdFor } from '../../lib/statusLogic';
import { countryListTotal, countsAsCountry } from '../../lib/landlistor';
import { LOCALE } from '../../lib/locale';

// ---------- Vems siffror (Körning 22) ----------

type Find = ViInput['finds'][number];
type Check = ViInput['checks'][number];

/** Det som läget för siffrorna räknas från, utöver den inloggades underlag (ViInput). */
export interface ViSource {
  statusRows: StatusRow[];
  memberIds: string[];
  groupId: string;
  /** Fynd per medlem. Andras privata rader släpps inte igenom av RLS. */
  findsByUser: Record<string, Find[]>;
  /** Avbockade listpunkter per medlem. Andras privata rader släpps inte igenom av RLS. */
  checksByUser: Record<string, Check[]>;
  /** Gruppens omdömen med vem som skrev dem. */
  reviews: { created_by: string | null; created_at: string }[];
  /** Egen palett per medlem (profiles.settings). */
  customPaletteByUser: Record<string, boolean>;
}

/**
 * Märken som bygger på sådant som bara personen själv kan läsa (samlingar och Valvet).
 * De visas inte alls när man tittar på en annan medlem.
 */
export const OWN_ONLY_METRICS = new Set(['collection_entries_total', 'vault_items']);

/**
 * Fynden i gruppens lägen. Någon av oss: fynd som minst en medlem har (tidigaste datumet).
 * Tillsammans: fynd som alla medlemmar har (datumet när den sista hittade det).
 */
export function groupFinds(view: 'tillsammans' | 'nagon', findsByUser: Record<string, Find[]>, memberIds: string[]): Find[] {
  const by = new Map<string, { users: Set<string>; first: Find; last: Find }>();
  for (const u of memberIds)
    for (const f of findsByUser[u] ?? []) {
      const cur = by.get(f.compendium_id);
      if (!cur) {
        by.set(f.compendium_id, { users: new Set([u]), first: f, last: f });
        continue;
      }
      cur.users.add(u);
      // Någon av oss: tidigaste kända datumet. Tillsammans: senaste datumet, okänt om någon saknar datum.
      if (f.found_on && (!cur.first.found_on || f.found_on < cur.first.found_on)) cur.first = f;
      if (!f.found_on || (cur.last.found_on && f.found_on > cur.last.found_on)) cur.last = f;
    }
  const out: Find[] = [];
  for (const m of by.values()) {
    if (view === 'nagon') out.push(m.first);
    else if (memberIds.length && memberIds.every((u) => m.users.has(u))) out.push(m.last);
  }
  return out;
}

/**
 * Underlaget för valt läge. x är den inloggades underlag (platserna redan enligt personStatuses).
 * - null (solo) och jag: x som det är
 * - en annan medlem: den medlemmens platser, fynd, avbockat, omdömen och palett. Samlingar och Valvet är tomma.
 * - tillsammans och nagon: gruppens platser och fynd. Märken och tidslinje räknas inte i de lägena.
 * Resor, bucketlistan, sparade idéer, resekassan och packlistorna är gruppens och lika i alla lägen.
 */
export function viewInput(view: ViView | null, x: ViInput, me: string, src: ViSource): ViInput {
  if (!view || view === 'jag') return x;
  const statuses = viewStatuses(view, src.statusRows, me, src.memberIds, src.groupId);
  if (view === 'tillsammans' || view === 'nagon') return { ...x, statuses, finds: groupFinds(view, src.findsByUser, src.memberIds) };
  return {
    ...x,
    statuses,
    finds: src.findsByUser[view] ?? [],
    checks: src.checksByUser[view] ?? [],
    reviews: src.reviews.filter((r) => r.created_by === view),
    collectionEntries: [],
    vault: [],
    customPalette: src.customPaletteByUser[view] ?? false,
  };
}

/**
 * Märkena i valt läge. Tillsammans och Någon av oss: inga (null). En annan medlem: utan märken för
 * samlingar och Valvet. Solo (null) och jag: alla som visas i reseläget.
 */
export function viewBadges(view: ViView | null, list: Badge[], x: ViInput): BadgeState[] | null {
  if (view && !isPersonView(view)) return null;
  const own = !view || view === 'jag';
  return badgeStates(own ? list : list.filter((b) => !OWN_ONLY_METRICS.has(parseRule(b).metric)), x);
}

/** Märken som får ge toast och konfetti: bara den inloggades egna, i solo eller läget Jag. */
export const toastBadges = (view: ViView | null, states: BadgeState[] | null): BadgeState[] | null =>
  !view || view === 'jag' ? states : null;

// ---------- Siffror ----------

export interface Numbers {
  lander: string[];
  kontinenter: string[];
  landskap: string[];
  landskapTotalt: number;
  delstater: string[];
  delstaterTotalt: number;
  /** Antal länder i vald landlista (nämnaren för länder). */
  landerTotalt: number;
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
    delstater: Object.keys(visitedRegions(x, x.usStates)),
    delstaterTotalt: x.usStates.length,
    landerTotalt: countryListTotal(x.countryList, x.splitCountries),
    resor,
    resdagar: resor.reduce((s, t) => s + tripDays(t), 0),
    fynd: x.finds.length,
    fyndTotalt: compendiumTotal,
    bucket: x.bucket.filter((b) => b.done_on).length,
  };
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
  // Bara länder i vald landlista räknas.
  const countries = [...new Set(trips.filter((t) => t.place_id).map((t) => countryIdFor(t.place_id!, x.splitCountries)))].filter((c) => countsAsCountry(c, x.countryList, x.splitCountries)).sort();
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
