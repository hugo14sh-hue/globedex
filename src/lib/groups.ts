import type { Group } from './types';

/** Bara par- och gruppytor kan bjuda in. */
export const canInvite = (g: Pick<Group, 'kind'> | null | undefined) => Boolean(g && g.kind !== 'solo');

/**
 * Väljer aktiv grupp bland de grupper användaren är medlem i:
 * den sparade om man är medlem där, annars den egna sologruppen, annars den första.
 */
export function pickActiveGroup(groups: Group[], saved: string | null, userId: string): string | null {
  if (saved && groups.some((g) => g.id === saved)) return saved;
  const solo = groups.find((g) => g.kind === 'solo' && g.created_by === userId);
  return solo?.id ?? groups[0]?.id ?? null;
}
