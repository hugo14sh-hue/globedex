// Swipe (Sortera i solo): vyerna Kortbunt och Lista. Korten kommer från place_items, bucket_catalog och ideas
// som användaren inte har röstat på. Kanske sparas som röst med wants null och visas igen sist. Rösterna sparas i swipe_votes. Par och grupp: matchning när alla sagt ja.
// Solo: ett ja läggs direkt på bucketlistan. Korten går att svepa med finger, med knapparna och med piltangenterna.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import { Segment } from '../../components/Segment';
import {
  fetchAllItems,
  fetchBucketCatalog,
  fetchIdeas,
  fetchPlaces,
  placeName,
  type BucketCatalogItem,
  type Idea,
  type Place,
  type PlaceItem,
} from '../../lib/content';
import { buildDeck, commonYes, isMatch, waitingFor, type CardKind, type CardRef, type Votes } from '../../lib/listLogic';
import { fetchVotes, saveVote } from '../../lib/listor';
import { useSession, useTravelMode } from '../../lib/session';
import { useT } from '../../lib/useT';
import { useBucket } from './Bucketlist';

export type SwipeView = 'kortbunt' | 'lista';

type Item = Pick<PlaceItem, 'id' | 'place_id' | 'category' | 'name' | 'summary'>;

interface Card extends CardRef {
  title: string;
  tags: string[];
  text: string | null;
  placeId: string | null;
  category: string | null;
}

/** Hur långt kortet ska dras innan det räknas som ja eller nej (px). */
const THRESHOLD = 96;

/** Sant när fokus låg i bunten när kortet byttes, så att nästa kort får fokus. */
let refocus = false;

