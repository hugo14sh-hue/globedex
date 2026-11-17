// content/_upptack.json: lätta platser för fliken Upptäck, klimat och taggar för befintliga städer och
// alternativ till dyra platser. Formatet står i filens _om och i docs/FORMAT.md.
// Ren modul utan nätverk och nycklar: valideras i npm run import:check och görs om till rader i places
// av npm run import. Röktestet (e2e/) använder samma rader när importen inte är körd. Testas i upptack.test.mjs.

const FILE = '_upptack.json';
const TOP = ['_om', 'tags', 'climates', 'pli_year', 'pli_restaurants_hotels', 'existing', 'places', 'alternatives'];
const PLACE_FIELDS = ['id', 'name', 'country', 'lat', 'lon', 'level', 'level_rule', 'level_note', 'climate', 'best_months', 'tags', 'gem', 'why', 'citybreak_gbp'];
const EXISTING_FIELDS = ['climate', 'tags'];
const ALT_FIELDS = ['for', 'place', 'why', 'cheaper'];
/** Fälten som lätta platser får i data (utöver light). Allt annat på platsen är kolumner i places. */
const LIGHT_DATA = ['level', 'level_rule', 'level_note', 'climate', 'best_months', 'tags', 'gem', 'why', 'citybreak_gbp'];

