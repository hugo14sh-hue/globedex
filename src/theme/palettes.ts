import type { PaletteId } from '../config';

export interface Palette {
  id: PaletteId;
  /** Namnet på paletten, enligt CLAUDE.md. */
  name: string;
  p: string; // primär
  pd: string; // primär i mörkt läge
  a: string; // accent
  bg: string; // bakgrund
  bgd: string; // bakgrund i mörkt läge
  sd: string; // yta i mörkt läge
  /** Egen färg för vill åka (ljust och mörkt läge) när accent 62 % ligger för nära kartans andra färger. */
  vill?: string;
}

// Terrakotta: vill åka är #7C2D12 (samma orange familj som primären) i stället för accent 62 %, som låg
// 5,4 från besökt. Minst 13 (CIEDE2000) mot besökt, planerad, de fyra sällskapsfärgerna, bor, har bott och
// ej satt i båda lägena (companyColors.test.ts).
export const PALETTES: Palette[] = [
  { id: 'djuphav', name: 'Djuphav', p: '#0F4C5C', pd: '#5FB0C2', a: '#FF6B4A', bg: '#FBF7F0', bgd: '#0E1A20', sd: '#172830' },
  { id: 'medelhav', name: 'Medelhav', p: '#1D4ED8', pd: '#7B9BFF', a: '#F59E0B', bg: '#F8FAFC', bgd: '#0B1220', sd: '#141E33' },
  { id: 'terrakotta', name: 'Terrakotta', p: '#C2410C', pd: '#F08A5D', a: '#0D9488', bg: '#FFF7ED', bgd: '#1C1210', sd: '#2A1C18', vill: '#7C2D12' },
  { id: 'skog', name: 'Skog och fjäll', p: '#166534', pd: '#5CCB84', a: '#EAB308', bg: '#F7F7F2', bgd: '#0F1A14', sd: '#18261D' },
  { id: 'nattflyg', name: 'Nattflyg', p: '#6D28D9', pd: '#AE8BFA', a: '#22D3EE', bg: '#FAF5FF', bgd: '#120B1F', sd: '#1E1530' },
];

/** Kartans statusfärger. Bor och vill åka räknas ut från paletten. */
export const STATUS_FIXED = {
  besokt: '#2EC4B6',
  planerad: '#F4B942',
  mellan: '#B8C4C9',
  ejLjus: '#E8E2D6',
  ejMork: '#2A353C',
} as const;

/**
 * Besökt i sällskap (Min karta och Vår karta). Bara jag har samma färg som besökt (STATUS_FIXED.besokt).
 * Ljust tema enligt Hugo (bara den andra #D9822B, så att den skiljer sig från planerad). Mörkt tema: samma kulörer, ljusare rosa och lila för mörk bakgrund och en
 * mer orange ton för bara den andra, så att den skiljer sig från planerad (CIEDE2000 14 mot planerad).
 * Avstånden kontrolleras i companyColors.test.ts.
 */
export const COMPANY_COLORS = {
  ljus: { tillsammans: '#E0527A', bada: '#7B61C9', baraAnnan: '#D9822B' },
  mork: { tillsammans: '#EA6F93', bada: '#9A86E0', baraAnnan: '#D98A2B' },
} as const;

export const RARITY_COLORS = {
  vanlig: '#8A939B',
  ovanlig: '#3FA34D',
  sallsynt: '#3B82F6',
  legendarisk: '#E0A21B',
} as const;

/** Smart månad: färg efter betyg 0–5 (som i prototypen). Lågt = undvik, högt = perfekt. */
export const SMART_COLORS = ['#D64545', '#D64545', '#F28C4B', '#F4B942', '#7CC26B', '#2E9E5B'] as const;
