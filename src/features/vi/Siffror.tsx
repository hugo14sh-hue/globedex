// Siffror, märken och tidslinje på fliken Vi. Varje siffra, varje märke och varje händelse öppnar en detaljvy.
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useFeedback } from '../../components/Feedback';
import { Icon, type IconName } from '../../components/Icon';
import { Row } from '../../components/Row';
import { APP_NAME } from '../../config';
import { placeName } from '../../lib/content';
import { badges } from '../../lib/texter';
import { useT } from '../../lib/useT';
import { formatDate } from '../karta/format';
import { badgeStates, tripDays, type BadgeState } from './marken';
import type { ViData } from './useViData';
import { continentName, numbers, timeline, type TimelineType } from './viLogic';
import { LOCALE, numberFormat } from '../../lib/locale';

const nf = { format: (n: number) => numberFormat().format(n) };

type StatId = 'lander' | 'kontinenter' | 'landskap' | 'delstater' | 'resor' | 'resdagar' | 'fynd' | 'bucket';

const TL_ICON: Record<TimelineType, IconName> = { resa: 'plane', fynd: 'book', marke: 'star', bucket: 'check' };
const TL_FIRST = 8;

/** Märken som redan har visats som nya, per användare. Bara märkenas id och nivå, inget annat. */
function useNewBadgeToast(states: BadgeState[] | null, userId: string) {
  const { party } = useFeedback();
  const t = useT();
  useEffect(() => {
    if (!states || !userId) return;
    const key = `${APP_NAME.toLowerCase()}.marken.${userId}`;
    const now = states.filter((s) => s.earned).map((s) => `${s.badge.id}:${s.level}`);
    let before: string[] | null = null;
    try {
      before = JSON.parse(localStorage.getItem(key) || 'null') as string[] | null;
      localStorage.setItem(key, JSON.stringify(now));
    } catch {
      return;
    }
    // Första gången sparas bara läget, så att gamla märken inte visas som nya.
    if (!before) return;
    const fresh = states.filter((s) => s.earned && !before!.includes(`${s.badge.id}:${s.level}`));
    if (fresh.length) party(t('marke.nytt', { namn: fresh.map((s) => s.badge.name).join(', ') }));
  }, [states, userId, party, t]);
}

