// Läser content/??.json, content/_upptack.json och content/_bucket.json till Supabase (upsert på id).
// _landlistor.json, fältet delade: delarna (England, Skottland, Wales, Nordirland) blir länder med landet som
// förälder, som länderna utan landsfil (scripts/lib/delade.mjs). Namnet kommer från land.<id> i _texter.json.
// _upptack.json: de lätta platserna blir städer under sitt land (data.light = true), befintliga städer får
// climate och tags i data och alternativen hamnar i data.alternatives på den dyrare platsen (scripts/lib/upptack.mjs).
// Kontrollerar också content/_packlista.json, content/_innan-avresa.json, content/_valutor.json och
// content/_landlistor.json, som appen läser in vid bygget.
// Körs lokalt av Hugo: npm run import (skriver) eller npm run import:check (bara validering).
// Nyckeln SUPABASE_SECRET_KEY läses ur .env.local och skrivs aldrig ut.
// Bildfälten i place_items (image_url, image_credit, image_license, image_page) skrivs aldrig här,
// bara av npm run import:images (toDbRow tar bort dem).
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { secretClient, readUtf8 } from './lib/env.mjs';
import { ORDER, TABLES, formatError, toDbRow, validateContent, validateCountryLists, validatePackList, validatePretripList, validateRates } from './lib/validate-content.mjs';
import { COUNTRIES } from '../src/lib/countries.ts';
import { compareTexts, formatTextError } from './lib/validate-texts.mjs';
import { applyPatches, discoverRows, validateDiscover } from './lib/upptack.mjs';
import { sortPlaces } from './lib/validate-content.mjs';
import { splitRows } from './lib/delade.mjs';
import { SPLIT_GEO } from '../src/lib/deladeGeo.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const checkOnly = process.argv.includes('--check');

async function readJson(name) {
  const text = await readUtf8(join(contentDir, name));
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${name}: ogiltig JSON (${e.message})`);
  }
}

async function main() {
  const files = (await readdir(contentDir)).filter((f) => /^[A-Z]{2}\.json$/.test(f)).sort();
  const parsed = [];
  for (const name of files) parsed.push({ name, json: await readJson(name) });
  const bucket = { name: '_bucket.json', json: await readJson('_bucket.json') };

  const { errors, rows } = validateContent(parsed, bucket);
  const textsSv = await readJson('_texter.json');
  const textsEn = await readJson('_texter.en.json');
  const svName = new Intl.DisplayNames('sv-SE', { type: 'region' });
  const countryCoords = (iso) => {
    const c = COUNTRIES.find(([x]) => x === iso);
    return c ? [c[1], c[2]] : null;
  };

  // Upptäck: lätta platser, klimat och taggar och alternativ. Saknas filen hoppas den över.
  let discover = null;
  if ((await readdir(contentDir)).includes('_upptack.json')) {
    const json = await readJson('_upptack.json');
    const contentPlaces = parsed.flatMap(({ json: j }) => (Array.isArray(j?.places) ? j.places : [])).filter((p) => p && typeof p.id === 'string');
    const before = errors.length;
    errors.push(...validateDiscover(json, COUNTRIES.map(([iso]) => iso), contentPlaces));
    if (errors.length === before) {
      discover = discoverRows(json, contentPlaces, (iso) => svName.of(iso) ?? iso, countryCoords);
      rows.places = sortPlaces([...applyPatches(rows.places, discover.patches), ...discover.countries, ...discover.cities]);
    }
  }

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
  // Vilka länder som räknas (FN:s medlemsländer och observatörer). Läses in i appen vid bygget.
  // Fältet delade blir dessutom platser: delarna som länder med landet som förälder.
  let split = [];
  {
    const json = await readJson('_landlistor.json');
    const before = errors.length;
    errors.push(...validateCountryLists('_landlistor.json', json, COUNTRIES.map(([iso]) => iso), { sv: textsSv?.texter, en: textsEn?.texter }));
    const n = (k) => (Array.isArray(json?.[k]) ? json[k].length : 0);
    const parts = Object.values(json?.delade ?? {}).flat().length;
    appLists.push(['_landlistor.json', `fn ${n('fn')}, fn_observatorer ${n('fn_observatorer')}, fn_plus_tw_xk ${n('fn_plus_tw_xk')}, delade ${parts}`]);
    if (errors.length === before && json.delade) {
      const partCoords = (id) => (SPLIT_GEO[id] ? [SPLIT_GEO[id].lat, SPLIT_GEO[id].lon] : null);
      for (const id of Object.values(json.delade).flat())
        if (!SPLIT_GEO[id]) errors.push({ file: '_landlistor.json', id, field: 'delade', message: 'ingen yta i src/lib/deladeGeo.ts: kör node scripts/make-delade.mjs' });
      split = splitRows(json.delade, rows.places.map((p) => p.id), textsSv.texter, (iso) => svName.of(iso) ?? iso, countryCoords, partCoords);
      rows.places = sortPlaces([...rows.places, ...split]);
    }
  }
  // Gränssnittets texter på svenska och engelska: samma nycklar, form, platshållare och märken.
  const textErrors = compareTexts(textsSv, textsEn);
  if (errors.length || textErrors.length) {
    console.error(`Valideringen stoppade importen: ${errors.length + textErrors.length} fel. Inget har skrivits.`);
    for (const e of errors) console.error(`  ${formatError(e)}`);
    for (const e of textErrors) console.error(`  ${formatTextError(e)}`);
    return 1;
  }

  const counts = [...ORDER.map((p) => [TABLES[p], rows[p].length]), ['bucket_catalog', rows.bucket.length]];
  console.log(`Valideringen gick igenom (${files.length} länder).`);
  for (const [table, n] of counts) console.log(`  ${table}: ${n}`);
  if (discover)
    console.log(
      `  _upptack.json: ${discover.cities.length} lätta platser, ${discover.countries.length} länder utan landsfil, ${discover.patches.size} befintliga platser får klimat, taggar eller alternativ`,
    );
  if (split.length) console.log(`  _landlistor.json, delade: ${split.length} länder (${split.map((p) => p.id).join(', ')})`);
  for (const [name, n] of appLists) console.log(`  ${name}: ${n} (läses in i appen vid bygget)`);
  console.log('  _texter.json och _texter.en.json: samma nycklar, form, platshållare och märken');
  if (checkOnly) return 0;

  const { db, error: envError } = await secretClient(root);
  if (!db) {
    console.error(envError);
    return 1;
  }

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
