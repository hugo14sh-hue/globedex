// Läser content/??.json och content/_bucket.json till Supabase (upsert på id).
// Kontrollerar också content/_packlista.json, content/_innan-avresa.json och content/_valutor.json, som appen läser in vid bygget.
// Körs lokalt av Hugo: npm run import (skriver) eller npm run import:check (bara validering).
// Nyckeln SUPABASE_SECRET_KEY läses ur .env.local och skrivs aldrig ut.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ORDER, TABLES, formatError, toDbRow, validateContent, validatePackList, validatePretripList, validateRates } from './lib/validate-content.mjs';
import { compareTexts, formatTextError } from './lib/validate-texts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const checkOnly = process.argv.includes('--check');

/** Läser en fil som UTF-8 och tar bort ett eventuellt BOM-tecken. */
async function readUtf8(path) {
  return (await readFile(path, 'utf8')).replace(/^﻿/, '');
}

async function readJson(name) {
  const text = await readUtf8(join(contentDir, name));
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${name}: ogiltig JSON (${e.message})`);
  }
}

/** Läser .env.local utan att skriva ut något av innehållet. */
async function readEnv() {
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

async function main() {
  const files = (await readdir(contentDir)).filter((f) => /^[A-Z]{2}\.json$/.test(f)).sort();
  const parsed = [];
  for (const name of files) parsed.push({ name, json: await readJson(name) });
  const bucket = { name: '_bucket.json', json: await readJson('_bucket.json') };

  const { errors, rows } = validateContent(parsed, bucket);

  // Filerna som appen läser in vid bygget. De importeras inte, men kontrolleras här. Saknas en fil hoppas den över.
  const appLists = [];
  for (const [name, validate] of [['_packlista.json', validatePackList], ['_innan-avresa.json', validatePretripList]]) {
    if (!(await readdir(contentDir)).includes(name)) continue;
    const json = await readJson(name);
    errors.push(...validate(name, json));
    appLists.push([name, Array.isArray(json?.items) ? json.items.length : 0]);
  }
  // Valutakurserna för priser i kronor. Läses in i appen vid bygget.
  if ((await readdir(contentDir)).includes('_valutor.json')) {
    const json = await readJson('_valutor.json');
    errors.push(...validateRates('_valutor.json', json));
    appLists.push(['_valutor.json', json?.sek_per && typeof json.sek_per === 'object' ? Object.keys(json.sek_per).length : 0]);
  }
  // Gränssnittets texter på svenska och engelska: samma nycklar, form, platshållare och märken.
  const textErrors = compareTexts(await readJson('_texter.json'), await readJson('_texter.en.json'));
  if (errors.length || textErrors.length) {
    console.error(`Valideringen stoppade importen: ${errors.length + textErrors.length} fel. Inget har skrivits.`);
    for (const e of errors) console.error(`  ${formatError(e)}`);
    for (const e of textErrors) console.error(`  ${formatTextError(e)}`);
    return 1;
  }

  const counts = [...ORDER.map((p) => [TABLES[p], rows[p].length]), ['bucket_catalog', rows.bucket.length]];
  console.log(`Valideringen gick igenom (${files.length} länder).`);
  for (const [table, n] of counts) console.log(`  ${table}: ${n}`);
  for (const [name, n] of appLists) console.log(`  ${name}: ${n} (läses in i appen vid bygget)`);
  console.log('  _texter.json och _texter.en.json: samma nycklar, form, platshållare och märken');
  if (checkOnly) return 0;

  const env = await readEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL eller SUPABASE_SECRET_KEY saknas i .env.local.');
    return 1;
  }
  if (!key.startsWith('sb_secret_')) {
    console.error('SUPABASE_SECRET_KEY ska vara en ny hemlig nyckel (sb_secret_...).');
    return 1;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  async function upsert(table, list) {
    // Små omgångar så att ett fel pekar ut ungefär var det sitter.
    for (let i = 0; i < list.length; i += 200) {
      const chunk = list.slice(i, i + 200);
      const { error } = await db.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) throw new Error(`${table}: ${error.message} (rader ${i + 1}–${i + chunk.length})`);
    }
  }

  try {
    // Platser i nivåordning, så att en plats aldrig skrivs före sin förälder.
    for (const part of ORDER) await upsert(TABLES[part], rows[part].map((r) => toDbRow(part, r)));
    await upsert('bucket_catalog', rows.bucket.map((r) => toDbRow('bucket', r)));
  } catch (e) {
    console.error(`Importen avbröts: ${e.message}`);
    return 1;
  }

  console.log('Importen är klar. Rader i databasen:');
  for (const [table] of counts) {
    const { count, error } = await db.from(table).select('id', { count: 'exact', head: true });
    console.log(`  ${table}: ${error ? `fel (${error.message || error.code})` : count}`);
  }

  // Kontroll av å, ä och ö: namnen i databasen ska vara exakt som i filerna.
  const withDiacritics = rows.places.filter((p) => /[åäöÅÄÖ]/.test(p.name));
  const { data: back, error: backErr } = await db.from('places').select('id, name').in('id', withDiacritics.map((p) => p.id));
  if (backErr) {
    console.error(`Kunde inte läsa tillbaka platserna: ${backErr.message}`);
    return 1;
  }
  const wrong = withDiacritics.filter((p) => back.find((b) => b.id === p.id)?.name !== p.name);
  const boras = back.find((b) => b.id === 'SE-boras');
  if (boras) console.log(`  Kontroll: ${boras.id} heter ${boras.name} i databasen.`);
  if (wrong.length) {
    console.error(`Fel tecken i ${wrong.length} namn: ${wrong.map((p) => p.id).join(', ')}`);
    return 1;
  }
  console.log(`  Å, ä och ö är rätt i alla ${withDiacritics.length} platsnamn som har dem.`);
  return 0;
}

// exitCode i stället för process.exit: på Windows kraschar Node annars när nätverket stängs.
process.exitCode = await main();
