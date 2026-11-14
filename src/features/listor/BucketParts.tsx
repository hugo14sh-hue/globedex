// Delmålen i en bucketpunkts detaljvy. Logiken finns i src/lib/bucketParts.ts.
import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import type { PartsView } from '../../lib/bucketParts';
import { percent } from '../../lib/listLogic';
import { useT } from '../../lib/useT';
import { CheckRow } from '../resor/PackScreen';

export function BucketParts({
  view,
  canAdd,
  busy,
  onToggle,
  onAdd,
}: {
  view: PartsView | null;
  /** Egna punkter kan få egna delmål. */
  canAdd: boolean;
  busy: boolean;
  onToggle: (title: string) => void;
  onAdd: (title: string) => Promise<boolean>;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  if (!view && !canAdd) return null;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    if (await onAdd(draft)) setDraft('');
  };

  return (
    <section className="col" aria-label={t('bucket.delar.rubrik')}>
      <div className="row">
        <h3 className="eb">{t('bucket.delar.rubrik')}</h3>
        {view && (
          <span className="mu">
            {t('bucket.delar.framsteg', {
              antal: view.done,
              totalt: view.total,
            })}
          </span>
        )}
      </div>

      {view && (
        <div
          className="bar"
          role="progressbar"
          aria-label={t('bucket.delar.rubrik')}
          aria-valuemin={0}
          aria-valuemax={view.total}
          aria-valuenow={view.done}
        >
          <i style={{ width: `${percent(view.done, view.total)}%` }} />
        </div>
      )}

      {view?.kind === 'antal' && view.done < view.total && (
        <span className="mu">{t('bucket.delar.kvar', { antal: view.total - view.done })}</span>
      )}

      {view?.kind === 'rader' &&
        view.rows.map((r) =>
          r.auto ? (
            <Row
              key={r.title}
              to={r.placeId ? `/karta/${r.placeId}` : undefined}
              title={r.title}
              sub={t('bucket.delar.auto')}
              lead={
                <span className={`box${r.done ? ' on' : ''}`} role="img" aria-label={r.done ? t('knapp.klar') : t('bucket.delar.auto')}>
                  {r.done && <Icon name="check" size={16} stroke={3} />}
                </span>
              }
            />
          ) : (
            <CheckRow key={r.title} title={r.title} on={r.done} onToggle={() => !busy && onToggle(r.title)} />
          ),
        )}

      {canAdd && (
        <form className="row" onSubmit={add}>
          <label className="grow">
            <span className="sr-only">{t('bucket.delar.ny')}</span>
            <input value={draft} maxLength={120} placeholder={t('bucket.delar.ny')} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button type="submit" className="chip" disabled={busy || !draft.trim()} aria-label={t('bucket.delar.ny')}>
            <Icon name="plus" size={18} />
            {t('knapp.lagg-till')}
          </button>
        </form>
      )}
    </section>
  );
}
