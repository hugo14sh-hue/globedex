// Egna statusfärger under Anpassning (Körning 16). Sparas per användare i profiles.settings (temat) och går
// före palettens färger i både ljust och mörkt läge. Ren logik, testas i mapColors.test.ts.
import { COLOR_KEYS, type ColorKey, type ThemeSettings } from '../config';
import { deltaE, isHex, MIN_DELTA_E } from '../theme/color';
import { statusColors } from '../theme/theme';
import { STATUS_KEY } from './statusLogic';

/** Radens namn: samma text som i kartans förklaring. bara-annan har {namn}. */
export const COLOR_LABEL: Record<ColorKey, string> = {
  bor: STATUS_KEY.bor,
  bott: STATUS_KEY.bott,
  besokt: 'karta.forklaring.sjalv',
  tillsammans: 'karta.forklaring.tillsammans',
  bada: 'karta.forklaring.bada',
  'bara-annan': 'karta.forklaring.bara-annan',
  planerad: STATUS_KEY.planerad,
  vill: STATUS_KEY.vill,
  mellan: STATUS_KEY.mellan,
};

/** Färgerna för besökt i sällskap. Visas bara för den som är med i en par- eller gruppgrupp. */
export const COMPANY_KEYS: ColorKey[] = ['tillsammans', 'bada', 'bara-annan'];

/** Sätter en egen färg. */
export function withColor(s: ThemeSettings, key: ColorKey, hex: string): ThemeSettings {
  if (!isHex(hex)) return s;
  return { ...s, mapColors: { ...s.mapColors, [key]: hex.toUpperCase() } };
}

/** Tar bort en egen färg (raden följer paletten igen). */
export function withoutColor(s: ThemeSettings, key: ColorKey): ThemeSettings {
  const next = { ...s.mapColors };
  delete next[key];
  return { ...s, mapColors: next };
}

/** Tar bort alla egna färger. */
export const withoutColors = (s: ThemeSettings): ThemeSettings => ({ ...s, mapColors: {} });

/**
 * Den status som ligger närmast en egen färg, om den är närmare än färgtestets gräns (MIN_DELTA_E).
 * Jämförs med de andra statusarnas färger i det läge kartan visas i. keys är raderna som visas.
 */
export function closeTo(s: ThemeSettings, key: ColorKey, dark: boolean, keys: readonly ColorKey[] = COLOR_KEYS): ColorKey | null {
  const own = s.mapColors[key];
  if (!own) return null;
  const c = statusColors(s, dark);
  let best: { k: ColorKey; d: number } | null = null;
  for (const k of keys) {
    if (k === key) continue;
    const d = deltaE(own, c[k]);
    if (d < MIN_DELTA_E && (!best || d < best.d)) best = { k, d };
  }
  return best?.k ?? null;
}
