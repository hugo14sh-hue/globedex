import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { Row } from '../../components/Row';
import { fetchItemMarkers, fetchPlaces, placeName, type Place, type PlaceItem } from '../../lib/content';
import { useSession, useTravelMode } from '../../lib/session';
import { groupByStatus, STATUS_KEY, useMyPlaces, type PlaceStatus } from '../../lib/status';
import { useT } from '../../lib/useT';
import { onColor } from '../../theme/color';
import { SMART_COLORS } from '../../theme/palettes';
import { statusColors } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { MapExtent, MapMarker, MapMode } from './MapView';
import { StatusPicker } from './StatusPicker';
import { monthNames } from './months';

// Kartmotorn laddas först när fliken öppnas.
const MapView = lazy(() => import('./MapView'));

const MODES: MapMode[] = ['ren', 'upptack', 'terrang', 'smart'];
const MODE_KEY: Record<MapMode, string> = {
  ren: 'karta.lage.ren',
  upptack: 'karta.lage.upptack',
  terrang: 'karta.lage.terrang',
  smart: 'karta.lage.smart',
};

export default function KartaScreen() {
  const t = useT();
  const nav = useNavigate();
  const { theme } = useTheme();
  const { session } = useSession();
  const mode = useTravelMode();
  const mine = useMyPlaces(session?.user.id ?? null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [items, setItems] = useState<PlaceItem[]>([]);
  const [mapMode, setMapMode] = useState<MapMode>('ren');
  const [extent, setExtent] = useState<MapExtent>('europa');
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [picked, setPicked] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mapMode !== 'upptack' || items.length) return;
    let alive = true;
    fetchItemMarkers()
      .then((list) => alive && setItems(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mapMode, items.length]);

  const colors = useMemo(() => statusColors(theme), [theme]);
  const months = useMemo(() => monthNames(), []);

  // Färg per land: status, eller betyget för vald månad i Smart månad.
  const fills = useMemo(() => {
    const out: Record<string, string> = {};
    if (mapMode === 'smart') {
      for (const p of places) {
        const score = p.kind === 'country' && p.iso2 && p.smart_months?.[month];
        if (p.kind === 'country' && p.iso2 && typeof score === 'number') out[p.iso2] = SMART_COLORS[score] ?? SMART_COLORS[0];
      }
      return out;
    }
    for (const [id, s] of Object.entries(mine.statuses)) if (/^[A-Z]{2}$/.test(id)) out[id] = colors[s];
    return out;
  }, [mapMode, places, month, mine.statuses, colors]);

  const markers = useMemo<MapMarker[]>(() => {
    if (mapMode !== 'upptack') return [];
    const out: MapMarker[] = [];
    for (const p of places)
      if ((p.kind === 'city' || p.kind === 'spot') && p.lat != null && p.lon != null)
        out.push({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, kind: 'place', placeId: p.id });
    for (const i of items)
      if (i.lat != null && i.lon != null) out.push({ id: i.id, name: i.name, lat: i.lat, lon: i.lon, kind: 'item', placeId: i.place_id });
    return out;
  }, [mapMode, places, items]);

  const mineList = useMemo(
    () =>
      groupByStatus(
        Object.entries(mine.statuses)
          .map(([id, status]) => ({ id, status, name: placeName(places, id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'sv')),
      ),
    [mine.statuses, places],
  );
  const total = Object.keys(mine.statuses).length;
  const pickedName = picked ? placeName(places, picked) : '';

  return (
    <main className="scr">
      <h1>{t('flik.karta')}</h1>

      <div className="map">
        {mapFailed ? (
          <div className="map-fail card soft" role="alert">
            <p>{t('karta.laddar-fel')}</p>
          </div>
        ) : (
          <Suspense fallback={<div className="map-canvas map-wait" aria-busy="true" />}>
            <MapView
              dark={theme.dark}
              mode={mapMode}
              extent={extent}
              fills={fills}
              fallback={colors.ej}
              fallbackOpacity={mapMode === 'smart' ? 0.35 : 0.85}
              markers={markers}
              markerColor={colors.bor}
              label={t('flik.karta')}
              onCountry={setPicked}
              onMarker={(m) => nav(`/karta/${m.placeId}${m.kind === 'item' ? '?vy=lista' : ''}`)}
              onError={() => setMapFailed(true)}
            />
          </Suspense>
        )}
        <div className="zoom">
          {(['europa', 'varlden'] as const).map((x) => (
            <button key={x} type="button" className="chip" aria-pressed={extent === x} onClick={() => setExtent(x)}>
              {t(`karta.lage.${x}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="chips" role="group" aria-label={t('flik.karta')}>
        {MODES.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={mapMode === m} onClick={() => setMapMode(m)}>
            {t(MODE_KEY[m])}
          </button>
        ))}
      </div>

      {mapMode === 'smart' ? (
        <>
          <div className="months" role="group" aria-label={t('karta.lage.smart')}>
            {months.map((m, i) => (
              <button key={m.long} type="button" aria-pressed={month === i} aria-label={m.long} onClick={() => setMonth(i)}>
                {m.short}
              </button>
            ))}
          </div>
          <div className="lg">
            <span>
              <i style={{ background: SMART_COLORS[5] }} />
              {t('karta.smart.bra')}
            </span>
            <span>
              <i style={{ background: SMART_COLORS[3] }} />
              {t('karta.smart.okej')}
            </span>
            <span>
              <i style={{ background: SMART_COLORS[0] }} />
              {t('karta.smart.undvik')}
            </span>
          </div>
        </>
      ) : (
        <div className="lg">
          {(['bor', 'bott', 'besokt', 'planerad', 'vill', 'mellan'] as PlaceStatus[]).map((s) => (
            <span key={s}>
              <i style={{ background: colors[s] }} />
              {t(STATUS_KEY[s])}
            </span>
          ))}
        </div>
      )}

      <h2 className="eb">{t(mode === 'solo' ? 'karta.platser.jag' : 'karta.platser.vi')}</h2>
      {mine.loaded && total === 0 && (
        <div className="card soft">
          <p>{t('karta.tom')}</p>
        </div>
      )}
      {mineList.map((g) => (
        <section key={g.status} className="col" aria-label={t(STATUS_KEY[g.status])}>
          <div className="row">
            <h3 className="eb">{t(STATUS_KEY[g.status])}</h3>
            <span className="mu">{g.rows.length}</span>
          </div>
          {g.rows.map((r) => (
            <Row
              key={r.id}
              to={`/karta/${r.id}`}
              title={r.name}
              sub={t(STATUS_KEY[r.status])}
              lead={
                <span className="badge" style={{ background: colors[r.status], color: onColor(colors[r.status]) }}>
                  {r.id.slice(0, 2)}
                </span>
              }
            />
          ))}
        </section>
      ))}

      <BottomSheet open={Boolean(picked)} title={pickedName} onClose={() => setPicked(null)}>
        {picked && (
          <>
            <StatusPicker
              placeId={picked}
              name={pickedName}
              current={mine.statuses[picked]}
              total={total}
              label={pickedName}
            />
            <Row to={`/karta/${picked}`} icon="map" title={t('land.vy.oversikt')} />
          </>
        )}
      </BottomSheet>
    </main>
  );
}