/** En lätt plats id: landskoden, bindestreck och små bokstäver, siffror och bindestreck ("BA-sarajevo"). */
export const LIGHT_ID_RE = /^[A-Z]{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
const VALUE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isLevel = (v) => isInt(v) && v >= 1 && v <= 5;

/** Prisnivån för en befintlig stad: data.prices.level i landsfilen. */
const contentLevel = (p) => (isObj(p?.data?.prices) && isLevel(p.data.prices.level) ? p.data.prices.level : null);

/**
 * Validerar _upptack.json.
 * appCountries: landskoderna i appen (src/lib/countries.ts).
 * contentPlaces: platserna i landsfilerna ({ id, kind, data }), för existing och alternativen.
 * Fel som { file, id, field, message }, som i validate-content.mjs.
 */
export function validateDiscover(json, appCountries, contentPlaces) {
  const errs = [];
  const err = (id, field, message) => errs.push({ file: FILE, id: id ?? '-', field, message });
  if (!isObj(json)) return [{ file: FILE, id: '-', field: '-', message: 'filen ska vara ett JSON-objekt' }];
  for (const k of Object.keys(json)) if (!TOP.includes(k)) err('-', k, 'okänd del i filen');

  const known = new Set(appCountries);
  const content = new Map(contentPlaces.map((p) => [p.id, p]));

  // Tillåtna värden.
  const lists = {};
  for (const key of ['tags', 'climates']) {
    const v = json[key];
    const ok = Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && VALUE_RE.test(x));
    if (!ok) err('-', key, 'lista med värden (små bokstäver, siffror och bindestreck)');
    else if (new Set(v).size !== v.length) err('-', key, 'samma värde finns två gånger');
    lists[key] = new Set(ok ? v : []);
  }
  if (!isInt(json.pli_year) || json.pli_year < 2000 || json.pli_year > 2100) err('-', 'pli_year', 'årtal krävs');
  if (!isObj(json.pli_restaurants_hotels)) err('-', 'pli_restaurants_hotels', 'objekt med landskod och index krävs');
  else
    for (const [c, v] of Object.entries(json.pli_restaurants_hotels)) {
      if (!COUNTRY_RE.test(c) || !known.has(c)) err(c, 'pli_restaurants_hotels', 'finns inte bland appens länder (src/lib/countries.ts)');
      if (!isNum(v) || v <= 0) err(c, 'pli_restaurants_hotels', 'ska vara ett tal över 0');
    }

  const checkClimate = (id, v) => {
    if (!lists.climates.has(v)) err(id, 'climate', `ska vara ett av värdena i climates (${[...lists.climates].join(', ')})`);
  };
  const checkTags = (id, v) => {
    if (!Array.isArray(v) || v.length === 0) return err(id, 'tags', 'lista med minst en tagg');
    for (const x of v) if (!lists.tags.has(x)) err(id, 'tags', `taggen ${x} finns inte i tags`);
    if (new Set(v).size !== v.length) err(id, 'tags', 'samma tagg finns två gånger');
  };

  // Lätta platser.
  const levels = new Map();
  const places = Array.isArray(json.places) ? json.places : [];
  if (!Array.isArray(json.places)) err('-', 'places', 'ska vara en lista');
  const seen = new Set();
  for (const p of places) {
    if (!isObj(p)) {
      err('-', 'places', 'raden ska vara ett objekt');
      continue;
    }
    const id = typeof p.id === 'string' ? p.id : '(saknar id)';
    for (const k of Object.keys(p)) if (!PLACE_FIELDS.includes(k)) err(id, k, 'okänt fält');
    if (!isStr(p.id) || !LIGHT_ID_RE.test(p.id)) err(id, 'id', 'id ska vara landskoden, bindestreck och små bokstäver, siffror och bindestreck (BA-sarajevo)');
    else if (isStr(p.country) && !p.id.startsWith(`${p.country}-`)) err(id, 'id', `id ska börja med landskoden ${p.country}`);
    if (seen.has(p.id)) err(id, 'id', 'finns två gånger i places');
    if (content.has(p.id)) err(id, 'id', 'finns redan i en landsfil');
    seen.add(p.id);
    if (!isStr(p.name)) err(id, 'name', 'krävs');
    if (!isStr(p.country) || !COUNTRY_RE.test(p.country) || !known.has(p.country)) err(id, 'country', 'finns inte bland appens länder (src/lib/countries.ts)');
    for (const k of ['lat', 'lon'])
      if (!isNum(p[k]) || Math.abs(p[k]) > (k === 'lat' ? 90 : 180)) err(id, k, 'ska vara ett tal i rätt intervall');
    if (!isLevel(p.level)) err(id, 'level', 'heltal 1 till 5');
    if (!isLevel(p.level_rule)) err(id, 'level_rule', 'heltal 1 till 5');
    if (isLevel(p.level) && isLevel(p.level_rule)) {
      if (p.level !== p.level_rule && !isStr(p.level_note)) err(id, 'level_note', 'krävs när level avviker från level_rule');
      if (p.level === p.level_rule && p.level_note !== undefined) err(id, 'level_note', 'bara när level avviker från level_rule');
    }
    if (p.level_note !== undefined && !isStr(p.level_note)) err(id, 'level_note', 'text');
    checkClimate(id, p.climate);
    const m = p.best_months;
    if (!Array.isArray(m) || m.length === 0 || !m.every((x) => isInt(x) && x >= 1 && x <= 12) || new Set(m).size !== m.length)
      err(id, 'best_months', 'lista med olika månader 1 till 12');
    checkTags(id, p.tags);
    if (typeof p.gem !== 'boolean') err(id, 'gem', 'sant eller falskt');
    if (!isStr(p.why)) err(id, 'why', 'en mening krävs');
    if (p.citybreak_gbp !== undefined && (!isNum(p.citybreak_gbp) || p.citybreak_gbp <= 0)) err(id, 'citybreak_gbp', 'belopp i pund, över 0');
    if (isStr(p.id)) levels.set(p.id, isLevel(p.level) ? p.level : null);
  }

  // Befintliga städer: klimat och taggar.
  if (!isObj(json.existing)) err('-', 'existing', 'objekt med platsens id och { climate, tags }');
  else
    for (const [id, e] of Object.entries(json.existing)) {
      const p = content.get(id);
      if (!p) err(id, 'existing', 'platsen finns inte i landsfilerna');
      else if (p.kind !== 'city') err(id, 'existing', 'ska vara en stad (kind city)');
      if (seen.has(id)) err(id, 'existing', 'finns också i places');
      if (!isObj(e)) {
        err(id, 'existing', 'ska vara { climate, tags }');
        continue;
      }
      for (const k of Object.keys(e)) if (!EXISTING_FIELDS.includes(k)) err(id, k, 'okänt fält');
      checkClimate(id, e.climate);
      checkTags(id, e.tags);
      if (p) levels.set(id, contentLevel(p));
    }

  // Alternativen.
  const alts = Array.isArray(json.alternatives) ? json.alternatives : [];
  if (!Array.isArray(json.alternatives)) err('-', 'alternatives', 'ska vara en lista');
  const pairs = new Set();
  for (const a of alts) {
    if (!isObj(a)) {
      err('-', 'alternatives', 'raden ska vara ett objekt');
      continue;
    }
    const id = `${a.for} > ${a.place}`;
    for (const k of Object.keys(a)) if (!ALT_FIELDS.includes(k)) err(id, k, 'okänt fält');
    const forOk = levels.has(a.for);
    const placeOk = levels.has(a.place);
    if (!forOk) err(id, 'for', `platsen ${a.for} finns inte bland places eller existing`);
    if (!placeOk) err(id, 'place', `platsen ${a.place} finns inte bland places eller existing`);
    if (a.for === a.place) err(id, 'place', 'samma plats som for');
    if (pairs.has(id)) err(id, 'place', 'samma alternativ finns två gånger');
    pairs.add(id);
    if (!isStr(a.why)) err(id, 'why', 'en mening krävs');
    if (typeof a.cheaper !== 'boolean') err(id, 'cheaper', 'sant eller falskt');
    if (forOk && placeOk) {
      const lf = levels.get(a.for);
      const lp = levels.get(a.place);
      if (lf == null) err(id, 'for', 'platsen saknar prisnivå');
      if (lp == null) err(id, 'place', 'platsen saknar prisnivå');
      if (lf != null && lp != null) {
        if (lp > lf) err(id, 'place', `alternativet har högre prisnivå (${lp}) än platsen det hör till (${lf})`);
        if (typeof a.cheaper === 'boolean' && a.cheaper !== lp < lf) err(id, 'cheaper', `ska vara ${lp < lf} (prisnivå ${lp} mot ${lf})`);
      }
    }
  }
  return errs;
}

