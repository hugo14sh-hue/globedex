import { describe, expect, it } from 'vitest';
import { allowedLicense, commonsInfoUrl, needsImage, pageImageUrl, parseWiki, readCommonsInfo, readPageImage, stripHtml } from './wiki-images.mjs';

// Svaren är förkortade exempel i API:ernas form, inte riktiga data.
describe('bilder från Wikipedia', () => {
  it('läser wiki-fältet', () => {
    expect(parseWiki('en:Monte Carlo Casino')).toEqual({ lang: 'en', title: 'Monte Carlo Casino' });
    expect(parseWiki('en:Þingvellir')).toEqual({ lang: 'en', title: 'Þingvellir' });
    expect(parseWiki('Monte Carlo')).toBeNull();
    expect(parseWiki(undefined)).toBeNull();
  });

  it('bygger adresserna till API:erna', () => {
    const u = new URL(pageImageUrl('en', "Prince's Palace of Monaco"));
    expect(u.host).toBe('en.wikipedia.org');
    expect(u.searchParams.get('prop')).toBe('pageimages');
    expect(u.searchParams.get('pithumbsize')).toBe('800');
    expect(u.searchParams.get('titles')).toBe("Prince's Palace of Monaco");
    const c = new URL(commonsInfoUrl('A b.jpg'));
    expect(c.host).toBe('commons.wikimedia.org');
    expect(c.searchParams.get('titles')).toBe('File:A b.jpg');
    expect(c.searchParams.get('iiprop')).toBe('url|extmetadata');
  });

  it('tolkar pageimages', () => {
    expect(readPageImage({ query: { pages: [{ title: 'X', missing: true }] } })).toEqual({ status: 'sida-saknas' });
    expect(readPageImage({ query: { pages: [{ title: 'X' }] } })).toEqual({ status: 'bild-saknas' });
    expect(readPageImage({ query: { pages: [{ title: 'X', pageimage: 'A.jpg', thumbnail: { source: 'https://upload.wikimedia.org/a.jpg' } }] } })).toEqual({
      status: 'ok',
      file: 'A.jpg',
      thumb: 'https://upload.wikimedia.org/a.jpg',
    });
  });

  it('godkänner bara CC0, Public domain, CC BY och CC BY-SA', () => {
    expect(allowedLicense('CC0', 'cc0')).toBe('CC0');
    expect(allowedLicense('Public domain', 'pd')).toBe('Public domain');
    expect(allowedLicense('PD-US', undefined)).toBe('Public domain');
    expect(allowedLicense('CC BY-SA 4.0', 'cc-by-sa-4.0')).toBe('CC BY-SA 4.0');
    expect(allowedLicense('CC BY 2.0', 'cc-by-2.0')).toBe('CC BY 2.0');
    expect(allowedLicense('CC BY-SA 3.0 de', 'cc-by-sa-3.0-de')).toBe('CC BY-SA 3.0 de');
    expect(allowedLicense('GFDL', 'gfdl')).toBeNull();
    expect(allowedLicense('CC BY-NC-SA 2.0', 'cc-by-nc-sa-2.0')).toBeNull();
    expect(allowedLicense('CC BY-ND 4.0', undefined)).toBeNull();
    expect(allowedLicense(undefined, undefined)).toBeNull();
  });

  it('rensar html ur upphovsnamnet', () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">X&nbsp;Y</a>')).toBe('X Y');
    expect(stripHtml('<span class="fn">A &amp; B</span>\n(<i>foto</i>)')).toBe('A & B ( foto )');
  });

  it('tolkar Commons', () => {
    const ok = {
      query: {
        pages: [
          {
            imageinfo: [
              {
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
                extmetadata: { Artist: { value: '<a href="x">Fotograf</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, License: { value: 'cc-by-sa-4.0' } },
              },
            ],
          },
        ],
      },
    };
    expect(readCommonsInfo(ok)).toEqual({ status: 'ok', credit: 'Fotograf', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:A.jpg' });
    const noArtist = structuredClone(ok);
    delete noArtist.query.pages[0].imageinfo[0].extmetadata.Artist;
    expect(readCommonsInfo(noArtist).credit).toBeNull();
    expect(readCommonsInfo({ query: { pages: [{ missing: true }] } })).toEqual({ status: 'inte-commons' });
    const gfdl = structuredClone(ok);
    gfdl.query.pages[0].imageinfo[0].extmetadata.LicenseShortName.value = 'GFDL';
    gfdl.query.pages[0].imageinfo[0].extmetadata.License.value = 'gfdl';
    expect(readCommonsInfo(gfdl)).toEqual({ status: 'licens', license: 'GFDL' });
  });

  it('väljer punkter med wiki och utan bild, eller alla med --force', () => {
    expect(needsImage({ wiki: 'en:A', image_url: null }, false)).toBe(true);
    expect(needsImage({ wiki: 'en:A', image_url: 'https://x' }, false)).toBe(false);
    expect(needsImage({ wiki: 'en:A', image_url: 'https://x' }, true)).toBe(true);
    expect(needsImage({ wiki: null, image_url: null }, true)).toBe(false);
  });
});
