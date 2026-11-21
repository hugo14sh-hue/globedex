// Delade länder (Körning 19): länder som kan räknas som flera, till exempel Storbritannien som England,
// Skottland, Wales och Nordirland. Listan kommer från content/_landlistor.json (fältet delade) och läses in
// vid bygget, så att fler länder kan delas genom att bara ändra filen. Valet landlista.delade.val sparas i
// profiles.settings (splitCountries) och är förvalt på.
// Med valet på räknas, ritas och listas delarna i stället för landet. Med valet av är allt som förut och
// delarnas statusrader ligger kvar i databasen utan att visas. Landet och en del räknas aldrig samtidigt.
// Ren logik, testas i delade.test.ts.
import raw from '../../content/_landlistor.json';
import { CONTINENT_OF, type Continent } from './continents';
import { NO_OWN_FLAG } from './flagParts';
import type { PlaceStatus } from './statusLogic';

const ISO_RE = /^[A-Z]{2}$/;

/** Landet till dess delar, till exempel { GB: ['GB-eng', 'GB-sct', 'GB-wls', 'GB-nir'] }. */
export const SPLIT: Readonly<Record<string, readonly string[]>> = (raw as { delade?: Record<string, string[]> }).delade ?? {};

const PARENT = new Map<string, string>(Object.entries(SPLIT).flatMap(([iso, parts]) => parts.map((p) => [p, iso] as const)));

/** Förvalet: på, också för befintliga användare som inte har valt. */
export const DEFAULT_SPLIT = true;

/** Alla delar, i filens ordning. */
export const SPLIT_PARTS: readonly string[] = [...PARENT.keys()];

/** Är id en del av ett delat land (GB-eng)? */
export const isSplitPart = (id: string): boolean => PARENT.has(id);

/** Landet som delen hör till (GB-eng -> GB), annars null. */
export const splitParent = (id: string): string | null => PARENT.get(id) ?? null;

/** Är landet delat (GB)? */
export const isSplitCountry = (iso: string): boolean => Object.prototype.hasOwnProperty.call(SPLIT, iso);

/** Landets delar, eller en tom lista. */
export const splitParts = (iso: string): readonly string[] => (isSplitCountry(iso) ? SPLIT[iso] : []);

/** Är id ett land: en ISO-kod eller en del av ett delat land? */
export const isCountryId = (id: string): boolean => ISO_RE.test(id) || PARENT.has(id);

/** Landets ISO-kod för en plats: delens land för en del (GB-eng -> GB), annars de två första tecknen. */
export const isoOf = (id: string): string => PARENT.get(id) ?? id.slice(0, 2);

/**
 * Delen som en plats i ett delat land hör till, räknad ur id:t (Körning 21): GB-eng-london -> GB-eng.
 * I landsfilen har platsen landet som parent_id (GB) och ett id som börjar med delens id och ett bindestreck.
 * Landet (GB), delarna själva och platser i andra länder (SE-stockholm) ger null.
 */
export function partOf(id: string): string | null {
  for (const part of SPLIT_PARTS) if (id.startsWith(`${part}-`)) return part;
  return null;
}

/**
 * Platsens förälder i appen: delen för en plats som ligger direkt under ett delat land (GB-eng-london med
 * parent_id GB -> GB-eng), annars parent_id. Delarna själva har landet som förälder.
 */
export function parentOf(p: { id: string; parent_id: string | null }): string | null {
  if (!p.parent_id) return null;
  return (isSplitCountry(p.parent_id) && partOf(p.id)) || p.parent_id;
}

/**
 * Landet som en plats visas under: delen för en plats i en del (GB-eng-london -> GB-eng), en del är sitt eget
 * land, annars landets kod (de två första tecknen). Används där appen visar vilket land en plats ligger i.
 */
export const shownCountryOf = (id: string): string => (PARENT.has(id) ? id : (partOf(id) ?? id.slice(0, 2)));

/**
 * Landet som en plats räknas till med valet (Körning 21): med valet på delen (GB-eng-london -> GB-eng), med
 * valet av landet (GB). En del är alltid sitt eget land, som sedan Körning 19.
 */
