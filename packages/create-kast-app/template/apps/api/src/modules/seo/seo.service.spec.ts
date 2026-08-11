import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import { EMPTY_SEO_SETTINGS, type SeoSettings } from './seo-settings';
import type { SeoRepository } from './seo.repository';
import { MAX_REDIRECT_IMPORT_ROWS, SeoService } from './seo.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

/** A content type with a rich-text body is gated by default (see resolveGatePolicy). */
const BODY_FIELDS = [
  { name: 'body', type: 'RICH_TEXT' },
  { name: 'title', type: 'TEXT' },
];

function richTextDoc(words: number, withH2: boolean): unknown {
  const text = Array.from({ length: words }, (_, i) => ({ type: 'text', text: `word${i}` }));
  return {
    type: 'doc',
    content: [
      ...(withH2
        ? [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] }]
        : []),
      { type: 'paragraph', content: text },
    ],
  };
}

describe('SeoService', () => {
  let repo: Mocked<SeoRepository>;
  let prisma: { contentEntry: { findUnique: jest.Mock } };
  let queue: Mocked<Queue>;
  let service: SeoService;

  const settings = (over: Partial<SeoSettings> = {}): SeoSettings => ({
    ...EMPTY_SEO_SETTINGS,
    ...over,
  });

  beforeEach(() => {
    repo = {
      upsertMeta: jest.fn(),
      ensureMeta: jest.fn().mockResolvedValue({ id: 'created-meta' }),
      findSeoSettings: jest.fn().mockResolvedValue(settings()),
      findRobotsTxt: jest.fn(),
      findMeta: jest.fn(),
      findLatestScore: jest.fn(),
      findScoreHistory: jest.fn(),
      saveScore: jest.fn().mockResolvedValue(undefined),
      findAllRedirects: jest.fn(),
      createRedirect: jest.fn(),
      findExistingFromPaths: jest.fn(),
      createManyRedirects: jest.fn(),
      findAllRedirectsForExport: jest.fn(),
      updateRedirect: jest.fn(),
      deleteRedirect: jest.fn(),
      findRedirectById: jest.fn(),
      findPublishedWithCanonical: jest.fn(),
      findPublishedEntriesForSitemap: jest.fn(),
      findActiveLocales: jest.fn(),
    } as unknown as Mocked<SeoRepository>;
    prisma = { contentEntry: { findUnique: jest.fn() } };
    queue = { add: jest.fn() } as unknown as Mocked<Queue>;
    const config = {
      get: jest.fn().mockReturnValue('https://kast.example.com/'),
    } as unknown as ConfigService;

    service = new SeoService(
      repo as unknown as SeoRepository,
      prisma as unknown as PrismaService,
      config,
      queue as unknown as Queue,
    );
  });

  const cleanMeta = {
    id: 'meta1',
    metaTitle: 'A perfectly reasonable SEO title of decent length',
    metaDescription:
      'A meta description that comfortably sits within the fifty to one hundred sixty character sweet spot for SEO.',
    ogImageId: 'img1',
    canonicalUrl: 'https://kast.example.com/blog/post',
  };

  describe('validateNow (scoring)', () => {
    it('treats a missing SeoMeta as all-missing issues and persists the score against a created meta', async () => {
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'good-slug', data: null }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      // title_missing + slug missing? (slug is valid) -> title is an ERROR.
      expect(result.errors.some((i) => i.type === 'title_missing')).toBe(true);
      expect(result.score).toBeLessThan(100);
      expect(repo.ensureMeta).toHaveBeenCalledWith('e1');
      expect(repo.saveScore).toHaveBeenCalledWith('created-meta', result.score, result.issues);
    });

    it('does not create a meta row for an entry that does not exist', async () => {
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue(null);

      await service.validateNow('gone');

      expect(repo.ensureMeta).not.toHaveBeenCalled();
      expect(repo.saveScore).not.toHaveBeenCalled();
    });

    it('flags an invalid slug as an ERROR-severity issue', async () => {
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'Bad Slug!', data: null }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });
      const result = await service.validateNow('e1');
      expect(result.errors.some((i) => i.type === 'slug_invalid')).toBe(true);
    });

    it('persists a score when SeoMeta exists and computes a perfect score for clean meta', async () => {
      repo.findMeta.mockResolvedValue(cleanMeta);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: { body: richTextDoc(320, true) } }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result.score).toBe(100);
      expect(result.errors).toHaveLength(0);
      expect(repo.ensureMeta).not.toHaveBeenCalled();
      expect(repo.saveScore).toHaveBeenCalledWith('meta1', 100, expect.any(Array));
    });
  });

  describe('validateNow (body analysis)', () => {
    it('scores the configured rich-text fields, not the whole field map', async () => {
      repo.findMeta.mockResolvedValue(cleanMeta);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [
          {
            slug: 'valid-slug',
            // The map itself holds no text nodes: scoring it as one document
            // used to report an empty body for a 320-word entry.
            data: { title: 'First', body: richTextDoc(320, true) },
          },
        ],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result.issues.map((i) => i.type)).not.toContain('body_short');
      expect(result.issues.map((i) => i.type)).not.toContain('body_no_h2');
    });

    it('adds up every rich-text field and accepts HTML-string bodies', async () => {
      repo.findMeta.mockResolvedValue(cleanMeta);
      const half = Array.from({ length: 160 }, (_, i) => `word${String(i)}`).join(' ');
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [
          {
            slug: 'valid-slug',
            data: { body: `<h2>Intro</h2><p>${half}</p>`, extra: `<p>${half}</p>` },
          },
        ],
        contentType: {
          name: 'article',
          fields: [
            { name: 'body', type: 'RICH_TEXT' },
            { name: 'extra', type: 'RICH_TEXT' },
          ],
        },
      });

      const result = await service.validateNow('e1');

      expect(result.issues.map((i) => i.type)).not.toContain('body_short');
      expect(result.issues.map((i) => i.type)).not.toContain('body_no_h2');
    });

    it('reports a short body when the rich-text field is under the minimum', async () => {
      repo.findMeta.mockResolvedValue(cleanMeta);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: { body: richTextDoc(10, false) } }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result.issues.map((i) => i.type)).toEqual(
        expect.arrayContaining(['body_short', 'body_no_h2']),
      );
    });

    it('skips body checks for a content type with no rich-text field', async () => {
      repo.findMeta.mockResolvedValue(cleanMeta);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: { name: 'Tutorials' } }],
        contentType: { name: 'blog-category', fields: [{ name: 'name', type: 'TEXT' }] },
      });

      const result = await service.validateNow('e1');

      expect(result.issues.map((i) => i.type)).not.toContain('body_missing');
    });
  });

  describe('validateNow (gate policy)', () => {
    const taxonomyEntry = {
      id: 'e1',
      locales: [{ slug: 'blog-category', data: { name: 'Tutorials' } }],
      contentType: { name: 'blog-category', fields: [{ name: 'name', type: 'TEXT' }] },
    };

    it('does not block a body-less content type by default, but still scores it', async () => {
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue(taxonomyEntry);

      const result = await service.validateNow('e1');

      expect(result.policy).toBe('advisory');
      expect(result.issues.some((i) => i.type === 'title_missing')).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(repo.saveScore).toHaveBeenCalled();
    });

    it('blocks a page-like content type by default', async () => {
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: {} }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result.policy).toBe('enforce');
      expect(result.errors.some((i) => i.type === 'title_missing')).toBe(true);
    });

    it('honours a per-content-type override that enforces a body-less type', async () => {
      repo.findSeoSettings.mockResolvedValue(
        settings({ gateByContentType: { 'blog-category': 'enforce' } }),
      );
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue(taxonomyEntry);

      const result = await service.validateNow('e1');

      expect(result.policy).toBe('enforce');
      expect(result.errors.some((i) => i.type === 'title_missing')).toBe(true);
    });

    it('skips analysis entirely for a disabled content type', async () => {
      repo.findSeoSettings.mockResolvedValue(
        settings({ gateByContentType: { article: 'disabled' } }),
      );
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: {} }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result).toMatchObject({ policy: 'disabled', issues: [], errors: [], warnings: [] });
      expect(repo.saveScore).not.toHaveBeenCalled();
    });

    it('applies a configured global default policy to types without an override', async () => {
      repo.findSeoSettings.mockResolvedValue(settings({ gateDefaultPolicy: 'advisory' }));
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: {} }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result.policy).toBe('advisory');
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateNow (site defaults)', () => {
    it('falls back to the saved global title/description and flags the fallback', async () => {
      repo.findSeoSettings.mockResolvedValue(
        settings({
          defaultMetaTitle: 'A perfectly reasonable SEO title of decent length',
          defaultMetaDescription:
            'A meta description that comfortably sits within the fifty to one hundred sixty character sweet spot for SEO.',
        }),
      );
      repo.findMeta.mockResolvedValue({
        id: 'meta1',
        metaTitle: null,
        metaDescription: null,
        ogImageId: 'img1',
        canonicalUrl: 'https://kast.example.com/blog/post',
      });
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: { body: richTextDoc(320, true) } }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result.errors).toEqual([]);
      expect(result.issues.map((i) => i.type)).toEqual(
        expect.arrayContaining(['title_from_site_default', 'desc_from_site_default']),
      );
    });

    it('still reports a missing title when no global default is saved', async () => {
      repo.findMeta.mockResolvedValue({
        id: 'meta1',
        metaTitle: null,
        metaDescription: null,
        ogImageId: 'img1',
        canonicalUrl: 'https://kast.example.com/blog/post',
      });
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'valid-slug', data: { body: richTextDoc(320, true) } }],
        contentType: { name: 'article', fields: BODY_FIELDS },
      });

      const result = await service.validateNow('e1');

      expect(result.errors.map((i) => i.type)).toContain('title_missing');
      expect(result.issues.map((i) => i.type)).not.toContain('title_from_site_default');
    });
  });

  describe('redirect CRUD', () => {
    it('throws NotFound updating a missing redirect', async () => {
      repo.findRedirectById.mockResolvedValue(null);
      await expect(service.updateRedirect('r1', { toPath: '/new' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound deleting a missing redirect', async () => {
      repo.findRedirectById.mockResolvedValue(null);
      await expect(service.deleteRedirect('r1')).rejects.toThrow(NotFoundException);
    });

    it('updates an existing redirect', async () => {
      repo.findRedirectById.mockResolvedValue({ id: 'r1' });
      repo.updateRedirect.mockResolvedValue({ id: 'r1', toPath: '/new' });
      const result = await service.updateRedirect('r1', { toPath: '/new' });
      expect(result.toPath).toBe('/new');
    });
  });

  describe('redirect target policy', () => {
    it('accepts a site-relative target', async () => {
      repo.createRedirect.mockResolvedValue({ id: 'r1' });
      await service.createRedirect({ fromPath: '/old', toPath: '/new' }, 'user');
      expect(repo.createRedirect).toHaveBeenCalled();
    });

    it('rejects an external target while no host is allow-listed', async () => {
      await expect(
        service.createRedirect({ fromPath: '/old', toPath: 'https://evil.example/phish' }, 'user'),
      ).rejects.toThrow(BadRequestException);
      expect(repo.createRedirect).not.toHaveBeenCalled();
    });

    it('rejects a protocol-relative target', async () => {
      await expect(
        service.createRedirect({ fromPath: '/old', toPath: '//evil.example' }, 'user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts an external target whose host the operator allow-listed', async () => {
      repo.findSeoSettings.mockResolvedValue(
        settings({ redirectAllowedHosts: ['docs.example.com'] }),
      );
      repo.createRedirect.mockResolvedValue({ id: 'r1' });
      await service.createRedirect(
        { fromPath: '/old', toPath: 'https://docs.example.com/guide' },
        'user',
      );
      expect(repo.createRedirect).toHaveBeenCalled();
    });

    it('rejects an external target on update as well', async () => {
      repo.findRedirectById.mockResolvedValue({ id: 'r1' });
      await expect(
        service.updateRedirect('r1', { toPath: 'https://evil.example' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateRedirect).not.toHaveBeenCalled();
    });

    it('leaves the target untouched when an update does not change it', async () => {
      repo.findRedirectById.mockResolvedValue({ id: 'r1' });
      repo.updateRedirect.mockResolvedValue({ id: 'r1', isActive: false });
      await service.updateRedirect('r1', { isActive: false });
      expect(repo.updateRedirect).toHaveBeenCalled();
    });
  });

  describe('importRedirects', () => {
    it('returns empty result for empty CSV', async () => {
      const result = await service.importRedirects('', 'user');
      expect(result).toEqual({ imported: 0, skipped: 0, errors: [] });
    });

    it('imports valid rows, skips existing, and reports malformed + duplicate rows', async () => {
      // Header is auto-detected and dropped. Row 3 is malformed (missing toPath),
      // row 5 duplicates /a within the file, /b already exists in the DB.
      const csv = [
        'fromPath,toPath,type,isActive',
        '/a,/a-new,PERMANENT,true',
        '/b,/b-new,TEMPORARY,true',
        '/bad,,PERMANENT,true',
        '/c,/c-new,PERMANENT,false',
        '/a,/a-dup,PERMANENT,true',
      ].join('\n');
      repo.findExistingFromPaths.mockResolvedValue(new Set(['/b']));
      repo.createManyRedirects.mockImplementation((rows: unknown[]) =>
        Promise.resolve(rows.length),
      );

      const result = await service.importRedirects(csv, 'user');

      // /a and /c inserted (2). /b skipped (existing). /a duplicate skipped. /bad errored.
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(2);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason: expect.stringMatching(/Missing/) }),
          expect.objectContaining({ reason: 'Duplicate fromPath' }),
        ]),
      );
      const inserted = repo.createManyRedirects.mock.calls[0]?.[0] as { fromPath: string }[];
      expect(inserted.map((r) => r.fromPath).sort()).toEqual(['/a', '/c']);
    });

    it('refuses a CSV with more rows than the import cap', async () => {
      repo.findExistingFromPaths.mockResolvedValue(new Set());
      const csv = Array.from(
        { length: MAX_REDIRECT_IMPORT_ROWS + 1 },
        (_, i) => `/from-${i},/to-${i},PERMANENT,true`,
      ).join('\n');

      await expect(service.importRedirects(csv, 'user')).rejects.toThrow(BadRequestException);
      expect(repo.createManyRedirects).not.toHaveBeenCalled();
    });

    it('reports rows whose target the redirect policy refuses', async () => {
      repo.findExistingFromPaths.mockResolvedValue(new Set());
      repo.createManyRedirects.mockImplementation((rows: unknown[]) =>
        Promise.resolve(rows.length),
      );
      const csv = ['/a,/a-new,PERMANENT,true', '/b,https://evil.example,PERMANENT,true'].join('\n');

      const result = await service.importRedirects(csv, 'user');

      expect(result.imported).toBe(1);
      expect(result.errors).toEqual([
        expect.objectContaining({ row: 2, reason: expect.stringMatching(/evil\.example/) }),
      ]);
    });

    it('rejects an invalid redirect type', async () => {
      repo.findExistingFromPaths.mockResolvedValue(new Set());
      repo.createManyRedirects.mockResolvedValue(0);
      const csv = '/x,/y,SIDEWAYS,true';
      const result = await service.importRedirects(csv, 'user');
      expect(result.imported).toBe(0);
      expect(result.errors[0]?.reason).toMatch(/Invalid type/);
    });
  });

  describe('exportRedirectsCsv', () => {
    it('emits a header plus one row per redirect', async () => {
      repo.findAllRedirectsForExport.mockResolvedValue([
        { fromPath: '/a', toPath: '/b', type: 'PERMANENT', isActive: true, hitCount: 3 },
        { fromPath: '/c,x', toPath: '/d', type: 'TEMPORARY', isActive: false, hitCount: 0 },
      ]);
      const csv = await service.exportRedirectsCsv();
      const lines = csv.split('\n');
      expect(lines[0]).toBe('fromPath,toPath,type,isActive,hitCount');
      expect(lines[1]).toBe('/a,/b,PERMANENT,true,3');
      // value containing a comma is quoted by toCsvRow
      expect(lines[2]).toBe('"/c,x",/d,TEMPORARY,false,0');
    });
  });

  describe('buildSitemapEntries', () => {
    it('builds per-locale hreflang alternates with the default locale at the bare path', async () => {
      repo.findPublishedEntriesForSitemap.mockResolvedValue([
        {
          id: 'e1',
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          contentTypeName: 'blog',
          locales: [
            { localeCode: 'en', slug: 'hello' },
            { localeCode: 'ar', slug: 'marhaba' },
          ],
        },
      ]);
      repo.findActiveLocales.mockResolvedValue([
        { code: 'en', isDefault: true },
        { code: 'ar', isDefault: false },
      ]);

      const entries = await service.buildSitemapEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]?.loc).toBe('https://kast.example.com/blog/hello');
      const hrefs = entries[0]?.alternates.map((a) => a.href);
      expect(hrefs).toContain('https://kast.example.com/blog/hello');
      expect(hrefs).toContain('https://kast.example.com/ar/blog/marhaba');
    });
  });

  describe('getMeta / getScore', () => {
    it('throws NotFound when no meta exists', async () => {
      repo.findMeta.mockResolvedValue(null);
      await expect(service.getMeta('e1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when no score exists', async () => {
      repo.findLatestScore.mockResolvedValue(null);
      await expect(service.getScore('e1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('enqueueValidation (SEO-02: re-validation must not be deduped forever)', () => {
    it('dedupes by entry id so a burst of requests queues one job', async () => {
      await service.enqueueValidation('e1');

      expect(queue.add).toHaveBeenCalledWith(
        'validate',
        { entryId: 'e1' },
        expect.objectContaining({ jobId: 'seo-e1' }),
      );
    });

    it('does not retain the settled job, so the entry can be validated again', async () => {
      await service.enqueueValidation('e1');

      // BullMQ refuses an `add` whose jobId already exists in ANY state, and the
      // queue-wide defaults keep 1000 completed / 5000 failed jobs. A fixed jobId
      // that outlives its run therefore makes validation once-per-entry: the API
      // keeps answering 202 while the worker never runs again and GET
      // /seo/score/:id 404s forever. Both flags must clear the id on settle.
      const options = queue.add.mock.calls[0]?.[2];
      expect(options?.removeOnComplete).toBe(true);
      expect(options?.removeOnFail).toBe(true);
    });
  });
});
