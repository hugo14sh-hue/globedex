import { useId } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Språket i etiketten, när det skiljer sig från sidans (till exempel språkvalet). */
  lang?: string;
}

/** Segmentväljare, ett val i taget. Knapparna har aria-pressed som i prototypen. */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Synlig rubrik ovanför, och namn för skärmläsare. */
  label?: string;
  /** Namn för skärmläsare när ingen rubrik syns. */
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div className="col">
      {label && (
        <span className="eb" id={id}>
          {label}
        </span>
      )}
      <div className="seg" role="group" aria-labelledby={label ? id : undefined} aria-label={label ? undefined : ariaLabel}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            disabled={o.disabled}
            lang={o.lang}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
