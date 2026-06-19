// content.service -> sanitize-rich-text.util -> isomorphic-dompurify pulls in an
// ESM-only transitive dep that ts-jest will not transform; mock it (same approach
// as sanitize-rich-text.util.spec.ts) so the service under test loads cleanly.
jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return { default: { sanitize }, sanitize };
});

import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ContentFieldType } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import type { ContentTypesService } from '../content-types/content-types.service';
import type { SeoService, SeoValidationResult } from '../seo/seo.service';
import type { ContentRepository, EntryWithLocale } from './content.repository';
import { ContentService } from './content.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildContentType(over: Partial<ContentTypeWithFields> = {}): ContentTypeWithFields {
  return {
    id: 'ct1',
    name: 'blog',
    displayName: 'Blog',
    description: null,
    icon: null,
    isLocalized: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: [
      {
        id: 'f1',
        contentTypeId: 'ct1',
        name: 'body',
        displayName: 'Body',
        type: ContentFieldType.RICH_TEXT,
        isRequired: false,
        isLocalized: false,
        isUnique: false,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    ...over,
  } as unknown as ContentTypeWithFields;
}

function buildEntry(over: Partial<EntryWithLocale> = {}): EntryWithLocale {
  return {
    id: 'e1',
    contentTypeId: 'ct1',
    status: 'DRAFT',
    publishedAt: null,
    scheduledAt: null,
    trashedAt: null,
    createdById: 'author',
    createdAt: new Date(),
    updatedAt: new Date(),
    locales: [
      {
        id: 'l1',
        entryId: 'e1',
        localeCode: 'en',
        slug: 'hello-world',
        data: { title: 'Hello' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    ...over,
  } as unknown as EntryWithLocale;
}

function validation(over: Partial<SeoValidationResult> = {}): SeoValidationResult {
  return { score: 100, issues: [], errors: [], warnings: [], ...over };
}

describe('ContentService', () => {
  let repo: Mocked<ContentRepository>;
  let contentTypes: Mocked<ContentTypesService>;
  let seo: Mocked<SeoService>;
  let queue: Mocked<Queue>;
  let emitter: Mocked<EventEmitter2>;
  let service: ContentService;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithFallback: jest.fn(),
      findActiveLocaleCodes: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      addLocale: jest.fn(),
      updateStatus: jest.fn(),
      updateSchedule: jest.fn(),
      trash: jest.fn(),
      createVersion: jest.fn().mockResolvedValue(undefined),
      listVersions: jest.fn(),
      findVersionById: jest.fn(),
      revertToVersion: jest.fn(),
    } as unknown as Mocked<ContentRepository>;
    contentTypes = { findByName: jest.fn() } as unknown as Mocked<ContentTypesService>;
    seo = { validateNow: jest.fn() } as unknown as Mocked<SeoService>;
    queue = { add: jest.fn(), getJob: jest.fn() } as unknown as Mocked<Queue>;
    emitter = { emit: jest.fn() } as unknown as Mocked<EventEmitter2>;

    service = new ContentService(
      repo as unknown as ContentRepository,
      contentTypes as unknown as ContentTypesService,
      seo as unknown as SeoService,
      queue as unknown as Queue,
      emitter as unknown as EventEmitter2,
    );
  });

  describe('create', () => {
    it('uses the slug from data and emits content.created', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      const created = buildEntry();
      repo.create.mockResolvedValue(created);

      const result = await service.create(
        'blog',
        { locale: 'en', data: { slug: 'my-slug' } },
        'author',
      );

      expect(repo.create).toHaveBeenCalledWith(
        'ct1',
        expect.any(Object),
        'en',
        'author',
        'my-slug',
        [],
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        'content.created',
        expect.objectContaining({ entryId: 'e1' }),
      );
      expect(result.data).toBe(created);
    });

    it('seeds extra locale codes when the content type is localized', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType({ isLocalized: true }));
      repo.findActiveLocaleCodes.mockResolvedValue(['en', 'ar']);
      repo.create.mockResolvedValue(buildEntry());
      await service.create('blog', { locale: 'en', data: { slug: 's' } }, 'author');
      expect(repo.create).toHaveBeenCalledWith('ct1', expect.any(Object), 'en', 'author', 's', [
        'en',
        'ar',
      ]);
    });

    it('propagates NotFound from an unknown content type', async () => {
      contentTypes.findByName.mockRejectedValue(new NotFoundException('nope'));
      await expect(service.create('ghost', { locale: 'en', data: {} }, 'a')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('snapshots a version before changing data', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      const entry = buildEntry();
      repo.findById
        .mockResolvedValueOnce(entry)
        .mockResolvedValueOnce(buildEntry({ status: 'DRAFT' }));

      await service.update('blog', 'e1', { data: { title: 'Updated' } }, 'editor');

      expect(repo.createVersion).toHaveBeenCalledWith(
        'e1',
        expect.any(Object),
        // snapshot keyed by locale code
        expect.objectContaining({ en: { slug: 'hello-world', data: { title: 'Hello' } } }),
        'editor',
        'DRAFT',
      );
      expect(repo.update).toHaveBeenCalled();
    });

    it('updates status without snapshotting when only status changes', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById.mockResolvedValue(buildEntry());
      await service.update('blog', 'e1', { status: 'ARCHIVED' }, 'editor');
      expect(repo.createVersion).not.toHaveBeenCalled();
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ARCHIVED');
    });

    it('throws NotFound when the entry is missing', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById.mockResolvedValue(null);
      await expect(service.update('blog', 'missing', { data: {} }, 'e')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('publish (SEO gate)', () => {
    beforeEach(() => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById.mockResolvedValue(buildEntry());
    });

    it('blocks publish when there are SEO errors, regardless of force', async () => {
      seo.validateNow.mockResolvedValue(
        validation({
          score: 60,
          errors: [{ type: 'title_missing', severity: 'ERROR', message: 'x', penalty: 20 }],
        }),
      );
      await expect(service.publish('blog', 'e1', { force: true })).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SEO_VALIDATION_FAILED' }),
      });
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('blocks publish on warnings when force is not set', async () => {
      seo.validateNow.mockResolvedValue(
        validation({
          score: 85,
          warnings: [{ type: 'desc_missing', severity: 'WARNING', message: 'x', penalty: 15 }],
        }),
      );
      await expect(service.publish('blog', 'e1')).rejects.toThrow(UnprocessableEntityException);
      await expect(service.publish('blog', 'e1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SEO_VALIDATION_WARNINGS' }),
      });
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('publishes through warnings when force is true', async () => {
      seo.validateNow.mockResolvedValue(
        validation({
          warnings: [{ type: 'desc_missing', severity: 'WARNING', message: 'x', penalty: 15 }],
        }),
      );
      repo.findById
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'PUBLISHED' }));

      const result = await service.publish('blog', 'e1', { force: true });

      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'PUBLISHED', expect.any(Date));
      expect(emitter.emit).toHaveBeenCalledWith('content.published', expect.anything());
      expect(result.data.status).toBe('PUBLISHED');
    });

    it('publishes cleanly when there are no issues', async () => {
      seo.validateNow.mockResolvedValue(validation());
      repo.findById
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'PUBLISHED' }));
      await service.publish('blog', 'e1');
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'PUBLISHED', expect.any(Date));
    });
  });

  describe('addLocale', () => {
    it('rejects adding a locale the entry already has', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById.mockResolvedValue(buildEntry());
      await expect(
        service.addLocale('blog', 'e1', { locale: 'en', slug: 's', data: {} }, 'u'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects copyFromLocale that does not exist on the entry', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById.mockResolvedValue(buildEntry());
      await expect(
        service.addLocale(
          'blog',
          'e1',
          { locale: 'ar', slug: 's', data: {}, copyFromLocale: 'fr' },
          'u',
        ),
      ).rejects.toThrow(/Source locale/);
    });

    it('adds a new locale and emits an update', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'DRAFT' }));
      await service.addLocale('blog', 'e1', { locale: 'ar', slug: 'مرحبا', data: { t: 1 } }, 'u');
      expect(repo.addLocale).toHaveBeenCalledWith('e1', 'ar', 'مرحبا', expect.any(Object));
    });
  });

  describe('schedulePublish', () => {
    it('rejects a publishAt in the past', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById.mockResolvedValue(buildEntry());
      await expect(
        service.schedulePublish('blog', 'e1', { publishAt: '2000-01-01T00:00:00.000Z' }),
      ).rejects.toThrow(/future/);
    });

    it('queues a delayed publish job for a future date', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findById
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'SCHEDULED' }));
      const future = new Date(Date.now() + 3600_000).toISOString();
      await service.schedulePublish('blog', 'e1', { publishAt: future });
      expect(queue.add).toHaveBeenCalledWith(
        'publish',
        { entryId: 'e1', typeSlug: 'blog' },
        expect.objectContaining({ jobId: 'publish-e1' }),
      );
      expect(repo.updateSchedule).toHaveBeenCalledWith('e1', expect.any(Date), 'SCHEDULED');
    });
  });

  describe('versions', () => {
    it('throws NotFound when reverting to a missing version', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findVersionById.mockResolvedValue(null);
      await expect(service.revertToVersion('blog', 'e1', 'v9', 'u')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
