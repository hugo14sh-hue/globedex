// Upptäck: platser att filtrera på prisnivå, månad, klimat, typ, världsdel och land, och spara som Vill åka.
// Platserna är lätta platser och befintliga städer med klimat och taggar (src/lib/upptack.ts).
// Valda filter och sorteringen står i adressen (query-parametrar), så att en filtrering går att dela
// och ligger kvar när man backar från en plats.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { climates as CLIMATES, tags as TAGS } from '../../../content/_upptack.json';
import { useFeedback } from '../../components/Feedback';
import { Flag } from '../../components/Flag';
import { Icon } from '../../components/Icon';
import { Ingress } from '../../components/Ingress';
import { Loading } from '../../components/Loading';
import { PriceLevel } from '../../components/PriceLevel';
import { Segment } from '../../components/Segment';
import { fetchPlaces, placeName, type Place } from '../../lib/content';
import { continentLabel } from '../../lib/continentNames';
import { LOCALE } from '../../lib/locale';
import { countryOptions } from '../../lib/mapFocus';
import { useSession } from '../../lib/session';
import { setPlaceStatus, STATUS_KEY, useMyPlaces, type PlaceStatus } from '../../lib/status';
import {
  alternativeRows,
  applyFilter,
  COUNTRY_SEARCH_FROM,
  discoverEntries,
  filterCount,
  filterOptions,
  fromParams,
  monthList,
  nextCount,
  NO_FILTER,
  PAGE_SIZE,
  showsAltLink,
  sortEntries,
  SORTS,
  toggleIn,
  toParams,
  visibleEntries,
  type DiscoverEntry,
  type DiscoverFilter,
  type DiscoverSort,
} from '../../lib/upptack';
import { useMedia, WIDE } from '../../lib/useMedia';
import { useT } from '../../lib/useT';
import { monthNames, shortMonthNames } from '../karta/months';
import { AltRows } from './Alternativ';

const ALLOWED = { tags: TAGS, climates: CLIMATES };
const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

