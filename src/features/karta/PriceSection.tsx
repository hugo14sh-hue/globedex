// Prisnivå på stads- och landssidan (places.data.prices). Visas bara när platsen har prices.
// Belopp i lokal valuta och i kronor efter content/_valutor.json. Ingen egen text: allt kommer från t() eller innehållet.
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PriceLevel } from '../../components/PriceLevel';
import { Row } from '../../components/Row';
import type { Place } from '../../lib/content';
import { domainOf, formatKr, formatMoney, hasRange, priceView, RATES, rateFor, rowSek, type Prices } from '../../lib/prices';
import { useT } from '../../lib/useT';
import { formatDate } from './format';

/** Ankaret på sidan som raderna under pris.stader.rubrik länkar till. */
export const PRICE_ANCHOR = 'pris';

export function PriceSection({ prices }: { prices: Prices }) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const { hash } = useLocation();
  const cur = prices.currency;
  const rate = rateFor(cur);

  // Kommer man från en länk till sektionen rullas den fram.
  useEffect(() => {
    if (hash === `#${PRICE_ANCHOR}`) ref.current?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <section ref={ref} id={PRICE_ANCHOR} className="col prices" aria-labelledby="pris-rubrik">
      <h2 className="eb" id="pris-rubrik">
        {t('pris.rubrik')}
      </h2>
      <div className="card">
        <div className="plevel-row">
          <PriceLevel level={prices.level} />
          <b>{t(`pris.niva.${prices.level}`)}</b>
        </div>
        {prices.summary && <span className="mu">{prices.summary}</span>}
      </div>

      {prices.rows.map((r) => {
        const sek = rowSek(r, cur);
        const range = hasRange(r);
        return (
          <div key={r.key} className="li price-row">
            <span className="t">
              <b>{t(`pris.rad.${r.key}`)}</b>
              {range && <span>{t('pris.spann', { fran: formatMoney(r.low!, cur), till: formatMoney(r.high!, cur) })}</span>}
              {r.typical != null &&
                (range ? (
                  <span className="mu">
                    {t('pris.vanligast')} {formatMoney(r.typical, cur)}
                  </span>
                ) : (
                  <span>{formatMoney(r.typical, cur)}</span>
                ))}
              {r.note && <span className="mu fine">{r.note}</span>}
            </span>
            {sek != null && <span className="price-sek">{t('pris.i-kronor', { belopp: formatKr(sek) })}</span>}
          </div>
        );
      })}

      {prices.tips && prices.tips.length > 0 && (
        <div className="card soft">
          <h3 className="h3">{t('pris.tips.rubrik')}</h3>
          <ul className="price-tips">
            {prices.tips.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mu fine price-foot">
        <p>{t('pris.kontrollerat', { datum: formatDate(prices.checked) })}</p>
        {rate != null && cur !== 'SEK' && <p>{t('pris.kurs', { valuta: cur, kurs: rate, datum: formatDate(RATES.checked) })}</p>}
        {prices.own_judgment?.includes('level') && <p>{t('pris.egen-bedomning')}</p>}
        {prices.sources.length > 0 && (
          <>
            <h3 className="eb">{t('pris.kallor')}</h3>
            <ul className="src price-src">
              {prices.sources.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer">
                    {domainOf(u)}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Prissektionen för en plats: platsens egna priser när de finns. Ett land utan egna priser visar en
 * rad per stad som har priser, som länk till stadens sektion. Annars visas ingenting.
 */
export function PlacePrices({ place, cities }: { place: Place; cities: Place[] }) {
  const t = useT();
  const view = priceView(place, cities);
  if (!view) return null;
  if ('own' in view) return <PriceSection prices={view.own} />;
  return (
    <section className="col">
      <h2 className="eb">{t('pris.stader.rubrik')}</h2>
      {view.cities.map(({ place: c, prices: p }) => (
        <Row key={c.id} to={`/karta/${c.id}#${PRICE_ANCHOR}`} icon="pin" title={c.name} meta={<PriceLevel level={p.level} />} />
      ))}
    </section>
  );
}
