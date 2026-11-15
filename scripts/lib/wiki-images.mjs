// Bilder till listpunkterna från Wikipedia och Wikimedia Commons (npm run import:images).
// Ren logik utan nätverk och nycklar: adresser till API:erna och tolkning av svaren. Testas i wiki-images.test.mjs.

/** Bildens bredd i pixlar. */
export const THUMB_WIDTH = 800;

/** "en:Sidans titel" -> { lang: 'en', title: 'Sidans titel' }, eller null om formen är fel. */
export function parseWiki(wiki) {
  const m = typeof wiki === 'string' ? wiki.match(/^([a-z]{2,3}):(\S.*)$/) : null;
  return m ? { lang: m[1], title: m[2].trim() } : null;
}

const api = (host, params) => `https://${host}/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })}`;

/** Sidans huvudbild (pageimages), 800 px bred. Omdirigeringar följs. */
export const pageImageUrl = (lang, title) =>
  api(`${lang}.wikipedia.org`, { prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: String(THUMB_WIDTH), redirects: '1', titles: title });

/** Filens upphovsperson, licens och filsida på Commons (imageinfo, extmetadata). */
export const commonsInfoUrl = (file) =>
  api('commons.wikimedia.org', {
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'Artist|Credit|LicenseShortName|License',
    titles: `File:${file}`,
  });

/**
 * Tolkar svaret från pageimages. Svarar med { status: 'sida-saknas' }, { status: 'bild-saknas' }
 * eller { status: 'ok', file, thumb }.
 */
export function readPageImage(json) {
  const page = json?.query?.pages?.[0];
  if (!page || page.missing || page.invalid) return { status: 'sida-saknas' };
  if (!page.pageimage || !page.thumbnail?.source) return { status: 'bild-saknas' };
  return { status: 'ok', file: page.pageimage, thumb: page.thumbnail.source };
}

/** Tar bort html-taggar och entiteter och slår ihop blanksteg. */
export function stripHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Licenser som får sparas: CC0, Public domain, CC BY och CC BY-SA (alla versioner). Svarar med
 * licensens korta namn som det ska visas, eller null för andra licenser (GFDL, NC, ND, okänd).
 */
export function allowedLicense(shortName, license) {
  const s = stripHtml(shortName);
  const l = typeof license === 'string' ? license.toLowerCase() : '';
  if (/^cc0\b/i.test(s) || l === 'cc0') return 'CC0';
  if (/^public domain$/i.test(s) || /^pd\b/i.test(s) || l === 'pd' || l.startsWith('pd-')) return 'Public domain';
  if (/^cc by(-sa)? \d/i.test(s) && !/\b(nc|nd)\b/i.test(s)) return s.replace(/^cc by/i, 'CC BY');
  return null;
}

/**
 * Tolkar svaret från Commons. Svarar med { status: 'inte-commons' } när filen inte ligger på Commons
 * (till exempel en bild med begränsad rätt som bara finns på Wikipedia), { status: 'licens', license }
 * för en licens som inte får användas, eller { status: 'ok', credit, license, page }.
 */
export function readCommonsInfo(json) {
  const page = json?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || page.missing || !info) return { status: 'inte-commons' };
  const meta = info.extmetadata ?? {};
  const license = allowedLicense(meta.LicenseShortName?.value, meta.License?.value);
  if (!license) return { status: 'licens', license: stripHtml(meta.LicenseShortName?.value) || null };
  const credit = stripHtml(meta.Artist?.value) || null;
  return { status: 'ok', credit, license, page: info.descriptionurl ?? null };
}

/** Listpunkter som ska få bild: de med wiki, utan image_url om inte force. */
export const needsImage = (item, force) => Boolean(item.wiki) && (force || !item.image_url);
