// Platsstatus (place_status), avbockningar (item_checks) och fynd (finds) för den inloggade användaren.
// En liten delad butik, så att kartan, listan, landssidan och samlingsboken visar samma sak utan att hämta om.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { isStatus, type PlaceStatus, type StatusMap } from './statusLogic';
import { togetherFor, toRows, type StatusRow } from './togetherLogic';

export { countryIdFor, groupByStatus, isStatus, shouldMarkPlanned, STATUS_KEY, STATUSES, type PlaceStatus } from './statusLogic';

export interface Find {
  /** Tomt när man inte vet när kortet hittades (samling.vet-inte-nar). */
  found_on: string | null;
  place_id: string | null;
}

interface State {
  userId: string | null;
  loaded: boolean;
  statuses: StatusMap;
  /** together_group per plats: gruppens id när platsen besöktes tillsammans. Saknas: på egen hand. */
  together: Record<string, string>;
  checks: Set<string>;
  finds: Record<string, Find>;
}

let state: State = { userId: null, loaded: false, statuses: {}, together: {}, checks: new Set(), finds: {} };
const listeners = new Set<() => void>();
const emit = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let loading: Promise<void> | null = null;

async function load(userId: string) {
  const [s, c, f] = await Promise.all([
    supabase.from('place_status').select('place_id, status, together_group').eq('user_id', userId),
    supabase.from('item_checks').select('item_id').eq('user_id', userId),
    supabase.from('finds').select('compendium_id, found_on, place_id').eq('user_id', userId),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (c.error) throw new Error(c.error.message);
  if (f.error) throw new Error(f.error.message);
  const statuses: StatusMap = {};
  const together: Record<string, string> = {};
  for (const r of s.data as { place_id: string; status: string; together_group: string | null }[]) {
    if (!isStatus(r.status)) continue;
    statuses[r.place_id] = r.status;
    if (r.together_group) together[r.place_id] = r.together_group;
  }
  const finds: Record<string, Find> = {};
  for (const r of f.data as ({ compendium_id: string } & Find)[]) finds[r.compendium_id] = { found_on: r.found_on, place_id: r.place_id };
  emit({ userId, loaded: true, statuses, together, checks: new Set((c.data as { item_id: string }[]).map((r) => r.item_id)), finds });
}

/** Hämtar användarens status, avbockningar och fynd en gång per inloggning. */
export function useMyPlaces(userId: string | null) {
  const snap = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!userId) return;
    if (state.userId === userId && state.loaded) return;
    if (state.userId !== userId) emit({ userId, loaded: false, statuses: {}, together: {}, checks: new Set(), finds: {} });
    if (!loading) {
      loading = load(userId)
        .catch(() => emit({ ...state, loaded: true }))
        .finally(() => {
          loading = null;
        });
    }
  }, [userId]);
  return snap;
}

/**
 * Sätter eller tar bort status. Ändras direkt på skärmen och backas om sparandet misslyckas.
 * together är gruppens id (tillsammans), null (på egen hand) eller utelämnat (valet ligger kvar).
 * För vill åka och planerad blir together_group alltid tomt.
 */
