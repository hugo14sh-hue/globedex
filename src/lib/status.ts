// Platsstatus (place_status), avbockningar (item_checks) och fynd (finds) för den inloggade användaren.
// En liten delad butik, så att kartan, listan, landssidan och samlingsboken visar samma sak utan att hämta om.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { isStatus, type PlaceStatus, type StatusMap } from './statusLogic';

export { groupByStatus, isStatus, STATUS_KEY, STATUSES, type PlaceStatus } from './statusLogic';

export interface Find {
  found_on: string;
  place_id: string | null;
}

interface State {
  userId: string | null;
  loaded: boolean;
  statuses: StatusMap;
  checks: Set<string>;
  finds: Record<string, Find>;
}

let state: State = { userId: null, loaded: false, statuses: {}, checks: new Set(), finds: {} };
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
    supabase.from('place_status').select('place_id, status').eq('user_id', userId),
    supabase.from('item_checks').select('item_id').eq('user_id', userId),
    supabase.from('finds').select('compendium_id, found_on, place_id').eq('user_id', userId),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (c.error) throw new Error(c.error.message);
  if (f.error) throw new Error(f.error.message);
  const statuses: StatusMap = {};
  for (const r of s.data as { place_id: string; status: string }[]) if (isStatus(r.status)) statuses[r.place_id] = r.status;
  const finds: Record<string, Find> = {};
  for (const r of f.data as ({ compendium_id: string } & Find)[]) finds[r.compendium_id] = { found_on: r.found_on, place_id: r.place_id };
  emit({ userId, loaded: true, statuses, checks: new Set((c.data as { item_id: string }[]).map((r) => r.item_id)), finds });
}

/** Hämtar användarens status, avbockningar och fynd en gång per inloggning. */
export function useMyPlaces(userId: string | null) {
  const snap = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!userId) return;
    if (state.userId === userId && state.loaded) return;
    if (state.userId !== userId) emit({ userId, loaded: false, statuses: {}, checks: new Set(), finds: {} });
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

/** Sätter eller tar bort status. Ändras direkt på skärmen och backas om sparandet misslyckas. */
export async function setPlaceStatus(placeId: string, status: PlaceStatus | null): Promise<void> {
  const userId = state.userId;
  if (!userId) throw new Error('Inte inloggad');
  const before = state.statuses;
  const statuses = { ...before };
  if (status) statuses[placeId] = status;
  else delete statuses[placeId];
  emit({ ...state, statuses });
  const res = status
    ? await supabase.from('place_status').upsert({ user_id: userId, place_id: placeId, status }, { onConflict: 'user_id,place_id' })
    : await supabase.from('place_status').delete().eq('user_id', userId).eq('place_id', placeId);
  if (res.error) {
    emit({ ...state, statuses: before });
    throw new Error(res.error.message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Sparar ett fynd i samlingsboken. Finns det redan händer ingenting (inget dubbelt fynd).
 * Svarar sant om fyndet är nytt.
 */
export async function addFind(compendiumId: string, placeId: string | null): Promise<boolean> {
  const userId = state.userId;
  if (!userId) throw new Error('Inte inloggad');
  if (state.finds[compendiumId]) return false;
  const find: Find = { found_on: today(), place_id: placeId };
  emit({ ...state, finds: { ...state.finds, [compendiumId]: find } });
  const res = await supabase
    .from('finds')
    .upsert({ user_id: userId, compendium_id: compendiumId, ...find }, { onConflict: 'user_id,compendium_id', ignoreDuplicates: true });
  if (res.error) {
    const finds = { ...state.finds };
    delete finds[compendiumId];
    emit({ ...state, finds });
    throw new Error(res.error.message);
  }
  return true;
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
 * Gruppmedlemmarnas status (inte den egna), per user_id. RLS släpper bara igenom
 * status som inte är privat och bara för personer man delar grupp med.
 */
export function useMemberStatuses(memberIds: string[]): { loaded: boolean; byUser: Record<string, StatusMap> } {
  const key = [...memberIds].sort().join(',');
  const [res, setRes] = useState<{ key: string; byUser: Record<string, StatusMap> }>({ key: '', byUser: {} });
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setRes({ key, byUser: {} });
      return;
    }
    let alive = true;
    supabase
      .from('place_status')
      .select('user_id, place_id, status')
      .in('user_id', ids)
      .then(({ data, error }) => {
        if (!alive) return;
        const byUser: Record<string, StatusMap> = {};
        for (const id of ids) byUser[id] = {};
        if (!error)
          for (const r of data as { user_id: string; place_id: string; status: string }[])
            if (isStatus(r.status) && byUser[r.user_id]) byUser[r.user_id][r.place_id] = r.status;
        setRes({ key, byUser });
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return { loaded: res.key === key, byUser: res.byUser };
}
