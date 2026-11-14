// Resekassa med vyerna Skulder och Budget. Solo har bara Budget (ingen skulddel).
// Varje utgift sparar kursen för sitt datum (rate_to_sek), så att gamla utgifter aldrig ändras.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Row } from '../../components/Row';
import { Segment } from '../../components/Segment';
import { balances, settle, share, spent, toOre } from '../../lib/kassa';
import { CURRENCIES, currencyName, fetchRate, RATE_SOURCE } from '../../lib/rates';
import { todayIso } from '../../lib/tripLogic';
import { addExpense, deleteExpense, fetchExpenses, updateTrip, type Expense, type Trip } from '../../lib/trips';
import { useT } from '../../lib/useT';
import { formatDate } from '../karta/format';
import { Bar, formatMoney, formatOre, saveError, SubHeader, TripGate, usePeople, useTrip } from './shared';
import { useUrlState } from '../../lib/navMemory';

/** Kategorier för utgifter och budget. Texterna ligger i kassa.kategori.*. */
const CATEGORIES = ['resa', 'boende', 'mat', 'aktiviteter', 'ovrigt'] as const;

type View = 'skulder' | 'budget';

export default function KassaScreen() {
  const state = useTrip();
  return <TripGate state={state}>{(trip) => <Kassa trip={trip} onTrip={state.setTrip} />}</TripGate>;
}

