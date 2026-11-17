import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { Flag } from '../../components/Flag';
import { PriceLevel } from '../../components/PriceLevel';
import { Row } from '../../components/Row';
import { fetchItemMarkers, fetchPlaces, placeName, type Place, type PlaceItem } from '../../lib/content';
import { isLight } from '../../lib/upptack';
import { useSession, useTravelMode } from '../../lib/session';
import { groupByStatus, STATUS_KEY, useMemberStatuses, useMyPlaces, type PlaceStatus } from '../../lib/status';
import { statusesFor, type MapWho } from '../../lib/statusLogic';
import { useT } from '../../lib/useT';
import { SMART_COLORS } from '../../theme/palettes';
import { statusColors } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { MapExtent, MapMarker, MapMode } from './MapView';
import { StatusPicker } from './StatusPicker';
import { TopBar } from './TopBar';
import { Ingress } from '../../components/Ingress';
import { monthNames } from './months';
import { usePlayback } from './usePlayback';
import { useUrlState, withParam } from '../../lib/navMemory';
import { LOCALE } from '../../lib/locale';
import { pricesOf } from '../../lib/prices';
import { COUNTRIES } from '../../lib/countries';
import type { CountryPoint } from '../../lib/mapPoints';
import { mapRegions } from '../../lib/mapRegions';
import { companyGroups, myMap, ourMap, ourVisited, type MapKey, type StatusRow } from '../../lib/togetherLogic';
import { APP_COUNTRIES, countryListTotal, countsAsCountry } from '../../lib/landlistor';
import { CountryListPicker } from '../../components/CountryListPicker';
import { Icon } from '../../components/Icon';

/** Förklaringens rader: färgnyckel och text. */
type LegendRow = { key: MapKey; label: string };

// Kartmotorn laddas först när fliken öppnas.
const MapView = lazy(() => import('./MapView'));

const MODES: MapMode[] = ['ren', 'upptack', 'terrang', 'smart', 'regioner'];
const MODE_KEY: Record<MapMode, string> = {
  ren: 'karta.lage.ren',
  upptack: 'karta.lage.upptack',
  terrang: 'karta.lage.terrang',
  smart: 'karta.lage.smart',
  regioner: 'karta.lage.regioner',
};

