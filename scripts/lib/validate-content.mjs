// Validering av innehållet i content/ enligt docs/FORMAT.md.
// Ren modul utan nätverk och nycklar, så att den kan testas och köras med npm run import:check.

export const TABLES = {
  places: 'places',
  compendium: 'compendium_items',
  facts: 'place_facts',
  items: 'place_items',
  ideas: 'ideas',
  gifts: 'gift_tips',
};

/** Skrivordningen: platser först, sedan det som pekar på dem. Bucketlistan sist. */
export const ORDER = ['places', 'compendium', 'facts', 'items', 'ideas', 'gifts'];

const PLACE_KINDS = ['country', 'region', 'city', 'spot'];
const KIND_DEPTH = { country: 0, region: 1, city: 2, spot: 3 };
const FACT_TOPICS = [
  'ta-sig-dit', 'mobil', 'betala', 'eluttag', 'dricks', 'tank-pa', 'fun-fact',
  'inresa', 'alkohol', 'hyrbil', 'boende', 'medicin', 'turistskatt',
];
const ITEM_CATEGORIES = ['mat', 'dryck', 'sevardhet', 'museum', 'natur', 'symbol', 'fotboll', 'upplevelse', 'strand', 'byggnad'];
const COMPENDIUM_CATEGORIES = [
  'mat', 'dryck', 'godis', 'bakverk', 'daggdjur', 'fagel', 'havsdjur', 'blomma', 'svamp',
  'trad', 'naturfenomen', 'sevardhet', 'arena', 'fardmedel',
];
const RARITIES = ['vanlig', 'ovanlig', 'sallsynt', 'legendarisk'];
const ICONS = ['food', 'cup', 'paw', 'bird', 'sky', 'sun', 'ball', 'flower', 'mush', 'build', 'tram', 'pin'];
const IDEA_KINDS = ['hemma', 'i-stan', 'ut-en-svang', 'dagstripp', 'helg', 'utflykt', 'fotboll'];
const COST_LEVELS = ['gratis', 'billigt', 'medel', 'dyrt'];
const IDEA_TAGS = ['inne', 'ute', 'gratis', 'nara'];
const FOR_WHOM = ['mamma', 'pappa', 'barn', 'van', 'mig'];
const BUCKET_CATEGORIES = ['aventyr', 'natur', 'resa', 'mat', 'kultur', 'tillsammans', 'hemma', 'milstolpe'];
const TRANSPORT_RATINGS = ['bast', 'bra', 'dyrt'];
const DATA_FIELDS = [
  'stay', 'day_budget_sek', 'areas', 'transport', 'flight_tips', 'best_text', 'sources', 'day_budget_note', 'own_judgment',
];

/** Kolumner per del. Andra fält stoppas, eftersom de inte finns i tabellen. */
const COLUMNS = {
  places: ['id', 'kind', 'parent_id', 'layer', 'name', 'iso2', 'lat', 'lon', 'airport', 'smart_months', 'data'],
  facts: ['id', 'place_id', 'topic', 'is_rule', 'min_age', 'title', 'summary', 'body', 'source_url', 'verified_on'],
  items: ['id', 'place_id', 'category', 'name', 'summary', 'body', 'must_rank', 'lat', 'lon', 'compendium_id', 'source_url', 'verified_on'],
  compendium: ['id', 'category', 'name', 'rarity', 'icon', 'hint', 'place_id', 'source_url'],
  ideas: ['id', 'place_id', 'kind', 'title', 'body', 'duration', 'cost_level', 'tags', 'drive_minutes', 'lat', 'lon'],
  gifts: ['id', 'place_id', 'name', 'body', 'for_whom', 'keywords', 'price_sek', 'min_age', 'collection_motifs'],
  bucket: ['id', 'name', 'category', 'cost_level', 'season', 'where_text', 'place_ids'],
};

const ID_RE = /^[A-Za-z0-9]+(-[a-z0-9]+)*$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Validerar en del av en fil. Lägger fel i errs som { file, id, field, message }. */
function makeChecker(file, errs) {
  return (row, field, ok, message) => {
    if (!ok) errs.push({ file, id: row && typeof row.id === 'string' ? row.id : '(saknar id)', field, message });
  };
}

