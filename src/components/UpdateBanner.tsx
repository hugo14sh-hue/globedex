import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from '../lib/useT';

/** Visas när en ny version av appen finns. */
export function UpdateBanner() {
  const t = useT();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="card banner" role="status">
      <div className="row">
        <span>{t('allmant.ny-version')}</span>
        <button type="button" className="chip" aria-pressed="true" onClick={() => updateServiceWorker(true)}>
          {t('allmant.uppdatera')}
        </button>
      </div>
    </div>
  );
}
