import { describe, expect, it } from 'vitest';
import { countryName, placeName, type Place } from './content';

describe('platsnamn', () => {
  it('ger svenska landsnamn från webbläsaren för länder utan innehåll', () => {
    expect(countryName('FR')).toBe('Frankrike');
    expect(countryName('DE')).toBe('Tyskland');
    expect(countryName('GB')).toBe('Storbritannien');
  });

  it('använder innehållets namn när platsen finns, annars landets namn', () => {
    const places = [{ id: 'NL', name: 'Nederländerna' }, { id: 'NL-amsterdam', name: 'Amsterdam' }] as Place[];
    expect(placeName(places, 'NL-amsterdam')).toBe('Amsterdam');
    expect(placeName(places, 'IT')).toBe('Italien');
    // Okänt id som inte är en ISO-kod visas som det är.
    expect(placeName(places, 'XX-okand')).toBe('XX-okand');
  });
});
