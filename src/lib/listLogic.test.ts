import { describe, expect, it } from 'vitest';
import type { BucketCatalogItem } from './content';
import {
  bucketPlaces,
  buildDeck,
  commonYes,
  countByCategory,
  filterCatalog,
  isMatch,
  motifsFor,
  onList,
  percent,
  sortBucket,
  waitingFor,
  type Votes,
} from './listLogic';

const cat = (id: string, category: string, cost_level: BucketCatalogItem['cost_level'], place_ids: string[] = []): BucketCatalogItem => ({
  id,
  name: id,
  category,
  cost_level,
  season: null,
  where_text: null,
  place_ids,
});

describe('samlingsbok', () => {
  it('räknar hittade per kategori', () => {
    const items = [
      { id: 'a', category: 'mat' },
      { id: 'b', category: 'mat' },
      { id: 'c', category: 'fagel' },
    ];
    expect(countByCategory(items, (id) => id === 'b')).toEqual([
      { category: 'mat', found: 1, total: 2 },
      { category: 'fagel', found: 0, total: 1 },
    ]);
  });

  it('räknar procent med en synlig strimma', () => {
    expect(percent(0, 10)).toBe(0);
    expect(percent(1, 1000)).toBe(2);
    expect(percent(5, 10)).toBe(50);
    expect(percent(3, 0)).toBe(0);
  });
});

describe('bucketlist', () => {
  const list = [cat('a', 'natur', 'gratis'), cat('b', 'natur', 'dyrt'), cat('c', 'mat', 'gratis'), cat('d', 'mat', null)];

  it('filtrerar katalogen på kategori och kostnad', () => {
    expect(filterCatalog(list, null, null)).toHaveLength(4);
    expect(filterCatalog(list, 'natur', null).map((b) => b.id)).toEqual(['a', 'b']);
    expect(filterCatalog(list, null, 'gratis').map((b) => b.id)).toEqual(['a', 'c']);
    expect(filterCatalog(list, 'mat', 'gratis').map((b) => b.id)).toEqual(['c']);
    expect(filterCatalog(list, 'mat', 'dyrt')).toEqual([]);
  });

  it('vet om en katalogpunkt redan finns på listan', () => {
    expect(onList([{ catalog_id: 'a' }, { catalog_id: null }], 'a')).toBe(true);
    expect(onList([{ catalog_id: null }], 'a')).toBe(false);
  });

  it('sorterar ogjorda först och senast gjorda överst bland de gjorda', () => {
    const rows = [
      { id: 1, done_on: '2026-01-01', created_at: '2025-01-01' },
      { id: 2, done_on: null, created_at: '2025-03-01' },
      { id: 3, done_on: '2026-05-01', created_at: '2025-01-01' },
      { id: 4, done_on: null, created_at: '2025-02-01' },
    ];
    expect(sortBucket(rows).map((r) => r.id)).toEqual([4, 2, 3, 1]);
  });

  it('samlar platser från punkten och katalogen, även när katalogen saknar platser', () => {
    expect(bucketPlaces({ place_id: 'SE' }, { place_ids: ['TR', 'SE'] })).toEqual(['SE', 'TR']);
    expect(bucketPlaces({ place_id: null }, { place_ids: [] })).toEqual([]);
    expect(bucketPlaces({}, undefined)).toEqual([]);
  });
});

describe('swipe', () => {
  const items = [
    { kind: 'item' as const, id: 'i1' },
    { kind: 'item' as const, id: 'i2' },
    { kind: 'item' as const, id: 'i3' },
  ];
  const bucket = [{ kind: 'bucket' as const, id: 'b1' }];
  const ideas = [
    { kind: 'idea' as const, id: 'd1' },
    { kind: 'idea' as const, id: 'd2' },
  ];

  it('blandar källorna och hoppar över kort man redan röstat på', () => {
    expect(buildDeck([items, bucket, ideas], {}).map((c) => c.id)).toEqual(['i1', 'b1', 'd1', 'i2', 'd2', 'i3']);
    expect(buildDeck([items, bucket, ideas], { i1: true, b1: false }).map((c) => c.id)).toEqual(['i2', 'd1', 'i3', 'd2']);
    expect(buildDeck([[], []], {})).toEqual([]);
  });

  const votes: Votes = {
    jag: { a: true, b: true, c: true, d: false },
    hon: { a: true, b: false, d: true },
  };
  const members = ['jag', 'hon'];

  it('matchar bara när alla sagt ja', () => {
    expect(isMatch('a', votes, members)).toBe(true);
    expect(isMatch('b', votes, members)).toBe(false);
    expect(isMatch('c', votes, members)).toBe(false);
    expect(isMatch('a', votes, [])).toBe(false);
    expect(isMatch('c', votes, ['jag'])).toBe(true);
    expect(commonYes(votes, members)).toEqual(['a']);
    expect(commonYes(votes, ['jag'])).toEqual(['a', 'b', 'c']);
  });

  it('väntar bara på dem som inte röstat, och aldrig efter ett nej', () => {
    expect(waitingFor('c', votes, members, 'jag')).toEqual(['hon']);
    expect(waitingFor('b', votes, members, 'jag')).toEqual([]);
    expect(waitingFor('a', votes, members, 'jag')).toEqual([]);
    expect(waitingFor('d', votes, members, 'jag')).toEqual([]);
    expect(waitingFor('c', votes, [...members, 'tredje'], 'jag')).toEqual(['hon', 'tredje']);
  });
});

describe('samlingar', () => {
  it('hittar motiv för samlingens namn oavsett stora och små bokstäver', () => {
    const gifts: { name: string; collection_motifs: Record<string, string> }[] = [
      { name: 'Delft', collection_motifs: { Kaffemuggar: 'Blå mugg', Shotglas: 'Tulpan' } },
      { name: 'Ost', collection_motifs: {} },
      { name: 'Magnet', collection_motifs: { ' kaffemuggar ': 'Kvarnmugg' } },
    ];
    expect(motifsFor(gifts, 'kaffemuggar')).toEqual([
      { gift: 'Delft', text: 'Blå mugg' },
      { gift: 'Magnet', text: 'Kvarnmugg' },
    ]);
    expect(motifsFor(gifts, 'Kepsar')).toEqual([]);
  });
});
