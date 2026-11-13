import { describe, expect, it } from 'vitest';
import { canInvite, pickActiveGroup } from './groups';
import type { Group } from './types';

const g = (id: string, kind: Group['kind'], created_by = 'u1'): Group => ({ id, kind, created_by, name: id, created_at: '' });

describe('grupper', () => {
  it('bjuder bara in till par och grupp, aldrig till en sologrupp', () => {
    expect(canInvite(g('a', 'solo'))).toBe(false);
    expect(canInvite(g('a', 'par'))).toBe(true);
    expect(canInvite(g('a', 'grupp'))).toBe(true);
    expect(canInvite(null)).toBe(false);
  });

  it('aktiv grupp väljs bara bland grupper man är medlem i', () => {
    const mine = [g('solo', 'solo'), g('par', 'par', 'u2')];
    expect(pickActiveGroup(mine, 'par', 'u1')).toBe('par');
    // Lämnad eller okänd grupp: tillbaka till sologruppen.
    expect(pickActiveGroup(mine, 'lamnad', 'u1')).toBe('solo');
    expect(pickActiveGroup(mine, null, 'u1')).toBe('solo');
    // Någon annans sologrupp räknas inte som ens egen.
    expect(pickActiveGroup([g('x', 'solo', 'u2'), g('p', 'par', 'u2')], 'borta', 'u1')).toBe('x');
    expect(pickActiveGroup([], 'borta', 'u1')).toBe(null);
  });
});
