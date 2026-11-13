// Färdiga punkter för Innan avresa ur content/_innan-avresa.json (skrivs av Hugo, formatet står i docs/FORMAT.md).
// Filen läses in vid bygget om den finns. Finns den inte är listan tom och knappen Hämta förslag är avstängd.
import type { PretripSuggestion } from './tripLogic';

const files = import.meta.glob<{ items?: PretripSuggestion[] }>('../../content/_innan-avresa.json', { eager: true, import: 'default' });

export const PRETRIP_SUGGESTIONS: PretripSuggestion[] = Object.values(files)[0]?.items ?? [];
