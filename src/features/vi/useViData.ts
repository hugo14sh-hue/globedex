// Hämtar allt som siffror, märken, Wrapped, tidslinjen och exporten räknas från.
// Varje del hämtas för sig: misslyckas en del räknas resten ändå (den delen blir tom).
import { useCallback, useEffect, useState } from 'react';
import { fetchAllItems, fetchBucketCatalog, fetchCompendium, fetchPlaces, type CompendiumItem, type Place } from '../../lib/content';
import { fetchSavedIdeas } from '../../lib/idag';
import type { ExpenseLike } from '../../lib/kassa';
import { bucketTitle, type BucketItem } from '../../lib/listLogic';
import { fetchBucketItems, fetchCollections, type Collection } from '../../lib/listor';
import { fetchReviews, type Review } from '../../lib/reviews';
import { useSession, useTravelMode } from '../../lib/session';
import { isStatus } from '../../lib/statusLogic';
import { personStatuses, toRows, type StatusRow } from '../../lib/togetherLogic';
import { supabase } from '../../lib/supabase';
import { fetchExpenseRows, fetchLegCounts, fetchPackingStats, fetchTrips, type Trip } from '../../lib/trips';
import { todayIso } from '../../lib/tripLogic';
import { CHECK_KIND } from '../../lib/vaultCrypto';
import { useTheme } from '../../theme/ThemeProvider';
import { useLang } from '../../lib/useT';
import { emptyInput, type ViInput } from './marken';
import type { ViSource } from './viLogic';

