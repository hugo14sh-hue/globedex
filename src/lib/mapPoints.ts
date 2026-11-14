// Länder som är för små att träffa på kartan, eller som saknar yta i kartdatat (public/geo/lander.json).
// De visas som en punkt med flagga från zoomnivå 4. Ren logik, testas i mapPoints.test.ts.

/** Ett land med ytan under så här många grader på bredden och höjden räknas som för litet att träffa. */
export const POINT_MAX_DEG = 0.5;
/** Punkterna visas från den här zoomnivån. */
export const POINT_MIN_ZOOM = 4;

type Ring = number[][];
interface GeoFeature {
  properties?: { iso?: unknown } | null;
  geometry?: { type: string; coordinates: unknown } | null;
}

/** Ytans utsträckning per land: [väst, syd, öst, nord] över alla delar av landet. */
export function countryBounds(fc: { features?: GeoFeature[] } | null | undefined): Map<string, [number, number, number, number]> {
  const out = new Map<string, [number, number, number, number]>();
  for (const f of fc?.features ?? []) {
    const iso = f.properties?.iso;
    const g = f.geometry;
    if (typeof iso !== 'string' || !g) continue;
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as Ring[][];
    const b = out.get(iso) ?? [Infinity, Infinity, -Infinity, -Infinity];
    for (const poly of polys)
      for (const [x, y] of poly[0] ?? []) {
        b[0] = Math.min(b[0], x);
        b[1] = Math.min(b[1], y);
        b[2] = Math.max(b[2], x);
        b[3] = Math.max(b[3], y);
      }
    if (Number.isFinite(b[0])) out.set(iso, b);
  }
  return out;
}

export interface CountryPoint {
  iso: string;
  lat: number;
  lon: number;
}

/**
 * Länder som ska visas som punkt: de som saknar yta i kartdatat eller vars yta är mindre än
 * POINT_MAX_DEG åt båda håll. candidates är länder med mittpunkt (innehållets först, sedan
 * src/lib/countries.ts). Varje land kommer med en gång, med den första mittpunkten.
 */
export function pointCountries(
  bounds: Map<string, [number, number, number, number]>,
  candidates: CountryPoint[],
  maxDeg = POINT_MAX_DEG,
): CountryPoint[] {
  const seen = new Set<string>();
  const out: CountryPoint[] = [];
  for (const c of candidates) {
    if (seen.has(c.iso) || !/^[A-Z]{2}$/.test(c.iso)) continue;
    seen.add(c.iso);
    const b = bounds.get(c.iso);
    if (!b || (b[2] - b[0] < maxDeg && b[3] - b[1] < maxDeg)) out.push(c);
  }
  return out;
}
