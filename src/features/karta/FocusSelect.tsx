// Kartans fokus som rullgardin (Körning 16): hela världen, de sex bebodda världsdelarna och appens länder med
// sökfält. Knappen fäller ut en panel med vanliga knappar. Pil upp och ned flyttar mellan valen och sökfältet,
// Escape stänger och lämnar fokus på knappen. Valet markeras med aria-current.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../components/Icon';
import { countryName } from '../../lib/content';
import { continentLabel } from '../../lib/continentNames';
import { APP_COUNTRIES } from '../../lib/landlistor';
import { withSplit } from '../../lib/delade';
import { useTheme } from '../../theme/ThemeProvider';
import { LOCALE } from '../../lib/locale';
import { countryOptions, FOCUS_CONTINENTS, parseFocus, WORLD, type FocusOption } from '../../lib/mapFocus';
import { M49 } from '../../lib/continentNames';
import { useT } from '../../lib/useT';

export function FocusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const continents = useMemo<FocusOption[]>(
    () =>
      FOCUS_CONTINENTS.map((c) => ({ value: M49[c], label: continentLabel(c, t) })).sort((a, b) => a.label.localeCompare(b.label, LOCALE)),
    [t],
  );
  // Delade länder: med valet på finns delarna (England, Skottland, Wales, Nordirland) i stället för landet.
  const split = useTheme().theme.splitCountries;
  const countries = useMemo(() => countryOptions(withSplit(APP_COUNTRIES, split), countryName, LOCALE, query), [query, split]);

  const f = parseFocus(value);
  const current =
    f?.kind === 'world' ? t('karta.fokus.varlden') : f?.kind === 'continent' ? continentLabel(f.code, t) : f ? countryName(f.iso) : '';

  // Öppen: fokus på det valda, annars på första valet. Klick utanför stänger.
  useEffect(() => {
    if (!open) return;
    const sel = panel.current?.querySelector<HTMLElement>('[aria-current="true"]') ?? panel.current?.querySelector<HTMLElement>('button');
    sel?.focus();
    sel?.scrollIntoView?.({ block: 'nearest' });
    const outside = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) trigger.current?.focus();
  };

  const pick = (v: string) => {
    onChange(v);
    close();
  };

  // Pil upp och ned mellan valen och sökfältet. Home och End till första och sista.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('button, input') ?? [])];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    // I sökfältet flyttar Home och End markören, inte fokus.
    if (document.activeElement?.tagName === 'INPUT' && (e.key === 'Home' || e.key === 'End')) return;
    e.preventDefault();
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
    items[next].focus();
  };

  const option = (o: FocusOption) => (
    <li key={o.value}>
      <button type="button" className="focus-opt" aria-current={o.value === value ? 'true' : undefined} onClick={() => pick(o.value)}>
        <span>{o.label}</span>
        {o.value === value && <Icon name="check" size={16} />}
      </button>
    </li>
  );

  return (
    <div className="focus-sel" ref={root}>
      {/* Namnet är karta.fokus.aria följt av valet, så att den synliga texten ingår i namnet (WCAG 2.5.3). */}
      <button
        ref={trigger}
        type="button"
        className="chip focus-btn"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-labelledby={`${id}-aria ${id}-val`}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={`${id}-aria`} className="sr-only">
          {t('karta.fokus.aria')}
        </span>
        <Icon name="map" size={16} />
        <span id={`${id}-val`} className="focus-val">
          {current}
        </span>
        <Icon name="down" size={16} />
      </button>
      {open && (
        <div className="focus-panel card" id={`${id}-panel`} ref={panel} onKeyDown={onKey}>
          <ul className="focus-list">{option({ value: WORLD, label: t('karta.fokus.varlden') })}</ul>
          <h3 className="eb" id={`${id}-vd`}>
            {t('karta.fokus.rubrik.varldsdelar')}
          </h3>
          <ul className="focus-list" aria-labelledby={`${id}-vd`}>
            {continents.map(option)}
          </ul>
          <h3 className="eb" id={`${id}-ld`}>
            {t('karta.fokus.rubrik.lander')}
          </h3>
          <label className="sr-only" htmlFor={`${id}-sok`}>
            {t('karta.fokus.sok')}
          </label>
          <input
            id={`${id}-sok`}
            className="focus-search"
            type="search"
            autoComplete="off"
            placeholder={t('karta.fokus.sok')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && countries.length === 1) {
                e.preventDefault();
                pick(countries[0].value);
              }
            }}
          />
          {countries.length ? (
            <ul className="focus-list" aria-labelledby={`${id}-ld`}>
              {countries.map(option)}
            </ul>
          ) : (
            <p className="mu" role="status">
              {t('karta.fokus.inga')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
