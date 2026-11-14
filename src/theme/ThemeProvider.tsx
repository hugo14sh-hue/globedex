import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, ThemeSettings } from '../config';
import { applyTheme, readLocalTheme, writeLocalTheme } from './theme';
import { currentLanguage, loadTexts, setLanguage, setTone } from '../lib/texter';
import { resolveLang } from '../lib/locale';

interface ThemeCtx {
  theme: ThemeSettings;
  /** Språket som gäller på skärmen just nu (valt språk när dess texter har laddats). */
  lang: Lang;
  /** Ändrar temat lokalt direkt. Sparas i profilen av den som lyssnar på onChange. */
  setTheme: (next: ThemeSettings) => void;
  update: (patch: Partial<ThemeSettings>) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

// Temat sätts innan första renderingen, så att appen har rätt färger direkt.
const initial = readLocalTheme();
applyTheme(initial);
setTone(initial.tone);

/**
 * Språket innan första renderingen: valt språk (sparat lokalt), annars webbläsarens.
 * Den engelska filen hämtas här, så att rätt språk syns direkt vid start. main.tsx väntar på den.
 */
export async function prepareLanguage(): Promise<void> {
  const want = resolveLang(initial.lang);
  try {
    await loadTexts(want);
  } catch {
    // Filen gick inte att hämta (till exempel offline första gången): svenska används.
  }
  setLanguage(want);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setState] = useState<ThemeSettings>(initial);
  const [lang, setLang] = useState<Lang>(currentLanguage);

  const setTheme = useCallback((next: ThemeSettings) => {
    setTone(next.tone);
    setState(next);
  }, []);

  const update = useCallback((patch: Partial<ThemeSettings>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      setTone(next.tone);
      return next;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
    writeLocalTheme(theme);
  }, [theme]);

  // Byt språk när valet ändras (i Anpassning eller från profilen). Texterna hämtas först.
  const want = resolveLang(theme.lang);
  useEffect(() => {
    if (want === lang) return;
    let alive = true;
    loadTexts(want)
      .catch(() => undefined)
      .then(() => {
        if (alive) setLang(setLanguage(want));
      });
    return () => {
      alive = false;
    };
  }, [want, lang]);

  const value = useMemo(() => ({ theme, lang, setTheme, update }), [theme, lang, setTheme, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme används utanför ThemeProvider');
  return c;
}
