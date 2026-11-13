import { useMemo } from 'react';
import { countryName, type Place } from '../../lib/content';
import { COUNTRIES } from '../../lib/countries';

/** Alla resmål: länder och städer ur innehållet plus alla länder i världen (även utan innehåll). */
export function useDestinations(places: Place[]) {
  return useMemo(() => {
    const out = new Map<string, string>();
    for (const p of places) if (p.kind === 'country' || p.kind === 'city' || p.kind === 'region') out.set(p.id, p.name);
    for (const [iso] of COUNTRIES) if (!out.has(iso)) out.set(iso, countryName(iso));
    return [...out].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }, [places]);
}

export function DestSelect({ label, places, value, onChange }: { label: string; places: Place[]; value: string; onChange: (id: string) => void }) {
  const list = useDestinations(places);
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        {!value && <option value="" />}
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
