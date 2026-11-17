import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sortPlaces, toDbRow, validateContent, validateCountryLists, validatePackList, validatePretripList, validateRates } from './validate-content.mjs';

// Testdata med påhittade id:n. Innehållet är bara platshållare för valideringen.
const base = () => ({
  places: [
    { id: 'XX', kind: 'country', name: 'a', iso2: 'XX', lat: 1, lon: 2 },
    { id: 'XX-stad', kind: 'city', parent_id: 'XX-region', name: 'b', lat: 1, lon: 2 },
    { id: 'XX-region', kind: 'region', parent_id: 'XX', name: 'c', lat: 1, lon: 2 },
  ],
  facts: [
    { id: 'XX-fakta-mobil', place_id: 'XX', topic: 'mobil', is_rule: false, title: 't' },
    { id: 'XX-regel-alkohol', place_id: 'XX', topic: 'alkohol', is_rule: true, min_age: 18, title: 't', source_url: 'https://example.org', verified_on: '2026-01-02' },
  ],
  items: [{ id: 'XX-stad-sak', place_id: 'XX-stad', category: 'mat', name: 'n', compendium_id: 'mat-sak', source_url: 'https://example.org', verified_on: '2026-01-02' }],
  compendium: [{ id: 'mat-sak', category: 'mat', name: 'n', rarity: 'vanlig' }],
  ideas: [{ id: 'XX-ide', place_id: 'XX-stad', kind: 'i-stan', title: 't', tags: ['ute'] }],
  gifts: [{ id: 'XX-present', place_id: 'XX', name: 'n', for_whom: ['mamma'] }],
});

const run = (json, bucket = null) => validateContent([{ name: 'XX.json', json }], bucket);
const fields = (r) => r.errors.map((e) => `${e.id}/${e.field}`);

