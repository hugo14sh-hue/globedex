// Ren logik för Idag: vald plats, vilka idéer som gäller, filter, slumpning och Nära. Testas i idagLogic.test.ts.
import type { Idea, Place } from './content';
import { addDays } from './tripLogic';
import { LOCALE } from './locale';

export type When = 'idag' | 'helg';
export type IdagView = 'slumpa' | 'nara' | 'sparade';
export type Range = '1h' | '3h' | 'dag' | 'helg';
export const RANGES: Range[] = ['1h', '3h', 'dag', 'helg'];

/**
 * Hur långt varje val i Nära sträcker sig, i minuter med bil enkel väg.
 * Egen bedömning: en dag räknas som högst 4 timmar dit, en helg som högst 8.
 */
export const RANGE_MINUTES: Record<Range, number> = { '1h': 60, '3h': 180, dag: 240, helg: 480 };

/**
 * Utan drive_minutes jämförs avståndet fågelvägen med en schablon: en minut med bil räknas som en kilometer
 * fågelvägen (vägen är ofta en tredjedel längre än fågelvägen och farten runt 80 km/h). Avståndet visas
 * alltid som avstånd, aldrig som restid.
 */
export const KM_PER_MINUTE = 1;

/** Hur nära en plats i innehållet måste vara för att räknas som vald plats (position eller egen plats). */
const SNAP_KM = 25;

export interface Point {
  lat: number;
  lon: number;
}

export type SpotKind = 'hemma' | 'sparad' | 'egen' | 'position';

/** Vald plats i Idag. */
export interface Spot {
  kind: SpotKind;
  name: string;
  lat: number | null;
  lon: number | null;
  /** saved_locations.id för sparade platser. */
  id?: string;
}

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Avstånd fågelvägen i km (haversine). */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const has = (p: { lat: number | null; lon: number | null } | null | undefined): p is { lat: number; lon: number } =>
  Boolean(p && p.lat != null && p.lon != null);

const norm = (s: string) => s.trim().toLocaleLowerCase(LOCALE);

/**
 * Platsen i innehållet som den valda platsen motsvarar: samma namn, annars närmaste stad eller plats
 * inom 25 km. null om ingen finns.
 */
export function resolvePlace(spot: Pick<Spot, 'name' | 'lat' | 'lon'>, places: Place[]): Place | null {
  const n = norm(spot.name);
  if (n) {
    const named = places.filter((p) => norm(p.name) === n);
    if (named.length) return named.find((p) => p.kind === 'city') ?? named[0];
  }
  if (!has(spot)) return null;
  let best: Place | null = null;
  let bestKm = SNAP_KM;
  for (const p of places) {
    if ((p.kind !== 'city' && p.kind !== 'spot') || !has(p)) continue;
    const km = distanceKm(spot, p);
    if (km <= bestKm) {
      best = p;
      bestKm = km;
    }
  }
  return best;
}

/** Koordinaterna för den valda platsen: egna, annars den motsvarande platsens. */
export function spotPoint(spot: Spot, place: Place | null): Point | null {
  if (has(spot)) return { lat: spot.lat, lon: spot.lon };
  if (has(place)) return { lat: place.lat, lon: place.lon };
  return null;
}

