// Grundinställningar för appen. Namnet används överallt via APP_NAME, aldrig hårdkodat.
export const APP_NAME = 'Globedex';

/** Gränssnittets språk. Svenska är grunden: saknas en text på engelska används den svenska. */
export type Lang = 'sv' | 'en';
export const LANGS: Lang[] = ['sv', 'en'];

/**
 * Språkkod (BCP 47) per språk. APP_LOCALE i src/lib/locale.ts följer valt språk, och datum, tal,
 * valuta, restid, sortering, gemener och landsnamn formateras efter den, aldrig med ett fast sv-SE.
 */
export const LOCALES: Record<Lang, string> = { sv: 'sv-SE', en: 'en-GB' };

export type PaletteId = 'djuphav' | 'medelhav' | 'terrakotta' | 'skog' | 'nattflyg' | 'egen';
export type HeadingFont =
  | 'Fraunces'
  | 'Bricolage Grotesque'
  | 'Space Grotesk'
  | 'Playfair Display'
  | 'DM Serif Display'
  | 'Outfit'
  | 'Sora';
export type BodyFont = 'DM Sans' | 'Inter' | 'Manrope' | 'Nunito' | 'Work Sans' | 'IBM Plex Sans';
export type TextSize = 'liten' | 'normal' | 'stor';
export type Tone = 'neutral' | 'lekfull' | 'romantisk';
export type TravelMode = 'solo' | 'par' | 'grupp';
/** Vilka länder som räknas i statistik, mål och märken (content/_landlistor.json). Se src/lib/landlistor.ts. */
export type CountryList = 'fn' | 'fn-plus' | 'fn-tw-xk' | 'alla';
export const COUNTRY_LISTS: CountryList[] = ['fn', 'fn-plus', 'fn-tw-xk', 'alla'];
/** Kartans egen stil (hav, land utan status, gränser och etiketter), oberoende av appens tema. */
export type MapStyle = 'auto' | 'ljus' | 'mork';
export const MAP_STYLES: MapStyle[] = ['auto', 'ljus', 'mork'];
/** Statusar som kan få en egen färg under Anpassning (src/lib/mapColors.ts). Bara jag följer besökt. */
export type ColorKey = 'bor' | 'bott' | 'besokt' | 'tillsammans' | 'bada' | 'bara-annan' | 'planerad' | 'vill' | 'mellan';
export const COLOR_KEYS: ColorKey[] = ['bor', 'bott', 'besokt', 'tillsammans', 'bada', 'bara-annan', 'planerad', 'vill', 'mellan'];
/** Färgnycklar på kartan som kan släckas i listan (statusarna och besökt i sällskap). */
export type HideKey = ColorKey | 'bara-jag';
export const HIDE_KEYS: HideKey[] = [...COLOR_KEYS, 'bara-jag'];

export interface ThemeSettings {
  palette: PaletteId;
  custom: { p: string; a: string; bg: string };
  headingFont: HeadingFont;
  bodyFont: BodyFont;
  textSize: TextSize;
  dark: boolean;
  radius: number;
  tone: Tone;
  /** Valt språk. Tomt = inget val gjort: svenska om webbläsarens språk börjar med sv, annars engelska. */
  lang: Lang | null;
  /** Vilka länder som räknas. Sparas lokalt och i profilen som språkvalet. */
  countryList: CountryList;
  /** Egna statusfärger (hex). En status utan eget val följer paletten. */
  mapColors: Partial<Record<ColorKey, string>>;
  /** Kartans stil: följ appens tema, alltid ljus eller alltid mörk. */
  mapStyle: MapStyle;
  /** Statusar som är släckta i kartans lista (och tonas ner på kartan). */
  mapHidden: HideKey[];
  /** Kartans fokus: varlden, en världsdel (M49-kod) eller ett land (ISO-kod). Se src/lib/mapFocus.ts. */
  mapFocus: string;
}

/** Startläge: Djuphav, Fraunces + DM Sans, ljust, 16 px rundning. */
export const DEFAULT_THEME: ThemeSettings = {
  palette: 'djuphav',
  custom: { p: '#B5179E', a: '#FFD166', bg: '#FFF8F0' },
  headingFont: 'Fraunces',
  bodyFont: 'DM Sans',
  textSize: 'normal',
  dark: false,
  radius: 16,
  tone: 'neutral',
  lang: null,
  countryList: 'alla',
  mapColors: {},
  mapStyle: 'auto',
  mapHidden: [],
  mapFocus: '150',
};

export const DEFAULT_THEME_COLOR = '#0F4C5C';
export const DEFAULT_BACKGROUND = '#FBF7F0';

export const RADIUS_MIN = 4;
export const RADIUS_MAX = 26;

/** Inbjudningskoder gäller så här länge (styrs av group_invites.expires_at i databasen). */
export const INVITE_DAYS = 7;

/** Avreseorter för flygsökningen (IATA). */
export const HOME_AIRPORTS = ['GOT', 'CPH'] as const;

/** Kartans utsnitt för Europa och hela världen som [väst, syd, öst, nord]. Övriga världsdelar i src/lib/mapFocus.ts. */
export const MAP_BOUNDS = {
  europa: [-12, 34, 35, 71] as [number, number, number, number],
  varlden: [-170, -58, 190, 80] as [number, number, number, number],
};
