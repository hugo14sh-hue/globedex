import { useCallback } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { text, type Values } from './texter';

/** t(nyckel, värden) som ritar om komponenten när språkstilen eller språket byts. */
export function useT() {
  const { theme, lang } = useTheme();
  return useCallback((key: string, values?: Values) => text(key, theme.tone, values, lang), [theme.tone, lang]);
}

/**
 * Språket som gäller på skärmen. Skärmar som visar innehåll (content.ts) har det bland beroendena när de
 * hämtar, så att innehållet hämtas om på det nya språket när språket byts.
 */
export function useLang() {
  return useTheme().lang;
}
