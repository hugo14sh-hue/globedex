import { useId, useState, type FormEvent } from 'react';
import { Logo } from '../../components/Logo';
import { useT } from '../../lib/useT';
import { useSession } from '../../lib/session';
import { supabaseConfigured } from '../../lib/supabase';
import { authErrorKey, MIN_PASSWORD, validateCredentials, type AuthMode } from '../../lib/auth';

export default function LoginScreen() {
  const t = useT();
  const { signIn, signUp, sessionEnded } = useSession();
  const [mode, setMode] = useState<AuthMode>('logga-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errId = useId();
  const creating = mode === 'skapa';

  function switchMode() {
    setMode(creating ? 'logga-in' : 'skapa');
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = email.trim();
    const invalid = validateCredentials(v, password);
    if (invalid) {
      setError(t(invalid));
      return;
    }
    if (!supabaseConfigured) {
      console.error('VITE_SUPABASE_URL eller VITE_SUPABASE_PUBLISHABLE_KEY saknas i .env.local');
      setError(t('allmant.fel'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (creating) await signUp(v, password);
      else await signIn(v, password);
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  const describedBy = error ? errId : undefined;

  return (
    <main className="scr plain center">
      <Logo />
      <h1>{creating ? t('login.skapa.rubrik') : t('login.rubrik')}</h1>
      <p>{creating ? t('login.skapa.ingress') : t('login.ingress')}</p>
      {sessionEnded && !creating && (
        <div className="card soft" role="status">
          <p>{t('allmant.session-slut')}</p>
        </div>
      )}
      <form className="col" onSubmit={submit} noValidate>
        <label>
          {t('login.falt')}
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        </label>
        <label>
          {t('login.losenord')}
          <input
            type="password"
            name="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            minLength={MIN_PASSWORD}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        </label>
        {error && (
          <span className="field-error" id={errId} role="alert">
            {error}
          </span>
        )}
        <button type="submit" className="btn" disabled={busy}>
          {creating ? t('login.knapp-skapa') : t('login.knapp-logga-in')}
        </button>
      </form>
      <button type="button" className="btn ghost" onClick={switchMode}>
        {creating ? t('login.byt-till-logga-in') : t('login.byt-till-skapa')}
      </button>
    </main>
  );
}
