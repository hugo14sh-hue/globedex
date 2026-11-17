// Världsdelarnas namn. Appen räknar med Natural Earths bokstavskoder (src/lib/continents.ts) och visar
// namnet från texten kontinent.<kod>, där koden är FN:s M49-kod (002, 142, 150, 003, 005, 009, 010).
// Webbläsarens namn används inte: flera webbläsare saknar namn för M49-koderna och visar då koden.
// Testas i continentNames.test.ts.
import type { Continent } from './continents';

export const M49: Record<Continent, string> = { AF: '002', AS: '142', EU: '150', NA: '003', SA: '005', OC: '009', AN: '010' };

/** Textnyckeln för en världsdel (bokstavskod eller M49-kod). Okänd kod ger null. */
export function continentKey(code: string): string | null {
  const m49 = (M49 as Record<string, string>)[code] ?? (Object.values(M49).includes(code) ? code : null);
  return m49 ? `kontinent.${m49}` : null;
}

/** Världsdelens namn med t(). En okänd kod visas aldrig: då blir namnet tomt. */
export const continentLabel = (code: string, t: (key: string) => string): string => {
  const k = continentKey(code);
  return k ? t(k) : '';
};
