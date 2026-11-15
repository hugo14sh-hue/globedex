// Bild på en listpunkt från Wikimedia Commons (place_items.image_url), med upphov och licens.
// Bilderna laddas direkt från upload.wikimedia.org och sparas av service workern (högst 60).
import type { PlaceItem } from '../lib/content';
import { useT } from '../lib/useT';

type WithImage = Pick<PlaceItem, 'name' | 'image_url' | 'image_credit' | 'image_license' | 'image_page'>;

/** Bilden överst på punktens sida, 16:9, med källan under i liten text. */
export function ItemImage({ item }: { item: WithImage }) {
  const t = useT();
  if (!item.image_url) return null;
  const credit = item.image_credit
    ? t('bild.kalla', { upphov: item.image_credit, licens: item.image_license ?? '' })
    : t('bild.kalla.okand', { licens: item.image_license ?? '' });
  return (
    <figure className="item-img">
      <img src={item.image_url} alt={t('bild.alt', { namn: item.name })} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      <figcaption>
        {item.image_page ? (
          <a href={item.image_page} target="_blank" rel="noopener noreferrer">
            {credit}
          </a>
        ) : (
          credit
        )}
      </figcaption>
    </figure>
  );
}

/** Liten rund miniatyr i listan. Dekor: namnet står bredvid. */
export function ItemThumb({ url }: { url?: string | null }) {
  if (!url) return null;
  return <img className="item-thumb" src={url} alt="" width={40} height={40} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
}
