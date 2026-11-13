import { describe, expect, it } from 'vitest';
import { ageOn, birthDate, medicineLines, passExpiryWarning, rulesForAge, type VaultEntry } from './vaultLogic';

const e = (kind: VaultEntry['kind'], f: Record<string, string>, pack?: boolean): VaultEntry => ({
  id: kind,
  kind,
  content: { f, pack },
  updated_at: '',
});

describe('ålder', () => {
  it('räknar hela år och födelsedagen', () => {
    expect(ageOn('2000-05-10', '2026-05-09')).toBe(25);
    expect(ageOn('2000-05-10', '2026-05-10')).toBe(26);
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
  });
  it('null utan giltigt datum', () => {
    expect(ageOn(null, '2026-01-01')).toBeNull();
    expect(ageOn('fel', '2026-01-01')).toBeNull();
    expect(ageOn('2030-01-01', '2026-01-01')).toBeNull();
  });
  it('hittar födelsedatumet', () => {
    expect(birthDate([e('pass', {}), e('fodelsedatum', { fodelsedatum: '1999-01-02' })])).toBe('1999-01-02');
    expect(birthDate([])).toBeNull();
  });
});

describe('regler för dig', () => {
  const facts = [
    { id: 'a', is_rule: true, min_age: 18 },
    { id: 'h', is_rule: true, min_age: 21 },
    { id: 'u', is_rule: true, min_age: 25 },
    { id: 'x', is_rule: true, min_age: null },
    { id: 'g', is_rule: false, min_age: 18 },
  ];
  it('visar regler där åldern är under gränsen, högsta gränsen först', () => {
    expect(rulesForAge(facts, 17).map((f) => f.id)).toEqual(['u', 'h', 'a']);
    expect(rulesForAge(facts, 22).map((f) => f.id)).toEqual(['u']);
    expect(rulesForAge(facts, 30)).toEqual([]);
  });
});

describe('passets giltighet', () => {
  it('varnar sex månader innan', () => {
    expect(passExpiryWarning([e('pass', { 'giltigt-till': '2027-05-01' })], '2026-11-13')).toBe('2027-05-01');
    expect(passExpiryWarning([e('pass', { 'giltigt-till': '2027-06-01' })], '2026-11-13')).toBeNull();
  });
  it('varnar om passet går ut inom sex månader efter en kommande resa', () => {
    expect(passExpiryWarning([e('pass', { 'giltigt-till': '2027-08-01' })], '2026-11-13', ['2027-03-10'])).toBe('2027-08-01');
    expect(passExpiryWarning([e('pass', { 'giltigt-till': '2027-08-01' })], '2026-11-13', ['2025-03-10', null])).toBeNull();
  });
  it('utan pass eller datum: ingen varning', () => {
    expect(passExpiryWarning([], '2026-11-13')).toBeNull();
    expect(passExpiryWarning([e('pass', { passnummer: 'X' })], '2026-11-13')).toBeNull();
  });
});

describe('packförslag ur hälsa', () => {
  it('delar på rad, komma och semikolon, utan dubbletter', () => {
    expect(medicineLines([e('halsa', { mediciner: 'Insulin\nInhalator, insulin; Recept ' }, true)])).toEqual(['Insulin', 'Inhalator', 'Recept']);
  });
  it('bara när användaren har valt det', () => {
    expect(medicineLines([e('halsa', { mediciner: 'Insulin' }, false)])).toEqual([]);
  });
});
