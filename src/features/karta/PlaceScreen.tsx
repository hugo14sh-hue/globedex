// Landssida och stadssida: Översikt, Lista, Guide, Månad, Boka och Köp med hem (som i prototypen).
// Allt innehåll kommer från databasen. Saknas innehåll visas land.saknar-innehall och status fungerar ändå.
import { BackLink } from '../../components/BackLink';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BottomSheet } from '../../components/BottomSheet';
import { Estimate } from '../../components/Estimate';
import { useFeedback } from '../../components/Feedback';
import { Flag } from '../../components/Flag';
import { Icon } from '../../components/Icon';
import { ItemImage, ItemThumb } from '../../components/ItemImage';
import { Loading } from '../../components/Loading';
import { PriceLevel } from '../../components/PriceLevel';
import { Row } from '../../components/Row';
import { Segment } from '../../components/Segment';
import {
  countryOf,
  descendants,
  fetchCompendium,
  fetchFacts,
  fetchGifts,
  fetchItems,
  fetchPlaces,
  isEstimate,
  placeName,
  type GiftTip,
  type Place,
  type PlaceFact,
  type PlaceItem,
} from '../../lib/content';
import { googleMaps } from '../../lib/links';
import { pricesOf } from '../../lib/prices';
import { useSession } from '../../lib/session';
import { CollectionMotifs } from '../listor/Samlingar';
import { AddGift, useTripsTo } from '../resor/InkopScreen';
import { useFindFeedback } from '../listor/useFindFeedback';
import { setItemCheck, STATUS_KEY, useMyPlaces } from '../../lib/status';
import { useT } from '../../lib/useT';
import { useVault } from '../../lib/vault';
import { ageOn, birthDate, rulesForAge } from '../../lib/vaultLogic';
import { todayIso } from '../../lib/tripLogic';
import { SMART_COLORS } from '../../theme/palettes';
import { statusColors } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { BokaView } from './BokaView';
import { PlacePrices } from './PriceSection';
import { monthNames } from './months';
import { StatusPicker } from './StatusPicker';
import { formatDate, formatDateRange, formatPercent, formatSek } from './format';
import { domainOf } from '../../lib/prices';
import { currentMonth, eventsInMonth, hasMonthNotes } from '../../lib/smartMonth';

/** Första bokstaven versal (månadens namn från webbläsaren börjar med gemen på svenska). */
const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

type View = 'oversikt' | 'lista' | 'guide' | 'manad' | 'boka' | 'kop';
const TABS: View[] = ['oversikt', 'lista', 'guide', 'manad', 'boka'];
const VIEW_KEY: Record<View, string> = {
  oversikt: 'land.vy.oversikt',
  lista: 'land.vy.lista',
  guide: 'land.vy.guide',
  manad: 'land.vy.manad',
  boka: 'land.vy.boka',
  kop: 'land.vy.kop',
};
const isView = (v: string | null): v is View => Boolean(v && v in VIEW_KEY);

interface Loaded {
  facts: PlaceFact[];
  items: PlaceItem[];
  gifts: GiftTip[];
}

function Source({ url, date }: { url?: string | null; date?: string | null }) {
  const t = useT();
  if (!url && !date) return null;
  return (
    <span className="src mu">
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {t('knapp.kalla')}
        </a>
      )}
      {date && <span>{t('knapp.kontrollerad', { datum: formatDate(date) })}</span>}
    </span>
  );
}

