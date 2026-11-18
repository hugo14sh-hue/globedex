import { BackLink } from '../../components/BackLink';
import { useFeedback } from '../../components/Feedback';
import { Segment } from '../../components/Segment';
import { CountryListPicker } from '../../components/CountryListPicker';
import {
  APP_NAME,
  DEFAULT_THEME,
  RADIUS_MAX,
  RADIUS_MIN,
  type BodyFont,
  type HeadingFont,
  type Lang,
  LANGS,
  type TextSize,
  type Tone,
  type TravelMode,
} from '../../config';
import { useSession } from '../../lib/session';
import { text } from '../../lib/texter';
import { useT } from '../../lib/useT';
import { isHex } from '../../theme/color';
import { BODY_FONTS, HEADING_FONTS } from '../../theme/fonts';
import { PALETTES } from '../../theme/palettes';
import { hasLowContrast, resolvePalette } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { MapStyleChoice } from '../karta/MapStyleChoice';
import { MapColors } from './MapColors';

export default function AnpassningScreen() {
  const t = useT();
  const { theme, lang, update, setTheme } = useTheme();
  const { profile, setTravelMode } = useSession();
  const { toast } = useFeedback();
  const mode = profile?.travel_mode ?? 'solo';
  const custom = theme.palette === 'egen';
  const current = resolvePalette(theme);

  const changeMode = async (m: TravelMode) => {
    try {
      await setTravelMode(m);
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  const setCustom = (k: 'p' | 'a' | 'bg', v: string) => {
    if (isHex(v)) update({ custom: { ...theme.custom, [k]: v.toUpperCase() } });
  };

  return (
    <main className="scr wide anp">
      <BackLink to="/vi" />
      <h1>{t('anpassa.rubrik')}</h1>

      {/* Från 1200 px (Körning 17): valen till vänster, landlistan och kartans färger till höger. */}
      <div className="anp-cols">
      <div className="anp-col">
      <Segment<TravelMode>
        label={t('anpassa.reselage')}
        value={mode}
        onChange={changeMode}
        options={(['solo', 'par', 'grupp'] as const).map((m) => ({ value: m, label: t(`start.lage.${m}`) }))}
      />

      <div className="col">
        <span className="eb" id="palett-rubrik">
          {t('anpassa.palett')}
          {current.name ? `: ${current.name}` : ''}
        </span>
        <div className="chips" role="group" aria-labelledby="palett-rubrik">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="sw"
              style={{ background: theme.dark ? p.pd : p.p }}
              aria-pressed={theme.palette === p.id}
              aria-label={p.name}
              onClick={() => update({ palette: p.id })}
            >
              <i style={{ background: p.a }} />
            </button>
          ))}
          <button
            type="button"
            className="sw"
            style={{ background: theme.custom.p }}
            aria-pressed={custom}
            aria-label={t('anpassa.egen')}
            onClick={() => update({ palette: 'egen' })}
          >
            <i style={{ background: theme.custom.a }} />
          </button>
        </div>
      </div>

      {custom && (
        <div className="card">
          <h2 className="h3">{t('anpassa.egen')}</h2>
          <div className="g3">
            {(
              [
                ['p', 'anpassa.egen.primar'],
                ['a', 'anpassa.egen.accent'],
                ['bg', 'anpassa.egen.bakgrund'],
              ] as const
            ).map(([k, key]) => (
              <label key={k}>
                {t(key)}
                <input type="color" value={theme.custom[k].toLowerCase()} onChange={(e) => setCustom(k, e.target.value)} />
              </label>
            ))}
          </div>
          {hasLowContrast(theme) && (
            <p className="field-error" role="alert">
              {t('anpassa.kontrast')}
            </p>
          )}
        </div>
      )}

      <div className="g2">
        <label>
          {t('anpassa.rubrikfont')}
          <select value={theme.headingFont} onChange={(e) => update({ headingFont: e.target.value as HeadingFont })}>
            {HEADING_FONTS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('anpassa.brodfont')}
          <select value={theme.bodyFont} onChange={(e) => update({ bodyFont: e.target.value as BodyFont })}>
            {BODY_FONTS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <h2 className="h3">{APP_NAME}</h2>
        <p>{t('anpassa.stil.exempel')}</p>
      </div>

      <Segment<TextSize>
        label={t('anpassa.textstorlek')}
        value={theme.textSize}
        onChange={(v) => update({ textSize: v })}
        options={(['liten', 'normal', 'stor'] as const).map((s) => ({ value: s, label: t(`anpassa.textstorlek.${s}`) }))}
      />

      <label className="switch">
        {t('anpassa.morkt')}
        <input type="checkbox" role="switch" checked={theme.dark} onChange={(e) => update({ dark: e.target.checked })} />
      </label>

      <label>
        {t('anpassa.rundning')}: {theme.radius} px
        <input
          type="range"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          value={theme.radius}
          onChange={(e) => update({ radius: Number(e.target.value) })}
        />
      </label>

      <Segment<Tone>
        label={t('anpassa.sprakstil')}
        value={theme.tone}
        onChange={(v) => update({ tone: v })}
        options={(['neutral', 'lekfull', 'romantisk'] as const).map((s) => ({
          value: s,
          label: t(`anpassa.stil.${s}`),
          disabled: s === 'romantisk' && mode !== 'par',
        }))}
      />

      {/* Språkets namn visas alltid på sitt eget språk. Valet sparas lokalt och i profilen som temat. */}
      <Segment<Lang>
        label={t('sprak.rubrik')}
        value={lang}
        onChange={(v) => update({ lang: v })}
        options={LANGS.map((l) => ({ value: l, label: text(`sprak.${l}`, theme.tone, {}, l), lang: l }))}
      />
      {/* Innehållet ur databasen finns bara på svenska ännu: sägs en gång här, inte på varje sida. */}
      {lang !== 'sv' && <p className="mu">{t('sprak.innehall-svenska')}</p>}
      </div>

      <div className="anp-col">
      {/* Vilka länder som räknas i statistik, mål och märken. Sparas lokalt och i profilen som språkvalet. */}
      <CountryListPicker />

      {/* Kartans färger och utseende (Körning 16). Sparas i profilen med temat. */}
      <MapColors />
      <MapStyleChoice />
      </div>
      </div>

      {/* Återställ gäller utseendet, också kartans färger och stil. Språkvalet, landlistan, kartans fokus och
          släckta statusar ligger kvar. */}
      <button
        type="button"
        className="btn ghost"
        onClick={() =>
          setTheme({ ...DEFAULT_THEME, lang: theme.lang, countryList: theme.countryList, splitCountries: theme.splitCountries, mapFocus: theme.mapFocus, mapHidden: theme.mapHidden })
        }
      >
        {t('anpassa.aterstall')}
      </button>
    </main>
  );
}
