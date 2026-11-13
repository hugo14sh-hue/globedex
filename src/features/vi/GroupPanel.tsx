import { useId, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { INVITE_DAYS } from '../../config';
import { canInvite } from '../../lib/groups';
import { useSession } from '../../lib/session';
import type { Invite } from '../../lib/types';
import { useT } from '../../lib/useT';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** Gruppen: medlemmar och inbjudan, eller skapa ny grupp och gå med via kod. */
export function GroupPanel() {
  const t = useT();
  const { profile, activeGroup, members, createGroup, createInvite, joinGroup, leaveGroup } = useSession();
  const { toast, party } = useFeedback();
  const [sheet, setSheet] = useState<'bjud' | 'kod' | 'lamna' | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeErrId = useId();

  if (!profile) return null;
  const mode = profile.travel_mode;
  const shared = canInvite(activeGroup) ? activeGroup : null;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast(t('allmant.fel'));
    } finally {
      setBusy(false);
    }
  }

  const openInvite = () =>
    run(async () => {
      if (!shared) return;
      setInvite(await createInvite());
      setSheet('bjud');
    });

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    run(async () => {
      await createGroup(n);
      setName('');
      toast(t('allmant.sparat'));
    });
  };

  const submitJoin = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toLowerCase();
    if (!c) return;
    setBusy(true);
    setCodeError(null);
    try {
      await joinGroup(c);
      setSheet(null);
      setCode('');
      party(t('grupp.valkommen', { namn: profile.display_name }));
    } catch {
      setCodeError(t('grupp.kod-fel'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      toast(t('export.kopierat'));
    } catch {
      toast(t('allmant.fel'));
    }
  };

  const share = async () => {
    if (!invite) return;
    try {
      await navigator.share({ text: invite.code });
    } catch {
      // Användaren avbröt delningen.
    }
  };

  const confirmLeave = () =>
    run(async () => {
      await leaveGroup();
      setSheet(null);
    });

  return (
    <>
      {shared ? (
        <div className="card">
          <div className="row">
            <h2 className="h3">{shared.name}</h2>
            <span className="chip soft">{t(`start.lage.${shared.kind}`)}</span>
          </div>
          <ul className="col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {members.map((m) => (
              <li key={m.user_id} className="row" style={{ justifyContent: 'flex-start' }}>
                <span className={`who${m.user_id === profile.id ? ' on' : ''}`} aria-hidden="true">
                  {initials(m.display_name)}
                </span>
                <span>{m.display_name}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={openInvite} disabled={busy}>
            <Icon name="plus" size={20} />
            {t('grupp.bjud-in.rubrik')}
          </button>
          <button type="button" className="btn ghost" onClick={() => setSheet('lamna')}>
            {t('grupp.lamna')}
          </button>
        </div>
      ) : (
        <>
          {mode !== 'solo' && (
            <form className="card" onSubmit={submitCreate}>
              <h2 className="h3">{t('grupp.skapa')}</h2>
              <label>
                {t('grupp.namn')}
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
              </label>
              <button type="submit" className="btn" disabled={busy || !name.trim()}>
                {t('grupp.skapa')}
              </button>
            </form>
          )}
          <button type="button" className="btn ghost" onClick={() => setSheet('kod')}>
            <Icon name="key" size={20} />
            {t('grupp.ga-med')}
          </button>
        </>
      )}

      <BottomSheet open={sheet === 'bjud' && Boolean(shared)} title={t('grupp.bjud-in.rubrik')} onClose={() => setSheet(null)}>
        {invite && (
          <>
            <p className="code">{invite.code}</p>
            <p>{t('grupp.bjud-in.text', { dagar: INVITE_DAYS })}</p>
            <div className="g2">
              <button type="button" className="btn ghost" onClick={copy}>
                <Icon name="copy" size={20} />
                {t('knapp.kopiera')}
              </button>
              {'share' in navigator && (
                <button type="button" className="btn" onClick={share}>
                  <Icon name="share" size={20} />
                  {t('knapp.dela')}
                </button>
              )}
            </div>
          </>
        )}
      </BottomSheet>

      <BottomSheet open={sheet === 'kod'} title={t('grupp.ga-med')} onClose={() => setSheet(null)}>
        <form className="col" onSubmit={submitJoin} noValidate>
          <label>
            {t('grupp.kod-falt')}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? codeErrId : undefined}
            />
          </label>
          {codeError && (
            <span className="field-error" id={codeErrId} role="alert">
              {codeError}
            </span>
          )}
          <button type="submit" className="btn" disabled={busy || !code.trim()}>
            {t('knapp.bekrafta')}
          </button>
        </form>
      </BottomSheet>

      <BottomSheet open={sheet === 'lamna'} title={t('grupp.lamna')} onClose={() => setSheet(null)}>
        <p>{t('grupp.lamna-fraga')}</p>
        <button type="button" className="btn" onClick={confirmLeave} disabled={busy}>
          {t('knapp.bekrafta')}
        </button>
        <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
          {t('knapp.avbryt')}
        </button>
      </BottomSheet>
    </>
  );
}
