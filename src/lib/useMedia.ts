// Följer en mediefråga, till exempel bred skärm (från 900 px). Uppdateras när fönstret ändrar storlek.
import { useSyncExternalStore } from 'react';

/** Bredden där flikraden blir en meny till vänster och kartan får en kolumn till höger (Körning 16). */
export const WIDE = '(min-width: 900px)';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia?.(query);
      m?.addEventListener('change', cb);
      return () => m?.removeEventListener('change', cb);
    },
    () => Boolean(window.matchMedia?.(query).matches),
    () => false,
  );
}