describe('validering av innehåll', () => {
  it('godkänner en korrekt fil', () => {
    const r = run(base(), { name: '_bucket.json', json: [{ id: 'bucket-x', name: 'n', category: 'natur', place_ids: ['XX'] }] });
    expect(r.errors).toEqual([]);
    expect(r.rows.places).toHaveLength(3);
    expect(r.rows.bucket).toHaveLength(1);
  });

  it('sorterar land före region och stad', () => {
    const r = run(base());
    expect(r.rows.places.map((p) => p.id)).toEqual(['XX', 'XX-region', 'XX-stad']);
    expect(sortPlaces([{ id: 'XX-a', kind: 'spot', parent_id: 'XX' }, { id: 'XX', kind: 'country' }]).map((p) => p.id)).toEqual(['XX', 'XX-a']);
  });

  it('vägrar regler utan källa och kontrolldatum', () => {
    const j = base();
    delete j.facts[1].source_url;
    delete j.facts[1].verified_on;
    const r = run(j);
    expect(fields(r)).toEqual(['XX-regel-alkohol/source_url', 'XX-regel-alkohol/verified_on']);
    expect(r.errors[0].file).toBe('XX.json');
  });

  it('vägrar ogiltigt kontrolldatum', () => {
    const j = base();
    j.facts[1].verified_on = '2026-02-30';
    expect(fields(run(j))).toEqual(['XX-regel-alkohol/verified_on']);
  });

  it('stoppar hela filen vid ett fel', () => {
    const j = base();
    j.gifts[0].for_whom = ['granne'];
    const r = run(j);
    expect(fields(r)).toEqual(['XX-present/for_whom']);
    expect(r.rows.places).toHaveLength(0);
    expect(r.rows.facts).toHaveLength(0);
  });

  it('kräver källa på listpunkter', () => {
    const j = base();
    delete j.items[0].source_url;
    expect(fields(run(j))).toEqual(['XX-stad-sak/source_url']);
  });

  it('kontrollerar id, landskod och okända fält', () => {
    const j = base();
    j.ideas[0].id = 'YY-ide';
    j.facts[0].id = 'XX-Fakta';
    j.places[0].extra = 1;
    expect(fields(run(j)).sort()).toEqual(['XX-Fakta/id', 'XX/extra', 'YY-ide/id'].sort());
  });

  it('kontrollerar längder och listor', () => {
    const j = base();
    j.facts[0].summary = 'x'.repeat(81);
    j.facts[0].body = 'x'.repeat(401);
    j.places[0].smart_months = [1, 2, 3];
    expect(fields(run(j)).sort()).toEqual(['XX-fakta-mobil/body', 'XX-fakta-mobil/summary', 'XX/smart_months'].sort());
  });

  it('kontrollerar data på en plats', () => {
    const j = base();
    j.places[1].data = {
      stay: [{ label: 'l', days: 3, text: 't', recommended: true }],
      transport: [{ mode: 'm', rating: 'snabbt', text: 't' }],
      okant: 1,
    };
    expect(fields(run(j)).sort()).toEqual(['XX-stad/data.okant', 'XX-stad/data.transport'].sort());
  });

  it('kontrollerar hänvisningar mellan delar', () => {
    const j = base();
    j.items[0].compendium_id = 'finns-inte';
    j.gifts[0].place_id = 'XX-borta';
    j.places[1].parent_id = 'XX-saknas';
    expect(fields(run(j)).sort()).toEqual(['XX-present/place_id', 'XX-stad-sak/compendium_id', 'XX-stad/parent_id'].sort());
  });

  it('upptäcker dubbletter mellan filer', () => {
    const a = base();
    const b = { places: [{ id: 'YY', kind: 'country', name: 'y', iso2: 'YY', lat: 1, lon: 1 }], compendium: [{ ...a.compendium[0], name: 'annat' }] };
    const r = validateContent([{ name: 'XX.json', json: a }, { name: 'YY.json', json: b }], null);
    expect(r.errors.map((e) => `${e.file}/${e.field}`)).toEqual(['YY.json/id']);
  });

  it('validerar checklist på bucketpunkter', () => {
    const b = (checklist) => run(base(), { name: '_bucket.json', json: [{ id: 'bucket-x', name: 'n', category: 'natur', place_ids: [], checklist }] }).errors;
    expect(b({ type: 'platser', place_ids: ['XX'] })).toEqual([]);
    expect(b({ type: 'platser', source: 'besokta-lander' })).toEqual([]);
    expect(b({ type: 'antal', metric: 'countries_visited', target: 10 })).toEqual([]);
    expect(b({ type: 'delar', items: ['A', 'B'] })).toEqual([]);
    expect(b({ type: 'platser', place_ids: ['ZZ'] }).map((e) => e.message)).toEqual(['platsen ZZ finns inte']);
    expect(b({ type: 'platser', parent_id: 'XX', layer: 'landskap' }).map((e) => e.message)).toEqual(['inga platser under XX med layer landskap']);
    expect(b({ type: 'platser', place_ids: ['XX'], source: 'besokta-lander' })).toHaveLength(1);
    expect(b({ type: 'platser', source: 'annat' })).toHaveLength(1);
    expect(b({ type: 'antal', metric: 'okand', target: 0 })).toHaveLength(2);
    expect(b({ type: 'delar', items: [] })).toHaveLength(1);
    expect(b({ type: 'delar', items: ['A', 'A'] })).toHaveLength(1);
    expect(b({ type: 'delar', items: ['A'], extra: 1 })).toHaveLength(1);
    expect(b({ type: 'okand' })).toHaveLength(1);
    expect(b('text')).toHaveLength(1);
  });

  it('toDbRow nollar checklist när fältet saknas', () => {
    expect(toDbRow('bucket', { id: 'b' }).checklist).toBeNull();
    expect(toDbRow('bucket', { id: 'b', checklist: { type: 'delar', items: ['A'] } }).checklist).toEqual({ type: 'delar', items: ['A'] });
  });

  it('kontrollerar filnamn och bucketlistan', () => {
    const r = validateContent([{ name: 'xx.json', json: { places: [] } }], { name: '_bucket.json', json: [{ id: 'b', name: 'n', category: 'okand', place_ids: ['ZZ'] }] });
    expect(r.errors.map((e) => e.field).sort()).toEqual(['-', 'category', 'place_ids'].sort());
  });

  it('fyller standardvärden för databasen', () => {
    expect(toDbRow('places', { id: 'XX' }).data).toEqual({});
    expect(toDbRow('gifts', { id: 'XX-g' })).toMatchObject({ keywords: [], collection_motifs: {} });
  });

  it('godkänner month_notes och events, och stoppar fel', () => {
    const notes = Array.from({ length: 12 }, (_, i) => `m${i}`);
    const ev = { name: 'n', start: '2027-06-04', end: '2027-06-06', text: 't', source: 'https://example.org' };
    const withData = (data) => {
      const j = base();
      j.places[1].data = data;
      return fields(run(j));
    };
    expect(withData({ month_notes: notes, events: [ev] })).toEqual([]);
    expect(withData({ month_notes: notes.slice(1) })).toEqual(['XX-stad/data.month_notes']);
    expect(withData({ month_notes: [...notes.slice(1), ''] })).toEqual(['XX-stad/data.month_notes']);
    expect(withData({ events: 'x' })).toEqual(['XX-stad/data.events']);
    expect(withData({ events: [{ ...ev, start: '2027-6-4' }] })).toEqual(['XX-stad/data.events[0].start']);
    expect(withData({ events: [{ ...ev, end: '2027-06-03' }] })).toEqual(['XX-stad/data.events[0].end']);
    expect(withData({ events: [{ ...ev, source: undefined }] })).toEqual(['XX-stad/data.events[0].source']);
    expect(withData({ events: [{ ...ev, extra: 1 }] })).toEqual(['XX-stad/data.events[0].extra']);
    expect(withData({ events: [{ start: '2027-06-04', end: '2027-06-04', source: 'https://example.org' }] }).sort()).toEqual(
      ['XX-stad/data.events[0].name', 'XX-stad/data.events[0].text'].sort(),
    );
  });

  it('godkänner seasons och stoppar fel', () => {
    const se = { name: 'n', from: 11, to: 3, text: 't', source: 'https://example.org' };
    const withData = (data) => {
      const j = base();
      j.places[1].data = data;
      return fields(run(j));
    };
    expect(withData({ seasons: [se, { name: 'en', from: 4, to: 4 }], own_judgment: ['seasons'] })).toEqual([]);
    expect(withData({ seasons: 'x' })).toEqual(['XX-stad/data.seasons']);
    expect(withData({ seasons: [{ ...se, name: '' }] })).toEqual(['XX-stad/data.seasons[0].name']);
    expect(withData({ seasons: [{ ...se, from: 0 }] })).toEqual(['XX-stad/data.seasons[0].from']);
    expect(withData({ seasons: [{ ...se, to: 13 }] })).toEqual(['XX-stad/data.seasons[0].to']);
    expect(withData({ seasons: [{ ...se, from: 2.5 }] })).toEqual(['XX-stad/data.seasons[0].from']);
    expect(withData({ seasons: [{ ...se, from: '4' }] })).toEqual(['XX-stad/data.seasons[0].from']);
    expect(withData({ seasons: [{ ...se, to: undefined }] })).toEqual(['XX-stad/data.seasons[0].to']);
    expect(withData({ seasons: [{ ...se, source: 'example.org' }] })).toEqual(['XX-stad/data.seasons[0].source']);
    expect(withData({ seasons: [{ ...se, extra: 1 }] })).toEqual(['XX-stad/data.seasons[0].extra']);
  });

  it('godkänner wiki på en listpunkt och stoppar fel form', () => {
    const j = base();
    j.items[0].wiki = 'en:Monte Carlo Casino';
    expect(run(j).errors).toEqual([]);
    j.items[0].wiki = 'Monte Carlo Casino';
    expect(fields(run(j))).toEqual(['XX-stad-sak/wiki']);
  });

  it('importen skriver wiki men aldrig bildfälten', () => {
    const row = toDbRow('items', { id: 'XX-a', wiki: 'en:A', image_url: 'https://x', image_credit: 'c', image_license: 'CC0', image_page: 'https://y' });
    expect(row).toEqual({ id: 'XX-a', wiki: 'en:A' });
    expect(toDbRow('items', { id: 'XX-a' })).toEqual({ id: 'XX-a', wiki: null });
    // Bildfälten finns inte i innehållsfilerna: de stoppas av valideringen.
    const j = base();
    j.items[0].image_url = 'https://upload.wikimedia.org/a.jpg';
    expect(fields(run(j))).toEqual(['XX-stad-sak/image_url']);
  });
});

