import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareTexts, placeholders } from './validate-texts.mjs';

const read = (name) => JSON.parse(readFileSync(join(process.cwd(), 'content', name), 'utf8').replace(/^﻿/, ''));

describe('texterna på svenska och engelska', () => {
  it('har samma nycklar, form, platshållare och märken åt båda hållen', () => {
    const errors = compareTexts(read('_texter.json'), read('_texter.en.json'));
    expect(errors).toEqual([]);
  });

  it('hittar platshållare', () => {
    expect(placeholders('{antal} av {totalt}, {antal}')).toEqual(['antal', 'totalt']);
    expect(placeholders('ingen')).toEqual([]);
  });

  // Påhittade nycklar och värden, bara för att prova kontrollen.
  const sv = {
    texter: { a: 'x {n}', b: { neutral: 'x', lekfull: 'y {n}' }, c: 'x' },
    marken: [{ id: 'm', name: 'x', rule: 'r >= 1', text: 'x' }],
  };

  it('hittar nyckel som saknas åt båda hållen', () => {
    const errors = compareTexts(sv, { texter: { a: 'y {n}', b: { neutral: 'x', lekfull: 'y {n}' }, d: 'x' }, marken: sv.marken });
    expect(errors.map((e) => `${e.file}:${e.key}`).sort()).toEqual(['_texter.en.json:c', '_texter.json:d']);
  });

  it('hittar fel form och fel platshållare', () => {
    const errors = compareTexts(sv, { texter: { a: 'y', b: 'x', c: { neutral: 'x' } }, marken: sv.marken });
    expect(errors.map((e) => e.key).sort()).toEqual(['a', 'b', 'c']);
  });

  it('hittar fel stilar och fel platshållare i en stil', () => {
    const errors = compareTexts(sv, { texter: { a: 'y {n}', b: { neutral: 'x', lekfull: 'y' }, c: 'x' }, marken: sv.marken });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('lekfull');
    const tones = compareTexts(sv, { texter: { a: 'y {n}', b: { neutral: 'x', romantisk: 'y {n}' }, c: 'x' }, marken: sv.marken });
    expect(tones.some((e) => e.key === 'b' && e.message.includes('stilarna'))).toBe(true);
  });

  it('hittar märken som saknas eller har annan regel', () => {
    const errors = compareTexts(sv, {
      texter: sv.texter,
      marken: [
        { id: 'm', name: 'x', rule: 'r >= 2', text: 'x' },
        { id: 'n', name: 'x', rule: 'r', text: 'x' },
      ],
    });
    expect(errors.map((e) => `${e.file}:${e.key}:${e.message}`).sort()).toEqual([
      '_texter.en.json:marken.m:regeln skiljer sig',
      '_texter.json:marken.n:märket saknas',
    ]);
  });
});
