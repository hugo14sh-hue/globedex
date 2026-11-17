// Färgerna för besökt i sällskap ska gå att skilja från varandra, från vill åka och planerad och från
// kartans bakgrund (ej satt), i alla paletter och i ljust och mörkt läge. Avstånd i CIEDE2000.
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, type PaletteId } from '../config';
import { PALETTES } from './palettes';
import { statusColors } from './theme';
import { deltaE, MIN_DELTA_E } from './color';

/** Tydligt olika fyllnadsfärger på en karta. */
const MIN_DE = MIN_DELTA_E;
const FOUR = ['tillsammans', 'bada', 'bara-jag', 'bara-annan'] as const;

const pairs = (dark: boolean, palette: PaletteId) => {
  const c = statusColors({ ...DEFAULT_THEME, dark, palette });
  const out: { a: string; b: string; de: number }[] = [];
  const keys = [...FOUR, 'planerad', 'vill', 'ej'] as const;
  for (const a of FOUR) for (const b of keys) if (a !== b && keys.indexOf(b) > FOUR.indexOf(a)) out.push({ a, b, de: deltaE(c[a], c[b]) });
  return out;
};

describe('färgerna för besökt i sällskap', () => {
  it('räknar CIEDE2000 som referensvärdena (Sharma 2005)', () => {
    expect(deltaE('#000000', '#000000')).toBe(0);
    expect(deltaE('#FFFFFF', '#000000')).toBeCloseTo(100, 0);
  });

  for (const p of PALETTES)
    it(`mörkt läge, ${p.name}: de fyra skiljer sig från varandra, vill åka, planerad och kartans bakgrund`, () => {
      for (const x of pairs(true, p.id)) expect(x.de, `${x.a} mot ${x.b}`).toBeGreaterThanOrEqual(MIN_DE);
    });

  // Ljust läge: inga kända par under gränsen. Terrakottas vill åka byttes i Körning 15 (låg 5,4 från besökt).
  const KNOWN_LIGHT: string[] = [];
  it('ljust läge: inga par ligger för nära', () => {
    const low = PALETTES.flatMap((p) => pairs(false, p.id).filter((x) => x.de < MIN_DE).map((x) => `${p.id} ${x.a} ${x.b}`));
    expect(low).toEqual(KNOWN_LIGHT);
  });

  it('Terrakotta: vill åka skiljer sig från besökt och planerad i båda lägena', () => {
    for (const dark of [false, true]) {
      const c = statusColors({ ...DEFAULT_THEME, dark, palette: 'terrakotta' });
      expect(deltaE(c.vill, c.besokt)).toBeGreaterThanOrEqual(MIN_DE);
      expect(deltaE(c.vill, c.planerad)).toBeGreaterThanOrEqual(MIN_DE);
    }
  });
});
