// Kartans fokus (Körning 16): hela världen, en världsdel eller ett land. Värdet sparas i profilen och står i
// adressen (?fokus=). Världsdelar anges med FN:s M49-kod (150 är Europa), länder med ISO-kod, så att de inte
// krockar (AS är både Asien och Amerikanska Samoa). Ren logik, testas i mapFocus.test.ts.
import { MAP_BOUNDS } from '../config';
import { COUNTRY_BOXES } from './countryBoxes';
import { COUNTRIES } from './countries';
import { M49 } from './continentNames';
import type { Continent } from './continents';

export type Box = [number, number, number, number];

/** De sex bebodda världsdelarna. */
export const FOCUS_CONTINENTS: Continent[] = ['AF', 'AS', 'EU', 'NA', 'SA', 'OC'];

/** Världsdelarnas utsnitt: [väst, syd, öst, nord]. Europa är samma som kartans start före Körning 16. */
export const CONTINENT_BOXES: Record<Exclude<Continent, 'AN'>, Box> = {
  EU: MAP_BOUNDS.europa,
  AS: [25, -11, 146, 56],
  AF: [-26, -36, 58, 38],
  NA: [-168, 7, -52, 72],
  SA: [-82, -56, -34, 13],
  OC: [110, -48, 180, 0],
};

/** Utsnitt runt mittpunkten för ett land som saknar yta i kartdatat (grader åt varje håll). */
const POINT_PAD = 1.5;

export const WORLD = 'varlden';
export const DEFAULT_FOCUS = M49.EU;

const ISO_RE = /^[A-Z]{2}$/;
const POINTS = new Map(COUNTRIES.map(([iso, lat, lon]) => [iso, [lat, lon] as const]));
const BY_M49 = new Map(FOCUS_CONTINENTS.map((c) => [M49[c], c]));

export type Focus = { kind: 'world' } | { kind: 'continent'; code: Continent; m49: string } | { kind: 'country'; iso: string };

/** Tolkar ett sparat värde eller adressens värde. Okänt värde ger null. */
export function parseFocus(v: string | null | undefined): Focus | null {
  if (!v) return null;
  if (v === WORLD) return { kind: 'world' };
  const c = BY_M49.get(v);
  if (c) return { kind: 'continent', code: c, m49: v };
  if (ISO_RE.test(v) && (COUNTRY_BOXES[v] || POINTS.has(v))) return { kind: 'country', iso: v };
  return null;
}

export const isFocus = (v: string): boolean => parseFocus(v) !== null;

/** Utsnittet för ett fokus: hela världen, världsdelens ruta eller landets yta (eller runt mittpunkten). */
export function focusBounds(v: string): Box {
  const f = parseFocus(v) ?? parseFocus(DEFAULT_FOCUS)!;
  if (f.kind === 'world') return MAP_BOUNDS.varlden;
  if (f.kind === 'continent') return CONTINENT_BOXES[f.code as Exclude<Continent, 'AN'>];
  const b = COUNTRY_BOXES[f.iso];
  if (b) return b;
  const [lat, lon] = POINTS.get(f.iso)!;
  return [lon - POINT_PAD, lat - POINT_PAD, lon + POINT_PAD, lat + POINT_PAD];
}

/** Marginal i bildpunkter: världen och världsdelarna fyller kartan som förut (8 px), ett land får lite luft. */
export const focusPadding = (v: string): number => (parseFocus(v)?.kind === 'country' ? 24 : 8);

/**
 * Värdet som gäller: adressens fokus om det är giltigt, annars det sparade, annars Europa.
 * Det gamla ?utsnitt=varlden (före Körning 16) tolkas som hela världen.
 */
export function currentFocus(url: string | null, saved: string | null | undefined, legacyExtent?: string | null): string {
  if (url && isFocus(url)) return url;
  if (!url && legacyExtent === 'varlden') return WORLD;
  if (!url && legacyExtent === 'europa') return DEFAULT_FOCUS;
  if (saved && isFocus(saved)) return saved;
  return DEFAULT_FOCUS;
}

export interface FocusOption {
  value: string;
  label: string;
}

/** Länderna i rullgardinen, i bokstavsordning på valt språk. Sökningen bryr sig inte om stora bokstäver och accenter. */
export function countryOptions(codes: readonly string[], nameOf: (iso: string) => string, locale: string, query = ''): FocusOption[] {
  const fold = (s: string) => s.toLocaleLowerCase(locale).normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const q = fold(query.trim());
  return codes
    .map((iso) => ({ value: iso, label: nameOf(iso) }))
    .filter((o) => o.label && (!q || fold(o.label).includes(q)))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}
