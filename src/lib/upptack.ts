// Fliken Upptäck: platserna att filtrera (lätta platser och befintliga städer med klimat och taggar),
// filtren, sorteringen, filtren i adressen och alternativen till dyra platser.
// Allt kommer från places (content/_upptack.json läses in av npm run import, se scripts/lib/upptack.mjs).
// Ren logik utan text: namnen kommer från t() i komponenterna. Testas i upptack.test.ts.
import { CONTINENT_OF } from './continents';
import type { Place } from './content';
import { pricesOf } from './prices';
import type { PlaceStatus } from './statusLogic';

export interface Alternative {
  /** Alternativets id i places. */
  place: string;
  why: string;
  /** Sant när alternativet har lägre prisnivå än platsen det hör till. */
  cheaper: boolean;
}

/** En plats i Upptäck. */
export interface DiscoverEntry {
  id: string;
  name: string;
  /** Landskod (ISO). */
  country: string;
  /** Prisnivå 1–5: data.level för lätta platser, data.prices.level för befintliga städer. */
  level: number | null;
  /** Bästa månader, 1–12. Befintliga städer: månaderna där smart_months är 4 eller 5. */
  months: number[];
  climate: string | null;
  tags: string[];
  /** Smultronställe. */
  gem: boolean;
  /** En mening om platsen. Befintliga städer får den från existing i _upptack.json (Körning 16), och kan sakna den. */
  why: string | null;
  light: boolean;
  alternatives: Alternative[];
}

/** Lätt plats (eller lätt land): data.light. Har ingen kompendium, inga saker och inga priser. */
export const isLight = (p: Pick<Place, 'data'> | null | undefined): boolean => (p?.data as { light?: unknown } | undefined)?.light === true;

/** Månaderna (1–12) där Smart månad ger 4 eller 5. */
export function bestMonths(smart: number[] | null | undefined): number[] {
  if (!Array.isArray(smart)) return [];
  return smart.flatMap((v, i) => (typeof v === 'number' && v >= 4 && i < 12 ? [i + 1] : []));
}

const LEVELS = [1, 2, 3, 4, 5] as const;
const isLevel = (v: unknown): v is number => typeof v === 'number' && (LEVELS as readonly number[]).includes(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Platsens prisnivå: lätta platsers level, annars nivån i data.prices. */
export function levelOf(p: Pick<Place, 'data'>): number | null {
  if (isLight(p)) return isLevel(p.data.level) ? p.data.level : null;
  return pricesOf(p.data)?.level ?? null;
}

function alternativesOf(p: Pick<Place, 'data'>): Alternative[] {
  const raw = p.data.alternatives;
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is Alternative => Boolean(a) && typeof a.place === 'string' && typeof a.why === 'string' && typeof a.cheaper === 'boolean');
}

/** Platsen i Upptäck, eller null om den inte hör dit (inte en stad, eller en stad utan klimat och taggar). */
export function toEntry(p: Place): DiscoverEntry | null {
  if (p.kind !== 'city') return null;
  const d = p.data ?? {};
  const light = isLight(p);
  if (!light && d.climate === undefined && d.tags === undefined) return null;
  return {
    id: p.id,
    name: p.name,
    country: p.id.slice(0, 2),
    level: levelOf(p),
    months: light ? (Array.isArray(d.best_months) ? d.best_months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12) : []) : bestMonths(p.smart_months),
    climate: typeof d.climate === 'string' ? d.climate : null,
    tags: strings(d.tags),
    gem: d.gem === true,
    why: typeof d.why === 'string' && d.why.trim() ? d.why : null,
    light,
    alternatives: alternativesOf(p),
  };
}

export const discoverEntries = (places: Place[]): DiscoverEntry[] => places.flatMap((p) => toEntry(p) ?? []);

// ---------- Filter ----------

export interface DiscoverFilter {
  /** Prisnivåer, flera kan väljas (någon av dem). */
  prices: number[];
  /** Månad 1–12, null = när som helst. */
  month: number | null;
  /** Klimat, flera kan väljas (något av dem). */
  climates: string[];
  /** Taggar: platsen ska ha alla valda. */
  tags: string[];
  /** Världsdel (bokstavskod som i src/lib/continents.ts). */
  continent: string | null;
  /** Land (ISO-kod). */
  country: string | null;
  gem: boolean;
  /** Dölj platser med status besökt, bor eller har bott. */
  unvisited: boolean;
}

