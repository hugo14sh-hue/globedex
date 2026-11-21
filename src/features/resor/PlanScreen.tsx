// Planera nästa resa: vart, hur länge, när, datum och flyg, boende och budget (som i prototypen).
// Förslagen kommer ur innehållet: längd ur places.data.stay, månad ur smart_months och budget ur
// data.day_budget_sek. Ett land utan innehåll får samma steg, utan förslag.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Estimate } from '../../components/Estimate';
import { useFeedback } from '../../components/Feedback';
import { HOME_AIRPORTS } from '../../config';
import { contentCountryOf, fetchPlaces, isEstimate, placeName, type Place } from '../../lib/content';
import { countryPoint } from '../../lib/countries';
import { airbnb, airbnbFits, booking, googleFlights, skyscanner, validRange, type StayType } from '../../lib/links';
import { countryIdFor, setPlaceStatus, shouldMarkPlanned, useMyPlaces } from '../../lib/status';
import { addDays, budgetSuggestion, datesForMonth, nights, todayIso } from '../../lib/tripLogic';
import { createTrip, fetchHome, type Home, type NewLeg } from '../../lib/trips';
import { useSession } from '../../lib/session';
import { companyGroups, defaultTripGroup } from '../../lib/togetherLogic';
import { useT, useLang } from '../../lib/useT';
import { SMART_COLORS } from '../../theme/palettes';
import { useTheme } from '../../theme/ThemeProvider';
import { monthNames } from '../karta/months';
import { formatSek } from '../karta/format';
import { DestSelect } from './DestSelect';
import { BackTo, saveError, usePeople } from './shared';

const STAY_TYPES: StayType[] = ['hotell', 'hostel', 'lagenhet', 'alla'];