function checkCommon(part, row, check, prefix) {
  check(row, 'id', isStr(row.id) && ID_RE.test(row.id), 'id ska vara små bokstäver, siffror och bindestreck');
  if (prefix && isStr(row.id)) {
    check(row, 'id', row.id === prefix || row.id.startsWith(`${prefix}-`), `id ska börja med landskoden ${prefix}`);
  }
  for (const k of Object.keys(row)) {
    check(row, k, COLUMNS[part].includes(k), 'fältet finns inte i tabellen');
  }
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string') check(row, k, v.trim().length > 0, 'tomt fält, utelämna det i stället');
  }
}

function checkLengths(row, check) {
  if (row.summary !== undefined) check(row, 'summary', typeof row.summary === 'string' && row.summary.length <= 80, 'summary får vara högst 80 tecken');
  if (row.body !== undefined) check(row, 'body', typeof row.body === 'string' && row.body.length <= 400, 'body får vara högst 400 tecken');
}

function checkCoords(row, check, required) {
  for (const k of ['lat', 'lon']) {
    if (row[k] === undefined) check(row, k, !required, 'krävs');
    else check(row, k, isNum(row[k]) && Math.abs(row[k]) <= (k === 'lat' ? 90 : 180), 'ska vara ett tal i rätt intervall');
  }
}

function checkSource(row, check, required) {
  if (row.source_url !== undefined || required) check(row, 'source_url', isStr(row.source_url) && URL_RE.test(row.source_url), required ? 'källa krävs (http-adress)' : 'ska vara en http-adress');
  if (row.verified_on !== undefined || required) check(row, 'verified_on', validDate(row.verified_on), required ? 'kontrolldatum krävs (ÅÅÅÅ-MM-DD)' : 'ska vara ett datum ÅÅÅÅ-MM-DD');
}

const listOf = (v, allowed) => Array.isArray(v) && v.every((x) => typeof x === 'string' && (!allowed || allowed.includes(x)));

function checkPlaceData(row, check) {
  const d = row.data;
  if (d === undefined) return;
  if (!isObj(d)) return check(row, 'data', false, 'ska vara ett objekt');
  for (const k of Object.keys(d)) check(row, `data.${k}`, DATA_FIELDS.includes(k), 'okänt fält i data');
  if (d.stay !== undefined) {
    const ok =
      Array.isArray(d.stay) &&
      d.stay.every((s) => isObj(s) && isStr(s.label) && isInt(s.days) && s.days > 0 && isStr(s.text) && (s.recommended === undefined || typeof s.recommended === 'boolean'));
    check(row, 'data.stay', ok, 'lista med { label, days, text, recommended }');
    if (ok) check(row, 'data.stay', d.stay.filter((s) => s.recommended).length <= 1, 'högst en rekommenderad längd');
  }
  if (d.day_budget_sek !== undefined) check(row, 'data.day_budget_sek', isInt(d.day_budget_sek) && d.day_budget_sek >= 0, 'heltal i kronor');
  if (d.areas !== undefined)
    check(row, 'data.areas', Array.isArray(d.areas) && d.areas.every((a) => isObj(a) && isStr(a.name) && typeof a.stay === 'boolean' && isStr(a.text)), 'lista med { name, stay, text }');
  if (d.transport !== undefined)
    check(
      row,
      'data.transport',
      Array.isArray(d.transport) && d.transport.every((t) => isObj(t) && isStr(t.mode) && TRANSPORT_RATINGS.includes(t.rating) && isStr(t.text)),
      'lista med { mode, rating: bast, bra eller dyrt, text }',
    );
  if (d.flight_tips !== undefined)
    check(row, 'data.flight_tips', Array.isArray(d.flight_tips) && d.flight_tips.every((t) => isObj(t) && isStr(t.title) && isStr(t.text)), 'lista med { title, text }');
  if (d.best_text !== undefined) check(row, 'data.best_text', isStr(d.best_text), 'text');
  if (d.day_budget_note !== undefined) check(row, 'data.day_budget_note', isStr(d.day_budget_note), 'text');
  if (d.sources !== undefined) check(row, 'data.sources', listOf(d.sources) && d.sources.every((u) => URL_RE.test(u)), 'lista med http-adresser');
  if (d.own_judgment !== undefined) check(row, 'data.own_judgment', listOf(d.own_judgment), 'lista med fältnamn');
}

