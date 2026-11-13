import { EmptyScreen } from '../../components/EmptyScreen';
import { useT } from '../../lib/useT';

// Körning 3 bygger listorna. Tills dess: tomt läge.
export default function ListorScreen() {
  const t = useT();
  return <EmptyScreen title={t('flik.listor')} empty={t('samling.tom')} />;
}
