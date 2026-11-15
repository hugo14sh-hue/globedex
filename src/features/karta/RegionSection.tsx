// Regionerna i ett land (landskap i Sverige, delstater i USA) på landssidan: en rad med lagrets namn och
// räknaren, och ett bottenark där varje region går att öppna och bocka av. Att bocka av sätter status
// besökt på regionen, att ta bort bocken tar bort statusen. Landets egen status ändras aldrig härifrån.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import type { Place } from '../../lib/content';
import { LOCALE } from '../../lib/locale';
import { mapRegions, regionLayerOf, regionsOf } from '../../lib/mapRegions';
import { setPlaceStatus, STATUS_KEY, type PlaceStatus } from '../../lib/status';
import { useT } from '../../lib/useT';
import { VISITED } from '../vi/marken';

export function RegionSection({
  countryId,
  countryName,
  places,
  statuses,
}: {
  countryId: string;
  countryName: string;
  places: Place[];
  statuses: Record<string, PlaceStatus>;
}) {
  const t = useT();
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const regions = useMemo(() => regionsOf(mapRegions(places, LOCALE), countryId), [places, countryId]);
  const layer = useMemo(() => regionLayerOf(regions, countryId), [regions, countryId]);
  if (!regions.length || !layer) return null;

  const visited = (id: string) => VISITED.includes(statuses[id]);
  const done = regions.filter((r) => visited(r.id)).length;
  const layerName = t(`karta.regioner.${layer}`);
  const counter = t('karta.regioner.antal', { antal: done, totalt: regions.length });

  const toggle = async (id: string, name: string) => {
    const next: PlaceStatus | null = visited(id) ? null : 'besokt';
    try {
      await setPlaceStatus(id, next);
      toast(t('karta.status-satt', { plats: name, status: t(STATUS_KEY[next ?? 'ej']) }));
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  return (
    <section className="col">
      <h2 className="eb">{t('karta.regioner.i-landet', { plats: countryName })}</h2>
      <Row icon="map" title={layerName} sub={counter} onClick={() => setOpen(true)} />
      <BottomSheet open={open} title={layerName} onClose={() => setOpen(false)}>
        <p className="mu" aria-live="polite">
          {counter}
        </p>
        {regions.map((r) => {
          const on = visited(r.id);
          return (
            <div key={r.id} className="li">
              <button type="button" className={`box${on ? ' on' : ''}`} aria-pressed={on} aria-label={r.name} onClick={() => toggle(r.id, r.name)}>
                {on && <Icon name="check" size={16} stroke={3} />}
              </button>
              <Link className="t" to={`/karta/${r.id}`}>
                <b className={on ? 'done' : ''}>{r.name}</b>
                <span className="mu">{t(STATUS_KEY[statuses[r.id] ?? 'ej'])}</span>
              </Link>
              <span className="chev">
                <Icon name="chev" size={18} />
              </span>
            </div>
          );
        })}
      </BottomSheet>
    </section>
  );
}