describe('packlista och innan avresa', () => {
  const ids = (errs) => errs.map((e) => `${e.id}/${e.field}`).sort();

  it('godkänner korrekta rader', () => {
    expect(validatePackList('p', { items: [{ id: 'a', group: 'g', title: 't', min_nights: 2, max_nights: 5, months: [1, 12] }] })).toEqual([]);
    expect(validatePretripList('i', { items: [{ id: 'a', title: 't', hint: 'h', days_before: 0 }] })).toEqual([]);
  });

  it('stoppar fel i packlistan', () => {
    const errs = validatePackList('p', {
      items: [
        { id: 'a', group: 'g', title: 't', months: [0] },
        { id: 'a', title: 'T', min_nights: 5, max_nights: 2, okand: 1 },
      ],
    });
    expect(ids(errs)).toEqual(['a/group', 'a/id', 'a/max_nights', 'a/months', 'a/okand', 'a/title'].sort());
  });

  it('stoppar fel i innan avresa', () => {
    const errs = validatePretripList('i', { items: [{ id: 'A', title: 't' }, { id: 'b', title: 'u', days_before: -1, hint: '' }] });
    expect(ids(errs)).toEqual(['A/days_before', 'A/id', 'b/days_before', 'b/hint'].sort());
    expect(validatePretripList('i', [])).toHaveLength(1);
  });
});

