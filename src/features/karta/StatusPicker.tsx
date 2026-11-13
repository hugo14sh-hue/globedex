import { useFeedback } from '../../components/Feedback';
import { setPlaceStatus, STATUS_KEY, STATUSES, type PlaceStatus } from '../../lib/status';
import { useT } from '../../lib/useT';

/** Väljare för status på en plats. Samma i bottenarket på kartan och på landssidan. */
export function StatusPicker({
  placeId,
  name,
  current,
  total,
  label,
}: {
  placeId: string;
  name: string;
  current: PlaceStatus | undefined;
  /** Antal platser med status innan ändringen, för beskedet om första landet. */
  total: number;
  label: string;
}) {
  const t = useT();
  const { toast, party } = useFeedback();

  const pick = async (s: PlaceStatus | null) => {
    if ((s ?? null) === (current ?? null)) return;
    try {
      await setPlaceStatus(placeId, s);
      const text = t('karta.status-satt', { plats: name, status: t(STATUS_KEY[s ?? 'ej']) });
      if (s && !current && total === 0) party(t('karta.forsta-landet'));
      else toast(text);
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  return (
    <div className="chips" role="group" aria-label={label}>
      {STATUSES.map((s) => (
        <button key={s} type="button" className="chip" aria-pressed={current === s} onClick={() => pick(s)}>
          <i className="dot" style={{ background: `var(--st-${s})` }} aria-hidden="true" />
          {t(STATUS_KEY[s])}
        </button>
      ))}
      <button type="button" className="chip" aria-pressed={!current} onClick={() => pick(null)}>
        {t(STATUS_KEY.ej)}
      </button>
    </div>
  );
}
