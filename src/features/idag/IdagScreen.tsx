// Idag: välj plats och tid, slumpa en idé, se vad som finns nära, och sparade idéer.
// Idéerna kommer ur ideas (innehållet). Sparade idéer ligger i saved_ideas och delas med gruppen.
import { Ingress } from '../../components/Ingress';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/Loading';
import { Segment } from '../../components/Segment';
import { APP_NAME } from '../../config';
import { COST_LEVELS, fetchIdeas, fetchPlaces, IDEA_KINDS, IDEA_TAGS, placeName, type Idea, type Place } from '../../lib/content';
import {
  addSavedLocation,
  deleteSavedIdea,
  deleteSavedLocation,
  fetchSavedIdeas,
  fetchSavedLocations,
  saveIdea,
  setIdeaDone,
  type SavedIdea,
  type SavedLocation,
} from '../../lib/idag';
import {
  applyFilter,
  distanceKm,
  filterCount,
  formatKm,
  formatMinutes,
  ideaPoint,
  ideasHere,
  nearby,
  NO_FILTER,
  outingDates,
  pickNext,
  RANGES,
  resolvePlace,
  spotPoint,
  toggleIn,
  type IdagView,
  type IdeaFilter,
  type NearItem,
  type Point,
  type Range,
  type Spot,
  type When,
} from '../../lib/idagLogic';
import { googleMaps } from '../../lib/links';
import { useSession } from '../../lib/session';
import { todayIso } from '../../lib/tripLogic';
import { countryIdFor, setPlaceStatus, shouldMarkPlanned, useMyPlaces } from '../../lib/status';
import { createTrip } from '../../lib/trips';
import { useT, useLang } from '../../lib/useT';
import { formatDate } from '../karta/format';
import { saveError } from '../resor/shared';
import { IdeaBudget } from './IdeaBudget';
import { LocationSheet, spotFromName } from './LocationSheet';
import { LOCALE } from '../../lib/locale';

const STORE = `${APP_NAME.toLowerCase()}.idag`;
const NEAR_MAX = 40;

interface Stored {
  spot: Spot | null;
  when: When;
  view: IdagView;
  range: Range;
}

/** Senaste val i Idag, bara i den här webbläsaren. */
function readStored(): Stored {
  const base: Stored = { spot: null, when: 'idag', view: 'slumpa', range: '1h' };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null') as Partial<Stored> | null;
    return s ? { ...base, ...s } : base;
  } catch {
    return base;
  }
}

function writeStored(s: Stored) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    // Lagringen är inte tillgänglig. Valen gäller då bara tills sidan laddas om.
  }
}

type Open = { type: 'idea'; idea: Idea } | { type: 'place'; place: Place; item: NearItem } | null;

