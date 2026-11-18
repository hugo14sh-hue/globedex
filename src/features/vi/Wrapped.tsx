// Wrapped: ett valt år som en svepbar serie skärmar. Kräver minst en resa under året, annars wrapped.tom.
import { useMemo, useRef, useState } from 'react';
import { placeName } from '../../lib/content';
import { useT } from '../../lib/useT';
import type { ViData } from './useViData';
import { wrapped, wrappedYears } from './viLogic';

export function Wrapped({ data }: { data: ViData }) {
  const t = useT();
  const years = useMemo(() => wrappedYears(data.input), [data.input]);
  const [year, setYear] = useState(years[0]);
  const w = useMemo(() => wrapped(data.input, year), [data.input, year]);
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);

  const slides: { big: string; sub?: string }[] = [];
  if (w) {
    slides.push({ big: t('wrapped.bild.resor', { antal: w.trips }) });
    slides.push({ big: t('wrapped.bild.lander', { antal: w.countries.length }), sub: w.countries.map((c) => placeName(data.places, c)).join(', ') });
    slides.push({ big: t('wrapped.bild.dagar', { antal: w.days }) });
    if (w.finds) slides.push({ big: t('wrapped.bild.fynd', { antal: w.finds }) });
    if (w.bucket) slides.push({ big: t('wrapped.bild.bucket', { antal: w.bucket }) });
    if (w.longest) {
      const lt = w.longest.trip;
      slides.push({ big: t('wrapped.bild.langst', { plats: lt.place_id ? placeName(data.places, lt.place_id) : lt.title, dagar: w.longest.days }) });
    }
    slides.push({ big: t('wrapped.slut', { ar: w.year }) });
  }

  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    const k = Math.max(0, Math.min(slides.length - 1, n));
    el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' });
    setI(k);
  };

  return (
    <section className="col vi-wrapped">
      <h2 className="h3">{t('wrapped.rubrik')}</h2>
      <label>
        {t('wrapped.valj-ar')}
        <select
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
            setI(0);
            track.current?.scrollTo({ left: 0 });
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      {!w ? (
        <div className="card soft">
          <p>{t('wrapped.tom')}</p>
        </div>
      ) : (
        <>
          <div
            className="wr"
            ref={track}
            onScroll={(e) => {
              const el = e.currentTarget;
              setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
          >
            {slides.map((s, k) => (
              <div key={k} className="hero wr-slide" aria-hidden={k !== i}>
                <span className="eb">{w.year}</span>
                <span className="big">{s.big}</span>
                {s.sub && <span>{s.sub}</span>}
              </div>
            ))}
          </div>
          <div className="row">
            <button type="button" className="chip" onClick={() => go(i - 1)} disabled={i === 0}>
              {t('knapp.tillbaka')}
            </button>
            <span className="dots" aria-hidden="true">
              {slides.map((_, k) => (
                <i key={k} className={k === i ? 'on' : ''} />
              ))}
            </span>
            <button type="button" className="chip" onClick={() => go(i + 1)} disabled={i >= slides.length - 1}>
              {t('knapp.nasta')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
