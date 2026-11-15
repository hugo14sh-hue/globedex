// Regioner på kartan (läget Regioner): landskap i Sverige och delstater i USA, alltså platser med layer.
// Delstaterna har ytor i public/geo/delstater.json (Natural Earth admin 1), kopplade via data.iso_3166_2.
// Regioner utan yta visas som tryckbara punkter på platsens koordinater. Etiketter och inzoomning utgår
// från ytan när den finns, eftersom koordinaterna i innehållet är ungefärliga. Testas i mapRegions.test.ts.

/** Från den här zoomnivån syns regionerna. Längre ut ser kartan ut som i läget Ren. */
export const REGION_MIN_ZOOM = 3;

export interface MapRegion {
  /** Platsens id, till exempel US-ca eller SE-skane. */
  id: string;
  name: string;
  /** Landet regionen hör till. */
  parentId: string;
  /** Lagret, till exempel delstat eller landskap. */
  layer: string;
  lat: number;
  lon: number;
  /** ISO 3166-2 (data.iso_3166_2), kopplar till ytan. Null när platsen saknar kod. */
  code: string | null;
}

interface PlaceLike {
  id: string;
  kind: string;
  name: string;
  parent_id: string | null;
  layer: string | null;
  lat: number | null;
  lon: number | null;
  data?: unknown;
}

const CODE_RE = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

/** Regionens ISO 3166-2-kod ur data, eller null. */
export function regionCode(data: unknown): string | null {
  const c = data && typeof data === 'object' ? (data as Record<string, unknown>).iso_3166_2 : undefined;
  return typeof c === 'string' && CODE_RE.test(c) ? c : null;
}

/** Regionerna i innehållet: platser av typen region med lager och koordinater, i namnordning. */
export function mapRegions(places: PlaceLike[], locale?: string): MapRegion[] {
  return places
    .filter((p) => p.kind === 'region' && p.layer && p.parent_id && p.lat != null && p.lon != null)
    .map((p) => ({ id: p.id, name: p.name, parentId: p.parent_id!, layer: p.layer!, lat: p.lat!, lon: p.lon!, code: regionCode(p.data) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Regionerna under ett land, eller tom lista. */
export const regionsOf = (regions: MapRegion[], parentId: string) => regions.filter((r) => r.parentId === parentId);

/** Lagret för ett land med regioner (det vanligaste om det skulle finnas flera), eller null. */
export function regionLayerOf(regions: MapRegion[], parentId: string): string | null {
  const count = new Map<string, number>();
  for (const r of regionsOf(regions, parentId)) count.set(r.layer, (count.get(r.layer) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export type Box = [west: number, south: number, east: number, north: number];

export interface RegionGeoIndex {
  fc: { type: 'FeatureCollection'; features: unknown[] };
  /** Ytans gränser per kod, för inzoomning och för att se om regionen syns. */
  boxes: Record<string, Box>;
  /** Etikettens punkt per kod (Natural Earths etikettpunkt, annars mitten av gränserna). */
  labels: Record<string, [number, number]>;
}

interface GeoFeature {
  properties?: { code?: unknown; lx?: unknown; ly?: unknown } | null;
  geometry?: { type?: string; coordinates?: unknown } | null;
}

function extend(box: Box | null, c: unknown): Box | null {
  if (!Array.isArray(c)) return box;
  if (typeof c[0] === 'number' && typeof c[1] === 'number') {
    const [x, y] = c as [number, number];
    if (!box) return [x, y, x, y];
    return [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
  }
  let b = box;
  for (const x of c) b = extend(b, x);
  return b;
}

/** Läser delstater.json: gränser och etikettpunkt per kod. */
export function regionGeoIndex(fc: { features?: GeoFeature[] } | null | undefined): RegionGeoIndex {
  const features = Array.isArray(fc?.features) ? fc!.features : [];
  const boxes: Record<string, Box> = {};
  const labels: Record<string, [number, number]> = {};
  for (const f of features) {
    const code = f.properties?.code;
    if (typeof code !== 'string') continue;
    const box = extend(null, f.geometry?.coordinates);
    if (!box) continue;
    boxes[code] = box;
    const { lx, ly } = f.properties ?? {};
    labels[code] = typeof lx === 'number' && typeof ly === 'number' ? [lx, ly] : [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  }
  return { fc: { type: 'FeatureCollection', features }, boxes, labels };
}

const overlaps = (a: Box, b: Box) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * Syns någon region? Nej när kartan är utzoomad förbi REGION_MIN_ZOOM, annars ja om någon regions
 * yta (eller punkt, när ytan saknas) ligger i utsnittet.
 */
export function regionsInView(regions: MapRegion[], geo: RegionGeoIndex | null, zoom: number, view: Box): boolean {
  if (zoom < REGION_MIN_ZOOM) return false;
  return regions.some((r) => {
    const box = r.code ? geo?.boxes[r.code] : undefined;
    return overlaps(box ?? [r.lon, r.lat, r.lon, r.lat], view);
  });
}
