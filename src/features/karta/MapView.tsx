// Kartan med MapLibre och OpenFreeMap. Laddas först när fliken öppnas (React.lazy i KartaScreen),
// så att resten av appen inte väntar på kartmotorn.
import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_BOUNDS } from '../../config';
import { countryBounds, pointCountries, POINT_MIN_ZOOM, type CountryPoint } from '../../lib/mapPoints';
import { REGION_MIN_ZOOM, regionGeoIndex, regionsInView, type MapRegion, type RegionGeoIndex } from '../../lib/mapRegions';

/** OpenFreeMap: kontrollerad 2026-11-13 på openfreemap.org (fri, ingen nyckel, attribution visas av stilen). */
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' };
/** Höjddata för höjdskuggningen: Terrain Tiles på AWS Open Data (Mapzen/Tilezen). */
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const ATTRIBUTION = [
  '<a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>',
  // USA:s delstater i läget Regioner (public/geo/delstater.json, byggd av scripts/make-regions.mjs).
  '<a href="https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-1-states-provinces/" target="_blank" rel="noopener">Natural Earth admin 1</a>',
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain Tiles</a>',
];

export type MapMode = 'ren' | 'upptack' | 'terrang' | 'smart' | 'regioner';
export type { MapRegion };
export type MapExtent = 'europa' | 'varlden';

export interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Plats eller listpunkt. Listpunkter öppnar sin plats. */
  kind: 'place' | 'item';
  placeId: string;
}

/** En etapp i uppspelningen, från a till b. */
export interface RouteLeg {
  a: { lat: number; lon: number };
  b: { lat: number; lon: number };
}

/** Resan som spelas upp: etapperna före step ritas hela, etapp step ritas till andel f (0–1). */
export interface MapRoute {
  legs: RouteLeg[];
  step: number;
  f: number;
}

export interface MapViewProps {
  dark: boolean;
  mode: MapMode;
  extent: MapExtent;
  /** Färg per land (ISO-kod). Länder utan färg får fallback. */
  fills: Record<string, string>;
  fallback: string;
  /** Opacitet för länder utan färg (lägre i Smart månad). */
  fallbackOpacity: number;
  markers: MapMarker[];
  markerColor: string;
  /** Resa som spelas upp etapp för etapp. */
  route?: MapRoute | null;
  routeColor?: string;
  label: string;
  /** Namn på i-knappen som fäller ut kartans källor. */
  attribLabel: string;
  /** Länder med mittpunkt. De som är för små att träffa, eller saknar yta, visas som punkt med flagga. */
  pointCandidates: CountryPoint[];
  /** Landets namn för punktens aria-label. */
  countryLabel: (iso: string) => string;
  onCountry: (iso: string) => void;
  /** Regioner (landskap, delstater) i läget Regioner. Med ytan när den finns, annars som punkt. */
  regions: MapRegion[];
  /** Färg per region (platsens id). Regioner utan färg får fallback. */
  regionFills: Record<string, string>;
  onRegion: (placeId: string) => void;
  /** Syns någon region i kartans utsnitt? Anropas i läget Regioner när kartan har flyttats. */
  onRegionsVisible: (visible: boolean) => void;
  onMarker: (m: MapMarker) => void;
  onError: () => void;
}

/** Landsfälten tonas ned mellan zoom 4 och 7, så att baskartan syns igenom på nära håll. */
const FADE_FROM = 4;
const FADE_TO = 7;
/** Andel av täckningen som är kvar efter nedtoningen: en svag ton. */
const FADE_KEEP = 0.15;
/** OSM:s riktlinjer: källorna visas först och får fällas ihop vid interaktion eller efter fem sekunder. */
const ATTRIB_MS = 5000;

/** Täckning för landsfälten: full ut till zoom 4, en svag ton från zoom 7. */
function fillOpacity(fallback: number): maplibregl.ExpressionSpecification {
  const base: maplibregl.ExpressionSpecification = ['coalesce', ['feature-state', 'opacity'], fallback];
  return ['interpolate', ['linear'], ['zoom'], FADE_FROM, base, FADE_TO, ['*', base, FADE_KEEP]];
}

const FILL = 'lander-fill';
const LINE = 'lander-line';
const HILL = 'terrang';
const DOTS = 'platser-punkt';
const REG_FILL = 'regioner-fill';
const REG_LINE = 'regioner-line';
const REG_NAMES = 'regioner-namn';
/** Delstaternas ytor. Laddas först när läget Regioner väljs. */
const REGION_GEO = '/geo/delstater.json';
const NAMES = 'platser-namn';

