// Listor: Samlingsbok (Kort, Kompendium, Samlingar), Bucketlist och Swipe (Sortera i solo). Som i prototypen.
// Vald vy står i adressen (?vy= och ?del=), så att tillbaka-knappen och länkar hamnar rätt.
import { useSearchParams } from 'react-router-dom';
import { Segment } from '../../components/Segment';
import { useTravelMode } from '../../lib/session';
import { useT } from '../../lib/useT';
import { Bucketlist } from './Bucketlist';
import { Samlingsbok, type BokView } from './Samlingsbok';
import { Swipe, type SwipeView } from './Swipe';

type View = 'samlingsbok' | 'bucketlist' | 'swipe';
const VIEWS: View[] = ['samlingsbok', 'bucketlist', 'swipe'];
const BOK: BokView[] = ['kort', 'kompendium', 'samlingar'];
const SWIPE: SwipeView[] = ['kortbunt', 'lista'];

const pick = <T extends string>(list: T[], v: string | null): T => (list.includes(v as T) ? (v as T) : list[0]);

export default function ListorScreen() {
  const t = useT();
  const mode = useTravelMode();
  const [params, setParams] = useSearchParams();
  const view = pick(VIEWS, params.get('vy'));
  const del = params.get('del');
  // Byte av vy nollar vyns filter. extra: filter som ska följa med i samma steg (till exempel kategori).
  const go = (vy: View, d?: string, extra: Record<string, string> = {}) =>
    setParams({ vy, ...(d ? { del: d } : {}), ...extra }, { replace: true });

  return (
    <main className="scr">
      <h1>{t('flik.listor')}</h1>
      <Segment<View>
        value={view}
        onChange={(v) => go(v)}
        options={VIEWS.map((v) => ({
          value: v,
          label: t(v === 'swipe' && mode === 'solo' ? 'listor.vy.sortera' : `listor.vy.${v}`),
        }))}
      />
      {view === 'samlingsbok' && <Samlingsbok view={pick(BOK, del)} onView={(d, extra) => go('samlingsbok', d, extra)} />}
      {view === 'bucketlist' && <Bucketlist />}
      {view === 'swipe' && <Swipe view={pick(SWIPE, del)} onView={(d) => go('swipe', d)} />}
    </main>
  );
}
