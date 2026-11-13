import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { HOME_AIRPORTS } from '../../config';
import type { Place } from '../../lib/content';
import { canInvite } from '../../lib/groups';
import { airbnb, airbnbFits, booking, googleFlights, googleMaps, skyscanner, validRange, type StayType } from '../../lib/links';
import { useSession } from '../../lib/session';
import { useT } from '../../lib/useT';

const STAY_TYPES: StayType[] = ['hotell', 'hostel', 'lagenhet', 'alla'];
const MAX_PRICES = [500, 800, 1000, 1500, 2000, 3000];

/** Boka: länkar ut till flyg, boende och karta med valen ifyllda. Ingen sökning inne i appen. */
export function BokaView({ place, country }: { place: Place; country: Place | null }) {
  const t = useT();
  const { activeGroup, members } = useSession();
  const [from, setFrom] = useState<string>(HOME_AIRPORTS[0]);
  const [out, setOut] = useState('');
  const [home, setHome] = useState('');
  const [type, setType] = useState<StayType>('hotell');
  const [maxPrice, setMaxPrice] = useState(1500);
  const [rooms, setRooms] = useState(1);
  // Gäster: alla i par- eller gruppytan, annars en.
  const adults = canInvite(activeGroup) ? Math.max(1, members.length) : 1;
  const to = place.airport ?? country?.airport ?? null;
  const datesOk = validRange(out, home) && Boolean(home);

  return (
    <>
      {to && (
        <div className="card">
          <h2 className="h3">{t('boka.flyg.rubrik')}</h2>
          <label>
            {t('boka.fran')}
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {HOME_AIRPORTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <div className="g2">
            <label>
              {t('boka.ut')}
              <input type="date" value={out} onChange={(e) => setOut(e.target.value)} />
            </label>
            <label>
              {t('boka.hem')}
              <input type="date" value={home} min={out || undefined} onChange={(e) => setHome(e.target.value)} />
            </label>
          </div>
          {datesOk ? (
            <>
              <a className="btn" href={googleFlights({ from, to, out, home })} target="_blank" rel="noopener noreferrer">
                Google Flights
              </a>
              <a className="btn ghost" href={skyscanner({ from, to, out, home })} target="_blank" rel="noopener noreferrer">
                Skyscanner
              </a>
              <span className="mu">{t('resor.lankar-ut', { tjanst: 'Google Flights, Skyscanner' })}</span>
            </>
          ) : (
            <span className="mu">{t('boka.valj-datum')}</span>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="h3">{t('boka.boende.rubrik', { plats: place.name })}</h2>
        {!to && (
          <div className="g2">
            <label>
              {t('boka.ut')}
              <input type="date" value={out} onChange={(e) => setOut(e.target.value)} />
            </label>
            <label>
              {t('boka.hem')}
              <input type="date" value={home} min={out || undefined} onChange={(e) => setHome(e.target.value)} />
            </label>
          </div>
        )}
        <label>
          {t('boka.typ')}
          <select value={type} onChange={(e) => setType(e.target.value as StayType)}>
            {STAY_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`boka.typ.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="g2">
          <label>
            {t('boka.maxpris')}
            <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
              {MAX_PRICES.map((v) => (
                <option key={v} value={v}>
                  {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('boka.rum')}
            <select value={rooms} onChange={(e) => setRooms(Number(e.target.value))}>
              {[1, 2, 3, 4].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        {datesOk ? (
          <>
            <a
              className="btn"
              href={booking({ place: place.name, checkin: out, checkout: home, adults, rooms, maxPrice, type })}
              target="_blank"
              rel="noopener noreferrer"
            >
              Booking.com
            </a>
            {airbnbFits(type) && (
              <a
                className="btn ghost"
                href={airbnb({ place: place.name, checkin: out, checkout: home, adults, maxPrice })}
                target="_blank"
                rel="noopener noreferrer"
              >
                Airbnb
              </a>
            )}
            <span className="mu">{t('resor.lankar-ut', { tjanst: airbnbFits(type) ? 'Booking.com, Airbnb' : 'Booking.com' })}</span>
          </>
        ) : (
          <span className="mu">{t('boka.valj-datum')}</span>
        )}
      </div>

      <a className="btn ghost" href={googleMaps(place.name, place.lat, place.lon)} target="_blank" rel="noopener noreferrer">
        <Icon name="pin" size={20} />
        {t('knapp.oppna-karta')}
      </a>
    </>
  );
}
