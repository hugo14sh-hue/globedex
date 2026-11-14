// Samlingsbok: vyerna Kort, Kompendium och Samlingar (som i prototypen).
// Korten och kompendiet kommer från compendium_items. Fynd sparas i finds.
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon, isIcon } from '../../components/Icon';
import { Row } from '../../components/Row';
import { Segment } from '../../components/Segment';
import { fetchCompendium, fetchPlaces, placeName, RARITIES, type CompendiumItem, type Place } from '../../lib/content';
import { countByCategory, percent } from '../../lib/listLogic';
import { useSession } from '../../lib/session';
import { addFind, addFinds, removeFind, useMyPlaces } from '../../lib/status';
import { todayIso } from '../../lib/tripLogic';
import { useT } from '../../lib/useT';
import { RARITY_COLORS } from '../../theme/palettes';
import { formatDate } from '../karta/format';
import { PlaceSelect } from './PlaceSelect';
import { Samlingar } from './Samlingar';
import { useFindFeedback } from './useFindFeedback';
import { useUrlParam } from '../../lib/navMemory';

export type BokView = 'kort' | 'kompendium' | 'samlingar';
const VIEWS: BokView[] = ['kort', 'kompendium', 'samlingar'];

const catKey = (c: string) => `samling.kategori.${c}`;

