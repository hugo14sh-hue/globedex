// Inköpslista (shopping_items): egen per person och resa (RLS). Presenttips från platssidans Köp med hem
// läggs till med knappen där (AddGift nedan). Budgeten för inköp sparas på resan (shopping_budget_sek).
import { useEffect, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import { countryOf, type GiftTip, type Place } from '../../lib/content';
import { useSession } from '../../lib/session';
import { todayIso, tripPhase } from '../../lib/tripLogic';
import { addListRows, deleteListRow, fetchList, fetchTrips, updateListRow, updateTrip, type ShopItem, type Trip } from '../../lib/trips';
import { useT } from '../../lib/useT';
import { formatSek } from '../karta/format';
import { CheckRow } from './PackScreen';
import { Bar, formatRange, saveError, SubHeader, TripGate, usePeople, useTrip } from './shared';

export default function InkopScreen() {
  const state = useTrip();
  return <TripGate state={state}>{(trip) => <Inkop trip={trip} onTrip={state.setTrip} />}</TripGate>;
}

function Inkop({ trip, onTrip }: { trip: Trip; onTrip: (t: Trip) => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const people = usePeople(trip.group_id);
  const [list, setList] = useState<ShopItem[] | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [budget, setBudget] = useState(trip.shopping_budget_sek != null ? String(trip.shopping_budget_sek) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchList<ShopItem>('shopping_items', trip.id)
      .then((x) => alive && setList(x))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [trip.id]);

  const rows = list ?? [];
  const total = rows.reduce((n, r) => n + (r.price_sek || 0), 0);
  const cap = trip.shopping_budget_sek ?? 0;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const [saved] = await addListRows<ShopItem>('shopping_items', [
        { trip_id: trip.id, user_id: people.me, title: name, price_sek: Math.max(0, Math.round(Number(price) || 0)) },
      ]);
      setList([...rows, saved]);
      setTitle('');
      setPrice('');
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r: ShopItem) => {
    setList(rows.map((x) => (x.id === r.id ? { ...x, bought: !x.bought } : x)));
    try {
      await updateListRow('shopping_items', r.id, { bought: !r.bought });
    } catch (err) {
      setList(rows);
      toast(saveError(t, err));
    }
  };

  const remove = async (r: ShopItem) => {
    try {
      await deleteListRow('shopping_items', r.id);
      setList(rows.filter((x) => x.id !== r.id));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  const saveBudget = async () => {
    const n = budget.trim() === '' ? null : Math.max(0, Math.round(Number(budget) || 0));
    if (n === trip.shopping_budget_sek) return;
    try {
      onTrip(await updateTrip(trip.id, { shopping_budget_sek: n }));
      toast(t('allmant.sparat'));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  return (
    <main className="scr">
      <SubHeader trip={trip} title={t('inkop.rubrik')} />
      <div className="card">
        <div className="row">
          <b>{cap ? `${formatSek(total)} / ${formatSek(cap)}` : formatSek(total)}</b>
          {rows.length > 0 && <span className="mu">{t('marke.framsteg', { antal: rows.filter((r) => r.bought).length, totalt: rows.length })}</span>}
        </div>
        {cap > 0 && <Bar pct={(total / cap) * 100} over={total > cap} />}
        {cap > 0 && total > cap && <span className="mu">{t('kassa.over', { belopp: formatSek(total - cap) })}</span>}
        <label>
          {t('resor.steg.budget')}
          <input type="number" inputMode="numeric" min={0} step={50} value={budget} onChange={(e) => setBudget(e.target.value)} onBlur={saveBudget} />
        </label>
      </div>

      {list && !rows.length && (
        <div className="card soft">
          <p>{t('inkop.tom')}</p>
        </div>
      )}
      {rows.map((r) => (
        <CheckRow key={r.id} title={r.title} sub={r.price_sek ? formatSek(r.price_sek) : undefined} on={r.bought} onToggle={() => toggle(r)} onRemove={() => remove(r)} />
      ))}

      <form className="card" onSubmit={add}>
        <div className="g2">
          <label>
            {t('falt.titel')}
            <input value={title} maxLength={60} required onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            {t('inkop.pris')}
            <input type="number" inputMode="numeric" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn" disabled={busy}>
          <Icon name="plus" size={20} />
          {t('knapp.lagg-till')}
        </button>
      </form>
    </main>
  );
}

/** Gruppens kommande och pågående resor till samma land som platsen. */
export function useTripsTo(places: Place[], placeId: string): Trip[] {
  const { activeGroup } = useSession();
  const [trips, setTrips] = useState<Trip[]>([]);
  const gid = activeGroup?.id ?? null;
  const country = countryOf(places, placeId)?.id ?? placeId.slice(0, 2);
  useEffect(() => {
    if (!gid) return;
    let alive = true;
    const today = todayIso();
    fetchTrips(gid)
      .then((all) => {
        if (!alive) return;
        setTrips(all.filter((x) => x.place_id && (countryOf(places, x.place_id)?.id ?? x.place_id.slice(0, 2)) === country && tripPhase(x, today) !== 'avslutad'));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [gid, places, country]);
  return trips;
}

/**
 * Knappen Lägg till på inköpslistan för ett presenttips på platssidan. Syns när gruppen har en kommande
 * resa till samma land (useTripsTo). Med flera sådana resor väljer man resa i ett bottenark.
 */
export function AddGift({ gift, trips }: { gift: GiftTip; trips: Trip[] }) {
  const t = useT();
  const { toast } = useFeedback();
  const { session } = useSession();
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState(false);

  if (!trips.length || !session) return null;

  const add = async (trip: Trip) => {
    setPicking(false);
    try {
      await addListRows('shopping_items', [
        { trip_id: trip.id, user_id: session.user.id, title: gift.name, price_sek: gift.price_sek ?? 0, gift_tip_id: gift.id },
      ]);
      setAdded(true);
      toast(t('allmant.sparat'));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  return (
    <>
      <button type="button" className="chip" aria-pressed={added} disabled={added} onClick={() => (trips.length === 1 ? add(trips[0]) : setPicking(true))}>
        <Icon name={added ? 'check' : 'plus'} size={18} />
        {t('inkop.ny')}
      </button>
      <BottomSheet open={picking} title={t('inkop.ny')} onClose={() => setPicking(false)}>
        {trips.map((x) => (
          <Row key={x.id} icon="plane" title={x.title} sub={formatRange(x.start_date, x.end_date)} onClick={() => add(x)} />
        ))}
      </BottomSheet>
    </>
  );
}
