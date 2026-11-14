// Gränssnittets texter. Läses från content/_texter.json (svenska) och content/_texter.en.json (engelska)
// i vald språkstil. Den engelska filen laddas först när engelska väljs och ligger inte i huvudpaketet.
// Saknas en nyckel på engelska används den svenska. Saknas den helt visas nyckeln själv.
// Skriv inga egna texter här.
import sv from '../../content/_texter.json';
import { APP_NAME, type Lang, type Tone } from '../config';
import { numberFormat, setLocale } from './locale';

type Entry = string | Partial<Record<Tone, string>>;

export interface Badge {
  id: string;
  name: string;
  rule: string;
  text: string;
  levels?: number[];
}

export interface TextFile {
  texter: Record<string, Entry>;
  marken: Badge[];
}

const SV = sv as unknown as TextFile;
const files: Partial<Record<Lang, TextFile>> = { sv: SV };

export type Values = Record<string, string | number>;

const warned = new Set<string>();

/** Tal i texterna formateras efter valt språk. Heltal under 10 000 (till exempel årtal) grupperas inte. */
const formatNum = (v: number) =>
  Number.isInteger(v) && Math.abs(v) < 10_000 ? String(v) : numberFormat({ maximumFractionDigits: 2 }).format(v);

function fill(s: string, values: Values): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k === 'app' && values.app === undefined) return APP_NAME;
    const v = values[k];
    return v === undefined ? m : typeof v === 'number' ? formatNum(v) : v;
  });
}

let currentLang: Lang = 'sv';
let currentTone: Tone = 'neutral';

function pick(e: Entry | undefined, tone: Tone): string | undefined {
  if (typeof e === 'string') return e;
  if (e) return e[tone] ?? e.neutral;
  return undefined;
}

/** Ren funktion: text för nyckel i en viss stil (och ett visst språk). Faller tillbaka på neutral, sedan på svenska. */
export function text(key: string, tone: Tone, values: Values = {}, lang: Lang = currentLang): string {
  const own = lang === 'sv' ? undefined : files[lang]?.texter[key];
  const s = pick(own, tone) ?? pick(SV.texter[key], tone);
  if (s === undefined) {
    if (import.meta.env?.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`Text saknas i content/_texter.json: ${key}`);
    }
    return key;
  }
  return fill(s, values);
}

export const hasText = (key: string) => key in SV.texter || Boolean(files.en && key in files.en.texter);

/** Sätts av tema-providern när språkstilen ändras. */
export function setTone(tone: Tone): void {
  currentTone = tone;
}

/** Hämtar texterna för ett språk (engelska laddas som en egen fil första gången). */
export async function loadTexts(lang: Lang): Promise<void> {
  if (files[lang]) return;
  if (lang === 'en') files.en = (await import('../../content/_texter.en.json')).default as unknown as TextFile;
}

/** För tester: lägger in en textfil utan att ladda den. */
export function registerTexts(lang: Lang, file: TextFile): void {
  files[lang] = file;
}

/**
 * Byter språk för t() och formateringen (APP_LOCALE och lang på sidan). Är språkets fil inte
 * hämtad än används svenska. Svarar med språket som faktiskt gäller.
 */
export function setLanguage(lang: Lang): Lang {
  currentLang = files[lang] ? lang : 'sv';
  setLocale(currentLang);
  return currentLang;
}

export const currentLanguage = () => currentLang;

/** t(nyckel, värden) i den språkstil och det språk som användaren har valt. */
export function t(key: string, values: Values = {}): string {
  return text(key, currentTone, values);
}

/**
 * Märkena på valt språk. Regler och nivåer kommer alltid från den svenska filen, namn och text från
 * valt språk. Ett märke som saknas på engelska visas på svenska.
 */
export function badges(): Badge[] {
  const own = currentLang === 'sv' ? undefined : files[currentLang]?.marken;
  if (!own) return SV.marken;
  return SV.marken.map((b) => {
    const e = own.find((x) => x.id === b.id);
    return e ? { ...b, name: e.name || b.name, text: e.text || b.text } : b;
  });
}

/** Märkena på svenska (regler och nivåer). */
export const BADGES = SV.marken;
