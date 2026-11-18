// Listan Platser intill kartan (Körning 16): grupperad per världsdel, länderna i bokstavsordning och de
// markerade städerna under sitt land. Släckta statusar tas bort ur listan. Ren logik, testas i mapList.test.ts.
import type { HideKey } from '../config';
import { CONTINENT_OF, type Continent } from './continents';
import { countryIdFor } from './statusLogic';
import type { MapKey } from './togetherLogic';

const ISO_RE = /^[A-Z]{2}$/;

export interface ListPlace {
  id: string;
  name: string;
  key: MapKey;
}

export interface ListCountry {
  id: string;
  name: string;
  /** Landets egen färgnyckel. null när landet saknar status (eller den är släckt) men har städer i listan. */
  key: MapKey | null;
  /** Markerade platser under landet (städer, och regioner och platser i dem), i bokstavsordning. */
  children: ListPlace[];
  /** Är allt under landet städer? Då heter raden karta.lista.stader, annars karta.lista.platser (Körning 17). */
  allCities: boolean;
}

export interface ListContinent {
  code: Continent;
  name: string;
  countries: ListCountry[];
}

/** Är färgnyckeln släckt? */
export const isHidden = (key: MapKey, hidden: readonly HideKey[]): boolean => hidden.includes(key as HideKey);

/**
 * Grupperar vald kartas platser per världsdel. keys är färgnyckeln per plats-id. Länder utan känd världsdel
 * tas inte med. Världsdelar och länder sorteras på namnet med locale.
 */
export function groupPlaces(
  keys: Record<string, MapKey>,
  hidden: readonly HideKey[],
  nameOf: (id: string) => string,
  continentName: (code: Continent) => string,
  locale: string,
  /** Platsens typ (country, region, city, spot). En plats som inte är city gör raden till platser. Utan funktionen räknas allt som städer. */
  kindOf: (id: string) => string | undefined = () => 'city',
): ListContinent[] {
  const countries = new Map<string, ListCountry>();
  const country = (iso: string) => {
    let c = countries.get(iso);
    if (!c) countries.set(iso, (c = { id: iso, name: nameOf(iso), key: null, children: [], allCities: true }));
    return c;
  };
  for (const [id, key] of Object.entries(keys)) {
    if (isHidden(key, hidden)) continue;
    if (ISO_RE.test(id)) country(id).key = key;
    else {
      const c = country(countryIdFor(id));
      c.children.push({ id, name: nameOf(id), key });
      if (kindOf(id) !== 'city') c.allCities = false;
    }
  }
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, locale);
  const groups = new Map<Continent, ListContinent>();
  for (const c of countries.values()) {
    const code = CONTINENT_OF[c.id];
    if (!code) continue;
    c.children.sort(byName);
    let g = groups.get(code);
    if (!g) groups.set(code, (g = { code, name: continentName(code), countries: [] }));
    g.countries.push(c);
  }
  const out = [...groups.values()];
  for (const g of out) g.countries.sort(byName);
  return out.sort(byName);
}

/** Antal länder i en världsdel och antal platser under ett land, för texterna karta.lista.*. */
export const countKey = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Texten på raden under ett land: städer bara när allt under landet är städer, annars platser. */
export const childrenKey = (c: Pick<ListCountry, 'children' | 'allCities'>) =>
  c.allCities
    ? countKey(c.children.length, 'karta.lista.stader.en', 'karta.lista.stader')
    : countKey(c.children.length, 'karta.lista.platser.en', 'karta.lista.platser');
