// Gruppens bucketlist, egna samlingar och swiperöster mot Supabase. RLS avgör vad som syns:
// bucket_items per grupp, collections bara egna, swipe_votes egna plus gruppmedlemmars.
import { supabase } from './supabase';
import type { BucketItem, Votes } from './listLogic';

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- Bucketlist ----------

export async function fetchBucketItems(groupId: string): Promise<BucketItem[]> {
  return must(await supabase.from('bucket_items').select('*').eq('group_id', groupId).order('created_at')) as BucketItem[];
}

export async function addBucketItem(row: {
  group_id: string;
  title: string;
  catalog_id?: string | null;
  category?: string | null;
  place_id?: string | null;
  created_by: string;
}): Promise<BucketItem> {
  // place_id skickas bara när den finns, så att listan fungerar även innan kolumnen finns i databasen.
  const { place_id, ...rest } = row;
  const payload = place_id ? { ...rest, place_id } : rest;
  return must(await supabase.from('bucket_items').insert(payload).select('*').single()) as BucketItem;
}

/** Bockar av med datum och valfri plats, eller ångrar (done_on null). */
export async function setBucketDone(id: string, doneOn: string | null, placeId: string | null): Promise<void> {
  const patch: Record<string, string | null> = { done_on: doneOn };
  if (placeId) patch.place_id = placeId;
  must(await supabase.from('bucket_items').update(patch).eq('id', id));
}

export async function deleteBucketItem(id: string): Promise<void> {
  must(await supabase.from('bucket_items').delete().eq('id', id));
}

// ---------- Samlingar ----------

export interface CollectionEntry {
  collection_id: string;
  place_id: string;
  got_on: string;
  note: string | null;
}

export interface Collection {
  id: string;
  name: string;
  created_at: string;
  entries: CollectionEntry[];
}

export async function fetchCollections(userId: string): Promise<Collection[]> {
  const rows = must(
    await supabase
      .from('collections')
      .select('id, name, created_at, collection_entries(collection_id, place_id, got_on, note)')
      .eq('user_id', userId)
      .order('created_at'),
  ) as (Omit<Collection, 'entries'> & { collection_entries: CollectionEntry[] | null })[];
  return rows.map(({ collection_entries, ...c }) => ({
    ...c,
    entries: [...(collection_entries ?? [])].sort((a, b) => b.got_on.localeCompare(a.got_on)),
  }));
}

export async function addCollection(userId: string, name: string): Promise<Collection> {
  const c = must(await supabase.from('collections').insert({ user_id: userId, name }).select('id, name, created_at').single()) as Omit<
    Collection,
    'entries'
  >;
  return { ...c, entries: [] };
}

export async function deleteCollection(id: string): Promise<void> {
  must(await supabase.from('collections').delete().eq('id', id));
}

/** En post per plats och samling: sparas om den redan finns. */
export async function saveEntry(e: CollectionEntry): Promise<void> {
  must(await supabase.from('collection_entries').upsert(e, { onConflict: 'collection_id,place_id' }));
}

export async function deleteEntry(collectionId: string, placeId: string): Promise<void> {
  must(await supabase.from('collection_entries').delete().eq('collection_id', collectionId).eq('place_id', placeId));
}

// ---------- Swipe ----------

/** Röster för gruppens medlemmar (inklusive den egna), per user_id. */
export async function fetchVotes(memberIds: string[]): Promise<Votes> {
  const out: Votes = {};
  for (const m of memberIds) out[m] = {};
  if (!memberIds.length) return out;
  const rows = must(await supabase.from('swipe_votes').select('user_id, catalog_id, wants').in('user_id', memberIds)) as {
    user_id: string;
    catalog_id: string;
    wants: boolean | null;
  }[];
  for (const r of rows) if (out[r.user_id]) out[r.user_id][r.catalog_id] = r.wants;
  return out;
}

/** wants null betyder kanske: kortet kommer tillbaka först när alla andra kort är slut. */
export async function saveVote(userId: string, id: string, wants: boolean | null): Promise<void> {
  must(
    await supabase
      .from('swipe_votes')
      .upsert({ user_id: userId, catalog_id: id, wants, voted_at: new Date().toISOString() }, { onConflict: 'user_id,catalog_id' }),
  );
}