export const NO_FILTER: DiscoverFilter = { prices: [], month: null, climates: [], tags: [], continent: null, country: null, gem: false, unvisited: false };

/** Status som räknas som besökt i filtret upptack.filter.obesokt. */
export const VISITED_HIDE: PlaceStatus[] = ['besokt', 'bor', 'bott'];

/** Antal valda filter. */
export const filterCount = (f: DiscoverFilter): number =>
  f.prices.length + (f.month ? 1 : 0) + f.climates.length + f.tags.length + (f.continent ? 1 : 0) + (f.country ? 1 : 0) + (f.gem ? 1 : 0) + (f.unvisited ? 1 : 0);

export function matches(e: DiscoverEntry, f: DiscoverFilter, statuses: Record<string, PlaceStatus | undefined> = {}): boolean {
  if (f.prices.length && (e.level == null || !f.prices.includes(e.level))) return false;
  if (f.month && !e.months.includes(f.month)) return false;
  if (f.climates.length && (!e.climate || !f.climates.includes(e.climate))) return false;
  if (f.tags.length && !f.tags.every((x) => e.tags.includes(x))) return false;
  if (f.continent && CONTINENT_OF[e.country] !== f.continent) return false;
  if (f.country && e.country !== f.country) return false;
  if (f.gem && !e.gem) return false;
  if (f.unvisited) {
    const s = statuses[e.id];
    if (s && VISITED_HIDE.includes(s)) return false;
  }
  return true;
}

export const applyFilter = (list: DiscoverEntry[], f: DiscoverFilter, statuses: Record<string, PlaceStatus | undefined> = {}) =>
  list.filter((e) => matches(e, f, statuses));

/** Världsdelar och länder som har minst en plats, för filtren upptack.filter.kontinent och upptack.filter.land. */
export function filterOptions(list: DiscoverEntry[]): { continents: string[]; countries: string[] } {
  const countries = [...new Set(list.map((e) => e.country))];
  const continents = [...new Set(countries.map((c) => CONTINENT_OF[c]).filter(Boolean))];
  return { continents: continents.sort(), countries: countries.sort() };
}

// ---------- Sortering ----------

export type DiscoverSort = 'pris' | 'namn';
export const SORTS: DiscoverSort[] = ['pris', 'namn'];

/** upptack.sortera.pris (förvald): lägst prisnivå först, sedan namn. upptack.sortera.namn: namn. Utan nivå hamnar sist. */
export function sortEntries(list: DiscoverEntry[], sort: DiscoverSort, locale: string): DiscoverEntry[] {
  const byName = (a: DiscoverEntry, b: DiscoverEntry) => a.name.localeCompare(b.name, locale) || a.id.localeCompare(b.id);
  if (sort === 'namn') return [...list].sort(byName);
  return [...list].sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || byName(a, b));
}

// ---------- Filtren i adressen ----------

const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const nums = (v: string | null, max: number) =>
  [...new Set(csv(v).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= max).sort((a, b) => a - b);

/** Läser filtren och sorteringen ur adressens query-parametrar. Okända värden hoppas över. */
export function fromParams(p: URLSearchParams, allowed: { tags: string[]; climates: string[] }): { filter: DiscoverFilter; sort: DiscoverSort } {
  const month = Number(p.get('manad'));
  const continent = p.get('kontinent');
  const country = p.get('land');
  return {
    filter: {
      prices: nums(p.get('pris'), 5),
      month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
      climates: [...new Set(csv(p.get('klimat')))].filter((c) => allowed.climates.includes(c)),
      tags: [...new Set(csv(p.get('typ')))].filter((c) => allowed.tags.includes(c)),
      continent: continent && /^[A-Z]{2}$/.test(continent) ? continent : null,
      country: country && /^[A-Z]{2}$/.test(country) ? country : null,
      gem: p.get('smultron') === '1',
      unvisited: p.get('obesokt') === '1',
    },
    sort: p.get('sortera') === 'namn' ? 'namn' : 'pris',
  };
}

/** Filtren och sorteringen som query-parametrar. Förval utelämnas, så att en ofiltrerad lista har en ren adress. */
export function toParams(f: DiscoverFilter, sort: DiscoverSort): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.prices.length) out.pris = [...f.prices].sort((a, b) => a - b).join(',');
  if (f.month) out.manad = String(f.month);
  if (f.climates.length) out.klimat = f.climates.join(',');
  if (f.tags.length) out.typ = f.tags.join(',');
  if (f.continent) out.kontinent = f.continent;
  if (f.country) out.land = f.country;
  if (f.gem) out.smultron = '1';
  if (f.unvisited) out.obesokt = '1';
  if (sort !== 'pris') out.sortera = sort;
  return out;
}

