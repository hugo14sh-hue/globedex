// Resesidan: nedräkning, resplan med etapper (lägga till, ändra, sortera om), uppspelning på kartan
// och vägar vidare till resekassa, bokningar, packlista, innan avresa och inköpslista.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Flag } from '../../components/Flag';
import { Row } from '../../components/Row';
import { fetchPlaces, type Place } from '../../lib/content';
import { spent } from '../../lib/kassa';
import { changedPos, countdown, move, todayIso, tripPhase } from '../../lib/tripLogic';
import {
  addLeg,
  deleteLeg,
  deleteTrip,
  fetchBookings,
  fetchExpenseRows,
  fetchHome,
  fetchLegs,
  fetchListCounts,
  updateLeg,
  updateTrip,
  type Home,
  type Leg,
  type Trip,
} from '../../lib/trips';
import { useT } from '../../lib/useT';
import { emptyLeg, LegFields, toLeg, useNamedPoints, type LegDraft } from './LegFields';
import { BackTo, formatOre, formatRange, saveError, TripGate, tripPlace, usePeople, useTrip } from './shared';
import { currencySymbol } from '../karta/format';

export default function TripScreen() {
  const state = useTrip();
  return <TripGate state={state}>{(trip) => <TripPage trip={trip} onTrip={state.setTrip} />}</TripGate>;
}

interface Counts {
  bookings: number;
  spentOre: number;
  pack: [number, number];
  pre: [number, number];
  shop: [number, number];
}

const toDraft = (l: Leg): LegDraft => ({
  from_text: l.from_text,
  to_text: l.to_text,
  mode: l.mode,
  date: l.depart_at?.slice(0, 10) ?? '',
  duration_min: l.duration_min ? String(l.duration_min) : '',
  note: l.note ?? '',
});

