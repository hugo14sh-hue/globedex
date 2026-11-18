import { describe, expect, it } from 'vitest';
import { contentText, localize, localizeAll, mergeText, namesOf, swedish, type Translatable } from './innehallSprak';
import type { Place } from './content';
import { search } from './search';
import { placeOptions } from './placeOptions';
import { packGroupName, packSuggestions, PACK_SUGGESTIONS } from './packContent';
import { pretripSuggestions, PRETRIP_SUGGESTIONS } from './pretripContent';
import { daysBeforeFor, packFor, pretripMissing } from './tripLogic';
import { bucketParts } from './bucketParts';
import { bucketTitle } from './listLogic';

// Testdata med påhittade id:n och platshållartext ("sv ..." och "en ..."), inte innehåll.
const months = (p: string) => Array.from({ length: 12 }, (_, i) => `${p}${i + 1}`);

const place = (over: Partial<Place> = {}): Place => ({
  id: 'XX-stad',
  kind: 'city',
  parent_id: 'XX',
  layer: null,
  name: 'sv stad',
  iso2: null,
  lat: 1,
  lon: 2,
  airport: null,
  smart_months: [1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0],
  data: {
    why: 'sv varför',
    best_text: 'sv bäst',
    month_notes: months('sv'),
    day_budget_sek: 900,
    prices: { currency: 'EUR', level: 3, checked: '2026-01-01', summary: 'sv nivå', rows: [{ key: 'kaffe', typical: 3, note: 'sv not' }], sources: ['https://x'] },
    alternatives: [
      { place: 'XX-a', why: 'sv alt a', cheaper: true },
      { place: 'XX-b', why: 'sv alt b', cheaper: true },
    ],
  },
  ...over,
});

describe('mergeText och contentText', () => {
  it('faller tillbaka på svenskan fält för fält', () => {
    const row = { title: 'sv titel', summary: 'sv kort', body: 'sv lång', en: { title: 'en title', body: ' ' } };
    expect(contentText(row, 'title', 'en')).toBe('en title');
    expect(contentText(row, 'summary', 'en')).toBe('sv kort');
    // En tom text räknas som saknad.
    expect(contentText(row, 'body', 'en')).toBe('sv lång');
    // På svenska används aldrig engelskan.
    expect(contentText(row, 'title', 'sv')).toBe('sv titel');
  });

  it('klarar rader utan en och fält som bara finns på engelska', () => {
    expect(contentText({ name: 'sv', en: null }, 'name', 'en')).toBe('sv');
    expect(contentText({ name: 'sv' } as { name: string } & Translatable, 'name', 'en')).toBe('sv');
    expect(mergeText({ a: 'sv' }, { a: 'en', b: 'bara en' }, { a: 'text', b: 'text' })).toEqual({ a: 'en' });
    // Siffror, id:n, nycklar och källor kommer alltid från svenskan, även om de skulle stå på engelska.
    const p = localize(
      place({ id: 'XX-a', en: { id: 'x', lat: 9, data: { day_budget_sek: 1, prices: { currency: 'USD', rows: [{ key: 'ol', typical: 9 }] } } } as Place['en'] }),
      'en',
    );
    expect(p.id).toBe('XX-a');
    expect(p.lat).toBe(1);
    expect(p.data.day_budget_sek).toBe(900);
    expect(p.data.prices).toMatchObject({ currency: 'EUR', rows: [{ key: 'kaffe', typical: 3 }] });
  });

  it('listor i data: månad 3 på engelska, månad 4 saknas', () => {
    const en = { data: { month_notes: [null, null, 'en3', null, null, null, null, null, null, null, null, null] } };
    const p = localize(place({ en }), 'en');
    expect(p.data.month_notes?.[2]).toBe('en3');
    expect(p.data.month_notes?.[3]).toBe('sv4');
    expect(p.data.month_notes).toHaveLength(12);
    // En för kort lista på engelska går inte sönder: resten är svenska.
    const short = localize(place({ en: { data: { month_notes: ['en1'] } } }), 'en');
    expect(short.data.month_notes).toEqual(['en1', ...months('sv').slice(1)]);
    // Priser: texterna byts, beloppen och nycklarna ligger kvar.
    const pr = localize(place({ en: { data: { prices: { summary: 'en level', rows: [{}] } } } }), 'en');
    expect(pr.data.prices).toMatchObject({ summary: 'en level', level: 3, rows: [{ key: 'kaffe', typical: 3, note: 'sv not' }] });
  });

  it('en plats med engelska från både _upptack.json och landsfilen', () => {
    // Så som importen lägger ihop dem (scripts/lib/en.mjs, englishRows).
    const en = { name: 'en city', data: { best_text: 'en best', why: 'en why', alternatives: [{}, { why: 'en alt b' }] } };
    const p = localize(place({ en }), 'en');
    expect(p.name).toBe('en city');
    expect(p.data.best_text).toBe('en best');
    expect(p.data.why).toBe('en why');
    expect(p.data.alternatives).toEqual([
      { place: 'XX-a', why: 'sv alt a', cheaper: true },
      { place: 'XX-b', why: 'en alt b', cheaper: true },
    ]);
    expect(p.data.day_budget_sek).toBe(900);
    expect(swedish(p, 'name')).toBe('sv stad');
    // Samma rad ger samma objekt, och svenska ger raden som den är.
    expect(localize(p, 'en')).toBe(localize(p, 'en'));
    const rows = [place({ en })];
    expect(localizeAll(rows, 'en')).toBe(localizeAll(rows, 'en'));
    expect(localizeAll(rows, 'sv')).toBe(rows);
  });
});