export default function IdagScreen() {
  const t = useT();
  const lang = useLang();
  const nav = useNavigate();
  const { toast, party } = useFeedback();
  const { session, activeGroup } = useSession();
  const me = session?.user.id ?? '';
  const mine = useMyPlaces(me || null);

  const [stored, setStored] = useState<Stored>(readStored);
  const { when, view, range } = stored;
  const update = useCallback((p: Partial<Stored>) => {
    setStored((s) => {
      const next = { ...s, ...p };
      writeStored(next);
      return next;
    });
  }, []);

  const [places, setPlaces] = useState<Place[]>([]);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [locations, setLocations] = useState<SavedLocation[] | null>(null);
  const [saved, setSaved] = useState<SavedIdea[]>([]);
  const [filter, setFilter] = useState<IdeaFilter>(NO_FILTER);
  const [locOpen, setLocOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([fetchPlaces(), fetchIdeas()])
      .then(([p, i]) => {
        setPlaces(p);
        setIdeas(i);
      })
      .catch(() => setFailed(true));
  }, [lang]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    fetchSavedLocations(me)
      .then((l) => alive && setLocations(l))
      .catch(() => alive && setLocations([]));
    return () => {
      alive = false;
    };
  }, [me]);

  useEffect(() => {
    if (!activeGroup) return;
    let alive = true;
    fetchSavedIdeas(activeGroup.id)
      .then((l) => alive && setSaved(l))
      .catch(() => alive && setSaved([]));
    return () => {
      alive = false;
    };
  }, [activeGroup]);

  const home = locations?.find((l) => l.is_home) ?? null;
  const others = (locations ?? []).filter((l) => !l.is_home);

  // Vald plats. Hemma följer alltid profilens hemort. Utan val: hemma om den finns.
  const spot: Spot | null = useMemo(() => {
    const s = stored.spot;
    if (s?.kind === 'hemma' || (!s && home)) return home ? { kind: 'hemma', name: home.name, lat: home.lat, lon: home.lon, id: home.id } : null;
    if (s?.kind === 'sparad') {
      const l = others.find((x) => x.id === s.id);
      return l ? { kind: 'sparad', name: l.name, lat: l.lat, lon: l.lon, id: l.id } : locations ? null : s;
    }
    return s;
  }, [stored.spot, home, others, locations]);

  const atHome = spot?.kind === 'hemma';
  const spotPlace = useMemo(() => (spot ? resolvePlace(spot, places) : null), [spot, places]);
  const origin: Point | null = spot ? spotPoint(spot, spotPlace) : null;
  const spotLabel = spot ? (spot.kind === 'position' ? t('idag.plats.position') : spot.name) : t('idag.plats.valj');

  // ---------- Slumpa ----------
  const here = useMemo(() => (ideas ? ideasHere(ideas, places, spotPlace?.id ?? null, atHome, when) : []), [ideas, places, spotPlace, atHome, when]);
  const pool = useMemo(() => applyFilter(here, filter), [here, filter]);
  const poolKey = pool.map((i) => i.id).join(',');
  const [current, setCurrent] = useState<string | null>(null);
  const seen = useRef<string[]>([]);

  useEffect(() => {
    const ids = poolKey ? poolKey.split(',') : [];
    seen.current = [];
    const r = pickNext(ids, [], null);
    seen.current = r.seen;
    setCurrent(r.id);
  }, [poolKey]);

  const shuffle = () => {
    const r = pickNext(
      pool.map((i) => i.id),
      seen.current,
      current,
    );
    seen.current = r.seen;
    setCurrent(r.id);
  };

  const idea = pool.find((i) => i.id === current) ?? null;
  const kindsHere = IDEA_KINDS.filter((k) => here.some((i) => i.kind === k));
  const costsHere = COST_LEVELS.filter((c) => here.some((i) => i.cost_level === c));

  // ---------- Nära ----------
  const near = useMemo(
    () => (origin && ideas ? nearby(origin, spotPlace?.id ?? null, ideas, places, range, when).slice(0, NEAR_MAX) : []),
    // origin är ett nytt objekt varje gång, så koordinaterna används som beroenden.
    [origin?.lat, origin?.lon, spotPlace, ideas, places, range, when],
  );

  // ---------- Sparade ----------
  const savedFor = (id: string) => saved.find((s) => s.idea_id === id) ?? null;
  const ideaById = (id: string | null) => (id && ideas ? (ideas.find((i) => i.id === id) ?? null) : null);

  const save = async (i: Idea) => {
    if (!activeGroup || busy || savedFor(i.id)) return;
    setBusy(true);
    try {
      const row = await saveIdea(activeGroup.id, i.id, i.title);
      setSaved((l) => [row, ...l]);
      toast(t('idag.sparad'));
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  /** Markerar som gjord. En idé som inte är sparad sparas först, så att den räknas i märket. */
  const toggleDone = async (i: Idea | null, row: SavedIdea | null) => {
    if (!activeGroup || busy) return;
    setBusy(true);
    try {
      if (row) {
        const next = await setIdeaDone(row.id, !row.done_on);
        setSaved((l) => l.map((x) => (x.id === row.id ? next : x)));
        if (next.done_on) party(t('allmant.sparat'));
      } else if (i) {
        const next = await saveIdea(activeGroup.id, i.id, i.title, true);
        setSaved((l) => [next, ...l]);
        party(t('allmant.sparat'));
      }
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const unsave = async (row: SavedIdea) => {
    try {
      await deleteSavedIdea(row.id);
      setSaved((l) => l.filter((x) => x.id !== row.id));
      toast(t('allmant.borttaget'));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  // ---------- Gör om till resa ----------
  const makeTrip = async (to: { placeId: string; title: string; name: string; point: Point | null; minutes: number | null }) => {
    if (!activeGroup || !me || busy) return;
    setBusy(true);
    const { start, end } = outingDates(when, todayIso());
    // Vid position används den närmaste platsen i innehållet som namn, om det finns en.
    const from = spot?.kind === 'position' ? (spotPlace?.name ?? spotLabel) : (spot?.name ?? '');
    const km = origin && to.point ? Math.round(distanceKm(origin, to.point)) : null;
    try {
      const trip = await createTrip(
        {
          group_id: activeGroup.id,
          title: to.title,
          place_id: to.placeId,
          kind: 'utflykt',
          start_date: start,
          end_date: end,
          from_airport: null,
          budget: {},
          created_by: me,
        },
        [
          {
            pos: 0,
            mode: 'bil',
            from_text: from || to.name,
            to_text: to.name,
            from_lat: origin?.lat ?? null,
            from_lon: origin?.lon ?? null,
            to_lat: to.point?.lat ?? null,
            to_lon: to.point?.lon ?? null,
            depart_at: `${start}T00:00:00Z`,
            duration_min: to.minutes,
            distance_km: km,
            note: null,
          },
        ],
      );
      // Samma regel som planeraren: landet blir planerat om status är tom eller vill åka.
      const land = countryIdFor(to.placeId);
      if (shouldMarkPlanned(mine.statuses[land])) await setPlaceStatus(land, 'planerad').catch(() => undefined);
      party(t('resor.skapad'));
      nav(`/resor/${trip.id}`);
    } catch (err) {
      toast(saveError(t, err));
      setBusy(false);
    }
  };

  const ideaTrip = (i: Idea) => {
    if (!i.place_id) return;
    const n = near.find((x) => x.type === 'idea' && x.idea.id === i.id);
    return makeTrip({
      placeId: i.place_id,
      title: i.title,
      name: placeName(places, i.place_id),
      point: ideaPoint(i, places),
      minutes: n?.minutes ?? null,
    });
  };

  // ---------- Plats ----------
  const pickSpot = (s: Spot) => {
    update({ spot: s.kind === 'hemma' ? { kind: 'hemma', name: '', lat: null, lon: null } : s });
    setFilter(NO_FILTER);
    setLocOpen(false);
  };

  const addLocation = async (name: string) => {
    if (!me) return;
    try {
      const s = spotFromName(name, places);
      const row = await addSavedLocation(me, s.name, s.lat, s.lon);
      setLocations((l) => [...(l ?? []), row]);
      pickSpot({ kind: 'sparad', name: row.name, lat: row.lat, lon: row.lon, id: row.id });
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  const removeLocation = async (loc: SavedLocation) => {
    try {
      await deleteSavedLocation(loc.id);
      setLocations((l) => (l ?? []).filter((x) => x.id !== loc.id));
      if (stored.spot?.kind === 'sparad' && stored.spot.id === loc.id) update({ spot: null });
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  const rangeLabel = (r: Range) => t(`idag.nara.${r}`);
  const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase(LOCALE) + s.slice(1);
  const away = (n: { km: number; minutes: number | null }) =>
    n.minutes != null ? t('idag.restid', { tid: formatMinutes(n.minutes) }) : t('idag.avstand', { km: formatKm(n.km) });

  const ideaChips = (i: Idea) =>
    [
      i.place_id ? placeName(places, i.place_id) : null,
      i.duration,
      i.cost_level ? t(`kostnad.${i.cost_level}`) : null,
    ].filter((x): x is string => Boolean(x));

  // ---------- Vy ----------
  if (failed)
    return (
      <main className="scr">
        <h1>{t(when === 'helg' ? 'idag.rubrik.helg' : 'idag.rubrik.idag')}</h1>
      <Ingress k="ingress.idag" />
        <div className="card soft">
          <p>{t('allmant.fel')}</p>
          <button type="button" className="btn ghost" onClick={load}>
            {t('knapp.forsok-igen')}
          </button>
        </div>
      </main>
    );
  if (!ideas || !locations) return <Loading />;

  const openRow = open?.type === 'idea' ? savedFor(open.idea.id) : null;

  return (
    <main className="scr wide">
      <h1>{t(when === 'helg' ? 'idag.rubrik.helg' : 'idag.rubrik.idag')}</h1>
        <Ingress k="ingress.idag" />

      <div className="chips">
        <button type="button" className="chip primary" aria-haspopup="dialog" onClick={() => setLocOpen(true)}>
          <Icon name="pin" size={16} />
          {spotLabel}
        </button>
        <button type="button" className="chip" aria-pressed={when === 'idag'} onClick={() => update({ when: 'idag' })}>
          {t('idag.rubrik.idag')}
        </button>
        <button type="button" className="chip" aria-pressed={when === 'helg'} onClick={() => update({ when: 'helg' })}>
          {t('idag.rubrik.helg')}
        </button>
      </div>

      <Segment<IdagView>
        options={[
          { value: 'slumpa', label: t('idag.vy.slumpa') },
          { value: 'nara', label: t('idag.vy.nara') },
          { value: 'sparade', label: t('idag.vy.sparade') },
        ]}
        value={view}
        onChange={(v) => update({ view: v })}
      />

      {view === 'slumpa' && (
        <>
          <div className="chips">
            {IDEA_TAGS.map((tag) => (
              <button key={tag} type="button" className="chip" aria-pressed={filter.tags.includes(tag)} onClick={() => setFilter((f) => ({ ...f, tags: toggleIn(f.tags, tag) }))}>
                {t(`idag.tagg.${tag}`)}
              </button>
            ))}
            <button
              type="button"
              className="chip"
              aria-haspopup="dialog"
              aria-pressed={filter.kinds.length + filter.costs.length > 0}
              onClick={() => setFilterOpen(true)}
            >
              <Icon name="filter" size={16} />
              {t('knapp.filtrera')}
              {filter.kinds.length + filter.costs.length > 0 ? ` (${filter.kinds.length + filter.costs.length})` : ''}
            </button>
          </div>

          {idea ? (
            <>
              <button type="button" className="hero idea" onClick={() => setOpen({ type: 'idea', idea })}>
                <span className="eb">{t(`idag.typ.${idea.kind}`)}</span>
                <span className="ti">{idea.title}</span>
                <IdeaBudget level={idea.cost_level} />
                <span className="chips">
                  {ideaChips(idea).map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                  {savedFor(idea.id)?.done_on && (
                    <span className="chip">
                      <Icon name="check" size={14} stroke={3} />
                      {t('idag.gjord')}
                    </span>
                  )}
                </span>
              </button>
              <div className="g2">
                <button type="button" className="btn acc" disabled={pool.length < 2} onClick={shuffle}>
                  <Icon name="shuffle" size={20} />
                  {t('idag.slumpa-igen')}
                </button>
                <button type="button" className="btn ghost" disabled={busy || Boolean(savedFor(idea.id))} aria-pressed={Boolean(savedFor(idea.id))} onClick={() => void save(idea)}>
                  <Icon name={savedFor(idea.id) ? 'check' : 'heart'} size={20} />
                  {t('idag.spara')}
                </button>
              </div>
            </>
          ) : (
            <div className="card soft">
              <p>{t('idag.tom')}</p>
              {filterCount(filter) > 0 ? null : (
                <button type="button" className="btn ghost" onClick={() => setLocOpen(true)}>
                  <Icon name="pin" size={20} />
                  {t('idag.plats.valj')}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {view === 'nara' && (
        <>
          <Segment<Range> options={RANGES.map((r) => ({ value: r, label: rangeLabel(r) }))} value={range} onChange={(r) => update({ range: r })} />
          {near.length === 0 ? (
            <div className="card soft">
              <p>{t('idag.nara.tom', { tid: lowerFirst(rangeLabel(range)) })}</p>
              {!origin && (
                <button type="button" className="btn ghost" onClick={() => setLocOpen(true)}>
                  <Icon name="pin" size={20} />
                  {t('idag.plats.valj')}
                </button>
              )}
            </div>
          ) : (
            <div className="dgrid">
            {near.map((n) =>
              n.type === 'idea' ? (
                <button key={n.key} type="button" className="li" onClick={() => setOpen({ type: 'idea', idea: n.idea })}>
                  <span className="badge">
                    <Icon name="star" size={20} />
                  </span>
                  <span className="t">
                    <b>{n.idea.title}</b>
                    <IdeaBudget level={n.idea.cost_level} />
                    <span className="mu">{[t(`idag.typ.${n.idea.kind}`), placeName(places, n.idea.place_id!)].join(' · ')}</span>
                  </span>
                  <span className="chip soft">{away(n)}</span>
                </button>
              ) : (
                <button key={n.key} type="button" className="li" onClick={() => setOpen({ type: 'place', place: n.place, item: n })}>
                  <span className="badge">
                    <Icon name="pin" size={20} />
                  </span>
                  <span className="t">
                    <b>{n.place.name}</b>
                    {n.place.parent_id && <span className="mu">{placeName(places, n.place.parent_id)}</span>}
                  </span>
                  <span className="chip soft">{away(n)}</span>
                </button>
              ),
            )}
            </div>
          )}
        </>
      )}

      {view === 'sparade' &&
        (saved.length === 0 ? (
          <div className="card soft">
            <p>{t('idag.sparade.tom')}</p>
          </div>
        ) : (
          <div className="dgrid">
          {saved.map((row) => {
            const i = ideaById(row.idea_id);
            const title = i?.title ?? row.title ?? '';
            const done = Boolean(row.done_on);
            return (
              <div key={row.id} className="li">
                <button
                  type="button"
                  className={`box${done ? ' on' : ''}`}
                  aria-pressed={done}
                  aria-label={`${t('idag.markera-gjord')}: ${title}`}
                  disabled={busy}
                  onClick={() => void toggleDone(i, row)}
                >
                  {done && <Icon name="check" size={16} stroke={3} />}
                </button>
                <button type="button" className="t" disabled={!i} onClick={() => i && setOpen({ type: 'idea', idea: i })}>
                  <b className={done ? 'done' : ''}>{title}</b>
                  <IdeaBudget level={i?.cost_level} />
                  <span className="mu">
                    {done ? `${t('idag.gjord')} ${formatDate(row.done_on!)}` : i ? t(`idag.typ.${i.kind}`) : ''}
                  </span>
                </button>
                <button type="button" className="mini" aria-label={`${t('idag.ta-bort-sparad')}: ${title}`} onClick={() => void unsave(row)}>
                  <Icon name="x" size={18} />
                </button>
              </div>
            );
          })}
          </div>
        ))}

      <LocationSheet
        open={locOpen}
        onClose={() => setLocOpen(false)}
        current={spot}
        home={home}
        saved={others}
        places={places}
        onPick={pickSpot}
        onAdd={addLocation}
        onRemove={removeLocation}
      />

      <BottomSheet open={filterOpen} title={t('knapp.filtrera')} onClose={() => setFilterOpen(false)}>
        {kindsHere.length > 0 && (
          <>
            <h3 className="eb">{t('idag.filter.typ')}</h3>
            <div className="chips">
              {kindsHere.map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={filter.kinds.includes(k)} onClick={() => setFilter((f) => ({ ...f, kinds: toggleIn(f.kinds, k) }))}>
                  {t(`idag.typ.${k}`)}
                </button>
              ))}
            </div>
          </>
        )}
        {costsHere.length > 0 && (
          <>
            <h3 className="eb">{t('idag.filter.kostnad')}</h3>
            <div className="chips">
              {costsHere.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={filter.costs.includes(c)} onClick={() => setFilter((f) => ({ ...f, costs: toggleIn(f.costs, c) }))}>
                  {t(`kostnad.${c}`)}
                </button>
              ))}
            </div>
          </>
        )}
        <button type="button" className="btn" onClick={() => setFilterOpen(false)}>
          {t('knapp.klar')}
        </button>
      </BottomSheet>

      <BottomSheet open={open?.type === 'idea'} title={open?.type === 'idea' ? open.idea.title : ''} onClose={() => setOpen(null)}>
        {open?.type === 'idea' && (
          <>
            <span className="eb">{[t(`idag.typ.${open.idea.kind}`), ...ideaChips(open.idea)].join(' · ')}</span>
            {open.idea.body && <p>{open.idea.body}</p>}
            {(() => {
              const n = near.find((x) => x.type === 'idea' && x.idea.id === open.idea.id);
              const p = origin ? ideaPoint(open.idea, places) : null;
              if (n) return <p className="mu">{away(n)}</p>;
              if (origin && p && open.idea.place_id) return <p className="mu">{t('idag.avstand', { km: formatKm(distanceKm(origin, p)) })}</p>;
              return null;
            })()}
            {openRow ? (
              <button type="button" className="btn ghost" onClick={() => void unsave(openRow)}>
                {t('idag.ta-bort-sparad')}
              </button>
            ) : (
              <button type="button" className="btn" disabled={busy} onClick={() => void save(open.idea)}>
                <Icon name="heart" size={20} />
                {t('idag.spara')}
              </button>
            )}
            <button type="button" className="btn ghost" aria-pressed={Boolean(openRow?.done_on)} disabled={busy} onClick={() => void toggleDone(open.idea, openRow)}>
              <Icon name="check" size={20} />
              {openRow?.done_on ? `${t('idag.gjord')} ${formatDate(openRow.done_on)}` : t('idag.markera-gjord')}
            </button>
            {open.idea.place_id && (
              <>
                <a
                  className="btn ghost"
                  href={googleMaps(`${open.idea.title}, ${placeName(places, open.idea.place_id)}`, open.idea.lat, open.idea.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="map" size={20} />
                  {t('knapp.oppna-karta')}
                </a>
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void ideaTrip(open.idea)}>
                  <Icon name="plane" size={20} />
                  {t('idag.gor-resa')}
                </button>
              </>
            )}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={open?.type === 'place'} title={open?.type === 'place' ? open.place.name : ''} onClose={() => setOpen(null)}>
        {open?.type === 'place' && (
          <>
            <p className="mu">{away(open.item)}</p>
            <a className="btn ghost" href={googleMaps(open.place.name, open.place.lat, open.place.lon)} target="_blank" rel="noopener noreferrer">
              <Icon name="map" size={20} />
              {t('knapp.oppna-karta')}
            </a>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() =>
                void makeTrip({ placeId: open.place.id, title: open.place.name, name: open.place.name, point: open.item.point, minutes: null })
              }
            >
              <Icon name="plane" size={20} />
              {t('idag.gor-resa')}
            </button>
          </>
        )}
      </BottomSheet>
    </main>
  );
}

