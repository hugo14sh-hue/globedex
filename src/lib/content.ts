// Innehållet från content/ (via Supabase). Bara läsning. Texterna kommer från Hugo, inget skrivs här.
import { supabase } from './supabase';
import { displayNames, LOCALE } from './locale';
import type { Prices } from './prices';

export type PlaceKind = 'country' | 'region' | 'city' | 'spot';

export interface StayOption {
  label: string;
  days: number;
  text: string;
  recommended?: boolean;
}

export interface PlaceData {
  stay?: StayOption[];
  day_budget_sek?: number;
  day_budget_note?: string;
  areas?: { name: string; stay: boolean; text: string }[];
  transport?: { mode: string; rating: 'bast' | 'bra' | 'dyrt'; text: string }[];
  flight_tips?: { title: string; text: string }[];
  best_text?: string;
  sources?: string[];
  /** Fält som är egen bedömning utan källa. Visas märkta som uppskattning. */
  own_judgment?: string[];
  /** Prisnivå och exempelpriser i lokal valuta. Läses med pricesOf i src/lib/prices.ts. */
  prices?: Prices;
}

export interface Place {
  id: string;
  kind: PlaceKind;
  parent_id: string | null;
  layer: string | null;
  name: string;
  iso2: string | null;
  lat: number | null;
  lon: number | null;
  airport: string | null;
  smart_months: number[] | null;
  data: PlaceData;
}

export interface PlaceFact {
  id: string;
  place_id: string;
  topic: string;
  is_rule: boolean;
  min_age: number | null;
  title: string;
  summary: string | null;
  body: string | null;
  source_url: string | null;
  verified_on: string | null;
}

export interface PlaceItem {
  id: string;
  place_id: string;
  category: string;
  name: string;
  summary: string | null;
  body: string | null;
  must_rank: number | null;
  lat: number | null;
  lon: number | null;
  compendium_id: string | null;
  source_url: string | null;
  verified_on: string | null;
}

export interface GiftTip {
  id: string;
  place_id: string;
  name: string;
  body: string | null;
  for_whom: string[];
  keywords: string[];
  price_sek: number | null;
  min_age: number | null;
  collection_motifs: Record<string, string>;
}