export function Swipe({ view, onView }: { view: SwipeView; onView: (v: SwipeView) => void }) {
  const t = useT();
  const { toast, party } = useFeedback();
  const { session, members } = useSession();
  const mode = useTravelMode();
  const solo = mode === 'solo';
  const me = session?.user.id ?? '';
  const memberIds = useMemo(() => {
    const ids = solo ? [] : members.map((m) => m.user_id);
    return ids.includes(me) ? ids : [me, ...ids].filter(Boolean);
  }, [solo, members, me]);
  const { add } = useBucket();

  const [items, setItems] = useState<Item[]>([]);
  const [catalog, setCatalog] = useState<BucketCatalogItem[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [votes, setVotes] = useState<Votes | null>(null);
  const [later, setLater] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchAllItems().catch(() => []),
      fetchBucketCatalog().catch(() => []),
      fetchIdeas().catch(() => []),
      fetchPlaces().catch(() => []),
    ]).then(([i, c, d, p]) => {
      if (!alive) return;
      setItems(i);
      setCatalog(c);
      setIdeas(d);
      setPlaces(p);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const memberKey = memberIds.join(',');
  useEffect(() => {
    if (!memberKey) return;
    let alive = true;
    fetchVotes(memberKey.split(','))
      .then((v) => alive && setVotes(v))
      .catch(() => alive && setVotes({}));
    return () => {
      alive = false;
    };
  }, [memberKey]);

  // Alla kort, med texterna som visas. Innehållet kommer från databasen.
  const cards = useMemo(() => {
    const out = new Map<string, Card>();
    for (const i of items)
      out.set(i.id, {
        kind: 'item',
        id: i.id,
        title: i.name,
        tags: [t(`lista.kategori.${i.category}`), placeName(places, i.place_id)],
        text: i.summary,
        placeId: i.place_id,
        category: null,
      });
    for (const b of catalog)
      out.set(b.id, {
        kind: 'bucket',
        id: b.id,
        title: b.name,
        tags: [t(`bucket.kategori.${b.category}`), b.cost_level ? t(`kostnad.${b.cost_level}`) : '', b.season ?? ''].filter(Boolean),
        text: b.where_text,
        placeId: b.place_ids[0] ?? null,
        category: b.category,
      });
    for (const d of ideas)
      out.set(d.id, {
        kind: 'idea',
        id: d.id,
        title: d.title,
        tags: [d.place_id ? placeName(places, d.place_id) : '', d.duration ?? '', d.cost_level ? t(`kostnad.${d.cost_level}`) : ''].filter(Boolean),
        text: d.body,
        placeId: d.place_id,
        category: null,
      });
    return out;
  }, [items, catalog, ideas, places, t]);

  const myVotes = useMemo(() => votes?.[me] ?? {}, [votes, me]);
  const deck = useMemo(() => {
    const ref = (kind: CardKind) => (x: { id: string }) => ({ kind, id: x.id });
    const d = buildDeck([items.map(ref('item')), catalog.map(ref('bucket')), ideas.map(ref('idea'))], myVotes);
    // Kanske sparas som röst (null) och kommer sist. Den som säger kanske igen hamnar sist bland kanske-korten.
    return [...d.filter((c) => !later.includes(c.id)), ...later.flatMap((id) => d.filter((c) => c.id === id))];
  }, [items, catalog, ideas, myVotes, later]);

  const current = deck[0] ? cards.get(deck[0].id) : undefined;
  const total = cards.size;

  const vote = useCallback(
    async (card: Card, wants: boolean | null) => {
      if (busy || !me || !votes) return;
      setBusy(true);
      const before = votes;
      const next: Votes = { ...votes, [me]: { ...(votes[me] ?? {}), [card.id]: wants } };
      setVotes(next);
      setLater((l) => [...l.filter((x) => x !== card.id), ...(wants === null ? [card.id] : [])]);
      try {
        await saveVote(me, card.id, wants);
      } catch {
        // Rösten sparades inte: kortet kommer tillbaka.
        setVotes(before);
        toast(t('allmant.fel-spara'));
        setBusy(false);
        return;
      }
      // Rösten är sparad. Misslyckas listan visas felet, men rösten står kvar.
      try {
        if (wants) {
          const row = {
            title: card.title,
            catalog_id: card.kind === 'bucket' ? card.id : null,
            category: card.category,
            place_id: card.kind === 'bucket' ? null : card.placeId,
          };
          if (solo) {
            // Solo: ja läggs direkt på listan.
            await add(row);
            toast(t('bucket.tillagd'));
          } else {
            // Par och grupp: hämta de andras senaste röster, och matcha när alla sagt ja.
            const fresh = await fetchVotes(memberIds).catch(() => next);
            fresh[me] = next[me];
            setVotes(fresh);
            // En par- eller gruppyta där ingen annan har gått med än kan inte matcha.
            if (memberIds.length > 1 && isMatch(card.id, fresh, memberIds)) {
              await add(row).catch(() => false);
              party(t('swipe.match', { namn: card.title }));
            }
          }
        }
      } catch {
        toast(t('allmant.fel-spara'));
      } finally {
        setBusy(false);
      }
    },
    [busy, me, votes, solo, add, memberIds, toast, party, t],
  );

  const maybe = useCallback((card: Card) => vote(card, null), [vote]);

  const names = (ids: string[]) =>
    ids
      .map((id) => members.find((m) => m.user_id === id)?.display_name)
      .filter(Boolean)
      .join(', ');

  const listIds = votes ? (solo ? Object.keys(myVotes).filter((id) => myVotes[id] === true) : commonYes(votes, memberIds)) : [];
  const waiting = votes && !solo ? Object.keys(myVotes).map((id) => ({ id, who: waitingFor(id, votes, memberIds, me) })).filter((w) => w.who.length) : [];

  return (
    <>
      <Segment<SwipeView>
        value={view}
        onChange={onView}
        options={[
          { value: 'kortbunt', label: t('listor.vy.kortbunt') },
          { value: 'lista', label: t('listor.vy.lista') },
        ]}
      />

      {view === 'kortbunt' && loaded && votes && (
        <>
          {current ? (
            <Deck key={current.id} card={current} onVote={vote} onMaybe={maybe} busy={busy} />
          ) : (
            <div className="card soft">
              <p>{t('swipe.slut')}</p>
            </div>
          )}
          {current && (
            <span className="mu" style={{ textAlign: 'center' }}>
              {t('marke.framsteg', { antal: total - deck.length + 1, totalt: total })}
            </span>
          )}
        </>
      )}

      {view === 'lista' && votes && (
        <>
          {listIds.length === 0 && (
            <div className="card soft">
              <p>{t('swipe.lista.tom')}</p>
            </div>
          )}
          {listIds.map((id) => {
            const c = cards.get(id);
            if (!c) return null;
            return <Row key={id} icon={solo ? 'check' : 'heart'} title={c.title} sub={c.tags.join(' · ')} to={c.placeId ? `/karta/${c.placeId}` : undefined} />;
          })}
          {waiting.map((w) => {
            const c = cards.get(w.id);
            if (!c) return null;
            return (
              <Row
                key={w.id}
                icon="star"
                title={c.title}
                sub={t('swipe.vantar', { namn: names(w.who) })}
                to={c.placeId ? `/karta/${c.placeId}` : undefined}
              />
            );
          })}
        </>
      )}
    </>
  );
}

/** Översta kortet i bunten. Dras med finger eller mus, styrs med piltangenter, och har knappar under sig. */
function Deck({
  card,
  onVote,
  onMaybe,
  busy,
}: {
  card: Card;
  onVote: (c: Card, wants: boolean) => void;
  onMaybe: (c: Card) => void;
  busy: boolean;
}) {
  const t = useT();
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Fokus följer med till nästa kort, så att tangentbord och skärmläsare kan fortsätta direkt.
  useEffect(() => {
    if (refocus) el.current?.focus();
    refocus = false;
  }, []);
  const keepFocus = () => {
    refocus = Boolean(document.activeElement?.closest('.stack, .swipe-btns'));
  };
  const yes = (wants: boolean) => {
    keepFocus();
    onVote(card, wants);
  };
  const later = () => {
    keepFocus();
    onMaybe(card);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDx(e.clientX - start.current.x);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    start.current = null;
    if (Math.abs(dx) >= THRESHOLD) yes(dx > 0);
    else setDx(0);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (busy) return;
    if (e.key === 'ArrowRight') yes(true);
    else if (e.key === 'ArrowLeft') yes(false);
    else if (e.key === 'ArrowDown') later();
    else return;
    e.preventDefault();
  };

  const tilt = reduce ? 0 : dx / 18;
  const hint = dx >= THRESHOLD / 2 ? 'ja' : dx <= -THRESHOLD / 2 ? 'nej' : null;

  return (
    <>
      <div className="stack">
        <div className="under" aria-hidden="true" />
        <div
          ref={el}
          className={`idea swipe${dx ? ' drag' : ''}`}
          role="group"
          aria-roledescription={t('listor.vy.kortbunt')}
          aria-label={card.title}
          tabIndex={0}
          style={{ transform: dx ? `translateX(${dx}px) rotate(${tilt}deg)` : undefined }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            start.current = null;
            setDx(0);
          }}
          onKeyDown={key}
        >
          <div className="chips">
            {card.tags.map((x) => (
              <span key={x} className="chip">
                {x}
              </span>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          {hint && (
            <span className={`swipe-hint ${hint}`} aria-hidden="true">
              <Icon name={hint === 'ja' ? 'heart' : 'x'} size={28} stroke={2.4} />
            </span>
          )}
          <span className="ti">{card.title}</span>
          {card.text && <span>{card.text}</span>}
        </div>
      </div>
      {/* Läser upp nästa kort för skärmläsare. */}
      <span className="sr-only" aria-live="polite">
        {card.title}
      </span>
      <div className="row swipe-btns">
        <button type="button" className="rnd" disabled={busy} onClick={() => yes(false)} aria-label={t('swipe.nej')}>
          <Icon name="x" size={24} />
        </button>
        <button type="button" className="chip" disabled={busy} onClick={later}>
          {t('swipe.kanske')}
        </button>
        <button type="button" className="rnd yes" disabled={busy} onClick={() => yes(true)} aria-label={t('swipe.ja')}>
          <Icon name="heart" size={30} />
        </button>
      </div>
    </>
  );
}
