// Bucketlist: gruppens lista (bucket_items) med egna punkter och punkter ur bucket_catalog.
// Avbockning med datum och valfri plats. Katalogen filtreras på kategori och kostnad.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import {
  BUCKET_CATEGORIES,
  COST_LEVELS,
  fetchBucketCatalog,
  fetchPlaces,
  placeName,
  type BucketCatalogItem,
  type CostLevel,
  type Place,
} from '../../lib/content';
import { bucketPlaces, filterCatalog, onList, percent, sortBucket, type BucketItem } from '../../lib/listLogic';
import { addBucketItem, deleteBucketItem, fetchBucketItems, setBucketDone, setBucketParts } from '../../lib/listor';
import { addedPart, allPartsDone, bucketParts, parseChecklist, toggledParts, type PartsView } from '../../lib/bucketParts';
import { useUrlParam } from '../../lib/navMemory';
import { BucketParts } from './BucketParts';
import { useSession } from '../../lib/session';
import { useMyPlaces } from '../../lib/status';
import { useT } from '../../lib/useT';
import { formatDate } from '../karta/format';
import { PlaceSelect } from './PlaceSelect';

const today = () => new Date().toISOString().slice(0, 10);

/** Gruppens bucketlist. Delas av Bucketlist och Swipe (solo lägger ja direkt på listan). */
export function useBucket() {
  const { session, profile } = useSession();
  const groupId = profile?.active_group_id ?? null;
  const userId = session?.user.id ?? null;
  const [items, setItems] = useState<BucketItem[] | null>(null);
  const reload = useCallback(async () => {
    if (!groupId) return;
    try {
      setItems(await fetchBucketItems(groupId));
    } catch {
      setItems((x) => x ?? []);
    }
  }, [groupId]);
  useEffect(() => {
    setItems(null);
    void reload();
  }, [reload]);

  /** Lägger till på listan om punkten inte redan finns där. */
  const add = useCallback(
    async (row: { title: string; catalog_id?: string | null; category?: string | null; place_id?: string | null }) => {
      if (!groupId || !userId) throw new Error('Ingen grupp');
      const fresh = await fetchBucketItems(groupId);
      const dup = row.catalog_id ? onList(fresh, row.catalog_id) : fresh.some((i) => !i.catalog_id && i.title === row.title);
      if (!dup) await addBucketItem({ ...row, group_id: groupId, created_by: userId });
      await reload();
      return !dup;
    },
    [groupId, userId, reload],
  );
  return { items, reload, add };
}