/** Alternativen per plats (for), i filens ordning. */
function alternativesByPlace(json) {
  const out = new Map();
  for (const a of json.alternatives ?? []) {
    const list = out.get(a.for) ?? [];
    list.push({ place: a.place, why: a.why, cheaper: a.cheaper });
    out.set(a.for, list);
  }
  return out;
}

/**
 * Raderna som importen skriver. Görs bara när valideringen har gått igenom.
 * - countries: länder som inte har en landsfil men har lätta platser. places.parent_id kräver att landet
 *   finns. De får data.light = true och namnet från countryName (webbläsarens/ICU:s namn på svenska).
 * - cities: de lätta platserna som städer under sitt land, med fälten i data och data.light = true.
 * - patches: det som läggs till i data på befintliga platser (climate, tags och alternatives).
 * countryCoords(iso) ger [lat, lon] för landets mittpunkt, eller null.
 */
export function discoverRows(json, contentPlaces, countryName, countryCoords) {
  const content = new Set(contentPlaces.map((p) => p.id));
  const alts = alternativesByPlace(json);
  const judged = Array.isArray(json._om?.own_judgment) ? json._om.own_judgment : [];
  const pli = json.pli_restaurants_hotels ?? {};

  const cities = json.places.map((p) => {
    const data = { light: true };
    for (const k of LIGHT_DATA) if (p[k] !== undefined) data[k] = p[k];
    if (alts.has(p.id)) data.alternatives = alts.get(p.id);
    if (typeof pli[p.country] === 'number') {
      data.pli = pli[p.country];
      data.pli_year = json.pli_year;
    }
    // Fälten som är egen bedömning (_om.own_judgment), bara de som finns på platsen.
    const own = judged.filter((k) => k in data);
    if (own.length) data.own_judgment = own;
    return { id: p.id, kind: 'city', parent_id: p.country, name: p.name, iso2: null, lat: p.lat, lon: p.lon, layer: null, airport: null, smart_months: null, data };
  });

  const countries = [...new Set(json.places.map((p) => p.country))]
    .filter((c) => !content.has(c))
    .sort()
    .map((c) => {
      const [lat, lon] = countryCoords(c) ?? [null, null];
      return { id: c, kind: 'country', parent_id: null, name: countryName(c), iso2: c, lat, lon, layer: null, airport: null, smart_months: null, data: { light: true } };
    });

  const patches = new Map();
  for (const [id, e] of Object.entries(json.existing ?? {})) patches.set(id, { climate: e.climate, tags: e.tags });
  for (const [id, list] of alts) if (content.has(id)) patches.set(id, { ...(patches.get(id) ?? {}), alternatives: list });

  return { countries, cities, patches };
}

/** Lägger patcharna i data på befintliga platser. Platser utan patch lämnas som de är. */
export function applyPatches(rows, patches) {
  return rows.map((r) => (patches.has(r.id) ? { ...r, data: { ...(r.data ?? {}), ...patches.get(r.id) } } : r));
}