describe('innehållet i content/', () => {
  const dir = join(process.cwd(), 'content');
  const files = readdirSync(dir)
    .filter((f) => /^[A-Z]{2}\.json$/.test(f))
    .map((name) => ({ name, json: JSON.parse(readFileSync(join(dir, name), 'utf8')) }));
  const bucket = { name: '_bucket.json', json: JSON.parse(readFileSync(join(dir, '_bucket.json'), 'utf8')) };

  it('går igenom valideringen', () => {
    expect(validateContent(files, bucket).errors).toEqual([]);
  });

  it('packlistan och innan avresa går igenom valideringen', () => {
    for (const [name, validate] of [['_packlista.json', validatePackList], ['_innan-avresa.json', validatePretripList]]) {
      const path = join(dir, name);
      if (!readdirSync(dir).includes(name)) continue;
      expect(validate(name, JSON.parse(readFileSync(path, 'utf8')))).toEqual([]);
    }
  });

  it('läses som UTF-8 med å, ä och ö', () => {
    const se = files.find((f) => f.name === 'SE.json');
    expect(se?.json.places.map((p) => p.name)).toContain('Borås');
  });
});

describe('hemliga nyckeln', () => {
  it('används aldrig i src/', () => {
    const walk = (d) =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    const hits = walk(join(process.cwd(), 'src')).filter((f) => /SUPABASE_SECRET|sb_secret_|import-content/.test(readFileSync(f, 'utf8')));
    // Testfilen själv ligger i scripts/, inte i src/.
    expect(hits).toEqual([]);
  });
});

describe('prisnivå i data.prices', () => {
  const withPrices = (prices) => {
    const j = base();
    j.places[1].data = { prices };
    return j;
  };
  const ok = () => ({
    currency: 'EUR',
    level: 3,
    checked: '2026-01-02',
    rows: [{ key: 'kaffe', typical: 3 }, { key: 'ol', low: 4, high: 8, note: 'n' }],
    sources: ['https://example.org'],
  });

  it('godkänner korrekta priser', () => {
    expect(run(withPrices(ok())).errors).toEqual([]);
  });

  it('stoppar okänd key, nivå utanför 1–5 och saknat belopp', () => {
    const p = ok();
    p.level = 6;
    p.rows.push({ key: 'glass', typical: 1 }, { key: 'vatten', low: 1 });
    expect(fields(run(withPrices(p))).sort()).toEqual(
      ['XX-stad/data.prices.level', 'XX-stad/data.prices.rows[2].key', 'XX-stad/data.prices.rows[3]', 'XX-stad/data.prices.rows[3]'].sort(),
    );
  });

  it('kräver sources och checked', () => {
    const p = ok();
    delete p.sources;
    p.checked = '2026-13-01';
    expect(fields(run(withPrices(p))).sort()).toEqual(['XX-stad/data.prices.checked', 'XX-stad/data.prices.sources']);
  });

  it('stoppar okända fält', () => {
    const p = ok();
    p.extra = 1;
    p.rows[0].pris = 2;
    expect(fields(run(withPrices(p))).sort()).toEqual(['XX-stad/data.prices.extra', 'XX-stad/data.prices.rows[0].pris']);
  });
});

