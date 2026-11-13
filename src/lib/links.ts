// Länkar ut till flyg, boende och kartor. Ingen API i fas 1: sajterna öppnas med valen ifyllda.
// Hugo kontrollerar länkarna mot sajterna. Testerna ligger i links.test.ts.

export const isIsoDate = (v: string | undefined | null): v is string => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Hemdatum får inte vara före utresan. */
export const validRange = (out: string, home?: string) => isIsoDate(out) && (!home || (isIsoDate(home) && home >= out));

export interface FlightSearch {
  /** IATA-kod för avreseorten, till exempel GOT eller CPH. */
  from: string;
  /** IATA-kod för målet, till exempel AMS. */
  to: string;
  out: string;
  /** Utelämnas för enkel resa. */
  home?: string;
}

const iata = (c: string) => c.trim().toUpperCase();

export function googleFlights({ from, to, out, home }: FlightSearch): string {
  const q = `Flights to ${iata(to)} from ${iata(from)} on ${out}${home ? ` through ${home}` : ''}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=sv&curr=SEK`;
}

const yymmdd = (d: string) => d.slice(2).replace(/-/g, '');

export function skyscanner({ from, to, out, home }: FlightSearch): string {
  const path = [iata(from).toLowerCase(), iata(to).toLowerCase(), yymmdd(out), home ? yymmdd(home) : null].filter(Boolean).join('/');
  return `https://www.skyscanner.se/transport/flights/${path}/?adultsv2=1&currency=SEK`;
}

export type StayType = 'hotell' | 'hostel' | 'lagenhet' | 'alla';

export interface StaySearch {
  /** Ort eller område att söka på. */
  place: string;
  checkin: string;
  checkout: string;
  adults: number;
  rooms: number;
  /** Högsta pris per natt i kronor. */
  maxPrice?: number;
  type?: StayType;
}

/** Bookings filter för boendetyp (ht_id). */
const BOOKING_TYPE: Record<Exclude<StayType, 'alla'>, number> = { hotell: 204, hostel: 203, lagenhet: 201 };

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

export function booking({ place, checkin, checkout, adults, rooms, maxPrice, type = 'alla' }: StaySearch): string {
  const p = new URLSearchParams({
    ss: place,
    checkin,
    checkout,
    group_adults: String(clampInt(adults, 1, 30)),
    no_rooms: String(clampInt(rooms, 1, 30)),
    group_children: '0',
    selected_currency: 'SEK',
  });
  const filters: string[] = [];
  if (maxPrice && maxPrice > 0) filters.push(`price=SEK-min-${Math.round(maxPrice)}-1`);
  if (type !== 'alla') filters.push(`ht_id=${BOOKING_TYPE[type]}`);
  if (filters.length) p.set('nflt', filters.join(';'));
  return `https://www.booking.com/searchresults.sv.html?${p.toString()}`;
}

/** Airbnb har inte hotell och hostel på samma sätt: används för lägenheter och alla typer. */
export const airbnbFits = (type: StayType) => type === 'lagenhet' || type === 'alla';

export function airbnb({ place, checkin, checkout, adults, maxPrice }: Omit<StaySearch, 'rooms' | 'type'>): string {
  const p = new URLSearchParams({ checkin, checkout, adults: String(clampInt(adults, 1, 16)), currency: 'SEK' });
  if (maxPrice && maxPrice > 0) p.set('price_max', String(Math.round(maxPrice)));
  return `https://www.airbnb.se/s/${encodeURIComponent(place)}/homes?${p.toString()}`;
}

/** Google Maps-sökning på en plats. Med koordinater hamnar sökningen rätt även för vanliga namn. */
export function googleMaps(query: string, lat?: number | null, lon?: number | null): string {
  const q = lat != null && lon != null ? `${query} ${lat},${lon}` : query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
