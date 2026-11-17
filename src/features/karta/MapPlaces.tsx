// Förklaringen till färgerna och listan Platser (Körning 16). Visas intill kartan, i kolumnen till höger från
// 900 px och i helskärmspanelen. Listan är grupperad per världsdel, med städerna under sitt land.
import { useId, useState } from 'react';
import { Flag } from '../../components/Flag';
import { Icon } from '../../components/Icon';
import { PriceLevel } from '../../components/PriceLevel';
import { Row } from '../../components/Row';
import type { HideKey } from '../../config';
import { countKey, type ListContinent, type ListCountry } from '../../lib/mapList';
import type { MapKey } from '../../lib/togetherLogic';
import { useT } from '../../lib/useT';

/** En rad i förklaringen: färgnyckel och text. */
export type LegendRow = { key: MapKey; label: string };

export function Legend({ rows, colors, id }: { rows: LegendRow[]; colors: Record<string, string>; id: string }) {
  const t = useT();
  return (
    <section className="col legend" aria-labelledby={id}>
      <h2 className="eb" id={id}>
        {t('karta.forklaring.rubrik')}
      </h2>
      <div className="lg">
        {rows.map((r) => (
          <span key={r.key}>
            <i style={{ background: colors[r.key] }} />
            {r.label}
          </span>
        ))}
      </div>
    </section>
  );
}

interface PlacesProps {
  groups: ListContinent[];
  legend: LegendRow[];
  colors: Record<string, string>;
  hidden: HideKey[];
  onToggle: (key: MapKey) => void;
  /** Statusens text för en färgnyckel. */
  label: (key: MapKey) => string;
  /** Prisnivån för en stad, om den har en. */
  level: (id: string) => number | null;
  /** Inga markerade platser alls (före filtret). Då visas karta.tom i stället. */
  empty: boolean;
  /** Listans data är hämtad. */
  loaded: boolean;
}

export function MapPlaces({ groups, legend, colors, hidden, onToggle, label, level, empty, loaded }: PlacesProps) {
  const t = useT();
  const id = useId();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const flip = (set: Set<string>, k: string) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  };

  const country = (c: ListCountry) => {
    const n = c.children.length;
    const expanded = open.has(c.id);
    const cid = `${id}-${c.id}`;
    return (
      <li key={c.id} className="pl-country">
        <div className="pl-row">
          <Row
            to={`/karta/${c.id}`}
            title={c.name}
            sub={c.key ? label(c.key) : undefined}
            lead={<Flag placeId={c.id} ring={c.key ? colors[c.key] : undefined} />}
          />
          {n > 0 && (
            <button
              type="button"
              className="chip pl-fold"
              aria-expanded={expanded}
              aria-controls={cid}
              onClick={() => setOpen((s) => flip(s, c.id))}
            >
              {/* Namnet är karta.lista.falla-ut (eller falla-in) följt av den synliga texten (WCAG 2.5.3). */}
              <span className="sr-only">{t(expanded ? 'karta.lista.falla-in' : 'karta.lista.falla-ut', { plats: c.name })} </span>
              <span>{t(countKey(n, 'karta.lista.stader.en', 'karta.lista.stader'), { antal: n })}</span>
              <Icon name="down" size={16} />
            </button>
          )}
        </div>
        {n > 0 && expanded && (
          <ul className="pl-cities" id={cid}>
            {c.children.map((p) => {
              const lv = level(p.id);
              return (
                <li key={p.id}>
                  <Row
                    to={`/karta/${p.id}`}
                    title={p.name}
                    sub={label(p.key)}
                    lead={<Flag placeId={p.id} ring={colors[p.key]} />}
                    meta={lv ? <PriceLevel level={lv} small /> : undefined}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="col pl" aria-labelledby={`${id}-h`}>
      <h2 className="eb" id={`${id}-h`}>
        {t('karta.lista.rubrik')}
      </h2>
      <div className="chips pl-show" role="group" aria-label={t('karta.lista.visa.aria')}>
        {legend.map((r) => (
          <button key={r.key} type="button" className="chip" aria-pressed={!hidden.includes(r.key as HideKey)} onClick={() => onToggle(r.key)}>
            <i className="dot" style={{ background: colors[r.key] }} aria-hidden="true" />
            {r.label}
          </button>
        ))}
      </div>
      {loaded && empty && (
        <div className="card soft">
          <p>{t('karta.tom')}</p>
        </div>
      )}
      {loaded && !empty && !groups.length && (
        <p className="mu" role="status">
          {t('karta.lista.tom')}
        </p>
      )}
      {groups.map((g) => {
        const shut = closed.has(g.code);
        const gid = `${id}-${g.code}`;
        const n = g.countries.length;
        return (
          <section key={g.code} className="pl-cont" aria-labelledby={`${gid}-h`}>
            <h3 className="pl-cont-h" id={`${gid}-h`}>
              <button type="button" className="pl-cont-btn" aria-expanded={!shut} aria-controls={gid} onClick={() => setClosed((s) => flip(s, g.code))}>
                <span>{g.name}</span>
                <span className="mu">{t(countKey(n, 'karta.lista.lander.en', 'karta.lista.lander'), { antal: n })}</span>
                <Icon name="down" size={18} />
              </button>
            </h3>
            {!shut && (
              <ul className="pl-list" id={gid}>
                {g.countries.map(country)}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
