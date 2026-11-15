// Läser .env.local för skripten i scripts/ utan att skriva ut något av innehållet.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Läser en fil som UTF-8 och tar bort ett eventuellt BOM-tecken. */
export async function readUtf8(path) {
  return (await readFile(path, 'utf8')).replace(/^﻿/, '');
}

/** Variablerna i .env.local som ett objekt. */
export async function readEnv(root) {
  let text = '';
  try {
    text = await readUtf8(join(root, '.env.local'));
  } catch {
    throw new Error('.env.local saknas');
  }
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

/**
 * Supabase-klient med den hemliga nyckeln, bara för skript. Svarar med { db } eller { error } med ett
 * meddelande utan nyckelns värde.
 */
export async function secretClient(root) {
  const env = await readEnv(root);
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { error: 'VITE_SUPABASE_URL eller SUPABASE_SECRET_KEY saknas i .env.local.' };
  if (!key.startsWith('sb_secret_')) return { error: 'SUPABASE_SECRET_KEY ska vara en ny hemlig nyckel (sb_secret_...).' };
  const { createClient } = await import('@supabase/supabase-js');
  return { db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