export function Bucketlist() {
  const t = useT();
  const { toast, party } = useFeedback();
  const { session } = useSession();
  const mine = useMyPlaces(session?.user.id ?? null);
  const { items, reload, add } = useBucket();
  const [catalog, setCatalog] = useState<BucketCatalogItem[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  // Öppen punkt, katalogen och filtren står i adressen, så att de finns kvar när man går tillbaka hit.
  const [openId, setOpenId] = useUrlParam('punkt');
  const [catalogParam, setCatalogParam] = useUrlParam('katalog');
  const [fCatParam, setFCat] = useUrlParam('kat');
  const [fCostParam, setFCostParam] = useUrlParam('kostnad');
  const [partsBusy, setPartsBusy] = useState(false);
  const [checking, setChecking] = useState<{ item: BucketItem; date: string; place: string } | null>(null);
  const [remove, setRemove] = useState<BucketItem | null>(null);
  const [own, setOwn] = useState<string | null>(null);
  const [ownError, setOwnError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchBucketCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => undefined);
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const list = useMemo(() => sortBucket(items ?? []), [items]);
  const open = (openId && list.find((i) => i.id === openId)) || null;
  const setOpen = (b: BucketItem | null) => setOpenId(b?.id ?? null);
  const showCatalog = catalogParam === '1';
  const setShowCatalog = (v: boolean) => setCatalogParam(v ? '1' : null);
  const fCat = fCatParam;
  const fCost = (COST_LEVELS as string[]).includes(fCostParam ?? '') ? (fCostParam as CostLevel) : null;
  const setFCost = (c: CostLevel | null) => setFCostParam(c);

  // Delmål per punkt: ur katalogens checklist, kartans status och parts.
  const partsCtx = useMemo(() => ({ places, statuses: mine.statuses, name: (id: string) => placeName(places, id) }), [places, mine.statuses]);
  const partsOf = useCallback(
    (b: BucketItem): PartsView | null => bucketParts(parseChecklist(b.catalog_id ? byId.get(b.catalog_id)?.checklist : null), b.parts, partsCtx),
    [byId, partsCtx],
  );

  const saveParts = async (b: BucketItem, next: ReturnType<typeof toggledParts>) => {
    setPartsBusy(true);
    try {
      await setBucketParts(b.id, next);
      await reload();
      return true;
    } catch {
      toast(t('allmant.fel-spara'));
      return false;
    } finally {
      setPartsBusy(false);
    }
  };
  const done = list.filter((i) => i.done_on).length;
  const filtered = useMemo(() => filterCatalog(catalog, fCat, fCost), [catalog, fCat, fCost]);

  const startCheck = (item: BucketItem) => {
    setOpen(null);
    const first = bucketPlaces(item, item.catalog_id ? byId.get(item.catalog_id) : undefined)[0] ?? '';
    setChecking({ item, date: today(), place: first });
  };

  const confirmCheck = async () => {
    if (!checking) return;
    try {
      await setBucketDone(checking.item.id, checking.date, checking.place || null);
      party(t('bucket.klar', { namn: checking.item.title }));
      setChecking(null);
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const undo = async (item: BucketItem) => {
    try {
      await setBucketDone(item.id, null, null);
      toast(t('allmant.angrat'));
      setOpen(null);
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const drop = async () => {
    if (!remove) return;
    try {
      await deleteBucketItem(remove.id);
      setRemove(null);
      toast(t('allmant.borttaget'));
      await reload();
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const addFromCatalog = async (c: BucketCatalogItem) => {
    try {
      await add({ title: c.name, catalog_id: c.id, category: c.category });
      toast(t('bucket.tillagd'));
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const addOwn = async (e: FormEvent) => {
    e.preventDefault();
    const title = (own ?? '').trim();
    if (!title) return setOwnError(t('allmant.obligatoriskt', { falt: t('bucket.ny').toLocaleLowerCase('sv') }));
    try {
      await add({ title });
      setOwn(null);
      setOwnError('');
      toast(t('bucket.tillagd'));
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  if (!items) return null;
  const openCat = open?.catalog_id ? byId.get(open.catalog_id) : undefined;
  const openParts = open ? partsOf(open) : null;

  return (
    <>
      <div className="card">
        <div className="row">
          <b>{t('listor.vy.bucketlist')}</b>
          <span className="mu">{t('bucket.raknare', { antal: done, totalt: list.length })}</span>
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${percent(done, list.length)}%` }} />
        </div>
      </div>

      <div className="g2">
        <button type="button" className="btn" onClick={() => setShowCatalog(true)}>
          <Icon name="book" size={20} />
          {t('bucket.katalog')}
        </button>
        <button type="button" className="btn ghost" onClick={() => setOwn('')}>
          <Icon name="plus" size={20} />
          {t('bucket.ny')}
        </button>
      </div>

      {list.length === 0 && (
        <div className="card soft">
          <p>{t('bucket.tom')}</p>
        </div>
      )}

      {list.map((b) => {
        const on = Boolean(b.done_on);
        const pv = on ? null : partsOf(b);
        const sub = [
          b.category ? t(`bucket.kategori.${b.category}`) : '',
          b.done_on ? formatDate(b.done_on) : '',
          pv ? t('bucket.delar.framsteg', { antal: pv.done, totalt: pv.total }) : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <div key={b.id} className="li">
            <button
              type="button"
              className={`box${on ? ' on' : ''}`}
              aria-pressed={on}
              aria-label={b.title}
              onClick={() => (on ? undo(b) : startCheck(b))}
            >
              {on && <Icon name="check" size={16} stroke={3} />}
            </button>
            <button type="button" className="t" onClick={() => setOpen(b)}>
              <b className={on ? 'done' : ''}>{b.title}</b>
              {sub && <span className="mu">{sub}</span>}
            </button>
            <span className="chev">
              <Icon name="chev" size={18} />
            </span>
          </div>
        );
      })}

      {/* Detaljvy för en punkt */}
      <BottomSheet open={Boolean(open)} title={open?.title ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            <div className="chips">
              {(open.category ?? openCat?.category) && (
                <span className="chip soft tag">{t(`bucket.kategori.${open.category ?? openCat?.category}`)}</span>
              )}
              {openCat?.cost_level && <span className="chip soft tag">{t(`kostnad.${openCat.cost_level}`)}</span>}
              {openCat?.season && <span className="chip soft tag">{openCat.season}</span>}
            </div>
            {openCat?.where_text && <p>{openCat.where_text}</p>}
            {open.done_on && (
              <span className="mu">
                {formatDate(open.done_on)}
                {open.place_id ? ` · ${placeName(places, open.place_id)}` : ''}
              </span>
            )}
            {bucketPlaces(open, openCat).map((id) => (
              <Row key={id} to={`/karta/${id}`} icon="pin" title={placeName(places, id)} />
            ))}
            <BucketParts
              view={openParts}
              canAdd={!open.catalog_id && !open.done_on}
              busy={partsBusy}
              onToggle={(title) => void saveParts(open, toggledParts(open.parts, title))}
              onAdd={(title) => saveParts(open, addedPart(open.parts, title))}
            />
            {!open.done_on && allPartsDone(openParts) && (
              <div className="card soft" role="status">
                <p>{t('bucket.delar.alla-klara')}</p>
              </div>
            )}
            {open.done_on ? (
              <button type="button" className="btn ghost" onClick={() => undo(open)}>
                {t('knapp.angra')}
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => startCheck(open)}>
                <Icon name="check" size={20} />
                {t('knapp.klar')}
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setRemove(open);
                setOpen(null);
              }}
            >
              {t('knapp.ta-bort')}
            </button>
          </>
        )}
      </BottomSheet>

      {/* Avbockning med datum och valfri plats */}
      <BottomSheet open={Boolean(checking)} title={checking?.item.title ?? ''} onClose={() => setChecking(null)}>
        {checking && (
          <>
            <label>
              {t('falt.datum')}
              <input type="date" value={checking.date} max={today()} onChange={(e) => setChecking({ ...checking, date: e.target.value })} />
            </label>
            <PlaceSelect
              label={t('falt.plats')}
              optional
              places={places}
              extra={[
                ...Object.keys(mine.statuses),
                ...bucketPlaces(checking.item, checking.item.catalog_id ? byId.get(checking.item.catalog_id) : undefined),
              ]}
              value={checking.place}
              onChange={(v) => setChecking({ ...checking, place: v })}
            />
            <button type="button" className="btn" disabled={!checking.date} onClick={confirmCheck}>
              <Icon name="check" size={20} />
              {t('knapp.klar')}
            </button>
          </>
        )}
      </BottomSheet>

      {/* Ta bort */}
      <BottomSheet open={Boolean(remove)} title={remove?.title ?? ''} onClose={() => setRemove(null)}>
        {remove && (
          <>
            <p>{t('allmant.ta-bort-fraga', { namn: remove.title })}</p>
            <button type="button" className="btn" onClick={drop}>
              {t('knapp.ta-bort')}
            </button>
            <button type="button" className="btn ghost" onClick={() => setRemove(null)}>
              {t('knapp.avbryt')}
            </button>
          </>
        )}
      </BottomSheet>

      {/* Egen punkt */}
      <BottomSheet open={own !== null} title={t('bucket.ny')} onClose={() => setOwn(null)}>
        <form className="col" onSubmit={addOwn} noValidate>
          <label>
            {t('bucket.ny')}
            <input value={own ?? ''} maxLength={120} onChange={(e) => setOwn(e.target.value)} aria-invalid={Boolean(ownError)} />
          </label>
          {ownError && (
            <span className="field-error" role="alert">
              {ownError}
            </span>
          )}
          <button type="submit" className="btn">
            <Icon name="plus" size={20} />
            {t('knapp.lagg-till')}
          </button>
        </form>
      </BottomSheet>

      {/* Katalogen */}
      <BottomSheet open={showCatalog} title={t('bucket.katalog')} onClose={() => setShowCatalog(false)}>
        <div className="chips" role="group" aria-label={`${t('knapp.filtrera')}: ${t('bucket.katalog')}`}>
          <button type="button" className="chip" aria-pressed={!fCat} onClick={() => setFCat(null)}>
            {t('knapp.visa-alla')}
          </button>
          {BUCKET_CATEGORIES.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={fCat === c} onClick={() => setFCat(c)}>
              {t(`bucket.kategori.${c}`)}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label={t('knapp.filtrera')}>
          <button type="button" className="chip" aria-pressed={!fCost} onClick={() => setFCost(null)}>
            {t('knapp.visa-alla')}
          </button>
          {COST_LEVELS.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={fCost === c} onClick={() => setFCost(c)}>
              {t(`kostnad.${c}`)}
            </button>
          ))}
        </div>
        <span className="mu" aria-live="polite">
          {t('marke.framsteg', { antal: filtered.length, totalt: catalog.length })}
        </span>
        {filtered.map((c) => {
          const has = onList(list, c.id);
          const sub = [t(`bucket.kategori.${c.category}`), c.cost_level ? t(`kostnad.${c.cost_level}`) : '', c.where_text ?? '']
            .filter(Boolean)
            .join(' · ');
          return (
            <div key={c.id} className="li">
              <span className="t">
                <b>{c.name}</b>
                <span className="mu">{sub}</span>
              </span>
              {has ? (
                <span className="badge ok" role="img" aria-label={t('bucket.tillagd')}>
                  <Icon name="check" size={18} stroke={3} />
                </span>
              ) : (
                <button type="button" className="chip" aria-label={`${t('knapp.lagg-till')}: ${c.name}`} onClick={() => addFromCatalog(c)}>
                  <Icon name="plus" size={18} />
                  {t('knapp.lagg-till')}
                </button>
              )}
            </div>
          );
        })}
      </BottomSheet>
    </>
  );
}
