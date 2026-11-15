// Resor: översikt med nästa resa och nedräkning, övriga planerade resor, tidigare resor och import.
import { Ingress } from '../../components/Ingress';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from '../../components/Flag';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/Loading';
import { Row } from '../../components/Row';
import { fetchPlaces, type Place } from '../../lib/content';
import { useSession } from '../../lib/session';
import { countdown, sortTrips, todayIso, tripPhase } from '../../lib/tripLogic';
import { fetchTrips, type Trip } from '../../lib/trips';
import { useT } from '../../lib/useT';
import { formatRange, tripPlace } from './shared';

export default function ResorScreen() {
  const t = useT();
  const { activeGroup } = useSession();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const gid = activeGroup?.id ?? null;

  useEffect(() => {
    if (!gid) return;
    let alive = true;
    setFailed(false);
    fetchTrips(gid)
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
  }, [gid]);

  const today = todayIso();
  const { next, past } = useMemo(() => sortTrips(trips ?? [], today), [trips, today]);

  if (gid && trips === null) return <Loading />;
  const [first, ...rest] = next;
  const cd = first ? countdown(first.start_date, today) : null;
  const phase = first ? tripPhase(first, today) : null;

  return (
    <main className="scr">
      <h1>{t('flik.resor')}</h1>
      <Ingress k="ingress.resor" />
      <Link className="btn" to="/resor/planera">
        <Icon name="plus" size={20} />
        {t('resor.planera')}
      </Link>

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
        </Link>
      )}

      {rest.length > 0 && (
        <section className="col">
          <h2 className="eb">{t('resor.kommande')}</h2>
          {rest.map((x) => (
            <TripRow key={x.id} trip={x} places={places} />
          ))}
        </section>
      )}

      <section className="col">
        <h2 className="eb">{t('resor.tidigare')}</h2>
        {past.map((x) => (
          <TripRow key={x.id} trip={x} places={places} />
        ))}
        <Link className="btn ghost" to="/resor/importera">
          <Icon name="download" size={20} />
          {t('resor.importera')}
        </Link>
      </section>
    </main>
  );
}

function TripRow({ trip, places }: { trip: Trip; places: Place[] }) {
  const id = trip.place_id ?? '';
  return (
    <Row
      to={`/resor/${trip.id}`}
      title={trip.title}
      sub={[tripPlace(places, trip), formatRange(trip.start_date, trip.end_date)].filter(Boolean).join(' · ')}
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
