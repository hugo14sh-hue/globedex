import { useState, type CSSProperties } from 'react';
import { onColor } from '../theme/color';
import { Icon } from './Icon';

/**
 * Landets flagga som dekor bredvid platsens namn (tom alt-text, namnet står bredvid).
 * Flaggorna kommer från flag-icons (MIT) och ligger i public/flags, utanför huvudpaketet:
 * bara de som visas hämtas. En stad eller region får en liten nål i hörnet. Statusfärgen
 * visas som en ring runt flaggan. Saknas flaggan visas landskoden som tidigare.
 */
export function Flag({ placeId, ring }: { placeId: string; ring?: string }) {
  const iso = placeId.slice(0, 2);
  const [failed, setFailed] = useState<string | null>(null);
  const sub = placeId.length > 2;
  if (!/^[A-Z]{2}$/.test(iso) || failed === iso)
    return (
      <span className="badge" style={ring ? { background: ring, color: onColor(ring) } : undefined}>
        {iso}
      </span>
    );
  return (
    <span className={ring ? 'flag ringed' : 'flag'} style={ring ? ({ '--ring': ring } as CSSProperties) : undefined}>
      <img
        src={`/flags/${iso.toLowerCase()}.svg`}
        alt=""
        width={34}
        height={26}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(iso)}
      />
      {sub && (
        <span className="flag-pin" aria-hidden="true">
          <Icon name="pin" size={12} stroke={2.4} />
        </span>
      )}
    </span>
  );
}