function TripPage({ trip, onTrip }: { trip: Trip; onTrip: (t: Trip) => void }) {
  const t = useT();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const people = usePeople();
  const [places, setPlaces] = useState<Place[]>([]);
  const [home, setHome] = useState<Home | null>(null);
  const [legs, setLegs] = useState<Leg[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: LegDraft } | null>(null);
  const [editTrip, setEditTrip] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const points = useNamedPoints(places, home);
  const today = todayIso();

  useEffect(() => {
    let alive = true;
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => undefined);
    fetchLegs(trip.id)
      .then((l) => alive && setLegs(l))
      .catch(() => alive && setLegs([]));
    Promise.all([
      fetchBookings(trip.id).catch(() => []),
      fetchExpenseRows([trip.id]).catch(() => []),
      fetchListCounts('packing_items', [trip.id]).catch(() => ({})),
      fetchListCounts('pretrip_items', [trip.id]).catch(() => ({})),
      fetchListCounts('shopping_items', [trip.id]).catch(() => ({})),
    ]).then(([b, e, p, r, s]) => {
      if (!alive) return;
      const c = (x: Record<string, [number, number]>) => x[trip.id] ?? [0, 0];
      setCounts({ bookings: b.length, spentOre: spent(e).total, pack: c(p), pre: c(r), shop: c(s) });
    });
    return () => {
      alive = false;
    };
  }, [trip.id]);

  useEffect(() => {
    if (people.me) fetchHome(people.me).then(setHome).catch(() => undefined);
  }, [people.me]);

  const phase = tripPhase(trip, today);
  const cd = phase === 'kommande' ? countdown(trip.start_date, today) : null;
  const budgetTotal = Number(trip.budget?.total ?? 0);
  const placeLabel = tripPlace(places, trip);
  const playable = (legs ?? []).some((l) => l.from_lat != null && l.to_lat != null);

  const saveLeg = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !legs || busy) return;
    setBusy(true);
    try {
      if (editing.id) {
        const old = legs.find((l) => l.id === editing.id)!;
        const patch = toLeg(editing.draft, old.pos, points);
        await updateLeg(editing.id, patch);
        setLegs(legs.map((l) => (l.id === editing.id ? { ...l, ...patch } : l)));
      } else {
        const row = await addLeg(trip.id, toLeg(editing.draft, legs.length ? Math.max(...legs.map((l) => l.pos)) + 1 : 0, points));
        setLegs([...legs, row]);
      }
      setEditing(null);
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const removeLeg = async () => {
    if (!editing?.id || !legs || busy) return;
    setBusy(true);
    try {
      await deleteLeg(editing.id);
      setLegs(legs.filter((l) => l.id !== editing.id));
      setEditing(null);
      toast(t('allmant.borttaget'));
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const moveLeg = async (id: string, dir: -1 | 1) => {
    if (!legs || busy) return;
    const before = legs;
    const after = move(legs, id, dir);
    setLegs(after);
    try {
      await Promise.all(changedPos(before, after).map((l) => updateLeg(l.id, { pos: l.pos })));
    } catch (err) {
      setLegs(before);
      toast(saveError(t, err));
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteTrip(trip.id);
      toast(t('allmant.borttaget'));
      nav('/resor', { replace: true });
    } catch (err) {
      toast(saveError(t, err));
      setBusy(false);
    }
  };

  const sorted = [...(legs ?? [])].sort((a, b) => a.pos - b.pos);
  const progress = (c: [number, number]) => (c[1] ? t('marke.framsteg', { antal: c[0], totalt: c[1] }) : undefined);

  return (
    <main className="scr">
      <BackTo to="/resor" />
      <div className="hero">
        <span className="eb">{t(phase === 'avslutad' ? 'resor.avslutad' : phase === 'pagar' ? 'resor.pagar' : 'resor.kommande')}</span>
        <h1>{trip.title}</h1>
        {cd && <span className="big">{cd.key === 'resor.nedrakning' ? t(cd.key, { dagar: cd.dagar }) : t(cd.key)}</span>}
        <span className="hero-sub">{[placeLabel, formatRange(trip.start_date, trip.end_date)].filter(Boolean).join(' · ')}</span>
      </div>

      {playable && (
        <Link className="btn acc" to={`/karta?resa=${trip.id}`}>
          <Icon name="plane" size={20} />
          {t('resor.spela-upp')}
        </Link>
      )}

      <section className="col">
        <h2 className="eb">{t('resor.resplan')}</h2>
        {legs && !legs.length && (
          <div className="card soft">
            <p>{t('resor.etapper.tom')}</p>
          </div>
        )}
        {sorted.map((l, i) => (
          <div key={l.id} className="li">
            <span className="badge">{i + 1}</span>
            <button type="button" className="t" onClick={() => setEditing({ id: l.id, draft: toDraft(l) })}>
              <b>
                {l.from_text} – {l.to_text}
              </b>
              <span className="mu">
                {[t(`resor.etapp.lage.${l.mode}`), l.depart_at ? formatRange(l.depart_at.slice(0, 10), null) : '', l.note ?? ''].filter(Boolean).join(' · ')}
              </span>
            </button>
            <span className="moves">
              <button type="button" className="mini" disabled={i === 0} aria-label={`${t('resor.etapp.upp')}: ${l.from_text} – ${l.to_text}`} onClick={() => moveLeg(l.id, -1)}>
                <Icon name="up" size={18} />
              </button>
              <button
                type="button"
                className="mini"
                disabled={i === sorted.length - 1}
                aria-label={`${t('resor.etapp.ned')}: ${l.from_text} – ${l.to_text}`}
                onClick={() => moveLeg(l.id, 1)}
              >
                <Icon name="down" size={18} />
              </button>
            </span>
          </div>
        ))}
        <button type="button" className="btn ghost" onClick={() => setEditing({ id: null, draft: { ...emptyLeg(), from_text: sorted[sorted.length - 1]?.to_text ?? '' } })}>
          <Icon name="plus" size={20} />
          {t('resor.etapp.ny')}
        </button>
      </section>

      <section className="col">
        <Row
          to={`/resor/${trip.id}/kassa`}
          lead={<span className="badge">{currencySymbol('SEK')}</span>}
          title={t('kassa.rubrik')}
          sub={counts ? (budgetTotal ? `${formatOre(counts.spentOre)} / ${formatOre(budgetTotal * 100)}` : formatOre(counts.spentOre)) : undefined}
        />
        <Row to={`/resor/${trip.id}/bokningar`} icon="book" title={t('bokningar.rubrik')} sub={counts?.bookings ? String(counts.bookings) : undefined} />
        <Row to={`/resor/${trip.id}/pack`} icon="check" title={t('pack.rubrik')} sub={counts ? progress(counts.pack) : undefined} />
        <Row to={`/resor/${trip.id}/innan`} icon="star" title={t('innan.rubrik')} sub={counts ? progress(counts.pre) : undefined} />
        <Row to={`/resor/${trip.id}/inkop`} icon="heart" title={t('inkop.rubrik')} sub={counts ? progress(counts.shop) : undefined} />
        {trip.place_id && (
          <>
            <Row to={`/karta/${trip.place_id}`} lead={<Flag placeId={trip.place_id} />} title={placeLabel} sub={t('land.vy.guide')} />
            <Row to={`/karta/${trip.place_id}?vy=boka`} icon="build" title={t('land.vy.boka')} />
          </>
        )}
      </section>

      <div className="g2">
        <button type="button" className="btn ghost" onClick={() => setEditTrip(true)}>
          {t('knapp.andra')}
        </button>
        <button type="button" className="btn ghost" onClick={() => setAsking(true)}>
          {t('knapp.ta-bort')}
        </button>
      </div>

      <BottomSheet open={Boolean(editing)} title={editing?.id ? t('knapp.andra') : t('resor.etapp.ny')} onClose={() => setEditing(null)}>
        {editing && (
          <form className="col" onSubmit={saveLeg}>
            <LegFields value={editing.draft} points={points} onChange={(d) => setEditing({ ...editing, draft: d })} />
            <button type="submit" className="btn" disabled={busy}>
              {t('knapp.spara')}
            </button>
            {editing.id && (
              <button type="button" className="btn ghost" disabled={busy} onClick={removeLeg}>
                {t('knapp.ta-bort')}
              </button>
            )}
          </form>
        )}
      </BottomSheet>

      <EditTrip open={editTrip} trip={trip} onClose={() => setEditTrip(false)} onSaved={onTrip} />

      <BottomSheet open={asking} title={trip.title} onClose={() => setAsking(false)}>
        <p>{t('resor.ta-bort-fraga')}</p>
        <button type="button" className="btn" disabled={busy} onClick={remove}>
          {t('knapp.ta-bort')}
        </button>
        <button type="button" className="btn ghost" onClick={() => setAsking(false)}>
          {t('knapp.avbryt')}
        </button>
      </BottomSheet>
    </main>
  );
}

/** Ändra titel och datum. */
function EditTrip({ open, trip, onClose, onSaved }: { open: boolean; trip: Trip; onClose: () => void; onSaved: (t: Trip) => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const [title, setTitle] = useState(trip.title);
  const [start, setStart] = useState(trip.start_date ?? '');
  const [end, setEnd] = useState(trip.end_date ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(trip.title);
    setStart(trip.start_date ?? '');
    setEnd(trip.end_date ?? '');
  }, [open, trip]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fixedEnd = end && start && end < start ? start : end;
      onSaved(await updateTrip(trip.id, { title: title.trim() || trip.title, start_date: start || null, end_date: fixedEnd || null }));
      toast(t('allmant.sparat'));
      onClose();
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} title={t('knapp.andra')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <label>
          {t('falt.titel')}
          <input value={title} maxLength={60} required onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="g2">
          <label>
            {t('falt.fran-datum')}
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            {t('falt.till-datum')}
            <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn" disabled={busy}>
          {t('knapp.spara')}
        </button>
      </form>
    </BottomSheet>
  );
}
