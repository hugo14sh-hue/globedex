import { useT } from '../lib/useT';

/** Prisnivån som fem markeringar där level stycken är fyllda. Läses upp med pris.niva.aria, eller ariaKey (Upptäck). */
export function PriceLevel({ level, small = false, ariaKey = 'pris.niva.aria' }: { level: number; small?: boolean; ariaKey?: string }) {
  const t = useT();
  return (
    <span className={small ? 'plevel small' : 'plevel'} role="img" aria-label={t(ariaKey, { niva: level })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= level ? 'on' : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}