export default function MapView(props: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(0);
  // Kartdatat för länderna: hämtas en gång, ger både ytorna och vilka länder som är för små att träffa.
  const [bounds, setBounds] = useState<ReturnType<typeof countryBounds> | null>(null);
  const [geoLoaded, setGeoLoaded] = useState(0);
  // Regionernas ytor: hämtas första gången läget Regioner väljs.
  const [regionGeo, setRegionGeo] = useState<RegionGeoIndex | null>(null);
  const regionGeoAsked = useRef(false);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // Skapa kartan (och skapa om när ljust eller mörkt läge byts, eftersom stilen byts).
  useEffect(() => {
    if (!el.current) return;
    const p = latest.current;
    const m = new maplibregl.Map({
      container: el.current,
      style: p.dark ? STYLE.dark : STYLE.light,
      bounds: MAP_BOUNDS[p.extent],
      fitBoundsOptions: { padding: 8 },
      renderWorldCopies: false,
      attributionControl: false,
      locale: { 'AttributionControl.ToggleAttribution': p.attribLabel },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 60,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: ATTRIBUTION }));
    map.current = m;
    // Källraden syns när kartan startar och fälls ihop bakom i-knappen vid första
    // interaktionen eller efter fem sekunder. Ett tryck på i-knappen fäller ut den igen.
    const collapse = () => el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    const timer = window.setTimeout(collapse, ATTRIB_MS);
    const onUser = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return;
      collapse();
      for (const ev of ['movestart', 'click'] as const) m.off(ev, onUser);
    };
    for (const ev of ['movestart', 'click'] as const) m.on(ev, onUser);
    let failed = false;

    m.on('error', (e) => {
      // Enstaka plattor kan saknas (till exempel höjddata över hav). Bara stilen är kritisk.
      if (!m.isStyleLoaded() && !failed) {
        failed = true;
        latest.current.onError();
      }
      void e;
    });

    m.on('load', () => {
      const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
      m.addSource('lander', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'iso' });
      fetch('/geo/lander.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((fc) => {
          if (map.current !== m) return;
          (m.getSource('lander') as GeoJSONSource | undefined)?.setData(fc);
          setBounds(countryBounds(fc));
          setGeoLoaded((n) => n + 1);
        })
        .catch(() => undefined);
      m.addLayer(
        {
          id: FILL,
          type: 'fill',
          source: 'lander',
          paint: {
            'fill-color': ['coalesce', ['feature-state', 'color'], latest.current.fallback],
            'fill-opacity': fillOpacity(latest.current.fallbackOpacity),
          },
        },
        firstSymbol,
      );
      m.addLayer(
        {
          id: LINE,
          type: 'line',
          source: 'lander',
          paint: {
            'line-color': latest.current.dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
            // En tunn kant är kvar när fälten har tonats ned.
            'line-width': ['interpolate', ['linear'], ['zoom'], FADE_FROM, 0.6, FADE_TO, 1],
          },
        },
        firstSymbol,
      );
      // Regionerna ovanpå länderna, under baskartans namn. Dolda utom i läget Regioner.
      m.addSource('regioner', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'code' });
      m.addLayer(
        {
          id: REG_FILL,
          type: 'fill',
          source: 'regioner',
          minzoom: REGION_MIN_ZOOM,
          layout: { visibility: 'none' },
          paint: {
            'fill-color': ['coalesce', ['feature-state', 'color'], latest.current.fallback],
            'fill-opacity': fillOpacity(0.85),
          },
        },
        firstSymbol,
      );
      m.addLayer(
        {
          id: REG_LINE,
          type: 'line',
          source: 'regioner',
          minzoom: REGION_MIN_ZOOM,
          layout: { visibility: 'none' },
          paint: { 'line-color': latest.current.dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', 'line-width': 0.8 },
        },
        firstSymbol,
      );
      m.addSource('dem', { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, encoding: 'terrarium', maxzoom: 12 });
      m.addLayer(
        { id: HILL, type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.6 } },
        firstSymbol,
      );
      m.addSource('platser', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: DOTS,
        type: 'circle',
        source: 'platser',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['case', ['==', ['get', 'kind'], 'place'], 6, 4.5],
          'circle-color': latest.current.markerColor,
          'circle-stroke-color': latest.current.dark ? '#172830' : '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
      m.addLayer({
        id: NAMES,
        type: 'symbol',
        source: 'platser',
        minzoom: 4,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-offset': [0.9, 0],
          'text-anchor': 'left',
          'text-optional': true,
        },
        paint: {
          'text-color': latest.current.dark ? '#F2EFE9' : '#1B1B1F',
          'text-halo-color': latest.current.dark ? '#0E1A20' : '#FFFFFF',
          'text-halo-width': 1.4,
        },
      });

      // Regionernas namn: vid ytans etikettpunkt, eller under punkten när ytan saknas.
      m.addSource('regioner-namn', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: REG_NAMES,
        type: 'symbol',
        source: 'regioner-namn',
        minzoom: REGION_MIN_ZOOM + 1,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': ['case', ['get', 'pt'], ['literal', [0, 1.7]], ['literal', [0, 0]]],
          'text-optional': true,
        },
        paint: {
          'text-color': latest.current.dark ? '#F2EFE9' : '#1B1B1F',
          'text-halo-color': latest.current.dark ? '#0E1A20' : '#FFFFFF',
          'text-halo-width': 1.4,
        },
      });

      m.addSource('rutt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'rutt-linje',
        type: 'line',
        source: 'rutt',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': latest.current.routeColor ?? '#E4572E', 'line-width': 4 },
      });
      m.addLayer({
        id: 'rutt-punkt',
        type: 'circle',
        source: 'rutt',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['get', 'nu'], 8, 5],
          'circle-color': latest.current.routeColor ?? '#E4572E',
          'circle-stroke-color': latest.current.dark ? '#172830' : '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });

      m.on('click', (e) => {
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 10, e.point.y - 10],
          [e.point.x + 10, e.point.y + 10],
        ];
        const dot = m.getLayer(DOTS) && m.getLayoutProperty(DOTS, 'visibility') === 'visible' ? m.queryRenderedFeatures(box, { layers: [DOTS] })[0] : undefined;
        if (dot) {
          const id = String(dot.properties.id);
          const mk = latest.current.markers.find((x) => x.id === id);
          if (mk) return latest.current.onMarker(mk);
        }
        // Läget Regioner: en region går före landet under den.
        if (latest.current.mode === 'regioner' && m.getLayoutProperty(REG_FILL, 'visibility') === 'visible') {
          const reg: MapGeoJSONFeature | undefined = m.queryRenderedFeatures(e.point, { layers: [REG_FILL] })[0];
          const r = reg && latest.current.regions.find((x) => x.code === String(reg.properties.code));
          if (r) return regionTap.current(r);
        }
        const land: MapGeoJSONFeature | undefined = m.queryRenderedFeatures(e.point, { layers: [FILL] })[0];
        if (land?.properties?.iso) latest.current.onCountry(String(land.properties.iso));
      });
      for (const layer of [FILL, DOTS, REG_FILL]) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
      }
      setReady((n) => n + 1);
    });

    return () => {
      window.clearTimeout(timer);
      map.current = null;
      m.remove();
    };
  }, [props.dark]);

  // Ett tryck på en region: zooma in på ytan (eller punkten när ytan saknas) och öppna bottenarket.
  const regionTap = useRef<(r: MapRegion) => void>(() => undefined);
  useEffect(() => {
    regionTap.current = (r: MapRegion) => {
      const m = map.current;
      if (m) {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const box = r.code ? regionGeo?.boxes[r.code] : undefined;
        if (box) m.fitBounds(box, { padding: 40, maxZoom: Math.max(m.getZoom(), 6), duration: reduce ? 0 : 600 });
        else m.easeTo({ center: [r.lon, r.lat], zoom: Math.max(m.getZoom(), 5), duration: reduce ? 0 : 600 });
      }
      latest.current.onRegion(r.id);
    };
  }, [regionGeo]);

  // Läget Regioner: hämta ytorna första gången och visa lagren.
  const regionMode = props.mode === 'regioner';
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer(REG_FILL)) return;
    for (const layer of [REG_FILL, REG_LINE, REG_NAMES]) m.setLayoutProperty(layer, 'visibility', regionMode ? 'visible' : 'none');
    if (!regionMode || regionGeoAsked.current) return;
    regionGeoAsked.current = true;
    fetch(REGION_GEO)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((fc) => setRegionGeo(regionGeoIndex(fc)))
      .catch(() => {
        // Utan ytor visas delstaterna som punkter. Nästa gång läget väljs försöker kartan igen.
        regionGeoAsked.current = false;
      });
  }, [ready, regionMode]);

  // Ytorna in i kartan (också när kartan har skapats om för mörkt läge).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !regionGeo) return;
    (m.getSource('regioner') as GeoJSONSource | undefined)?.setData(regionGeo.fc);
  }, [ready, regionGeo]);

  // Regionernas färger och namn.
  const regionKey = props.regions.map((r) => `${r.id}:${r.code ?? ''}`).join(',');
  const regionFillsKey = JSON.stringify(props.regionFills);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer(REG_FILL)) return;
    const p = latest.current;
    m.removeFeatureState({ source: 'regioner' });
    for (const r of p.regions) {
      const color = p.regionFills[r.id];
      if (r.code && color && regionGeo?.boxes[r.code]) m.setFeatureState({ source: 'regioner', id: r.code }, { color, opacity: 0.85 });
    }
    m.setPaintProperty(REG_FILL, 'fill-color', ['coalesce', ['feature-state', 'color'], p.fallback]);
    const names = p.regions.map((r) => {
      const lp = r.code ? regionGeo?.labels[r.code] : undefined;
      return {
        type: 'Feature' as const,
        properties: { name: r.name, pt: !lp },
        geometry: { type: 'Point' as const, coordinates: lp ?? [r.lon, r.lat] },
      };
    });
    (m.getSource('regioner-namn') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: names });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regionGeo, regionKey, regionFillsKey, props.fallback]);

  // Regioner utan yta (i dag Sveriges landskap): tryckbara punkter på 44 px på platsens koordinater.
  useEffect(() => {
    const m = map.current;
    const root = el.current;
    if (!m || !root || !ready || !regionMode) return;
    const p = latest.current;
    const show = () => root.classList.toggle('show-regions', m.getZoom() >= REGION_MIN_ZOOM);
    const made = p.regions
      .filter((r) => !r.code || !regionGeo?.boxes[r.code])
      .map((r) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'map-region';
        b.dataset.id = r.id;
        b.setAttribute('aria-label', r.name);
        b.style.setProperty('--ring', p.regionFills[r.id] ?? p.fallback);
        b.appendChild(document.createElement('i'));
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          regionTap.current(r);
        });
        return new maplibregl.Marker({ element: b }).setLngLat([r.lon, r.lat]).addTo(m);
      });
    show();
    m.on('zoom', show);
    return () => {
      m.off('zoom', show);
      for (const x of made) x.remove();
      root.classList.remove('show-regions');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regionMode, regionGeo, regionKey]);

  // Punkternas färg följer regionens status.
  useEffect(() => {
    const root = el.current;
    if (!root) return;
    for (const b of root.querySelectorAll<HTMLElement>('.map-region'))
      b.style.setProperty('--ring', props.regionFills[b.dataset.id ?? ''] ?? props.fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regionMode, regionGeo, regionKey, regionFillsKey, props.fallback]);

  // Syns någon region? Annars visar kartskärmen karta.regioner.tom.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !regionMode) return;
    const check = () => {
      const b = m.getBounds();
      latest.current.onRegionsVisible(
        regionsInView(latest.current.regions, regionGeo, m.getZoom(), [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]),
      );
    };
    check();
    m.on('moveend', check);
    return () => {
      m.off('moveend', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regionMode, regionGeo, regionKey]);

  // Landsfärger via feature-state, så att geometrin bara laddas en gång.
  const fillsKey = JSON.stringify(props.fills);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer(FILL)) return;
    m.removeFeatureState({ source: 'lander' });
    for (const [iso, color] of Object.entries(props.fills)) m.setFeatureState({ source: 'lander', id: iso }, { color, opacity: 0.85 });
    m.setPaintProperty(FILL, 'fill-color', ['coalesce', ['feature-state', 'color'], props.fallback]);
    m.setPaintProperty(FILL, 'fill-opacity', fillOpacity(props.fallbackOpacity));
  }, [ready, geoLoaded, fillsKey, props.fallback, props.fallbackOpacity]);

  // Små länder som punkt med flagga, från zoomnivå 4. Ringen har landets färg på kartan.
  const pointKey = props.pointCandidates.map((c) => c.iso).join(',');
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !bounds) return;
    const show = () => el.current?.classList.toggle('show-points', m.getZoom() >= POINT_MIN_ZOOM);
    const list = pointCountries(bounds, latest.current.pointCandidates);
    const made = list.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'map-flag';
      b.dataset.iso = c.iso;
      b.setAttribute('aria-label', latest.current.countryLabel(c.iso));
      const img = document.createElement('img');
      img.src = `/flags/${c.iso.toLowerCase()}.svg`;
      img.alt = '';
      img.width = 26;
      img.height = 20;
      img.onerror = () => {
        img.remove();
        b.textContent = c.iso;
      };
      b.appendChild(img);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        latest.current.onCountry(c.iso);
      });
      return new maplibregl.Marker({ element: b }).setLngLat([c.lon, c.lat]).addTo(m);
    });
    show();
    m.on('zoom', show);
    return () => {
      m.off('zoom', show);
      for (const x of made) x.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, bounds, pointKey]);

  // Punkternas ring följer landets färg.
  useEffect(() => {
    const root = el.current;
    if (!root) return;
    for (const b of root.querySelectorAll<HTMLElement>('.map-flag')) b.style.setProperty('--ring', props.fills[b.dataset.iso ?? ''] ?? props.fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, bounds, pointKey, fillsKey, props.fallback]);

  // Läge: höjdskuggning och lutning i Terräng 3D, markörer i Upptäck.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer(FILL)) return;
    const terrain = props.mode === 'terrang';
    const discover = props.mode === 'upptack';
    m.setLayoutProperty(HILL, 'visibility', terrain ? 'visible' : 'none');
    m.setLayoutProperty(DOTS, 'visibility', discover ? 'visible' : 'none');
    m.setLayoutProperty(NAMES, 'visibility', discover ? 'visible' : 'none');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    m.easeTo({ pitch: terrain ? 50 : 0, duration: reduce ? 0 : 600 });
  }, [ready, props.mode]);

  // Markörer för Upptäck.
  const markerKey = props.markers.map((x) => x.id).join(',');
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer(FILL)) return;
    (m.getSource('platser') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: props.markers.map((x) => ({
        type: 'Feature',
        properties: { id: x.id, name: x.name, kind: x.kind },
        geometry: { type: 'Point', coordinates: [x.lon, x.lat] },
      })),
    });
    m.setPaintProperty(DOTS, 'circle-color', props.markerColor);
  }, [ready, markerKey, props.markerColor]);

  // Resan: linjer för etapperna så långt uppspelningen har kommit, och en punkt där den är nu.
  const route = props.route;
  const routeKey = route ? `${route.legs.length}:${route.step}:${route.f.toFixed(3)}` : '';
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getSource('rutt')) return;
    const features: { type: 'Feature'; properties: Record<string, boolean>; geometry: { type: 'LineString'; coordinates: number[][] } | { type: 'Point'; coordinates: number[] } }[] = [];
    if (route) {
      route.legs.forEach((l, i) => {
        if (i > route.step) return;
        const f = i < route.step ? 1 : route.f;
        const end = { lat: l.a.lat + (l.b.lat - l.a.lat) * f, lon: l.a.lon + (l.b.lon - l.a.lon) * f };
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[l.a.lon, l.a.lat], [end.lon, end.lat]] } });
        features.push({ type: 'Feature', properties: { nu: false }, geometry: { type: 'Point', coordinates: [l.a.lon, l.a.lat] } });
        if (i === route.step) features.push({ type: 'Feature', properties: { nu: true }, geometry: { type: 'Point', coordinates: [end.lon, end.lat] } });
      });
    }
    (m.getSource('rutt') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routeKey]);

  // Visa hela resan när uppspelningen börjar.
  const routeLegs = route ? route.legs.length : 0;
  const routeBounds = route ? JSON.stringify(route.legs) : '';
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !route || !routeLegs) return;
    const b = new maplibregl.LngLatBounds();
    for (const l of route.legs) {
      b.extend([l.a.lon, l.a.lat]);
      b.extend([l.b.lon, l.b.lat]);
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    m.fitBounds(b, { padding: 48, maxZoom: 7, duration: reduce ? 0 : 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routeBounds]);

  // Europa eller världen.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer(FILL)) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    m.fitBounds(MAP_BOUNDS[props.extent], { padding: 8, duration: reduce ? 0 : 700, pitch: props.mode === 'terrang' ? 50 : 0 });
  }, [ready, props.extent]);

  return <div ref={el} className="map-canvas" role="region" aria-label={props.label} />;
}
