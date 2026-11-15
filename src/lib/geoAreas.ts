// Ytor i kartdatat (Natural Earth admin 0, public/geo/lander.json) som saknar egen ISO-kod.
// De räknas till det land de hör till enligt ISO 3166, så att de färgas och öppnas som det landet.
// Används av scripts/make-countries.mjs när kartdatat byggs. Testas i geoAreas.test.ts.

/**
 * Natural Earths kod (ADM0_A3) till landets ISO-kod. ISO 3166 har ingen egen kod för de här
 * områdena, de ingår i landet:
 * - SOL Somaliland: ingår i Somalia (SO).
 * - CYN Nordcypern: ingår i Cypern (CY).
 * Siachenglaciären (KAS) är omstridd mellan Indien och Pakistan och står inte här: den visas som
 * förut, utan färg (se slutrapporten för Körning 11).
 */
export const AREA_TO_COUNTRY: Record<string, string> = {
  SOL: 'SO',
  CYN: 'CY',
};

interface AreaProps {
  ISO_A2?: unknown;
  ISO_A2_EH?: unknown;
  ADM0_A3?: unknown;
}

const ISO_RE = /^[A-Z]{2}$/;

/** Landets ISO-kod för en yta i Natural Earth, eller null om ytan inte hör till något land i appen. */
export function isoForArea(p: AreaProps | null | undefined): string | null {
  if (!p) return null;
  // ISO_A2_EH har koder även där ISO_A2 är -99 (t.ex. Frankrike och Norge).
  const own = [p.ISO_A2_EH, p.ISO_A2].find((x): x is string => typeof x === 'string' && ISO_RE.test(x));
  if (own) return own;
  return typeof p.ADM0_A3 === 'string' ? (AREA_TO_COUNTRY[p.ADM0_A3] ?? null) : null;
}
