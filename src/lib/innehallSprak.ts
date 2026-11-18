// Innehållets språk (Körning 20). Det enda stället som väljer text för en rad och ett fält efter valt språk.
// Raderna i places, place_facts, place_items, compendium_items, bucket_catalog, ideas och gift_tips har
// kolumnen en med de engelska texterna under samma fältnamn som den svenska raden (för places även data
// med bara textfälten, och listor i samma längd och ordning). Saknas en engelsk text visas den svenska,
// fält för fält. Inget går sönder av att en, ett fält eller en post i en lista saknas.
// content.ts kör localize på allt den hämtar, så skärmarna får texterna på valt språk. Testas i innehallSprak.test.ts.
import type { Lang } from '../config';
import { currentLanguage } from './texter';

/** En rad med engelska texter i kolumnen en. sv har de svenska värdena för fälten som bytts ut. */
export interface Translatable {
  en?: Record<string, unknown> | null;
  sv?: Record<string, unknown>;
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** En text. Listor skrivs som [schema] och objekt som { fält: schema }, som i scripts/lib/en.mjs. */
const TEXT = 'text';
type Schema = typeof TEXT | Schema[] | { [k: string]: Schema };

/**
 * Textfälten som kan ha engelska, för alla sju tabeller (fältnamnen betyder samma sak i alla tabeller).
 * Allt annat (siffror, id:n, datum, nycklar, källor) kommer alltid från svenskan.
 */
export const TEXT_FIELDS: Record<string, Schema> = {
  name: TEXT,
  title: TEXT,
  summary: TEXT,
  body: TEXT,
  hint: TEXT,
  duration: TEXT,
  season: TEXT,
  where_text: TEXT,
  checklist: { items: [TEXT] },
  data: {
    best_text: TEXT,
    flight_tips: [{ title: TEXT, text: TEXT }],
    day_budget_note: TEXT,
    stay: [{ label: TEXT, text: TEXT }],
    areas: [{ name: TEXT, text: TEXT }],
    transport: [{ mode: TEXT, text: TEXT }],
    month_notes: [TEXT],
    events: [{ name: TEXT, text: TEXT }],
    seasons: [{ name: TEXT, text: TEXT }],
    prices: { summary: TEXT, tips: [TEXT], rows: [{ note: TEXT }] },
    why: TEXT,
    level_note: TEXT,
    alternatives: [{ why: TEXT }],
  },
};

/**
 * Svenskan med engelskan ovanpå, fält för fält enligt schemat. En text byts bara mot en engelsk text som inte
 * är tom. Listor slås ihop post för post (samma längd och ordning som svenskan), objekt fält för fält. Fält
 * som inte är text i schemat, och fält som bara finns på engelska, kommer från svenskan.
 */
export function mergeText(sv: unknown, en: unknown, schema: Schema = TEXT): unknown {
  if (schema === TEXT) return typeof sv === 'string' && typeof en === 'string' && en.trim() ? en : sv;
  if (Array.isArray(schema)) return Array.isArray(sv) && Array.isArray(en) ? sv.map((x, i) => mergeText(x, en[i], schema[0])) : sv;
  if (!isObj(sv) || !isObj(en)) return sv;
  const out: Record<string, unknown> = { ...sv };
  for (const k of Object.keys(en)) if (k in sv && k in schema) out[k] = mergeText(sv[k], en[k], schema[k]);
  return out;
}

/** Texten (eller värdet) för ett fält på raden, på valt språk, med svenskan som reserv. */
export function contentText<T extends Translatable, K extends keyof T & string>(row: T, field: K, lang: Lang = currentLanguage()): T[K] {
  if (lang === 'sv' || !isObj(row.en) || !(field in row.en) || !(field in TEXT_FIELDS)) return row[field];
  return mergeText(row[field], row.en[field], TEXT_FIELDS[field]) as T[K];
}

// Samma rad (och samma lista) ger samma objekt så länge språket är detsamma, så att React inte ritar om i onödan.
const rowCache = new WeakMap<object, unknown>();
const listCache = new WeakMap<object, unknown>();

/**
 * Raden på valt språk: varje fält i en läggs på den svenska raden med contentText. De svenska värdena för
 * fälten som byts ut ligger kvar i sv (sökningen hittar platser på båda språken). en ligger kvar.
 */
export function localize<T extends Translatable>(row: T, lang: Lang = currentLanguage()): T {
  if (lang === 'sv' || !isObj(row.en)) return row;
  const hit = rowCache.get(row) as T | undefined;
  if (hit) return hit;
  const out = { ...row, sv: {} as Record<string, unknown> };
  for (const k of Object.keys(row.en)) {
    if (!(k in row) || !(k in TEXT_FIELDS)) continue;
    out.sv[k] = row[k as keyof T];
    (out as unknown as Record<string, unknown>)[k] = contentText(row, k as keyof T & string, lang);
  }
  rowCache.set(row, out);
  return out;
}

/** Alla rader på valt språk. */
export function localizeAll<T extends Translatable>(rows: T[], lang: Lang = currentLanguage()): T[] {
  if (lang === 'sv') return rows;
  const hit = listCache.get(rows) as T[] | undefined;
  if (hit) return hit;
  const out = rows.map((r) => localize(r, lang));
  listCache.set(rows, out);
  return out;
}

/** Svenska värdet för ett fält, oavsett valt språk (till exempel nyckeln för avbockade delmål). */
export function swedish<T extends Translatable, K extends keyof T & string>(row: T, field: K): T[K] {
  return (row.sv && field in row.sv ? row.sv[field] : row[field]) as T[K];
}

/** Namnen på båda språken (valt språk först), för sökning. */
export function namesOf(row: { name: string } & Translatable): string[] {
  const all = [row.name, row.sv?.name, row.en?.name].filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  return [...new Set(all)];
}
