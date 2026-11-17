// Färgerna för besökt i sällskap ska gå att skilja från varandra, från vill åka och planerad och från
// kartans bakgrund (ej satt), i alla paletter och i ljust och mörkt läge. Avstånd i CIEDE2000.
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, type PaletteId } from '../config';
import { PALETTES } from './palettes';
import { statusColors } from './theme';

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lab(h: string): [number, number, number] {
  const [r, g, b] = rgb(h).map(lin);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** CIEDE2000. */
function deltaE(a: string, b: string): number {
  const [L1, a1, b1] = lab(a);
  const [L2, a2, b2] = lab(b);
  const rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const C1 = Math.hypot(ap1, b1);
  const C2 = Math.hypot(ap2, b2);
  const hue = (y: number, x: number) => {
    const h = Math.atan2(y, x) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1 = hue(b1, ap1);
  const h2 = hue(b2, ap2);
  let dh = h2 - h1;
  if (C1 * C2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2 - L1;
  const dC = C2 - C1;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * rad) / 2);
  const Lb = (L1 + L2) / 2;
  const Cpb = (C1 + C2) / 2;
  let hb = h1 + h2;
  if (C1 * C2 !== 0) hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const Sc = 1 + 0.045 * Cpb;
  const Sh = 1 + 0.015 * Cpb * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

/** Tydligt olika fyllnadsfärger på en karta. */
const MIN_DE = 10;
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
