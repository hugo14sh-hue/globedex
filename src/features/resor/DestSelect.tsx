import { useMemo } from 'react';
import { PlaceCombobox, type PlaceOption } from '../../components/PlaceCombobox';
import { countryName, countryOf, type Place } from '../../lib/content';
import { COUNTRIES } from '../../lib/countries';
import { LOCALE } from '../../lib/locale';

/** Förslag för sökfältet: länder med namn, städer och regioner med landets namn. Sorterade efter namn. */
export function placeOptions(places: Place[], ids: Iterable<string>): PlaceOption[] {
  const out: PlaceOption[] = [];
  for (const id of new Set(ids)) {
    const p = places.find((x) => x.id === id);
    const isCountry = p ? p.kind === 'country' : /^[A-Z]{2}$/.test(id);
    const name = p?.name ?? (isCountry ? countryName(id) : id);
    const land = isCountry ? null : (countryOf(places, id)?.name ?? (/^[A-Z]{2}-/.test(id) ? countryName(id.slice(0, 2)) : undefined));
    out.push({ id, name, country: isCountry, countryName: land ?? undefined });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}

/** Alla resmål: länder, regioner och städer ur innehållet plus alla länder i världen (även utan innehåll). */
export function useDestinations(places: Place[]) {
  return useMemo(() => {
    const ids: string[] = [];
    for (const p of places) if (p.kind === 'country' || p.kind === 'city' || p.kind === 'region') ids.push(p.id);
    for (const [iso] of COUNTRIES) ids.push(iso);
    return placeOptions(places, ids);
  }, [places]);
}

export function DestSelect({ label, places, value, onChange }: { label: string; places: Place[]; value: string; onChange: (id: string) => void }) {
  const list = useDestinations(places);
  return <PlaceCombobox label={label} options={list} value={value} onChange={onChange} />;
}
