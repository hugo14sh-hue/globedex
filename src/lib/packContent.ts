// Packlistans allmänna förslag ur content/_packlista.json (skrivs av Hugo, formatet står i docs/FORMAT.md).
// Filen läses in vid bygget om den finns. Finns den inte är listan tom och knappen Hämta förslag är avstängd.
import type { PackSuggestion } from './tripLogic';

const files = import.meta.glob<{ items?: PackSuggestion[] }>('../../content/_packlista.json', { eager: true, import: 'default' });

export const PACK_SUGGESTIONS: PackSuggestion[] = Object.values(files)[0]?.items ?? [];