export interface ViData {
  input: ViInput;
  places: Place[];
  compendium: CompendiumItem[];
  trips: Trip[];
  bucket: BucketItem[];
  collections: Collection[];
  reviews: Review[];
  /** Platsstatus för alla i gruppen (den egna och medlemmarnas som inte är privat), med together_group. */
  statusRows: StatusRow[];
  memberIds: string[];
  groupId: string;
  /** Fynd och avbockat per medlem (andras privata rader släpps inte igenom av RLS). */
  findsByUser: ViSource['findsByUser'];
  checksByUser: ViSource['checksByUser'];
  /** Egen palett per medlem, ur profiles.settings. */
  customPaletteByUser: Record<string, boolean>;
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
  const lang = useLang();
  const me = session?.user.id ?? '';
  const gid = activeGroup?.id ?? '';
  const memberKey = (mode === 'solo' ? [me] : members.map((m) => m.user_id)).filter(Boolean).sort().join(',');
  const [data, setData] = useState<ViData | null>(null);
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN((x) => x + 1), []);
  const customPalette = theme.palette === 'egen';
  // Den som tittar räknar med sitt eget val, även i par och grupp.
  const countryList = theme.countryList;
  const splitCountries = theme.splitCountries;

  useEffect(() => {
    if (!me || !gid) return;
    let alive = true;
    const memberIds = memberKey ? memberKey.split(',') : [me];
    (async () => {
      const today = todayIso();
      const [placesR, compR, itemsR, statusR, findsR, checksR, tripsR, bucketR, votesR, ideasR, reviewsR, colsR, vaultR, groupStatusR, profilesR] = await Promise.allSettled([
        fetchPlaces(),
        fetchCompendium(),
        fetchAllItems(),
        rows<{ place_id: string; status: string; updated_at: string | null }>(
          supabase.from('place_status').select('place_id, status, updated_at').eq('user_id', me),
        ),
        // Fynd och avbockat för alla medlemmar: siffror och märken hör till en person (Körning 22).
        rows<{ user_id: string; compendium_id: string; found_on: string | null; place_id: string | null }>(
          supabase.from('finds').select('user_id, compendium_id, found_on, place_id').in('user_id', memberIds),
        ),
        rows<{ user_id: string; item_id: string; done_on: string }>(
          supabase.from('item_checks').select('user_id, item_id, done_on').in('user_id', memberIds),
        ),
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
        // Siffrornas lägen (tillsammans, någon av oss, jag, den andra). RLS släpper inte igenom andras privata rader.
        rows<{ user_id: string; place_id: string; status: string; together_group: string | null; updated_at: string | null }>(
          supabase.from('place_status').select('user_id, place_id, status, together_group, updated_at').in('user_id', memberIds),
        ),
        // Bara paletten behövs, för märket för egen palett när man tittar på en annan medlem.
        mode === 'solo'
          ? Promise.resolve([] as { id: string; settings: { theme?: { palette?: string } } | null }[])
          : rows<{ id: string; settings: { theme?: { palette?: string } } | null }>(supabase.from('profiles').select('id, settings').in('id', memberIds)),
      ]);
      const trips = ok(tripsR, [] as Trip[]);
      const ids = trips.map((t) => t.id);
      const [legsR, expR, packR] = await Promise.allSettled([
        fetchLegCounts(ids),
        fetchExpenseRows(ids),
        fetchPackingStats(ids),
      ]);
      // Katalogens namn på valt språk för punkter ur katalogen (tidslinjen, Wrapped och exporten).
      const catalog = await fetchBucketCatalog().catch(() => []);
      if (!alive) return;

      const places = ok(placesR, [] as Place[]);
      const compendium = ok(compR, [] as CompendiumItem[]);
      const itemsByPlace: Record<string, string[]> = {};
      for (const i of ok(itemsR, [])) (itemsByPlace[i.place_id] ??= []).push(i.id);
      const expensesByTrip: Record<string, ExpenseLike[]> = {};
      for (const e of ok(expR, [])) (expensesByTrip[e.trip_id] ??= []).push(e);
      const collections = ok(colsR, [] as Collection[]);
      const reviews = ok(reviewsR, [] as Review[]);
      const catalogById = new Map(catalog.map((c) => [c.id, c]));
      const bucket = ok(bucketR, [] as BucketItem[]).map((b) => ({ ...b, title: bucketTitle(b, catalogById) }));
      const findsByUser: ViSource['findsByUser'] = {};
      for (const f of ok(findsR, [])) (findsByUser[f.user_id] ??= []).push({ compendium_id: f.compendium_id, found_on: f.found_on, place_id: f.place_id });
      const checksByUser: ViSource['checksByUser'] = {};
      for (const c of ok(checksR, [])) (checksByUser[c.user_id] ??= []).push({ item_id: c.item_id, done_on: c.done_on });
      const customPaletteByUser: Record<string, boolean> = {};
      for (const p of ok(profilesR, [])) customPaletteByUser[p.id] = p.settings?.theme?.palette === 'egen';
      customPaletteByUser[me] = customPalette;
      const statusRows = toRows(ok(groupStatusR, []));
      const ownRows = ok(statusR, [])
        .filter((s) => isStatus(s.status))
        .map((s) => ({ place_id: s.place_id, status: s.status as ViInput['statuses'][number]['status'], updated_at: s.updated_at }));
      // Par och grupp: mina platser är mina rader plus det gruppen har markerat som tillsammans.
      // Solo räknar som förut på de egna raderna.
      const statuses = mode !== 'solo' && groupStatusR.status === 'fulfilled' ? personStatuses(me, statusRows, memberIds, gid) : ownRows;

      const input: ViInput = {
        ...emptyInput(mode, today),
        statuses,
        countryList,
        splitCountries,
        seRegions: places.filter((p) => p.parent_id === 'SE' && p.layer === 'landskap').map((p) => p.id),
        usStates: places.filter((p) => p.parent_id === 'US' && p.layer === 'delstat').map((p) => p.id),
        trips,
        legCounts: ok(legsR, {}),
        finds: findsByUser[me] ?? [],
        rarity: Object.fromEntries(compendium.map((c) => [c.id, c.rarity])),
        itemsByPlace,
        checks: checksByUser[me] ?? [],
        bucket,
        matches: matchesFrom(ok(votesR, []), memberIds),
        savedIdeas: ok(ideasR, []),
        // Omdömen räknas på den som skrev dem. Solo: alla i sologruppen är ens egna.
        reviews: mode === 'solo' ? reviews : reviews.filter((r) => r.created_by === me),
        collectionEntries: collections.flatMap((c) => c.entries),
        expensesByTrip,
        memberIds,
        packing: ok(packR, {}),
        vault: ok(vaultR, []).filter((v) => v.kind !== CHECK_KIND),
        customPalette,
      };
      setData({
        input,
        places,
        compendium,
        trips,
        bucket,
        collections,
        reviews,
        statusRows,
        memberIds,
        groupId: gid,
        findsByUser,
        checksByUser,
        customPaletteByUser,
      });
    })();
    return () => {
      alive = false;
    };
  }, [me, gid, mode, memberKey, customPalette, countryList, splitCountries, n, lang]);

  return { data, reload };
}
