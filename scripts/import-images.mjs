// Hämtar bilder till listpunkterna (place_items) från Wikipedia och Wikimedia Commons.
// För varje punkt med wiki och utan image_url: sidans huvudbild (800 px bred) via pageimages, och
// upphovsperson, licens och filsida via Commons (imageinfo, extmetadata). Bara CC0, Public domain,
// CC BY och CC BY-SA sparas. Skriver bara de fyra bildfälten.
// Körs lokalt av Hugo: npm run import:images, eller npm run import:images -- --force för att hämta om alla.
// Nyckeln SUPABASE_SECRET_KEY läses ur .env.local och skrivs aldrig ut.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { APP_NAME } from '../src/config.ts';
import { secretClient } from './lib/env.mjs';
import { commonsInfoUrl, needsImage, pageImageUrl, parseWiki, readCommonsInfo, readPageImage } from './lib/wiki-images.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
// Wikimedia vill att skript anger vem de är. Inga personuppgifter.
const HEADERS = { 'User-Agent': `${APP_NAME}-bildimport/1.0 (lokalt skript)`, 'Api-User-Agent': `${APP_NAME}-bildimport/1.0` };

async function getJson(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

async function main() {
  const { db, error } = await secretClient(root);
  if (!db) {
    console.error(error);
    return 1;
  }
  const { data: items, error: readErr } = await db.from('place_items').select('id, name, wiki, image_url').not('wiki', 'is', null).order('id');
  if (readErr) {
    console.error(`Kunde inte läsa place_items: ${readErr.message}`);
    return 1;
  }
  const todo = items.filter((i) => needsImage(i, force));
  console.log(`${items.length} listpunkter har wiki, ${todo.length} ska hämtas${force ? ' (--force)' : ''}.`);

  const report = { sida: [], bild: [], licens: [], fel: [] };
  let saved = 0;
  for (const item of todo) {
    const w = parseWiki(item.wiki);
    if (!w) {
      report.sida.push(`${item.id} (${item.wiki}: fel form)`);
      continue;
    }
    try {
      const pi = readPageImage(await getJson(pageImageUrl(w.lang, w.title)));
      if (pi.status === 'sida-saknas') {
        report.sida.push(`${item.id} (${item.wiki})`);
        continue;
      }
      if (pi.status === 'bild-saknas') {
        report.bild.push(`${item.id} (${item.wiki})`);
        continue;
      }
      const info = readCommonsInfo(await getJson(commonsInfoUrl(pi.file)));
      if (info.status !== 'ok') {
        report.licens.push(`${item.id} (${pi.file}: ${info.status === 'licens' ? info.license ?? 'okänd licens' : 'ligger inte på Commons'})`);
        continue;
      }
      const { error: upErr } = await db
        .from('place_items')
        .update({ image_url: pi.thumb, image_credit: info.credit, image_license: info.license, image_page: info.page })
        .eq('id', item.id);
      if (upErr) throw new Error(upErr.message);
      saved++;
      console.log(`  ${item.id}: ${info.license}${info.credit ? `, ${info.credit}` : ''}`);
    } catch (e) {
      report.fel.push(`${item.id} (${e.message})`);
    }
    // Snällt mot API:erna, som annars svarar "too many requests".
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nSparade bilder: ${saved}.`);
  const sections = [
    ['Saknar sida', report.sida],
    ['Saknar bild', report.bild],
    ['Annan licens eller inte på Commons', report.licens],
    ['Fel vid hämtning', report.fel],
  ];
  for (const [title, list] of sections) {
    if (!list.length) continue;
    console.log(`${title} (${list.length}):`);
    for (const x of list) console.log(`  ${x}`);
  }
  return report.fel.length ? 1 : 0;
}

process.exitCode = await main();
