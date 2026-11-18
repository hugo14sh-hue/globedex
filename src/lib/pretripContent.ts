// Färdiga punkter för Innan avresa ur content/_innan-avresa.json (skrivs av Hugo, formatet står i docs/FORMAT.md).
// Filen läses in vid bygget om den finns. Finns den inte är listan tom och knappen Hämta förslag är avstängd.
// Engelskan ligger i content/en/_innan-avresa.json (Körning 20). Punkterna kopieras till resan på det språk
// som är valt när de läggs till. Saknas en fil eller en text gäller svenskan.
import type { Lang } from '../config';
import { localize } from './innehallSprak';
import { currentLanguage } from './texter';
import type { PretripSuggestion } from './tripLogic';

const files = import.meta.glob<{ items?: PretripSuggestion[] }>('../../content/_innan-avresa.json', { eager: true, import: 'default' });
const enFiles = import.meta.glob<{ items?: Record<string, { title?: string; hint?: string }> }>('../../content/en/_innan-avresa.json', {
  eager: true,
  import: 'default',
});
const EN = Object.values(enFiles)[0] ?? {};

/** Punkterna på svenska (originalet). */
export const PRETRIP_SUGGESTIONS: PretripSuggestion[] = Object.values(files)[0]?.items ?? [];

/**
 * Punkterna på valt språk, med svenskan som reserv fält för fält. alt är titeln på det andra språket, så att
 * en punkt som redan finns på resan (på vilket språk som helst) inte läggs till igen och får sin dag.
 */
export function pretripSuggestions(lang: Lang = currentLanguage(), en = EN): PretripSuggestion[] {
  return PRETRIP_SUGGESTIONS.map((s) => {
    const row = localize({ ...s, en: en.items?.[s.id] ?? null }, lang);
    const enTitle = en.items?.[s.id]?.title;
    const other = lang === 'sv' ? enTitle : s.title;
    return {
      id: s.id,
      title: row.title,
      ...(row.hint !== undefined ? { hint: row.hint } : {}),
      days_before: s.days_before,
      ...(other && other !== row.title ? { alt: other } : {}),
    };
  });
}
