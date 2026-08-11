import { describe, expect, it } from '@/test/jest-globals';
import { buildSeoMetaBody } from './seo-meta-body';

describe('buildSeoMetaBody', () => {
  it('clears meta with null instead of the empty string the panel holds', () => {
    // '' makes the API fall back to seo.defaultMetaTitle while delivery ships
    // the blank string, so the score and the served payload disagree.
    const body = buildSeoMetaBody({
      metaTitle: '',
      metaDescription: '   ',
      canonicalUrl: '',
      ogImage: '',
    });

    expect(body.metaTitle).toBeNull();
    expect(body.metaDescription).toBeNull();
    expect(body.canonicalUrl).toBeNull();
  });

  it('sends the entry values when the panel is filled in', () => {
    const body = buildSeoMetaBody({
      metaTitle: 'Hello world',
      metaDescription: 'A post about hello world',
      canonicalUrl: 'https://example.com/hello-world',
      ogImage: 'https://cdn.example.com/og.png',
    });

    expect(body.metaTitle).toBe('Hello world');
    expect(body.metaDescription).toBe('A post about hello world');
    expect(body.canonicalUrl).toBe('https://example.com/hello-world');
  });

  it('never sends the panel URL as an ogImageId, which is a media id', () => {
    const body = buildSeoMetaBody({ ogImage: 'https://cdn.example.com/og.png' });

    expect('ogImageId' in body).toBe(false);
  });
});
