// Fälten för en etapp: från, till, färdsätt, datum, restid och anteckning.
// Från och till föreslår platser ur innehållet och alla länder. Känns namnet igen sparas koordinaterna,
// så att etappen kan spelas upp på kartan.
import { useId, useMemo } from 'react';
import { countryName, type Place } from '../../lib/content';
import { COUNTRIES } from '../../lib/countries';
import { findPoint } from '../../lib/tripLogic';
import { LEG_MODES, type Home, type LegMode, type NewLeg } from '../../lib/trips';
import { useT } from '../../lib/useT';

export interface LegDraft {
  from_text: string;
  to_text: string;
  mode: LegMode;
  date: string;
  duration_min: string;
  note: string;
}

export const emptyLeg = (mode: LegMode = 'flyg'): LegDraft => ({ from_text: '', to_text: '', mode, date: '', duration_min: '', note: '' });

/** Namn med koordinater: innehållets platser, alla länder och hemorten. */
export function useNamedPoints(places: Place[], home: Home | null) {
  return useMemo(() => {
    const list: { name: string; lat: number | null; lon: number | null }[] = places.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon }));
    for (const [iso, lat, lon] of COUNTRIES) list.push({ name: countryName(iso), lat, lon });
    if (home) list.unshift(home);
    return list;
  }, [places, home]);
}

/** Gör om utkastet till en rad för trip_legs. */
export function toLeg(d: LegDraft, pos: number, points: ReturnType<typeof useNamedPoints>): NewLeg {
  const a = findPoint(d.from_text, points);
  const b = findPoint(d.to_text, points);
  const min = Math.round(Number(d.duration_min));
  return {
    pos,
    mode: d.mode,
    from_text: d.from_text.trim(),
    to_text: d.to_text.trim(),
    from_lat: a?.lat ?? null,
    from_lon: a?.lon ?? null,
    to_lat: b?.lat ?? null,
    to_lon: b?.lon ?? null,
    depart_at: d.date ? `${d.date}T00:00:00Z` : null,
    duration_min: min > 0 ? min : null,
    distance_km: null,
    note: d.note.trim() || null,
  };
}

export function LegFields({
  value,
  onChange,
  points,
  short = false,
}: {
  value: LegDraft;
  onChange: (d: LegDraft) => void;
  points: { name: string }[];
  /** Bara från, till och färdsätt (import av tidigare resor). */
  short?: boolean;
}) {
  const t = useT();
  const list = useId();
  const set = (patch: Partial<LegDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <datalist id={list}>
        {points.map((p, i) => (
          <option key={`${p.name}-${i}`} value={p.name} />
        ))}
      </datalist>
      <div className="g2">
        <label>
          {t('resor.etapp.fran')}
          <input value={value.from_text} list={list} required maxLength={60} onChange={(e) => set({ from_text: e.target.value })} />
        </label>
        <label>
          {t('resor.etapp.till')}
          <input value={value.to_text} list={list} required maxLength={60} onChange={(e) => set({ to_text: e.target.value })} />
        </label>
      </div>
      <label>
        {t('resor.etapp.lage')}
        <select value={value.mode} onChange={(e) => set({ mode: e.target.value as LegMode })}>
          {LEG_MODES.map((m) => (
            <option key={m} value={m}>
              {t(`resor.etapp.lage.${m}`)}
            </option>
          ))}
        </select>
      </label>
      {!short && (
        <>
          <div className="g2">
            <label>
              {t('falt.datum')}
              <input type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} />
            </label>
            <label>
              {t('resor.etapp.tid')}
              <input type="number" inputMode="numeric" min={0} max={10000} value={value.duration_min} onChange={(e) => set({ duration_min: e.target.value })} />
            </label>
          </div>
          <label>
            {t('falt.anteckning')}
            <textarea rows={2} maxLength={300} value={value.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
        </>
      )}
    </>
  );
}
