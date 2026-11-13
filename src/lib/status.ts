// Platsstatus (place_status) och avbockningar (item_checks) för den inloggade användaren.
// En liten delad butik, så att kartan, listan och landssidan visar samma sak utan att hämta om.
import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

export type PlaceStatus = 'bor' | 'bott' | 'besokt' | 'planerad' | 'vill' | 'mellan';

/** Ordningen i listan och i väljaren. */
export const STATUSES: PlaceStatus[] = ['bor', 'bott', 'besokt', 'planerad', 'vill', 'mellan'];

/** Textnyckel för varje status i content/_texter.json. */
export const STATUS_KEY: Record<PlaceStatus | 'ej', string> = {
  bor: 'karta.status.bor',
  bott: 'karta.status.har-bott',
  besokt: 'karta.status.besokt',
  planerad: 'karta.status.planerad',
  vill: 'karta.status.vill-aka',
  mellan: 'karta.status.mellanlandat',
  ej: 'karta.status.ej-satt',
};

export const isStatus = (v: unknown): v is PlaceStatus => STATUSES.includes(v as PlaceStatus);

/** Grupperar platser efter status i listans ordning. Tomma grupper tas bort. */
export function groupByStatus<T extends { status: PlaceStatus }>(rows: T[]): { status: PlaceStatus; rows: T[] }[] {
  return STATUSES.map((status) => ({ status, rows: rows.filter((r) => r.status === status) })).filter((g) => g.rows.length);
}

interface State {
  userId: string | null;
  loaded: boolean;
  statuses: Record<string, PlaceStatus>;
  checks: Set<string>;
}

let state: State = { userId: null, loaded: false, statuses: {}, checks: new Set() };
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
  const [s, c] = await Promise.all([
    supabase.from('place_status').select('place_id, status').eq('user_id', userId),
    supabase.from('item_checks').select('item_id').eq('user_id', userId),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (c.error) throw new Error(c.error.message);
  const statuses: Record<string, PlaceStatus> = {};
  for (const r of s.data as { place_id: string; status: string }[]) if (isStatus(r.status)) statuses[r.place_id] = r.status;
  emit({ userId, loaded: true, statuses, checks: new Set((c.data as { item_id: string }[]).map((r) => r.item_id)) });
}

/** Hämtar användarens status och avbockningar en gång per inloggning. */
export function useMyPlaces(userId: string | null) {
  const snap = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!userId) return;
    if (state.userId === userId && state.loaded) return;
    if (state.userId !== userId) emit({ userId, loaded: false, statuses: {}, checks: new Set() });
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

/** Bockar av eller tar bort en avbockning på en listpunkt. */
export async function setItemCheck(itemId: string, done: boolean): Promise<void> {
  const userId = state.userId;
  if (!userId) throw new Error('Inte inloggad');
  const before = state.checks;
  const checks = new Set(before);
  if (done) checks.add(itemId);
  else checks.delete(itemId);
  emit({ ...state, checks });
  const res = done
    ? await supabase.from('item_checks').upsert({ user_id: userId, item_id: itemId }, { onConflict: 'user_id,item_id' })
    : await supabase.from('item_checks').delete().eq('user_id', userId).eq('item_id', itemId);
  if (res.error) {
    emit({ ...state, checks: before });
    throw new Error(res.error.message);
  }
}