export default function PlanScreen() {
  const t = useT();
  const lang = useLang();
  const nav = useNavigate();
  const { party, toast } = useFeedback();
  const [params] = useSearchParams();
  const { activeGroup, groups, session } = useSession();
  // Vem reser? Användarens sologrupp och varje par- eller gruppgrupp. Förvalt: gruppen som är vald i appen.
  const soloGroup = groups.find((g) => g.kind === 'solo' && g.created_by === session?.user.id) ?? null;
  const whoOptions = [...(soloGroup ? [soloGroup] : []), ...companyGroups(groups)];
  const [whoPicked, setWho] = useState<string | null>(null);
  const tripGroupId = whoPicked && whoOptions.some((g) => g.id === whoPicked) ? whoPicked : defaultTripGroup(activeGroup?.id ?? null, soloGroup?.id ?? null, whoOptions.map((g) => g.id));
  const tripGroup = groups.find((g) => g.id === tripGroupId) ?? activeGroup;
  const people = usePeople(tripGroup?.id);
  const mine = useMyPlaces(people.me || null);
  const { theme } = useTheme();
  const [places, setPlaces] = useState<Place[]>([]);
  const [home, setHome] = useState<Home | null>(null);
  const [dest, setDest] = useState(params.get('plats') ?? '');
  const [days, setDays] = useState(0);
  const [month, setMonth] = useState<number | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [from, setFrom] = useState<string>(HOME_AIRPORTS[0]);
  const [stayType, setStayType] = useState<StayType>('hotell');
  const [budget, setBudget] = useState('');
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const months = useMemo(() => monthNames(), []);
  const today = todayIso();

  useEffect(() => {
    fetchPlaces()
      .then(setPlaces)
      .catch(() => undefined);
  }, [lang]);
  useEffect(() => {
    if (people.me) fetchHome(people.me).then(setHome).catch(() => undefined);
  }, [people.me]);

  const place = places.find((p) => p.id === dest) ?? null;
  // En stad utan egna förslag använder landets.
  const country = place ? contentCountryOf(places, place.id) : null;
  const src = (field: 'stay' | 'day_budget_sek') => (place?.data[field] != null ? place : country?.data[field] != null ? country : null);
  const staySrc = src('stay');
  const stay = staySrc?.data.stay ?? [];
  const budgetSrc = src('day_budget_sek');
  const dayBudget = budgetSrc?.data.day_budget_sek ?? null;
  const smartSrc = place?.smart_months ? place : country?.smart_months ? country : null;
  const smart = smartSrc?.smart_months ?? null;
  const airport = place?.airport ?? country?.airport ?? null;
  const destName = dest ? placeName(places, dest) : '';
  const persons = people.ids.length;
  const suggestion = budgetSuggestion(dayBudget, days, persons);

  // Nytt resmål: rekommenderad längd och titel.
  useEffect(() => {
    const rec = stay.find((s) => s.recommended) ?? null;
    if (rec) setDays(rec.days);
    setTitle(destName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest, destName, stay.length]);

  // Budgetförslaget följer längd och resmål tills användaren skriver ett eget belopp.
  useEffect(() => {
    if (!budgetTouched) setBudget(suggestion ? String(suggestion) : '');
  }, [suggestion, budgetTouched]);

  const pickDays = (n: number) => {
    setDays(n);
    if (start && n > 0) setEnd(addDays(start, n - 1));
  };
  const pickMonth = (m: number) => {
    setMonth(m);
    const r = datesForMonth(m, Math.max(0, (days || 1) - 1), today);
    setStart(r.start);
    setEnd(r.end);
  };
  const pickStart = (v: string) => {
    setStart(v);
    if (v && days > 0 && (!end || end < v)) setEnd(addDays(v, days - 1));
    if (v) setMonth(Number(v.slice(5, 7)) - 1);
  };
  const pickEnd = (v: string) => {
    setEnd(v);
    const n = nights(start, v);
    if (n != null) setDays(n + 1);
  };

  const datesOk = validRange(start, end) && Boolean(end);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!tripGroup || !dest || busy) return;
    setBusy(true);
    const to = place?.lat != null && place.lon != null ? { lat: place.lat, lon: place.lon } : countryPoint(dest.slice(0, 2));
    const leg: NewLeg = {
      pos: 0,
      mode: airport ? 'flyg' : 'bil',
      from_text: home?.name || from,
      to_text: destName,
      from_lat: home?.lat ?? null,
      from_lon: home?.lon ?? null,
      to_lat: to?.lat ?? null,
      to_lon: to?.lon ?? null,
      depart_at: start ? `${start}T00:00:00Z` : null,
      duration_min: null,
      distance_km: null,
      note: null,
    };
    const total = Math.round(Number(budget));
    try {
      const trip = await createTrip(
        {
          group_id: tripGroup.id,
          title: title.trim() || destName,
          place_id: dest,
          start_date: start || null,
          end_date: end || null,
          from_airport: airport ? from : null,
          budget: total > 0 ? { total } : {},
          created_by: people.me,
        },
        [leg],
      );
      // Som i prototypen: resmålet blir planerat om det inte redan har en starkare status.
      const land = countryIdFor(dest, theme.splitCountries);
      const cur = mine.statuses[land];
      if (shouldMarkPlanned(cur)) await setPlaceStatus(land, 'planerad').catch(() => undefined);
      party(t('resor.skapad'));
      nav(`/resor/${trip.id}`, { replace: true });
    } catch (err) {
      toast(saveError(t, err));
      setBusy(false);
    }
  };

  return (
    <main className="scr">
      <BackTo to="/resor" />
      <h1>{t('resor.planera')}</h1>
      <form className="col" onSubmit={save}>
        {/* Vem reser? Styr resans grupp (trips.group_id). Visas när det finns mer än ett val. */}
        {whoOptions.length > 1 && (
          <fieldset className="col">
            <legend className="eb">{t('resa.vem.rubrik')}</legend>
            {whoOptions.map((g) => (
              <label key={g.id} className="check">
                <input
                  type="radio"
                  name="vem-reser"
                  value={g.id}
                  checked={tripGroupId === g.id}
                  aria-describedby={g.kind === 'solo' ? 'vem-reser-hjalp' : undefined}
                  onChange={() => setWho(g.id)}
                />
                {g.kind === 'solo' ? t('resa.vem.solo') : t('resa.vem.grupp', { grupp: g.name })}
              </label>
            ))}
            {tripGroup?.kind === 'solo' && (
              <p className="mu" id="vem-reser-hjalp">
                {t('resa.vem.hjalp')}
              </p>
            )}
          </fieldset>
        )}

        <h2 className="eb">1. {t('resor.steg.vart')}</h2>
        <DestSelect label={t('resor.steg.vart')} places={places} value={dest} onChange={setDest} />

        {dest && (
          <>
            <h2 className="eb">2. {t('resor.steg.lange')}</h2>
            {stay.length > 0 && (
              <div className="col" role="group" aria-label={t('resor.steg.lange')}>
                {isEstimate(staySrc?.data, 'stay') && <Estimate />}
                {stay.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className={`li${days === s.days ? ' picked' : ''}`}
                    aria-pressed={days === s.days}
                    onClick={() => pickDays(s.days)}
                  >
                    <span className="badge">{s.days}</span>
                    <span className="t">
                      <b>{s.label}</b>
                      <span className="mu">{s.text}</span>
                    </span>
                    {s.recommended && <span className="chip soft tag">{t('land.vistelse.rekommenderad')}</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Värdet är dagar, inte nätter: slutdatum = start + dagar - 1, budget = dagsbudget × dagar × personer,
                och months-knapparna ger dagar - 1 nätter. Packlistan räknar nätter ur resans datum. */}
            <label>
              {t('resa.langd.dagar')}
              <input type="number" inputMode="numeric" min={1} max={365} value={days || ''} onChange={(e) => pickDays(Math.max(0, Math.round(Number(e.target.value))))} />
            </label>

            <h2 className="eb">3. {t('resor.steg.nar')}</h2>
            {smart && isEstimate(smartSrc?.data, 'smart_months') && <Estimate />}
            <div className="months" role="group" aria-label={t('resor.steg.nar')}>
              {months.map((m, i) => (
                <button
                  key={m.long}
                  type="button"
                  aria-pressed={month === i}
                  aria-label={smart ? `${m.long}: ${smart[i]}/5` : m.long}
                  style={smart && month !== i ? { boxShadow: `inset 0 -4px 0 ${SMART_COLORS[smart[i]] ?? SMART_COLORS[0]}` } : undefined}
                  onClick={() => pickMonth(i)}
                >
                  {m.short}
                </button>
              ))}
            </div>

            <h2 className="eb">4. {t('resor.steg.flyg')}</h2>
            <div className="g2">
              <label>
                {t('falt.fran-datum')}
                <input type="date" value={start} min={today} onChange={(e) => pickStart(e.target.value)} />
              </label>
              <label>
                {t('falt.till-datum')}
                <input type="date" value={end} min={start || today} onChange={(e) => pickEnd(e.target.value)} />
              </label>
            </div>
            {airport && (
              <div className="card">
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
                {datesOk ? (
                  <>
                    <a className="btn ghost" href={googleFlights({ from, to: airport, out: start, home: end })} target="_blank" rel="noopener noreferrer">
                      Google Flights
                    </a>
                    <a className="btn ghost" href={skyscanner({ from, to: airport, out: start, home: end })} target="_blank" rel="noopener noreferrer">
                      Skyscanner
                    </a>
                    <span className="mu">{t('resor.lankar-ut', { tjanst: 'Google Flights, Skyscanner' })}</span>
                  </>
                ) : (
                  <span className="mu">{t('boka.valj-datum')}</span>
                )}
              </div>
            )}

            <h2 className="eb">5. {t('resor.steg.boende')}</h2>
            <div className="card">
              <label>
                {t('boka.typ')}
                <select value={stayType} onChange={(e) => setStayType(e.target.value as StayType)}>
                  {STAY_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {t(`boka.typ.${x}`)}
                    </option>
                  ))}
                </select>
              </label>
              {datesOk ? (
                <>
                  <a
                    className="btn ghost"
                    href={booking({ place: destName, checkin: start, checkout: end, adults: persons, rooms: 1, type: stayType })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Booking.com
                  </a>
                  {airbnbFits(stayType) && (
                    <a className="btn ghost" href={airbnb({ place: destName, checkin: start, checkout: end, adults: persons })} target="_blank" rel="noopener noreferrer">
                      Airbnb
                    </a>
                  )}
                  <span className="mu">{t('resor.lankar-ut', { tjanst: airbnbFits(stayType) ? 'Booking.com, Airbnb' : 'Booking.com' })}</span>
                </>
              ) : (
                <span className="mu">{t('boka.valj-datum')}</span>
              )}
            </div>

            <h2 className="eb">6. {t('resor.steg.budget')}</h2>
            <div className="card">
              {dayBudget != null && (
                <div className="row">
                  <span className="mu">{t('resor.budget.forslag', { belopp: formatSek(dayBudget) })}</span>
                  {isEstimate(budgetSrc?.data, 'day_budget_sek') && <Estimate />}
                </div>
              )}
              {budgetSrc?.data.day_budget_note && <span className="mu">{budgetSrc.data.day_budget_note}</span>}
              <label>
                {t('resor.steg.budget')}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={budget}
                  onChange={(e) => {
                    setBudgetTouched(true);
                    setBudget(e.target.value);
                  }}
                />
              </label>
            </div>

            <label>
              {t('falt.titel')}
              <input value={title} maxLength={60} required onChange={(e) => setTitle(e.target.value)} />
            </label>
            <button type="submit" className="btn acc" disabled={busy || !tripGroup}>
              {t('knapp.spara')}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
