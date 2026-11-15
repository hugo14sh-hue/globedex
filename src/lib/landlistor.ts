// Vilka länder som räknas i statistik, mål och märken. Listorna kommer från content/_landlistor.json
// och läses in vid bygget. Allt som räknar länder (Siffror, kontinenter, märken, bucketmål, checklistan
// besokta-lander, Wrapped och samlingarnas räknare) går genom funktionerna här.
// Kartan visar alltid alla länder och status går att sätta på alla: listan styr bara vad som räknas.
// Testas i landlistor.test.ts.
import raw from '../../content/_landlistor.json';
import { DEFAULT_THEME, type CountryList } from '../config';
import { COUNTRIES } from './countries';

const ISO_RE = /^[A-Z]{2}$/;

/** Appens länder: alla ISO-koder i kartdatat (src/lib/countries.ts). */
export const APP_COUNTRIES: readonly string[] = [...new Set(COUNTRIES.map(([iso]) => iso))].sort();

const FN = new Set<string>(raw.fn);
const FN_PLUS = new Set<string>([...raw.fn, ...raw.fn_observatorer]);

/** Förvalet: alla länder, så att inget ändras för den som inte väljer. */
export const DEFAULT_COUNTRY_LIST: CountryList = DEFAULT_THEME.countryList;

/** Länderna i en lista. */
export function countryListCodes(list: CountryList): string[] {
  if (list === 'fn') return [...FN].sort();
  if (list === 'fn-plus') return [...FN_PLUS].sort();
  return [...APP_COUNTRIES];
}

/** Nämnaren: antalet länder i listan. */
export const countryListTotal = (list: CountryList) => (list === 'fn' ? FN.size : list === 'fn-plus' ? FN_PLUS.size : APP_COUNTRIES.length);

/**
 * Räknas platsen som ett land i listan? Bara landskoder (två versaler) räknas, aldrig regioner.
 * Listan alla räknar varje landskod, som förut.
 */
export function countsAsCountry(id: string, list: CountryList = DEFAULT_COUNTRY_LIST): boolean {
  if (!ISO_RE.test(id)) return false;
  if (list === 'fn') return FN.has(id);
  if (list === 'fn-plus') return FN_PLUS.has(id);
  return true;
}

/** Är landet utanför vald lista? Då visas märkningen landlista.utanfor på landets sida. */
export const outsideCountryList = (id: string, list: CountryList) => ISO_RE.test(id) && !countsAsCountry(id, list);

/** Textnyckeln för en lista i Anpassning. */
export const countryListKey = (list: CountryList) => `landlista.${list}`;
