import { useT } from '../lib/useT';

/** Prisnivån som fem markeringar där level stycken är fyllda. Läses upp med pris.niva.aria. */
export function PriceLevel({ level, small = false }: { level: number; small?: boolean }) {
  const t = useT();
  return (
    <span className={small ? 'plevel small' : 'plevel'} role="img" aria-label={t('pris.niva.aria', { niva: level })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= level ? 'on' : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}
