// Idag mot Supabase: sparade platser (saved_locations, egna) och sparade idéer (saved_ideas, gruppens).
// Behörigheten avgörs av RLS: saved_locations är egna (user_id), saved_ideas gruppens (is_member).
import { supabase } from './supabase';
import { DbError, isOldSchema } from './trips';

export interface SavedLocation {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  is_home: boolean;
}

export interface SavedIdea {
  id: string;
  group_id: string;
  idea_id: string | null;
  title: string | null;
  done_on: string | null;
  /** Tidpunkten idén markerades som gjord. Finns när SQL-blocket från Körning 5 är kört. */
  done_at?: string | null;
  created_at: string;
}

const OLD = new Set(['PGRST204', 'PGRST205', '42703', '42P01', '23514']);

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new DbError(res.error.message, res.error.code, OLD.has(res.error.code ?? ''));
  return res.data as T;
}

// ---------- Sparade platser ----------

export async function fetchSavedLocations(userId: string): Promise<SavedLocation[]> {
  return must(await supabase.from('saved_locations').select('id, name, lat, lon, is_home').eq('user_id', userId).order('name')) as SavedLocation[];
}

export async function addSavedLocation(userId: string, name: string, lat: number | null, lon: number | null): Promise<SavedLocation> {
  return must(
    await supabase.from('saved_locations').insert({ user_id: userId, name, lat, lon, is_home: false }).select('id, name, lat, lon, is_home').single(),
  ) as SavedLocation;
}

export async function deleteSavedLocation(id: string): Promise<void> {
  must(await supabase.from('saved_locations').delete().eq('id', id));
}

// ---------- Sparade idéer ----------

export async function fetchSavedIdeas(groupId: string): Promise<SavedIdea[]> {
  return must(await supabase.from('saved_ideas').select('*').eq('group_id', groupId).order('created_at', { ascending: false })) as SavedIdea[];
}

/** Sparar en idé ur innehållet. Titeln sparas också, så att raden går att läsa även om idén ändras. */
export async function saveIdea(groupId: string, ideaId: string, title: string, done = false): Promise<SavedIdea> {
  const row: Record<string, unknown> = { group_id: groupId, idea_id: ideaId, title };
  if (done) Object.assign(row, doneFields(true));
  try {
    return must(await supabase.from('saved_ideas').insert(row).select('*').single()) as SavedIdea;
  } catch (e) {
    if (!done || !isOldSchema(e)) throw e;
    delete row.done_at;
    return must(await supabase.from('saved_ideas').insert(row).select('*').single()) as SavedIdea;
  }
}

function doneFields(done: boolean, now = new Date()) {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return done ? { done_on: d, done_at: now.toISOString() } : { done_on: null, done_at: null };
}

/**
 * Markerar en sparad idé som gjord (eller inte). Tidpunkten sparas i done_at för märket Vardagsäventyraren.
 * Saknar databasen done_at (SQL-blocket inte kört) sparas bara datumet i done_on.
 */
export async function setIdeaDone(id: string, done: boolean): Promise<SavedIdea> {
  const fields: Record<string, unknown> = doneFields(done);
  try {
    return must(await supabase.from('saved_ideas').update(fields).eq('id', id).select('*').single()) as SavedIdea;
  } catch (e) {
    if (!isOldSchema(e)) throw e;
    delete fields.done_at;
    return must(await supabase.from('saved_ideas').update(fields).eq('id', id).select('*').single()) as SavedIdea;
  }
}

export async function deleteSavedIdea(id: string): Promise<void> {
  must(await supabase.from('saved_ideas').delete().eq('id', id));
}
