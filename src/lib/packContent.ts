// Packlistans allmänna förslag ur content/_packlista.json (skrivs av Hugo, formatet står i docs/FORMAT.md).
// Filen läses in vid bygget om den finns. Finns den inte är listan tom och knappen Hämta förslag är avstängd.
// Engelskan ligger i content/en/_packlista.json (Körning 20): titlar per id och gruppnamn per svenskt namn.
// Förslagen kopieras till resan på det språk som är valt när de läggs till. Gruppnamnen sparas på svenska
// och översätts när raden visas, om gruppen är en av grupperna i mallen. Saknas en fil eller en text gäller svenskan.
import type { Lang } from '../config';
import { localize } from './innehallSprak';
import { currentLanguage } from './texter';
import type { PackSuggestion } from './tripLogic';

const files = import.meta.glob<{ items?: PackSuggestion[] }>('../../content/_packlista.json', { eager: true, import: 'default' });
const enFiles = import.meta.glob<{ groups?: Record<string, string>; items?: Record<string, { title?: string }> }>('../../content/en/_packlista.json', {
  eager: true,
  import: 'default',
});
const EN = Object.values(enFiles)[0] ?? {};

/** Förslagen på svenska (originalet). */
export const PACK_SUGGESTIONS: PackSuggestion[] = Object.values(files)[0]?.items ?? [];

/** Grupperna i mallen (de svenska namnen). */
export const PACK_GROUPS = [...new Set(PACK_SUGGESTIONS.map((s) => s.group))];

/**
 * Förslagen på valt språk, med svenskan som reserv fält för fält. alt är titeln på det andra språket, så att
 * en sak som redan finns på listan (på vilket språk som helst) inte föreslås igen.
 */
export function packSuggestions(lang: Lang = currentLanguage(), en = EN): PackSuggestion[] {
  return PACK_SUGGESTIONS.map((s) => {
    const row = localize({ ...s, en: en.items?.[s.id] ?? null }, lang);
    const enTitle = en.items?.[s.id]?.title;
    const other = lang === 'sv' ? enTitle : s.title;
    return { id: s.id, group: s.group, title: row.title, ...pick(s), ...(other && other !== row.title ? { alt: other } : {}) };
  });
}

const pick = ({ min_nights, max_nights, months }: PackSuggestion) => ({
  ...(min_nights != null ? { min_nights } : {}),
  ...(max_nights != null ? { max_nights } : {}),
  ...(months ? { months } : {}),
});

/** Gruppens namn på valt språk. Bara grupperna i mallen översätts, egna grupper visas som de står. */
export function packGroupName(group: string, lang: Lang = currentLanguage(), en = EN): string {
  if (lang === 'sv' || !PACK_GROUPS.includes(group)) return group;
  const name = en.groups?.[group];
  return typeof name === 'string' && name.trim() ? name : group;
}
