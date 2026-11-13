// Hämtar allt som siffror, märken, Wrapped, tidslinjen och exporten räknas från.
// Varje del hämtas för sig: misslyckas en del räknas resten ändå (den delen blir tom).
import { useCallback, useEffect, useState } from 'react';
import { fetchAllItems, fetchCompendium, fetchPlaces, type CompendiumItem, type Place } from '../../lib/content';
import { fetchSavedIdeas } from '../../lib/idag';
import type { ExpenseLike } from '../../lib/kassa';
import type { BucketItem } from '../../lib/listLogic';
import { fetchBucketItems, fetchCollections, type Collection } from '../../lib/listor';
import { fetchReviews, type Review } from '../../lib/reviews';
import { useSession, useTravelMode } from '../../lib/session';
import { isStatus } from '../../lib/statusLogic';
import { supabase } from '../../lib/supabase';
import { fetchExpenseRows, fetchLegCounts, fetchListCounts, fetchTrips, type Trip } from '../../lib/trips';
import { todayIso } from '../../lib/tripLogic';
import { CHECK_KIND } from '../../lib/vaultCrypto';
import { useTheme } from '../../theme/ThemeProvider';
import { emptyInput, type ViInput } from './marken';

export interface ViData {
  input: ViInput;
  places: Place[];
  compendium: CompendiumItem[];
  trips: Trip[];
  bucket: BucketItem[];
  collections: Collection[];
  reviews: Review[];
}

const ok = <T,>(r: PromiseSettledResult<T>, fallback: T): T => (r.status === 'fulfilled' ? r.value : fallback);

async function rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T[];
}

/** Gemensamma ja: alla medlemmar har sagt ja. Datumet är den sista rösten. */
export function matchesFrom(votes: { user_id: string; catalog_id: string; wants: boolean | null; voted_at: string }[], members: string[]) {
  const by = new Map<string, { yes: Set<string>; last: string }>();
  for (const v of votes) {
    if (v.wants !== true) continue;
    const m = by.get(v.catalog_id) ?? { yes: new Set<string>(), last: '' };
    m.yes.add(v.user_id);
    if (v.voted_at > m.last) m.last = v.voted_at;
    by.set(v.catalog_id, m);
  }
  return [...by.entries()].filter(([, m]) => members.length > 1 && members.every((u) => m.yes.has(u))).map(([id, m]) => ({ id, date: m.last || null }));
}

export function useViData() {
  const { session, activeGroup, members } = useSession();
  const mode = useTravelMode();
  const { theme } = useTheme();
  const me = session?.user.id ?? '';
  const gid = activeGroup?.id ?? '';
  const memberKey = (mode === 'solo' ? [me] : members.map((m) => m.user_id)).filter(Boolean).sort().join(',');
  const [data, setData] = useState<ViData | null>(null);
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN((x) => x + 1), []);
  const customPalette = theme.palette === 'egen';

  useEffect(() => {
    if (!me || !gid) return;
    let alive = true;
    const memberIds = memberKey ? memberKey.split(',') : [me];
    (async () => {
      const today = todayIso();
      const [placesR, compR, itemsR, statusR, findsR, checksR, tripsR, bucketR, votesR, ideasR, reviewsR, colsR, vaultR] = await Promise.allSettled([
        fetchPlaces(),
        fetchCompendium(),
        fetchAllItems(),
        rows<{ place_id: string; status: string; updated_at: string | null }>(
          supabase.from('place_status').select('place_id, status, updated_at').eq('user_id', me),
        ),
        rows<{ compendium_id: string; found_on: string; place_id: string | null }>(
          supabase.from('finds').select('compendium_id, found_on, place_id').eq('user_id', me),
        ),
        rows<{ item_id: string; done_on: string }>(supabase.from('item_checks').select('item_id, done_on').eq('user_id', me)),
        fetchTrips(gid),
        fetchBucketItems(gid),
        rows<{ user_id: string; catalog_id: string; wants: boolean | null; voted_at: string }>(
          supabase.from('swipe_votes').select('user_id, catalog_id, wants, voted_at').in('user_id', memberIds),
        ),
        fetchSavedIdeas(gid),
        fetchReviews(gid, me),
        fetchCollections(me),
        // Bara typ och datum. Innehållet är krypterat och behövs inte här.
        rows<{ kind: string; updated_at: string | null }>(supabase.from('vault_items').select('kind, updated_at').eq('user_id', me)),
      ]);
      const trips = ok(tripsR, [] as Trip[]);
      const ids = trips.map((t) => t.id);
      const [legsR, expR, packR] = await Promise.allSettled([
        fetchLegCounts(ids),
        fetchExpenseRows(ids),
        fetchListCounts('packing_items', ids),
      ]);
      if (!alive) return;

      const places = ok(placesR, [] as Place[]);
      const compendium = ok(compR, [] as CompendiumItem[]);
      const itemsByPlace: Record<string, string[]> = {};
      for (const i of ok(itemsR, [])) (itemsByPlace[i.place_id] ??= []).push(i.id);
      const expensesByTrip: Record<string, ExpenseLike[]> = {};
      for (const e of ok(expR, [])) (expensesByTrip[e.trip_id] ??= []).push(e);
      const collections = ok(colsR, [] as Collection[]);
      const reviews = ok(reviewsR, [] as Review[]);
      const bucket = ok(bucketR, [] as BucketItem[]);

      const input: ViInput = {
        ...emptyInput(mode, today),
        statuses: ok(statusR, [])
          .filter((s) => isStatus(s.status))
          .map((s) => ({ place_id: s.place_id, status: s.status as ViInput['statuses'][number]['status'], updated_at: s.updated_at })),
        seRegions: places.filter((p) => p.parent_id === 'SE' && p.layer === 'landskap').map((p) => p.id),
        trips,
        legCounts: ok(legsR, {}),
        finds: ok(findsR, []),
        rarity: Object.fromEntries(compendium.map((c) => [c.id, c.rarity])),
        itemsByPlace,
        checks: ok(checksR, []),
        bucket,
        matches: matchesFrom(ok(votesR, []), memberIds),
        savedIdeas: ok(ideasR, []),
        reviews,
        collectionEntries: collections.flatMap((c) => c.entries),
        expensesByTrip,
        memberIds,
        packing: ok(packR, {}),
        vault: ok(vaultR, []).filter((v) => v.kind !== CHECK_KIND),
        customPalette,
      };
      setData({ input, places, compendium, trips, bucket, collections, reviews });
    })();
    return () => {
      alive = false;
    };
  }, [me, gid, mode, memberKey, customPalette, n]);

  return { data, reload };
}
