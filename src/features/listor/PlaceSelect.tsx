import { useMemo } from 'react';
import { placeName, type Place } from '../../lib/content';

/**
 * Väljer en plats: länder och städer ur innehållet plus platser som användaren har satt status på
 * (även länder utan innehåll, med namn från webbläsaren).
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
  /** Tillåt inget val (tom rad först). */
  optional?: boolean;
}) {
  const options = useMemo(() => {
    const ids = new Set<string>();
    for (const p of places) if (p.kind === 'country' || p.kind === 'city') ids.add(p.id);
    for (const id of extra) ids.add(id);
    return [...ids].map((id) => ({ id, name: placeName(places, id) })).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }, [places, extra]);
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {(optional || !value) && <option value="" />}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