export interface HomeSuggestion {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

const PLACE_COLS = 'id, kind, parent_id, layer, name, iso2, lat, lon, airport, smart_months, data';

// Alla platser är få (några hundra). De hämtas en gång per besök och delas av karta och landssidor.
let placesPromise: Promise<Place[]> | null = null;

export function fetchPlaces(): Promise<Place[]> {
  if (!placesPromise) {
    placesPromise = (async () => must(await supabase.from('places').select(PLACE_COLS).order('name')) as Place[])();
    placesPromise.catch(() => {
      placesPromise = null;
    });
  }
  return placesPromise;
}

/** Förslag på hemort: städer i Sverige. Tom lista om innehållet inte är importerat. */
export async function fetchHomeSuggestions(): Promise<HomeSuggestion[]> {
  const places = await fetchPlaces();
  return places
    .filter((p) => p.kind === 'city' && (p.iso2 === 'SE' || p.id.startsWith('SE-')))
    .map((p) => ({ id: p.id, name: p.name, lat: p.lat ?? undefined, lon: p.lon ?? undefined }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}

/** Platsen och alla platser under den (regioner, städer, platser). */
export function descendants(places: Place[], id: string): Place[] {
  const out: Place[] = [];
  const walk = (pid: string) => {
    for (const p of places) {
      if (p.parent_id === pid) {
        out.push(p);
        walk(p.id);
      }
    }
  };
  walk(id);
  return out;
}

/** Landet som en plats ligger i (eller platsen själv om den är ett land). */
export function countryOf(places: Place[], id: string): Place | null {
  let p = places.find((x) => x.id === id) ?? null;
  for (let i = 0; p && p.kind !== 'country' && i < 10; i++) p = places.find((x) => x.id === p!.parent_id) ?? null;
  return p;
}

export async function fetchFacts(placeIds: string[]): Promise<PlaceFact[]> {
  if (!placeIds.length) return [];
  return must(await supabase.from('place_facts').select('*').in('place_id', placeIds).order('id')) as PlaceFact[];
}

export async function fetchItems(placeIds: string[]): Promise<PlaceItem[]> {
  if (!placeIds.length) return [];
  return must(await supabase.from('place_items').select('*').in('place_id', placeIds).order('id')) as PlaceItem[];
}

let markerPromise: Promise<PlaceItem[]> | null = null;

/** Listpunkter med position, för kartans läge Upptäck. */
export function fetchItemMarkers(): Promise<PlaceItem[]> {
  if (!markerPromise) {
    markerPromise = (async () =>
      must(await supabase.from('place_items').select('id, place_id, category, name, lat, lon').not('lat', 'is', null)) as PlaceItem[])();
    markerPromise.catch(() => {
      markerPromise = null;
    });
  }
  return markerPromise;
}

export async function fetchGifts(placeIds: string[]): Promise<GiftTip[]> {
  if (!placeIds.length) return [];
  return must(await supabase.from('gift_tips').select('*').in('place_id', placeIds).order('id')) as GiftTip[];
}

/** Sant om fältet är egen bedömning utan källa. */
export const isEstimate = (data: PlaceData | null | undefined, field: string) => Boolean(data?.own_judgment?.includes(field));

/** Landets namn på valt språk från webbläsaren, för länder som saknar innehåll. */
export function countryName(iso: string): string {
  try {
    return displayNames('region').of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/** Namn på en plats: innehållets namn, annars landets namn från webbläsaren. */
export const placeName = (places: Place[], id: string) =>
  places.find((p) => p.id === id)?.name ?? (/^[A-Z]{2}$/.test(id) ? countryName(id) : id);

// ---------- Listor: samlingsbok, bucketkatalog, idéer ----------

export type Rarity = 'vanlig' | 'ovanlig' | 'sallsynt' | 'legendarisk';
export const RARITIES: Rarity[] = ['vanlig', 'ovanlig', 'sallsynt', 'legendarisk'];

export type CostLevel = 'gratis' | 'billigt' | 'medel' | 'dyrt';
export const COST_LEVELS: CostLevel[] = ['gratis', 'billigt', 'medel', 'dyrt'];

/** Bucketkatalogens kategorier, i samma ordning som i content/_bucket.json. */
export const BUCKET_CATEGORIES = ['aventyr', 'natur', 'resa', 'mat', 'kultur', 'tillsammans', 'hemma', 'milstolpe'] as const;

export interface CompendiumItem {
  id: string;
  category: string;
  name: string;
  rarity: Rarity;
  icon: string | null;
  hint: string | null;
  place_id: string | null;
  source_url: string | null;
}

export interface BucketCatalogItem {
  id: string;
  name: string;
  category: string;
  cost_level: CostLevel | null;
  season: string | null;
  where_text: string | null;
  place_ids: string[];
  /** Delmål, se docs/FORMAT.md. Läses med parseChecklist. */
  checklist?: unknown;
}

export interface Idea {
  id: string;
  place_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  duration: string | null;
  cost_level: CostLevel | null;
  tags: string[];
  /** Restid med bil från place_id. Saknas i innehållet än. */
  drive_minutes: number | null;
  lat: number | null;
  lon: number | null;
}

/** Idéernas typer (ideas.kind) och taggar, i samma ordning som i docs/FORMAT.md. */
export const IDEA_KINDS = ['hemma', 'i-stan', 'ut-en-svang', 'dagstripp', 'helg', 'utflykt', 'fotboll'] as const;
export const IDEA_TAGS = ['inne', 'ute', 'gratis', 'nara'] as const;

/** Hämtar en gång per besök och delar svaret. Misslyckas hämtningen prövas den igen nästa gång. */
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = fn();
      p.catch(() => {
        p = null;
      });
    }
    return p;
  };
}

export const fetchCompendium = once(
  async () => must(await supabase.from('compendium_items').select('*').order('category').order('name')) as CompendiumItem[],
);

export const fetchBucketCatalog = once(async () => must(await supabase.from('bucket_catalog').select('*').order('id')) as BucketCatalogItem[]);

export const fetchIdeas = once(
  async () => must(await supabase.from('ideas').select('id, place_id, kind, title, body, duration, cost_level, tags, drive_minutes, lat, lon').order('id')) as Idea[],
);

/** Alla listpunkter (utan långa texter), för kortbunten. */
export const fetchAllItems = once(
  async () =>
    must(
      await supabase.from('place_items').select('id, place_id, category, name, summary, compendium_id, must_rank').order('id'),
    ) as Pick<PlaceItem, 'id' | 'place_id' | 'category' | 'name' | 'summary' | 'compendium_id' | 'must_rank'>[],
);
