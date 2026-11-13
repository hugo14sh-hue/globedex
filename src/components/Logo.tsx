import { APP_NAME } from '../config';
import { useTheme } from '../theme/ThemeProvider';

/** Märket med genomskinlig bakgrund. Mörk variant i mörkt läge. Färgerna är fasta. */
export function Logo({ size = 96 }: { size?: number }) {
  const { theme } = useTheme();
  const small = size < 64;
  const file = `globedex-symbol${small ? '-liten' : ''}${theme.dark ? '-mork' : ''}.svg`;
  return <img className="logo" src={`/logo/${file}`} width={size} height={size} alt={APP_NAME} />;
}
