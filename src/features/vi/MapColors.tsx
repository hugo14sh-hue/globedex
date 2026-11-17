// Kartans färger under Anpassning (Körning 16): en egen färg per status. Sparas per användare i profilen
// (temat i profiles.settings) och går före palettens färger på kartan, i förklaringen och överallt där
// statusfärgen visas. En färg som ligger för nära en annan status får en varning, men valet stoppas inte.
import { useEffect, useId, useMemo, useRef } from 'react';
import { useFeedback } from '../../components/Feedback';
import { COLOR_KEYS, type ColorKey } from '../../config';
import { closeTo, COLOR_LABEL, COMPANY_KEYS, withColor, withoutColor, withoutColors } from '../../lib/mapColors';
import { useSession } from '../../lib/session';
import { companyGroups } from '../../lib/togetherLogic';
import { useT } from '../../lib/useT';
import { mapIsDark, statusColors } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';

export function MapColors() {
  const t = useT();
  const id = useId();
  const { theme, setTheme } = useTheme();
  const { profile, groups, members } = useSession();
  const { toast } = useFeedback();
  const dark = mapIsDark(theme);
  const colors = statusColors(theme, dark);

  // Besökt i sällskap finns bara för den som är med i en par- eller gruppgrupp. Bara den andra har namnen.
  const names = members
    .filter((m) => m.user_id !== profile?.id)
    .map((m) => m.display_name)
    .filter(Boolean)
    .join(', ');
  const withCompany = companyGroups(groups).length > 0;
  const keys = useMemo<ColorKey[]>(
    () => COLOR_KEYS.filter((k) => !COMPANY_KEYS.includes(k) || (withCompany && (k !== 'bara-annan' || names))),
    [withCompany, names],
  );
  const label = (k: ColorKey) => t(COLOR_LABEL[k], k === 'bara-annan' ? { namn: names } : undefined);

  // Bekräftelsen visas när profilen har sparat färgerna (sessionen sparar temat en kort stund efter ändringen).
  const pending = useRef(false);
  const saved = JSON.stringify((profile?.settings?.theme as { mapColors?: unknown } | undefined)?.mapColors ?? {});
  const wanted = JSON.stringify(theme.mapColors);
  useEffect(() => {
    if (pending.current && saved === wanted) {
      pending.current = false;
      toast(t('farger.sparat'));
    }
  }, [saved, wanted, toast, t]);

  const change = (next: typeof theme) => {
    pending.current = true;
    setTheme(next);
  };

  return (
    <section className="col" aria-labelledby={`${id}-h`}>
      <h2 className="eb" id={`${id}-h`}>
        {t('farger.rubrik')}
      </h2>
      <p className="mu">{t('farger.hjalp')}</p>
      <ul className="color-rows">
        {keys.map((k) => {
          const near = closeTo(theme, k, dark, keys);
          const lid = `${id}-${k}`;
          return (
            <li key={k}>
              <div className="color-row" role="group" aria-labelledby={lid}>
              <input
                type="color"
                className="color-in"
                aria-label={t('farger.valj', { status: label(k) })}
                value={colors[k].toLowerCase()}
                onChange={(e) => change(withColor(theme, k, e.target.value))}
              />
              <span className="t">
                <b id={lid}>{label(k)}</b>
                {near && (
                  <span className="field-warn" role="status">
                    {t('farger.varning', { status: label(near) })}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="chip"
                disabled={!theme.mapColors[k]}
                aria-describedby={lid}
                onClick={() => change(withoutColor(theme, k))}
              >
                {t('farger.aterstall.en')}
              </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn ghost" disabled={!Object.keys(theme.mapColors).length} onClick={() => change(withoutColors(theme))}>
        {t('farger.aterstall')}
      </button>
    </section>
  );
}
