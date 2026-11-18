// content/en/: de engelska texterna (Körning 20). Formatet står i docs/FORMAT.md.
// Svenskan i content/ är originalet. content/en/ har bara översatta texter, aldrig siffror, id:n, datum,
// koordinater eller källor. Saknade översättningar är inte fel: de räknas i en sammanställning per fil.
// Ren modul utan nätverk och nycklar: valideras i npm run import:check, blir kolumnen en i npm run import
// och används av röktestet (e2e/) när importen inte är körd. Testas i en.test.mjs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** En text i schemat. Listor skrivs som [schema] och objekt som { fält: schema }. */
export const TEXT = 'text';

/** Textfälten i places.data. Listor har samma längd och ordning som på svenska. */
export const DATA_SCHEMA = {
  best_text: TEXT,
  flight_tips: [{ title: TEXT, text: TEXT }],
  day_budget_note: TEXT,
  stay: [{ label: TEXT, text: TEXT }],
  areas: [{ name: TEXT, text: TEXT }],
  transport: [{ mode: TEXT, text: TEXT }],
  month_notes: [TEXT],
  events: [{ name: TEXT, text: TEXT }],
  seasons: [{ name: TEXT, text: TEXT }],
  prices: { summary: TEXT, tips: [TEXT], rows: [{ note: TEXT }] },
};

/** Delarna i en landsfil och deras textfält. Tabellerna står i validate-content.mjs (TABLES). */
export const COUNTRY_SCHEMA = {
  places: { name: TEXT, data: DATA_SCHEMA },
  facts: { title: TEXT, summary: TEXT, body: TEXT },
  items: { name: TEXT, summary: TEXT, body: TEXT },
  compendium: { name: TEXT, hint: TEXT },
  ideas: { title: TEXT, body: TEXT, duration: TEXT },
  gifts: { name: TEXT, body: TEXT },
};

/** Filerna i content/en/ utöver landsfilerna. */
export const EN_FILES = ['_upptack.json', '_bucket.json', '_packlista.json', '_innan-avresa.json'];
const COUNTRY_FILE_RE = /^[A-Z]{2}\.json$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const placeholders = (s) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

/**
 * Ett tillstånd per fil: fel och räknare. err(id, field, message) som i validate-content.mjs.
 * done räknar översatta texter, total alla svenska texter som går att översätta.
 */
function fileCtx(file) {
  const ctx = { file, errors: [], done: 0, total: 0 };
  ctx.err = (id, field, message) => ctx.errors.push({ file: `en/${file}`, id: id ?? '-', field, message });
  return ctx;
}

/** Antalet svenska texter i ett värde enligt schemat. */
export function countTexts(sv, schema) {
  if (schema === TEXT) return typeof sv === 'string' && sv.trim() ? 1 : 0;
  if (Array.isArray(schema)) return Array.isArray(sv) ? sv.reduce((n, x) => n + countTexts(x, schema[0]), 0) : 0;
  if (!isObj(sv)) return 0;
  return Object.entries(schema).reduce((n, [k, s]) => n + countTexts(sv[k], s), 0);
}

/**
 * Jämför ett engelskt värde med det svenska enligt schemat. Räknar översatta texter (om counted).
 * null betyder saknad text och tillåts bara som post i en lista med texter (month_notes, tips).
 */
function compare(sv, en, schema, ctx, id, path, counted = true) {
  if (schema === TEXT) {
    if (typeof sv !== 'string' || !sv.trim()) return ctx.err(id, path, 'finns på engelska men saknas på svenska');
    if (typeof en !== 'string') return ctx.err(id, path, 'ska vara en text');
    if (!en.trim()) return ctx.err(id, path, 'tom text, utelämna fältet i stället');
    const own = placeholders(sv);
    for (const p of placeholders(en)) if (!own.has(p)) ctx.err(id, path, `platshållaren {${p}} finns inte i den svenska texten`);
    if (counted) ctx.done++;
    return;
  }
  if (Array.isArray(schema)) {
    if (!Array.isArray(sv)) return ctx.err(id, path, 'finns på engelska men saknas på svenska');
    if (!Array.isArray(en)) return ctx.err(id, path, 'ska vara en lista');
    if (en.length !== sv.length) return ctx.err(id, path, `listan har ${en.length} poster, svenska har ${sv.length}`);
    en.forEach((x, i) => {
      if (x === null && schema[0] === TEXT) return; // saknad text i en lista med texter
      compare(sv[i], x, schema[0], ctx, id, `${path}[${i}]`, counted);
    });
    return;
  }
  if (!isObj(sv)) return ctx.err(id, path, 'finns på engelska men saknas på svenska');
  if (!isObj(en)) return ctx.err(id, path, 'ska vara ett objekt');
  for (const [k, v] of Object.entries(en)) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in schema)) ctx.err(id, p, 'okänt fält');
    else if (sv[k] === undefined || sv[k] === null) ctx.err(id, p, 'finns på engelska men saknas på svenska');
    else compare(sv[k], v, schema[k], ctx, id, p, counted);
  }
}

