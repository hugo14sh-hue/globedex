// Delmål på bucketpunkter. Katalogen (bucket_catalog.checklist) säger vilka delmål en punkt har, och
// avbockningar som görs för hand sparas i bucket_items.parts som [{ title, done, done_at }].
// Tre former, se docs/FORMAT.md:
//   platser: en rad per plats. Med place_ids eller parent_id + layer bockas raden av automatiskt när platsen
//            har status besökt, bor eller har bott. Med source "besokta-lander" listas länder med status
//            besökt, och där bockar man av själv.
//   antal:   en stapel med framsteg, ur samma uträkning som Siffror.
//   delar:   en rad per titel som man bockar av själv.
// Egna punkter (utan katalog) kan ha egna delmål, som bara finns i parts. Testas i bucketParts.test.ts.
import { emptyInput, VISITED, visitedContinents, visitedCountries } from '../features/vi/marken';
import type { PlaceStatus } from './statusLogic';
import type { CountryList } from '../config';
import { countsAsCountry, DEFAULT_COUNTRY_LIST } from './landlistor';
import { LOCALE } from './locale';

export type CountMetric = 'countries_visited' | 'continents_visited';

export type Checklist =
  | { type: 'platser'; place_ids: string[] }
  | { type: 'platser'; parent_id: string; layer: string }
  | { type: 'platser'; source: 'besokta-lander' }
  | { type: 'antal'; metric: CountMetric; target: number }
  | { type: 'delar'; items: string[] };

export interface Part {
  title: string;
  done: boolean;
  done_at: string | null;
}

export interface PartRow {
  title: string;
  done: boolean;
  /** Bockas av automatiskt från kartan och går inte att bocka av för hand. */
  auto: boolean;
  placeId?: string;
}

export type PartsView =
  | {
      kind: 'rader';
      rows: PartRow[];
      done: number;
      total: number;
      own: boolean;
    }
  | {
      kind: 'antal';
      metric: CountMetric;
      value: number;
      done: number;
      total: number;
    };

export interface PartsContext {
  places: {
    id: string;
    name: string;
    parent_id: string | null;
    layer: string | null;
  }[];
  statuses: Record<string, PlaceStatus>;
  name: (id: string) => string;
  /** Vilka länder som räknas (Anpassning). Saknas: alla. */
  countryList?: CountryList;
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Läser checklist ur databasen. Okända eller trasiga former blir null (inga delmål). */
export function parseChecklist(v: unknown): Checklist | null {
  if (!isObj(v)) return null;
  if (v.type === 'platser') {
    if (Array.isArray(v.place_ids) && v.place_ids.every((x) => typeof x === 'string'))
      return { type: 'platser', place_ids: v.place_ids as string[] };
    if (typeof v.parent_id === 'string' && typeof v.layer === 'string') return { type: 'platser', parent_id: v.parent_id, layer: v.layer };
    if (v.source === 'besokta-lander') return { type: 'platser', source: 'besokta-lander' };
    return null;
  }
  if (
    v.type === 'antal' &&
    (v.metric === 'countries_visited' || v.metric === 'continents_visited') &&
    Number.isInteger(v.target) &&
    (v.target as number) > 0
  )
    return { type: 'antal', metric: v.metric, target: v.target as number };
  if (v.type === 'delar' && Array.isArray(v.items) && v.items.every((x) => typeof x === 'string'))
    return { type: 'delar', items: v.items as string[] };
  return null;
}

/** Läser parts ur databasen. Rader utan titel tas bort. */
export function parseParts(v: unknown): Part[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is Record<string, unknown> => isObj(p) && typeof p.title === 'string' && p.title.trim() !== '')
    .map((p) => ({
      title: p.title as string,
      done: p.done === true,
      done_at: typeof p.done_at === 'string' ? p.done_at : null,
    }));
}

const statusList = (statuses: Record<string, PlaceStatus>) =>
  Object.entries(statuses).map(([place_id, status]) => ({
    place_id,
    status,
    updated_at: null,
  }));

/** Samma uträkning som Siffror: antal besökta länder eller kontinenter i vald landlista. */
export function visitedCount(metric: CountMetric, statuses: Record<string, PlaceStatus>, countryList: CountryList = DEFAULT_COUNTRY_LIST): number {
  const x = { ...emptyInput(), statuses: statusList(statuses), countryList };
  return Object.keys(metric === 'countries_visited' ? visitedCountries(x) : visitedContinents(x)).length;
}

const manual = (title: string, parts: Part[]): PartRow => ({
  title,
  done: parts.some((p) => p.title === title && p.done),
  auto: false,
});

/** Delmålen för en punkt, eller null om den inte har några. */
export function bucketParts(checklist: Checklist | null, partsRaw: unknown, ctx: PartsContext): PartsView | null {
  const parts = parseParts(partsRaw);
  const rows = (list: PartRow[], own = false): PartsView => ({
    kind: 'rader',
    rows: list,
    done: list.filter((r) => r.done).length,
    total: list.length,
    own,
  });
  const auto = (id: string): PartRow => ({
    title: ctx.name(id),
    done: VISITED.includes(ctx.statuses[id]),
    auto: true,
    placeId: id,
  });

  if (!checklist)
    return parts.length
      ? rows(
          parts.map((p) => ({ title: p.title, done: p.done, auto: false })),
          true,
        )
      : null;
  if (checklist.type === 'antal') {
    const value = visitedCount(checklist.metric, ctx.statuses, ctx.countryList);
    return {
      kind: 'antal',
      metric: checklist.metric,
      value,
      done: Math.min(value, checklist.target),
      total: checklist.target,
    };
  }
  if (checklist.type === 'delar') return rows(checklist.items.map((title) => manual(title, parts)));
  if ('place_ids' in checklist) return rows(checklist.place_ids.map(auto));
  if ('parent_id' in checklist) {
    const { parent_id, layer } = checklist;
    return rows(
      ctx.places
        .filter((p) => p.parent_id === parent_id && p.layer === layer)
        .sort((a, b) => a.name.localeCompare(b.name, LOCALE))
        .map((p) => auto(p.id)),
    );
  }
  // Länder i vald landlista med status besökt. Man bockar av själv, och titeln är landets namn.
  const countries = Object.entries(ctx.statuses)
    .filter(([id, s]) => countsAsCountry(id, ctx.countryList ?? DEFAULT_COUNTRY_LIST) && s === 'besokt')
    .map(([id]) => ({ id, name: ctx.name(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE));
  return rows(countries.map((c) => ({ ...manual(c.name, parts), placeId: c.id })));
}

/** Sant när punkten har delmål och alla är klara. */
export const allPartsDone = (v: PartsView | null) => Boolean(v && v.total > 0 && v.done >= v.total);

/** Bockar av eller tar bort bocken på ett delmål som görs för hand. */
export function toggledParts(partsRaw: unknown, title: string, now = new Date()): Part[] {
  const parts = parseParts(partsRaw);
  const i = parts.findIndex((p) => p.title === title);
  const done = i < 0 ? true : !parts[i].done;
  const next: Part = { title, done, done_at: done ? now.toISOString() : null };
  return i < 0 ? [...parts, next] : parts.map((p, j) => (j === i ? next : p));
}

/** Lägger till ett eget delmål. Samma titel läggs inte till två gånger. */
export function addedPart(partsRaw: unknown, title: string): Part[] {
  const parts = parseParts(partsRaw);
  const t = title.trim();
  if (!t || parts.some((p) => p.title === t)) return parts;
  return [...parts, { title: t, done: false, done_at: null }];
}
