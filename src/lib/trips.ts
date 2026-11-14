// Resor mot Supabase: trips, trip_legs, bookings, expenses, packing_items, pretrip_items, shopping_items.
// Behörigheten avgörs av RLS i databasen: gruppens medlemmar (is_member) och resans delar (can_trip).
import { supabase } from './supabase';
import { packingStats } from './tripLogic';

export interface Trip {
  id: string;
  group_id: string;
  title: string;
  place_id: string | null;
  kind: 'resa' | 'utflykt';
  status: 'planerad' | 'pagar' | 'klar';
  start_date: string | null;
  end_date: string | null;
  from_airport: string | null;
  /** { total: kronor } och eventuellt belopp per kategori. */
  budget: Record<string, number>;
  shopping_budget_sek: number | null;
  created_by: string | null;
  created_at: string;
}

export const LEG_MODES = ['flyg', 'tag', 'bil', 'buss', 'bat', 'till-fots', 'annat'] as const;
export type LegMode = (typeof LEG_MODES)[number];

export interface Leg {
  id: string;
  trip_id: string;
  pos: number;
  mode: LegMode;
  from_text: string;
  to_text: string;
  from_lat: number | null;
  from_lon: number | null;
  to_lat: number | null;
  to_lon: number | null;
  depart_at: string | null;
  duration_min: number | null;
  distance_km: number | null;
  note: string | null;
}

/** Bokningstyper med texter i bokningar.typ.*. transport och aktivitet kräver SQL-blocket från Körning 4. */
export const BOOKING_KINDS = ['flyg', 'boende', 'transport', 'aktivitet', 'annat'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

export interface Booking {
  id: string;
  trip_id: string;
  kind: string;
  title: string;
  reference: string | null;
  starts_at: string | null;
  ends_at: string | null;
  address: string | null;
  /** Kolumnen kommer med SQL-blocket från Körning 4. */
  url?: string | null;
  file_path: string | null;
  note: string | null;
}

export interface Expense {
  id: string;
  trip_id: string;
  title: string;
  amount: number;
  currency: string;
  rate_to_sek: number;
  category: string | null;
  paid_by: string | null;
  split_between: string[];
  spent_on: string;
  created_at: string;
}

export interface PackItem {
  id: string;
  trip_id: string;
  grp: string;
  title: string;
  packed: boolean;
  packed_at?: string | null;
  owner: string | null;
  private: boolean;
  pos: number;
}

export interface PretripItem {
  id: string;
  trip_id: string;
  title: string;
  hint: string | null;
  done: boolean;
  removed: boolean;
  custom: boolean;
  pos: number;
}

export interface ShopItem {
  id: string;
  trip_id: string;
  user_id: string;
  title: string;
  price_sek: number;
  recipient_id: string | null;
  gift_tip_id: string | null;
  bought: boolean;
}

/** Fel från databasen. old betyder att databasen saknar en kolumn, tabell eller ett tillåtet värde. */
export class DbError extends Error {
  constructor(
    message: string,
    public code: string | undefined,
    public old: boolean,
  ) {
    super(message);
  }
}

/** Felkoder som betyder att SQL-blocket inte är kört: okänd kolumn, okänd tabell, värde som kontrollen nekar. */
const OLD_SCHEMA = new Set(['PGRST204', 'PGRST205', '42703', '42P01', '23514']);

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new DbError(res.error.message, res.error.code, OLD_SCHEMA.has(res.error.code ?? ''));
  return res.data as T;
}

/** Sant om felet beror på att databasen inte har uppdaterats med SQL-blocket. */
export const isOldSchema = (e: unknown) => e instanceof DbError && e.old;

const num = (v: unknown) => (v == null ? null : Number(v));

// ---------- Resor ----------

export async function fetchTrips(groupId: string): Promise<Trip[]> {
  return must(await supabase.from('trips').select('*').eq('group_id', groupId).order('start_date', { nullsFirst: false })) as Trip[];
}

export async function fetchTrip(id: string): Promise<Trip | null> {
  return must(await supabase.from('trips').select('*').eq('id', id).maybeSingle()) as Trip | null;
}

export type NewTrip = Pick<Trip, 'group_id' | 'title' | 'place_id' | 'start_date' | 'end_date' | 'from_airport' | 'budget'> &
  Partial<Pick<Trip, 'status' | 'kind'>> & { created_by: string };

export type NewLeg = Omit<Leg, 'id' | 'trip_id'>;

