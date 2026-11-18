import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { Flag } from '../../components/Flag';
import { Row } from '../../components/Row';
import { fetchItemMarkers, fetchPlaces, placeName, type Place, type PlaceItem } from '../../lib/content';
import { isLight } from '../../lib/upptack';
import { useSession, useTravelMode } from '../../lib/session';
import { STATUS_KEY, useMemberStatuses, useMyPlaces, type PlaceStatus } from '../../lib/status';
import { statusesFor, type MapWho } from '../../lib/statusLogic';
import { useT } from '../../lib/useT';
import { SMART_COLORS } from '../../theme/palettes';
import { mapIsDark, statusColors } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { MapMarker, MapMode } from './MapView';
import { StatusPicker } from './StatusPicker';
import { TopBar } from './TopBar';
import { Ingress } from '../../components/Ingress';
import { monthNames } from './months';
import { usePlayback } from './usePlayback';
import { useUrlState, withParam } from '../../lib/navMemory';
import { currentFocus } from '../../lib/mapFocus';
import { groupPlaces, isHidden } from '../../lib/mapList';
import { continentLabel } from '../../lib/continentNames';
import { useMedia, WIDE } from '../../lib/useMedia';
import type { HideKey } from '../../config';
import { FocusSelect } from './FocusSelect';
import { Legend, MapPlaces, type LegendRow } from './MapPlaces';
import { MapStyleChoice } from './MapStyleChoice';
import { LOCALE } from '../../lib/locale';
import { pricesOf } from '../../lib/prices';
import { COUNTRIES } from '../../lib/countries';
import type { CountryPoint } from '../../lib/mapPoints';
import { mapRegions } from '../../lib/mapRegions';
import { companyGroups, myMap, ourMap, ourVisited, type MapKey, type StatusRow } from '../../lib/togetherLogic';
import { APP_COUNTRIES, countryListTotal, countsAsCountry } from '../../lib/landlistor';
import { CountryListPicker } from '../../components/CountryListPicker';
import { Icon } from '../../components/Icon';

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

const historyIdx = () => (window.history.state as { idx?: number } | null)?.idx ?? null;

/**
 * Kartfliken. På mobil som förut: rubrik, karta, lägen, förklaring och listan Platser under kartan.
 * Från 900 px fyller kartan höjden och förklaringen och listan ligger i en kolumn till höger som går att fälla in.
 * Helskärm (?helskarm=1) är en vy i appen, inte webbläsarens Fullscreen API, så att den fungerar i en installerad
 * PWA på iPhone. Den täcker flikraden och sidhuvudet, och panelen är ett ark nedifrån på mobil.
 */
