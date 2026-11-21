// Förslagen i sökfältet för plats (PlaceCombobox). Ren logik utan React, testas i innehallSprak.test.ts.
import type { PlaceOption } from '../components/PlaceCombobox';
import { countryName, countryNameOf, type Place } from './content';
import { isCountryId, isSplitPart } from './delade';
import { LOCALE } from './locale';
import { namesOf } from './innehallSprak';

/** Förslag för sökfältet: länder med namn, städer och regioner med landets namn. Sorterade efter namn. */
export function placeOptions(places: Place[], ids: Iterable<string>): PlaceOption[] {
  const out: PlaceOption[] = [];
  for (const id of new Set(ids)) {
    const p = places.find((x) => x.id === id);
    const isCountry = p ? p.kind === 'country' : isCountryId(id);
    // Delar av delade länder (GB-eng) får namnet från texten land.<id> på valt språk.
    const name = isSplitPart(id) ? countryName(id) : (p?.name ?? (isCountry ? countryName(id) : id));
    // En plats i en del av ett delat land (GB-eng-london) får delens namn (England), src/lib/delade.ts.
    const land = isCountry ? null : countryNameOf(places, id);
    // Sökningen hittar platser i innehållet på båda språken, oavsett valt språk.
    const names = p && !isSplitPart(id) && p.name === name ? namesOf(p) : [name];
    out.push({ id, name, country: isCountry, countryName: land ?? undefined, names });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}
