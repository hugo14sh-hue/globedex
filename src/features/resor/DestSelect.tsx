import { useMemo } from 'react';
import { PlaceCombobox } from '../../components/PlaceCombobox';
import { type Place } from '../../lib/content';
import { COUNTRIES } from '../../lib/countries';
import { SPLIT_PARTS } from '../../lib/delade';
import { placeOptions } from '../../lib/placeOptions';

export { placeOptions };

/**
 * Alla resmål: länder, regioner och städer ur innehållet plus alla länder i världen (även utan innehåll).
 * Både Storbritannien och dess fyra delar finns med, oavsett valet för delade länder.
 */
export function useDestinations(places: Place[]) {
  return useMemo(() => {
    const ids: string[] = [];
    for (const p of places) if (p.kind === 'country' || p.kind === 'city' || p.kind === 'region') ids.push(p.id);
    for (const [iso] of COUNTRIES) ids.push(iso);
    ids.push(...SPLIT_PARTS);
    return placeOptions(places, ids);
  }, [places]);
}

export function DestSelect({ label, places, value, onChange }: { label: string; places: Place[]; value: string; onChange: (id: string) => void }) {
  const list = useDestinations(places);
  return <PlaceCombobox label={label} options={list} value={value} onChange={onChange} />;
}
