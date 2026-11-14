// Ögonblicksbild före röktestet och städning efteråt. Allt som testet skapar tas bort, och platsstatus
// som testet ändrar läggs tillbaka. Valvet rörs bara om det var tomt före testet.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Snapshot {
  groupId: string;
  /** Profilens inställningar (tema och språk), som röktestet ändrar. */
  settings: unknown;
  statuses: Record<string, unknown>[];
  checks: string[];
  finds: string[];
  bucket: string[];
  trips: string[];
  savedIdeas: string[];
  vaultEmpty: boolean;
}

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function snapshot(db: SupabaseClient, userId: string): Promise<Snapshot> {
  const [profile] = await rows<{ active_group_id: string; settings: unknown }>(
    db.from('profiles').select('active_group_id, settings').eq('id', userId),
  );
  const groupId = profile.active_group_id;
  return {
    groupId,
    settings: profile.settings,
    statuses: await rows(db.from('place_status').select('*').eq('user_id', userId)),
    checks: (await rows<{ item_id: string }>(db.from('item_checks').select('item_id').eq('user_id', userId))).map((r) => r.item_id),
    finds: (await rows<{ compendium_id: string }>(db.from('finds').select('compendium_id').eq('user_id', userId))).map(
      (r) => r.compendium_id,
    ),
    bucket: (await rows<{ id: string }>(db.from('bucket_items').select('id').eq('group_id', groupId))).map((r) => r.id),
    trips: (await rows<{ id: string }>(db.from('trips').select('id').eq('group_id', groupId))).map((r) => r.id),
    savedIdeas: (await rows<{ id: string }>(db.from('saved_ideas').select('id').eq('group_id', groupId))).map((r) => r.id),
    vaultEmpty: (await rows(db.from('vault_items').select('id').eq('user_id', userId))).length === 0,
  };
}

const notIn = (ids: string[]) => `(${ids.map((x) => `"${x}"`).join(',')})`;

/** Tar bort det som testet skapade och lägger tillbaka platsstatus. Returnerar vad som städades. */
export async function restore(db: SupabaseClient, userId: string, s: Snapshot): Promise<string[]> {
  const done: string[] = [];
  const del = async (table: string, col: string, keep: string[], scope: [string, string]) => {
    let q = db.from(table).delete({ count: 'exact' }).eq(scope[0], scope[1]);
    if (keep.length) q = q.not(col, 'in', notIn(keep));
    const { error, count } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (count) done.push(`${table}: ${count}`);
  };
  await del('trips', 'id', s.trips, ['group_id', s.groupId]);
  await del('bucket_items', 'id', s.bucket, ['group_id', s.groupId]);
  await del('saved_ideas', 'id', s.savedIdeas, ['group_id', s.groupId]);
  await del('item_checks', 'item_id', s.checks, ['user_id', userId]);
  await del('finds', 'compendium_id', s.finds, ['user_id', userId]);
  await del(
    'place_status',
    'place_id',
    s.statuses.map((r) => String(r.place_id)),
    ['user_id', userId],
  );
  if (s.statuses.length) {
    const { error } = await db.from('place_status').upsert(s.statuses, { onConflict: 'user_id,place_id' });
    if (error) throw new Error(`place_status: ${error.message}`);
  }
  if (s.vaultEmpty) await del('vault_items', 'id', [], ['user_id', userId]);
  {
    const { error } = await db.from('profiles').update({ settings: s.settings }).eq('id', userId);
    if (error) throw new Error(`profiles: ${error.message}`);
    done.push('profilens inställningar');
  }
  return done;
}
