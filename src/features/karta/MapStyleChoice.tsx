// Kartans utseende (Körning 16): följ appens tema, ljus karta eller mörk karta. Under Anpassning och i
// helskärmspanelen. Styr hav, land utan status, gränser och etiketter, oberoende av appens tema.
import { Segment } from '../../components/Segment';
import { MAP_STYLES, type MapStyle } from '../../config';
import { useT } from '../../lib/useT';
import { useTheme } from '../../theme/ThemeProvider';

export function MapStyleChoice() {
  const t = useT();
  const { theme, update } = useTheme();
  return (
    <Segment<MapStyle>
      label={t('kartstil.rubrik')}
      options={MAP_STYLES.map((v) => ({ value: v, label: t(`kartstil.${v}`) }))}
      value={theme.mapStyle}
      onChange={(v) => update({ mapStyle: v })}
    />
  );
}
