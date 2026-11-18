// Delade länder (content/_landlistor.json, fältet delade): valideringen i npm run import:check och raderna som
// importen skriver. Formatet står i docs/FORMAT.md och i appen i src/lib/delade.ts. Testas i delade.test.mjs.

/** Delens id: landets kod, bindestreck och små bokstäver eller siffror (GB-eng). Ryms i place_status-formatet. */
const partRe = (iso) => new RegExp(`^${iso}-[a-z0-9]+$`);

/** Har texten ett namn: en text eller en språkstil med neutral? */
const hasName = (e) => (typeof e === 'string' && e.trim() !== '') || (e && typeof e === 'object' && typeof e.neutral === 'string' && e.neutral.trim() !== '');

/**
 * Fel i fältet delade. appCountries är appens landskoder (src/lib/countries.ts). texts är texterna på båda
 * språken ({ sv, en }, objektet texter ur _texter.json och _texter.en.json); saknas de kontrolleras inte namnen.
 * check(row, field, ok, message) är valideringens vanliga felrapportering.
 */
export function validateSplit(split, appCountries, texts, check) {
  const row = { id: '-' };
  if (split === undefined) return;
  const isObj = split !== null && typeof split === 'object' && !Array.isArray(split);
  check(row, 'delade', isObj, 'objekt med landskod och lista med delar krävs');
  if (!isObj) return;
  const known = new Set(appCountries);
  const seen = new Set();
  for (const [iso, parts] of Object.entries(split)) {
    check({ id: iso }, 'delade', /^[A-Z]{2}$/.test(iso) && known.has(iso), 'landet finns inte bland appens länder (src/lib/countries.ts)');
    const ok = Array.isArray(parts) && parts.length > 0 && parts.every((p) => typeof p === 'string');
    check({ id: iso }, 'delade', ok, 'lista med minst en del krävs');
    if (!ok) continue;
    for (const p of parts) {
      check({ id: p }, 'delade', partRe(iso).test(p), `delens id ska börja med ${iso}- följt av små bokstäver eller siffror`);
      check({ id: p }, 'delade', !seen.has(p), 'finns två gånger');
      seen.add(p);
      if (!texts) continue;
      for (const [lang, file] of [['sv', '_texter.json'], ['en', '_texter.en.json']])
        check({ id: p }, 'delade', hasName(texts[lang]?.[`land.${p}`]), `namn saknas under land.${p} i ${file}`);
    }
  }
}

/** Namnet ur texten (en text eller språkstilens neutral). */
const nameOf = (e) => (typeof e === 'string' ? e : e?.neutral);

/**
 * Raderna som importen skriver för delade länder: delarna som platser av typen land med landet som förälder,
 * som länderna utan landsfil (data.light = true). Världsdelen är landets (appen räknar den från landet,
 * src/lib/delade.ts). Finns landet inte bland platserna läggs det till på samma sätt, eftersom
 * places.parent_id kräver det.
 * - split: fältet delade. existingIds: id:n som redan skrivs. svTexts: texterna på svenska (namnet).
 * - countryName(iso) och countryCoords(iso) ger landets namn och [lat, lon]. partCoords(id) ger delens [lat, lon].
 */
export function splitRows(split, existingIds, svTexts, countryName, countryCoords, partCoords) {
  const have = new Set(existingIds);
  const rows = [];
  for (const [iso, parts] of Object.entries(split ?? {})) {
    if (!have.has(iso)) {
      const [lat, lon] = countryCoords(iso) ?? [null, null];
      rows.push({ id: iso, kind: 'country', parent_id: null, name: countryName(iso), iso2: iso, lat, lon, layer: null, airport: null, smart_months: null, data: { light: true } });
      have.add(iso);
    }
    for (const p of parts) {
      const [lat, lon] = partCoords(p) ?? [null, null];
      rows.push({ id: p, kind: 'country', parent_id: iso, name: nameOf(svTexts[`land.${p}`]) ?? p, iso2: null, lat, lon, layer: null, airport: null, smart_months: null, data: { light: true } });
    }
  }
  return rows;
}
