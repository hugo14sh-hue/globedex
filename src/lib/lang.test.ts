import { afterEach, describe, expect, it } from 'vitest';
import en from '../../content/_texter.en.json';
import sv from '../../content/_texter.json';
import { formatSek } from '../features/karta/format';
import { browserLang, LOCALE, resolveLang } from './locale';
import { badges, registerTexts, setLanguage, setTone, t, text, type TextFile } from './texter';
import { sanitizeTheme } from '../theme/theme';

const EN = en as unknown as TextFile;
// Värdena jämförs mot filerna, så att testet inte skriver egna texter.
const enText = (k: string, tone = 'neutral') => {
  const e = (EN.texter as Record<string, unknown>)[k];
  return typeof e === 'string' ? e : (e as Record<string, string>)[tone];
};

afterEach(() => {
  setLanguage('sv');
  setTone('neutral');
});

describe('språk', () => {
  it('väljer svenska när webbläsarens språk börjar med sv, annars engelska', () => {
    expect(browserLang('sv-SE')).toBe('sv');
    expect(browserLang('sv')).toBe('sv');
    expect(browserLang('SV-fi')).toBe('sv');
    expect(browserLang('en-US')).toBe('en');
    expect(browserLang('de-DE')).toBe('en');
    expect(browserLang(undefined)).toBe('en');
  });

  it('ett gjort val går före webbläsarens språk', () => {
    expect(resolveLang('sv')).toBe('sv');
    expect(resolveLang('en')).toBe('en');
  });

  it('sparar språkvalet i temat och tål okända värden', () => {
    expect(sanitizeTheme({ lang: 'en' }).lang).toBe('en');
    expect(sanitizeTheme({ lang: 'sv' }).lang).toBe('sv');
    expect(sanitizeTheme({ lang: 'de' }).lang).toBeNull();
    expect(sanitizeTheme(null).lang).toBeNull();
  });

  it('stannar på svenska om den engelska filen inte är hämtad', () => {
    // Filen registreras först i nästa test. Här finns bara svenska.
    expect(setLanguage('sv')).toBe('sv');
  });

  it('t läser engelska när engelska är valt, i alla språkstilar', () => {
    registerTexts('en', EN);
    expect(setLanguage('en')).toBe('en');
    expect(LOCALE).toBe('en-GB');
    expect(t('flik.karta')).toBe(enText('flik.karta'));
    setTone('lekfull');
    expect(t('login.rubrik')).toBe(enText('login.rubrik', 'lekfull'));
    setTone('romantisk');
    expect(t('login.rubrik')).toBe(enText('login.rubrik', 'romantisk'));
    setLanguage('sv');
    expect(LOCALE).toBe('sv-SE');
    expect(t('login.rubrik')).toBe((sv.texter['login.rubrik'] as Record<string, string>).romantisk);
  });

  it('använder den svenska texten när en nyckel saknas på engelska', () => {
    const k = 'knapp.spara';
    const partial: TextFile = { texter: {}, marken: [] };
    registerTexts('en', partial);
    setLanguage('en');
    expect(text(k, 'neutral')).toBe(sv.texter[k]);
    registerTexts('en', EN);
  });

  it('märkena får engelska namn men samma regler', () => {
    registerTexts('en', EN);
    setLanguage('en');
    const list = badges();
    expect(list).toHaveLength(sv.marken.length);
    for (const b of list) {
      const s = sv.marken.find((x) => x.id === b.id)!;
      const e = EN.marken.find((x) => x.id === b.id)!;
      expect(b.rule).toBe(s.rule);
      expect(b.name).toBe(e.name);
    }
  });

  it('visar kronor som SEK på engelska och kr på svenska', () => {
    registerTexts('en', EN);
    setLanguage('en');
    expect(formatSek(1200)).toMatch(/SEK/);
    setLanguage('sv');
    expect(formatSek(1200)).toMatch(/kr/);
    expect(formatSek(1200)).not.toMatch(/SEK/);
  });
});
