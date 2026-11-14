// Läser .env.local för röktestet. Bara de rader som behövs, och inget skrivs ut.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(): Record<string, string> {
  let text = '';
  try {
    text = readFileSync(join(process.cwd(), '.env.local'), 'utf8').replace(/^﻿/, '');
  } catch {
    return {};
  }
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const env = readEnv();

export const hasTestAccount = Boolean(env.TEST_EMAIL && env.TEST_PASSWORD && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);

/** Uppgifterna lämnas bara ut till inloggningen. */
export const credentials = () => ({
  email: env.TEST_EMAIL ?? '',
  password: env.TEST_PASSWORD ?? '',
});

/** Supabase som testanvändaren (publicerbar nyckel och RLS), för ögonblicksbild och städning. */
export async function testClient(): Promise<{
  db: SupabaseClient;
  userId: string;
}> {
  const db = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.signInWithPassword(credentials());
  // Bara felkoden, aldrig uppgifterna.
  if (error || !data.user) throw new Error(`Inloggningen med testkontot misslyckades (${error?.code ?? 'okänt'})`);
  return { db, userId: data.user.id };
}
