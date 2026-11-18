import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { englishRows, readEnglishDir, validateEnglish, withEnglish } from './en.mjs';

// Testdata med påhittade id:n och platshållartext ("sv ..." och "en ..."). Bara för valideringen.
const SV_COUNTRY = {
  places: [
    { id: 'XX', kind: 'country', name: 'sv land' },
    {
      id: 'XX-stad',
      kind: 'city',
      name: 'sv stad',
      data: {
        best_text: 'sv bäst',
        month_notes: ['sv1', 'sv2', 'sv3', 'sv4', 'sv5', 'sv6', 'sv7', 'sv8', 'sv9', 'sv10', 'sv11', 'sv12'],
        areas: [
          { name: 'sv a', stay: true, text: 'sv a text' },
          { name: 'sv b', stay: false, text: 'sv b text' },
        ],
        prices: { currency: 'EUR', level: 3, rows: [{ key: 'kaffe', typical: 3 }, { key: 'ol', typical: 5, note: 'sv not' }] },
        day_budget_sek: 900,
      },
    },
  ],
  facts: [{ id: 'XX-fakta', title: 'sv titel', summary: 'sv kort {antal}' }],
  items: [{ id: 'XX-sak', name: 'sv sak' }],
  compendium: [{ id: 'kort', name: 'sv kort', hint: 'sv ledtråd' }],
  ideas: [],
  gifts: [],
};
const SV_DISCOVER = {
  places: [{ id: 'YY-lätt', name: 'sv lätt', why: 'sv varför', level_note: 'sv nivå' }],
  existing: { 'XX-stad': { why: 'sv varför stad' } },
  alternatives: [
    { for: 'XX-stad', place: 'YY-lätt', why: 'sv alt 1', cheaper: true },
    { for: 'XX-stad', place: 'ZZ-annan', why: 'sv alt 2', cheaper: true },
  ],
};
const SV_BUCKET = [
  { id: 'b-delar', name: 'sv punkt', season: 'sv säsong', checklist: { type: 'delar', items: ['sv del 1', 'sv del 2'] } },
  { id: 'b-antal', name: 'sv antal', checklist: { type: 'antal', metric: 'countries_visited', target: 3 } },
];
const SV_PACK = { items: [{ id: 'pass', group: 'Dokument', title: 'sv pass' }, { id: 'laddare', group: 'Teknik', title: 'sv laddare' }] };
const SV_PRETRIP = { items: [{ id: 'f', title: 'sv f', hint: 'sv tips', days_before: 3 }] };
const SV = { 'XX.json': SV_COUNTRY, '_upptack.json': SV_DISCOVER, '_bucket.json': SV_BUCKET, '_packlista.json': SV_PACK, '_innan-avresa.json': SV_PRETRIP };

const run = (en) => validateEnglish(en, SV);
const messages = (en) => run(en).errors.map((e) => `${e.file} · ${e.id} · ${e.field}: ${e.message}`);