/** Kontrollerar att en del är ett objekt med id som nycklar. Svarar med posterna, eller [] vid fel. */
function entries(ctx, json, key, label = key) {
  const v = json[key];
  if (v === undefined) return [];
  if (!isObj(v)) {
    ctx.err('-', label, 'ska vara ett objekt med id som nycklar');
    return [];
  }
  return Object.entries(v);
}

function topKeys(ctx, json, allowed) {
  if (!isObj(json)) {
    ctx.err('-', '-', 'filen ska vara ett JSON-objekt');
    return false;
  }
  for (const k of Object.keys(json)) if (k !== '_om' && !allowed.includes(k)) ctx.err('-', k, 'okänd del i filen');
  return true;
}

/** en/<landskod>.json mot content/<landskod>.json. Svarar med { errors, done, total }. */
export function checkCountryEn(file, en, sv) {
  const ctx = fileCtx(file);
  for (const part of Object.keys(COUNTRY_SCHEMA)) {
    const list = Array.isArray(sv?.[part]) ? sv[part] : [];
    ctx.total += list.reduce((n, r) => n + countTexts(r, COUNTRY_SCHEMA[part]), 0);
  }
  if (!topKeys(ctx, en, Object.keys(COUNTRY_SCHEMA))) return ctx;
  for (const [part, schema] of Object.entries(COUNTRY_SCHEMA)) {
    const byId = new Map((Array.isArray(sv?.[part]) ? sv[part] : []).filter(isObj).map((r) => [r.id, r]));
    for (const [id, row] of entries(ctx, en, part)) {
      const svRow = byId.get(id);
      if (!svRow) ctx.err(id, part, `id finns inte i ${part} i content/${file}`);
      else compare(svRow, row, schema, ctx, id, '');
    }
  }
  return ctx;
}

/** en/_upptack.json mot content/_upptack.json. */
export function checkDiscoverEn(en, sv) {
  const ctx = fileCtx('_upptack.json');
  const svPlaces = new Map((Array.isArray(sv?.places) ? sv.places : []).filter(isObj).map((p) => [p.id, p]));
  const svExisting = isObj(sv?.existing) ? sv.existing : {};
  const svAlts = new Map((Array.isArray(sv?.alternatives) ? sv.alternatives : []).filter(isObj).map((a) => [`${a.for}>${a.place}`, a]));
  // name räknas inte: det finns bara när det engelska namnet skiljer sig från det svenska.
  for (const p of svPlaces.values()) ctx.total += countTexts(p, { why: TEXT, level_note: TEXT });
  for (const e of Object.values(svExisting)) ctx.total += countTexts(e, { why: TEXT });
  for (const a of svAlts.values()) ctx.total += countTexts(a, { why: TEXT });
  if (!topKeys(ctx, en, ['places', 'existing', 'alternatives'])) return ctx;
  for (const [id, row] of entries(ctx, en, 'places')) {
    const p = svPlaces.get(id);
    if (!p) {
      ctx.err(id, 'places', 'platsen finns inte i places i content/_upptack.json');
      continue;
    }
    const { name, ...rest } = isObj(row) ? row : {};
    compare(p, rest, { why: TEXT, level_note: TEXT }, ctx, id, '');
    if (name !== undefined) compare(p, { name }, { name: TEXT }, ctx, id, '', false);
  }
  for (const [id, row] of entries(ctx, en, 'existing')) {
    if (!isObj(svExisting[id])) ctx.err(id, 'existing', 'platsen finns inte i existing i content/_upptack.json');
    else compare(svExisting[id], row, { why: TEXT }, ctx, id, '');
  }
  for (const [key, why] of entries(ctx, en, 'alternatives')) {
    const a = svAlts.get(key);
    if (!a) ctx.err(key, 'alternatives', 'alternativet finns inte i content/_upptack.json (nyckeln är "<for>><place>")');
    else compare(a, { why }, { why: TEXT }, ctx, key, '');
  }
  return ctx;
}