export default function PlaceScreen() {
  const t = useT();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { session } = useSession();
  const mine = useMyPlaces(session?.user.id ?? null);
  const { theme } = useTheme();
  const { party, toast } = useFeedback();
  const announceFind = useFindFeedback();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [openItem, setOpenItem] = useState<PlaceItem | null>(null);
  const [openFact, setOpenFact] = useState<PlaceFact | null>(null);
  const vy = params.get('vy');
  const view: View = isView(vy) ? vy : 'oversikt';
  const setView = (v: View) => setParams(v === 'oversikt' ? {} : { vy: v }, { replace: true });

  useEffect(() => {
    let alive = true;
    fetchPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => alive && setPlaces([]));
    return () => {
      alive = false;
    };
  }, []);

  const place = places?.find((p) => p.id === id) ?? null;
  const subIds = useMemo(() => (places && place ? [place.id, ...descendants(places, place.id).map((p) => p.id)] : []), [places, place]);
  const subKey = subIds.join(',');

  useEffect(() => {
    if (!places) return;
    if (!subIds.length) {
      setLoaded({ facts: [], items: [], gifts: [] });
      return;
    }
    let alive = true;
    setLoaded(null);
    Promise.all([fetchFacts(subIds), fetchItems(subIds), fetchGifts(subIds)])
      .then(([facts, items, gifts]) => alive && setLoaded({ facts, items, gifts }))
      .catch(() => alive && setLoaded({ facts: [], items: [], gifts: [] }));
    return () => {
      alive = false;
    };
  }, [places, subKey]);

  if (!places || !loaded) return <Loading />;

  const knownCountry = /^[A-Z]{2}$/.test(id);
  if (!place && !knownCountry) {
    return (
      <main className="scr">
        <BackToMap />
        <div className="card soft">
          <p>{t('allmant.saknas')}</p>
        </div>
      </main>
    );
  }

  const name = placeName(places, id);
  const status = mine.statuses[id];
  const total = Object.keys(mine.statuses).length;
  const data = place?.data ?? {};
  const hasData = Object.keys(data).length > 0;
  const empty = !place || (!hasData && !loaded.facts.length && !loaded.items.length && !loaded.gifts.length);
  const parent = place?.parent_id ? places.find((p) => p.id === place.parent_id) : null;
  const items = loaded.items;
  const done = items.filter((i) => mine.checks.has(i.id)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const toggle = async (item: PlaceItem) => {
    const now = !mine.checks.has(item.id);
    try {
      // Har punkten ett compendium_id skapas fyndet i samma steg. Ett fynd som redan finns visas inte igen.
      const found = await setItemCheck(item, now);
      if (now && done + 1 === items.length) party(t('land.lista.klar', { plats: name }));
      else if (found) {
        const c = (await fetchCompendium().catch(() => [])).find((x) => x.id === found);
        if (c) announceFind(c);
      }
    } catch {
      toast(t('allmant.fel-spara'));
    }
  };

  return (
    <main className="scr">
      <BackToMap />
      <div className="hero">
        <div className="row">
          <div className="col" style={{ gap: 2 }}>
            <span className="sheet-title">
              <Flag placeId={id} ring={status ? statusColors(theme)[status] : undefined} />
              <h1>{name}</h1>
            </span>
            <span className="hero-sub">
              {t(STATUS_KEY[status ?? 'ej'])}
              {parent ? ` · ${parent.name}` : ''}
            </span>
          </div>
          {items.length > 0 && (
            <div className="ring" style={{ background: `conic-gradient(var(--a) ${pct * 3.6}deg, rgba(255,255,255,.25) 0)` }} aria-hidden="true">
              <span>{formatPercent(pct)}</span>
            </div>
          )}
        </div>
      </div>

      <StatusPicker placeId={id} name={name} current={status} total={total} label={name} />

      {empty ? (
        <div className="card soft">
          <p>{t('land.saknar-innehall', { plats: name })}</p>
        </div>
      ) : (
        <>
          <Segment<View>
            value={view === 'kop' ? 'oversikt' : view}
            onChange={setView}
            options={TABS.map((v) => ({ value: v, label: t(VIEW_KEY[v]) }))}
          />
          {view === 'kop' && (
            <button type="button" className="back" onClick={() => setView('oversikt')}>
              <Icon name="back" size={20} />
              {t('land.vy.oversikt')}
            </button>
          )}
          {view === 'oversikt' && (
            <Oversikt place={place!} places={places} items={items} checks={mine.checks} onItem={setOpenItem} onKop={() => setView('kop')} />
          )}
          {view === 'lista' && <Lista name={name} items={items} checks={mine.checks} onToggle={toggle} onItem={setOpenItem} />}
          {view === 'guide' && <Guide facts={loaded.facts} onFact={setOpenFact} places={places} placeId={id} />}
          {view === 'manad' && <Manad place={place!} />}
          {view === 'boka' && <BokaView place={place!} country={countryOf(places, place!.id)} />}
          {view === 'kop' && <Kop name={name} gifts={loaded.gifts} places={places} placeId={id} />}
          {view === 'kop' && <CollectionMotifs placeId={id} gifts={loaded.gifts} />}
        </>
      )}

      <BottomSheet open={Boolean(openItem)} title={openItem?.name ?? ''} onClose={() => setOpenItem(null)}>
        {openItem && (
          <>
            <ItemImage item={openItem} />
            {openItem.summary && <p className="mu">{openItem.summary}</p>}
            {openItem.body && <p>{openItem.body}</p>}
            <Source url={openItem.source_url} date={openItem.verified_on} />
            <button
              type="button"
              className={mine.checks.has(openItem.id) ? 'btn ghost' : 'btn'}
              aria-pressed={mine.checks.has(openItem.id)}
              onClick={() => toggle(openItem)}
            >
              <Icon name="check" size={20} />
              {t('knapp.klar')}
            </button>
            {openItem.lat != null && openItem.lon != null && (
              <a className="btn ghost" href={googleMaps(openItem.name, openItem.lat, openItem.lon)} target="_blank" rel="noopener noreferrer">
                <Icon name="pin" size={20} />
                {t('knapp.oppna-karta')}
              </a>
            )}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(openFact)} title={openFact?.title ?? ''} onClose={() => setOpenFact(null)}>
        {openFact && (
          <>
            {openFact.summary && <p className="mu">{openFact.summary}</p>}
            {openFact.body && <p>{openFact.body}</p>}
            <Source url={openFact.source_url} date={openFact.verified_on} />
            {openFact.is_rule && <p className="mu">{t('land.regler.ansvar')}</p>}
          </>
        )}
      </BottomSheet>
    </main>
  );
}

function BackToMap() {
  return <BackLink to="/karta" />;
}

function Oversikt({
  place,
  places,
  items,
  checks,
  onItem,
  onKop,
}: {
  place: Place;
  places: Place[];
  items: PlaceItem[];
  checks: Set<string>;
  onItem: (i: PlaceItem) => void;
  onKop: () => void;
}) {
  const t = useT();
  const d = place.data;
  const children = places.filter((p) => p.parent_id === place.id && (p.kind === 'city' || p.kind === 'spot'));
  // Städer som ligger under regioner (som i Sverige) visas också.
  const cities = [...children, ...descendants(places, place.id).filter((p) => p.kind === 'city' && !children.includes(p))];
  const must = items.filter((i) => i.must_rank != null).sort((a, b) => (a.must_rank ?? 0) - (b.must_rank ?? 0));
  const stayHere = d.areas?.filter((a) => a.stay) ?? [];
  const avoid = d.areas?.filter((a) => !a.stay) ?? [];

  return (
    <>
      {cities.length > 0 && (
        <section className="col">
          <h2 className="eb">{t('land.platser')}</h2>
          {cities.map((c) => {
            const p = pricesOf(c.data);
            return <Row key={c.id} to={`/karta/${c.id}`} icon="pin" title={c.name} meta={p ? <PriceLevel level={p.level} small /> : undefined} />;
          })}
        </section>
      )}

      {must.length > 0 && (
        <section className="col">
          <h2 className="eb">{t('land.missa-inte')}</h2>
          <div className="hs">
            {must.map((i) => (
              <button key={i.id} type="button" className={`card${checks.has(i.id) ? ' soft' : ''}`} onClick={() => onItem(i)}>
                <span className="num">{i.must_rank}</span>
                <b>{i.name}</b>
                {i.summary && <span className="mu">{i.summary}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {d.stay && d.stay.length > 0 && (
        <section className="col">
          <div className="row">
            <h2 className="eb">{t('land.vistelse.rubrik')}</h2>
            {isEstimate(d, 'stay') && <Estimate />}
          </div>
          {d.stay.map((s) => (
            <div key={s.label} className="li">
              <span className="badge">{s.days}</span>
              <span className="t">
                <b>{s.label}</b>
                <span className="mu">{s.text}</span>
              </span>
              {s.recommended && <span className="chip soft tag">{t('land.vistelse.rekommenderad')}</span>}
            </div>
          ))}
        </section>
      )}

      {d.day_budget_sek != null && (
        <div className="card">
          <div className="row">
            <b>{t('land.budget.per-dag', { belopp: formatSek(d.day_budget_sek) })}</b>
            {isEstimate(d, 'day_budget_sek') && <Estimate />}
          </div>
          {d.day_budget_note && <span className="mu">{d.day_budget_note}</span>}
        </div>
      )}

      {/* Prisnivå direkt efter dagsbudgeten. Landet visar sina egna priser, annars städernas nivå. */}
      <PlacePrices place={place} cities={cities} />

      {d.best_text && (
        <div className="card soft">
          <div className="row">
            <span>{d.best_text}</span>
            {isEstimate(d, 'best_text') && <Estimate />}
          </div>
        </div>
      )}

      {stayHere.length > 0 && (
        <section className="col">
          <div className="row">
            <h2 className="eb">{t('land.omraden.bo')}</h2>
            {isEstimate(d, 'areas') && <Estimate />}
          </div>
          {stayHere.map((a) => (
            <div key={a.name} className="li">
              <span className="badge ok">
                <Icon name="check" size={18} stroke={3} />
              </span>
              <span className="t">
                <b>{a.name}</b>
                <span className="mu">{a.text}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      {avoid.length > 0 && (
        <section className="col">
          <div className="row">
            <h2 className="eb">{t('land.omraden.undvik')}</h2>
            {isEstimate(d, 'areas') && <Estimate />}
          </div>
          {avoid.map((a) => (
            <div key={a.name} className="li">
              <span className="badge no">
                <Icon name="x" size={18} stroke={3} />
              </span>
              <span className="t">
                <b>{a.name}</b>
                <span className="mu">{a.text}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      {d.transport && d.transport.length > 0 && (
        <section className="col">
          <div className="row">
            <h2 className="eb">{t('land.transport.rubrik')}</h2>
            {isEstimate(d, 'transport') && <Estimate />}
          </div>
          {d.transport.map((x) => (
            <div key={x.mode} className="li">
              <span className="t">
                <b>{x.mode}</b>
                <span className="mu">{x.text}</span>
              </span>
              <span className="chip soft tag">{t(`land.transport.${x.rating}`)}</span>
            </div>
          ))}
        </section>
      )}

      {d.flight_tips && d.flight_tips.length > 0 && (
        <section className="col">
          <div className="row">
            <h2 className="eb">{t('land.flygtips.rubrik')}</h2>
            {isEstimate(d, 'flight_tips') && <Estimate />}
          </div>
          {d.flight_tips.map((x) => (
            <div key={x.title} className="li">
              <span className="t">
                <b>{x.title}</b>
                <span className="mu">{x.text}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      <Row icon="heart" title={t('land.vy.kop')} onClick={onKop} />

      {d.sources && d.sources.length > 0 && (
        <div className="chips">
          {d.sources.map((u, i) => (
            <a key={u} className="chip" href={u} target="_blank" rel="noopener noreferrer">
              {t('knapp.kalla')} {i + 1}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function Lista({
  name,
  items,
  checks,
  onToggle,
  onItem,
}: {
  name: string;
  items: PlaceItem[];
  checks: Set<string>;
  onToggle: (i: PlaceItem) => void;
  onItem: (i: PlaceItem) => void;
}) {
  const t = useT();
  if (!items.length) {
    return (
      <div className="card soft">
        <p>{t('land.lista.tom', { plats: name })}</p>
      </div>
    );
  }
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <>
      {cats.map((c) => {
        const list = items.filter((i) => i.category === c);
        return (
          <section key={c} className="col">
            <div className="row">
              <h2 className="eb">{t(`lista.kategori.${c}`)}</h2>
              <span className="mu">
                {list.filter((i) => checks.has(i.id)).length}/{list.length}
              </span>
            </div>
            {list.map((i) => {
              const on = checks.has(i.id);
              return (
                <div key={i.id} className="li">
                  <button type="button" className={`box${on ? ' on' : ''}`} aria-pressed={on} aria-label={i.name} onClick={() => onToggle(i)}>
                    {on && <Icon name="check" size={16} stroke={3} />}
                  </button>
                  <button type="button" className={i.image_url ? 't with-thumb' : 't'} onClick={() => onItem(i)}>
                    <ItemThumb url={i.image_url} />
                    <span className="t-text">
                      <b className={on ? 'done' : ''}>{i.name}</b>
                      {i.summary && <span className="mu">{i.summary}</span>}
                    </span>
                  </button>
                  <span className="chev">
                    <Icon name="chev" size={18} />
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

/**
 * Regler för dig: reglerna med åldersgräns som gäller användarens ålder, räknad i webbläsaren ur
 * födelsedatumet i Valvet (vid nästa resa hit, annars i dag). Bara när Valvet är upplåst.
 * Åldern och födelsedatumet skickas aldrig någonstans och sparas inte.
 */
function RulesForYou({ facts, places, placeId, onFact }: { facts: PlaceFact[]; places: Place[]; placeId: string; onFact: (f: PlaceFact) => void }) {
  const t = useT();
  const vault = useVault();
  const trips = useTripsTo(places, placeId);
  if (!facts.some((f) => f.is_rule && f.min_age != null)) return null;
  const head = <h2 className="eb">{t('land.regler-for-dig')}</h2>;
  if (vault.state !== 'oppen')
    return (
      <section className="col">
        {head}
        <Row to="/vi/valvet" icon="lock" title={t('land.regler-for-dig.last')} />
      </section>
    );
  const born = birthDate(vault.entries);
  const next = trips.map((x) => x.start_date).filter((d): d is string => Boolean(d)).sort()[0];
  const age = ageOn(born, next && next > todayIso() ? next : todayIso());
  if (age == null)
    return (
      <section className="col">
        {head}
        <Row to="/vi/valvet" icon="lock" title={t('land.regler-for-dig.fodelsedatum')} />
      </section>
    );
  const mine = rulesForAge(facts, age);
  return (
    <section className="col">
      {head}
      {mine.length === 0 ? (
        <p className="mu">{t('land.regler-for-dig.tom')}</p>
      ) : (
        mine.map((f) => (
          <Row
            key={f.id}
            lead={
              <span className="badge no" aria-hidden="true">
                <Icon name="x" size={18} />
              </span>
            }
            title={f.title}
            sub={t('land.regler.alder', { antal: f.min_age ?? 0 })}
            onClick={() => onFact(f)}
          />
        ))
      )}
    </section>
  );
}

function Guide({ facts, onFact, places, placeId }: { facts: PlaceFact[]; onFact: (f: PlaceFact) => void; places: Place[]; placeId: string }) {
  const t = useT();
  const guide = facts.filter((f) => !f.is_rule);
  const rules = facts.filter((f) => f.is_rule);
  return (
    <>
      {guide.map((f) => (
        <Row key={f.id} title={f.title} sub={f.summary ?? undefined} onClick={() => onFact(f)} />
      ))}
      {rules.length > 0 && (
        <section className="col">
          <h2 className="eb">{t('land.regler.rubrik')}</h2>
          {rules.map((f) => (
            <div key={f.id} className="card">
              <div className="row" style={{ justifyContent: 'flex-start' }}>
                {f.min_age != null && <span className="badge">{f.min_age}</span>}
                <button type="button" className="t-btn" onClick={() => onFact(f)}>
                  <b>{f.title}</b>
                  {f.summary && <span className="mu">{f.summary}</span>}
                </button>
              </div>
              <Source url={f.source_url} date={f.verified_on} />
            </div>
          ))}
          <p className="mu">{t('land.regler.ansvar')}</p>
        </section>
      )}
      <RulesForYou facts={facts} places={places} placeId={placeId} onFact={onFact} />
    </>
  );
}

function Manad({ place }: { place: Place }) {
  const t = useT();
  const months = useMemo(() => monthNames(), []);
  const m = place.smart_months;
  const d = place.data;
  const today = todayIso();
  // Månadens text och händelser visas bara när platsen har en text för varje månad.
  const notes = hasMonthNotes(d.month_notes) ? d.month_notes : null;
  const [picked, setPicked] = useState(() => currentMonth(today));
  const events = eventsInMonth(d.events, picked, today);
  if (!m && !d.best_text) {
    return (
      <div className="card soft">
        <p>{t('land.saknar-innehall', { plats: place.name })}</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="row">
        <h2 className="h3">{t('karta.lage.smart')}</h2>
        {isEstimate(d, 'smart_months') && <Estimate />}
      </div>
      {m && notes ? (
        <>
          <div className="bars pick" role="group" aria-label={t('karta.lage.smart')}>
            {m.map((x, i) => (
              <button
                key={months[i].long}
                type="button"
                aria-pressed={picked === i}
                aria-label={t('smart.manad.betyg', { manad: capital(months[i].long), betyg: x })}
                onClick={() => setPicked(i)}
              >
                <i style={{ height: `${Math.max(4, x * 20)}px`, background: SMART_COLORS[x] ?? SMART_COLORS[0] }} />
                <span aria-hidden="true">{months[i].short}</span>
              </button>
            ))}
          </div>
          <p className="mu">{t('smart.tryck')}</p>
          <div className="smart-month" aria-live="polite">
            <h3 className="h3">{t('smart.manad.betyg', { manad: capital(months[picked].long), betyg: m[picked] })}</h3>
            <p>{notes[picked]}</p>
            {events.length > 0 && (
              <>
                <h4 className="eb">{t('smart.handelser.rubrik')}</h4>
                <ul className="smart-events">
                  {events.map((e) => (
                    <li key={`${e.name}-${e.start}`}>
                      <b>{e.name}</b>
                      <span className="mu">{formatDateRange(e.start, e.end)}</span>
                      <span>{e.text}</span>
                      <span className="src mu">
                        {t('smart.handelser.kalla')}:{' '}
                        <a href={e.source} target="_blank" rel="noopener noreferrer">
                          {domainOf(e.source)}
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      ) : (
        m && (
          <div className="bars" role="list">
            {m.map((x, i) => (
              <div key={months[i].long} role="listitem" aria-label={`${months[i].long}: ${x}/5`}>
                <i style={{ height: `${Math.max(4, x * 20)}px`, background: SMART_COLORS[x] ?? SMART_COLORS[0] }} />
                <span aria-hidden="true">{months[i].short}</span>
              </div>
            ))}
          </div>
        )
      )}
      {d.best_text && (
        <div className="card soft">
          <div className="row">
            <span>{d.best_text}</span>
            {isEstimate(d, 'best_text') && <Estimate />}
          </div>
        </div>
      )}
    </div>
  );
}

function Kop({ name, gifts, places, placeId }: { name: string; gifts: GiftTip[]; places: Place[]; placeId: string }) {
  const t = useT();
  const trips = useTripsTo(places, placeId);
  if (!gifts.length) {
    return (
      <div className="card soft">
        <p>{t('land.kop.tom', { plats: name })}</p>
      </div>
    );
  }
  return (
    <>
      {gifts.map((g) => (
        <div key={g.id} className="card">
          <div className="row">
            <h2 className="h3">{g.name}</h2>
            {g.min_age != null && <span className="chip soft tag">{g.min_age}+</span>}
          </div>
          {g.body && <p>{g.body}</p>}
          {g.price_sek != null && <b>{formatSek(g.price_sek)}</b>}
          <AddGift gift={g} trips={trips} />
          {g.for_whom.length > 0 && (
            <div className="chips">
              {g.for_whom.map((w) => (
                <span key={w} className="chip soft tag">
                  {t(`present.for.${w}`)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
