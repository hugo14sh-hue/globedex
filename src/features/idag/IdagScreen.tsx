import { EmptyScreen } from '../../components/EmptyScreen';
import { useT } from '../../lib/useT';

// Körning 5 bygger Idag. Tills dess: tomt läge.
export default function IdagScreen() {
  const t = useT();
  return <EmptyScreen title={t('idag.rubrik.idag')} empty={t('idag.tom')} />;
}
