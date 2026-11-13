// Bokningar (bookings): typ, titel, datum, bokningsnummer, länk och anteckning. Fungerar utan fil.
// Filuppladdning slås på först när den privata bucketen finns i Supabase Storage (SQL-blocket från Körning 4).
import { useEffect, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import {
  addBooking,
  BOOKING_KINDS,
  bookingFileUrl,
  deleteBooking,
  fetchBookings,
  hasBookingFiles,
  removeBookingFile,
  updateBooking,
  uploadBookingFile,
  type Booking,
  type NewBooking,
  type Trip,
} from '../../lib/trips';
import { useT } from '../../lib/useT';
import { formatRange, saveError, SubHeader, TripGate, useTrip } from './shared';

/** Äldre typer i databasen visas som de nya. */
const LEGACY: Record<string, string> = { tag: 'transport', hyrbil: 'transport', biljett: 'aktivitet' };
const kindKey = (k: string) => `bokningar.typ.${LEGACY[k] ?? k}`;

const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);

interface Draft {
  kind: string;
  title: string;
  start: string;
  end: string;
  reference: string;
  url: string;
  note: string;
  file: File | null;
}

const empty: Draft = { kind: 'flyg', title: '', start: '', end: '', reference: '', url: '', note: '', file: null };

const toDraft = (b: Booking): Draft => ({
  kind: LEGACY[b.kind] ?? b.kind,
  title: b.title,
  start: b.starts_at?.slice(0, 10) ?? '',
  end: b.ends_at?.slice(0, 10) ?? '',
  reference: b.reference ?? '',
  url: b.url ?? '',
  note: b.note ?? '',
  file: null,
});

export default function BokningarScreen() {
  const state = useTrip();
  return <TripGate state={state}>{(trip) => <Bokningar trip={trip} />}</TripGate>;
}

