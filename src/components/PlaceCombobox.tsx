// Sökfält med förslag för att välja land eller plats (combobox enligt WAI-ARIA 1.2, med lista).
// Förslagen visas i två grupper, länder (med flagga) och städer och regioner (med landets namn efter).
// Matchningen står i src/lib/search.ts. Används överallt där man väljer land eller plats.
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { search } from '../lib/search';
import { useT } from '../lib/useT';
import { Flag } from './Flag';

export interface PlaceOption {
  id: string;
  name: string;
  /** Länder hamnar i gruppen resa.vart.lander, allt annat i resa.vart.stader. */
  country: boolean;
  /** Landets namn, visas efter en stad eller region. */
  countryName?: string;
  /** Alla namn som sökningen matchar (platsens namn på svenska och engelska). Saknas: bara name. */
  names?: string[];
}

/** Hur många förslag som visas per grupp innan man har skrivit något. */
const MAX_EMPTY = 60;

export function PlaceCombobox({
  label,
  options,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  options: PlaceOption[];
  value: string;
  onChange: (id: string) => void;
  /** Tillåt inget val: ett tömt fält tar bort valet. */
  optional?: boolean;
}) {
  const t = useT();
  const id = useId();
  const listId = `${id}-lista`;
  const selected = options.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const text = query ?? selected?.name ?? '';
  const q = query ?? '';
  const groups = useMemo(() => {
    const hits = search(options, q, (o) => o.names ?? o.name);
    const limit = q.trim() ? Infinity : MAX_EMPTY;
    return [
      { key: 'resa.vart.lander', list: hits.filter((o) => o.country).slice(0, limit) },
      { key: 'resa.vart.stader', list: hits.filter((o) => !o.country).slice(0, limit) },
    ].filter((g) => g.list.length > 0);
  }, [options, q]);
  const flat = groups.flatMap((g) => g.list);
  const optionId = (i: number) => `${id}-o${i}`;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const pick = (o: PlaceOption) => {
    onChange(o.id);
    setQuery(null);
    close();
  };
  const move = (step: number) => {
    if (!open) setOpen(true);
    if (!flat.length) return;
    const next = active < 0 ? (step > 0 ? 0 : flat.length - 1) : (active + step + flat.length) % flat.length;
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(e.altKey ? 0 : 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && flat[active]) {
        e.preventDefault();
        pick(flat[active]);
      } else if (open && flat.length === 1) {
        e.preventDefault();
        pick(flat[0]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        close();
      } else if (query !== null) {
        setQuery(null);
      }
    }
  };

  // Lämnas fältet utan val går texten tillbaka till det valda namnet. Ett tömt valfritt fält tar bort valet.
  const onBlur = () => {
    if (query !== null && !query.trim() && optional && value) onChange('');
    setQuery(null);
    close();
  };

  let index = -1;
  return (
    <div className="cbx">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={t('resa.vart.sok')}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKey}
        onBlur={onBlur}
      />
      <div id={listId} role="listbox" aria-label={t('resa.vart.sok')} className="cbx-list" hidden={!open || !flat.length}>
        {groups.map((g) => (
          <div key={g.key} role="group" aria-labelledby={`${id}-${g.key}`}>
            <div id={`${id}-${g.key}`} role="presentation" className="cbx-head">
              {t(g.key)}
            </div>
            {g.list.map((o) => {
              index++;
              const i = index;
              return (
                <div
                  key={o.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={o.id === value}
                  className={`cbx-opt${i === active ? ' active' : ''}`}
                  // Fältet ska inte tappa fokus innan valet är gjort.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  {o.country && <Flag placeId={o.id} />}
                  <span className="t">
                    <b>{o.name}</b>
                    {!o.country && o.countryName && <span className="mu">{o.countryName}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mu cbx-none" role="status">
        {open && query !== null && query.trim() !== '' && !flat.length ? t('resa.vart.inga') : ''}
      </p>
    </div>
  );
}
