import { Estimate } from '../../components/Estimate';
import type { CostLevel } from '../../lib/content';
import { useT } from '../../lib/useT';

/** Rekommenderad budget under idéns titel, efter cost_level. Allt utom gratis är en uppskattning. */
export function IdeaBudget({ level }: { level: CostLevel | null | undefined }) {
  const t = useT();
  if (!level) return null;
  return (
    <span className="budget">
      <span className="eb">{t('idag.budget.rubrik')}</span> <span>{t(`idag.budget.${level}`)}</span>
      {level !== 'gratis' && <Estimate />}
    </span>
  );
}