function Kassa({ trip, onTrip }: { trip: Trip; onTrip: (t: Trip) => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const people = usePeople();
  const [view, setView] = useUrlState<View>('vy', 'skulder', ['skulder', 'budget']);
  const [list, setList] = useState<Expense[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Expense | null>(null);
  const [budget, setBudget] = useState(String(trip.budget?.total ?? ''));
  const shown: View = people.solo ? 'budget' : view;

  useEffect(() => {
    let alive = true;
    fetchExpenses(trip.id)
      .then((x) => alive && setList(x))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [trip.id]);

  const bal = useMemo(() => balances(list ?? [], people.ids), [list, people.ids]);
  const transfers = useMemo(() => settle(bal), [bal]);
  const sums = useMemo(() => spent(list ?? []), [list]);
  const total = Number(trip.budget?.total ?? 0) * 100;
  const left = total - sums.total;

  const saveBudget = async () => {
    const n = Math.max(0, Math.round(Number(budget) || 0));
    if (n === Number(trip.budget?.total ?? 0)) return;
    try {
      onTrip(await updateTrip(trip.id, { budget: { ...trip.budget, total: n } }));
      toast(t('allmant.sparat'));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  const remove = async (e: Expense) => {
    try {
      await deleteExpense(e.id);
      setList((l) => (l ?? []).filter((x) => x.id !== e.id));
      setOpen(null);
      toast(t('allmant.borttaget'));
    } catch (err) {
      toast(saveError(t, err));
    }
  };

  const mine = bal[people.me] ?? 0;
  const expenseRows = (
    <>
      {list && !list.length && (
        <div className="card soft">
          <p>{t('kassa.tom')}</p>
        </div>
      )}
      {[...(list ?? [])].reverse().map((e) => (
        <Row
          key={e.id}
          title={e.title}
          sub={[people.solo ? '' : people.name(e.paid_by), formatDate(e.spent_on), e.currency !== 'SEK' ? formatMoney(e.amount, e.currency) : ''].filter(Boolean).join(' · ')}
          right={<b>{formatOre(toOre(e))}</b>}
          onClick={() => setOpen(e)}
        />
      ))}
    </>
  );

  return (
    <main className="scr">
      <SubHeader trip={trip} title={t('kassa.rubrik')} />
      {!people.solo && (
        <Segment<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'skulder', label: t('kassa.vy.skulder') },
            { value: 'budget', label: t('kassa.vy.budget') },
          ]}
        />
      )}

      {shown === 'skulder' && list && (
        <>
          <div className="hero">
            {transfers.length === 0 ? (
              <span className="big">{t('kassa.kvitt')}</span>
            ) : (
              <>
                {mine !== 0 && <span className="big">{formatOre(Math.abs(mine))}</span>}
                {mine === 0 && <span className="big">{t('kassa.kvitt')}</span>}
                {transfers
                  .filter((x) => x.from === people.me || x.to === people.me)
                  .map((x) => (
                    <span key={`${x.from}-${x.to}`}>{t('kassa.skuld', { namn: people.name(x.from), mottagare: people.name(x.to), belopp: formatOre(x.ore) })}</span>
                  ))}
              </>
            )}
          </div>
          {transfers.length > 1 &&
            transfers.map((x) => (
              <div key={`${x.from}-${x.to}`} className="li">
                <span className="t">
                  <b>{t('kassa.betala', { namn: people.name(x.from), mottagare: people.name(x.to), belopp: formatOre(x.ore) })}</b>
                </span>
              </div>
            ))}
          <h2 className="eb">{t('kassa.utgifter')}</h2>
          {expenseRows}
        </>
      )}

      {shown === 'budget' && list && (
        <>
          <div className="card">
            <div className="row">
              <b>{formatOre(sums.total)}</b>
              {total > 0 && <span className="mu">{formatOre(total)}</span>}
            </div>
            {total > 0 && <Bar pct={share(sums.total, total)} over={left < 0} />}
            {total > 0 && <span className="mu">{left >= 0 ? t('kassa.kvar', { belopp: formatOre(left) }) : t('kassa.over', { belopp: formatOre(-left) })}</span>}
            <label>
              {t('resor.steg.budget')}
              <input type="number" inputMode="numeric" min={0} step={100} value={budget} onChange={(e) => setBudget(e.target.value)} onBlur={saveBudget} />
            </label>
          </div>
          {Object.entries(sums.byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([c, ore]) => (
              <div key={c || 'ingen'} className="card">
                <div className="row">
                  <b>{t(`kassa.kategori.${c || 'ovrigt'}`)}</b>
                  <span className="mu">{formatOre(ore)}</span>
                </div>
                <Bar pct={share(ore, sums.total)} />
              </div>
            ))}
          {people.solo && expenseRows}
        </>
      )}

      <button type="button" className="btn" onClick={() => setAdding(true)}>
        <Icon name="plus" size={20} />
        {t('kassa.ny')}
      </button>

      <AddExpense
        open={adding}
        trip={trip}
        onClose={() => setAdding(false)}
        onSaved={() => fetchExpenses(trip.id).then(setList).catch(() => undefined)}
      />

      <BottomSheet open={Boolean(open)} title={open?.title ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <>
            <div className="g2">
              <div className="card">
                <span className="eb">{t('kassa.falt.belopp')}</span>
                <b>{formatMoney(open.amount, open.currency)}</b>
              </div>
              <div className="card">
                <span className="eb">SEK</span>
                <b>{formatOre(toOre(open))}</b>
              </div>
            </div>
            {!people.solo && (
              <div className="col" style={{ gap: 2 }}>
                <span className="eb">{t('kassa.vem')}</span>
                <span>{people.name(open.paid_by)}</span>
              </div>
            )}
            {!people.solo && (
              <p className="mu">
                {t('kassa.falt.delas')}: {(open.split_between.length ? open.split_between : people.ids).map(people.name).join(', ')}
              </p>
            )}
            {open.category && <p className="mu">{t(`kassa.kategori.${open.category}`)}</p>}
            {open.currency !== 'SEK' && (
              <p className="mu">
                {t('kassa.kurs', { datum: formatDate(open.spent_on) })} 1 {open.currency} = {formatMoney(open.rate_to_sek, 'SEK')} ·{' '}
                <SourceText text={t('kassa.kalla', { kalla: SLOT })} />
              </p>
            )}
            <button type="button" className="btn ghost" onClick={() => remove(open)}>
              {t('knapp.ta-bort')}
            </button>
          </>
        )}
      </BottomSheet>
    </main>
  );
}

function AddExpense({ open, trip, onClose, onSaved }: { open: boolean; trip: Trip; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const people = usePeople();
  const today = todayIso();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SEK');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState('');
  const [paidBy, setPaidBy] = useState(people.me);
  const [split, setSplit] = useState<string[]>(people.ids);
  const [noRate, setNoRate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setAmount('');
    setDate(trip.start_date && trip.start_date <= today && (!trip.end_date || trip.end_date >= today) ? today : (trip.start_date ?? today));
    setCategory('');
    setPaidBy(people.me);
    setSplit(people.ids);
    setNoRate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!(value >= 0) || busy || !split.length) return;
    setBusy(true);
    const rate = await fetchRate(currency, date, today);
    if (!rate) {
      // Ingen kurs: be om beloppet i kronor i stället.
      setNoRate(true);
      setCurrency('SEK');
      setBusy(false);
      return;
    }
    try {
      const everyone = people.ids.every((id) => split.includes(id)) && split.length === people.ids.length;
      await addExpense(trip.id, {
        title: title.trim(),
        amount: Math.round(value * 100) / 100,
        currency,
        rate_to_sek: rate.rate,
        category: category || null,
        paid_by: people.solo ? people.me : paidBy,
        split_between: people.solo || everyone ? [] : split,
        spent_on: date,
      });
      onSaved();
      toast(t('allmant.sparat'));
      onClose();
    } catch (err) {
      toast(saveError(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} title={t('kassa.ny')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <label>
          {t('kassa.falt.vad')}
          <input value={title} required maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="g2">
          <label>
            {t('kassa.falt.belopp')}
            <input type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            {t('kassa.falt.valuta')}
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setNoRate(false);
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} · {currencyName(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {noRate && (
          <p className="field-error" role="alert">
            {t('kassa.kurs-saknas')}
          </p>
        )}
        <div className="g2">
          <label>
            {t('falt.datum')}
            <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            {t('kassa.falt.kategori')}
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="" />
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`kassa.kategori.${c}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!people.solo && (
          <>
            <label>
              {t('kassa.vem')}
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                {people.ids.map((id) => (
                  <option key={id} value={id}>
                    {people.name(id)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="col">
              <legend className="eb">{t('kassa.falt.delas')}</legend>
              {people.ids.map((id) => (
                <label key={id} className="check">
                  <input
                    type="checkbox"
                    checked={split.includes(id)}
                    onChange={(e) => setSplit((s) => (e.target.checked ? [...s, id] : s.filter((x) => x !== id)))}
                  />
                  {people.name(id)}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <button type="submit" className="btn" disabled={busy || !split.length}>
          {t('knapp.spara')}
        </button>
      </form>
    </BottomSheet>
  );
}

const SLOT = '';

/** Texten kassa.kalla med källan (ECB) som länk där {kalla} står. */
function SourceText({ text }: { text: string }) {
  const [before, after = ''] = text.split(SLOT);
  return (
    <>
      {before}
      <a href={RATE_SOURCE.url} target="_blank" rel="noopener noreferrer">
        {RATE_SOURCE.name}
      </a>
      {after}
    </>
  );
}
