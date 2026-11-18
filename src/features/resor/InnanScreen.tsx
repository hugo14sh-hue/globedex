// Innan avresa (pretrip_items): redigerbar checklista. Egna punkter läggs till och tas bort.
// Punkter som inte är egna (custom = false) döljs i stället (removed) och kan läggas tillbaka.
// Hämta förslag lägger till färdiga punkter ur content/_innan-avresa.json som saknas (samma titel läggs inte till igen).
// Listan sorteras på days_before, som slås upp i filen via titeln. Egna punkter hamnar sist.
// Är Valvet upplåst och passet går ut för nära resan visas valv.pass-gar-ut överst.
import { useEffect, useState, type FormEvent } from 'react';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { pretripSuggestions } from '../../lib/pretripContent';
import { daysBeforeFor, daysBeforeLabel, pretripMissing, sortPretrip, todayIso } from '../../lib/tripLogic';
import { addListRows, deleteListRow, fetchList, updateListRow, type PretripItem, type Trip } from '../../lib/trips';
import { useT } from '../../lib/useT';
import { useVault } from '../../lib/vault';
import { passExpiryWarning } from '../../lib/vaultLogic';
import { formatDate } from '../karta/format';
import { CheckRow } from './PackScreen';
import { Bar, saveError, SubHeader, TripGate, useTrip } from './shared';

export default function InnanScreen() {
  const state = useTrip();
  return <TripGate state={state}>{(trip) => <Innan trip={trip} />}</TripGate>;
}

function Innan({ trip }: { trip: Trip }) {
  const t = useT();
  const { toast, party } = useFeedback();
  const [list, setList] = useState<PretripItem[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchList<PretripItem>('pretrip_items', trip.id)
      .then((x) => alive && setList(x))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [trip.id]);

  const all = list ?? [];
  // Punkterna på valt språk. Titeln på båda språken hittar raden (och dess dag), oavsett språket den lades till på.
  const suggestions = pretripSuggestions();
  const rows = sortPretrip(
    all.filter((r) => !r.removed),
    suggestions,
  );
  const missing = pretripMissing(
    suggestions,
    all.map((r) => r.title),
  );
  const nextPos = () => (all.length ? Math.max(...all.map((r) => r.pos)) + 1 : 0);

  const sub = (r: PretripItem) => {
    const days = daysBeforeFor(suggestions, r.title);
    const when = days == null ? null : daysBeforeLabel(days);
    const label = when ? t(when.key, when.antal != null ? { antal: when.antal } : {}) : null;
    return [label, r.hint].filter(Boolean).join(' · ') || undefined;
  };

  const suggest = async () => {
    if (!list || !missing.length || busy) return;
    setBusy(true);
    try {
      const start = nextPos();
      const saved = await addListRows<PretripItem>(
        'pretrip_items',
        missing.map((s, i) => ({ trip_id: trip.id, title: s.title, hint: s.hint ?? null, custom: false, pos: start + i })),
      );
      setList([...all, ...saved]);
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };
  const hidden = all.filter((r) => r.removed);
  const done = rows.filter((r) => r.done).length;

  const patch = async (r: PretripItem, p: Partial<PretripItem>) => {
    const before = all;
    const next = all.map((x) => (x.id === r.id ? { ...x, ...p } : x));
    setList(next);
    try {
      await updateListRow('pretrip_items', r.id, p);
      if (p.done && next.filter((x) => !x.removed).every((x) => x.done)) party(t('innan.tom'));
    } catch (err) {
      setList(before);
      toast(saveError(t, err));
    }
  };

  const remove = async (r: PretripItem) => {
    if (!r.custom) return patch(r, { removed: true });
    try {
      await deleteListRow('pretrip_items', r.id);
      setList(all.filter((x) => x.id !== r.id));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const [saved] = await addListRows<PretripItem>('pretrip_items', [{ trip_id: trip.id, title: name, custom: true, pos: nextPos() }]);
      setList([...all, saved]);
      setTitle('');
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="scr">
      <SubHeader trip={trip} title={t('innan.rubrik')} />
      <PassWarning trip={trip} />
      {list && rows.length > 0 && (
        <div className="card">
          <b>{t('marke.framsteg', { antal: done, totalt: rows.length })}</b>
          <Bar pct={(done / rows.length) * 100} />
        </div>
      )}
      {list && (rows.length === 0 || done === rows.length) && (
        <div className="card soft">
          <p>{t('innan.tom')}</p>
        </div>
      )}
      {rows.map((r) => (
        <CheckRow key={r.id} title={r.title} sub={sub(r)} on={r.done} onToggle={() => patch(r, { done: !r.done })} onRemove={() => remove(r)} />
      ))}

      <form className="row" onSubmit={add}>
        <label style={{ flex: 1 }}>
          {t('falt.titel')}
          <input value={title} maxLength={60} required onChange={(e) => setTitle(e.target.value)} />
        </label>
        <button type="submit" className="chip" disabled={busy} aria-label={t('knapp.lagg-till')}>
          <Icon name="plus" size={20} />
        </button>
      </form>

      <button type="button" className="btn ghost" disabled={busy || !list || !missing.length} onClick={suggest}>
        {t('innan.forslag')}
      </button>

      {hidden.length > 0 && (
        <div className="chips">
          {hidden.map((r) => (
            <button key={r.id} type="button" className="chip" onClick={() => patch(r, { removed: false })}>
              <Icon name="plus" size={16} />
              {r.title}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

/** Varning om passets giltighet, ur Valvet. Bara när Valvet är upplåst. */
function PassWarning({ trip }: { trip: Trip }) {
  const t = useT();
  const vault = useVault();
  if (vault.state !== 'oppen') return null;
  const warn = passExpiryWarning(vault.entries, todayIso(), [trip.end_date ?? trip.start_date]);
  if (!warn) return null;
  return (
    <div className="card soft" role="status">
      <b>{t('valv.pass-gar-ut', { datum: formatDate(warn) })}</b>
    </div>
  );
}
