import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyPatches, discoverRows, ruleLevel, validateDiscover } from './upptack.mjs';

// Testdata med påhittade id:n och platshållartext. Bara för valideringen.
const APP = ['XX', 'YY', 'ZZ'];
const CONTENT = [
  { id: 'XX', kind: 'country' },
  { id: 'XX-dyr', kind: 'city', data: { prices: { level: 5 } } },
  { id: 'XX-utan-pris', kind: 'city', data: {} },
];
const place = (p = {}) => ({
  id: 'YY-a',
  name: 'A',
  country: 'YY',
  lat: 1,
  lon: 2,
  level: 2,
  level_rule: 2,
  climate: 'kust',
  best_months: [5, 6],
  tags: ['mat'],
  gem: false,
  why: 'w',
  ...p,
});
const file = (f = {}) => ({
  _om: { own_judgment: ['tags', 'why'] },
  tags: ['mat', 'strand'],
  climates: ['kust', 'alpint'],
  pli_year: 2025,
  pli_restaurants_hotels: { YY: 70 },
  existing: { 'XX-dyr': { climate: 'kust', tags: ['strand'] } },
  places: [place()],
  alternatives: [{ for: 'XX-dyr', place: 'YY-a', why: 'w', cheaper: true }],
  ...f,
});
const errs = (json) => validateDiscover(json, APP, CONTENT).map((e) => `${e.id}/${e.field}`);

