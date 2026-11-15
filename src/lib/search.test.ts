import { describe, expect, it } from 'vitest';
import { fold, matches, search, words } from './search';

// Namnen är exempel för matchningen, inget innehåll.
describe('sökning bland platser', () => {
  it('tar bort versaler och accenter men behåller å, ä och ö', () => {
    expect(fold('Curaçao')).toBe('curacao');
    expect(fold('São Tomé')).toBe('sao tome');
    expect(fold('Malmö')).toBe('malmö');
    expect(fold('ÅLAND')).toBe('åland');
    expect(fold('Ärla')).toBe('ärla');
  });

  it('delar upp i ord', () => {
    expect(words('Bosnien och Hercegovina')).toEqual(['bosnien', 'och', 'hercegovina']);
    expect(words('Guinea-Bissau')).toEqual(['guinea', 'bissau']);
    expect(words('Saint Nicholas (katedralen)')).toEqual(['saint', 'nicholas', 'katedralen']);
  });

  it('matchar början av varje ord', () => {
    expect(matches('Monaco', 'mon')).toBe(true);
    expect(matches('Monaco', 'MON')).toBe(true);
    expect(matches('Monte Carlo', 'carl')).toBe(true);
    expect(matches('New York', 'new y')).toBe(true);
    expect(matches('New York', 'y new')).toBe(true);
    expect(matches('Guinea-Bissau', 'biss')).toBe(true);
    expect(matches('Monaco', 'aco')).toBe(false);
    expect(matches('Gustavsberg', 'berg')).toBe(false);
    expect(matches('Monaco', '')).toBe(true);
    expect(matches('Monaco', '  ')).toBe(true);
  });

  it('bryr sig inte om accenter', () => {
    expect(matches('Curaçao', 'curac')).toBe(true);
    expect(matches('Reykjavík', 'reykjavik')).toBe(true);
    expect(matches('Curacao', 'curaç')).toBe(true);
  });

  it('skiljer å, ä och ö från a och o', () => {
    expect(matches('Åland', 'å')).toBe(true);
    expect(matches('Åland', 'a')).toBe(false);
    expect(matches('Aland', 'å')).toBe(false);
    expect(matches('Örebro', 'o')).toBe(false);
    expect(matches('Oslo', 'ö')).toBe(false);
    expect(matches('Ängelholm', 'äng')).toBe(true);
    expect(matches('Angola', 'ä')).toBe(false);
  });

  it('sorterar namn som börjar med frågan först', () => {
    const list = ['Albanien', 'Costa Rica', 'Rikets sal', 'Rumänien'];
    expect(search(list, 'ri', (x) => x)).toEqual(['Rikets sal', 'Costa Rica']);
    expect(search(list, '', (x) => x)).toEqual(list);
    expect(search(['Monaco', 'Fiji'], 'mon', (x) => x)).toEqual(['Monaco']);
  });
});
