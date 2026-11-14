import { APP_NAME } from '../config';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Märket med genomskinlig bakgrund. Under 64 px används det förenklade märket. Mörk variant i mörkt läge.
 * Färgerna är fasta. decorative: när APP_NAME redan står som text bredvid.
 */
export function Logo({ size = 96, decorative = false }: { size?: number; decorative?: boolean }) {
  const { theme } = useTheme();
  const small = size < 64;
  const file = `globedex-symbol${small ? '-liten' : ''}${theme.dark ? '-mork' : ''}.svg`;
  return (
    <img
      className={small ? 'logo-sm' : 'logo'}
      src={`/logo/${file}`}
      width={size}
      height={size}
      alt={decorative ? '' : APP_NAME}
    />
  );
}
