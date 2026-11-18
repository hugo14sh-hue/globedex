// Vilka länder som räknas i statistik, mål och märken. Listorna kommer från content/_landlistor.json
// och läses in vid bygget. Allt som räknar länder (Siffror, kontinenter, märken, bucketmål, checklistan
// besokta-lander, Wrapped och samlingarnas räknare) går genom funktionerna här.
// Kartan visar alltid alla länder och status går att sätta på alla: listan styr bara vad som räknas.
// Delade länder (fältet delade, src/lib/delade.ts): med valet split räknas delarna i stället för landet,
// i vilken lista som helst där landet ingår. Landet och en del räknas aldrig samtidigt.
// Testas i landlistor.test.ts.
import raw from '../../content/_landlistor.json';
import { DEFAULT_THEME, type CountryList } from '../config';
import { COUNTRIES } from './countries';
import { DEFAULT_SPLIT, isCountryId, isSplitCountry, splitParent, withSplit } from './delade';

const ISO_RE = /^[A-Z]{2}$/;

/** Appens länder: alla ISO-koder i kartdatat (src/lib/countries.ts). */
export const APP_COUNTRIES: readonly string[] = [...new Set(COUNTRIES.map(([iso]) => iso))].sort();

const FN = new Set<string>(raw.fn);
const FN_PLUS = new Set<string>([...raw.fn, ...raw.fn_observatorer]);
/** FN:s medlemmar, observatörerna, Taiwan och Kosovo (fn_plus_tw_xk), 197 länder. */
const FN_TW_XK = new Set<string>([...FN_PLUS, ...raw.fn_plus_tw_xk]);
const SETS: Record<Exclude<CountryList, 'alla'>, Set<string>> = { fn: FN, 'fn-plus': FN_PLUS, 'fn-tw-xk': FN_TW_XK };

/** Förvalet: alla länder, så att inget ändras för den som inte väljer. */
export const DEFAULT_COUNTRY_LIST: CountryList = DEFAULT_THEME.countryList;

const baseCodes = (list: CountryList): string[] => (list === 'alla' ? [...APP_COUNTRIES] : [...SETS[list]].sort());

/** Länderna i en lista. Med split byts ett delat land mot sina delar. */
export function countryListCodes(list: CountryList, split = DEFAULT_SPLIT): string[] {
  return withSplit(baseCodes(list), split).sort();
}

/** Nämnaren: antalet länder i listan. */
export const countryListTotal = (list: CountryList, split = DEFAULT_SPLIT) => withSplit(baseCodes(list), split).length;

/** Räknas landskoden (bara ISO-koder) i listan, utan hänsyn till delade länder? */
const inList = (iso: string, list: CountryList) => ISO_RE.test(iso) && (list === 'alla' || SETS[list].has(iso));

/**
 * Räknas platsen som ett land i listan? Bara landskoder (två versaler) och delar av delade länder räknas,
 * aldrig regioner. Listan alla räknar varje landskod, som förut. Med split räknas delen när dess land ingår
 * i listan, och det delade landet räknas inte. Utan split räknas aldrig delarna.
 */
export function countsAsCountry(id: string, list: CountryList = DEFAULT_COUNTRY_LIST, split = DEFAULT_SPLIT): boolean {
  const parent = splitParent(id);
  if (parent) return split && inList(parent, list);
  if (split && isSplitCountry(id)) return false;
  return inList(id, list);
}

/** Är landet utanför vald lista? Då visas märkningen landlista.utanfor på landets sida. */
export const outsideCountryList = (id: string, list: CountryList, split = DEFAULT_SPLIT) => isCountryId(id) && !countsAsCountry(id, list, split);

/** Textnyckeln för en lista i Anpassning. */
export const countryListKey = (list: CountryList) => `landlista.${list}`;
