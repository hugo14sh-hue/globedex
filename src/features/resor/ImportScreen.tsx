// Importera en tidigare resa: land, datum och etapper. Resan sparas som avslutad och landet får status besökt.
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { fetchPlaces, placeName, type Place } from '../../lib/content';
import { useSession } from '../../lib/session';
import { countryIdFor, setPlaceStatus, useMyPlaces } from '../../lib/status';
import { useTheme } from '../../theme/ThemeProvider';
import { todayIso } from '../../lib/tripLogic';
import { createTrip, fetchHome, type Home } from '../../lib/trips';
import { useT, useLang } from '../../lib/useT';
import { DestSelect } from './DestSelect';
import { emptyLeg, LegFields, toLeg, useNamedPoints, type LegDraft } from './LegFields';
import { BackTo, saveError, usePeople } from './shared';

export default function ImportScreen() {
  const t = useT();
  const lang = useLang();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const { activeGroup } = useSession();
  const people = usePeople();
  const mine = useMyPlaces(people.me || null);
  const { theme } = useTheme();
  const [places, setPlaces] = useState<Place[]>([]);
  const [home, setHome] = useState<Home | null>(null);
  const [dest, setDest] = useState('');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [legs, setLegs] = useState<LegDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const points = useNamedPoints(places, home);
  const today = todayIso();

  useEffect(() => {
    fetchPlaces()
      .then(setPlaces)
      .catch(() => undefined);
  }, [lang]);
  useEffect(() => {
    if (people.me) fetchHome(people.me).then(setHome).catch(() => undefined);
  }, [people.me]);

  const pickDest = (id: string) => {
    setDest(id);
    setTitle(placeName(places, id));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !dest || busy) return;
    setBusy(true);
    try {
      const trip = await createTrip(
        {
          group_id: activeGroup.id,
          title: title.trim() || placeName(places, dest),
          place_id: dest,
          start_date: start || null,
          end_date: end || start || null,
          from_airport: null,
          budget: {},
          status: 'klar',
          created_by: people.me,
        },
        legs.map((l, i) => toLeg({ ...l, date: l.date || (i === 0 ? start : '') }, i, points)),
      );
      // Bor eller har bott är starkare än besökt och skrivs inte över.
      // Statusen sätts på landet (kartan färgar länder), även när resmålet är en stad.
      const land = countryIdFor(dest, theme.splitCountries);
      const cur = mine.statuses[land];
      if (cur !== 'bor' && cur !== 'bott' && cur !== 'besokt') await setPlaceStatus(land, 'besokt').catch(() => undefined);
      toast(t('allmant.sparat'));
      nav(`/resor/${trip.id}`, { replace: true });
    } catch (err) {
      toast(saveError(t, err));
      setBusy(false);
    }
  };

  return (
    <main className="scr">
      <BackTo to="/resor" />
      <h1>{t('resor.importera')}</h1>
      <form className="col" onSubmit={save}>
        <DestSelect label={t('falt.plats')} places={places} value={dest} onChange={pickDest} />
        <label>
          {t('falt.titel')}
          <input value={title} maxLength={60} required onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="g2">
          <label>
            {t('falt.fran-datum')}
            <input type="date" value={start} max={today} required onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            {t('falt.till-datum')}
            <input type="date" value={end} min={start || undefined} max={today} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        {legs.map((l, i) => (
          <fieldset key={i} className="card">
            <div className="row">
              <legend className="eb">{i + 1}</legend>
              <button type="button" className="chip" onClick={() => setLegs((x) => x.filter((_, k) => k !== i))}>
                <Icon name="x" size={18} />
                {t('knapp.ta-bort')}
              </button>
            </div>
            <LegFields short value={l} points={points} onChange={(d) => setLegs((x) => x.map((y, k) => (k === i ? d : y)))} />
          </fieldset>
        ))}
        <button
          type="button"
          className="btn ghost"
          onClick={() => setLegs((x) => [...x, { ...emptyLeg(), from_text: x[x.length - 1]?.to_text ?? home?.name ?? '' }])}
        >
          <Icon name="plus" size={20} />
          {t('resor.etapp.ny')}
        </button>

        <button type="submit" className="btn acc" disabled={busy || !dest || !activeGroup}>
          {t('knapp.spara')}
        </button>
      </form>
    </main>
  );
}