describe('validering av _upptack.json', () => {
  it('godkänner en korrekt fil', () => {
    expect(validateDiscover(file(), APP, CONTENT)).toEqual([]);
  });

  it('id-formatet och landskoden', () => {
    expect(errs(file({ places: [place({ id: 'YY_a' })] }))).toContain('YY_a/id');
    expect(errs(file({ places: [place({ id: 'yy-a' })] }))).toContain('yy-a/id');
    expect(errs(file({ places: [place({ id: 'ZZ-a' })] }))).toContain('ZZ-a/id');
    expect(errs(file({ places: [place(), place()] }))).toContain('YY-a/id');
    // Får inte krocka med en plats i landsfilerna.
    expect(errs(file({ places: [place({ id: 'XX-dyr', country: 'XX' })], alternatives: [] }))).toContain('XX-dyr/id');
  });

  it('landet ska finnas bland appens länder', () => {
    expect(errs(file({ places: [place({ id: 'QQ-a', country: 'QQ' })], alternatives: [] }))).toContain('QQ-a/country');
  });

  it('level är 1 till 5, och level_note bara när level avviker från regeln', () => {
    expect(errs(file({ places: [place({ level: 0 })] }))).toContain('YY-a/level');
    expect(errs(file({ places: [place({ level: 6 })] }))).toContain('YY-a/level');
    expect(errs(file({ places: [place({ level: 2.5 })] }))).toContain('YY-a/level');
    expect(errs(file({ places: [place({ level: 3 })] }))).toContain('YY-a/level_note');
    expect(errs(file({ places: [place({ level_note: 'x' })] }))).toContain('YY-a/level_note');
    expect(errs(file({ places: [place({ level: 1, level_note: 'x' })] }))).toEqual([]);
  });

  it('taggar och klimat ska finnas i listorna', () => {
    expect(errs(file({ places: [place({ tags: ['okand'] })] }))).toContain('YY-a/tags');
    expect(errs(file({ places: [place({ tags: [] })] }))).toContain('YY-a/tags');
    expect(errs(file({ places: [place({ climate: 'tropiskt' })] }))).toContain('YY-a/climate');
    expect(errs(file({ existing: { 'XX-dyr': { climate: 'tropiskt', tags: ['okand'] } } }))).toEqual(['XX-dyr/climate', 'XX-dyr/tags']);
  });

  it('månaderna är 1 till 12', () => {
    for (const m of [[0], [13], [5, 5], [], [1.5]]) expect(errs(file({ places: [place({ best_months: m })] }))).toContain('YY-a/best_months');
    expect(errs(file({ places: [place({ best_months: [1, 12] })] }))).toEqual([]);
  });

  it('befintliga platser får why, med samma regel som places (en mening)', () => {
    expect(errs(file({ existing: { 'XX-dyr': { climate: 'kust', tags: ['strand'], why: 'En mening.' } } }))).toEqual([]);
    for (const why of ['', '  ', 3, null]) expect(errs(file({ existing: { 'XX-dyr': { climate: 'kust', tags: ['strand'], why } } }))).toContain('XX-dyr/why');
  });

  it('befintliga platser ska finnas i landsfilerna', () => {
    expect(errs(file({ existing: { 'XX-saknas': { climate: 'kust', tags: ['mat'] } } }))).toContain('XX-saknas/existing');
  });

  it('for och place i alternativen ska finnas bland places eller befintliga platser', () => {
    expect(errs(file({ alternatives: [{ for: 'XX-saknas', place: 'YY-a', why: 'w', cheaper: true }] }))).toContain('XX-saknas > YY-a/for');
    expect(errs(file({ alternatives: [{ for: 'XX-dyr', place: 'YY-saknas', why: 'w', cheaper: true }] }))).toContain('XX-dyr > YY-saknas/place');
  });

  it('ett alternativ har aldrig högre prisnivå än platsen det hör till', () => {
    const json = file({
      places: [place(), place({ id: 'YY-b', level: 3, level_rule: 3 })],
      alternatives: [{ for: 'YY-a', place: 'YY-b', why: 'w', cheaper: false }],
    });
    expect(errs(json)).toContain('YY-a > YY-b/place');
    // Samma nivå går bra, men då är det inte billigare.
    const same = file({ places: [place(), place({ id: 'YY-b' })], alternatives: [{ for: 'YY-a', place: 'YY-b', why: 'w', cheaper: false }] });
    expect(errs(same)).toEqual([]);
    expect(errs(file({ places: [place(), place({ id: 'YY-b' })], alternatives: [{ for: 'YY-a', place: 'YY-b', why: 'w', cheaper: true }] }))).toContain(
      'YY-a > YY-b/cheaper',
    );
    // En befintlig stad utan prisnivå går inte att jämföra.
    expect(errs(file({ alternatives: [{ for: 'XX-utan-pris', place: 'YY-a', why: 'w', cheaper: true }] }))).toContain('XX-utan-pris > YY-a/for');
  });

  it('regeln för Eurostat: under 65 = 1, 65-89 = 2, 90-114 = 3, 115-149 = 4, 150 och över = 5', () => {
    expect([64, 65, 89, 90, 114, 115, 149, 150].map((v) => ruleLevel(v))).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it('regeln för Världsbanken (basis icp): under 68 = 1, 68-111 = 2, 112-134 = 3, 135-169 = 4, 170 och över = 5', () => {
    expect([67.9, 68, 111, 111.6, 112, 134.9, 135, 169.9, 170].map((v) => ruleLevel(v, 'icp'))).toEqual([1, 2, 2, 2, 3, 3, 4, 4, 5]);
  });

  it('level_rule kontrolleras mot rätt regel', () => {
    // 66 ger 2 enligt Eurostat men 1 enligt Världsbanken.
    const world = { pli_world: { YY: 66 }, pli_world_year: 2021 };
    expect(errs(file({ pli_restaurants_hotels: { YY: 66 } }))).toEqual([]);
    expect(errs(file({ ...world, places: [place({ basis: 'icp' })] }))).toContain('YY-a/level_rule');
    expect(errs(file({ ...world, places: [place({ basis: 'icp', level: 1, level_rule: 1 })] }))).toEqual([]);
    expect(errs(file({ places: [place({ level_rule: 3, level_note: 'n' })] }))).toContain('YY-a/level_rule');
  });

  it('en plats med basis icp har sitt land i pli_world, en utan basis i pli_restaurants_hotels', () => {
    expect(errs(file({ pli_world: { ZZ: 80 }, pli_world_year: 2021, places: [place({ basis: 'icp' })] }))).toContain('YY-a/country');
    expect(errs(file({ pli_restaurants_hotels: { ZZ: 70 } }))).toContain('YY-a/country');
    expect(errs(file({ places: [place({ basis: 'eurostat' })] }))).toContain('YY-a/basis');
  });

  it('pli_world och pli_world_year krävs när en plats har basis icp', () => {
    const e = errs(file({ places: [place({ basis: 'icp' })] }));
    expect(e).toContain('-/pli_world');
    expect(e).toContain('-/pli_world_year');
    expect(errs(file({ pli_world: { QQ: 80 }, pli_world_year: 2021 }))).toContain('QQ/pli_world');
  });

  it('okända fält stoppas', () => {
    expect(errs(file({ extra: 1 }))).toContain('-/extra');
    expect(errs(file({ places: [place({ price: 1 })] }))).toContain('YY-a/price');
  });

  it('den riktiga filen går igenom mot landsfilerna', () => {
    const dir = join(process.cwd(), 'content');
    const read = (n) => JSON.parse(readFileSync(join(dir, n), 'utf8').replace(/^﻿/, ''));
    const json = read('_upptack.json');
    // Alla landsfiler i content/, så att nya länder kommer med utan att testet ändras.
    const countries = readdirSync(dir).filter((n) => /^[A-Z]{2}\.json$/.test(n)).map((n) => n.slice(0, 2));
    const content = countries.flatMap((c) => read(`${c}.json`).places);
    const app = [...new Set([...Object.keys(json.pli_restaurants_hotels), ...json.places.map((p) => p.country), ...content.map((p) => p.id.slice(0, 2))])];
    expect(validateDiscover(json, app, content)).toEqual([]);
  });
});

describe('raderna som importen skriver', () => {
  const rows = discoverRows(file(), CONTENT, (iso) => `namn ${iso}`, () => [10, 20]);

  it('lätta platser blir städer under sitt land med data.light', () => {
    expect(rows.cities).toHaveLength(1);
    const c = rows.cities[0];
    expect(c).toMatchObject({ id: 'YY-a', kind: 'city', parent_id: 'YY', name: 'A', lat: 1, lon: 2 });
    expect(c.data).toMatchObject({ light: true, level: 2, climate: 'kust', best_months: [5, 6], tags: ['mat'], gem: false, why: 'w', pli: 70, pli_year: 2025 });
    expect(c.data.own_judgment).toEqual(['tags', 'why']);
  });

  it('länder utan landsfil läggs till som lätta länder, så att parent_id finns', () => {
    expect(rows.countries).toEqual([
      { id: 'YY', kind: 'country', parent_id: null, name: 'namn YY', iso2: 'YY', lat: 10, lon: 20, layer: null, airport: null, smart_months: null, data: { light: true } },
    ]);
  });

  it('befintliga platser får klimat, taggar och alternativ i data, och resten av data ligger kvar', () => {
    const out = applyPatches([{ id: 'XX-dyr', data: { prices: { level: 5 } } }, { id: 'XX', data: {} }], rows.patches);
    expect(out[0].data).toEqual({
      prices: { level: 5 },
      climate: 'kust',
      tags: ['strand'],
      alternatives: [{ place: 'YY-a', why: 'w', cheaper: true }],
    });
    expect(out[1].data).toEqual({});
  });

  it('en plats med basis icp får Världsbankens index och år i data, och data.basis', () => {
    const r = discoverRows(
      file({ pli_world: { YY: 66.5 }, pli_world_year: 2021, places: [place({ basis: 'icp', level: 1, level_rule: 1 })] }),
      CONTENT,
      (iso) => iso,
      () => [0, 0],
    );
    expect(r.cities[0].data).toMatchObject({ basis: 'icp', pli: 66.5, pli_year: 2021 });
    expect(rows.cities[0].data.basis).toBeUndefined();
  });

  it('why på en befintlig plats hamnar i data.why', () => {
    const r = discoverRows(file({ existing: { 'XX-dyr': { climate: 'kust', tags: ['strand'], why: 'En mening.' } } }), CONTENT, (iso) => iso, () => [0, 0]);
    expect(applyPatches([{ id: 'XX-dyr', data: {} }], r.patches)[0].data.why).toBe('En mening.');
  });
});
