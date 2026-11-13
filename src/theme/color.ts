// Färgräkning: blandning, relativ luminans och kontrast enligt WCAG.

export const isHex = (h: string) => /^#[0-9a-f]{6}$/i.test(h);

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function luminance(h: string): number {
  const c = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const TEXT_DARK = '#1B1B1F';
export const TEXT_LIGHT = '#FFFFFF';

/** Lägsta kontrast för text enligt WCAG AA. */
export const MIN_CONTRAST = 4.5;

/** Text på en färg: vit om den ger minst 4,5:1, annars mörk text. */
export const onColor = (h: string) => (contrast(h, TEXT_LIGHT) >= MIN_CONTRAST ? TEXT_LIGHT : TEXT_DARK);