const VALIDATORS = {
  places(row, check, prefix) {
    checkCommon('places', row, check, prefix);
    check(row, 'kind', PLACE_KINDS.includes(row.kind), `ska vara ${PLACE_KINDS.join(', ')}`);
    check(row, 'name', isStr(row.name), 'krävs');
    if (row.kind === 'country') {
      check(row, 'iso2', typeof row.iso2 === 'string' && COUNTRY_RE.test(row.iso2), 'krävs för land (två versaler)');
      check(row, 'id', row.id === row.iso2, 'ett land har ISO-koden som id');
      check(row, 'parent_id', row.parent_id === undefined, 'ett land har ingen plats ovanför');
    } else {
      check(row, 'parent_id', isStr(row.parent_id), 'krävs utom för land');
      if (row.iso2 !== undefined) check(row, 'iso2', COUNTRY_RE.test(row.iso2), 'två versaler');
    }
    checkCoords(row, check, true);
    if (row.airport !== undefined) check(row, 'airport', typeof row.airport === 'string' && /^[A-Z]{3}$/.test(row.airport), 'IATA-kod med tre versaler');
    if (row.layer !== undefined) check(row, 'layer', isStr(row.layer), 'text');
    if (row.smart_months !== undefined)
      check(row, 'smart_months', Array.isArray(row.smart_months) && row.smart_months.length === 12 && row.smart_months.every((m) => isInt(m) && m >= 0 && m <= 5), '12 heltal 0–5');
    checkPlaceData(row, check);
  },
  facts(row, check, prefix) {
    checkCommon('facts', row, check, prefix);
    check(row, 'place_id', isStr(row.place_id), 'krävs');
    check(row, 'topic', FACT_TOPICS.includes(row.topic), 'okänt ämne');
    check(row, 'is_rule', typeof row.is_rule === 'boolean', 'krävs (true eller false)');
    check(row, 'title', isStr(row.title), 'krävs');
    if (row.min_age !== undefined) check(row, 'min_age', isInt(row.min_age) && row.min_age >= 0 && row.min_age < 100, 'heltal');
    checkLengths(row, check);
    // Regler och åldersgränser utan källa och datum får inte importeras.
    checkSource(row, check, row.is_rule === true || row.min_age !== undefined);
  },
  items(row, check, prefix) {
    checkCommon('items', row, check, prefix);
    check(row, 'place_id', isStr(row.place_id), 'krävs');
    check(row, 'category', ITEM_CATEGORIES.includes(row.category), 'okänd kategori');
    check(row, 'name', isStr(row.name), 'krävs');
    if (row.must_rank !== undefined) check(row, 'must_rank', isInt(row.must_rank) && row.must_rank >= 1 && row.must_rank <= 10, 'heltal 1–10');
    checkCoords(row, check, false);
    checkLengths(row, check);
    checkSource(row, check, true);
  },
  compendium(row, check) {
    checkCommon('compendium', row, check, null);
    check(row, 'id', isStr(row.id) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.id), 'id utan landskod, små bokstäver');
    check(row, 'category', COMPENDIUM_CATEGORIES.includes(row.category), 'okänd kategori');
    check(row, 'name', isStr(row.name), 'krävs');
    check(row, 'rarity', RARITIES.includes(row.rarity), `ska vara ${RARITIES.join(', ')}`);
    if (row.icon !== undefined) check(row, 'icon', ICONS.includes(row.icon), 'okänd ikon');
    if (row.hint !== undefined) check(row, 'hint', isStr(row.hint), 'text');
    checkSource(row, check, false);
  },
  ideas(row, check, prefix) {
    checkCommon('ideas', row, check, prefix);
    check(row, 'kind', IDEA_KINDS.includes(row.kind), 'okänd typ');
    check(row, 'title', isStr(row.title), 'krävs');
    if (row.cost_level !== undefined) check(row, 'cost_level', COST_LEVELS.includes(row.cost_level), `ska vara ${COST_LEVELS.join(', ')}`);
    if (row.tags !== undefined) check(row, 'tags', listOf(row.tags, IDEA_TAGS), `lista med ${IDEA_TAGS.join(', ')}`);
    if (row.drive_minutes !== undefined) check(row, 'drive_minutes', isInt(row.drive_minutes) && row.drive_minutes >= 0, 'heltal');
    checkCoords(row, check, false);
  },
  gifts(row, check, prefix) {
    checkCommon('gifts', row, check, prefix);
    check(row, 'place_id', isStr(row.place_id), 'krävs');
    check(row, 'name', isStr(row.name), 'krävs');
    check(row, 'for_whom', listOf(row.for_whom, FOR_WHOM) && row.for_whom.length > 0, `lista med ${FOR_WHOM.join(', ')}`);
    if (row.keywords !== undefined) check(row, 'keywords', listOf(row.keywords) && row.keywords.every((k) => k === k.toLowerCase()), 'lista med små bokstäver');
    if (row.price_sek !== undefined) check(row, 'price_sek', isInt(row.price_sek) && row.price_sek >= 0, 'heltal i kronor');
    if (row.min_age !== undefined) check(row, 'min_age', isInt(row.min_age) && row.min_age >= 0, 'heltal');
    if (row.collection_motifs !== undefined)
      check(row, 'collection_motifs', isObj(row.collection_motifs) && Object.values(row.collection_motifs).every(isStr), 'objekt med text');
  },
};