export const countedCountryOf = (id: string, split: boolean): string => (PARENT.has(id) ? id : split ? shownCountryOf(id) : id.slice(0, 2));

/** Samma land, där ett delat land och en av dess delar räknas som samma (GB och GB-eng, men inte GB-eng och GB-sct)? */
export const sameCountry = (a: string, b: string): boolean => a === b || PARENT.get(a) === b || PARENT.get(b) === a;

/**
 * Flaggans fil i public/flags (utan .svg) för ett land eller en plats: delens egen flagga när den finns
 * (gb-eng, också för platser i delen som London), annars landets (gb). Delarna i src/lib/flagParts.ts visas
 * med landets flagga.
 */
export function flagCode(id: string): string {
  const part = PARENT.has(id) ? id : partOf(id);
  if (part) return (NO_OWN_FLAG.includes(part) ? PARENT.get(part)! : part).toLowerCase();
  return id.slice(0, 2).toLowerCase();
}

/** Världsdelen för ett land eller en del (delen får sitt lands världsdel). */
export const continentOf = (id: string): Continent | undefined => CONTINENT_OF[PARENT.get(id) ?? id];

/**
 * Ska platsens status visas och räknas med valet? Med valet på visas inte statusen på ett delat land (GB),
 * med valet av visas inte delarnas. Alla andra platser (också städer i landet) visas som förut.
 */
export const statusShown = (id: string, split: boolean): boolean => (split ? !isSplitCountry(id) : !PARENT.has(id));

/**
 * Visas statusväljaren på platsens sida? Med valet på har ett delat land (GB) ingen egen statusväljare:
 * sidan visar delarna i stället. Med valet av visas den som förut, och delarnas sidor har den alltid.
 */
export const showsStatusPicker = (id: string, split: boolean): boolean => !(split && isSplitCountry(id));

/** Bara de statusar som visas med valet. */
export function shownStatuses<T>(statuses: Record<string, T>, split: boolean): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, s] of Object.entries(statuses)) if (statusShown(id, split)) out[id] = s;
  return out;
}

/** Bara de rader vars plats visas med valet. */
export const shownRows = <R extends { place_id: string }>(rows: R[], split: boolean): R[] => rows.filter((r) => statusShown(r.place_id, split));

/** Landskoderna med valet: med valet på byts ett delat land mot sina delar. */
export function withSplit(codes: readonly string[], split: boolean): string[] {
  if (!split) return [...codes];
  return codes.flatMap((c) => (isSplitCountry(c) ? [...SPLIT[c]] : [c]));
}

/**
 * Förslaget för en del när användaren har markerat hela landet (karta.delade.flytta): landets status, så
 * länge ingen av landets delar har fått en status. Annars null. Bara med valet på.
 */
export function splitSuggestion(id: string, statuses: Record<string, PlaceStatus | undefined>, split: boolean): PlaceStatus | null {
  const parent = PARENT.get(id);
  if (!split || !parent) return null;
  const old = statuses[parent];
  if (!old) return null;
  return SPLIT[parent].some((p) => statuses[p]) ? null : old;
}

interface GeoFeature {
  properties?: { iso?: unknown } | null;
}

/**
 * Kartans länder med valet: med valet på byts ytorna för ett delat land (public/geo/lander.json) mot delarnas
 * (public/geo/delade.json), så att landet som helhet inte går att trycka på. Utan delarnas ytor (filen gick inte
 * att hämta) eller med valet av är länderna som förut.
 */
export function splitGeo<F extends GeoFeature>(lander: { features: F[] }, parts: { features: F[] } | null, split: boolean): { type: 'FeatureCollection'; features: F[] } {
  if (!split || !parts?.features.length) return { type: 'FeatureCollection', features: lander.features };
  const replaced = new Set(parts.features.map((f) => splitParent(String(f.properties?.iso ?? ''))).filter((x): x is string => Boolean(x)));
  return {
    type: 'FeatureCollection',
    features: [...lander.features.filter((f) => !replaced.has(String(f.properties?.iso ?? ''))), ...parts.features.filter((f) => isSplitPart(String(f.properties?.iso ?? '')))],
  };
}