export default function KartaScreen() {
  const t = useT();
  const nav = useNavigate();
  const { theme } = useTheme();
  const { session, members, groups, activeGroup } = useSession();
  const mode = useTravelMode();
  const me = session?.user.id ?? null;
  const mine = useMyPlaces(me);
  // Med i en par- eller gruppgrupp: besökt får två färger på Min karta (på egen hand och tillsammans).
  const withCompany = companyGroups(groups).length > 0;
  // Par och grupp: Min karta, Vår karta eller en enskild medlems karta. Solo: bara den egna.
  const others = useMemo(() => (mode === 'solo' ? [] : members.filter((m) => m.user_id !== me)), [mode, members, me]);
  const memberStatuses = useMemberStatuses(others.map((m) => m.user_id));
  const [whoPicked, setWho] = useState<MapWho>('min');
  const who: MapWho = mode === 'solo' || (whoPicked !== 'min' && whoPicked !== 'var' && !others.some((m) => m.user_id === whoPicked)) ? 'min' : whoPicked;
  const shown = useMemo(() => statusesFor(who, mine.statuses, memberStatuses.byUser), [who, mine.statuses, memberStatuses.byUser]);
  // Vår karta räknas från allas rader, med together_group.
  const gid = activeGroup?.id ?? '';
  const memberIds = useMemo(() => [...new Set([...(me ? [me] : []), ...others.map((m) => m.user_id)])], [me, others]);
  const allRows = useMemo<StatusRow[]>(
    () => [
      ...Object.entries(mine.statuses).map(([place_id, status]) => ({ user_id: me ?? '', place_id, status, together_group: mine.together[place_id] ?? null })),
      ...memberStatuses.rows,
    ],
    [mine.statuses, mine.together, me, memberStatuses.rows],
  );
  const ours = useMemo(() => (who === 'var' ? ourVisited(allRows, me ?? '', memberIds, gid) : {}), [who, allRows, me, memberIds, gid]);
  // Färgnyckeln per plats på vald karta.
  const keys = useMemo<Record<string, MapKey>>(() => {
    if (who === 'min') return myMap(mine.statuses, mine.together, withCompany);
    if (who === 'var') return ourMap(allRows, me ?? '', memberIds, gid);
    return shown;
  }, [who, mine.statuses, mine.together, withCompany, allRows, me, memberIds, gid, shown]);
  const nameOf = (uid: string) => others.find((m) => m.user_id === uid)?.display_name ?? '';
  const othersNames = (ids: string[]) => ids.map(nameOf).filter(Boolean).join(', ');
  const whoLabel = (w: MapWho) =>
    w === 'min' ? t('karta.visa.min') : w === 'var' ? t('karta.visa.var') : t('karta.visa.medlem', { namn: others.find((m) => m.user_id === w)?.display_name ?? '' });
  const [places, setPlaces] = useState<Place[]>([]);
  const [items, setItems] = useState<PlaceItem[]>([]);
  // Kartläge och utsnitt står i adressen, så att de finns kvar när man går tillbaka från en landssida.
  const [mapMode, setMapMode] = useUrlState<MapMode>('lage', 'ren', MODES);
  const [extent, setExtent] = useUrlState<MapExtent>('utsnitt', 'europa', ['europa', 'varlden']);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [picked, setPicked] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  // Läget Regioner: syns någon region i utsnittet? Annars visas karta.regioner.tom.
  const [regionsVisible, setRegionsVisible] = useState(true);
  const [params, setParams] = useSearchParams();
  const playId = params.get('resa');
  const play = usePlayback(playId);
  const playLeg = play.legs[play.step];

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
    for (const [id, k] of Object.entries(keys)) if (/^[A-Z]{2}$/.test(id)) out[id] = colors[k];
    return out;
  }, [mapMode, places, month, keys, colors]);

  // Länder utanför vald landlista ritas med streck. Listan alla har inga.
  const hatched = useMemo(
    () => (theme.countryList === 'alla' ? [] : APP_COUNTRIES.filter((c) => !countsAsCountry(c, theme.countryList))),
    [theme.countryList],
  );
  const [listOpen, setListOpen] = useState(false);

  // Regionerna (platser med lager, i dag landskap och delstater). Färgas efter status precis som länder.
  const regions = useMemo(() => mapRegions(places, LOCALE), [places]);
  const regionFills = useMemo(() => {
    const out: Record<string, string> = {};
    if (mapMode !== 'regioner') return out;
    for (const r of regions) {
      const k = keys[r.id];
      if (k) out[r.id] = colors[k];
    }
    return out;
  }, [mapMode, regions, keys, colors]);

  // Förklaringen visar de färger som vald karta använder. Vill åka och planerad som förut.
  const legend = useMemo<LegendRow[]>(() => {
    const st = (s: PlaceStatus): LegendRow => ({ key: s, label: t(STATUS_KEY[s]) });
    if (who === 'var')
      return [
        { key: 'tillsammans', label: t('karta.forklaring.tillsammans') },
        { key: 'bada', label: t('karta.forklaring.bada') },
        { key: 'bara-jag', label: t('karta.forklaring.bara-jag') },
        { key: 'bara-annan', label: t('karta.forklaring.bara-annan', { namn: othersNames(others.map((m) => m.user_id)) }) },
        st('planerad'),
        st('vill'),
        st('mellan'),
      ];
    if (who === 'min' && withCompany)
      return [
        st('bor'),
        st('bott'),
        { key: 'besokt', label: t('karta.forklaring.sjalv') },
        { key: 'tillsammans', label: t('karta.forklaring.tillsammans') },
        st('planerad'),
        st('vill'),
        st('mellan'),
      ];
    return (['bor', 'bott', 'besokt', 'planerad', 'vill', 'mellan'] as PlaceStatus[]).map(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, withCompany, others, t]);

  const markers = useMemo<MapMarker[]>(() => {
    if (mapMode !== 'upptack') return [];
    const out: MapMarker[] = [];
    // Lätta platser (Upptäck) visas som stadsprickar först när de har en status i vald karta.
    for (const p of places)
      if ((p.kind === 'city' || p.kind === 'spot') && p.lat != null && p.lon != null && (!isLight(p) || shown[p.id]))
        out.push({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, kind: 'place', placeId: p.id });
    for (const i of items)
      if (i.lat != null && i.lon != null) out.push({ id: i.id, name: i.name, lat: i.lat, lon: i.lon, kind: 'item', placeId: i.place_id });
    return out;
  }, [mapMode, places, items, shown]);

  // Mittpunkter för länder som visas som punkt: innehållets länder först, sedan alla länder i kartdatat.
  const pointCandidates = useMemo<CountryPoint[]>(
    () => [
      ...places.filter((p) => p.kind === 'country' && p.iso2 && p.lat != null && p.lon != null).map((p) => ({ iso: p.iso2!, lat: p.lat!, lon: p.lon! })),
      ...COUNTRIES.map(([iso, lat, lon]) => ({ iso, lat, lon })),
    ],
    [places],
  );

  const mineList = useMemo(
    () =>
      groupByStatus(
        Object.entries(shown)
          .map(([id, status]) => ({ id, status, name: placeName(places, id) }))
          .sort((a, b) => a.name.localeCompare(b.name, LOCALE)),
      ),
    [shown, places],
  );
  const total = Object.keys(mine.statuses).length;
  const shownTotal = Object.keys(shown).length;
  const pickedName = picked ? placeName(places, picked) : '';

  return (
    <>
      <TopBar />
      <main className="scr under-topbar">
        <h1>{t('flik.karta')}</h1>
        <Ingress k="ingress.karta" />

        {mode !== 'solo' && (
          <div className="chips" role="group" aria-label={t('karta.vy.aria')}>
            {(['min', 'var', ...others.map((m) => m.user_id)] as MapWho[]).map((w) => (
              <button key={w} type="button" className="chip" aria-pressed={who === w} onClick={() => setWho(w)}>
                {whoLabel(w)}
              </button>
            ))}
          </div>
        )}

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
                hatched={hatched}
                markers={markers}
                markerColor={colors.bor}
                route={play.route}
                routeColor={theme.dark ? '#F4B942' : '#E4572E'}
                label={t('flik.karta')}
                attribLabel={t('karta.kallor')}
                pointCandidates={pointCandidates}
                countryLabel={(iso) => placeName(places, iso)}
                onCountry={setPicked}
                regions={mapMode === 'regioner' ? regions : []}
                regionFills={regionFills}
                onRegion={setPicked}
                onRegionsVisible={setRegionsVisible}
                onMarker={(m) => nav(`/karta/${m.placeId}${m.kind === 'item' ? '?vy=lista' : ''}`)}
                onError={() => setMapFailed(true)}
              />
            </Suspense>
          )}
          {mapMode === 'regioner' && !regionsVisible && !mapFailed && (
            <p className="map-hint" role="status">
              {t('karta.regioner.tom')}
            </p>
          )}
          <div className="zoom">
            {(['europa', 'varlden'] as const).map((x) => (
              <button key={x} type="button" className="chip" aria-pressed={extent === x} onClick={() => setExtent(x)}>
                {t(`karta.lage.${x}`)}
              </button>
            ))}
          </div>
        </div>

        {playId && (
          <div className="card" aria-live="polite">
            <div className="row">
              <h2 className="h3">{t('resor.spela-upp')}</h2>
              {play.legs.length > 0 && <span className="mu">{t('marke.framsteg', { antal: play.step + 1, totalt: play.legs.length })}</span>}
            </div>
            {playLeg && (
              <span>
                <b>
                  {playLeg.from_text} – {playLeg.to_text}
                </b>{' '}
                <span className="mu">{t(`resor.etapp.lage.${playLeg.mode}`)}</span>
              </span>
            )}
            {!play.legs.length && <span className="mu">{t('resor.etapper.tom')}</span>}
            <div className="g2">
              <button type="button" className="btn ghost" disabled={!play.done} onClick={play.replay}>
                {t('resor.spela-upp')}
              </button>
              <button type="button" className="btn ghost" onClick={() => nav(`/resor/${playId}`)}>
                {t('knapp.tillbaka')}
              </button>
            </div>
            <button type="button" className="chip" onClick={() => setParams((p) => withParam(p, 'resa', null), { replace: true })}>
              {t('knapp.stang')}
            </button>
          </div>
        )}

        <div className="chips" role="group" aria-label={t('flik.karta')}>
          {MODES.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={mapMode === m} onClick={() => setMapMode(m)}>
              {t(MODE_KEY[m])}
            </button>
          ))}
        </div>
        {/* Vilka länder som räknas: samma val som under Anpassning. */}
        {/* Namnet är karta.landlista.aria följt av den synliga texten, så att den synliga texten ingår i namnet (WCAG 2.5.3). */}
        <button type="button" className="chip soft list-chip" aria-labelledby="landlista-aria landlista-knapp" aria-haspopup="dialog" onClick={() => setListOpen(true)}>
          <span id="landlista-aria" className="sr-only">
            {t('karta.landlista.aria')}
          </span>
          <Icon name="filter" size={16} />
          <span id="landlista-knapp">{t('karta.landlista.knapp', { antal: countryListTotal(theme.countryList) })}</span>
        </button>

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
          <section className="col legend" aria-labelledby="karta-forklaring">
            <h2 className="eb" id="karta-forklaring">
              {t('karta.forklaring.rubrik')}
            </h2>
            <div className="lg">
              {legend.map((r) => (
                <span key={r.key}>
                  <i style={{ background: colors[r.key] }} />
                  {r.label}
                </span>
              ))}
            </div>
          </section>
        )}

        <h2 className="eb">{t(mode === 'solo' ? 'karta.platser.jag' : 'karta.platser.vi')}</h2>
        {mine.loaded && (who === 'min' || memberStatuses.loaded) && shownTotal === 0 && (
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
            {g.rows.map((r) => {
              const p = r.id.length > 2 ? pricesOf(places.find((x) => x.id === r.id)?.data) : null;
              return (
                <Row
                  key={r.id}
                  to={`/karta/${r.id}`}
                  title={r.name}
                  sub={t(STATUS_KEY[r.status])}
                  lead={<Flag placeId={r.id} ring={colors[keys[r.id] ?? r.status]} />}
                  meta={p ? <PriceLevel level={p.level} small /> : undefined}
                />
              );
            })}
          </section>
        ))}

        <BottomSheet
          open={Boolean(picked)}
          title={pickedName}
          lead={picked ? <Flag placeId={picked} ring={keys[picked] ? colors[keys[picked]] : undefined} /> : undefined}
          onClose={() => setPicked(null)}>
          {picked && (
            <>
              {who !== 'min' && (
                <span className="mu">
                  {whoLabel(who)}: {t(STATUS_KEY[shown[picked] ?? 'ej'])}
                </span>
              )}
              {/* Vår karta: vem som har varit här. I en grupp med fler än två står namnen här. */}
              {who === 'var' && ours[picked] && (
                <span className="row-start">
                  <i className="dot" style={{ background: colors[ours[picked].key] }} aria-hidden="true" />
                  {ours[picked].key === 'bara-annan'
                    ? t('karta.forklaring.bara-annan', { namn: othersNames(ours[picked].others) })
                    : t(`karta.forklaring.${ours[picked].key}`)}
                </span>
              )}
              {/* Bara den egna statusen går att ändra. */}
              {who !== 'min' && <h3 className="eb">{t('karta.visa.min')}</h3>}
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

        <BottomSheet open={listOpen} title={t('landlista.rubrik')} onClose={() => setListOpen(false)}>
          <CountryListPicker legend={false} />
        </BottomSheet>
      </main>
    </>
  );
}
