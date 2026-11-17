import { useId } from 'react';
import { useFeedback } from '../../components/Feedback';
import { useSession } from '../../lib/session';
import { setPlaceStatus, STATUS_KEY, STATUSES, useMyPlaces, type PlaceStatus } from '../../lib/status';
import { allowsTogether, companyGroups } from '../../lib/togetherLogic';
import { useT } from '../../lib/useT';

/**
 * Väljare för status på en plats. Samma i bottenarket på kartan och på landssidan.
 * Besökt, bor, har bott och mellanlandat: är användaren med i en par- eller gruppgrupp visas raden
 * Vem var med? under statusvalet, med Bara jag och ett val per grupp. Valet sparas i together_group.
 */
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
  const { session, groups } = useSession();
  const mine = useMyPlaces(session?.user.id ?? null);
  const company = companyGroups(groups);
  const together = mine.together[placeId] ?? null;
  const headingId = useId();
  const helpId = useId();

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

  const pickCompany = async (groupId: string | null) => {
    if (!current || groupId === together) return;
    try {
      await setPlaceStatus(placeId, current, groupId);
      const group = company.find((g) => g.id === groupId);
      toast(
        group
          ? t('karta.sallskap.sparat', { plats: name, status: t(STATUS_KEY[current]), grupp: group.name })
          : t('karta.status-satt', { plats: name, status: t(STATUS_KEY[current]) }),
      );
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  return (
    <>
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
      {allowsTogether(current) && company.length > 0 && (
        <div className="col company">
          <h3 className="eb" id={headingId}>
            {t('karta.sallskap.rubrik')}
          </h3>
          <div className="chips" role="group" aria-labelledby={headingId} aria-describedby={helpId}>
            <button type="button" className="chip" aria-pressed={!together || !company.some((g) => g.id === together)} onClick={() => pickCompany(null)}>
              {t('karta.sallskap.jag')}
            </button>
            {company.map((g) => (
              <button key={g.id} type="button" className="chip" aria-pressed={together === g.id} onClick={() => pickCompany(g.id)}>
                <i className="dot" style={{ background: 'var(--st-tillsammans)' }} aria-hidden="true" />
                {t('karta.sallskap.tillsammans', { grupp: g.name })}
              </button>
            ))}
          </div>
          <p className="mu" id={helpId}>
            {t('karta.sallskap.hjalp')}
          </p>
        </div>
      )}
    </>
  );
}