function Bokningar({ trip }: { trip: Trip }) {
  const t = useT();
  const { toast } = useFeedback();
  const [list, setList] = useState<Booking[] | null>(null);
  const [files, setFiles] = useState(false);
  const [open, setOpen] = useState<Booking | null>(null);
  const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchBookings(trip.id)
      .then((x) => alive && setList(x))
      .catch(() => alive && setList([]));
    hasBookingFiles().then((ok) => alive && setFiles(ok));
    return () => {
      alive = false;
    };
  }, [trip.id]);

  const rows = list ?? [];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    const d = form.draft;
    const old = form.id ? rows.find((b) => b.id === form.id) : undefined;
    let uploaded: string | null = null;
    try {
      if (d.file && files) uploaded = await uploadBookingFile(trip.id, d.file);
      const row: NewBooking = {
        kind: d.kind,
        title: d.title.trim(),
        reference: d.reference.trim() || null,
        starts_at: d.start ? `${d.start}T00:00:00Z` : null,
        ends_at: d.end ? `${d.end}T00:00:00Z` : null,
        address: old?.address ?? null,
        url: d.url.trim() || null,
        file_path: uploaded ?? old?.file_path ?? null,
        note: d.note.trim() || null,
      };
      if (old) {
        await updateBooking(old.id, row, Boolean(old.url));
        if (uploaded && old.file_path) await removeBookingFile(old.file_path);
      } else {
        await addBooking(trip.id, row);
      }
      setList(await fetchBookings(trip.id));
      setForm(null);
      setOpen(null);
      toast(t('allmant.sparat'));
    } catch (err) {
      if (uploaded) await removeBookingFile(uploaded);
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: Booking) => {
    try {
      await deleteBooking(b.id);
      if (b.file_path) await removeBookingFile(b.file_path);
      setList(rows.filter((x) => x.id !== b.id));
      setOpen(null);
      toast(t('allmant.borttaget'));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  const openFile = async (path: string) => {
    // Fönstret öppnas direkt vid trycket, annars stoppas det av webbläsaren.
    const w = window.open('', '_blank');
    if (w) w.opener = null;
    try {
      const url = await bookingFileUrl(path);
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch {
      w?.close();
      toast(t('allmant.fel'));
    }
  };

  return (
    <main className="scr">
      <SubHeader trip={trip} title={t('bokningar.rubrik')} />
      {list && !rows.length && (
        <div className="card soft">
          <p>{t('bokningar.tom')}</p>
        </div>
      )}
      {rows.map((b) => (
        <Row
          key={b.id}
          icon={b.file_path ? 'file' : 'book'}
          title={b.title}
          sub={[t(kindKey(b.kind)), formatRange(b.starts_at, b.ends_at), b.reference ?? ''].filter(Boolean).join(' · ')}
          onClick={() => setOpen(b)}
        />
      ))}
      <button type="button" className="btn" onClick={() => setForm({ id: null, draft: empty })}>
        <Icon name="plus" size={20} />
        {t('bokningar.ny')}
      </button>

      <BottomSheet open={Boolean(open) && !form} title={open?.title ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            <span className="mu">{[t(kindKey(open.kind)), formatRange(open.starts_at, open.ends_at)].filter(Boolean).join(' · ')}</span>
            {open.reference && (
              <div className="col" style={{ gap: 2 }}>
                <span className="eb">{t('bokningar.referens')}</span>
                <b className="code">{open.reference}</b>
              </div>
            )}
            {open.note && <p>{open.note}</p>}
            {safeUrl(open.url) && (
              <a className="btn ghost" href={safeUrl(open.url)!} target="_blank" rel="noopener noreferrer">
                {t('bokningar.lank')}
              </a>
            )}
            {open.file_path && files && (
              <button type="button" className="btn ghost" onClick={() => openFile(open.file_path!)}>
                <Icon name="file" size={20} />
                {t('bokningar.fil-oppna')}
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => setForm({ id: open.id, draft: toDraft(open) })}>
              {t('knapp.andra')}
            </button>
            <button type="button" className="btn ghost" onClick={() => remove(open)}>
              {t('knapp.ta-bort')}
            </button>
          </>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(form)} title={form?.id ? t('knapp.andra') : t('bokningar.ny')} onClose={() => setForm(null)}>
        {form && (
          <BookingForm draft={form.draft} files={files} busy={busy} onChange={(draft) => setForm({ ...form, draft })} onSubmit={save} />
        )}
      </BottomSheet>
    </main>
  );
}

function BookingForm({
  draft,
  files,
  busy,
  onChange,
  onSubmit,
}: {
  draft: Draft;
  files: boolean;
  busy: boolean;
  onChange: (d: Draft) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const t = useT();
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p });
  return (
    <form className="col" onSubmit={onSubmit}>
      <label>
        {t('boka.typ')}
        <select value={draft.kind} onChange={(e) => set({ kind: e.target.value })}>
          {BOOKING_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`bokningar.typ.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('falt.titel')}
        <input value={draft.title} required maxLength={80} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="g2">
        <label>
          {t('falt.fran-datum')}
          <input type="date" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
        </label>
        <label>
          {t('falt.till-datum')}
          <input type="date" value={draft.end} min={draft.start || undefined} onChange={(e) => set({ end: e.target.value })} />
        </label>
      </div>
      <label>
        {t('bokningar.referens')}
        <input value={draft.reference} maxLength={60} autoComplete="off" onChange={(e) => set({ reference: e.target.value })} />
      </label>
      <label>
        {t('bokningar.lank')}
        <input type="url" inputMode="url" value={draft.url} maxLength={500} placeholder="https://" onChange={(e) => set({ url: e.target.value })} />
      </label>
      <label>
        {t('falt.anteckning')}
        <textarea rows={2} maxLength={400} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
      </label>
      {files && (
        <label>
          {t('bokningar.fil')}
          <input type="file" accept="application/pdf,image/*" onChange={(e) => set({ file: e.target.files?.[0] ?? null })} />
        </label>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {t('knapp.spara')}
      </button>
    </form>
  );
}