export default function KartaScreen() {
  const t = useT();
  const nav = useNavigate();
  const { theme, update } = useTheme();
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
  // Kartläge, fokus och helskärm står i adressen, så att de finns kvar när man går tillbaka från en landssida.
  const [mapMode, setMapMode] = useUrlState<MapMode>('lage', 'ren', MODES);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [picked, setPicked] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  // Läget Regioner: syns någon region i utsnittet? Annars visas karta.regioner.tom.
  const [regionsVisible, setRegionsVisible] = useState(true);
  const [params, setParams] = useSearchParams();
  const playId = params.get('resa');
  const play = usePlayback(playId);
  const playLeg = play.legs[play.step];

  // Fokus: adressens värde, annars det sparade (profiles.settings), annars Europa. Ett val sparas och skrivs i adressen.
  const focus = currentFocus(params.get('fokus'), theme.mapFocus, params.get('utsnitt'));
  const setFocus = useCallback(
    (v: string) => {
      update({ mapFocus: v });
      setParams((p) => withParam(withParam(p, 'utsnitt', null), 'fokus', v), { replace: true });
    },
    [update, setParams],
  );

  // Från 900 px: kartan i hela höjden och en kolumn till höger. I helskärm täcker kartan flikraden och sidhuvudet.
  const wide = useMedia(WIDE);
  const fs = params.get('helskarm') === '1';
  const overlay = fs || wide;
  const [sideOpen, setSideOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sideId = useId();
  const openBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  // Historikposten som helskärmen lade till: stängs helskärmen därifrån går appen ett steg bakåt.
  const fsIdx = useRef<number | null>(null);

  const openFs = () => {
    setParams((p) => withParam(p, 'helskarm', '1'));
    window.setTimeout(() => (fsIdx.current = historyIdx()), 0);
  };
  const closeFs = useCallback(() => {
    if (fsIdx.current != null && historyIdx() === fsIdx.current) nav(-1);
    else setParams((p) => withParam(p, 'helskarm', null), { replace: true });
    fsIdx.current = null;
  }, [nav, setParams]);

  // Helskärm: sidan rullar inte och flikraden och sidhuvudet går inte att nå med tangentbordet.
  // Fokus flyttas till stängknappen, och efteråt tillbaka till knappen som öppnade.
  const wasFs = useRef(fs);
  useEffect(() => {
    if (wasFs.current && !fs) openBtn.current?.focus();
    if (!wasFs.current && fs) closeBtn.current?.focus();
    wasFs.current = fs;
    if (!fs) return;
    document.body.classList.add('fs-locked');
    const covered = [...document.querySelectorAll<HTMLElement>('.nav, .topbar')];
    for (const el of covered) el.inert = true;
    return () => {
      document.body.classList.remove('fs-locked');
      for (const el of covered) el.inert = false;
    };
  }, [fs]);

  // Escape stänger helskärmen, utom när ett ark är öppet (då stänger Escape arket).
  const sheetsOpen = Boolean(picked) || listOpen;
  const onEsc = useRef<() => void>(() => undefined);
  useEffect(() => {
    onEsc.current = () => {
      if (!sheetsOpen) closeFs();
    };
  });
  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onEsc.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fs]);

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

  // Kartans stil (kartstil.*) kan vara mörk när appen är ljus och tvärtom. Statusfärgerna på kartan, i förklaringen
  // och i listan följer kartan, och användarens egna färger går före paletten (src/theme/theme.ts).
  const mapDark = mapIsDark(theme);
  const colors = useMemo(() => statusColors(theme, mapDark), [theme, mapDark]);
  const months = useMemo(() => monthNames(), []);
  const hidden = theme.mapHidden;
  const toggleHidden = (k: MapKey) =>
    update({ mapHidden: hidden.includes(k as HideKey) ? hidden.filter((x) => x !== k) : [...hidden, k as HideKey] });

  // Färg per land: status, eller betyget för vald månad i Smart månad. Släckta statusar får färgen för ingen status.
  const fills = useMemo(() => {
    const out: Record<string, string> = {};
    if (mapMode === 'smart') {
      for (const p of places) {
        const score = p.kind === 'country' && p.iso2 && p.smart_months?.[month];
        if (p.kind === 'country' && p.iso2 && typeof score === 'number') out[p.iso2] = SMART_COLORS[score] ?? SMART_COLORS[0];
      }
      return out;
    }
    for (const [id, k] of Object.entries(keys)) if (/^[A-Z]{2}$/.test(id) && !isHidden(k, hidden)) out[id] = colors[k];
    return out;
  }, [mapMode, places, month, keys, colors, hidden]);

  // Länder utanför vald landlista ritas med streck. Listan alla har inga.
  const hatched = useMemo(
    () => (theme.countryList === 'alla' ? [] : APP_COUNTRIES.filter((c) => !countsAsCountry(c, theme.countryList))),
    [theme.countryList],
  );

  // Regionerna (platser med lager, i dag landskap och delstater). Färgas efter status precis som länder.
  const regions = useMemo(() => mapRegions(places, LOCALE), [places]);
  const regionFills = useMemo(() => {
    const out: Record<string, string> = {};
    if (mapMode !== 'regioner') return out;
    for (const r of regions) {
      const k = keys[r.id];
      if (k && !isHidden(k, hidden)) out[r.id] = colors[k];
    }
    return out;
  }, [mapMode, regions, keys, colors, hidden]);

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
  const keyLabel = (k: MapKey) => legend.find((r) => r.key === k)?.label ?? (k in STATUS_KEY ? t(STATUS_KEY[k as PlaceStatus]) : '');

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

  // Listan Platser: per världsdel, länderna i bokstavsordning och städerna under sitt land.
  const groupsList = useMemo(
    () => groupPlaces(keys, hidden, (id) => placeName(places, id), (c) => continentLabel(c, t), LOCALE, (id) => places.find((x) => x.id === id)?.kind),
    [keys, hidden, places, t],
  );
  const total = Object.keys(mine.statuses).length;
  const shownTotal = Object.keys(keys).length;
  const pickedName = picked ? placeName(places, picked) : '';
  const listLoaded = mine.loaded && (who === 'min' || memberStatuses.loaded);

  // Mobil helskärm: panelen är ett ark som dras upp från nederkanten, eller öppnas och stängs med ett tryck.
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const [dragY, setDragY] = useState(0);
  const onSheetDown = (e: RPointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onSheetMove = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dy) > 6) drag.current.moved = true;
    if (drag.current.moved) setDragY(sheetOpen ? Math.max(0, dy) : Math.min(0, dy));
  };
  const onSheetUp = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (d?.moved) {
      const dy = e.clientY - d.y;
      if (dy < -40) setSheetOpen(true);
      if (dy > 40) setSheetOpen(false);
    }
    setDragY(0);
    // Klicket som följer på en dragning ska inte växla arket en gång till.
    window.setTimeout(() => (drag.current = null), 0);
  };

  const whoChips = mode !== 'solo' && (
    <div className="chips k-who" role="group" aria-label={t('karta.vy.aria')}>
      {(['min', 'var', ...others.map((m) => m.user_id)] as MapWho[]).map((w) => (
        <button key={w} type="button" className="chip" aria-pressed={who === w} onClick={() => setWho(w)}>
          {whoLabel(w)}
        </button>
      ))}
    </div>
  );

  const modeChips = (
    <div className="chips k-modes" role="group" aria-label={t('flik.karta')}>
      {MODES.map((m) => (
        <button key={m} type="button" className="chip" aria-pressed={mapMode === m} onClick={() => setMapMode(m)}>
          {t(MODE_KEY[m])}
        </button>
      ))}
    </div>
  );

  // Vilka länder som räknas: samma val som under Anpassning.
  // Namnet är karta.landlista.aria följt av den synliga texten, så att den synliga texten ingår i namnet (WCAG 2.5.3).
  const listChip = (
    <button type="button" className="chip soft list-chip" aria-labelledby="landlista-aria landlista-knapp" aria-haspopup="dialog" onClick={() => setListOpen(true)}>
      <span id="landlista-aria" className="sr-only">
        {t('karta.landlista.aria')}
      </span>
      <Icon name="filter" size={16} />
      <span id="landlista-knapp">{t('karta.landlista.knapp', { antal: countryListTotal(theme.countryList) })}</span>
    </button>
  );

  const head = (
    <div className="col k-head">
      <h1>{t('flik.karta')}</h1>
      <Ingress k="ingress.karta" />
    </div>
  );

  const playCard = playId && (
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
  );

  const smart = mapMode === 'smart' && (
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
  );

  // Panelens innehåll: i flödet på mobil, i kolumnen till höger från 900 px och i helskärmspanelen.
  const showSide = fs && !wide ? sheetOpen : !wide || sideOpen;
  const cls = ['scr', 'under-topbar', 'karta', fs ? 'fs' : '', wide ? 'wide' : '', wide && !sideOpen ? 'side-shut' : ''].filter(Boolean).join(' ');

  return (
    <>
      <TopBar />
      <main className={cls}>
        {!overlay && head}
        {!overlay && whoChips}

        <div className="map k-map">
          {mapFailed ? (
            <div className="map-fail card soft" role="alert">
              <p>{t('karta.laddar-fel')}</p>
            </div>
          ) : (
            <Suspense fallback={<div className="map-canvas map-wait" aria-busy="true" />}>
              <MapView
                dark={mapDark}
                mode={mapMode}
                focus={focus}
                fills={fills}
                fallback={colors.ej}
                fallbackOpacity={mapMode === 'smart' ? 0.35 : 0.85}
                hatched={hatched}
                markers={markers}
                markerColor={colors.bor}
                route={play.route}
                routeColor={mapDark ? '#F4B942' : '#E4572E'}
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
          <div className="k-top">
            <FocusSelect value={focus} onChange={setFocus} />
            <div className="k-tr">
              {wide && (
                <button
                  type="button"
                  className="chip k-icon"
                  aria-expanded={sideOpen}
                  aria-controls={sideId}
                  aria-label={t('karta.helskarm.panel')}
                  onClick={() => setSideOpen((o) => !o)}
                >
                  <Icon name="side" size={20} />
                </button>
              )}
              {fs ? (
                <button ref={closeBtn} type="button" className="chip k-icon" aria-label={t('karta.helskarm.stang')} onClick={closeFs}>
                  <Icon name="x" size={20} />
                </button>
              ) : (
                <button ref={openBtn} type="button" className="chip k-icon" aria-label={t('karta.helskarm.oppna')} onClick={openFs}>
                  <Icon name="expand" size={20} />
                </button>
              )}
            </div>
          </div>
          {overlay && (
            <div className="k-bar">
              {whoChips}
              {modeChips}
              {listChip}
            </div>
          )}
        </div>

        {!overlay && playCard}
        {!overlay && modeChips}
        {!overlay && listChip}
        {!overlay && smart}

        <aside
          id={sideId}
          className={['k-side', fs && !wide ? 'k-sheet' : '', sheetOpen ? 'up' : ''].filter(Boolean).join(' ')}
          aria-label={fs ? t('karta.helskarm.panel') : undefined}
          style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        >
          {fs && !wide && (
            <button
              type="button"
              className="k-sheet-h"
              aria-expanded={sheetOpen}
              aria-controls={`${sideId}-in`}
              onClick={() => !drag.current?.moved && setSheetOpen((o) => !o)}
              onPointerDown={onSheetDown}
              onPointerMove={onSheetMove}
              onPointerUp={onSheetUp}
              onPointerCancel={onSheetUp}
            >
              <span className="grab" aria-hidden="true" />
              <span className="h3">{t('karta.helskarm.panel')}</span>
            </button>
          )}
          {showSide && (
            <div className="col k-side-in" id={`${sideId}-in`}>
              {fs && wide && <h2 className="h3">{t('karta.helskarm.panel')}</h2>}
              {wide && !fs && head}
              {overlay && playCard}
              {overlay && smart}
              {mapMode !== 'smart' && <Legend rows={legend} colors={colors} id={`${sideId}-lg`} />}
              {fs && <MapStyleChoice />}
              <MapPlaces
                groups={groupsList}
                legend={legend}
                colors={colors}
                hidden={hidden}
                onToggle={toggleHidden}
                label={keyLabel}
                level={(id) => (id.length > 2 ? (pricesOf(places.find((x) => x.id === id)?.data)?.level ?? null) : null)}
                empty={shownTotal === 0}
                loaded={listLoaded}
              />
            </div>
          )}
        </aside>

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
