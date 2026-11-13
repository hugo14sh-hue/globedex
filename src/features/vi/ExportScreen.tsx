// Exportera till Claude: en text med resor, status, listor och omdömen. Hela texten visas innan
// den kopieras. Valvet följer aldrig med: det läses inte ens här.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFeedback } from '../../components/Feedback';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/Loading';
import { placeName } from '../../lib/content';
import { STATUS_KEY, STATUSES } from '../../lib/statusLogic';
import { todayIso, tripPhase } from '../../lib/tripLogic';
import { useT } from '../../lib/useT';
import { useViData, type ViData } from './useViData';
import { EXPORT_PARTS, exportText, type ExportData, type ExportPart } from './viLogic';

const PHASE_KEY = { kommande: 'resor.kommande', pagar: 'resor.pagar', avslutad: 'resor.tidigare' } as const;

export default function ExportScreen() {
  const t = useT();
  const { data } = useViData();
  return (
    <main className="scr">
      <Link className="back" to="/vi">
        <Icon name="back" size={20} />
        {t('knapp.tillbaka')}
      </Link>
      <h1>{t('vi.del.export')}</h1>
      <p>{t('export.intro')}</p>
      <div className="card soft" role="note">
        <b>{t('export.utan-valv')}</b>
      </div>
      {data ? <Builder data={data} /> : <Loading />}
    </main>
  );
}

function Builder({ data }: { data: ViData }) {
  const t = useT();
  const { toast } = useFeedback();
  const [parts, setParts] = useState<ExportPart[]>(EXPORT_PARTS);
  const [text, setText] = useState<string | null>(null);

  const source = useMemo<ExportData>(() => {
    const name = (id: string) => placeName(data.places, id);
    const today = todayIso();
    const compName = new Map(data.compendium.map((c) => [c.id, c.name]));
    const x = data.input;
    return {
      trips: [...data.trips]
        .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))
        .map((tr) => ({
          title: tr.title,
          place: tr.place_id ? name(tr.place_id) : null,
          start: tr.start_date,
          end: tr.end_date,
          phase: t(PHASE_KEY[tripPhase(tr, today)]),
        })),
      statuses: STATUSES.map((s) => ({
        label: t(STATUS_KEY[s]),
        places: x.statuses
          .filter((r) => r.status === s)
          .map((r) => name(r.place_id))
          .sort((a, b) => a.localeCompare(b, 'sv')),
      })),
      lists: [
        { label: t('listor.vy.bucketlist'), items: data.bucket.filter((b) => !b.done_on).map((b) => b.title) },
        { label: t('vi.siffror.bucket'), items: data.bucket.filter((b) => b.done_on).map((b) => b.title) },
        { label: t('listor.vy.samlingsbok'), items: x.finds.map((f) => compName.get(f.compendium_id) ?? f.compendium_id) },
        ...data.collections.map((c) => ({ label: c.name, items: c.entries.map((e) => name(e.place_id)) })),
      ],
      reviews: data.reviews.map((r) => ({ name: r.name, place: r.place_id ? name(r.place_id) : null, rating: r.rating, note: r.note })),
    };
  }, [data, t]);

  const build = () =>
    setText(
      exportText(
        source,
        parts,
        (p) => t(`export.del.${p}`),
        (n) => t('guide.betyg-av', { antal: n }),
      ),
    );

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast(t('export.kopierat'));
    } catch {
      toast(t('allmant.fel'));
    }
  };

  return (
    <>
      <fieldset className="card">
        <legend className="eb">{t('export.innehall')}</legend>
        {EXPORT_PARTS.map((p) => (
          <label key={p} className="switch">
            {t(`export.del.${p}`)}
            <input
              type="checkbox"
              role="switch"
              checked={parts.includes(p)}
              onChange={(e) => {
                setParts(e.target.checked ? EXPORT_PARTS.filter((x) => x === p || parts.includes(x)) : parts.filter((x) => x !== p));
                setText(null);
              }}
            />
          </label>
        ))}
      </fieldset>
      <button type="button" className="btn" onClick={build} disabled={!parts.length}>
        {t('export.skapa')}
      </button>
      {text !== null && (
        <>
          <pre className="card export" tabIndex={0}>
            {text}
          </pre>
          <button type="button" className="btn" onClick={copy} disabled={!text}>
            <Icon name="copy" size={20} />
            {t('export.kopiera')}
          </button>
        </>
      )}
    </>
  );
}