export default function UpptackScreen() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const { session } = useSession();
  const mine = useMyPlaces(session?.user.id ?? null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Från 900 px står filtren alltid synliga i kolumnen till vänster.
  const wide = useMedia(WIDE);

  useEffect(() => {
    let alive = true;
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => {
        if (!alive) return;
        setPlaces([]);
        setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const { filter, sort } = useMemo(() => fromParams(params, ALLOWED), [params]);
  // Filtren byts med replace: varje tryck blir inte ett eget steg bakåt, men filtreringen står kvar i adressen.
  const update = (f: DiscoverFilter, s: DiscoverSort = sort) => setParams(toParams(f, s), { replace: true });
  const set = (patch: Partial<DiscoverFilter>) => update({ ...filter, ...patch });

  const entries = useMemo(() => (places ? discoverEntries(places) : []), [places]);
  const options = useMemo(() => filterOptions(entries), [entries]);
  const shown = useMemo(
    () => sortEntries(applyFilter(entries, filter, mine.statuses), sort, LOCALE),
    [entries, filter, mine.statuses, sort],
  );
  const months = useMemo(() => monthNames(), []);
  const short = useMemo(() => shortMonthNames(), []);
  const active = filterCount(filter);

  // Länderna i filtret. Fler än COUNTRY_SEARCH_FROM: sökfältet från kartans fokusval (Körning 18). Det valda
  // landet står kvar i listan även när det inte matchar sökningen.
  const [countryQuery, setCountryQuery] = useState('');
  const searchCountries = options.countries.length > COUNTRY_SEARCH_FROM;
  const countries = useMemo(() => {
    const nameOf = (c: string) => (places ? placeName(places, c) : c);
    const list = countryOptions(options.countries, nameOf, LOCALE, searchCountries ? countryQuery : '').map((o) => o.value);
    return filter.country && options.countries.includes(filter.country) && !list.includes(filter.country) ? [filter.country, ...list] : list;
  }, [places, options.countries, searchCountries, countryQuery, filter.country]);

  // De första PAGE_SIZE korten, och PAGE_SIZE till när man rullar ned till slutet (Körning 18). Börjar om
  // när filtren eller sorteringen ändras. Antalet i upptack.antal räknas på hela listan.
  const pageKey = params.toString();
  const [paging, setPaging] = useState({ key: pageKey, count: PAGE_SIZE });
  const count = paging.key === pageKey ? paging.count : PAGE_SIZE;
  const visible = useMemo(() => visibleEntries(shown, count), [shown, count]);
  const more = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = more.current;
    if (!el || count >= shown.length) return;
    const load = () => setPaging({ key: pageKey, count: nextCount(count, shown.length) });
    // Utan IntersectionObserver visas resten direkt.
    if (typeof IntersectionObserver === 'undefined') return load();
    const io = new IntersectionObserver((list) => list.some((e) => e.isIntersecting) && load(), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [count, shown.length, pageKey]);

  if (!places) return <Loading />;

  return (
    <main className="scr wide">
      <h1>{t('flik.upptack')}</h1>
      <Ingress k="ingress.upptack" />

      {/* Från 900 px (Körning 17): filtren i en kolumn till vänster som följer med, korten i ett rutnät till höger. */}
      <div className="disc-layout">
      <section className="col disc-filter" aria-labelledby={wide ? `${panelId}-h` : undefined}>
        <div className="row">
          {wide ? (
            <h2 className="eb" id={`${panelId}-h`}>
              {t('upptack.filter.rubrik')}
            </h2>
          ) : (
            <button type="button" className="chip" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
              <Icon name="filter" size={18} />
              {t('upptack.filter.rubrik')}
              {active > 0 && <span className="disc-cnt">{active}</span>}
            </button>
          )}
          {active > 0 && (
            <button type="button" className="chip" onClick={() => update(NO_FILTER)}>
              {t('upptack.filter.rensa')}
            </button>
          )}
        </div>

        <div id={panelId} className="col disc-panel" hidden={!open && !wide}>
          <ChipGroup legend={t('upptack.filter.pris')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className="chip" aria-pressed={filter.prices.includes(n)} onClick={() => set({ prices: toggleIn(filter.prices, n) })}>
                {t(`upptack.pris.${n}`)}
              </button>
            ))}
          </ChipGroup>

          <ChipGroup legend={t('upptack.filter.manad')}>
            <button type="button" className="chip" aria-pressed={!filter.month} onClick={() => set({ month: null })}>
              {t('upptack.filter.manad.alla')}
            </button>
            {months.map((m, i) => (
              <button key={i} type="button" className="chip" aria-pressed={filter.month === i + 1} onClick={() => set({ month: filter.month === i + 1 ? null : i + 1 })}>
                {capital(m.long)}
              </button>
            ))}
          </ChipGroup>

          <ChipGroup legend={t('upptack.filter.klimat')}>
            {CLIMATES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={filter.climates.includes(c)} onClick={() => set({ climates: toggleIn(filter.climates, c) })}>
                {t(`upptack.klimat.${c}`)}
              </button>
            ))}
          </ChipGroup>

          <ChipGroup legend={t('upptack.filter.typ')}>
            {TAGS.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={filter.tags.includes(c)} onClick={() => set({ tags: toggleIn(filter.tags, c) })}>
                {t(`upptack.tagg.${c}`)}
              </button>
            ))}
          </ChipGroup>

          {options.continents.length > 0 && (
            <ChipGroup legend={t('upptack.filter.kontinent')}>
              {options.continents.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={filter.continent === c} onClick={() => set({ continent: filter.continent === c ? null : c })}>
                  {continentLabel(c, t)}
                </button>
              ))}
            </ChipGroup>
          )}

          {options.countries.length > 0 && (
            <ChipGroup
              legend={t('upptack.filter.land')}
              search={
                searchCountries && (
                  <>
                    <label className="sr-only" htmlFor={`${panelId}-sok`}>
                      {t('karta.fokus.sok')}
                    </label>
                    <input
                      id={`${panelId}-sok`}
                      className="focus-search"
                      type="search"
                      autoComplete="off"
                      placeholder={t('karta.fokus.sok')}
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                    />
                  </>
                )
              }
            >
              {countries.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={filter.country === c} onClick={() => set({ country: filter.country === c ? null : c })}>
                  {placeName(places, c)}
                </button>
              ))}
              {countries.length === 0 && (
                <p className="mu" role="status">
                  {t('karta.fokus.inga')}
                </p>
              )}
            </ChipGroup>
          )}

          <label className="check">
            <input type="checkbox" checked={filter.gem} onChange={(e) => set({ gem: e.target.checked })} />
            {t('upptack.filter.smultron')}
          </label>
          <label className="check">
            <input type="checkbox" checked={filter.unvisited} onChange={(e) => set({ unvisited: e.target.checked })} />
            {t('upptack.filter.obesokt')}
          </label>

          <button type="button" className="btn ghost" disabled={active === 0} onClick={() => update(NO_FILTER)}>
            {t('upptack.filter.rensa')}
          </button>
        </div>
      </section>

      <div className="disc-main">
      <Segment<DiscoverSort>
        label={t('upptack.sortera')}
        value={sort}
        onChange={(s) => update(filter, s)}
        options={SORTS.map((s) => ({ value: s, label: t(`upptack.sortera.${s}`) }))}
      />

      <p className="mu disc-count" role="status" aria-live="polite">
        {shown.length === 1 ? t('upptack.antal.en') : t('upptack.antal', { antal: shown.length })}
      </p>

      {failed && (
        <div className="card soft" role="alert">
          <p>{t('allmant.fel')}</p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card soft">
          <p>{t('upptack.tom')}</p>
        </div>
      ) : (
        <>
          <ul className="disc-list">
            {visible.map((e) => (
              <li key={e.id}>
                <DiscoverCard entry={e} places={places} status={mine.statuses[e.id]} short={short} />
              </li>
            ))}
          </ul>
          {count < shown.length && <div ref={more} className="disc-more" aria-hidden="true" />}
        </>
      )}
      </div>
      </div>

      <p className="mu fine">{t('upptack.kalla')}</p>
    </main>
  );
}

