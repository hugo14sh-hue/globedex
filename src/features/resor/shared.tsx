// Delat för Resor: hämta en resa, rubrik med tillbakalänk, felbesked och belopp.
import { BackLink } from '../../components/BackLink';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Loading } from '../../components/Loading';
import { placeName, type Place } from '../../lib/content';
import { useSession, useTravelMode } from '../../lib/session';
import { hasText } from '../../lib/texter';
import { fetchTrip, isOldSchema, type Trip } from '../../lib/trips';
import { useT } from '../../lib/useT';
import { dateFormat, numberFormat } from '../../lib/locale';

type T = ReturnType<typeof useT>;

/**
 * Felbesked när något inte gick att spara. Saknar databasen en kolumn eller ett värde från
 * SQL-blocket visas resor.databas-gammal (eller allmant.fel tills Hugo har skrivit den texten).
 */
export function saveError(t: T, e: unknown): string {
  if (isOldSchema(e)) return hasText('resor.databas-gammal') ? t('resor.databas-gammal') : t('allmant.fel');
  return t('allmant.fel-spara');
}

const kr0 = () => numberFormat({ style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
const kr2 = () => numberFormat({ style: 'currency', currency: 'SEK', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Ören som kronor: hela kronor när det går jämnt ut, annars med ören. */
export const formatOre = (ore: number) => (ore % 100 === 0 ? kr0().format(ore / 100) : kr2().format(ore / 100));

/** Belopp i en annan valuta, med webbläsarens format. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return numberFormat({ style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const dayFmt = () => dateFormat({ day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayYearFmt = () => dateFormat({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const d = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** Datumintervall som 13 maj – 17 maj 2027. */
export function formatRange(start: string | null, end: string | null): string {
  if (!start) return '';
  if (!end || end === start) return dayYearFmt().format(d(start));
  return `${dayFmt().format(d(start))} – ${dayYearFmt().format(d(end))}`;
}

/** Gruppens medlemmar som id och namn. Solo: bara jag. */
export function usePeople() {
  const { session, members } = useSession();
  const mode = useTravelMode();
  const me = session?.user.id ?? '';
  return useMemo(() => {
    const ids = mode === 'solo' ? [me] : members.map((m) => m.user_id);
    if (me && !ids.includes(me)) ids.unshift(me);
    const name = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? '';
    return { me, ids: ids.filter(Boolean), name, solo: mode === 'solo' };
  }, [mode, members, me]);
}

/** Hämtar resan i adressen. null när den inte finns eller inte syns för användaren (RLS). */
export function useTrip() {
  const { id = '' } = useParams();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      setFailed(false);
      setTrip(await fetchTrip(id));
    } catch {
      setFailed(true);
      setTrip(null);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  return { id, trip, setTrip, failed, reload: load };
}

/** Visar laddning, fel eller saknad resa. Annars barnen. */
export function TripGate({ state, children }: { state: ReturnType<typeof useTrip>; children: (trip: Trip) => ReactNode }) {
  const t = useT();
  if (state.trip === undefined) return <Loading />;
  if (!state.trip) {
    return (
      <main className="scr">
        <BackTo to="/resor" />
        <div className="card soft" role="alert">
          <p>{state.failed ? t('allmant.fel') : t('allmant.saknas')}</p>
          {state.failed && (
            <button type="button" className="btn ghost" onClick={() => void state.reload()}>
              {t('knapp.forsok-igen')}
            </button>
          )}
        </div>
      </main>
    );
  }
  return <>{children(state.trip)}</>;
}

export function BackTo({ to }: { to: string }) {
  return <BackLink to={to} />;
}

/** Rubrik på resans undersidor: tillbaka till resan, sidans namn och resans titel. */
export function SubHeader({ trip, title }: { trip: Trip; title: string }) {
  return (
    <>
      <BackTo to={`/resor/${trip.id}`} />
      <div className="col" style={{ gap: 2 }}>
        <h1>{title}</h1>
        <span className="mu">{trip.title}</span>
      </div>
    </>
  );
}

/** Namn på resans plats, även för länder utan innehåll. */
export const tripPlace = (places: Place[], trip: Pick<Trip, 'place_id'>) => (trip.place_id ? placeName(places, trip.place_id) : '');

/** Förloppsstapel (dekorativ, siffran står i texten bredvid). */
export function Bar({ pct, over = false }: { pct: number; over?: boolean }) {
  return (
    <span className="bar" aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: over ? '#D64545' : undefined }} />
    </span>
  );
}
