import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sortPlaces, toDbRow, validateContent, validatePackList, validatePretripList } from './validate-content.mjs';

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