function ChipGroup({ legend, search, children }: { legend: string; search?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="col">
      <legend className="eb">{legend}</legend>
      {search}
      <div className="chips">{children}</div>
    </fieldset>
  );
}

function DiscoverCard({
  entry: e,
  places,
  status,
  short,
}: {
  entry: DiscoverEntry;
  places: Place[];
  status: PlaceStatus | undefined;
  short: string[];
}) {
  const t = useT();
  const { toast } = useFeedback();
  const [altOpen, setAltOpen] = useState(false);
  const altId = useId();
  const country = placeName(places, e.country);
  const alts = showsAltLink(e) ? alternativeRows(places.find((p) => p.id === e.id)!, places) : [];

  const save = async () => {
    try {
      await setPlaceStatus(e.id, 'vill');
      toast(t('karta.status-satt', { plats: e.name, status: t(STATUS_KEY.vill) }));
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  return (
    <article className="card disc-card">
      <div className="disc-head">
        <Flag placeId={e.country} />
        <span className="t">
          <h2 className="h3">
            <Link className="disc-open" to={`/karta/${e.id}`} aria-label={t('upptack.kort.oppna', { plats: e.name })}>
              {e.name}
            </Link>
          </h2>
          <span className="mu">{country}</span>
        </span>
        {e.gem && <span className="chip soft tag">{t('upptack.kort.smultron')}</span>}
      </div>

      {e.level != null && (
        <div className="plevel-row">
          <PriceLevel level={e.level} ariaKey="upptack.kort.pris.aria" />
          <b>{t(`upptack.pris.${e.level}`)}</b>
        </div>
      )}
      {e.why && <p>{e.why}</p>}
      {e.months.length > 0 && <p className="mu">{t('upptack.kort.basta', { manad: monthList(e.months, short) })}</p>}
      {e.tags.length > 0 && (
        <div className="chips">
          {e.tags.map((x) => (
            <span key={x} className="chip soft tag">
              {t(`upptack.tagg.${x}`)}
            </span>
          ))}
        </div>
      )}

      <div className="disc-actions">
        {!status ? (
          <button type="button" className="chip" onClick={save}>
            <i className="dot" style={{ background: 'var(--st-vill)' }} aria-hidden="true" />
            {t('upptack.kort.vill')}
          </button>
        ) : (
          <span className="chip soft tag">
            <i className="dot" style={{ background: `var(--st-${status})` }} aria-hidden="true" />
            {status === 'vill' ? t('upptack.kort.sparad') : t(STATUS_KEY[status])}
          </span>
        )}
        {alts.length > 0 && (
          <button type="button" className="link-btn" aria-expanded={altOpen} aria-controls={altId} onClick={() => setAltOpen((o) => !o)}>
            {t('upptack.alt.till', { plats: e.name })}
            <Icon name="chev" size={16} />
          </button>
        )}
      </div>
      {alts.length > 0 && (
        <div id={altId} hidden={!altOpen}>
          <AltRows rows={alts} places={places} />
        </div>
      )}
    </article>
  );
}