export function Samlingsbok({ view, onView }: { view: BokView; onView: (v: BokView, extra?: Record<string, string>) => void }) {
  const t = useT();
  const { session } = useSession();
  const mine = useMyPlaces(session?.user.id ?? null);
  const { toast } = useFeedback();
  const announce = useFindFeedback();
  const [items, setItems] = useState<CompendiumItem[] | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  // Vald kategori och öppet kort står i adressen, så att de finns kvar när man går tillbaka hit.
  const [category, setCategory] = useUrlParam('kat');
  const [openId, setOpenId] = useUrlParam('fynd');
  const open = (openId && items?.find((i) => i.id === openId)) || null;
  const setOpen = (c: CompendiumItem | null) => setOpenId(c?.id ?? null);
  // Markera flera: tryck på flera kort och lägg till alla som hittade i ett anrop.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCompendium()
      .then((x) => alive && setItems(x))
      .catch(() => alive && setItems([]));
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const finds = mine.finds;
  const isFound = (id: string) => Boolean(finds[id]);
  const all = useMemo(() => items ?? [], [items]);
  const cats = useMemo(() => countByCategory(all, (id) => Boolean(finds[id])), [all, finds]);
  const found = all.filter((i) => finds[i.id]).length;
  const shown = category ? all.filter((i) => i.category === category) : all;

  /** Ett kort från bottenarket: med datum, eller utan (samling.vet-inte-nar). */
  const markFound = async (c: CompendiumItem, foundOn: string | null, placeId: string | null) => {
    try {
      if (await addFind(c.id, placeId, foundOn)) announce(c);
      setOpen(null);
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const unmark = async (c: CompendiumItem) => {
    try {
      await removeFind(c.id);
      toast(t('allmant.borttaget'));
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const stopPicking = () => {
    setPicking(false);
    setPicked([]);
  };

  const togglePick = (c: CompendiumItem) =>
    setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]));

  /** Alla valda kort sparas utan datum i ett enda anrop, med ett samlat besked (ingen konfetti per kort). */
  const addPicked = async () => {
    const list = all.filter((i) => picked.includes(i.id) && !finds[i.id]).map((i) => ({ compendiumId: i.id, placeId: i.place_id }));
    if (!list.length) return stopPicking();
    setSaving(true);
    try {
      const added = await addFinds(list, null);
      toast(t('samling.flera-klart', { antal: added.length }));
      stopPicking();
    } catch {
      toast(t('allmant.fel-spara'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="hero">
        <span className="eb on-hero">{t('listor.vy.samlingsbok')}</span>
        <span className="big">{t('samling.raknare', { antal: found, totalt: all.length })}</span>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${percent(found, all.length)}%` }} />
        </div>
      </div>

      <Segment<BokView> value={view} onChange={(v) => onView(v)} options={VIEWS.map((v) => ({ value: v, label: t(`listor.vy.${v}`) }))} />

      {view !== 'samlingar' && items && all.length === 0 && (
        <div className="card soft">
          <p>{t('samling.tom')}</p>
        </div>
      )}

      {view === 'kort' && all.length > 0 && (
        <>
          <div className="chips" role="group" aria-label={t('knapp.filtrera')}>
            <button type="button" className="chip" aria-pressed={!category} onClick={() => setCategory(null)}>
              {t('knapp.visa-alla')}
            </button>
            {cats.map((c) => (
              <button key={c.category} type="button" className="chip" aria-pressed={category === c.category} onClick={() => setCategory(c.category)}>
                {t(catKey(c.category))}
              </button>
            ))}
          </div>
          <div className="row">
            <span className="mu" aria-live="polite">
              {t('samling.raknare', { antal: shown.filter((i) => finds[i.id]).length, totalt: shown.length })}
            </span>
            <button type="button" className="chip" aria-pressed={picking} onClick={() => (picking ? stopPicking() : setPicking(true))}>
              {t('samling.markera-flera')}
            </button>
          </div>
          {found === 0 && (
            <div className="card soft">
              <p>{t('samling.tom')}</p>
            </div>
          )}
          <ul className="bok" role="list">
            {shown.map((c) => {
              const f = isFound(c.id);
              const color = RARITY_COLORS[c.rarity];
              const sel = picking && picked.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`bc${f ? ' on' : ''}${sel ? ' sel' : ''}`}
                    style={f ? { borderColor: color } : undefined}
                    // I läget Markera flera går bara kort som inte är hittade att välja.
                    aria-pressed={picking ? sel : undefined}
                    disabled={picking && f}
                    onClick={() => (picking ? togglePick(c) : setOpen(c))}
                  >
                    {sel && (
                      <span className="bc-tick" aria-hidden="true">
                        <Icon name="check" size={14} stroke={3} />
                      </span>
                    )}
                    <span className="ic" style={f ? { background: `color-mix(in srgb, ${color} 18%, var(--sf))`, color } : undefined}>
                      <Icon name={isIcon(c.icon) ? c.icon : 'star'} size={28} stroke={1.8} />
                    </span>
                    {/* Namnet för skärmläsare är den synliga texten: kortets namn (eller Okänt) och sällsyntheten.
                        Sällsynthetens färg syns i kanten och ikonen. Texten har textfärg för kontrastens skull. */}
                    {f ? <span>{c.name}</span> : <><span aria-hidden="true">?</span><span className="sr-only">{t('samling.okant')}</span></>}
                    <small>{t(`sallsynthet.${c.rarity}`)}</small>
                  </button>
                </li>
              );
            })}
          </ul>
          <RarityLegend />
          {/* Luft under korten, så att raden längst ned inte täcker de sista korten. */}
          {picking && <div style={{ height: 84 }} aria-hidden="true" />}
          {picking && (
            <div className="pickbar card" role="region" aria-label={t('samling.markera-flera')}>
              <span aria-live="polite">{t('samling.valda', { antal: picked.length })}</span>
              <button type="button" className="btn" disabled={!picked.length || saving} onClick={addPicked}>
                <Icon name="check" size={20} />
                {t('samling.lagg-till-valda')}
              </button>
            </div>
          )}
        </>
      )}

      {view === 'kompendium' && all.length > 0 && (
        <>
          {cats.map((c) => {
            const list = all.filter((i) => i.category === c.category);
            const first = list.find((i) => isIcon(i.icon));
            return (
              <button
                key={c.category}
                type="button"
                className="li"
                onClick={() => {
                  onView('kort', { kat: c.category });
                }}
              >
                <span className="badge">
                  <Icon name={first && isIcon(first.icon) ? first.icon : 'star'} size={20} />
                </span>
                <span className="t">
                  <b>{t(catKey(c.category))}</b>
                  <span className="rar">
                    {RARITIES.map((r) => {
                      const of = list.filter((i) => i.rarity === r);
                      if (!of.length) return null;
                      return (
                        <span key={r}>
                          <i style={{ background: RARITY_COLORS[r] }} aria-hidden="true" />
                          <span className="sr-only">{t(`sallsynthet.${r}`)}: </span>
                          {of.filter((i) => finds[i.id]).length}/{of.length}
                        </span>
                      );
                    })}
                  </span>
                </span>
                <span className="cnt">
                  <span className="mu">{t('samling.raknare', { antal: c.found, totalt: c.total })}</span>
                  <span className="bar" aria-hidden="true">
                    <i style={{ width: `${percent(c.found, c.total)}%` }} />
                  </span>
                </span>
              </button>
            );
          })}
          <RarityLegend />
        </>
      )}

      {view === 'samlingar' && <Samlingar />}

      <BottomSheet open={Boolean(open)} title={open ? (isFound(open.id) ? open.name : t('samling.okant')) : ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            {/* Sällsynthetens färg som prick: texten i färgen klarade inte 4,5:1. */}
            <span className="eb row-inline">
              <i className="dot" style={{ background: RARITY_COLORS[open.rarity] }} aria-hidden="true" />
              {t(`sallsynthet.${open.rarity}`)} · {t(catKey(open.category))}
            </span>
            {open.hint && <p>{open.hint}</p>}
            {finds[open.id] && (finds[open.id].found_on || finds[open.id].place_id) && (
              <span className="mu">
                {[finds[open.id].found_on ? formatDate(finds[open.id].found_on!) : '', finds[open.id].place_id ? placeName(places, finds[open.id].place_id!) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
            {open.place_id && <Row to={`/karta/${open.place_id}`} icon="pin" title={placeName(places, open.place_id)} />}
            {open.source_url && (
              <a className="src" href={open.source_url} target="_blank" rel="noopener noreferrer">
                {t('knapp.kalla')}
              </a>
            )}
            {isFound(open.id) ? (
              <button type="button" className="btn ghost" onClick={() => unmark(open)}>
                <Icon name="x" size={20} />
                {t('samling.ta-bort-fynd')}
              </button>
            ) : (
              <FindForm key={open.id} item={open} places={places} extra={Object.keys(mine.statuses)} onSave={(d, p) => markFound(open, d, p)} />
            )}
          </>
        )}
      </BottomSheet>
    </>
  );
}

/** Bocka av ett kort: när (eller vet inte när) och var (valfri, förvald till kortets plats). */
function FindForm({
  item,
  places,
  extra,
  onSave,
}: {
  item: CompendiumItem;
  places: Place[];
  extra: string[];
  onSave: (foundOn: string | null, placeId: string | null) => Promise<void>;
}) {
  const t = useT();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [place, setPlace] = useState(item.place_id ?? '');
  const [busy, setBusy] = useState(false);
  const save = async (d: string | null) => {
    setBusy(true);
    await onSave(d, place || null);
    setBusy(false);
  };
  return (
    <>
      <label>
        {t('samling.nar')}
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      <PlaceSelect label={t('samling.var')} places={places} extra={item.place_id ? [...extra, item.place_id] : extra} value={place} onChange={setPlace} optional />
      <button type="button" className="btn" disabled={busy || !date} onClick={() => save(date)}>
        <Icon name="check" size={20} />
        {t('samling.hittad-knapp')}
      </button>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => save(null)}>
        {t('samling.vet-inte-nar')}
      </button>
    </>
  );
}

function RarityLegend() {
  const t = useT();
  return (
    <div className="lg">
      {RARITIES.map((r) => (
        <span key={r}>
          <i style={{ background: RARITY_COLORS[r] }} />
          {t(`sallsynthet.${r}`)}
        </span>
      ))}
    </div>
  );
}