describe('_valutor.json', () => {
  it('godkänner en korrekt fil och stoppar fel', () => {
    expect(validateRates('_valutor.json', { checked: '2026-11-01', source: 'https://example.org', sek_per: { EUR: 11 } })).toEqual([]);
    const errs = validateRates('_valutor.json', { checked: 'nu', sek_per: { eur: 0 } });
    expect(errs.map((e) => e.field).sort()).toEqual(['checked', 'sek_per', 'source']);
  });
});

describe('_landlistor.json', () => {
  const app = ['AA', 'BB', 'CC', 'DD'];
  const fn = Array.from({ length: 193 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);
  const all = [...fn, 'ZY', 'ZZ'];

  it('godkänner 193 kända unika koder och observatörer utan överlapp', () => {
    expect(validateCountryLists('_landlistor.json', { _om: 'x', fn, fn_observatorer: ['ZY', 'ZZ'] }, all)).toEqual([]);
  });

  it('stoppar okända koder, dubbletter, fel antal och överlapp', () => {
    const msg = (json) => validateCountryLists('_landlistor.json', json, app).map((e) => `${e.id} ${e.field}: ${e.message}`);
    expect(msg({ fn: ['AA', 'XX'], fn_observatorer: [] })).toEqual([
      'XX fn: finns inte bland appens länder (src/lib/countries.ts)',
      '- fn: ska ha 193 unika koder, har 2',
    ]);
    expect(msg({ fn: ['AA', 'AA'], fn_observatorer: ['AA'] })).toEqual([
      'AA fn: finns två gånger',
      '- fn: ska ha 193 unika koder, har 1',
      'AA fn_observatorer: finns också i fn',
    ]);
    expect(msg({ fn: 'AA', annat: 1 })).toEqual([
      '- annat: okänt fält',
      '- fn: lista med landskoder krävs',
      '- fn_observatorer: lista med landskoder krävs',
    ]);
  });

  it('fn_plus_tw_xk: kända koder som inte redan finns i fn eller fn_observatorer', () => {
    const msg = (extra) =>
      validateCountryLists('_landlistor.json', { fn, fn_observatorer: ['ZY', 'ZZ'], fn_plus_tw_xk: extra }, [...all, 'TW', 'XK']).map(
        (e) => `${e.id} ${e.field}: ${e.message}`,
      );
    expect(msg(['TW', 'XK'])).toEqual([]);
    expect(msg(['TW', 'ZY', 'QQ'])).toEqual([
      'QQ fn_plus_tw_xk: finns inte bland appens länder (src/lib/countries.ts)',
      'ZY fn_plus_tw_xk: finns redan i fn eller fn_observatorer',
    ]);
  });

  it('den riktiga filen går igenom mot appens länder', async () => {
    const { COUNTRIES } = await import('../../src/lib/countries');
    const json = JSON.parse(readFileSync(join(process.cwd(), 'content/_landlistor.json'), 'utf8'));
    expect(validateCountryLists('_landlistor.json', json, COUNTRIES.map(([iso]) => iso))).toEqual([]);
  });
});

describe('data.iso_3166_2', () => {
  const withCode = (i, code) => {
    const j = base();
    j.places[i] = { ...j.places[i], data: { iso_3166_2: code } };
    return run(j).errors.map((e) => `${e.id} ${e.field}: ${e.message}`);
  };
  it('godkänner en kod på en region', () => {
    expect(withCode(2, 'XX-AB')).toEqual([]);
  });
  it('stoppar fel form, fel land och koder på annat än regioner', () => {
    expect(withCode(2, 'xx-ab')).toEqual(['XX-region data.iso_3166_2: kod i ISO 3166-2, t.ex. US-CA']);
    expect(withCode(2, 'YY-AB')).toEqual(['XX-region data.iso_3166_2: börjar med landets kod']);
    expect(withCode(0, 'XX-AB')).toEqual(['XX data.iso_3166_2: bara för regioner']);
  });
});
