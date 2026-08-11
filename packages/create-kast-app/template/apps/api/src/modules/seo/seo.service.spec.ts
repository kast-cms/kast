import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SeoRepository } from './seo.repository';
import { SeoService } from './seo.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

describe('SeoService', () => {
  let repo: Mocked<SeoRepository>;
  let prisma: { contentEntry: { findUnique: jest.Mock } };
  let queue: Mocked<Queue>;
  let service: SeoService;

  beforeEach(() => {
    repo = {
      upsertMeta: jest.fn(),
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

  describe('validateNow (scoring)', () => {
    it('treats a missing SeoMeta as all-missing issues and does not persist a score', async () => {
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'good-slug', data: null }],
      });

      const result = await service.validateNow('e1');

      // title_missing + slug missing? (slug is valid) -> title is an ERROR.
      expect(result.errors.some((i) => i.type === 'title_missing')).toBe(true);
      expect(result.score).toBeLessThan(100);
      expect(repo.saveScore).not.toHaveBeenCalled();
    });

    it('flags an invalid slug as an ERROR-severity issue', async () => {
      repo.findMeta.mockResolvedValue(null);
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [{ slug: 'Bad Slug!', data: null }],
      });
      const result = await service.validateNow('e1');
      expect(result.errors.some((i) => i.type === 'slug_invalid')).toBe(true);
    });

    it('persists a score when SeoMeta exists and computes a perfect score for clean meta', async () => {
      repo.findMeta.mockResolvedValue({
        id: 'meta1',
        metaTitle: 'A perfectly reasonable SEO title of decent length',
        metaDescription:
          'A meta description that comfortably sits within the fifty to one hundred sixty character sweet spot for SEO.',
        ogImageId: 'img1',
        canonicalUrl: 'https://kast.example.com/blog/post',
      });
      // Body with > 300 words and an H2 so no body penalties.
      const words = Array.from({ length: 320 }, (_, i) => ({ type: 'text', text: `word${i}` }));
      prisma.contentEntry.findUnique.mockResolvedValue({
        id: 'e1',
        locales: [
          {
            slug: 'valid-slug',
            data: {
              type: 'doc',
              content: [
                {
                  type: 'heading',
                  attrs: { level: 2 },
                  content: [{ type: 'text', text: 'Section' }],
                },
                { type: 'paragraph', content: words },
              ],
            },
          },
        ],
      });

      const result = await service.validateNow('e1');

      expect(result.score).toBe(100);
      expect(result.errors).toHaveLength(0);
      expect(repo.saveScore).toHaveBeenCalledWith('meta1', 100, expect.any(Array));
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
});
