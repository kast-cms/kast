import { BadRequestException } from '@nestjs/common';
import { generateSlug, normalizeSlug, requireSlug, resolveEntrySlug } from './content-slug';

describe('content slug rules', () => {
  describe('normalizeSlug', () => {
    it.each([
      ['Hello World', 'hello-world'],
      ['  Trim  Me  ', 'trim-me'],
      ['Already-Slugged', 'already-slugged'],
      ['a//b__c', 'a-b-c'],
      ['---leading and trailing---', 'leading-and-trailing'],
      ['Price: $10 (50% off)!', 'price-10-50-off'],
      ['post_2026', 'post-2026'],
    ])('normalizes %j to %j', (raw, expected) => {
      expect(normalizeSlug(raw)).toBe(expected);
    });

    it('keeps non-Latin letters instead of stripping the whole slug', () => {
      expect(normalizeSlug('مرحبا بالعالم')).toBe('مرحبا-بالعالم');
    });

    it('returns an empty string when nothing slug-safe is left', () => {
      expect(normalizeSlug('///')).toBe('');
      expect(normalizeSlug('')).toBe('');
    });

    it('caps the length and leaves no trailing hyphen', () => {
      const slug = normalizeSlug(`${'a'.repeat(199)} tail`);
      expect(slug).toHaveLength(199);
      expect(slug.endsWith('-')).toBe(false);
    });
  });

  describe('requireSlug', () => {
    it('rejects a value that normalizes to nothing', () => {
      expect(() => requireSlug('!!!', 'slug')).toThrow(BadRequestException);
    });
  });

  describe('generateSlug', () => {
    it('does not repeat itself for two entries created in the same millisecond', () => {
      // A clock-derived slug collided on the (localeCode, slug) unique index.
      const slugs = new Set(Array.from({ length: 50 }, () => generateSlug('blog')));
      expect(slugs.size).toBe(50);
      expect([...slugs][0]).toMatch(/^blog-[0-9a-f]{12}$/);
    });
  });

  describe('resolveEntrySlug', () => {
    it('prefers the explicit slug over one inside data', () => {
      expect(resolveEntrySlug('blog', 'From Request', { slug: 'from-data' })).toBe('from-request');
    });

    it('falls back to data.slug', () => {
      expect(resolveEntrySlug('blog', undefined, { slug: 'From Data' })).toBe('from-data');
    });

    it('generates one when neither is usable', () => {
      expect(resolveEntrySlug('blog', undefined, { slug: '   ' })).toMatch(/^blog-/);
      expect(resolveEntrySlug('blog', undefined, { slug: 42 })).toMatch(/^blog-/);
      expect(resolveEntrySlug('blog', undefined, {})).toMatch(/^blog-/);
    });

    it('rejects an explicit slug with nothing slug-safe rather than replacing it', () => {
      expect(() => resolveEntrySlug('blog', '###', {})).toThrow(BadRequestException);
    });
  });
});
