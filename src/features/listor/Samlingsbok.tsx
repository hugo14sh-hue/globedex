// Samlingsbok: vyerna Kort, Kompendium och Samlingar (som i prototypen).
// Korten och kompendiet kommer från compendium_items. Fynd sparas i finds, ett per person och kort.
// Par och grupp: Min bok, Vår bok (hittat av någon i den aktiva gruppen) eller en medlems bok.
// Bara egna fynd går att lägga till och ta bort, i alla lägen.
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon, isIcon } from '../../components/Icon';
import { Row } from '../../components/Row';
import { Segment } from '../../components/Segment';
import { fetchCompendium, fetchPlaces, placeName, RARITIES, type CompendiumItem, type Place } from '../../lib/content';
import { countByCategory, MANY, percent } from '../../lib/listLogic';
import { useSession, useTravelMode } from '../../lib/session';
import { addFind, addFinds, removeFind, useMemberFinds, useMyPlaces, type Find } from '../../lib/status';
import { todayIso } from '../../lib/tripLogic';
import { useT, useLang } from '../../lib/useT';
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
  const lang = useLang();
  const { session, members } = useSession();
  const travelMode = useTravelMode();
  const me = session?.user.id ?? null;
  const mine = useMyPlaces(me);
  // Min bok, Vår bok eller en medlems bok. Valet står i adressen (?bok=). Solo: bara den egna.
  const others = useMemo(() => (travelMode === 'solo' ? [] : members.filter((m) => m.user_id !== me)), [travelMode, members, me]);
  const memberFinds = useMemberFinds(others.map((m) => m.user_id));
  const [bokParam, setBok] = useUrlParam('bok');
  const who: string =
    travelMode === 'solo' || !bokParam || (bokParam !== 'var' && !others.some((m) => m.user_id === bokParam)) ? 'min' : bokParam;
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? '';
  const whoLabel = (w: string) =>
    w === 'min' ? t('samling.visa.min') : w === 'var' ? t('samling.visa.var') : t('samling.visa.medlem', { namn: nameOf(w) });
  const { toast } = useFeedback();
  const announce = useFindFeedback();
  const [items, setItems] = useState<CompendiumItem[] | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  // Vald kategori och öppet kort står i adressen, så att de finns kvar när man går tillbaka hit.
  const [category, setCategory] = useUrlParam('kat');
  // Utfälld kategori i Kompendium.
  const [expanded, setExpanded] = useUrlParam('oppen');
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
  }, [lang]);

  // Egna fynd: det som går att lägga till och ta bort.
  const finds = mine.finds;
  const isMine = (id: string) => Boolean(finds[id]);
  // Vem som har hittat ett kort i vald bok (user_id). Min bok: bara jag.
  const finders = useMemo(() => {
    const out: Record<string, string[]> = {};
    const add = (uid: string, list: Record<string, Find>) => {
      for (const id of Object.keys(list)) (out[id] ??= []).push(uid);
    };
    if ((who === 'min' || who === 'var') && me) add(me, finds);
    if (who === 'var') for (const m of others) add(m.user_id, memberFinds.byUser[m.user_id] ?? {});
    if (who !== 'min' && who !== 'var') add(who, memberFinds.byUser[who] ?? {});
    return out;
  }, [who, me, finds, others, memberFinds.byUser]);
  const isFound = (id: string) => Boolean(finders[id]?.length);
  /** Hittad av, i Vår bok. */
  const foundBy = (id: string) =>
    who === 'var' && finders[id]?.length ? t('samling.hittad-av', { namn: finders[id].map(nameOf).filter(Boolean).join(', ') }) : '';
  const all = useMemo(() => items ?? [], [items]);
  const cats = useMemo(() => countByCategory(all, (id) => Boolean(finders[id]?.length)), [all, finders]);
  const found = all.filter((i) => isFound(i.id)).length;
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

  /** Rutan i Kompendium: lägger till eller tar bort det egna fyndet (utan datum, som Markera flera). */
  const toggleMine = async (c: CompendiumItem) => {
    if (isMine(c.id)) return unmark(c);
    try {
      if (await addFind(c.id, c.place_id, null)) announce(c);
    } catch {
      toast(t('allmant.fel-spara'));
    }
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
      {travelMode !== 'solo' && (
        <div className="chips" role="group" aria-label={t('listor.vy.samlingsbok')}>
          {['min', 'var', ...others.map((m) => m.user_id)].map((w) => (
            <button key={w} type="button" className="chip" aria-pressed={who === w} onClick={() => setBok(w === 'min' ? null : w)}>
              {whoLabel(w)}
            </button>
          ))}
        </div>
      )}

      <div className="hero">
        <span className="eb on-hero">{t('listor.vy.samlingsbok')}</span>
        <span className="big">{t('samling.raknare', { antal: found, totalt: all.length })}</span>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${percent(found, all.length)}%` }} />
        </div>
      </div>

      <Segment<BokView> value={view} onChange={(v) => onView(v, who === 'min' ? undefined : { bok: who })} options={VIEWS.map((v) => ({ value: v, label: t(`listor.vy.${v}`) }))} />

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
              {t('samling.raknare', { antal: shown.filter((i) => isFound(i.id)).length, totalt: shown.length })}
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
              const by = foundBy(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`bc${f ? ' on' : ''}${sel ? ' sel' : ''}`}
                    style={f ? { borderColor: color } : undefined}
                    // I läget Markera flera går bara kort som jag inte har hittat att välja.
                    aria-pressed={picking ? sel : undefined}
                    disabled={picking && isMine(c.id)}
                    onClick={() => (picking ? togglePick(c) : setOpen(c))}
                  >
                    {sel && (
                      <span className="bc-tick" aria-hidden="true">
                        <Icon name="check" size={14} stroke={3} />
                      </span>
                    )}
                    {/* Hittat kort: bock i hörnet. Inte hittat: dämpad färg och ingen bock. Namnet visas alltid. */}
                    {f && !sel && (
                      <span className="bc-found" aria-hidden="true">
                        <Icon name="check" size={14} stroke={3} />
                      </span>
                    )}
                    <span className="ic" style={f ? { background: `color-mix(in srgb, ${color} 18%, var(--sf))`, color } : undefined}>
                      <Icon name={isIcon(c.icon) ? c.icon : 'star'} size={28} stroke={1.8} />
                    </span>
                    {/* Namnet för skärmläsare är den synliga texten: namn, sällsynthet, ledtråd och (inte hittat) samling.okant.
                        Sällsynthetens färg syns i kanten och ikonen. Texten har textfärg eller dämpad textfärg för kontrastens skull. */}
                    <span className="bc-name">{c.name}</span>
                    <small>{t(`sallsynthet.${c.rarity}`)}</small>
                    {c.hint && <small className="bc-hint">{c.hint}</small>}
                    {by && <small className="bc-by">{by}</small>}
                    {!f && <span className="sr-only">{t('samling.okant')}</span>}
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
            const isOpen = expanded === c.category;
            const listId = `komp-${c.category}`;
            return (
              <section key={c.category} className="komp">
                {/* Ett tryck fäller ut kategorins kort direkt i listan. */}
                <button
                  type="button"
                  className="li"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? listId : undefined}
                  onClick={() => setExpanded(isOpen ? null : c.category)}
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
                            {of.filter((i) => isFound(i.id)).length}/{of.length}
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
                  <span className={`chev${isOpen ? ' open' : ''}`} aria-hidden="true">
                    <Icon name="chev" size={18} />
                  </span>
                </button>
                {isOpen && (
                  <ul id={listId} className={`komp-list${list.length > MANY ? ' many' : ''}`} role="list">
                    {list.map((i) => {
                      const own = isMine(i.id);
                      const f = isFound(i.id);
                      const by = foundBy(i.id);
                      return (
                        <li key={i.id} className={`li${f ? '' : ' unfound'}`}>
                          {/* Rutan gäller det egna fyndet, i alla böcker. */}
                          <button type="button" className={`box${own ? ' on' : ''}`} aria-pressed={own} aria-label={i.name} onClick={() => toggleMine(i)}>
                            {own && <Icon name="check" size={18} stroke={3} />}
                          </button>
                          <button type="button" className="t" onClick={() => setOpen(i)}>
                            <b>{i.name}</b>
                            <span className="row-inline mu">
                              <i className="dot" style={{ background: RARITY_COLORS[i.rarity] }} aria-hidden="true" />
                              {t(`sallsynthet.${i.rarity}`)}
                              {by ? ` · ${by}` : ''}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
          <RarityLegend />
        </>
      )}

      {view === 'samlingar' && <Samlingar />}

      <BottomSheet open={Boolean(open)} title={open ? open.name : ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            {/* Sällsynthetens färg som prick: texten i färgen klarade inte 4,5:1. */}
            <span className="eb row-inline">
              <i className="dot" style={{ background: RARITY_COLORS[open.rarity] }} aria-hidden="true" />
              {t(`sallsynthet.${open.rarity}`)} · {t(catKey(open.category))}
            </span>
            {open.hint && <p>{open.hint}</p>}
            {foundBy(open.id) && <span className="mu">{foundBy(open.id)}</span>}
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
            {isMine(open.id) ? (
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
