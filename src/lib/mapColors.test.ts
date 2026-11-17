import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, type ThemeSettings } from '../config';
import { deltaE, MIN_DELTA_E } from '../theme/color';
import { PALETTES, STATUS_FIXED } from '../theme/palettes';
import { mapIsDark, paletteStatusColors, sanitizeTheme, statusColors, themeVars } from '../theme/theme';
import { closeTo, withColor, withoutColor, withoutColors } from './mapColors';

const base: ThemeSettings = { ...DEFAULT_THEME };

describe('egna statusfärger', () => {
  it('går före palettens färger, i både ljust och mörkt läge', () => {
    const s = withColor(base, 'vill', '#123abc');
    for (const dark of [false, true]) {
      expect(statusColors(s, dark).vill).toBe('#123ABC');
      expect(statusColors(s, dark).planerad).toBe(paletteStatusColors(s, dark).planerad);
    }
    expect(themeVars(s)['--st-vill']).toBe('#123ABC');
    expect(themeVars({ ...s, dark: true })['--st-vill']).toBe('#123ABC');
  });

  it('bara jag följer besökt på egen hand', () => {
    const s = withColor(base, 'besokt', '#00FF00');
    expect(statusColors(s)['bara-jag']).toBe('#00FF00');
    expect(statusColors(base)['bara-jag']).toBe(STATUS_FIXED.besokt);
  });

  it('en rad utan eget val följer paletten, också när paletten byts', () => {
    const s = withColor(base, 'vill', '#123ABC');
    for (const p of PALETTES) {
      const c = statusColors({ ...s, palette: p.id });
      expect(c.bor).toBe(paletteStatusColors({ ...s, palette: p.id }).bor);
      expect(c.vill).toBe('#123ABC');
    }
  });

  it('återställs en i taget och alla på en gång', () => {
    const s = withColor(withColor(base, 'vill', '#123ABC'), 'bor', '#ABCDEF');
    expect(withoutColor(s, 'vill').mapColors).toEqual({ bor: '#ABCDEF' });
    expect(statusColors(withoutColor(s, 'vill')).vill).toBe(paletteStatusColors(base).vill);
    expect(withoutColors(s).mapColors).toEqual({});
    expect(statusColors(withoutColors(s))).toEqual(paletteStatusColors(base));
  });

  it('ogiltiga färger och okända statusar sparas inte', () => {
    expect(withColor(base, 'vill', 'röd').mapColors).toEqual({});
    expect(sanitizeTheme({ mapColors: { vill: '#12345', bor: '#abcdef', ej: '#000000', okand: '#111111' } }).mapColors).toEqual({ bor: '#ABCDEF' });
    expect(sanitizeTheme(null).mapColors).toEqual({});
  });
});

describe('varningen för närliggande färger', () => {
  it('visas när färgen ligger närmare en annan status än färgtestets gräns', () => {
    const s = withColor(base, 'vill', '#F5BA45');
    expect(deltaE('#F5BA45', STATUS_FIXED.planerad)).toBeLessThan(MIN_DELTA_E);
    expect(closeTo(s, 'vill', false)).toBe('planerad');
  });

  it('visas inte för en färg långt från alla andra, eller utan eget val', () => {
    expect(closeTo(withColor(base, 'vill', '#000000'), 'vill', false)).toBeNull();
    expect(closeTo(base, 'vill', false)).toBeNull();
  });

  it('jämför bara med raderna som visas', () => {
    const s = withColor(base, 'vill', '#E0527A');
    expect(closeTo(s, 'vill', false)).toBe('tillsammans');
    expect(closeTo(s, 'vill', false, ['bor', 'bott', 'besokt', 'planerad', 'vill', 'mellan'])).toBeNull();
  });
});

describe('kartans stil', () => {
  it('auto följer appens tema, ljus och mörk gäller oberoende av temat', () => {
    expect(mapIsDark({ ...base, mapStyle: 'auto', dark: false })).toBe(false);
    expect(mapIsDark({ ...base, mapStyle: 'auto', dark: true })).toBe(true);
    expect(mapIsDark({ ...base, mapStyle: 'ljus', dark: true })).toBe(false);
    expect(mapIsDark({ ...base, mapStyle: 'mork', dark: false })).toBe(true);
  });

  it('auto är förvalt, och okända värden blir auto', () => {
    expect(DEFAULT_THEME.mapStyle).toBe('auto');
    expect(sanitizeTheme({ mapStyle: 'neon' }).mapStyle).toBe('auto');
    expect(sanitizeTheme({ mapStyle: 'mork' }).mapStyle).toBe('mork');
  });

  // OpenFreeMaps mörka stil (tiles.openfreemap.org/styles/dark, kontrollerad 2026-11-17): hav rgb(27,27,29) och land
  // rgb(12,12,12). Länder utan status fylls med STATUS_FIXED.ejMork. Alla statusfärger i mörk variant ska gå att
  // skilja från havet och från land utan status med färgtestets gräns, i alla paletter.
  const SEA = '#1B1B1D';
  for (const p of PALETTES)
    it(`mörk karta, ${p.name}: statusfärgerna skiljer sig från havet och från land utan status`, () => {
      const c = statusColors({ ...base, palette: p.id }, true);
      for (const [k, v] of Object.entries(c)) {
        if (k === 'ej') continue;
        expect(deltaE(v, SEA), `${k} mot havet`).toBeGreaterThanOrEqual(MIN_DELTA_E);
        expect(deltaE(v, c.ej), `${k} mot land utan status`).toBeGreaterThanOrEqual(MIN_DELTA_E);
      }
    });
});

describe('släckta statusar och fokus i inställningarna', () => {
  it('bara kända färgnycklar sparas', () => {
    expect(sanitizeTheme({ mapHidden: ['besokt', 'okand', 'bara-jag', 3] }).mapHidden).toEqual(['besokt', 'bara-jag']);
    expect(sanitizeTheme({}).mapHidden).toEqual([]);
  });

  it('fokus: giltigt värde sparas, annars Europa', () => {
    expect(sanitizeTheme({ mapFocus: '142' }).mapFocus).toBe('142');
    expect(sanitizeTheme({ mapFocus: 'SE' }).mapFocus).toBe('SE');
    expect(sanitizeTheme({ mapFocus: 'mars' }).mapFocus).toBe('150');
  });
});