describe('sök på båda språken', () => {
  const places = [place({ id: 'XX-lis', name: 'sv Lissabon', en: { name: 'en Lisbon' } }), place({ id: 'XX-por', name: 'sv Porto', en: null })];

  it('hittar platsen på svenska och engelska oavsett valt språk', () => {
    for (const lang of ['sv', 'en'] as const) {
      const options = placeOptions(localizeAll(places, lang), ['XX-lis', 'XX-por']);
      const ids = (q: string) => search(options, q, (o) => o.names ?? o.name).map((o) => o.id);
      expect(ids('lisb')).toEqual(['XX-lis']);
      expect(ids('lissa')).toEqual(['XX-lis']);
      expect(ids('porto')).toEqual(['XX-por']);
    }
  });

  it('namnet på valt språk står först', () => {
    expect(namesOf(localize(places[0], 'en'))).toEqual(['en Lisbon', 'sv Lissabon']);
    expect(namesOf(places[0])).toEqual(['sv Lissabon', 'en Lisbon']);
  });
});

describe('ny resa på engelska', () => {
  const en = {
    groups: { [PACK_SUGGESTIONS[0].group]: 'en group' },
    items: { [PACK_SUGGESTIONS[0].id]: { title: 'en item' } },
  };

  it('packlistans förslag får engelsk titel, och svenskan där engelskan saknas', () => {
    const list = packSuggestions('en', en);
    expect(list[0].title).toBe('en item');
    expect(list[0].alt).toBe(PACK_SUGGESTIONS[0].title);
    if (list.length > 1) expect(list[1].title).toBe(PACK_SUGGESTIONS[1].title);
    // Månader och nätter kommer från svenskan.
    expect(list.map((s) => s.months)).toEqual(PACK_SUGGESTIONS.map((s) => s.months));
    // En sak som redan står på listan på svenska föreslås inte igen på engelska.
    expect(packFor(list, null, null, [PACK_SUGGESTIONS[0].title]).some((s) => s.id === PACK_SUGGESTIONS[0].id)).toBe(false);
    // På svenska är allt som förut.
    expect(packSuggestions('sv', en).map((s) => s.title)).toEqual(PACK_SUGGESTIONS.map((s) => s.title));
  });

  it('gruppnamnen översätts bara för grupperna i mallen', () => {
    expect(packGroupName(PACK_SUGGESTIONS[0].group, 'en', en)).toBe('en group');
    expect(packGroupName(PACK_SUGGESTIONS[0].group, 'sv', en)).toBe(PACK_SUGGESTIONS[0].group);
    expect(packGroupName('Egen grupp', 'en', en)).toBe('Egen grupp');
  });

  it('Innan avresa: engelsk titel och tips, dagen hittas på båda språken', () => {
    const s = PRETRIP_SUGGESTIONS[0];
    const list = pretripSuggestions('en', { items: { [s.id]: { title: 'en task' } } });
    expect(list[0]).toMatchObject({ id: s.id, title: 'en task', days_before: s.days_before, alt: s.title });
    expect(list[0].hint).toBe(s.hint);
    expect(daysBeforeFor(list, 'en task')).toBe(s.days_before);
    expect(daysBeforeFor(list, s.title)).toBe(s.days_before);
    expect(pretripMissing(list, [s.title]).some((x) => x.id === s.id)).toBe(false);
  });

  it('filerna i content/en/ läses in vid bygget', () => {
    expect(packSuggestions('en').some((x, i) => x.title !== PACK_SUGGESTIONS[i].title)).toBe(true);
    expect(pretripSuggestions('en').some((x, i) => x.title !== PRETRIP_SUGGESTIONS[i].title)).toBe(true);
  });
});

describe('bucketlistan på engelska', () => {
  it('delmål bockas av med den svenska titeln och visas på engelska', () => {
    const ctx = { places: [], statuses: {}, name: (id: string) => id };
    const v = bucketParts({ type: 'delar', items: ['sv A', 'sv B'] }, [{ title: 'sv B', done: true, done_at: null }], ctx, ['en A', 'en B']);
    expect(v?.kind === 'rader' && v.rows.map((r) => [r.title, r.key, r.done])).toEqual([
      ['en A', 'sv A', false],
      ['en B', 'sv B', true],
    ]);
  });

  it('punkter ur katalogen visar katalogens namn på valt språk', () => {
    const catalog = new Map([['b1', { name: 'en name' }]]);
    expect(bucketTitle({ title: 'sv sparad', catalog_id: 'b1' }, catalog)).toBe('en name');
    expect(bucketTitle({ title: 'egen', catalog_id: null }, catalog)).toBe('egen');
    expect(bucketTitle({ title: 'sv sparad', catalog_id: 'saknas' }, catalog)).toBe('sv sparad');
  });
});