function checkBucket(row, check) {
  checkCommon('bucket', row, check, null);
  check(row, 'name', isStr(row.name), 'krävs');
  check(row, 'category', BUCKET_CATEGORIES.includes(row.category), `ska vara ${BUCKET_CATEGORIES.join(', ')}`);
  if (row.cost_level !== undefined) check(row, 'cost_level', COST_LEVELS.includes(row.cost_level), `ska vara ${COST_LEVELS.join(', ')}`);
  check(row, 'place_ids', listOf(row.place_ids), 'lista (får vara tom)');
}

/**
 * Validerar alla filer. files: [{ name: 'NL.json', json }], bucket: { name, json } eller null.
 * Returnerar { errors, rows } där rows har raderna per del, platser sorterade land före region och stad.
 */
export function validateContent(files, bucket) {
  const errors = [];
  const rows = { places: [], compendium: [], facts: [], items: [], ideas: [], gifts: [], bucket: [] };
  const seen = {};
  const origin = new Map(); // "del:id" -> filnamn

  for (const { name, json } of files) {
    const fileErrs = [];
    const prefix = name.replace(/\.json$/, '');
    if (!COUNTRY_RE.test(prefix)) fileErrs.push({ file: name, id: '-', field: '-', message: 'filnamnet ska vara landskoden, t.ex. NL.json' });
    if (!isObj(json)) {
      errors.push({ file: name, id: '-', field: '-', message: 'filen ska vara ett JSON-objekt' });
      continue;
    }
    for (const k of Object.keys(json)) {
      if (!ORDER.includes(k)) fileErrs.push({ file: name, id: '-', field: k, message: 'okänd del i filen' });
      else if (!Array.isArray(json[k])) fileErrs.push({ file: name, id: '-', field: k, message: 'ska vara en lista' });
    }
    const check = makeChecker(name, fileErrs);
    const accepted = {};
    for (const part of ORDER) {
      const list = Array.isArray(json[part]) ? json[part] : [];
      accepted[part] = [];
      for (const row of list) {
        if (!isObj(row)) {
          fileErrs.push({ file: name, id: '-', field: part, message: 'raden ska vara ett objekt' });
          continue;
        }
        VALIDATORS[part](row, check, part === 'compendium' ? null : prefix);
        const key = `${part}:${row.id}`;
        if (origin.has(key)) {
          const same = part === 'compendium' && JSON.stringify(seen[key]) === JSON.stringify(row);
          if (!same) check(row, 'id', false, `id finns redan i ${origin.get(key)}`);
          continue;
        }
        origin.set(key, name);
        seen[key] = row;
        accepted[part].push(row);
      }
    }
    // Ett fel stoppar hela filen.
    if (fileErrs.length) errors.push(...fileErrs);
    else for (const part of ORDER) rows[part].push(...accepted[part]);
  }

  if (bucket) {
    const check = makeChecker(bucket.name, errors);
    if (!Array.isArray(bucket.json)) errors.push({ file: bucket.name, id: '-', field: '-', message: 'filen ska vara en lista' });
    else
      for (const row of bucket.json) {
        if (!isObj(row)) {
          errors.push({ file: bucket.name, id: '-', field: '-', message: 'raden ska vara ett objekt' });
          continue;
        }
        checkBucket(row, check);
        if (origin.has(`bucket:${row.id}`)) check(row, 'id', false, 'id finns redan');
        origin.set(`bucket:${row.id}`, bucket.name);
        rows.bucket.push(row);
      }
  }

  // Hänvisningar mellan delarna, över alla filer.
  const placeIds = new Set();
  const placeById = new Map();
  for (const { name, json } of files) {
    for (const p of (isObj(json) && Array.isArray(json.places) ? json.places : [])) {
      if (isObj(p) && typeof p.id === 'string') {
        placeIds.add(p.id);
        placeById.set(p.id, { ...p, file: name });
      }
    }
  }
  const compIds = new Set();
  for (const { json } of files) for (const c of (isObj(json) && Array.isArray(json.compendium) ? json.compendium : [])) if (isObj(c)) compIds.add(c.id);

  for (const { name, json } of files) {
    if (!isObj(json)) continue;
    const check = makeChecker(name, errors);
    for (const p of Array.isArray(json.places) ? json.places : []) {
      if (!isObj(p) || p.parent_id === undefined) continue;
      const parent = placeById.get(p.parent_id);
      check(p, 'parent_id', Boolean(parent), `platsen ${p.parent_id} finns inte`);
      if (parent && KIND_DEPTH[parent.kind] !== undefined && KIND_DEPTH[p.kind] !== undefined)
        check(p, 'parent_id', KIND_DEPTH[parent.kind] < KIND_DEPTH[p.kind], 'platsen ovanför ska vara en större plats');
    }
    for (const part of ['facts', 'items', 'compendium', 'ideas', 'gifts']) {
      for (const r of Array.isArray(json[part]) ? json[part] : []) {
        if (isObj(r) && r.place_id !== undefined) check(r, 'place_id', placeIds.has(r.place_id), `platsen ${r.place_id} finns inte`);
        if (part === 'items' && isObj(r) && r.compendium_id !== undefined)
          check(r, 'compendium_id', compIds.has(r.compendium_id), `samlingsbokens ${r.compendium_id} finns inte`);
      }
    }
  }
  if (bucket && Array.isArray(bucket.json)) {
    const check = makeChecker(bucket.name, errors);
    for (const r of bucket.json) if (isObj(r) && Array.isArray(r.place_ids)) for (const id of r.place_ids) check(r, 'place_ids', placeIds.has(id), `platsen ${id} finns inte`);
  }

  rows.places = sortPlaces(rows.places);
  return { errors, rows };
}

