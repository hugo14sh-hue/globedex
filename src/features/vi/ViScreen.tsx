// Fliken Jag, Vi eller Gruppen: siffror, märken, tidslinje och Wrapped, och vägar till Valvet,
// guiden, exporten och Anpassning. Profil och grupp finns längre ned.
import { useEffect, useState, type FormEvent } from 'react';
import { LAST_TAB } from '../../components/AppShell';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Ingress, useLastTabIngress } from '../../components/Ingress';
import { Loading } from '../../components/Loading';
import { Row } from '../../components/Row';
import { Segment } from '../../components/Segment';
import { useInstallPrompt } from '../../lib/install';
import { useSession } from '../../lib/session';
import { useT } from '../../lib/useT';
import { useVault } from '../../lib/vault';
import { GroupPanel } from './GroupPanel';
import { Siffror } from './Siffror';
import { useViData } from './useViData';
import { Wrapped } from './Wrapped';
import { useUrlState } from '../../lib/navMemory';

type View = 'siffror' | 'wrapped';

export default function ViScreen() {
  const t = useT();
  const { profile, session, updateProfile, signOut } = useSession();
  const { toast } = useFeedback();
  const { canInstall, install } = useInstallPrompt();
  const vault = useVault();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [view, setView] = useUrlState<View>('vy', 'siffror', ['siffror', 'wrapped']);
  const { data } = useViData();
  const mode = profile?.travel_mode ?? 'solo';
  const ingress = useLastTabIngress();

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
      <Ingress k={ingress} />
      <Segment<View>
        value={view}
        onChange={setView}
        options={[
          { value: 'siffror', label: t('vi.del.siffror') },
          { value: 'wrapped', label: t('vi.del.wrapped') },
        ]}
      />

      {!data ? <Loading /> : view === 'siffror' ? <Siffror data={data} userId={session?.user.id ?? ''} /> : <Wrapped data={data} />}

      <div className="col">
        <Row to="/vi/valvet" icon="lock" title={t('vi.del.valvet')} sub={vault.state === 'oppen' ? undefined : t('valv.last')} />
        <Row to="/vi/guide" icon="star" title={t(mode === 'solo' ? 'vi.guide.jag' : 'vi.guide.vi')} />
        <Row to="/vi/export" icon="copy" title={t('vi.del.export')} />
        <Row to="/vi/anpassning" icon="palette" title={t('vi.del.anpassning')} />
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
