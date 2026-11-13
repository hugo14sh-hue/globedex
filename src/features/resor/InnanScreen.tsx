// Innan avresa (pretrip_items): redigerbar checklista. Egna punkter läggs till och tas bort.
// Punkter som inte är egna (custom = false) döljs i stället (removed) och kan läggas tillbaka.
// Reglerna för dig (ålder och hälsa ur Valvet) kommer i Körning 6.
import { useEffect, useState, type FormEvent } from 'react';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { addListRows, deleteListRow, fetchList, updateListRow, type PretripItem, type Trip } from '../../lib/trips';
import { useT } from '../../lib/useT';
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
  const rows = all.filter((r) => !r.removed);
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
      const pos = all.length ? Math.max(...all.map((r) => r.pos)) + 1 : 0;
      const [saved] = await addListRows<PretripItem>('pretrip_items', [{ trip_id: trip.id, title: name, custom: true, pos }]);
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
        <CheckRow key={r.id} title={r.title} sub={r.hint ?? undefined} on={r.done} onToggle={() => patch(r, { done: !r.done })} onRemove={() => remove(r)} />
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
