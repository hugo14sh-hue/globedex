import { useCallback } from 'react';
import { useFeedback } from '../../components/Feedback';
import type { CompendiumItem } from '../../lib/content';
import { useT } from '../../lib/useT';

/** Beskedet för ett nytt fynd: samling.fynd, och för sällsynt och legendarisk egen text med konfetti. */
export function useFindFeedback() {
  const t = useT();
  const { toast, party } = useFeedback();
  return useCallback(
    (c: Pick<CompendiumItem, 'name' | 'rarity'>) => {
      if (c.rarity === 'legendarisk') party(t('samling.fynd-legendarisk', { namn: c.name }));
      else if (c.rarity === 'sallsynt') party(t('samling.fynd-sallsynt', { namn: c.name }));
      else toast(t('samling.fynd', { namn: c.name }));
    },
    [t, toast, party],
  );
}