/** Platsen och alla platser under den, som id. */
export function subtreeIds(places: Place[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of places) {
      if (p.parent_id && ids.has(p.parent_id) && !ids.has(p.id)) {
        ids.add(p.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * Idéerna för vald plats och tid:
 * - idéer med place_id på platsen eller under den,
 * - idéer utan place_id: hemma bara när platsen är Hemma och tiden är Idag, övriga (ut en sväng) överallt,
 * - helgidéer bara i helgen.
 */
export function ideasHere(ideas: Idea[], places: Place[], placeId: string | null, atHome: boolean, when: When): Idea[] {
  const here = placeId ? subtreeIds(places, placeId) : new Set<string>();
  return ideas.filter((i) => {
    if (i.kind === 'helg' && when !== 'helg') return false;
    if (i.place_id) return here.has(i.place_id);
    if (i.kind === 'hemma') return atHome && when === 'idag';
    return true;
  });
}

export interface IdeaFilter {
  kinds: string[];
  costs: string[];
  tags: string[];
}

export const NO_FILTER: IdeaFilter = { kinds: [], costs: [], tags: [] };

/** Typ och kostnad: någon av de valda. Taggar: alla valda. Tomt val släpper igenom allt. */
export function applyFilter(ideas: Idea[], f: IdeaFilter): Idea[] {
  return ideas.filter(
    (i) =>
      (!f.kinds.length || f.kinds.includes(i.kind)) &&
      (!f.costs.length || (i.cost_level != null && f.costs.includes(i.cost_level))) &&
      f.tags.every((tag) => i.tags.includes(tag)),
  );
}

export const filterCount = (f: IdeaFilter) => f.kinds.length + f.costs.length + f.tags.length;

/** Lägger till eller tar bort ett värde i en lista. */
export const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Nästa idé i slumpen. Alla idéer visas en gång innan någon kommer igen, och samma idé kommer aldrig två
 * gånger i rad (om det finns fler än en). seen är de som redan visats i varvet.
 */
export function pickNext(pool: string[], seen: string[], current: string | null, rnd: () => number = Math.random): { id: string | null; seen: string[] } {
  if (!pool.length) return { id: null, seen: [] };
  let left = pool.filter((id) => !seen.includes(id) && id !== current);
  let used = seen.filter((id) => pool.includes(id));
  if (!left.length) {
    left = pool.filter((id) => id !== current);
    used = [];
    if (!left.length) return { id: pool[0], seen: [pool[0]] };
  }
  const id = left[Math.min(left.length - 1, Math.floor(rnd() * left.length))];
  return { id, seen: [...used, ...(current && !used.includes(current) ? [current] : []), id] };
}

// ---------- Nära ----------

export type NearItem =
  | { type: 'idea'; key: string; idea: Idea; point: Point; km: number; minutes: number | null }
  | { type: 'place'; key: string; place: Place; point: Point; km: number; minutes: null };

/** Idéns koordinater: egna, annars platsens. */
export function ideaPoint(idea: Idea, places: Place[]): Point | null {
  if (has(idea)) return { lat: idea.lat, lon: idea.lon };
  const p = idea.place_id ? places.find((x) => x.id === idea.place_id) : null;
  return has(p) ? { lat: p.lat, lon: p.lon } : null;
}

/**
 * Idéer och platser inom valt avstånd från vald plats, närmast först.
 * drive_minutes gäller från idéns place_id, så den används bara när vald plats är just den platsen.
 * Idéer utan place_id (fungerar överallt) och hemmaidéer tas inte med. Platser är städer och platser
 * (inte länder och regioner), utom den valda platsen själv.
 */
export function nearby(origin: Point, originPlaceId: string | null, ideas: Idea[], places: Place[], range: Range, when: When): NearItem[] {
  const limit = RANGE_MINUTES[range];
  const out: NearItem[] = [];
  for (const idea of ideas) {
    if (!idea.place_id || idea.kind === 'hemma') continue;
    if (idea.kind === 'helg' && when !== 'helg') continue;
    const point = ideaPoint(idea, places);
    if (!point) continue;
    const km = distanceKm(origin, point);
    const minutes = idea.drive_minutes != null && idea.place_id === originPlaceId ? idea.drive_minutes : null;
    const inside = minutes != null ? minutes <= limit : km <= limit * KM_PER_MINUTE;
    if (inside) out.push({ type: 'idea', key: `i:${idea.id}`, idea, point, km, minutes });
  }
  for (const place of places) {
    if ((place.kind !== 'city' && place.kind !== 'spot') || place.id === originPlaceId || !has(place)) continue;
    const point = { lat: place.lat, lon: place.lon };
    const km = distanceKm(origin, point);
    if (km <= limit * KM_PER_MINUTE) out.push({ type: 'place', key: `p:${place.id}`, place, point, km, minutes: null });
  }
  return out.sort((a, b) => (a.minutes ?? a.km / KM_PER_MINUTE) - (b.minutes ?? b.km / KM_PER_MINUTE));
}

// ---------- Format ----------

const km1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const km0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** Kilometer som text: en decimal under 10 km. */
export const formatKm = (km: number) => (km < 10 ? km1 : km0).format(km);

const hourFmt = new Intl.NumberFormat(LOCALE, { style: 'unit', unit: 'hour', unitDisplay: 'short' });
const minFmt = new Intl.NumberFormat(LOCALE, { style: 'unit', unit: 'minute', unitDisplay: 'short' });

/** Minuter som restid i webbläsarens svenska format, till exempel "1 tim 15 min". */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  if (!h) return minFmt.format(rest);
  return rest ? `${hourFmt.format(h)} ${minFmt.format(rest)}` : hourFmt.format(h);
}

// ---------- Gör om till resa ----------

/** Datum för en utflykt: idag, eller helgen (lördag och söndag, eller bara söndag om det redan är söndag). */
export function outingDates(when: When, today: string): { start: string; end: string } {
  if (when === 'idag') return { start: today, end: today };
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = söndag
  if (dow === 0) return { start: today, end: today };
  const sat = addDays(today, 6 - dow);
  return { start: sat, end: addDays(sat, 1) };
}
