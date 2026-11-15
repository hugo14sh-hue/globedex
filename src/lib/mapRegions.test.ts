import { describe, expect, it } from 'vitest';
import us from '../../content/US.json';
import se from '../../content/SE.json';
import { bucketParts, parseChecklist } from './bucketParts';
import { mapRegions, regionCode, regionGeoIndex, regionLayerOf, regionsInView, regionsOf, REGION_MIN_ZOOM } from './mapRegions';
import { emptyInput } from '../features/vi/marken';
import { numbers } from '../features/vi/viLogic';

type P = Parameters<typeof mapRegions>[0][number];
const places = [...(us.places as unknown as P[]), ...(se.places as unknown as P[])];
// Påhittade ytor (rutor) för logiken. De riktiga ytorna testas mot innehållet i scripts/lib/geo-data.test.mjs.
const square = (code: string, w: number, s: number, e: number, n: number, label?: [number, number]) => ({
  type: 'Feature',
  properties: { code, ...(label ? { lx: label[0], ly: label[1] } : {}) },
  geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
});
const geo = regionGeoIndex({
  features: [square('US-CA', -124.4, 32.5, -114.1, 42, [-119.6, 37.2]), square('US-NV', -120, 35, -114, 42), { properties: { code: 7 } }],
});
const regions = mapRegions(places, 'sv-SE');
const states = regionsOf(regions, 'US');

describe('regioner på kartan', () => {
  it('USA har 50 delstater och Washington D.C., Sverige har landskap', () => {
    expect(states).toHaveLength(51);
    expect(regionLayerOf(regions, 'US')).toBe('delstat');
    expect(regionLayerOf(regions, 'SE')).toBe('landskap');
    expect(regionLayerOf(regions, 'NO')).toBeNull();
  });

  it('läser ytornas gränser och etikettpunkt', () => {
    expect(Object.keys(geo.boxes)).toEqual(['US-CA', 'US-NV']);
    expect(geo.boxes['US-CA']).toEqual([-124.4, 32.5, -114.1, 42]);
    expect(geo.labels['US-CA']).toEqual([-119.6, 37.2]);
    // Utan etikettpunkt: mitten av gränserna.
    expect(geo.labels['US-NV']).toEqual([-117, 38.5]);
    expect(regionGeoIndex(null).boxes).toEqual({});
  });

  it('Sveriges landskap saknar yta och visas som punkter', () => {
    const se = regionsOf(regions, 'SE');
    expect(se.length).toBeGreaterThan(0);
    expect(se.every((r) => r.code === null)).toBe(true);
  });

  it('läser koden i data.iso_3166_2', () => {
    expect(regionCode({ iso_3166_2: 'US-CA' })).toBe('US-CA');
    expect(regionCode({ iso_3166_2: 'us-ca' })).toBeNull();
    expect(regionCode(null)).toBeNull();
  });

  it('inga regioner syns utzoomat eller utanför länderna med regioner', () => {
    const usa: [number, number, number, number] = [-125, 25, -66, 50];
    const japan: [number, number, number, number] = [128, 30, 146, 46];
    expect(regionsInView(regions, geo, REGION_MIN_ZOOM - 0.5, usa)).toBe(false);
    expect(regionsInView(regions, geo, 4, usa)).toBe(true);
    expect(regionsInView(regions, geo, 4, japan)).toBe(false);
    // Sverige: landskapen syns som punkter.
    expect(regionsInView(regions, null, 5, [10, 55, 25, 69])).toBe(true);
  });
});

describe('bucketmål för delstaterna', () => {
  it('checklist { type: platser, parent_id: US, layer: delstat } ger en rad per delstat och bockas av från kartan', () => {
    const checklist = parseChecklist({ type: 'platser', parent_id: 'US', layer: 'delstat' });
    const ctx = {
      places: places.map((p) => ({ id: p.id, name: p.name, parent_id: p.parent_id ?? null, layer: p.layer ?? null })),
      statuses: { 'US-ca': 'besokt', 'US-ny': 'bott', 'US-tx': 'vill', US: 'besokt' } as const,
      name: (id: string) => places.find((p) => p.id === id)?.name ?? id,
    };
    const v = bucketParts(checklist, null, { ...ctx, statuses: { ...ctx.statuses } });
    expect(v?.kind).toBe('rader');
    if (v?.kind !== 'rader') return;
    expect(v.total).toBe(51);
    expect(v.done).toBe(2);
    expect(v.rows.every((r) => r.auto)).toBe(true);
    expect(v.rows.filter((r) => r.done).map((r) => r.placeId).sort()).toEqual(['US-ca', 'US-ny']);
  });
});

describe('siffror för delstater', () => {
  it('räknar besökta delstater, och en besökt delstat gör inte landet besökt', () => {
    const n = numbers(
      {
        ...emptyInput('solo', '2026-11-15'),
        usStates: states.map((r) => r.id),
        statuses: [
          { place_id: 'US-ca', status: 'besokt', updated_at: null },
          { place_id: 'US-ny', status: 'vill', updated_at: null },
        ],
      },
      0,
    );
    expect(n.delstater).toEqual(['US-ca']);
    expect(n.delstaterTotalt).toBe(51);
    expect(n.lander).toEqual([]);
  });
});
