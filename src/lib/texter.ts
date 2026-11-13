// Gränssnittets texter. Allt läses från content/_texter.json i vald språkstil.
// Skriv inga egna texter här. Saknas en nyckel visas nyckeln själv, och den listas i slutrapporten.
import data from '../../content/_texter.json';
import { APP_NAME, type Tone } from '../config';

type Entry = string | Partial<Record<Tone, string>>;
const TEXTER = data.texter as Record<string, Entry>;

export type Values = Record<string, string | number>;

const warned = new Set<string>();

function fill(s: string, values: Values): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k === 'app' && values.app === undefined) return APP_NAME;
    const v = values[k];
    return v === undefined ? m : String(v);
  });
}

/** Ren funktion: text för nyckel i en viss stil. Faller tillbaka på neutral. */
export function text(key: string, tone: Tone, values: Values = {}): string {
  const e = TEXTER[key];
  let s: string | undefined;
  if (typeof e === 'string') s = e;
  else if (e) s = e[tone] ?? e.neutral;
  if (s === undefined) {
    if (import.meta.env?.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`Text saknas i content/_texter.json: ${key}`);
    }
    return key;
  }
  return fill(s, values);
}

export const hasText = (key: string) => key in TEXTER;

let currentTone: Tone = 'neutral';

/** Sätts av tema-providern när språkstilen ändras. */
export function setTone(tone: Tone): void {
  currentTone = tone;
}

/** t(nyckel, värden) i den språkstil som användaren har valt. */
export function t(key: string, values: Values = {}): string {
  return text(key, currentTone, values);
}

export interface Badge {
  id: string;
  name: string;
  rule: string;
  text: string;
  levels?: number[];
}

export const BADGES = data.marken as Badge[];
