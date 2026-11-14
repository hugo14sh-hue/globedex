import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createOfflineFetch } from './offline';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Sant om .env.local har URL och publik nyckel. */
export const supabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient = createClient(url || 'http://localhost', key || 'saknas', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Skrivningar utan uppkoppling stoppas innan de skickas (src/lib/offline.ts).
  global: { fetch: createOfflineFetch((...a) => fetch(...a)) },
});
