import {
  APP_NAME,
  COUNTRY_LISTS,
  DEFAULT_THEME,
  LANGS,
  RADIUS_MAX,
  RADIUS_MIN,
  type BodyFont,
  type HeadingFont,
  type PaletteId,
  type TextSize,
  type ThemeSettings,
  type Tone,
} from '../config';
import { COMPANY_COLORS, PALETTES, STATUS_FIXED, type Palette } from './palettes';
import type { MapKey } from '../lib/togetherLogic';
import { contrast, isHex, MIN_CONTRAST, mix, onColor, TEXT_DARK } from './color';
import { BODY_FONTS, HEADING_FONTS, loadFonts } from './fonts';

export function resolvePalette(s: ThemeSettings): Palette {
  const fixed = PALETTES.find((p) => p.id === s.palette);
  if (fixed) return fixed;
  const c = s.custom;
  return {
    id: 'egen',
    name: '',
    p: c.p,
    pd: mix(c.p, '#FFFFFF', 0.45),
    a: c.a,
    bg: c.bg,
    bgd: mix(c.p, '#000000', 0.86),
    sd: mix(c.p, '#000000', 0.74),
  };
}

/** Textfärg på bakgrund och ytor i mörkt läge. */
export const TEXT_ON_DARK = '#F2EFE9';

const FONT_SIZE: Record<TextSize, string> = { liten: '14px', normal: '15px', stor: '17px' };

/** Alla CSS-variabler för ett tema. */
export function themeVars(s: ThemeSettings): Record<string, string> {
  const P = resolvePalette(s);
  const d = s.dark;
  const p = d ? P.pd : P.p;
  const sf = d ? P.sd : '#FFFFFF';
  const h = HEADING_FONTS.find((f) => f.name === s.headingFont) ?? HEADING_FONTS[0];
  const b = BODY_FONTS.find((f) => f.name === s.bodyFont) ?? BODY_FONTS[0];
  const base = d ? P.sd : '#FFFFFF';
  return {
    '--p': p,
    '--a': P.a,
    '--bg': d ? P.bgd : P.bg,
    '--sf': sf,
    '--tx': d ? TEXT_ON_DARK : TEXT_DARK,
    '--mu': d ? '#A9B0B8' : '#5B5E66',
    '--ln': d ? 'rgba(255,255,255,.11)' : 'rgba(20,20,30,.09)',
    '--tr': d ? 'rgba(255,255,255,.1)' : 'rgba(20,20,30,.07)',
    '--onp': onColor(p),
    '--ona': onColor(P.a),
    '--soft': `color-mix(in srgb, ${p} 14%, ${sf})`,
    '--fh': h.stack,
    '--fb': b.stack,
    '--r': `${s.radius}px`,
    '--fs': FONT_SIZE[s.textSize],
    '--st-bor': p,
    '--st-bott': `color-mix(in srgb, ${p} 55%, ${base})`,
    '--st-besokt': STATUS_FIXED.besokt,
    '--st-planerad': STATUS_FIXED.planerad,
    '--st-vill': `color-mix(in srgb, ${P.a} 62%, ${base})`,
    '--st-mellan': STATUS_FIXED.mellan,
    '--st-ej': d ? STATUS_FIXED.ejMork : STATUS_FIXED.ejLjus,
    '--st-tillsammans': (d ? COMPANY_COLORS.mork : COMPANY_COLORS.ljus).tillsammans,
    '--st-bada': (d ? COMPANY_COLORS.mork : COMPANY_COLORS.ljus).bada,
    '--st-bara-jag': STATUS_FIXED.besokt,
    '--st-bara-annan': (d ? COMPANY_COLORS.mork : COMPANY_COLORS.ljus).baraAnnan,
  };
}

/**
 * Kartans statusfärger som hex (MapLibre förstår inte color-mix).
 * Samma regler som CSS-variablerna --st-*: bor = primär, har bott = primär 55 %, vill åka = accent 62 %.
 * Också färgerna för besökt i sällskap (tillsammans, båda var för sig, bara jag, bara den andra).
 */
