import { EmptyScreen } from '../../components/EmptyScreen';
import { useT } from '../../lib/useT';

// Körning 4 bygger resorna. Tills dess: tomt läge.
export default function ResorScreen() {
  const t = useT();
  return <EmptyScreen title={t('flik.resor')} empty={t('resor.tom')} />;
}
