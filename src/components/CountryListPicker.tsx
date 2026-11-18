// Vilka länder som räknas i statistik, mål och märken. Samma val under Anpassning och i bottenarket
// på kartan (knappen intill lägesväljaren). Sparas lokalt och i profilen som språkvalet.
// Brytaren landlista.delade.val (Körning 19) gäller tillsammans med vilken lista som helst: med den på räknas
// England, Skottland, Wales och Nordirland i stället för Storbritannien (src/lib/delade.ts).
import { useId } from 'react';
import { COUNTRY_LISTS } from '../config';
import { countryListKey, countryListTotal } from '../lib/landlistor';
import { useT } from '../lib/useT';
import { useTheme } from '../theme/ThemeProvider';

export function CountryListPicker({ legend = true }: { legend?: boolean }) {
  const t = useT();
  const { theme, update } = useTheme();
  const helpId = useId();
  const splitHelpId = useId();
  const name = useId();
  return (
    <fieldset className="col">
      <legend className={legend ? 'eb' : 'sr-only'}>{t('landlista.rubrik')}</legend>
      <p className="mu" id={helpId}>
        {t('landlista.hjalp')}
      </p>
      {COUNTRY_LISTS.map((l) => (
        <label key={l} className="check">
          <input
            type="radio"
            name={name}
            value={l}
            checked={theme.countryList === l}
            aria-describedby={helpId}
            onChange={() => update({ countryList: l })}
          />
          {t(countryListKey(l), { totalt: countryListTotal(l, theme.splitCountries) })}
        </label>
      ))}
      <label className="switch">
        <span>{t('landlista.delade.val')}</span>
        <input
          type="checkbox"
          role="switch"
          checked={theme.splitCountries}
          aria-describedby={splitHelpId}
          onChange={(e) => update({ splitCountries: e.target.checked })}
        />
      </label>
      <p className="mu" id={splitHelpId}>
        {t('landlista.delade.hjalp')}
      </p>
    </fieldset>
  );
}
