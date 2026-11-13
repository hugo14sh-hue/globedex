// Packlista (packing_items): egna rader, rader bara för mig (private) och allmänna förslag ur content/.
// Privata rader syns bara för ägaren (RLS i databasen).
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { PACK_SUGGESTIONS } from '../../lib/packContent';
import { nights, packFor } from '../../lib/tripLogic';
import { addListRows, deleteListRow, fetchList, updateListRow, type PackItem, type Trip } from '../../lib/trips';
import { useT } from '../../lib/useT';
import { Bar, saveError, SubHeader, TripGate, usePeople, useTrip } from './shared';

export default function PackScreen() {
  const state = useTrip();
  return <TripGate state={state}>{(trip) => <Pack trip={trip} />}</TripGate>;
}

function Pack({ trip }: { trip: Trip }) {
  const t = useT();
  const { toast, party } = useFeedback();
  const people = usePeople();
  const [list, setList] = useState<PackItem[] | null>(null);
  const [title, setTitle] = useState('');
  const [grp, setGrp] = useState('');
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchList<PackItem>('packing_items', trip.id)
      .then((x) => alive && setList(x))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [trip.id]);

  const rows = useMemo(() => list ?? [], [list]);
  const groups = useMemo(() => [...new Set(rows.map((r) => r.grp))], [rows]);
  const packed = rows.filter((r) => r.packed).length;
  const month = trip.start_date ? Number(trip.start_date.slice(5, 7)) - 1 : null;
  const suggestions = packFor(PACK_SUGGESTIONS, nights(trip.start_date, trip.end_date), month, rows.map((r) => r.title));
  const nextPos = () => (rows.length ? Math.max(...rows.map((r) => r.pos)) + 1 : 0);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const row: Record<string, unknown> = { trip_id: trip.id, title: name, pos: nextPos(), private: priv, owner: priv ? people.me : null };
      if (grp.trim()) row.grp = grp.trim();
      const [saved] = await addListRows<PackItem>('packing_items', [row]);
      setList([...rows, saved]);
      setTitle('');
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    if (!suggestions.length || busy) return;
    setBusy(true);
    try {
      const start = nextPos();
      const saved = await addListRows<PackItem>(
        'packing_items',
        suggestions.map((s, i) => ({ trip_id: trip.id, title: s.title, grp: s.group, pos: start + i })),
      );
      setList([...rows, ...saved]);
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r: PackItem) => {
    const next = rows.map((x) => (x.id === r.id ? { ...x, packed: !x.packed } : x));
    setList(next);
    try {
      await updateListRow('packing_items', r.id, { packed: !r.packed });
      if (!r.packed && next.every((x) => x.packed)) party(t('pack.klar'));
    } catch (err) {
      setList(rows);
      toast(saveError(t, err));
    }
  };

  const remove = async (r: PackItem) => {
    try {
      await deleteListRow('packing_items', r.id);
      setList(rows.filter((x) => x.id !== r.id));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  return (
    <main className="scr">
      <SubHeader trip={trip} title={t('pack.rubrik')} />
      {list && rows.length > 0 && (
        <div className="card">
          <b>{t('marke.framsteg', { antal: packed, totalt: rows.length })}</b>
          <Bar pct={(packed / rows.length) * 100} />
        </div>
      )}
      {list && !rows.length && (
        <div className="card soft">
          <p>{t('pack.tom')}</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g} className="col">
          <h2 className="eb">{g}</h2>
          {rows
            .filter((r) => r.grp === g)
            .map((r) => (
              <CheckRow key={r.id} title={r.title} on={r.packed} sub={r.private ? t('pack.privat') : undefined} onToggle={() => toggle(r)} onRemove={() => remove(r)} />
            ))}
        </section>
      ))}

      {/* Körning 6: rader från hälsa och födelsedatum i Valvet läggs till här som privata rader
          (packing_items.private = true, owner = jag) och räknas med texten pack.fran-valvet. */}

      <form className="card" onSubmit={add}>
        <label>
          {t('falt.titel')}
          <input value={title} maxLength={60} required onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          {t('pack.grupp')}
          <input value={grp} maxLength={30} list="pack-grupper" onChange={(e) => setGrp(e.target.value)} />
          <datalist id="pack-grupper">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="check">
          <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} />
          {t('pack.privat')}
        </label>
        <button type="submit" className="btn" disabled={busy}>
          <Icon name="plus" size={20} />
          {t('knapp.lagg-till')}
        </button>
      </form>

      <button type="button" className="btn ghost" disabled={busy || !suggestions.length} onClick={suggest}>
        {t('pack.forslag')}
      </button>
    </main>
  );
}

/** Rad med kryssruta, titel och ta bort. Delas av packlistan, innan avresa och inköpslistan. */
export function CheckRow({ title, sub, on, onToggle, onRemove }: { title: string; sub?: string; on: boolean; onToggle: () => void; onRemove: () => void }) {
  const t = useT();
  return (
    <div className="li">
      <button type="button" className={`box${on ? ' on' : ''}`} aria-pressed={on} aria-label={sub ? `${title}, ${sub}` : title} onClick={onToggle}>
        {on && <Icon name="check" size={16} stroke={3} />}
      </button>
      <button type="button" className="t" onClick={onToggle} tabIndex={-1} aria-hidden="true">
        <b className={on ? 'done' : ''}>{title}</b>
        {sub && <span className="mu">{sub}</span>}
      </button>
      <button type="button" className="mini" aria-label={`${t('knapp.ta-bort')}: ${title}`} onClick={onRemove}>
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