/** en/_bucket.json mot content/_bucket.json. checklist_items bara för delmål av typen delar. */
export function checkBucketEn(en, sv) {
  const ctx = fileCtx('_bucket.json');
  const schema = { name: TEXT, season: TEXT, where_text: TEXT };
  const svById = new Map((Array.isArray(sv) ? sv : []).filter(isObj).map((r) => [r.id, r]));
  for (const r of svById.values()) {
    ctx.total += countTexts(r, schema);
    if (r.checklist?.type === 'delar') ctx.total += countTexts(r.checklist.items, [TEXT]);
  }
  if (!isObj(en)) {
    ctx.err('-', '-', 'filen ska vara ett objekt med id som nycklar');
    return ctx;
  }
  for (const [id, row] of Object.entries(en)) {
    if (id === '_om') continue;
    const r = svById.get(id);
    if (!r) {
      ctx.err(id, 'id', 'finns inte i content/_bucket.json');
      continue;
    }
    if (!isObj(row)) {
      ctx.err(id, '-', 'ska vara ett objekt');
      continue;
    }
    const { checklist_items: items, ...rest } = row;
    compare(r, rest, schema, ctx, id, '');
    if (items !== undefined) {
      if (r.checklist?.type !== 'delar') ctx.err(id, 'checklist_items', 'bara för delmål av typen delar');
      else compare(r.checklist.items, items, [TEXT], ctx, id, 'checklist_items');
    }
  }
  return ctx;
}

/** en/_packlista.json mot content/_packlista.json: groups { svenskt namn: engelskt } och items { id: { title } }. */
export function checkPackEn(en, sv) {
  const ctx = fileCtx('_packlista.json');
  const items = new Map((Array.isArray(sv?.items) ? sv.items : []).filter(isObj).map((r) => [r.id, r]));
  const groups = [...new Set([...items.values()].map((r) => r.group).filter((g) => typeof g === 'string'))];
  ctx.total += groups.length + [...items.values()].reduce((n, r) => n + countTexts(r, { title: TEXT }), 0);
  if (!topKeys(ctx, en, ['groups', 'items'])) return ctx;
  for (const [g, name] of entries(ctx, en, 'groups')) {
    if (!groups.includes(g)) ctx.err(g, 'groups', 'gruppen finns inte i content/_packlista.json');
    else compare(g, name, TEXT, ctx, g, 'groups');
  }
  for (const [id, row] of entries(ctx, en, 'items')) {
    if (!items.has(id)) ctx.err(id, 'items', 'finns inte i content/_packlista.json');
    else compare(items.get(id), row, { title: TEXT }, ctx, id, '');
  }
  return ctx;
}

/** en/_innan-avresa.json mot content/_innan-avresa.json: items { id: { title, hint } }. */
export function checkPretripEn(en, sv) {
  const ctx = fileCtx('_innan-avresa.json');
  const schema = { title: TEXT, hint: TEXT };
  const items = new Map((Array.isArray(sv?.items) ? sv.items : []).filter(isObj).map((r) => [r.id, r]));
  ctx.total += [...items.values()].reduce((n, r) => n + countTexts(r, schema), 0);
  if (!topKeys(ctx, en, ['items'])) return ctx;
  for (const [id, row] of entries(ctx, en, 'items')) {
    if (!items.has(id)) ctx.err(id, 'items', 'finns inte i content/_innan-avresa.json');
    else compare(items.get(id), row, schema, ctx, id, '');
  }
  return ctx;
}

/**
 * Validerar alla filer i content/en/.
 * en: { filnamn: json } (filerna i content/en/), sv: { filnamn: json } (filerna i content/, samma namn).
 * Svarar med { errors, summary: [{ file, done, total }] }. Saknade översättningar är inte fel.
 */
export function validateEnglish(en, sv) {
  const errors = [];
  const summary = [];
  const checks = {
    '_upptack.json': checkDiscoverEn,
    '_bucket.json': checkBucketEn,
    '_packlista.json': checkPackEn,
    '_innan-avresa.json': checkPretripEn,
  };
  for (const file of Object.keys(en).sort()) {
    let ctx;
    if (checks[file]) {
      if (sv[file] === undefined) {
        errors.push({ file: `en/${file}`, id: '-', field: '-', message: `content/${file} finns inte` });
        continue;
      }
      ctx = checks[file](en[file], sv[file]);
    } else if (COUNTRY_FILE_RE.test(file)) {
      if (sv[file] === undefined) {
        errors.push({ file: `en/${file}`, id: '-', field: '-', message: `content/${file} finns inte` });
        continue;
      }
      ctx = checkCountryEn(file, en[file], sv[file]);
    } else {
      errors.push({ file: `en/${file}`, id: '-', field: '-', message: `okänd fil (landskod eller ${EN_FILES.join(', ')})` });
      continue;
    }
    errors.push(...ctx.errors);
    summary.push({ file: `en/${file}`, done: ctx.done, total: ctx.total });
  }
  // Samma kort i samlingsboken kan finnas i flera landsfiler. Engelskan får inte skilja sig mellan dem.
  const comp = new Map();
  for (const file of Object.keys(en).filter((f) => COUNTRY_FILE_RE.test(f)).sort()) {
    const c = isObj(en[file]?.compendium) ? en[file].compendium : {};
    for (const [id, row] of Object.entries(c)) {
      const s = JSON.stringify(row);
      if (comp.has(id) && comp.get(id).s !== s)
        errors.push({ file: `en/${file}`, id, field: 'compendium', message: `annan engelsk text än i en/${comp.get(id).file}` });
      else if (!comp.has(id)) comp.set(id, { s, file });
    }
  }
  return { errors, summary };
}

