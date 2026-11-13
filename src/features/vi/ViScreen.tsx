import { useEffect, useState, type FormEvent } from 'react';
import { LAST_TAB } from '../../components/AppShell';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import { useInstallPrompt } from '../../lib/install';
import { useSession } from '../../lib/session';
import { useT } from '../../lib/useT';
import { GroupPanel } from './GroupPanel';

// Körning 6 bygger siffror, märken, Wrapped och Valvet. Här finns profil, grupp och Anpassning.
export default function ViScreen() {
  const t = useT();
  const { profile, updateProfile, signOut } = useSession();
  const { toast } = useFeedback();
  const { canInstall, install } = useInstallPrompt();
  const [name, setName] = useState(profile?.display_name ?? '');
  const mode = profile?.travel_mode ?? 'solo';

  useEffect(() => {
    if (profile) setName(profile.display_name);
  }, [profile]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try {
      await updateProfile({ display_name: n });
      toast(t('allmant.sparat'));
    } catch {
      toast(t('allmant.fel-spara'));
    }
  }

  return (
    <main className="scr">
      <h1>{t(LAST_TAB[mode])}</h1>
      <div className="card soft">
        <p>{t('vi.siffror.tom')}</p>
      </div>

      <form className="card" onSubmit={saveName}>
        <label>
          {t('start.namn')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required />
        </label>
        {name.trim() !== profile?.display_name && (
          <button type="submit" className="btn" disabled={!name.trim()}>
            {t('knapp.spara')}
          </button>
        )}
      </form>

      <GroupPanel />

      <Row to="/vi/anpassning" icon="palette" title={t('vi.del.anpassning')} />

      {canInstall && (
        <div className="card">
          <h2 className="h3">{t('allmant.installera')}</h2>
          <p>{t('allmant.installera-text')}</p>
          <button type="button" className="btn" onClick={install}>
            <Icon name="download" size={20} />
            {t('allmant.installera')}
          </button>
        </div>
      )}

      <button type="button" className="btn ghost" onClick={signOut}>
        <Icon name="out" size={20} />
        {t('knapp.logga-ut')}
      </button>
    </main>
  );
}
