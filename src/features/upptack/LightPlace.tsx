// Sidan för en lätt plats (data.light, från content/_upptack.json): ingen kompendium, inga saker och inga
// priser. Visar varför, prisnivån, bästa månader, taggarna, alternativen och källraderna, och bara de delar
// som har innehåll. Namn, land och statusval står ovanför, i PlaceScreen.
import { Estimate } from '../../components/Estimate';
import { PriceLevel } from '../../components/PriceLevel';
import { Row } from '../../components/Row';
import { isEstimate, placeName, type Place } from '../../lib/content';
import { indexLine, monthList } from '../../lib/upptack';
import { useT } from '../../lib/useT';
import { shortMonthNames } from '../karta/months';
import { parentOf } from '../../lib/delade';
import { AltBox } from './Alternativ';

/** Året för Post Office City Costs Barometer (upptack.barometer). */
const BAROMETER_YEAR = 2026;

export function LightPlace({ place, places }: { place: Place; places: Place[] }) {
  const t = useT();
  const d = place.data;
  const short = shortMonthNames();
  const months = (d.best_months ?? []).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  const tags = d.tags ?? [];
  const country = place.parent_id ?? place.id.slice(0, 2);
  const level = typeof d.level === 'number' && d.level >= 1 && d.level <= 5 ? d.level : null;
  // Källraden för prisnivån: Eurostat (upptack.index) eller Världsbanken för basis icp (upptack.index.varlden).
  const index = indexLine(d, placeName(places, country));
  const sources = [
    index ? t(index.key, index.values) : null,
    d.level_note ?? null,
    typeof d.citybreak_gbp === 'number' ? t('upptack.barometer', { belopp: d.citybreak_gbp, ar: BAROMETER_YEAR }) : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <>
      {d.why && (
        <div className="card soft">
          <div className="row">
            <span>{d.why}</span>
            {isEstimate(d, 'why') && <Estimate />}
          </div>
        </div>
      )}

      <div className="card col light-facts">
        {level != null && (
          <div className="plevel-row">
            <PriceLevel level={level} ariaKey="upptack.kort.pris.aria" />
            <b>{t(`upptack.pris.${level}`)}</b>
            {isEstimate(d, 'level') && <Estimate />}
          </div>
        )}
        {months.length > 0 && (
          <div className="row">
            <span>{t('upptack.kort.basta', { manad: monthList(months, short) })}</span>
            {isEstimate(d, 'best_months') && <Estimate />}
          </div>
        )}
        {tags.length > 0 && (
          <div className="chips">
            {tags.map((x) => (
              <span key={x} className="chip soft tag">
                {t(`upptack.tagg.${x}`)}
              </span>
            ))}
            {isEstimate(d, 'tags') && <Estimate />}
          </div>
        )}
      </div>

      <AltBox place={place} places={places} />

      {sources.length > 0 && (
        <div className="mu fine col light-src">
          {sources.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
      )}
    </>
  );
}

/** Städerna under ett lätt land (ett land som bara finns för att Upptäcks platser ska ha ett land). */
export function LightCities({ countryId, places }: { countryId: string; places: Place[] }) {
  const t = useT();
  const cities = places.filter((p) => parentOf(p) === countryId && p.kind === 'city');
  if (!cities.length) return null;
  return (
    <section className="col">
      <h2 className="eb">{t('land.platser')}</h2>
      {cities.map((c) => (
        <Row key={c.id} to={`/karta/${c.id}`} icon="pin" title={c.name} meta={typeof c.data.level === 'number' ? <PriceLevel level={c.data.level} small ariaKey="upptack.kort.pris.aria" /> : undefined} />
      ))}
    </section>
  );
}
