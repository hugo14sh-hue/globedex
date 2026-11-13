import { useT } from '../lib/useT';

/** Märkning för fält som är egen bedömning utan källa (data.own_judgment). */
export function Estimate() {
  const t = useT();
  return (
    <span className="chip soft est">
      {t('knapp.uppskattning')}
      <span className="sr-only">. {t('knapp.uppskattning-hjalp')}</span>
    </span>
  );
}