export function Siffror({ data, userId }: { data: ViData; userId: string }) {
  const t = useT();
  const [stat, setStat] = useState<StatId | null>(null);
  const [badge, setBadge] = useState<BadgeState | null>(null);
  const [allTl, setAllTl] = useState(false);
  const x = data.input;
  const nums = useMemo(() => numbers(x, data.compendium.length), [x, data.compendium.length]);
  const states = useMemo(() => badgeStates(badges(), x), [x]);
  useNewBadgeToast(states, userId);
  const findName = useMemo(() => {
    const m = new Map(data.compendium.map((c) => [c.id, c.name]));
    return (id: string) => m.get(id) ?? id;
  }, [data.compendium]);
  const tl = useMemo(() => timeline(x, states, findName), [x, states, findName]);
  const name = (id: string) => placeName(data.places, id);

  const tiles: { id: StatId; value: string; label: string }[] = [
    // Nämnaren är antalet länder i vald landlista (Anpassning).
    { id: 'lander', value: t('vi.siffror.av', { antal: nums.lander.length, totalt: nums.landerTotalt }), label: t('vi.siffror.lander') },
    { id: 'kontinenter', value: nf.format(nums.kontinenter.length), label: t('vi.siffror.kontinenter') },
    {
      id: 'landskap',
      value: nums.landskapTotalt ? t('vi.siffror.av', { antal: nums.landskap.length, totalt: nums.landskapTotalt }) : nf.format(nums.landskap.length),
      label: t('vi.siffror.landskap'),
    },
    // Delstaterna visas bredvid landskapen, bara när minst en är besökt.
    ...(nums.delstater.length
      ? [
          {
            id: 'delstater' as const,
            value: t('vi.siffror.av', { antal: nums.delstater.length, totalt: nums.delstaterTotalt }),
            label: t('vi.siffror.delstater'),
          },
        ]
      : []),
    { id: 'resor', value: nf.format(nums.resor.length), label: t('vi.siffror.resor') },
    { id: 'resdagar', value: nf.format(nums.resdagar), label: t('vi.siffror.resdagar') },
    {
      id: 'fynd',
      value: nums.fyndTotalt ? t('vi.siffror.av', { antal: nums.fynd, totalt: nums.fyndTotalt }) : nf.format(nums.fynd),
      label: t('vi.siffror.fynd'),
    },
    { id: 'bucket', value: nf.format(nums.bucket), label: t('vi.siffror.bucket') },
  ];
  const empty = !nums.lander.length && !nums.resor.length && !nums.fynd && !nums.bucket && !nums.landskap.length;

  const detail = (): { title: string; rows: { key: string; title: string; sub?: string; right?: string; to?: string }[] } => {
    switch (stat) {
      case 'lander':
        return { title: t('vi.siffror.lander'), rows: nums.lander.map((c) => ({ key: c, title: name(c) })).sort((a, b) => a.title.localeCompare(b.title, LOCALE)) };
      case 'kontinenter':
        return { title: t('vi.siffror.kontinenter'), rows: nums.kontinenter.map((c) => ({ key: c, title: continentName(c) })) };
      case 'landskap':
        return { title: t('vi.siffror.landskap'), rows: nums.landskap.map((c) => ({ key: c, title: name(c) })).sort((a, b) => a.title.localeCompare(b.title, LOCALE)) };
      case 'delstater':
        return {
          title: t('vi.siffror.delstater'),
          rows: nums.delstater.map((c) => ({ key: c, title: name(c), to: `/karta/${c}` })).sort((a, b) => a.title.localeCompare(b.title, LOCALE)),
        };
      case 'resor':
      case 'resdagar':
        return {
          title: t(stat === 'resor' ? 'vi.siffror.resor' : 'vi.siffror.resdagar'),
          rows: [...nums.resor]
            .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
            .map((r) => ({
              key: r.id,
              title: r.title,
              sub: r.start_date ? formatDate(r.start_date) : undefined,
              right: stat === 'resdagar' ? nf.format(tripDays(r)) : undefined,
              to: `/resor/${r.id}`,
            })),
        };
      case 'fynd':
        return {
          title: t('vi.siffror.fynd'),
          rows: [...x.finds]
            .sort((a, b) => (b.found_on ?? '').localeCompare(a.found_on ?? ''))
            .map((f) => ({
              key: f.compendium_id,
              title: findName(f.compendium_id),
              sub: [f.place_id ? name(f.place_id) : '', f.found_on ? formatDate(f.found_on) : ''].filter(Boolean).join(' · '),
            })),
        };
      case 'bucket':
        return {
          title: t('vi.siffror.bucket'),
          rows: x.bucket
            .filter((b) => b.done_on)
            .sort((a, b) => b.done_on!.localeCompare(a.done_on!))
            .map((b) => ({ key: b.id, title: b.title, sub: formatDate(b.done_on!) })),
        };
      default:
        return { title: '', rows: [] };
    }
  };
  const d = detail();

  return (
    <>
      {empty && (
        <div className="card soft">
          <p>{t('vi.siffror.tom')}</p>
        </div>
      )}
      <div className="g2">
        {tiles.map((s) => (
          <button key={s.id} type="button" className="card stat" onClick={() => setStat(s.id)}>
            <span className="num">{s.value}</span>
            <span className="mu">{s.label}</span>
          </button>
        ))}
      </div>

      <h2 className="eb">{t('vi.del.marken')}</h2>
      <div className="g3">
        {states.map((s) => (
          <button key={s.badge.id} type="button" className={`card mark${s.earned ? ' on' : ''}`} onClick={() => setBadge(s)}>
            <span className="badge" aria-hidden="true">
              <Icon name={s.earned ? 'star' : 'lock'} size={20} />
            </span>
            <b>{s.badge.name}</b>
            <span className="mu">
              {s.earned ? (s.levels.length > 1 ? t('marke.niva', { antal: s.level }) : t('marke.uppnatt')) : t('marke.last')}
            </span>
          </button>
        ))}
      </div>

      <h2 className="eb">{t('vi.del.tidslinje')}</h2>
      {tl.length === 0 ? (
        <div className="card soft">
          <p>{t('vi.tidslinje.tom')}</p>
        </div>
      ) : (
        <div className="col">
          {(allTl ? tl : tl.slice(0, TL_FIRST)).map((e, i) => {
            const sub = `${t(`tidslinje.typ.${e.type}`)} · ${formatDate(e.date)}`;
            const title = e.level ? `${e.title} · ${t('marke.niva', { antal: e.level })}` : e.title;
            return (
              <Row
                key={`${e.type}-${e.date}-${e.title}-${i}`}
                icon={TL_ICON[e.type]}
                title={title}
                sub={sub}
                to={e.tripId ? `/resor/${e.tripId}` : undefined}
                onClick={e.type === 'marke' ? () => setBadge(states.find((s) => s.badge.name === e.title) ?? null) : undefined}
                right={e.tripId || e.type === 'marke' ? undefined : <span />}
              />
            );
          })}
          {!allTl && tl.length > TL_FIRST && (
            <button type="button" className="btn ghost" onClick={() => setAllTl(true)}>
              {t('knapp.visa-alla')}
            </button>
          )}
        </div>
      )}

      <BottomSheet open={stat !== null} title={d.title} onClose={() => setStat(null)}>
        {stat === 'lander' && <p className="mu">{t('vi.siffror.av', { antal: nums.lander.length, totalt: nums.landerTotalt })}</p>}
        {stat === 'landskap' && nums.landskapTotalt > 0 && (
          <p className="mu">{t('vi.siffror.av', { antal: nums.landskap.length, totalt: nums.landskapTotalt })}</p>
        )}
        {stat === 'delstater' && <p className="mu">{t('vi.siffror.av', { antal: nums.delstater.length, totalt: nums.delstaterTotalt })}</p>}
        {stat === 'fynd' && nums.fyndTotalt > 0 && <p className="mu">{t('samling.raknare', { antal: nums.fynd, totalt: nums.fyndTotalt })}</p>}
        {d.rows.length === 0 ? (
          <p className="mu">{t('vi.siffror.tom')}</p>
        ) : (
          d.rows.map((r) => <Row key={r.key} title={r.title} sub={r.sub} to={r.to} right={r.right ? <span className="chip soft">{r.right}</span> : r.to ? undefined : <span />} />)
        )}
      </BottomSheet>

      <BottomSheet open={badge !== null} title={badge?.badge.name ?? ''} onClose={() => setBadge(null)}>
        {badge && <BadgeDetail s={badge} />}
      </BottomSheet>
    </>
  );
}

function BadgeDetail({ s }: { s: BadgeState }) {
  const t = useT();
  const multi = s.levels.length > 1;
  const target = s.next ?? s.levels[s.levels.length - 1];
  const pct = target ? Math.min(100, Math.round((s.value / target) * 100)) : 100;
  return (
    <div className="col">
      <p>{s.badge.text}</p>
      {multi && s.earned && <b>{t('marke.niva', { antal: s.level })}</b>}
      {!multi && <b>{s.earned ? t('marke.uppnatt') : t('marke.last')}</b>}
      {s.next !== null && target > 1 && (
        <>
          <span className="mu">{t('marke.framsteg', { antal: s.value, totalt: target })}</span>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={s.value}>
            <i style={{ width: `${pct}%` }} />
          </div>
          {multi && <span className="mu">{t('marke.nasta', { antal: target - s.value })}</span>}
        </>
      )}
      {multi && s.next === null && <span className="mu">{t('marke.alla-nivaer')}</span>}
      {s.dates.map((d, i) =>
        d ? (
          <span key={i} className="mu">
            {multi ? `${t('marke.niva', { antal: i + 1 })} · ` : ''}
            {formatDate(d)}
          </span>
        ) : null,
      )}
    </div>
  );
}
