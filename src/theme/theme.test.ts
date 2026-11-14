import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../config';
import { contrast, mix, onColor, TEXT_DARK, TEXT_LIGHT } from './color';
import { PALETTES } from './palettes';
import { hasLowContrast, modeContrast, resolvePalette, sanitizeTheme, themeVars } from './theme';

describe('färger', () => {
  it('räknar kontrast enligt WCAG', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBe(1);
  });

  it('blandar färger', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('väljer läsbar text på primärfärg', () => {
    expect(onColor('#0F4C5C')).toBe('#FFFFFF');
    expect(onColor('#F4B942')).toBe('#1B1B1F');
  });

  it('väljer mörk text där vit ger under 4,5:1', () => {
    // Djuphavs primär i mörkt läge: vit ger bara drygt 2:1.
    expect(contrast('#5FB0C2', TEXT_LIGHT)).toBeLessThan(4.5);
    expect(onColor('#5FB0C2')).toBe(TEXT_DARK);
    // Terrakotta i ljust läge klarar precis vit text.
    expect(contrast('#C2410C', TEXT_LIGHT)).toBeGreaterThanOrEqual(4.5);
    expect(onColor('#C2410C')).toBe(TEXT_LIGHT);
  });
});

describe('kontrast i alla paletter', () => {
  for (const P of PALETTES) {
    for (const dark of [false, true]) {
      it(`${P.name}, ${dark ? 'mörkt' : 'ljust'} läge: text på primärfärgen klarar 4,5:1`, () => {
        const v = themeVars({ ...DEFAULT_THEME, palette: P.id, dark });
        expect(v['--p']).toBe(dark ? P.pd : P.p);
        expect(contrast(v['--p'], v['--onp'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v['--bg'], v['--tx'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v['--sf'], v['--tx'])).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`${P.name}: ingen varning`, () => {
      expect(hasLowContrast({ ...DEFAULT_THEME, palette: P.id })).toBe(false);
    });
  }

  // Körning 7: alla textpar som används i gränssnittet, i alla fem paletter och båda lägena.
  for (const P of PALETTES) {
    for (const dark of [false, true]) {
      it(`${P.name}, ${dark ? 'mörkt' : 'ljust'} läge: dämpad text, länkar och accentknappar klarar 4,5:1`, () => {
        const v = themeVars({ ...DEFAULT_THEME, palette: P.id, dark });
        // --soft är 14 % primärfärg i ytan (color-mix i CSS).
        const soft = mix(v['--sf'], v['--p'], 0.14);
        expect(contrast(v['--mu'], v['--bg'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v['--mu'], v['--sf'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v['--mu'], soft)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v['--tx'], soft)).toBeGreaterThanOrEqual(4.5);
        // Primärfärgen som text: länkar och vald flik.
        expect(contrast(v['--p'], v['--bg'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v['--p'], v['--sf'])).toBeGreaterThanOrEqual(4.5);
        // Text på accentknappar.
        expect(contrast(v['--ona'], v['--a'])).toBeGreaterThanOrEqual(4.5);
        // Fokusringen (textfärgen) mot bakgrunden: minst 3:1 för icke-text.
        expect(contrast(v['--tx'], v['--bg'])).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it('mörkt läge får mörk text på den ljusa primärfärgen', () => {
    for (const P of PALETTES) {
      expect(themeVars({ ...DEFAULT_THEME, palette: P.id, dark: true })['--onp']).toBe(TEXT_DARK);
    }
  });

  it('egen palett: text på primärfärgen väljs efter kontrast i båda lägena', () => {
    for (const p of ['#B5179E', '#FFD166', '#0B3D2E', '#7A7A7A', '#E4572E']) {
      for (const dark of [false, true]) {
        const s = { ...DEFAULT_THEME, palette: 'egen' as const, custom: { p, a: '#FFD166', bg: '#FFFFFF' }, dark };
        const v = themeVars(s);
        const white = contrast(v['--p'], TEXT_LIGHT);
        expect(v['--onp']).toBe(white >= 4.5 ? TEXT_LIGHT : TEXT_DARK);
      }
    }
  });

  it('varningen för egen palett räknar båda lägena', () => {
    const s = { ...DEFAULT_THEME, palette: 'egen' as const, custom: { p: '#1D3557', a: '#FFD166', bg: '#FFFFFF' } };
    expect(modeContrast(s, false)).toBeGreaterThanOrEqual(4.5);
    expect(modeContrast(s, true)).toBeGreaterThanOrEqual(4.5);
    expect(hasLowContrast(s)).toBe(false);
    // Mellangrå: varken vit eller mörk text når 4,5:1 i ljust läge.
    const gra = { ...s, custom: { ...s.custom, p: '#808080' } };
    expect(modeContrast(gra, false)).toBeLessThan(4.5);
    expect(hasLowContrast(gra)).toBe(true);
    // Mörkt läge räknas med: varningen är det lägsta av de två lägena.
    expect(Math.min(modeContrast(gra, false), modeContrast(gra, true))).toBeLessThan(4.5);
  });

  it('varnar när bara mörkt läge brister', () => {
    // #0000CC klarar vit text i ljust läge, men den ljusare primären i mörkt läge
    // når inte 4,5:1 med varken vit eller mörk text.
    const s = { ...DEFAULT_THEME, palette: 'egen' as const, custom: { p: '#0000CC', a: '#FFD166', bg: '#FFFFFF' } };
    const P = resolvePalette(s);
    expect(modeContrast(s, false)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.pd, TEXT_LIGHT)).toBeLessThan(4.5);
    expect(contrast(P.pd, TEXT_DARK)).toBeLessThan(4.5);
    expect(modeContrast(s, true)).toBeLessThan(4.5);
    expect(hasLowContrast(s)).toBe(true);
  });
});

describe('tema', () => {
  it('startläget är Djuphav, Fraunces och DM Sans, ljust, 16 px', () => {
    const v = themeVars(DEFAULT_THEME);
    expect(v['--p']).toBe('#0F4C5C');
    expect(v['--bg']).toBe('#FBF7F0');
    expect(v['--fh']).toContain('Fraunces');
    expect(v['--fb']).toContain('DM Sans');
    expect(v['--r']).toBe('16px');
  });

  it('mörkt läge använder mörka färger', () => {
    const v = themeVars({ ...DEFAULT_THEME, dark: true });
    expect(v['--p']).toBe('#5FB0C2');
    expect(v['--bg']).toBe('#0E1A20');
    expect(v['--sf']).toBe('#172830');
  });

  it('räknar ut mörkt läge för egen palett', () => {
    const p = resolvePalette({ ...DEFAULT_THEME, palette: 'egen', custom: { p: '#000000', a: '#FFFFFF', bg: '#FFFFFF' } });
    expect(p.pd).toBe(mix('#000000', '#FFFFFF', 0.45));
  });

  it('varnar för låg kontrast', () => {
    expect(hasLowContrast(DEFAULT_THEME)).toBe(false);
    expect(hasLowContrast({ ...DEFAULT_THEME, palette: 'egen', custom: { p: '#808080', a: '#FFD166', bg: '#FFFFFF' } })).toBe(true);
  });

  it('rensar ogiltiga inställningar', () => {
    expect(sanitizeTheme(null)).toEqual(DEFAULT_THEME);
    const s = sanitizeTheme({ palette: 'okand', radius: 99, headingFont: 'Comic Sans', custom: { p: 'röd' }, tone: 'lekfull' });
    expect(s.palette).toBe('djuphav');
    expect(s.radius).toBe(26);
    expect(s.headingFont).toBe('Fraunces');
    expect(s.custom.p).toBe(DEFAULT_THEME.custom.p);
    expect(s.tone).toBe('lekfull');
  });
});