export async function setPlaceStatus(placeId: string, status: PlaceStatus | null, together?: string | null): Promise<void> {
  const userId = state.userId;
  if (!userId) throw new Error('Inte inloggad');
  const before = { statuses: state.statuses, together: state.together };
  const statuses = { ...before.statuses };
  const nextTogether = { ...before.together };
  const group = togetherFor(status, together, before.together[placeId] ?? null);
  if (status) statuses[placeId] = status;
  else delete statuses[placeId];
  if (group) nextTogether[placeId] = group;
  else delete nextTogether[placeId];
  emit({ ...state, statuses, together: nextTogether });
  const res = status
    ? await supabase
        .from('place_status')
        .upsert({ user_id: userId, place_id: placeId, status, together_group: group }, { onConflict: 'user_id,place_id' })
    : await supabase.from('place_status').delete().eq('user_id', userId).eq('place_id', placeId);
  if (res.error) {
    emit({ ...state, ...before });
    throw new Error(res.error.message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Sparar ett fynd i samlingsboken. Finns det redan händer ingenting (inget dubbelt fynd).
 * Svarar sant om fyndet är nytt. foundOn null betyder att man inte vet när.
 */
export async function addFind(compendiumId: string, placeId: string | null, foundOn: string | null = today()): Promise<boolean> {
  return (await addFinds([{ compendiumId, placeId }], foundOn)).length > 0;
}

/**
 * Sparar flera fynd i ett enda anrop. Kort som redan är hittade hoppas över, och databasens
 * primärnyckel (user_id, compendium_id) stoppar dubbletter även om två anrop krockar.
 * Svarar med id för de fynd som är nya.
 */
export async function addFinds(list: { compendiumId: string; placeId: string | null }[], foundOn: string | null = today()): Promise<string[]> {
  const userId = state.userId;
  if (!userId) throw new Error('Inte inloggad');
  const fresh = list.filter((x, i) => !state.finds[x.compendiumId] && list.findIndex((y) => y.compendiumId === x.compendiumId) === i);
  if (!fresh.length) return [];
  const ids = fresh.map((x) => x.compendiumId);
  const added: Record<string, Find> = {};
  for (const x of fresh) added[x.compendiumId] = { found_on: foundOn, place_id: x.placeId };
  emit({ ...state, finds: { ...state.finds, ...added } });
  // finds.found_on får vara tomt (vet inte när), sedan SQL-blocket i Körning 8.
  const res = await supabase.from('finds').upsert(
    fresh.map((x) => ({ user_id: userId, compendium_id: x.compendiumId, found_on: foundOn, place_id: x.placeId })),
    { onConflict: 'user_id,compendium_id', ignoreDuplicates: true },
  );
  if (res.error) {
    const finds = { ...state.finds };
    for (const id of ids) delete finds[id];
    emit({ ...state, finds });
    throw new Error(res.error.message);
  }
  return ids;
}

/** Tar bort ett fynd ur samlingsboken. */
export async function removeFind(compendiumId: string): Promise<void> {
  const userId = state.userId;
  if (!userId) throw new Error('Inte inloggad');
  const before = state.finds;
  const finds = { ...before };
  delete finds[compendiumId];
  emit({ ...state, finds });
  const res = await supabase.from('finds').delete().eq('user_id', userId).eq('compendium_id', compendiumId);
  if (res.error) {
    emit({ ...state, finds: before });
    throw new Error(res.error.message);
  }
}

/**
 * Bockar av eller tar bort en avbockning på en listpunkt. Har punkten ett compendium_id skapas fyndet
 * i samma steg. Tas avbockningen bort ligger fyndet kvar. Svarar med compendium_id om fyndet är nytt.
 */
export async function setItemCheck(
  item: { id: string; place_id: string; compendium_id: string | null },
  done: boolean,
): Promise<string | null> {
  const userId = state.userId;
  if (!userId) throw new Error('Inte inloggad');
  const before = state.checks;
  const checks = new Set(before);
  if (done) checks.add(item.id);
  else checks.delete(item.id);
  emit({ ...state, checks });
  const res = done
    ? await supabase.from('item_checks').upsert({ user_id: userId, item_id: item.id }, { onConflict: 'user_id,item_id' })
    : await supabase.from('item_checks').delete().eq('user_id', userId).eq('item_id', item.id);
  if (res.error) {
    emit({ ...state, checks: before });
    throw new Error(res.error.message);
  }
  if (done && item.compendium_id) return (await addFind(item.compendium_id, item.place_id)) ? item.compendium_id : null;
  return null;
}

/**
 * Gruppmedlemmarnas status (inte den egna), per user_id och som rader med together_group. RLS släpper bara igenom
 * status som inte är privat och bara för personer man delar grupp med.
 */
export function useMemberStatuses(memberIds: string[]): { loaded: boolean; byUser: Record<string, StatusMap>; rows: StatusRow[] } {
  const key = [...memberIds].sort().join(',');
  const [res, setRes] = useState<{ key: string; byUser: Record<string, StatusMap>; rows: StatusRow[] }>({ key: '', byUser: {}, rows: [] });
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setRes({ key, byUser: {}, rows: [] });
      return;
    }
    let alive = true;
    supabase
      .from('place_status')
      .select('user_id, place_id, status, together_group')
      .in('user_id', ids)
      .then(({ data, error }) => {
        if (!alive) return;
        const byUser: Record<string, StatusMap> = {};
        for (const id of ids) byUser[id] = {};
        const rows = error ? [] : toRows(data as Parameters<typeof toRows>[0]).filter((r) => byUser[r.user_id]);
        for (const r of rows) byUser[r.user_id][r.place_id] = r.status;
        setRes({ key, byUser, rows });
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return { loaded: res.key === key, byUser: res.byUser, rows: res.rows };
}

/**
 * Gruppmedlemmarnas fynd (inte de egna), per user_id och kort. Bara läsning: RLS (finds.group_read)
 * släpper igenom fynd som inte är privata och bara för personer man delar grupp med.
 */
export function useMemberFinds(memberIds: string[]): { loaded: boolean; byUser: Record<string, Record<string, Find>> } {
  const key = [...memberIds].sort().join(',');
  const [res, setRes] = useState<{ key: string; byUser: Record<string, Record<string, Find>> }>({ key: '', byUser: {} });
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setRes({ key, byUser: {} });
      return;
    }
    let alive = true;
    supabase
      .from('finds')
      .select('user_id, compendium_id, found_on, place_id')
      .in('user_id', ids)
      .then(({ data, error }) => {
        if (!alive) return;
        const byUser: Record<string, Record<string, Find>> = {};
        for (const id of ids) byUser[id] = {};
        if (!error)
          for (const r of data as ({ user_id: string; compendium_id: string } & Find)[])
            if (byUser[r.user_id]) byUser[r.user_id][r.compendium_id] = { found_on: r.found_on, place_id: r.place_id };
        setRes({ key, byUser });
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return { loaded: res.key === key, byUser: res.byUser };
}
