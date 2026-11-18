// Resor: översikt med nästa resa och nedräkning, övriga planerade resor, tidigare resor och import.
// Listan visar resor i alla grupper man är med i. Filtret (alla, soloresor, en grupp) visas när
// man har resor i mer än en grupp eller är med i en par- eller gruppgrupp.
import { Ingress } from '../../components/Ingress';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from '../../components/Flag';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/Loading';
import { Row } from '../../components/Row';
import { fetchPlaces, type Place } from '../../lib/content';
import { useSession } from '../../lib/session';
import { companyGroups, filterTrips, isSoloTrip, showTripFilter, type TripFilter } from '../../lib/togetherLogic';
import { countdown, sortTrips, todayIso, tripPhase } from '../../lib/tripLogic';
import { fetchTripsIn, type Trip } from '../../lib/trips';
import { useT, useLang } from '../../lib/useT';
import type { Group } from '../../lib/types';
import { formatRange, tripPlace } from './shared';

export default function ResorScreen() {
  const t = useT();
  const lang = useLang();
  const { activeGroup, groups } = useSession();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [filter, setFilter] = useState<TripFilter>('alla');
  const gid = activeGroup?.id ?? null;
  // Alla grupper man är med i (den aktiva först, så att den alltid finns med).
  const groupKey = [...new Set([...(gid ? [gid] : []), ...groups.map((g) => g.id)])].join(',');

  useEffect(() => {
    if (!groupKey) return;
    let alive = true;
    setFailed(false);
    fetchTripsIn(groupKey.split(','))
      .then((x) => alive && setTrips(x))
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setTrips([]);
      });
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [groupKey, lang]);

  const today = todayIso();
  const showFilter = showTripFilter(trips ?? [], groups);
  const shown = useMemo(() => (showFilter ? filterTrips(trips ?? [], filter, groups) : (trips ?? [])), [trips, filter, groups, showFilter]);
  const { next, past } = useMemo(() => sortTrips(shown, today), [shown, today]);

  if (groupKey && trips === null) return <Loading />;
  const [first, ...rest] = next;
  const cd = first ? countdown(first.start_date, today) : null;
  const phase = first ? tripPhase(first, today) : null;
  const filters: { value: TripFilter; label: string }[] = [
    { value: 'alla', label: t('resa.filter.alla') },
    { value: 'solo', label: t('resa.filter.solo') },
    ...companyGroups(groups).map((g) => ({ value: g.id, label: t('resa.filter.grupp', { grupp: g.name }) })),
  ];

  return (
    <main className="scr wide">
      <h1>{t('flik.resor')}</h1>
      <Ingress k="ingress.resor" />
      <Link className="btn" to="/resor/planera">
        <Icon name="plus" size={20} />
        {t('resor.planera')}
      </Link>

      {showFilter && (
        <div className="chips trip-filter" role="group" aria-label={t('resa.filter.aria')}>
          {filters.map((f) => (
            <button key={f.value} type="button" className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {failed && (
        <div className="card soft" role="alert">
          <p>{t('allmant.fel')}</p>
        </div>
      )}

      {!failed && !next.length && (
        <div className="card soft">
          <p>{t('resor.tom')}</p>
        </div>
      )}

      {first && (
        <Link className="hero hero-link" to={`/resor/${first.id}`}>
          <span className="eb">{t(phase === 'pagar' ? 'resor.pagar' : 'resor.kommande')}</span>
          <span className="big">{first.title}</span>
          {cd && <span>{cd.key === 'resor.nedrakning' ? t(cd.key, { dagar: cd.dagar }) : t(cd.key)}</span>}
          <span className="hero-sub">{[tripPlace(places, first), formatRange(first.start_date, first.end_date)].filter(Boolean).join(' · ')}</span>
          {showFilter && isSoloTrip(first, groups) && <span className="chip soft tag">{t('resa.marke.solo')}</span>}
        </Link>
      )}

      {rest.length > 0 && (
        <section className="col">
          <h2 className="eb">{t('resor.kommande')}</h2>
          <div className="dgrid">
            {rest.map((x) => (
              <TripRow key={x.id} trip={x} places={places} groups={groups} mark={showFilter} />
            ))}
          </div>
        </section>
      )}

      <section className="col">
        <h2 className="eb">{t('resor.tidigare')}</h2>
        {past.length > 0 && (
          <div className="dgrid">
            {past.map((x) => (
              <TripRow key={x.id} trip={x} places={places} groups={groups} mark={showFilter} />
            ))}
          </div>
        )}
        <Link className="btn ghost" to="/resor/importera">
          <Icon name="download" size={20} />
          {t('resor.importera')}
        </Link>
      </section>
    </main>
  );
}

/** En resa i listan. mark: soloresor får märket Solo (när listan blandar grupper). */
function TripRow({ trip, places, groups, mark }: { trip: Trip; places: Place[]; groups: Group[]; mark: boolean }) {
  const t = useT();
  const id = trip.place_id ?? '';
  return (
    <Row
      to={`/resor/${trip.id}`}
      title={trip.title}
      sub={[tripPlace(places, trip), formatRange(trip.start_date, trip.end_date)].filter(Boolean).join(' · ')}
      meta={mark && isSoloTrip(trip, groups) ? <span className="chip soft tag">{t('resa.marke.solo')}</span> : undefined}
      lead={
        id ? (
          <Flag placeId={id} />
        ) : (
          <span className="badge">
            <Icon name="plane" size={20} />
          </span>
        )
      }
    />
  );
}