/** Land före region, stad och plats. Inom samma nivå: föräldern först. */
export function sortPlaces(places) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const depth = (p, guard = 0) => {
    const parent = p.parent_id && byId.get(p.parent_id);
    return parent && guard < 10 ? depth(parent, guard + 1) + 1 : 0;
  };
  return [...places]
    .map((p, i) => ({ p, i, d: depth(p), k: KIND_DEPTH[p.kind] ?? 9 }))
    .sort((a, b) => a.d - b.d || a.k - b.k || a.i - b.i)
    .map((x) => x.p);
}

/** Gör en rad till en databasrad: utelämnade fält blir standardvärden i tabellen. */
export function toDbRow(part, row) {
  const r = { ...row };
  if (part === 'places' && r.data === undefined) r.data = {};
  if ((part === 'ideas') && r.tags === undefined) r.tags = [];
  if (part === 'gifts') {
    if (r.keywords === undefined) r.keywords = [];
    if (r.collection_motifs === undefined) r.collection_motifs = {};
  }
  return r;
}

export const formatError = (e) => `${e.file} · ${e.id} · ${e.field}: ${e.message}`;

// ---------- Filer som läses in i appen vid bygget (inte till databasen) ----------

const LIST_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Gemensamt för _packlista.json och _innan-avresa.json: { items: [...] } med unika id och titlar. */
function checkAppList(name, json, allowed, checkRow) {
  const errs = [];
  if (!isObj(json) || !Array.isArray(json.items)) {
    errs.push({ file: name, id: '-', field: 'items', message: 'filen ska vara { "items": [...] }' });
    return errs;
  }
  for (const k of Object.keys(json)) if (k !== 'items') errs.push({ file: name, id: '-', field: k, message: 'okänd del i filen' });
  const check = makeChecker(name, errs);
  const ids = new Set();
  const titles = new Set();
  for (const row of json.items) {
    if (!isObj(row)) {
      errs.push({ file: name, id: '-', field: '-', message: 'varje rad ska vara ett objekt' });
      continue;
    }
    check(row, 'id', isStr(row.id) && LIST_ID_RE.test(row.id), 'id ska vara små bokstäver, siffror och bindestreck');
    check(row, 'id', !ids.has(row.id), 'id finns redan i filen');
    ids.add(row.id);
    for (const k of Object.keys(row)) check(row, k, allowed.includes(k), 'okänt fält');
    for (const [k, v] of Object.entries(row)) if (typeof v === 'string') check(row, k, v.trim().length > 0, 'tomt fält, utelämna det i stället');
    check(row, 'title', isStr(row.title) && row.title.length <= 60, 'krävs, högst 60 tecken');
    const key = isStr(row.title) ? row.title.trim().toLocaleLowerCase('sv') : '';
    check(row, 'title', !key || !titles.has(key), 'samma titel finns redan i filen');
    titles.add(key);
    checkRow(row, check);
  }
  return errs;
}