/** Sammanställningen som text: en rad per fil med antal översatta texter av totalt antal. */
export const formatSummary = (s) => `en/${s.file.replace(/^en\//, '')}: ${s.done} av ${s.total} texter översatta`;

// ---------- Kolumnen en ----------

/** Lägger ihop två en-objekt (data slås ihop fält för fält). */
function mergeEn(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a, ...b };
  if (isObj(a.data) && isObj(b.data)) out.data = { ...a.data, ...b.data };
  return out;
}

/**
 * Kolumnen en per tabell: { places: Map(id -> en), facts, items, compendium, ideas, gifts, bucket }.
 * Görs bara när valideringen har gått igenom.
 * en: filerna i content/en/ ({ filnamn: json }). placesRows: raderna i places som importen skriver (med
 * data.alternatives i filens ordning), för att lägga alternativens engelska på rätt plats i listan.
 * För places läggs engelskan från en/_upptack.json (why, level_note, name och alternativens why) och från
 * landsfilen (name och data) ihop i samma objekt.
 */
export function englishRows(en, placesRows = []) {
  const out = { places: new Map(), compendium: new Map(), facts: new Map(), items: new Map(), ideas: new Map(), gifts: new Map(), bucket: new Map() };
  const add = (part, id, value) => {
    if (!isObj(value) || !Object.keys(value).length) return;
    out[part].set(id, part === 'places' ? mergeEn(out[part].get(id), value) : { ...(out[part].get(id) ?? {}), ...value });
  };

  for (const file of Object.keys(en).filter((f) => COUNTRY_FILE_RE.test(f)).sort()) {
    const json = en[file];
    for (const part of Object.keys(COUNTRY_SCHEMA)) for (const [id, row] of Object.entries(isObj(json?.[part]) ? json[part] : {})) add(part, id, row);
  }

  const d = en['_upptack.json'];
  if (isObj(d)) {
    for (const [id, row] of Object.entries(isObj(d.places) ? d.places : {})) {
      const { name, why, level_note } = row;
      const data = {};
      if (why !== undefined) data.why = why;
      if (level_note !== undefined) data.level_note = level_note;
      add('places', id, { ...(name !== undefined ? { name } : {}), ...(Object.keys(data).length ? { data } : {}) });
    }
    for (const [id, row] of Object.entries(isObj(d.existing) ? d.existing : {}))
      if (row?.why !== undefined) add('places', id, { data: { why: row.why } });
    const alts = isObj(d.alternatives) ? d.alternatives : {};
    if (Object.keys(alts).length)
      for (const p of placesRows) {
        const list = Array.isArray(p.data?.alternatives) ? p.data.alternatives : [];
        const mapped = list.map((a) => (typeof alts[`${p.id}>${a.place}`] === 'string' ? { why: alts[`${p.id}>${a.place}`] } : {}));
        if (mapped.some((x) => x.why)) add('places', p.id, { data: { alternatives: mapped } });
      }
  }

  const b = en['_bucket.json'];
  if (isObj(b))
    for (const [id, row] of Object.entries(b)) {
      if (id === '_om' || !isObj(row)) continue;
      const { checklist_items: items, ...rest } = row;
      add('bucket', id, { ...rest, ...(Array.isArray(items) ? { checklist: { items } } : {}) });
    }
  return out;
}

/** Sätter kolumnen en på raderna: engelskan för raden, eller null. */
export const withEnglish = (rows, map) => rows.map((r) => ({ ...r, en: map.get(r.id) ?? null }));

/**
 * Läser filerna i content/en/ ({ filnamn: json }). Saknas mappen blir svaret tomt.
 * Kastar fel med filnamnet vid ogiltig JSON.
 */
export function readEnglishDir(contentDir) {
  const dir = join(contentDir, 'en');
  if (!existsSync(dir)) return {};
  const out = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const text = readFileSync(join(dir, f), 'utf8').replace(/^﻿/, '');
    try {
      out[f] = JSON.parse(text);
    } catch (e) {
      throw new Error(`en/${f}: ogiltig JSON (${e.message})`);
    }
  }
  return out;
}
