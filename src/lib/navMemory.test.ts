import { describe, expect, it } from 'vitest';
import { createScrollStore, scrollTarget, withParam, type KeyValueStorage } from './navMemory';

const memory = (): KeyValueStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('scrollTarget', () => {
  it('bakåt och framåt i historiken (POP) lägger tillbaka positionen', () => {
    expect(scrollTarget('POP', false, 1840)).toBe(1840);
    expect(scrollTarget('POP', true, 300)).toBe(300);
  });

  it('POP utan sparad position börjar högst upp', () => {
    expect(scrollTarget('POP', false, undefined)).toBe(0);
  });

  it('ny navigering framåt (PUSH) börjar alltid högst upp', () => {
    expect(scrollTarget('PUSH', false, 900)).toBe(0);
    expect(scrollTarget('PUSH', true, 900)).toBe(0);
  });

  it('byte av vy eller filter på samma sida (REPLACE) behåller positionen, ny sida börjar högst upp', () => {
    expect(scrollTarget('REPLACE', true, undefined)).toBe('keep');
    expect(scrollTarget('REPLACE', false, 500)).toBe(0);
  });
});

describe('createScrollStore', () => {
  it('sparar per historikpost och läser tillbaka efter omladdning', () => {
    const s = memory();
    const a = createScrollStore(s);
    a.set('k1', 1200.4);
    a.set('k2', -5);
    const b = createScrollStore(s);
    expect(b.get('k1')).toBe(1200);
    expect(b.get('k2')).toBe(0);
    expect(b.get('saknas')).toBeUndefined();
  });

  it('tar bort de äldsta posterna och tål trasig data och avstängd lagring', () => {
    const s = memory();
    const a = createScrollStore(s);
    for (let i = 0; i < 70; i++) a.set(`k${i}`, i);
    expect(a.get('k0')).toBeUndefined();
    expect(a.get('k69')).toBe(69);
    s.data['globedex.scroll'] = '{trasig';
    expect(createScrollStore(s).get('k69')).toBeUndefined();
    const none = createScrollStore(null);
    none.set('x', 10);
    expect(none.get('x')).toBe(10);
  });
});

describe('withParam', () => {
  it('sätter värdet och tar bort det när det är standardvärdet eller tomt', () => {
    const p = new URLSearchParams('vy=bucketlist&resa=1');
    expect(withParam(p, 'kat', 'natur').toString()).toBe('vy=bucketlist&resa=1&kat=natur');
    expect(withParam(p, 'resa', null).toString()).toBe('vy=bucketlist');
    expect(withParam(p, 'vy', 'bucketlist', 'bucketlist').toString()).toBe('resa=1');
    expect(withParam(p, 'q', '').toString()).toBe('vy=bucketlist&resa=1');
    // Originalet ändras inte.
    expect(p.toString()).toBe('vy=bucketlist&resa=1');
  });
});
