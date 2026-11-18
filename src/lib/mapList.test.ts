import { describe, expect, it } from 'vitest';
import { childrenKey, countKey, groupPlaces } from './mapList';
import type { MapKey } from './togetherLogic';

const NAMES: Record<string, string> = {
  SE: 'Sverige',
  NO: 'Norge',
  DK: 'Danmark',
  JP: 'Japan',
  TH: 'Thailand',
  'SE-stockholm': 'Stockholm',
  'SE-goteborg': 'Göteborg',
  'SE-vastergotland': 'Västergötland',
  'NO-oslo': 'Oslo',
  'JP-tokyo': 'Tokyo',
};
const CONT: Record<string, string> = { EU: 'Europa', AS: 'Asien', AF: 'Afrika' };
const group = (keys: Record<string, MapKey>, hidden: Parameters<typeof groupPlaces>[1] = []) =>
  groupPlaces(keys, hidden, (id) => NAMES[id] ?? id, (c) => CONT[c] ?? c, 'sv-SE');

describe('listan Platser', () => {
  const keys: Record<string, MapKey> = {
    SE: 'bor',
    NO: 'besokt',
    DK: 'vill',
    JP: 'planerad',
    TH: 'besokt',
    'SE-stockholm': 'besokt',
    'SE-goteborg': 'bor',
    'NO-oslo': 'vill',
  };

  it('grupperas per världsdel i bokstavsordning, med länderna i bokstavsordning', () => {
    const g = group(keys);
    expect(g.map((x) => x.name)).toEqual(['Asien', 'Europa']);
    expect(g[1].countries.map((c) => c.name)).toEqual(['Danmark', 'Norge', 'Sverige']);
    expect(g[0].countries.map((c) => [c.name, c.key])).toEqual([
      ['Japan', 'planerad'],
      ['Thailand', 'besokt'],
    ]);
  });

  it('städerna ligger under sitt land, i bokstavsordning och med sin status', () => {
    const se = group(keys)[1].countries.find((c) => c.id === 'SE')!;
    expect(se.key).toBe('bor');
    expect(se.children).toEqual([
      { id: 'SE-goteborg', name: 'Göteborg', key: 'bor' },
      { id: 'SE-stockholm', name: 'Stockholm', key: 'besokt' },
    ]);
    expect(group(keys)[1].countries.find((c) => c.id === 'DK')!.children).toEqual([]);
  });

  it('ett land utan egen status visas när det har markerade städer', () => {
    const g = group({ 'JP-tokyo': 'vill', 'SE-vastergotland': 'besokt' });
    const jp = g.find((x) => x.code === 'AS')!.countries[0];
    expect(jp).toMatchObject({ id: 'JP', key: null });
    expect(jp.children.map((c) => c.id)).toEqual(['JP-tokyo']);
    expect(g.find((x) => x.code === 'EU')!.countries[0].children.map((c) => c.name)).toEqual(['Västergötland']);
  });

  it('släckta statusar döljs, både länder och städer', () => {
    const g = group(keys, ['besokt']);
    const eu = g.find((x) => x.code === 'EU')!;
    expect(eu.countries.map((c) => [c.id, c.key])).toEqual([
      ['DK', 'vill'],
      ['NO', null],
      ['SE', 'bor'],
    ]);
    expect(eu.countries.find((c) => c.id === 'SE')!.children.map((c) => c.id)).toEqual(['SE-goteborg']);
    expect(g.find((x) => x.code === 'AS')!.countries.map((c) => c.id)).toEqual(['JP']);
  });

  it('allt släckt ger en tom lista', () => {
    expect(group(keys, ['bor', 'besokt', 'vill', 'planerad'])).toEqual([]);
    expect(group({})).toEqual([]);
  });

  it('länder utan känd världsdel tas inte med', () => {
    expect(group({ ZZ: 'besokt' })).toEqual([]);
  });

  it('ett eller flera i texterna', () => {
    expect(countKey(1, 'en', 'flera')).toBe('en');
    expect(countKey(0, 'en', 'flera')).toBe('flera');
    expect(countKey(3, 'en', 'flera')).toBe('flera');
  });

  it('städer bara när allt under landet är städer, annars platser (Körning 17)', () => {
    const KIND: Record<string, string> = { 'SE-stockholm': 'city', 'SE-goteborg': 'city', 'SE-vastergotland': 'region', 'NO-oslo': 'city' };
    const run = (k: Record<string, MapKey>) =>
      groupPlaces(k, [], (id) => NAMES[id] ?? id, (c) => CONT[c] ?? c, 'sv-SE', (id) => KIND[id]).find((x) => x.code === 'EU')!.countries;
    const cities = run({ 'SE-stockholm': 'besokt', 'SE-goteborg': 'bor' })[0];
    expect(cities.allCities).toBe(true);
    expect(childrenKey(cities)).toBe('karta.lista.stader');
    const mixed = run({ 'SE-stockholm': 'besokt', 'SE-vastergotland': 'vill' })[0];
    expect(mixed.allCities).toBe(false);
    expect(childrenKey(mixed)).toBe('karta.lista.platser');
    expect(childrenKey(run({ 'SE-vastergotland': 'vill' })[0])).toBe('karta.lista.platser.en');
    expect(childrenKey(run({ 'NO-oslo': 'vill' })[0])).toBe('karta.lista.stader.en');
    // Okänd typ räknas inte som stad.
    expect(childrenKey(run({ 'SE-okand': 'vill' })[0])).toBe('karta.lista.platser.en');
  });
});
