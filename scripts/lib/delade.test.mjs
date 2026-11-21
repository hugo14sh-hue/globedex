// Fältet delade i content/_landlistor.json: valideringen (npm run import:check) och raderna som importen skriver.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitRows, validateSplitPlaces } from './delade.mjs';
import { validateCountryLists } from './validate-content.mjs';

// Påhittade koder: AA, BB, CC är appens länder och AA delas. Namnen är platshållare för valideringen.
const fn = Array.from({ length: 193 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);
const app = [...fn, 'ZY', 'ZZ'];
const texts = { sv: { 'land.AA-a': 'x', 'land.AA-b': { neutral: 'y' } }, en: { 'land.AA-a': 'x', 'land.AA-b': 'y' } };
const msg = (delade, t = texts) =>
  validateCountryLists('_landlistor.json', { fn, fn_observatorer: ['ZY', 'ZZ'], delade }, app, t).map((e) => `${e.id} ${e.field}: ${e.message}`);

describe('delade: valideringen', () => {
  it('godkänner ett land bland appens länder med delar som har namn på båda språken', () => {
    expect(msg({ AA: ['AA-a', 'AA-b'] })).toEqual([]);
  });

  it('landet ska finnas bland appens länder', () => {
    expect(msg({ QQ: ['QQ-a'] }, null)).toEqual(['QQ delade: landet finns inte bland appens länder (src/lib/countries.ts)']);
    expect(msg({ gb: ['gb-a'] }, null)[0]).toBe('gb delade: landet finns inte bland appens länder (src/lib/countries.ts)');
  });

  it('delarnas id börjar med landets kod och finns en gång', () => {
    expect(msg({ AA: ['BB-a', 'AA', 'AA-A', 'AA-b', 'AA-b'] }, null)).toEqual([
      'BB-a delade: delens id ska börja med AA- följt av små bokstäver eller siffror',
      'AA delade: delens id ska börja med AA- följt av små bokstäver eller siffror',
      'AA-A delade: delens id ska börja med AA- följt av små bokstäver eller siffror',
      'AA-b delade: finns två gånger',
    ]);
  });

  it('namnen under land.<id> på båda språken', () => {
    expect(msg({ AA: ['AA-a', 'AA-c'] })).toEqual([
      'AA-c delade: namn saknas under land.AA-c i _texter.json',
      'AA-c delade: namn saknas under land.AA-c i _texter.en.json',
    ]);
    expect(msg({ AA: ['AA-a'] }, { sv: { 'land.AA-a': 'x' }, en: { 'land.AA-a': ' ' } })).toEqual([
      'AA-a delade: namn saknas under land.AA-a i _texter.en.json',
    ]);
  });

  it('formen: ett objekt med listor', () => {
    expect(msg(['AA'])).toEqual(['- delade: objekt med landskod och lista med delar krävs']);
    expect(msg({ AA: [] })).toEqual(['AA delade: lista med minst en del krävs']);
    expect(msg({ AA: 'AA-a' })).toEqual(['AA delade: lista med minst en del krävs']);
  });

  it('filen i content/ går igenom med appens texter', () => {
    const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'content', f), 'utf8').replace(/^﻿/, ''));
    const lists = read('_landlistor.json');
    const countries = readFileSync(join(process.cwd(), 'src/lib/countries.ts'), 'utf8').match(/\['([A-Z]{2})'/g).map((m) => m.slice(2, 4));
    const t = { sv: read('_texter.json').texter, en: read('_texter.en.json').texter };
    expect(validateCountryLists('_landlistor.json', lists, countries, t)).toEqual([]);
  });
});

describe('delade: raderna i importen', () => {
  const coords = { AA: [1, 2] };
  const partCoords = { 'AA-a': [3, 4], 'AA-b': [5, 6] };
  const rows = (existing) =>
    splitRows({ AA: ['AA-a', 'AA-b'] }, existing, texts.sv, (iso) => `namn ${iso}`, (iso) => coords[iso] ?? null, (id) => partCoords[id] ?? null);

  it('delarna blir länder med landet som förälder, som länderna utan landsfil', () => {
    const r = rows(['AA']);
    expect(r).toEqual([
      { id: 'AA-a', kind: 'country', parent_id: 'AA', name: 'x', iso2: null, lat: 3, lon: 4, layer: null, airport: null, smart_months: null, data: { light: true } },
      { id: 'AA-b', kind: 'country', parent_id: 'AA', name: 'y', iso2: null, lat: 5, lon: 6, layer: null, airport: null, smart_months: null, data: { light: true } },
    ]);
  });

  it('saknas landet bland platserna läggs det till först, som ett land utan landsfil', () => {
    const r = rows([]);
    expect(r.map((x) => [x.id, x.parent_id])).toEqual([
      ['AA', null],
      ['AA-a', 'AA'],
      ['AA-b', 'AA'],
    ]);
    expect(r[0]).toMatchObject({ kind: 'country', name: 'namn AA', iso2: 'AA', lat: 1, lon: 2, data: { light: true } });
  });
});

describe('delade: platserna i ett delat land (Körning 21)', () => {
  const split = { AA: ['AA-a', 'AA-b'] };

  it('godkänner platser vars id börjar med en dels id och bindestreck, och räknar dem per del', () => {
    const r = validateSplitPlaces(split, [
      { id: 'AA', file: 'AA.json' },
      { id: 'AA-a-stad', file: 'AA.json' },
      { id: 'AA-a-stad-park', file: 'AA.json' },
      { id: 'BB-stad', file: 'BB.json' },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.perPart).toEqual({ 'AA-a': 2, 'AA-b': 0 });
  });

  it('en plats utan delens id ger fel med platsens id och vilka delar som finns', () => {
    const r = validateSplitPlaces(split, [
      { id: 'AA-stad', file: 'AA.json' },
      { id: 'AA-ab-stad', file: '_upptack.json' },
    ]);
    expect(r.errors).toEqual([
      { file: 'AA.json', id: 'AA-stad', field: 'id', message: 'AA är ett delat land: id ska börja med en av delarnas id och bindestreck (AA-a-, AA-b-)' },
      { file: '_upptack.json', id: 'AA-ab-stad', field: 'id', message: 'AA är ett delat land: id ska börja med en av delarnas id och bindestreck (AA-a-, AA-b-)' },
    ]);
  });

  it('de riktiga filerna: London hör till England', () => {
    const root = join(process.cwd(), 'content');
    const read = (n) => JSON.parse(readFileSync(join(root, n), 'utf8').replace(/^﻿/, ''));
    const gb = read('GB.json');
    const r = validateSplitPlaces(read('_landlistor.json').delade, gb.places.map((p) => ({ id: p.id, file: 'GB.json' })));
    expect(r.errors).toEqual([]);
    expect(r.perPart['GB-eng']).toBeGreaterThanOrEqual(1);
  });
});
