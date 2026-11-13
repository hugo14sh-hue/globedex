import type { BodyFont, HeadingFont } from '../config';

const serif = 'Georgia, serif';
const sans = 'system-ui, sans-serif';

export const HEADING_FONTS: { name: HeadingFont; stack: string; query: string }[] = [
  { name: 'Fraunces', stack: `'Fraunces', ${serif}`, query: 'Fraunces:opsz,wght@9..144,600;9..144,700' },
  { name: 'Bricolage Grotesque', stack: `'Bricolage Grotesque', ${sans}`, query: 'Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800' },
  { name: 'Space Grotesk', stack: `'Space Grotesk', ${sans}`, query: 'Space+Grotesk:wght@500;700' },
  { name: 'Playfair Display', stack: `'Playfair Display', ${serif}`, query: 'Playfair+Display:wght@600;700' },
  { name: 'DM Serif Display', stack: `'DM Serif Display', ${serif}`, query: 'DM+Serif+Display' },
  { name: 'Outfit', stack: `'Outfit', ${sans}`, query: 'Outfit:wght@600;700' },
  { name: 'Sora', stack: `'Sora', ${sans}`, query: 'Sora:wght@600;700' },
];

export const BODY_FONTS: { name: BodyFont; stack: string; query: string }[] = [
  { name: 'DM Sans', stack: `'DM Sans', ${sans}`, query: 'DM+Sans:wght@400;500;700;800' },
  { name: 'Inter', stack: `'Inter', ${sans}`, query: 'Inter:wght@400;500;700;800' },
  { name: 'Manrope', stack: `'Manrope', ${sans}`, query: 'Manrope:wght@400;600;800' },
  { name: 'Nunito', stack: `'Nunito', ${sans}`, query: 'Nunito:wght@400;700;800' },
  { name: 'Work Sans', stack: `'Work Sans', ${sans}`, query: 'Work+Sans:wght@400;600;800' },
  { name: 'IBM Plex Sans', stack: `'IBM Plex Sans', ${sans}`, query: 'IBM+Plex+Sans:wght@400;600;700' },
];

const loaded = new Set<string>();

/** Laddar fonter från Google Fonts, en länk per font, bara en gång. */
export function loadFonts(names: string[]): void {
  if (typeof document === 'undefined') return;
  for (const name of names) {
    if (loaded.has(name)) continue;
    const f = [...HEADING_FONTS, ...BODY_FONTS].find((x) => x.name === name);
    if (!f) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${f.query}&display=swap`;
    document.head.appendChild(link);
    loaded.add(name);
  }
}

export const loadAllFonts = () => loadFonts([...HEADING_FONTS, ...BODY_FONTS].map((f) => f.name));
