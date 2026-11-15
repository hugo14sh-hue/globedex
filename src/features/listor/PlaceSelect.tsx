import { useMemo } from 'react';
import { PlaceCombobox } from '../../components/PlaceCombobox';
import { type Place } from '../../lib/content';
import { placeOptions } from '../resor/DestSelect';

/**
 * Väljer en plats: länder och städer ur innehållet plus platser som användaren har satt status på
 * (även länder utan innehåll, med namn från webbläsaren). Sökfält med förslag.
 */
export function PlaceSelect({
  label,
  places,
  extra = [],
  value,
  onChange,
  optional = false,
}: {
  label: string;
  places: Place[];
  /** Fler id att visa, till exempel länder med status. */
  extra?: string[];
  value: string;
  onChange: (id: string) => void;
  /** Tillåt inget val (ett tömt fält tar bort valet). */
  optional?: boolean;
}) {
  const options = useMemo(() => {
    const ids: string[] = [];
    for (const p of places) if (p.kind === 'country' || p.kind === 'city') ids.push(p.id);
    ids.push(...extra);
    return placeOptions(places, ids);
  }, [places, extra]);
  return <PlaceCombobox label={label} options={options} value={value} onChange={onChange} optional={optional} />;
}