export function statusColors(s: ThemeSettings): Record<MapKey | 'ej', string> {
  const P = resolvePalette(s);
  const p = s.dark ? P.pd : P.p;
  const base = s.dark ? P.sd : '#FFFFFF';
  const c = s.dark ? COMPANY_COLORS.mork : COMPANY_COLORS.ljus;
  return {
    tillsammans: c.tillsammans,
    bada: c.bada,
    'bara-jag': STATUS_FIXED.besokt,
    'bara-annan': c.baraAnnan,
    bor: p,
    bott: mix(base, p, 0.55),
    besokt: STATUS_FIXED.besokt,
    planerad: STATUS_FIXED.planerad,
    vill: mix(base, P.a, 0.62),
    mellan: STATUS_FIXED.mellan,
    ej: s.dark ? STATUS_FIXED.ejMork : STATUS_FIXED.ejLjus,
  };
}

/** Sätter temat på dokumentet. Laddar bara de två fonter som används. */
export function applyTheme(s: ThemeSettings): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(s))) root.style.setProperty(k, v);
  root.style.colorScheme = s.dark ? 'dark' : 'light';
  root.dataset.theme = s.dark ? 'dark' : 'light';
  loadFonts([s.headingFont, s.bodyFont]);
  const P = resolvePalette(s);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.dark ? P.bgd : P.p);
}

/**
 * Lägsta kontrasten i ett läge: text på primärfärgen, text på bakgrunden och
 * (i mörkt läge) text på ytan. Primärfärgen är en annan i mörkt läge, så båda lägena räknas.
 */
export function modeContrast(s: ThemeSettings, dark: boolean): number {
  const P = resolvePalette(s);
  if (!dark) return Math.min(contrast(P.p, onColor(P.p)), contrast(P.bg, TEXT_DARK));
  return Math.min(contrast(P.pd, onColor(P.pd)), contrast(P.bgd, TEXT_ON_DARK), contrast(P.sd, TEXT_ON_DARK));
}

/** Lägsta kontrasten i ljust och mörkt läge. */
export const lowestContrast = (s: ThemeSettings) => Math.min(modeContrast(s, false), modeContrast(s, true));

/** Varningen för egen palett: något av lägena ger under 4,5:1. */
export const hasLowContrast = (s: ThemeSettings) => lowestContrast(s) < MIN_CONTRAST;

const PALETTE_IDS: PaletteId[] = ['djuphav', 'medelhav', 'terrakotta', 'skog', 'nattflyg', 'egen'];
const SIZES: TextSize[] = ['liten', 'normal', 'stor'];
const TONES: Tone[] = ['neutral', 'lekfull', 'romantisk'];

/** Gör om okänd data (från databasen eller webbläsaren) till giltiga inställningar. */
export function sanitizeTheme(raw: unknown): ThemeSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (r.custom && typeof r.custom === 'object' ? r.custom : {}) as Record<string, unknown>;
  const hex = (v: unknown, fb: string) => (typeof v === 'string' && isHex(v) ? v.toUpperCase() : fb);
  const pick = <T,>(v: unknown, list: readonly T[], fb: T) => (list.includes(v as T) ? (v as T) : fb);
  const radius = typeof r.radius === 'number' && Number.isFinite(r.radius) ? Math.round(r.radius) : DEFAULT_THEME.radius;
  return {
    palette: pick(r.palette, PALETTE_IDS, DEFAULT_THEME.palette),
    custom: {
      p: hex(c.p, DEFAULT_THEME.custom.p),
      a: hex(c.a, DEFAULT_THEME.custom.a),
      bg: hex(c.bg, DEFAULT_THEME.custom.bg),
    },
    headingFont: pick<HeadingFont>(r.headingFont, HEADING_FONTS.map((f) => f.name), DEFAULT_THEME.headingFont),
    bodyFont: pick<BodyFont>(r.bodyFont, BODY_FONTS.map((f) => f.name), DEFAULT_THEME.bodyFont),
    textSize: pick(r.textSize, SIZES, DEFAULT_THEME.textSize),
    dark: typeof r.dark === 'boolean' ? r.dark : DEFAULT_THEME.dark,
    radius: Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, radius)),
    tone: pick(r.tone, TONES, DEFAULT_THEME.tone),
    lang: LANGS.includes(r.lang as never) ? (r.lang as ThemeSettings['lang']) : null,
    countryList: pick(r.countryList, COUNTRY_LISTS, DEFAULT_THEME.countryList),
  };
}

const STORAGE_KEY = `${APP_NAME.toLowerCase()}.tema`;

export function readLocalTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitizeTheme(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function writeLocalTheme(s: ThemeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Privat läge eller full lagring: temat gäller ändå under besöket.
  }
}
