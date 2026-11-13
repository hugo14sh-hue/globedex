// Min guide eller Vår guide (reviews): egna betyg och anteckningar per ställe, sökbar.
// Synligheten är privat eller grupp. Offentlig finns i tabellen men erbjuds inte.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/Loading';
import { Row } from '../../components/Row';
import { Segment } from '../../components/Segment';
import { fetchPlaces, placeName, type Place } from '../../lib/content';
import {
  addReview,
  deleteReview,
  fetchReviews,
  REVIEW_VISIBILITY,
  searchReviews,
  updateReview,
  type Review,
  type ReviewInput,
  type ReviewVisibility,
} from '../../lib/reviews';
import { useSession, useTravelMode } from '../../lib/session';
import { useMyPlaces } from '../../lib/status';
import { useT } from '../../lib/useT';
import { PlaceSelect } from '../listor/PlaceSelect';

export default function GuideScreen() {
  const t = useT();
  const { session, activeGroup } = useSession();
  const mode = useTravelMode();
  const me = session?.user.id ?? '';
  const gid = activeGroup?.id ?? '';
  const [rows, setRows] = useState<Review[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Review | 'ny' | null>(null);

  useEffect(() => {
    if (!gid || !me) return;
    let alive = true;
    fetchReviews(gid, me)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true));
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [gid, me]);

  const name = (id: string) => placeName(places, id);
  const shown = useMemo(() => searchReviews(rows ?? [], q, (id) => placeName(places, id)), [rows, q, places]);
  const title = t(mode === 'solo' ? 'vi.guide.jag' : 'vi.guide.vi');

  return (
    <main className="scr">
      <Link className="back" to="/vi">
        <Icon name="back" size={20} />
        {t('knapp.tillbaka')}
      </Link>
      <h1>{title}</h1>
      <button type="button" className="btn" onClick={() => setEdit('ny')}>
        <Icon name="plus" size={20} />
        {t('guide.ny')}
      </button>
      {failed && (
        <div className="card soft">
          <p>{t('allmant.fel')}</p>
        </div>
      )}
      {!rows && !failed && <Loading />}
      {rows && rows.length === 0 && (
        <div className="card soft">
          <p>{t('vi.guide.tom')}</p>
        </div>
      )}
      {rows && rows.length > 0 && (
        <>
          <label>
            {t('guide.sok')}
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="col">
            {shown.map((r) => (
              <Row
                key={r.id}
                title={r.name}
                sub={[r.place_id ? name(r.place_id) : '', r.note ?? ''].filter(Boolean).join(' · ') || undefined}
                right={r.rating != null ? <span className="chip soft">{t('guide.betyg-av', { antal: r.rating })}</span> : undefined}
                onClick={() => setEdit(r)}
              />
            ))}
          </div>
        </>
      )}
      <BottomSheet open={edit !== null} title={edit === 'ny' ? t('guide.ny') : (edit?.name ?? '')} onClose={() => setEdit(null)}>
        {edit && (
          <ReviewForm
            key={edit === 'ny' ? 'ny' : edit.id}
            review={edit === 'ny' ? null : edit}
            places={places}
            solo={mode === 'solo'}
            canDelete={edit !== 'ny'}
            onSaved={(r) => {
              setRows((l) => (l?.some((x) => x.id === r.id) ? l.map((x) => (x.id === r.id ? r : x)) : [r, ...(l ?? [])]));
              setEdit(null);
            }}
            onDeleted={(id) => {
              setRows((l) => (l ?? []).filter((x) => x.id !== id));
              setEdit(null);
            }}
          />
        )}
      </BottomSheet>
    </main>
  );
}

function ReviewForm({
  review,
  places,
  solo,
  canDelete,
  onSaved,
  onDeleted,
}: {
  review: Review | null;
  places: Place[];
  solo: boolean;
  canDelete: boolean;
  onSaved: (r: Review) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useT();
  const { toast } = useFeedback();
  const { session, activeGroup } = useSession();
  const me = session?.user.id ?? '';
  const mine = useMyPlaces(me || null);
  const [name, setName] = useState(review?.name ?? '');
  const [place, setPlace] = useState(review?.place_id ?? '');
  const [rating, setRating] = useState(review?.rating != null ? String(review.rating) : '');
  const [note, setNote] = useState(review?.note ?? '');
  const [vis, setVis] = useState<ReviewVisibility>(review?.visibility === 'privat' ? 'privat' : solo && !review ? 'privat' : 'grupp');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const extra = useMemo(() => Object.keys(mine.statuses), [mine.statuses]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy || !activeGroup) return;
    setBusy(true);
    const input: ReviewInput = { name: n, place_id: place || null, rating: rating ? Number(rating) : null, note: note.trim() || null, visibility: vis };
    try {
      const saved = review ? await updateReview(review.id, input) : await addReview(activeGroup.id, me, input);
      toast(t('allmant.sparat'));
      onSaved(saved);
    } catch {
      toast(t('allmant.fel-spara'));
      setBusy(false);
    }
  };

  const del = async () => {
    if (!review || busy) return;
    setBusy(true);
    try {
      await deleteReview(review.id);
      toast(t('allmant.borttaget'));
      onDeleted(review.id);
    } catch {
      toast(t('allmant.fel'));
      setBusy(false);
    }
  };

  return (
    <form className="col" onSubmit={save}>
      <label>
        {t('guide.namn')}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </label>
      <PlaceSelect label={t('falt.plats')} places={places} extra={extra} value={place} onChange={setPlace} optional />
      <label>
        {t('guide.betyg')}
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="" />
          {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
            <option key={n} value={n}>
              {t('guide.betyg-av', { antal: n })}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('falt.anteckning')}
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </label>
      {!solo && (
        <Segment<ReviewVisibility>
          label={t('guide.synlighet')}
          value={vis}
          onChange={setVis}
          options={REVIEW_VISIBILITY.map((v) => ({ value: v, label: t(`guide.synlighet.${v}`) }))}
        />
      )}
      <button type="submit" className="btn" disabled={busy || !name.trim()}>
        {t('knapp.spara')}
      </button>
      {review &&
        canDelete &&
        (confirmDel ? (
          <div className="card soft">
            <p>{t('allmant.ta-bort-fraga', { namn: review.name })}</p>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>
                {t('knapp.avbryt')}
              </button>
              <button type="button" className="btn" onClick={del} disabled={busy}>
                {t('knapp.ta-bort')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn ghost" onClick={() => setConfirmDel(true)}>
            {t('knapp.ta-bort')}
          </button>
        ))}
    </form>
  );
}