/** Skapar resan och dess etapper. Misslyckas etapperna tas resan bort igen, så att inget halvt sparas. */
export async function createTrip(trip: NewTrip, legs: NewLeg[]): Promise<Trip> {
  const row = must(await supabase.from('trips').insert(trip).select('*').single()) as Trip;
  if (legs.length) {
    const res = await supabase.from('trip_legs').insert(legs.map((l) => ({ ...l, trip_id: row.id })));
    if (res.error) {
      await supabase.from('trips').delete().eq('id', row.id);
      must(res);
    }
  }
  return row;
}

export async function updateTrip(id: string, patch: Partial<Omit<Trip, 'id' | 'group_id' | 'created_at' | 'created_by'>>): Promise<Trip> {
  return must(await supabase.from('trips').update(patch).eq('id', id).select('*').single()) as Trip;
}

export async function deleteTrip(id: string): Promise<void> {
  must(await supabase.from('trips').delete().eq('id', id));
}

// ---------- Etapper ----------

export async function fetchLegs(tripId: string): Promise<Leg[]> {
  const rows = must(await supabase.from('trip_legs').select('*').eq('trip_id', tripId).order('pos')) as Leg[];
  return rows.map((l) => ({ ...l, distance_km: num(l.distance_km) }));
}

/** Etapper för flera resor på en gång (översikten). */
export async function fetchLegCounts(tripIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!tripIds.length) return out;
  const rows = must(await supabase.from('trip_legs').select('trip_id').in('trip_id', tripIds)) as { trip_id: string }[];
  for (const r of rows) out[r.trip_id] = (out[r.trip_id] ?? 0) + 1;
  return out;
}

export async function addLeg(tripId: string, leg: NewLeg): Promise<Leg> {
  return must(await supabase.from('trip_legs').insert({ ...leg, trip_id: tripId }).select('*').single()) as Leg;
}

export async function updateLeg(id: string, patch: Partial<NewLeg>): Promise<void> {
  must(await supabase.from('trip_legs').update(patch).eq('id', id));
}

export async function deleteLeg(id: string): Promise<void> {
  must(await supabase.from('trip_legs').delete().eq('id', id));
}

// ---------- Bokningar ----------

export async function fetchBookings(tripId: string): Promise<Booking[]> {
  return must(await supabase.from('bookings').select('*').eq('trip_id', tripId).order('starts_at', { nullsFirst: false })) as Booking[];
}

export type NewBooking = Omit<Booking, 'id' | 'trip_id'>;

/** url skickas bara när den finns, så att bokningar fungerar innan kolumnen finns i databasen. */
function bookingPayload(b: Partial<NewBooking>) {
  const { url, ...rest } = b;
  return url ? { ...rest, url } : rest;
}

export async function addBooking(tripId: string, b: NewBooking): Promise<Booking> {
  return must(await supabase.from('bookings').insert({ ...bookingPayload(b), trip_id: tripId }).select('*').single()) as Booking;
}

export async function updateBooking(id: string, b: Partial<NewBooking>, hadUrl: boolean): Promise<void> {
  // En länk som tas bort måste skickas som null, annars ligger den kvar.
  const payload = hadUrl && !b.url ? { ...bookingPayload(b), url: null } : bookingPayload(b);
  must(await supabase.from('bookings').update(payload).eq('id', id));
}

export async function deleteBooking(id: string): Promise<void> {
  must(await supabase.from('bookings').delete().eq('id', id));
}

// ---------- Bokningsfiler (Supabase Storage) ----------

export const BOOKING_BUCKET = 'bokningar';

let bucketCheck: Promise<boolean> | null = null;

/** Sant om den privata bucketen finns. Utan SQL-blocket: false, och bokningar fungerar utan fil. */
export function hasBookingFiles(): Promise<boolean> {
  if (!bucketCheck) {
    bucketCheck = supabase.storage
      .from(BOOKING_BUCKET)
      .list('', { limit: 1 })
      .then(({ error }) => !error)
      .catch(() => false);
    bucketCheck.then((ok) => {
      if (!ok) bucketCheck = null;
    });
  }
  return bucketCheck;
}

