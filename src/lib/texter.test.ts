import { describe, expect, it } from 'vitest';
import data from '../../content/_texter.json';
import { APP_NAME } from '../config';
import { hasText, setTone, t, text } from './texter';

describe('texter', () => {
  it('läser en ren sträng lika i alla stilar', () => {
    expect(text('knapp.spara', 'neutral')).toBe('Spara');
    expect(text('knapp.spara', 'lekfull')).toBe('Spara');
  });

  it('väljer vald språkstil', () => {
    expect(text('login.rubrik', 'lekfull')).toBe('Hoppa in');
    expect(text('login.rubrik', 'romantisk')).toBe('Välkommen tillbaka');
  });

  it('fyller i platshållare', () => {
    expect(text('allmant.obligatoriskt', 'neutral', { falt: 'namn' })).toBe('Fyll i namn.');
    expect(text('grupp.bjud-in.text', 'neutral', { dagar: 7 })).toContain('7 dagar');
  });

  it('fyller {app} med APP_NAME', () => {
    expect(text('allmant.installera-text', 'neutral')).toContain(APP_NAME);
  });

  it('faller tillbaka på neutral när stilen saknas', () => {
    const raw = data.texter as Record<string, unknown>;
    const k = Object.keys(raw).find((x) => typeof raw[x] === 'object' && !('lekfull' in (raw[x] as object)));
    if (k) expect(text(k, 'lekfull')).toBe(text(k, 'neutral'));
  });

  it('visar nyckeln när texten saknas', () => {
    expect(hasText('finns.inte')).toBe(false);
    expect(text('finns.inte', 'neutral')).toBe('finns.inte');
  });

  it('t använder språkstilen som är satt', () => {
    setTone('lekfull');
    expect(t('login.rubrik')).toBe('Hoppa in');
    setTone('neutral');
    expect(t('login.rubrik')).toBe('Logga in');
  });
});