/** Lägger till eller tar bort ett värde i en lista. */
export const toggleIn = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// ---------- Bästa månader ----------

/**
 * Månaderna för {manad} i upptack.kort.basta: korta namn i den ordning de står i filen, så att månader över
 * årsskiftet (11, 12, 1, 2 på södra halvklotet) skrivs nov, dec, jan, feb och inte jan, feb, nov, dec.
 */
export const monthList = (months: number[], short: string[]): string => months.map((m) => short[m - 1]).join(', ');

// ---------- Fler kort när man rullar ----------

/** Antal kort som visas först, och antal som läggs till varje gång man rullar ned till slutet av listan. */
export const PAGE_SIZE = 30;

/** Antalet kort att visa efter en laddning till: PAGE_SIZE fler, men aldrig fler än listan har. */
export const nextCount = (shown: number, total: number): number => Math.min(total, shown + PAGE_SIZE);

/** Korten som visas: de första count. Antalet i upptack.antal räknas på hela listan, inte på det här. */
export const visibleEntries = <T,>(list: T[], count: number): T[] => list.slice(0, Math.max(0, count));

/** Antal länder i filtret upptack.filter.land som gör att listan får sökfältet från kartans fokusval. */
export const COUNTRY_SEARCH_FROM = 20;

// ---------- Källraden på en lätt plats ----------

/**
 * Källraden för prisnivån på en lätt plats sida, eller null när indexet saknas.
 * basis icp: upptack.index.varlden (Världsbankens prisnivåindex, världen = 100). Annars upptack.index (Eurostat).
 * {plats} är landets namn, {antal} landets värde i indexet och {ar} indexets år.
 */
export function indexLine(
  d: Pick<Place['data'], 'basis' | 'pli' | 'pli_year'>,
  countryName: string,
): { key: string; values: { plats: string; antal: number; ar: number } } | null {
  if (typeof d.pli !== 'number' || typeof d.pli_year !== 'number') return null;
  return {
    key: d.basis === 'icp' ? 'upptack.index.varlden' : 'upptack.index',
    values: { plats: countryName, antal: d.pli, ar: d.pli_year },
  };
}

// ---------- Alternativ ----------

/** Rubriken i alternativrutan: upptack.alt.rubrik när minst ett alternativ är billigare, annars upptack.alt.rubrik.lika. */
export const altHeadingKey = (alts: Pick<Alternative, 'cheaper'>[]): string =>
  alts.some((a) => a.cheaper) ? 'upptack.alt.rubrik' : 'upptack.alt.rubrik.lika';

/** I Upptäck får kort för platser med nivå 4 eller 5 som har alternativ länken upptack.alt.till. */
export const showsAltLink = (e: Pick<DiscoverEntry, 'level' | 'alternatives'>): boolean => (e.level ?? 0) >= 4 && e.alternatives.length > 0;

export interface AltRow {
  id: string;
  name: string;
  country: string;
  level: number | null;
  why: string;
}

/** Alternativen till en plats, med namn, land och prisnivå ur places. Alternativ som inte finns i places hoppas över. */
export function alternativeRows(place: Pick<Place, 'data'>, places: Place[]): AltRow[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  return alternativesOf(place).flatMap((a) => {
    const p = byId.get(a.place);
    return p ? [{ id: p.id, name: p.name, country: p.id.slice(0, 2), level: levelOf(p), why: a.why }] : [];
  });
}