/** Laddar upp filen under resans mapp. Svarar med sökvägen som sparas i bookings.file_path. */
export async function uploadBookingFile(tripId: string, file: File): Promise<string> {
  const safe = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '-').slice(-80) || 'fil';
  const path = `${tripId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(BOOKING_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new DbError(error.message, undefined, false);
  return path;
}

/** Tillfällig länk (en minut) till en sparad fil. */
export async function bookingFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BOOKING_BUCKET).createSignedUrl(path, 60);
  if (error || !data) throw new DbError(error?.message ?? 'Ingen länk', undefined, false);
  return data.signedUrl;
}

export async function removeBookingFile(path: string): Promise<void> {
  await supabase.storage.from(BOOKING_BUCKET).remove([path]);
}

// ---------- Utgifter ----------

export async function fetchExpenses(tripId: string): Promise<Expense[]> {
  const rows = must(await supabase.from('expenses').select('*').eq('trip_id', tripId).order('spent_on').order('created_at')) as Expense[];
  return rows.map((e) => ({ ...e, amount: Number(e.amount), rate_to_sek: Number(e.rate_to_sek), split_between: e.split_between ?? [] }));
}

export type NewExpense = Omit<Expense, 'id' | 'trip_id' | 'created_at'>;

export async function addExpense(tripId: string, e: NewExpense): Promise<void> {
  must(await supabase.from('expenses').insert({ ...e, trip_id: tripId }));
}

export async function deleteExpense(id: string): Promise<void> {
  must(await supabase.from('expenses').delete().eq('id', id));
}

/** Summa utgifter i kronor per resa (översikten). */
export async function fetchExpenseRows(tripIds: string[]): Promise<Pick<Expense, 'trip_id' | 'amount' | 'rate_to_sek' | 'paid_by' | 'split_between'>[]> {
  if (!tripIds.length) return [];
  const rows = must(await supabase.from('expenses').select('trip_id, amount, rate_to_sek, paid_by, split_between').in('trip_id', tripIds)) as Expense[];
  return rows.map((e) => ({ ...e, amount: Number(e.amount), rate_to_sek: Number(e.rate_to_sek), split_between: e.split_between ?? [] }));
}

// ---------- Listor på resan ----------

type ListTable = 'packing_items' | 'pretrip_items' | 'shopping_items';

export async function fetchList<T>(table: ListTable, tripId: string): Promise<T[]> {
  const q = supabase.from(table).select('*').eq('trip_id', tripId);
  return must(await (table === 'shopping_items' ? q.order('title') : q.order('pos'))) as T[];
}

/** Antal rader per resa (översikten). Packlistan: [packat, totalt]. */
export async function fetchListCounts(table: ListTable, tripIds: string[]): Promise<Record<string, [number, number]>> {
  const out: Record<string, [number, number]> = {};
  if (!tripIds.length) return out;
  const flag = table === 'packing_items' ? 'packed' : table === 'pretrip_items' ? 'done' : 'bought';
  const cols = table === 'pretrip_items' ? `trip_id, ${flag}, removed` : `trip_id, ${flag}`;
  const rows = must(await supabase.from(table).select(cols).in('trip_id', tripIds)) as unknown as Record<string, unknown>[];
  for (const r of rows) {
    if (r.removed) continue;
    const id = String(r.trip_id);
    const c = out[id] ?? [0, 0];
    if (r[flag]) c[0]++;
    c[1]++;
    out[id] = c;
  }
  return out;
}

/** Packlistan per resa med tidpunkten då sista raden packades (märket Färdigpackad). */
export async function fetchPackingStats(tripIds: string[]): Promise<Record<string, [number, number, string | null]>> {
  if (!tripIds.length) return {};
  const rows = must(await supabase.from('packing_items').select('trip_id, packed, packed_at').in('trip_id', tripIds)) as {
    trip_id: string;
    packed: boolean;
    packed_at: string | null;
  }[];
  return packingStats(rows);
}

export async function addListRows<T>(table: ListTable, rows: Record<string, unknown>[]): Promise<T[]> {
  if (!rows.length) return [];
  return must(await supabase.from(table).insert(rows).select('*')) as T[];
}

export async function updateListRow(table: ListTable, id: string, patch: Record<string, unknown>): Promise<void> {
  must(await supabase.from(table).update(patch).eq('id', id));
}

export async function deleteListRow(table: ListTable, id: string): Promise<void> {
  must(await supabase.from(table).delete().eq('id', id));
}

// ---------- Hemma ----------

export interface Home {
  name: string;
  lat: number | null;
  lon: number | null;
}

/** Användarens hemort (saved_locations med is_home), för första etappen. */
export async function fetchHome(userId: string): Promise<Home | null> {
  const { data } = await supabase.from('saved_locations').select('name, lat, lon').eq('user_id', userId).eq('is_home', true).limit(1).maybeSingle();
  return (data as Home | null) ?? null;
}
