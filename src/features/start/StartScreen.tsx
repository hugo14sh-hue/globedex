import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../../components/Feedback';
import { Logo } from '../../components/Logo';
import { Segment } from '../../components/Segment';
import type { TravelMode } from '../../config';
import { fetchHomeSuggestions, type HomeSuggestion } from '../../lib/content';
import { useSession } from '../../lib/session';
import { useT } from '../../lib/useT';
import { GroupPanel } from '../vi/GroupPanel';

// Steg: tre introsidor, namn, reseläge, hemort, klart.
const INTRO = 3;
const STEPS = INTRO + 4;

export default function StartScreen() {
  const t = useT();
  const nav = useNavigate();
  const { profile, updateProfile, setTravelMode, addHome } = useSession();
  const { toast, party } = useFeedback();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [mode, setMode] = useState<TravelMode>(profile?.travel_mode ?? 'solo');
  const [home, setHome] = useState('');
  const [busy, setBusy] = useState(false);
  // Förslag på hemort: städer i Sverige ur places. Tom lista när innehållet inte är importerat.
  const [homes, setHomes] = useState<HomeSuggestion[]>([]);

  useEffect(() => {
    let alive = true;
    fetchHomeSuggestions()
      .then((list) => alive && setHomes(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function save(fn: () => Promise<void>, next: number) {
    setBusy(true);
    try {
      await fn();
      setStep(next);
    } catch {
      toast(t('allmant.fel-spara'));
    } finally {
      setBusy(false);
    }
  }

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n) save(() => updateProfile({ display_name: n }), step + 1);
  };

  const submitMode = (e: FormEvent) => {
    e.preventDefault();
    save(() => setTravelMode(mode), step + 1);
  };

  const submitHome = (e: FormEvent) => {
    e.preventDefault();
    const h = home.trim();
    if (!h) return setStep(step + 1);
    const known = homes.find((p) => p.name.toLowerCase() === h.toLowerCase());
    save(() => addHome(h, known?.lat, known?.lon), step + 1);
  };

  const finish = () =>
    save(async () => {
      await updateProfile({ settings: { ...profile?.settings, onboarded: true } });
      party();
      nav('/karta', { replace: true });
    }, step);

  const dots = (
    <div className="dots" aria-hidden="true">
      {Array.from({ length: STEPS }, (_, i) => (
        <i key={i} className={i === step ? 'on' : ''} />
      ))}
    </div>
  );

  if (step < INTRO) {
    const n = step + 1;
    return (
      <main className="scr plain center">
        <Logo />
        <h1>{t(`start.${n}.rubrik`)}</h1>
        <p>{t(`start.${n}.text`)}</p>
        {dots}
        <button type="button" className="btn" onClick={() => setStep(step + 1)}>
          {t('knapp.nasta')}
        </button>
        <button type="button" className="btn ghost" onClick={() => setStep(INTRO)}>
          {t('knapp.hoppa-over')}
        </button>
      </main>
    );
  }

  if (step === INTRO) {
    return (
      <main className="scr plain center">
        <form className="col" onSubmit={submitName}>
          <label>
            <span className="h3" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--tx)' }}>
              {t('start.namn')}
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required />
          </label>
          {dots}
          <button type="submit" className="btn" disabled={busy || !name.trim()}>
            {t('knapp.nasta')}
          </button>
        </form>
      </main>
    );
  }

  if (step === INTRO + 1) {
    return (
      <main className="scr plain center">
        <form className="col" onSubmit={submitMode}>
          <h1>{t('start.lage.rubrik')}</h1>
          <Segment<TravelMode>
            value={mode}
            onChange={setMode}
            options={(['solo', 'par', 'grupp'] as const).map((m) => ({ value: m, label: t(`start.lage.${m}`) }))}
          />
          {dots}
          <button type="submit" className="btn" disabled={busy}>
            {t('knapp.nasta')}
          </button>
        </form>
      </main>
    );
  }

  if (step === INTRO + 2) {
    return (
      <main className="scr plain center">
        <form className="col" onSubmit={submitHome}>
          <label>
            <span className="h3" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--tx)' }}>
              {t('start.hemort')}
            </span>
            <input
              value={home}
              onChange={(e) => setHome(e.target.value)}
              maxLength={60}
              autoComplete="address-level2"
              list={homes.length ? 'hemorter' : undefined}
            />
          </label>
          {homes.length > 0 && (
            <datalist id="hemorter">
              {homes.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          )}
          {dots}
          <button type="submit" className="btn" disabled={busy || !home.trim()}>
            {t('knapp.nasta')}
          </button>
          <button type="button" className="btn ghost" onClick={() => setStep(step + 1)}>
            {t('knapp.hoppa-over')}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="scr plain center">
      <Logo />
      <h1>{t('start.klar')}</h1>
      {profile?.travel_mode !== 'solo' && <GroupPanel />}
      {dots}
      <button type="button" className="btn" onClick={finish} disabled={busy}>
        {t('knapp.klar')}
      </button>
    </main>
  );
}
