// Valvet: pass, försäkring, nödkontakt, hälsa, födelsedatum och annat. Krypteras i webbläsaren med
// användarens kod innan något sparas. Koden och innehållet sparas aldrig lokalt och loggas aldrig.
import { BackLink } from '../../components/BackLink';
import { useEffect, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/Loading';
import { Row } from '../../components/Row';
import { useSession } from '../../lib/session';
import { fetchTrips } from '../../lib/trips';
import { todayIso, tripPhase } from '../../lib/tripLogic';
import { useT } from '../../lib/useT';
import { useVault } from '../../lib/vault';
import { MIN_CODE } from '../../lib/vaultCrypto';
import { entrySummary, passExpiryWarning, VAULT_FIELDS, VAULT_KINDS, type VaultContent, type VaultEntry, type VaultKind } from '../../lib/vaultLogic';
import { formatDate } from '../karta/format';

export default function ValvetScreen() {
  const t = useT();
  const vault = useVault();
  return (
    <main className="scr">
      <BackLink to="/vi" />
      <div className="row">
        <h1>{t('valv.rubrik')}</h1>
        <span className="badge" aria-hidden="true">
          <Icon name="lock" size={20} />
        </span>
      </div>
      {vault.state === 'laddar' && <Loading />}
      {vault.state === 'fel' && (
        <div className="card soft">
          <p>{t('allmant.fel')}</p>
          <button type="button" className="btn" onClick={vault.reload}>
            {t('knapp.forsok-igen')}
          </button>
        </div>
      )}
      {vault.state === 'ny' && <CreateCode />}
      {vault.state === 'last' && <Unlock />}
      {vault.state === 'oppen' && <Open />}
    </main>
  );
}

/** Två fält för en ny kod. Svarar med koden när den är giltig. */
function NewCodeForm({ submit, onDone }: { submit: string; onDone: (code: string) => Promise<void> }) {
  const t = useT();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (a.length < MIN_CODE) return setErr(t('valv.kort-kod', { antal: MIN_CODE }));
    if (a !== b) return setErr(t('valv.koder-olika'));
    setErr('');
    setBusy(true);
    try {
      await onDone(a);
      setA('');
      setB('');
    } catch {
      setErr(t('allmant.fel'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="col" onSubmit={go} noValidate>
      <label>
        {t('valv.skapa-kod')}
        <input type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" minLength={MIN_CODE} required />
      </label>
      <label>
        {t('valv.upprepa-kod')}
        <input type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" minLength={MIN_CODE} required />
      </label>
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? t('allmant.laddar') : submit}
      </button>
    </form>
  );
}

function CreateCode() {
  const t = useT();
  const vault = useVault();
  return (
    <>
      <p>{t('valv.intro')}</p>
      <div className="card soft" role="note">
        <b>{t('valv.varning')}</b>
      </div>
      <div className="card">
        <NewCodeForm submit={t('knapp.bekrafta')} onDone={vault.create} />
      </div>
    </>
  );
}

function Unlock() {
  const t = useT();
  const vault = useVault();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    setErr('');
    try {
      const ok = await vault.unlock(code);
      if (!ok) setErr(t('valv.fel-kod'));
    } catch {
      setErr(t('allmant.fel'));
    } finally {
      setCode('');
      setBusy(false);
    }
  };
  return (
    <>
      <p>{t('valv.intro')}</p>
      <form className="card" onSubmit={go}>
        <label>
          {t('valv.kod')}
          <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" required />
        </label>
        {err && (
          <p className="field-error" role="alert">
            {err}
          </p>
        )}
        <button type="submit" className="btn" disabled={busy || !code}>
          <Icon name="key" size={20} />
          {busy ? t('allmant.laddar') : t('valv.lasupp')}
        </button>
      </form>
    </>
  );
}

/** Kommande resors sista dag, för varningen om passet. */
function useUpcomingTripEnds(): string[] {
  const { activeGroup } = useSession();
  const [ends, setEnds] = useState<string[]>([]);
  const gid = activeGroup?.id;
  useEffect(() => {
    if (!gid) return;
    let alive = true;
    const today = todayIso();
    fetchTrips(gid)
      .then((l) => alive && setEnds(l.filter((x) => tripPhase(x, today) !== 'avslutad').map((x) => x.end_date ?? x.start_date ?? '').filter(Boolean)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [gid]);
  return ends;
}

type Editing = { id?: string; kind: VaultKind; content: VaultContent };

function Open() {
  const t = useT();
  const vault = useVault();
  const { toast } = useFeedback();
  const ends = useUpcomingTripEnds();
  const [edit, setEdit] = useState<Editing | null>(null);
  const [pick, setPick] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const warn = passExpiryWarning(vault.entries, todayIso(), ends);
  const sorted = [...vault.entries].sort((a, b) => VAULT_KINDS.indexOf(a.kind) - VAULT_KINDS.indexOf(b.kind));

  return (
    <>
      {warn && (
        <div className="card soft" role="status">
          <b>{t('valv.pass-gar-ut', { datum: formatDate(warn) })}</b>
        </div>
      )}
      <p className="mu">{t('valv.krypterat')}</p>
      {sorted.length === 0 ? (
        <div className="card soft">
          <p>{t('valv.tom')}</p>
        </div>
      ) : (
        <div className="col">
          {sorted.map((e) => (
            <Row key={e.id} title={t(`valv.typ.${e.kind}`)} sub={summary(e) || undefined} onClick={() => setEdit({ id: e.id, kind: e.kind, content: e.content })} />
          ))}
        </div>
      )}
      <button type="button" className="btn" onClick={() => setPick(true)}>
        <Icon name="plus" size={20} />
        {t('valv.ny')}
      </button>
      <button type="button" className="btn ghost" onClick={() => setCodeOpen(true)}>
        <Icon name="key" size={20} />
        {t('valv.byt-kod')}
      </button>
      <button type="button" className="btn ghost" onClick={vault.lock}>
        <Icon name="lock" size={20} />
        {t('valv.las')}
      </button>

      <BottomSheet open={pick} title={t('valv.ny')} onClose={() => setPick(false)}>
        <div className="col">
          {VAULT_KINDS.map((k) => (
            <Row
              key={k}
              title={t(`valv.typ.${k}`)}
              onClick={() => {
                setPick(false);
                setEdit({ kind: k, content: { f: {}, pack: k === 'halsa' ? false : undefined } });
              }}
            />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={edit !== null} title={edit ? t(`valv.typ.${edit.kind}`) : ''} onClose={() => setEdit(null)}>
        {edit && <EntryForm key={edit.id ?? edit.kind} initial={edit} onDone={() => setEdit(null)} />}
      </BottomSheet>

      <BottomSheet open={codeOpen} title={t('valv.byt-kod')} onClose={() => setCodeOpen(false)}>
        <p className="mu">{t('valv.varning')}</p>
        <NewCodeForm
          submit={t('valv.byt-kod')}
          onDone={async (code) => {
            await vault.changeCode(code);
            setCodeOpen(false);
            toast(t('allmant.sparat'));
          }}
        />
      </BottomSheet>
    </>
  );
}

function summary(e: VaultEntry): string {
  const s = entrySummary(e);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatDate(s) : s;
}

function EntryForm({ initial, onDone }: { initial: Editing; onDone: () => void }) {
  const t = useT();
  const vault = useVault();
  const { toast } = useFeedback();
  const [f, setF] = useState<Record<string, string>>(initial.content.f);
  const [pack, setPack] = useState(Boolean(initial.content.pack));
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const fields = VAULT_FIELDS[initial.kind];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const content: VaultContent = { ...initial.content, f: clean };
      if (initial.kind === 'halsa') content.pack = pack;
      await vault.save({ id: initial.id, kind: initial.kind, content });
      toast(t('allmant.sparat'));
      onDone();
    } catch {
      toast(t('allmant.fel-spara'));
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!initial.id || busy) return;
    setBusy(true);
    try {
      await vault.remove(initial.id);
      toast(t('allmant.borttaget'));
      onDone();
    } catch {
      toast(t('allmant.fel'));
      setBusy(false);
    }
  };

  return (
    <form className="col" onSubmit={save}>
      {fields.map((x) => (
        <label key={x.id}>
          {t(`valv.falt.${x.id}`)}
          {x.type === 'area' ? (
            <textarea rows={3} value={f[x.id] ?? ''} onChange={(e) => setF({ ...f, [x.id]: e.target.value })} autoComplete="off" />
          ) : (
            <input
              type={x.type}
              value={f[x.id] ?? ''}
              onChange={(e) => setF({ ...f, [x.id]: e.target.value })}
              autoComplete="off"
              inputMode={x.type === 'tel' ? 'tel' : undefined}
            />
          )}
        </label>
      ))}
      {initial.kind === 'halsa' && (
        <label className="switch">
          {t('valv.packforslag')}
          <input type="checkbox" role="switch" checked={pack} onChange={(e) => setPack(e.target.checked)} />
        </label>
      )}
      <p className="mu">{t('valv.krypterat')}</p>
      <button type="submit" className="btn" disabled={busy}>
        {t('knapp.spara')}
      </button>
      {initial.id &&
        (confirmDel ? (
          <div className="card soft">
            <p>{t('allmant.ta-bort-fraga', { namn: t(`valv.typ.${initial.kind}`) })}</p>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>
                {t('knapp.avbryt')}
              </button>
              <button type="button" className="btn" onClick={del} disabled={busy}>
                {t('knapp.ta-bort')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn ghost" onClick={() => setConfirmDel(true)}>
            {t('knapp.ta-bort')}
          </button>
        ))}
    </form>
  );
}
