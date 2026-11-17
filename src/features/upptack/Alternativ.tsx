// Alternativ till en plats (places.data.alternatives, från content/_upptack.json). Samma rader i rutan på
// platsens sida och under länken upptack.alt.till på korten i Upptäck. Varje rad öppnar alternativet.
import { Link } from 'react-router-dom';
import { Flag } from '../../components/Flag';
import { Icon } from '../../components/Icon';
import { PriceLevel } from '../../components/PriceLevel';
import { placeName, type Place } from '../../lib/content';
import { altHeadingKey, alternativeRows, type AltRow } from '../../lib/upptack';
import { useT } from '../../lib/useT';

export function AltRows({ rows, places, id }: { rows: AltRow[]; places: Place[]; id?: string }) {
  const t = useT();
  return (
    <ul className="alt-list" id={id}>
      {rows.map((r) => (
        <li key={r.id}>
          <Link className="li alt-row" to={`/karta/${r.id}`}>
            <Flag placeId={r.country} />
            <span className="t">
              <b>{r.name}</b>
              <span className="mu">{placeName(places, r.country)}</span>
              <span>{r.why}</span>
            </span>
            {r.level != null && (
              <span className="alt-level">
                <PriceLevel level={r.level} small ariaKey="upptack.kort.pris.aria" />
                <span className="mu fine">{t(`upptack.pris.${r.level}`)}</span>
              </span>
            )}
            <span className="chev">
              <Icon name="chev" size={18} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Rutan på platsens sida. Visas bara när platsen har alternativ som finns i places. */
export function AltBox({ place, places }: { place: Place; places: Place[] }) {
  const t = useT();
  const rows = alternativeRows(place, places);
  if (!rows.length) return null;
  return (
    <section className="col alt-box" aria-labelledby="alt-rubrik">
      <h2 className="eb" id="alt-rubrik">
        {t(altHeadingKey(place.data.alternatives ?? []))}
      </h2>
      <AltRows rows={rows} places={places} />
    </section>
  );
}
