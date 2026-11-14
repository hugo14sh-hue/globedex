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
import { addFind, removeFind, useMyPlaces } from '../../lib/status';
import { useT } from '../../lib/useT';
import { RARITY_COLORS } from '../../theme/palettes';
import { formatDate } from '../karta/format';
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

  const toggle = async (c: CompendiumItem) => {
    try {
      if (isFound(c.id)) {
        await removeFind(c.id);
        toast(t('allmant.borttaget'));
      } else if (await addFind(c.id, c.place_id)) announce(c);
    } catch {
      toast(t('allmant.fel-spara'));
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
          <span className="mu" aria-live="polite">
            {t('samling.raknare', { antal: shown.filter((i) => finds[i.id]).length, totalt: shown.length })}
          </span>
          {found === 0 && (
            <div className="card soft">
              <p>{t('samling.tom')}</p>
            </div>
          )}
          <ul className="bok" role="list">
            {shown.map((c) => {
              const f = isFound(c.id);
              const color = RARITY_COLORS[c.rarity];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`bc${f ? ' on' : ''}`}
                    style={f ? { borderColor: color } : undefined}
                    onClick={() => setOpen(c)}
                  >
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
            {finds[open.id] && (
              <span className="mu">
                {formatDate(finds[open.id].found_on)}
                {finds[open.id].place_id ? ` · ${placeName(places, finds[open.id].place_id!)}` : ''}
              </span>
            )}
            {open.place_id && <Row to={`/karta/${open.place_id}`} icon="pin" title={placeName(places, open.place_id)} />}
            {open.source_url && (
              <a className="src" href={open.source_url} target="_blank" rel="noopener noreferrer">
                {t('knapp.kalla')}
              </a>
            )}
            <button
              type="button"
              className={isFound(open.id) ? 'btn ghost' : 'btn'}
              onClick={() => toggle(open)}
            >
              <Icon name={isFound(open.id) ? 'x' : 'check'} size={20} />
              {t(isFound(open.id) ? 'knapp.ta-bort' : 'knapp.klar')}
            </button>
          </>
        )}
      </BottomSheet>
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
