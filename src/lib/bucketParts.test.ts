import { describe, expect, it } from 'vitest';
import { addedPart, allPartsDone, bucketParts, parseChecklist, toggledParts, visitedCount, type PartsContext } from './bucketParts';

const NAMES: Record<string, string> = {
  SE: 'Sverige',
  NO: 'Norge',
  DK: 'Danmark',
  JP: 'Japan',
  'SE-skane': 'Skåne',
  'SE-blekinge': 'Blekinge',
};

const ctx = (statuses: PartsContext['statuses'] = {}): PartsContext => ({
  places: [
    { id: 'SE', name: 'Sverige', parent_id: null, layer: null },
    { id: 'SE-skane', name: 'Skåne', parent_id: 'SE', layer: 'landskap' },
    { id: 'SE-blekinge', name: 'Blekinge', parent_id: 'SE', layer: 'landskap' },
    { id: 'SE-stockholm', name: 'Stockholms län', parent_id: 'SE', layer: 'lan' },
  ],
  statuses,
  name: (id) => NAMES[id] ?? id,
});

describe('parseChecklist', () => {
  it('läser de tre formerna och avvisar okända', () => {
    expect(parseChecklist({ type: 'platser', place_ids: ['SE'] })).toEqual({ type: 'platser', place_ids: ['SE'] });
    expect(parseChecklist({ type: 'platser', parent_id: 'SE', layer: 'landskap' })).toEqual({
      type: 'platser',
      parent_id: 'SE',
      layer: 'landskap',
    });
    expect(parseChecklist({ type: 'platser', source: 'besokta-lander' })).toEqual({ type: 'platser', source: 'besokta-lander' });
    expect(parseChecklist({ type: 'antal', metric: 'countries_visited', target: 10 })).toEqual({
      type: 'antal',
      metric: 'countries_visited',
      target: 10,
    });
    expect(parseChecklist({ type: 'delar', items: ['a', 'b'] })).toEqual({ type: 'delar', items: ['a', 'b'] });
    expect(parseChecklist({ type: 'antal', metric: 'okand', target: 3 })).toBeNull();
    expect(parseChecklist({ type: 'antal', metric: 'countries_visited', target: 0 })).toBeNull();
    expect(parseChecklist(null)).toBeNull();
  });
});

describe('bucketParts', () => {
  it('platser med place_ids bockas av automatiskt vid besökt, bor och har bott, inte vid planerad', () => {
    const v = bucketParts({ type: 'platser', place_ids: ['SE', 'NO', 'DK'] }, null, ctx({ SE: 'bor', NO: 'besokt', DK: 'planerad' }));
    expect(v).toMatchObject({ kind: 'rader', done: 2, total: 3 });
    if (v?.kind !== 'rader') throw new Error('fel form');
    expect(v.rows.every((r) => r.auto)).toBe(true);
    expect(v.rows.map((r) => r.done)).toEqual([true, true, false]);
  });

  it('platser med parent_id och layer tar platserna i lagret, i bokstavsordning', () => {
    const v = bucketParts({ type: 'platser', parent_id: 'SE', layer: 'landskap' }, null, ctx({ 'SE-skane': 'bott' }));
    if (v?.kind !== 'rader') throw new Error('fel form');
    expect(v.rows.map((r) => r.title)).toEqual(['Blekinge', 'Skåne']);
    expect(v.done).toBe(1);
  });

  it('besökta länder listar länder med status besökt, och bockas för hand', () => {
    const v = bucketParts(
      { type: 'platser', source: 'besokta-lander' },
      [{ title: 'Norge', done: true, done_at: '2026-01-01T00:00:00Z' }],
      ctx({ NO: 'besokt', DK: 'besokt', SE: 'bor', JP: 'vill' }),
    );
    if (v?.kind !== 'rader') throw new Error('fel form');
    expect(v.rows.map((r) => [r.title, r.done, r.auto])).toEqual([
      ['Danmark', false, false],
      ['Norge', true, false],
    ]);
  });

  it('antal räknas som i Siffror och stannar vid målet', () => {
    const s = ctx({ SE: 'bor', NO: 'besokt', JP: 'besokt', DK: 'vill' });
    expect(visitedCount('countries_visited', s.statuses)).toBe(3);
    expect(visitedCount('continents_visited', s.statuses)).toBe(2);
    expect(bucketParts({ type: 'antal', metric: 'countries_visited', target: 10 }, null, s)).toMatchObject({
      kind: 'antal',
      value: 3,
      done: 3,
      total: 10,
    });
    expect(bucketParts({ type: 'antal', metric: 'continents_visited', target: 2 }, null, s)).toMatchObject({ done: 2, total: 2 });
  });

  it('delar bockas för hand ur parts', () => {
    const v = bucketParts({ type: 'delar', items: ['A', 'B'] }, [{ title: 'B', done: true, done_at: null }], ctx());
    expect(v).toMatchObject({ kind: 'rader', done: 1, total: 2 });
  });

  it('egna punkter har bara egna delmål, och inga delmål ger null', () => {
    expect(bucketParts(null, [], ctx())).toBeNull();
    expect(bucketParts(null, [{ title: 'X', done: false, done_at: null }], ctx())).toMatchObject({
      kind: 'rader',
      own: true,
      total: 1,
      done: 0,
    });
  });

  it('allPartsDone', () => {
    expect(allPartsDone(bucketParts({ type: 'delar', items: ['A'] }, [{ title: 'A', done: true, done_at: null }], ctx()))).toBe(true);
    expect(allPartsDone(bucketParts({ type: 'delar', items: ['A', 'B'] }, [{ title: 'A', done: true, done_at: null }], ctx()))).toBe(false);
    expect(allPartsDone(null)).toBe(false);
  });
});

describe('parts', () => {
  it('toggledParts sätter done_at vid avbockning och nollar den när bocken tas bort', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const a = toggledParts(null, 'A', now);
    expect(a).toEqual([{ title: 'A', done: true, done_at: '2026-11-14T10:00:00.000Z' }]);
    expect(toggledParts(a, 'A', now)).toEqual([{ title: 'A', done: false, done_at: null }]);
  });

  it('addedPart lägger inte till tomma eller dubbletter', () => {
    const a = addedPart([], ' Ny ');
    expect(a).toEqual([{ title: 'Ny', done: false, done_at: null }]);
    expect(addedPart(a, 'Ny')).toHaveLength(1);
    expect(addedPart(a, '  ')).toHaveLength(1);
  });
});