/** content/_packlista.json (formatet står i docs/FORMAT.md). */
export function validatePackList(name, json) {
  return checkAppList(name, json, ['id', 'group', 'title', 'min_nights', 'max_nights', 'months'], (row, check) => {
    check(row, 'group', isStr(row.group), 'krävs');
    for (const k of ['min_nights', 'max_nights']) {
      if (row[k] !== undefined) check(row, k, isInt(row[k]) && row[k] >= 0, 'ska vara ett heltal, 0 eller mer');
    }
    if (isInt(row.min_nights) && isInt(row.max_nights)) check(row, 'max_nights', row.max_nights >= row.min_nights, 'ska vara minst min_nights');
    if (row.months !== undefined) {
      check(
        row,
        'months',
        Array.isArray(row.months) && row.months.length > 0 && row.months.every((m) => isInt(m) && m >= 1 && m <= 12) && new Set(row.months).size === row.months.length,
        'lista med olika heltal 1–12, utelämna för hela året',
      );
    }
  });
}

/** content/_innan-avresa.json (formatet står i docs/FORMAT.md). */
export function validatePretripList(name, json) {
  return checkAppList(name, json, ['id', 'title', 'hint', 'days_before'], (row, check) => {
    if (isStr(row.hint)) check(row, 'hint', row.hint.length <= 200, 'högst 200 tecken');
    check(row, 'days_before', isInt(row.days_before) && row.days_before >= 0 && row.days_before <= 365, 'krävs, heltal 0–365 (0 = avresedagen)');
  });
}
