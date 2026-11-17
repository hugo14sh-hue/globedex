import { describe, expect, it } from 'vitest';
import sv from '../../content/_texter.json';
import en from '../../content/_texter.en.json';
import { CONTINENT_OF } from './continents';
import { continentKey, continentLabel, M49 } from './continentNames';
import { text } from './texter';

describe('världsdelarnas namn', () => {
  it('varje kod som appen använder har en text på svenska och engelska', () => {
    const used = new Set(Object.values(CONTINENT_OF));
    for (const c of used) {
      const k = continentKey(c)!;
      expect(k, c).toMatch(/^kontinent\.\d{3}$/);
      expect((sv.texter as Record<string, unknown>)[k], k).toBeTruthy();
      expect((en.texter as Record<string, unknown>)[k], k).toBeTruthy();
    }
    expect(Object.keys(M49).sort()).toEqual([...used].sort());
  });

  it('visar namn, aldrig koden', () => {
    const t = (k: string) => text(k, 'neutral', {}, 'sv');
    expect(continentLabel('EU', t)).toBe('Europa');
    expect(continentLabel('AS', t)).toBe('Asien');
    expect(continentLabel('NA', t)).toBe('Nordamerika');
    expect(continentLabel('150', t)).toBe('Europa');
    expect(continentLabel('XX', t)).toBe('');
  });
});
