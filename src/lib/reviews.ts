// Vår guide (reviews): gruppens egna betyg och anteckningar per ställe.
// Synligheten offentlig finns i tabellen men erbjuds inte i appen, bara privat och grupp.
import { supabase } from './supabase';
import { LOCALE } from './locale';

export type ReviewVisibility = 'privat' | 'grupp';
export const REVIEW_VISIBILITY: ReviewVisibility[] = ['privat', 'grupp'];

export interface Review {
  id: string;
  group_id: string;
  place_id: string | null;
  name: string;
  rating: number | null;
  note: string | null;
  visibility: 'privat' | 'grupp' | 'offentlig';
  created_by: string | null;
  created_at: string;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/**
 * Gruppens omdömen. Andras privata omdömen tas bort här också, så att de inte syns
 * även om databasens regler (RLS) ännu inte skiljer på privat och grupp.
 */
export async function fetchReviews(groupId: string, me: string): Promise<Review[]> {
  const rows = must(await supabase.from('reviews').select('*').eq('group_id', groupId).order('created_at', { ascending: false })) as Review[];
  return visibleReviews(rows, me);
}

export const visibleReviews = <T extends Pick<Review, 'visibility' | 'created_by'>>(rows: T[], me: string) =>
  rows.filter((r) => r.visibility !== 'privat' || r.created_by === me);

export type ReviewInput = Pick<Review, 'name' | 'place_id' | 'rating' | 'note'> & { visibility: ReviewVisibility };

export async function addReview(groupId: string, me: string, r: ReviewInput): Promise<Review> {
  return must(await supabase.from('reviews').insert({ ...r, group_id: groupId, created_by: me }).select('*').single()) as Review;
}

export async function updateReview(id: string, r: ReviewInput): Promise<Review> {
  return must(await supabase.from('reviews').update(r).eq('id', id).select('*').single()) as Review;
}

export async function deleteReview(id: string): Promise<void> {
  must(await supabase.from('reviews').delete().eq('id', id));
}

/** Sökning på ställe, plats och anteckning, utan hänsyn till stora och små bokstäver. */
export function searchReviews<T extends Pick<Review, 'name' | 'note' | 'place_id'>>(rows: T[], q: string, placeName: (id: string) => string): T[] {
  const s = q.trim().toLocaleLowerCase(LOCALE);
  if (!s) return rows;
  return rows.filter((r) =>
    [r.name, r.note ?? '', r.place_id ? placeName(r.place_id) : ''].some((x) => x.toLocaleLowerCase(LOCALE).includes(s)),
  );
}