describe('validateEnglish', () => {
  it('godtar tomma och delvisa filer, och saknade översättningar är inte fel', () => {
    const res = run({ 'XX.json': { places: { 'XX-stad': { name: 'en city' } } }, '_bucket.json': {} });
    expect(res.errors).toEqual([]);
  });

  it('skriver en sammanställning per fil med översatta texter av totalt antal', () => {
    const res = run({
      'XX.json': { places: { 'XX-stad': { name: 'en city', data: { month_notes: [null, null, 'en3', null, null, null, null, null, null, null, null, null] } } } },
      '_packlista.json': { groups: { Dokument: 'Documents' }, items: { pass: { title: 'en passport' } } },
      '_innan-avresa.json': { items: {} },
    });
    expect(res.errors).toEqual([]);
    // XX.json: 2 namn + best_text + 12 månader + 4 i areas + 1 not + 2 i fakta + 1 sak + 2 i kompendiet = 25
    expect(res.summary).toEqual([
      { file: 'en/XX.json', done: 2, total: 25 },
      { file: 'en/_innan-avresa.json', done: 0, total: 2 },
      { file: 'en/_packlista.json', done: 2, total: 4 },
    ]);
  });

  it('stoppar okända id:n, okända fält och okända filer', () => {
    const m = messages({
      'XX.json': { places: { 'XX-saknas': { name: 'en' } }, facts: { 'XX-fakta': { source_url: 'https://x' } }, extra: {} },
      '_upptack.json': { places: { 'YY-saknas': { why: 'en' } }, alternatives: { 'XX-stad>QQ': 'en' } },
      '_bucket.json': { 'b-saknas': { name: 'en' } },
      '_packlista.json': { groups: { Okänd: 'Unknown' } },
      'notes.json': {},
    });
    expect(m).toContain('en/XX.json · XX-saknas · places: id finns inte i places i content/XX.json');
    expect(m).toContain('en/XX.json · XX-fakta · source_url: okänt fält');
    expect(m).toContain('en/XX.json · - · extra: okänd del i filen');
    expect(m).toContain('en/_upptack.json · YY-saknas · places: platsen finns inte i places i content/_upptack.json');
    expect(m).toContain('en/_upptack.json · XX-stad>QQ · alternatives: alternativet finns inte i content/_upptack.json (nyckeln är "<for>><place>")');
    expect(m).toContain('en/_bucket.json · b-saknas · id: finns inte i content/_bucket.json');
    expect(m).toContain('en/_packlista.json · Okänd · groups: gruppen finns inte i content/_packlista.json');
    expect(m.some((x) => x.startsWith('en/notes.json · - · -: okänd fil'))).toBe(true);
  });

  it('stoppar listor med fel längd', () => {
    const m = messages({
      'XX.json': { places: { 'XX-stad': { data: { month_notes: ['en1'], areas: [{}] } } } },
      '_bucket.json': { 'b-delar': { checklist_items: ['en 1'] } },
    });
    expect(m).toContain('en/XX.json · XX-stad · data.month_notes: listan har 1 poster, svenska har 12');
    expect(m).toContain('en/XX.json · XX-stad · data.areas: listan har 1 poster, svenska har 2');
    expect(m).toContain('en/_bucket.json · b-delar · checklist_items: listan har 1 poster, svenska har 2');
  });

  it('stoppar tomma texter och platshållare som inte finns i svenskan', () => {
    const m = messages({
      'XX.json': { facts: { 'XX-fakta': { title: ' ', summary: 'en {antal} {namn}' } } },
      '_innan-avresa.json': { items: { f: { title: '' } } },
    });
    expect(m).toContain('en/XX.json · XX-fakta · title: tom text, utelämna fältet i stället');
    expect(m).toContain('en/XX.json · XX-fakta · summary: platshållaren {namn} finns inte i den svenska texten');
    expect(m).not.toContain('en/XX.json · XX-fakta · summary: platshållaren {antal} finns inte i den svenska texten');
    expect(m).toContain('en/_innan-avresa.json · f · title: tom text, utelämna fältet i stället');
  });

  it('stoppar ett fält som finns på engelska men saknas på svenska', () => {
    const m = messages({
      'XX.json': {
        facts: { 'XX-fakta': { body: 'en body' } },
        places: { 'XX-stad': { data: { prices: { rows: [{ note: 'en not' }, {}] }, day_budget_note: 'en' } } },
      },
      '_upptack.json': { existing: {}, places: { 'YY-lätt': { why: 'en' } } },
      '_bucket.json': { 'b-antal': { season: 'en', checklist_items: ['x'] } },
      '_innan-avresa.json': { items: {} },
    });
    expect(m).toContain('en/XX.json · XX-fakta · body: finns på engelska men saknas på svenska');
    expect(m).toContain('en/XX.json · XX-stad · data.prices.rows[0].note: finns på engelska men saknas på svenska');
    expect(m).toContain('en/XX.json · XX-stad · data.day_budget_note: finns på engelska men saknas på svenska');
    expect(m).toContain('en/_bucket.json · b-antal · season: finns på engelska men saknas på svenska');
    expect(m).toContain('en/_bucket.json · b-antal · checklist_items: bara för delmål av typen delar');
  });
});

describe('englishRows', () => {
  const en = {
    'XX.json': { places: { 'XX-stad': { name: 'en city', data: { best_text: 'en best' } } }, compendium: { kort: { name: 'en card' } } },
    '_upptack.json': {
      places: { 'YY-lätt': { why: 'en why', name: 'en light' } },
      existing: { 'XX-stad': { why: 'en why city' } },
      alternatives: { 'XX-stad>ZZ-annan': 'en alt 2' },
    },
    '_bucket.json': { 'b-delar': { name: 'en item', checklist_items: ['en 1', 'en 2'] } },
  };
  const places = [
    { id: 'XX-stad', data: { alternatives: [{ place: 'YY-lätt', why: 'sv alt 1', cheaper: true }, { place: 'ZZ-annan', why: 'sv alt 2', cheaper: true }] } },
    { id: 'YY-lätt', data: {} },
    { id: 'XX', data: {} },
  ];

  it('lägger ihop engelskan från landsfilen och _upptack.json i samma objekt', () => {
    const rows = englishRows(en, places);
    expect(rows.places.get('XX-stad')).toEqual({
      name: 'en city',
      data: { best_text: 'en best', why: 'en why city', alternatives: [{}, { why: 'en alt 2' }] },
    });
    expect(rows.places.get('YY-lätt')).toEqual({ name: 'en light', data: { why: 'en why' } });
    expect(rows.compendium.get('kort')).toEqual({ name: 'en card' });
    expect(rows.bucket.get('b-delar')).toEqual({ name: 'en item', checklist: { items: ['en 1', 'en 2'] } });
  });

  it('sätter en till null när raden saknar engelska, och ger samma svar varje gång', () => {
    const map = englishRows(en, places).places;
    const once = withEnglish(places, map);
    expect(once.find((r) => r.id === 'XX').en).toBeNull();
    expect(withEnglish(once, englishRows(en, places).places)).toEqual(once);
  });
});

describe('content/en/', () => {
  it('innehållsfilerna läses in', () => {
    const en = readEnglishDir(join(process.cwd(), 'content'));
    expect(Object.keys(en)).toEqual(expect.arrayContaining(['_upptack.json', '_bucket.json', '_packlista.json', '_innan-avresa.json']));
  });
});
