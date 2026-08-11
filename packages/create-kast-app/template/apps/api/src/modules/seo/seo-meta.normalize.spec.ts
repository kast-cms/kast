import { blankTextToNull } from './seo-meta.normalize';

describe('blankTextToNull (SEO-04: one representation for "cleared")', () => {
  it('stores a cleared title and description as null, not as an empty string', () => {
    // R15's exact body: the only clear the old SDK type could express.
    const out = blankTextToNull({ metaTitle: '', metaDescription: '' });

    expect(out).toEqual({ metaTitle: null, metaDescription: null });
  });

  it('treats a whitespace-only value as cleared', () => {
    expect(blankTextToNull({ metaTitle: '   ', canonicalUrl: '\t\n' })).toEqual({
      metaTitle: null,
      canonicalUrl: null,
    });
  });

  it('normalises every text column, so no field keeps the ambiguous form', () => {
    const out = blankTextToNull({
      metaTitle: '',
      metaDescription: '',
      ogTitle: '',
      ogDescription: '',
      twitterTitle: '',
      twitterDesc: '',
      canonicalUrl: '',
    });

    expect(Object.values(out).every((v) => v === null)).toBe(true);
  });

  it('leaves real values untouched, including ones that merely contain spaces', () => {
    const out = blankTextToNull({ metaTitle: 'Hello world', metaDescription: ' padded ' });

    expect(out).toEqual({ metaTitle: 'Hello world', metaDescription: ' padded ' });
  });

  it('does not invent keys the caller omitted', () => {
    // upsertMeta patches only what it is given; turning an absent key into null
    // would clear a column the client never mentioned.
    const out = blankTextToNull({ metaTitle: '' });

    expect(Object.hasOwn(out, 'metaDescription')).toBe(false);
    expect(Object.keys(out)).toEqual(['metaTitle']);
  });

  it('leaves booleans and media ids alone', () => {
    const out = blankTextToNull({ noIndex: false, noFollow: true, ogImageId: 'm1' });

    expect(out).toEqual({ noIndex: false, noFollow: true, ogImageId: 'm1' });
  });
});
