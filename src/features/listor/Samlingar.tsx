// Samlingar: egna samlingar (till exempel kaffemuggar) med plats, datum och anteckning per föremål.
// CollectionMotifs visar motivförslag ur gift_tips.collection_motifs på en plats.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import { fetchPlaces, placeName, type GiftTip, type Place } from '../../lib/content';
import { motifsFor, percent } from '../../lib/listLogic';
import { addCollection, deleteCollection, deleteEntry, fetchCollections, saveEntry, type Collection, type CollectionEntry } from '../../lib/listor';
import { useSession } from '../../lib/session';
import { useMyPlaces } from '../../lib/status';
import { useT } from '../../lib/useT';
import { formatDate } from '../karta/format';
import { PlaceSelect } from './PlaceSelect';
import { LOCALE } from '../../lib/locale';

const today = () => new Date().toISOString().slice(0, 10);
const VISITED = new Set(['bor', 'bott', 'besokt']);

/** Användarens samlingar. Hämtas om efter varje ändring. */
export function useCollections() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [list, setList] = useState<Collection[] | null>(null);
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setList(await fetchCollections(userId));
    } catch {
      setList((l) => l ?? []);
    }
  }, [userId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { userId, list, reload };
}

export function Samlingar() {
  const t = useT();
  const { toast, party } = useFeedback();
  const { userId, list, reload } = useCollections();
  const mine = useMyPlaces(userId);
  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<{ collection: Collection; e: CollectionEntry; isNew: boolean } | null>(null);
  const [remove, setRemove] = useState<Collection | null>(null);

  useEffect(() => {
    fetchPlaces()
      .then(setPlaces)
      .catch(() => undefined);
  }, []);

  // Länder man har varit i, för räknaren per samling.
  const visited = useMemo(
    () => Object.entries(mine.statuses).filter(([id, s]) => /^[A-Z]{2}$/.test(id) && VISITED.has(s)).length,
    [mine.statuses],
  );

  const create = async (ev: FormEvent) => {
    ev.preventDefault();
    const n = name.trim();
    if (!n) return setError(t('allmant.obligatoriskt', { falt: t('samlingar.ny').toLocaleLowerCase(LOCALE) }));
    if (!userId) return;
    try {
      await addCollection(userId, n);
      setName('');
      setError('');
      toast(t('allmant.sparat'));
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const save = async () => {
    if (!entry) return;
    try {
      await saveEntry(entry.e);
      setEntry(null);
      if (entry.isNew) party(t('allmant.sparat'));
      else toast(t('allmant.sparat'));
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const drop = async (c: Collection, placeId: string) => {
    try {
      await deleteEntry(c.id, placeId);
      setEntry(null);
      toast(t('allmant.borttaget'));
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const dropCollection = async () => {
    if (!remove) return;
    try {
      await deleteCollection(remove.id);
      setRemove(null);
      toast(t('allmant.borttaget'));
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  if (!list) return null;

  return (
    <>
      {list.length === 0 && (
        <div className="card soft">
          <p>{t('samlingar.tom')}</p>
        </div>
      )}

      {list.map((c) => (
        <section key={c.id} className="card" aria-label={c.name}>
          <div className="row">
            <h3>{c.name}</h3>
            <button type="button" className="chip" aria-label={`${t('knapp.ta-bort')}: ${c.name}`} onClick={() => setRemove(c)}>
              {t('knapp.ta-bort')}
            </button>
          </div>
          {visited > 0 && (
            <>
              <span className="mu">{t('marke.framsteg', { antal: c.entries.length, totalt: visited })}</span>
              <div className="bar" aria-hidden="true">
                <i style={{ width: `${percent(c.entries.length, visited)}%` }} />
              </div>
            </>
          )}
          {c.entries.map((e) => (
            <Row
              key={e.place_id}
              icon="pin"
              title={placeName(places, e.place_id)}
              sub={[formatDate(e.got_on), e.note].filter(Boolean).join(' · ')}
              onClick={() => setEntry({ collection: c, e: { ...e }, isNew: false })}
            />
          ))}
          <button
            type="button"
            className="btn ghost"
            onClick={() => setEntry({ collection: c, e: { collection_id: c.id, place_id: '', got_on: today(), note: '' }, isNew: true })}
          >
            <Icon name="plus" size={20} />
            {t('samlingar.ny-post')}
          </button>
        </section>
      ))}

      <form className="card" onSubmit={create} noValidate>
        <label>
          {t('samlingar.ny')}
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(error)} />
        </label>
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
        <button type="submit" className="btn">
          <Icon name="plus" size={20} />
          {t('knapp.lagg-till')}
        </button>
      </form>

      <BottomSheet open={Boolean(entry)} title={entry?.collection.name ?? ''} onClose={() => setEntry(null)}>
        {entry && (
          <>
            {entry.isNew ? (
              <PlaceSelect
                label={t('falt.plats')}
                places={places}
                extra={Object.keys(mine.statuses)}
                value={entry.e.place_id}
                onChange={(v) => setEntry({ ...entry, e: { ...entry.e, place_id: v } })}
              />
            ) : (
              <b>{placeName(places, entry.e.place_id)}</b>
            )}
            <label>
              {t('falt.datum')}
              <input type="date" value={entry.e.got_on} max={today()} onChange={(e) => setEntry({ ...entry, e: { ...entry.e, got_on: e.target.value } })} />
            </label>
            <label>
              {t('falt.anteckning')}
              <input value={entry.e.note ?? ''} maxLength={200} onChange={(e) => setEntry({ ...entry, e: { ...entry.e, note: e.target.value } })} />
            </label>
            <button type="button" className="btn" disabled={!entry.e.place_id || !entry.e.got_on} onClick={save}>
              {t('knapp.spara')}
            </button>
            {!entry.isNew && (
              <button type="button" className="btn ghost" onClick={() => drop(entry.collection, entry.e.place_id)}>
                {t('knapp.ta-bort')}
              </button>
            )}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(remove)} title={remove?.name ?? ''} onClose={() => setRemove(null)}>
        {remove && (
          <>
            <p>{t('allmant.ta-bort-fraga', { namn: remove.name })}</p>
            <button type="button" className="btn" onClick={dropCollection}>
              {t('knapp.ta-bort')}
            </button>
            <button type="button" className="btn ghost" onClick={() => setRemove(null)}>
              {t('knapp.avbryt')}
            </button>
          </>
        )}
      </BottomSheet>
    </>
  );
}

/** På en plats: motivförslag ur presenttipsen för användarens samlingar, och knapp för att lägga till platsen. */
export function CollectionMotifs({ placeId, gifts }: { placeId: string; gifts: GiftTip[] }) {
  const t = useT();
  const { party, toast } = useFeedback();
  const { list, reload } = useCollections();
  const rows = (list ?? []).map((c) => ({ c, motifs: motifsFor(gifts, c.name) })).filter((r) => r.motifs.length);
  if (!rows.length) return null;

  const add = async (c: Collection) => {
    try {
      await saveEntry({ collection_id: c.id, place_id: placeId, got_on: today(), note: null });
      party(t('allmant.sparat'));
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  return (
    <section className="col">
      <h2 className="eb">{t('listor.vy.samlingar')}</h2>
      {rows.map(({ c, motifs }) => {
        const has = c.entries.some((e) => e.place_id === placeId);
        return (
          <div key={c.id} className="card">
            <h3>{c.name}</h3>
            {motifs.map((m) => (
              <span key={m.gift + m.text}>
                <b>{m.gift}</b>
                <span className="mu"> · {m.text}</span>
              </span>
            ))}
            {has ? (
              <span className="chip soft tag" style={{ alignSelf: 'flex-start' }}>
                <Icon name="check" size={16} stroke={3} />
                {t('allmant.sparat')}
              </span>
            ) : (
              <button type="button" className="btn ghost" onClick={() => add(c)}>
                <Icon name="plus" size={20} />
                {t('samlingar.ny-post')}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
