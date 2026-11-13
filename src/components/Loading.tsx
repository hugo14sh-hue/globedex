import { useT } from '../lib/useT';

export function Loading() {
  const t = useT();
  return (
    <main className="scr plain center" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <span className="sr-only">{t('allmant.laddar')}</span>
    </main>
  );
}
