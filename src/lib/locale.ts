// Appens språk (APP_LOCALE i src/config.ts). Datum, tal, valuta, restid, sortering och gemener
// formateras med LOCALE, aldrig med en fast språkkod.
import { APP_LOCALE } from '../config';

export const LOCALE = APP_LOCALE;
/** Språket utan region, till exempel sv. Sätts som lang på sidan. */
export const LANG = APP_LOCALE.split('-')[0];
