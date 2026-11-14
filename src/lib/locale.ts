// Appens språk. APP_LOCALE (sv-SE eller en-GB) följer valt språk och sätts av setLocale innan
// första renderingen och när språket byts. Datum, tal, valuta, restid, sortering, gemener och
// landsnamn formateras med den, aldrig med en fast språkkod. Formatterarna skapas vid behov och
// sparas per språk, så att ett byte av språk slår igenom överallt.
import { LOCALES, type Lang } from '../config';

export let APP_LOCALE: string = LOCALES.sv;
/** Samma som APP_LOCALE (kortare namn i koden). */
export let LOCALE: string = APP_LOCALE;
/** Språket utan region, till exempel sv. Sätts som lang på sidan. */
export let LANG: Lang = 'sv';

export function setLocale(lang: Lang): void {
  LANG = lang;
  APP_LOCALE = LOCALES[lang];
  LOCALE = APP_LOCALE;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Språket när inget val är gjort: svenska om webbläsarens språk börjar med sv, annars engelska. */
export function browserLang(nav: string | undefined): Lang {
  return nav?.toLowerCase().startsWith('sv') ? 'sv' : 'en';
}

/** Valt språk, eller webbläsarens när inget val är gjort. */
export const resolveLang = (chosen: Lang | null | undefined): Lang =>
  chosen ?? browserLang(typeof navigator !== 'undefined' ? navigator.language : undefined);

const cache = new Map<string, unknown>();
function cached<T>(kind: string, opts: object, make: () => T): T {
  const key = `${kind}|${APP_LOCALE}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as T | undefined;
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

/** Talformat för valt språk. */
export const numberFormat = (opts: Intl.NumberFormatOptions = {}) =>
  cached('n', opts, () => new Intl.NumberFormat(APP_LOCALE, opts));

/** Datumformat för valt språk. */
export const dateFormat = (opts: Intl.DateTimeFormatOptions = {}) =>
  cached('d', opts, () => new Intl.DateTimeFormat(APP_LOCALE, opts));

/** Namn på länder, regioner och valutor från webbläsaren, på valt språk. */
export const displayNames = (type: Intl.DisplayNamesType) =>
  cached('dn', { type }, () => new Intl.DisplayNames([APP_LOCALE], { type }));
