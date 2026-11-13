import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemeSettings } from '../config';
import { applyTheme, readLocalTheme, writeLocalTheme } from './theme';
import { setTone } from '../lib/texter';

interface ThemeCtx {
  theme: ThemeSettings;
  /** Ändrar temat lokalt direkt. Sparas i profilen av den som lyssnar på onChange. */
  setTheme: (next: ThemeSettings) => void;
  update: (patch: Partial<ThemeSettings>) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

// Temat sätts innan första renderingen, så att appen har rätt färger direkt.
const initial = readLocalTheme();
applyTheme(initial);
setTone(initial.tone);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setState] = useState<ThemeSettings>(initial);

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

  const value = useMemo(() => ({ theme, setTheme, update }), [theme, setTheme, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme används utanför ThemeProvider');
  return c;
}
