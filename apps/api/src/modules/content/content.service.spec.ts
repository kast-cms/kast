// content.service -> sanitize-rich-text.util -> isomorphic-dompurify pulls in an
// ESM-only transitive dep that ts-jest will not transform; mock it (same approach
// as sanitize-rich-text.util.spec.ts) so the service under test loads cleanly.
jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return { default: { sanitize }, sanitize };
});

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ContentFieldType } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import type { ContentTypesService } from '../content-types/content-types.service';
import type { SeoService, SeoValidationResult } from '../seo/seo.service';
import type { ContentRepository, EntryWithLocale } from './content.repository';
import { ContentService } from './content.service';
import { clearSchemaCache } from './validation/content-schema.compiler';
import { ContentSchemaValidator } from './validation/content-schema.validator';
import type { ContentValidationRepository } from './validation/content-validation.repository';
import { ContentWriteGate } from './validation/content-write.gate';
import { buildField, buildType } from './validation/test-fixtures';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildContentType(over: Partial<ContentTypeWithFields> = {}): ContentTypeWithFields {
  return buildType(
    [
      buildField({ id: 'f-title', name: 'title', type: ContentFieldType.TEXT }),
      buildField({ id: 'f-body', name: 'body', type: ContentFieldType.RICH_TEXT }),
    ],
    over,
  );
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
    clearSchemaCache();
    repo = {
      findAll: jest.fn(),
      findByIdForType: jest.fn(),
      findByIdWithFallbackForType: jest.fn(),
      findActiveLocaleCodes: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      addLocale: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(true),
      updateSlug: jest.fn().mockResolvedValue(true),
      updateSchedule: jest.fn().mockResolvedValue(true),
      trash: jest.fn().mockResolvedValue(true),
      createVersion: jest.fn().mockResolvedValue(undefined),
      listVersions: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findVersionByIdForType: jest.fn(),
      revertToVersion: jest.fn(),
    } as unknown as Mocked<ContentRepository>;
    contentTypes = { findByName: jest.fn() } as unknown as Mocked<ContentTypesService>;
    seo = { validateNow: jest.fn() } as unknown as Mocked<SeoService>;
    queue = { add: jest.fn(), getJob: jest.fn() } as unknown as Mocked<Queue>;
    emitter = { emit: jest.fn() } as unknown as Mocked<EventEmitter2>;

    const validator = new ContentSchemaValidator({
      findLiveMedia: jest.fn().mockResolvedValue(new Map()),
      findLiveEntryTypes: jest.fn().mockResolvedValue(new Map()),
      findContentTypeIdsByName: jest.fn().mockResolvedValue(new Map()),
    } as unknown as ContentValidationRepository);

    service = new ContentService(
      repo as unknown as ContentRepository,
      contentTypes as unknown as ContentTypesService,
      seo as unknown as SeoService,
      queue as unknown as Queue,
      emitter as unknown as EventEmitter2,
      new ContentWriteGate(validator),
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
        { slug: 'my-slug' },
        'en',
        'author',
        'my-slug',
        [],
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
      expect(repo.create).toHaveBeenCalledWith(
        'ct1',
        { slug: 's' },
        'en',
        'author',
        's',
        ['en', 'ar'],
        [],
      );
    });

    it('propagates NotFound from an unknown content type', async () => {
      contentTypes.findByName.mockRejectedValue(new NotFoundException('nope'));
      await expect(service.create('ghost', { locale: 'en', data: {} }, 'a')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects data containing a field the type does not declare', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      await expect(
        service.create('blog', { locale: 'en', data: { nope: 1 } }, 'author'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_VALIDATION_FAILED' }),
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('sanitizes rich text before it reaches the repository', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.create.mockResolvedValue(buildEntry());
      await service.create(
        'blog',
        { locale: 'en', data: { body: '<p>hi</p><script>x()</script>' } },
        'author',
      );
      expect(repo.create).toHaveBeenCalledWith(
        'ct1',
        { body: '<p>hi</p>' },
        'en',
        'author',
        expect.any(String),
        [],
        [],
      );
    });

    it('forwards a unique check for a unique field', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-sku', name: 'sku', isUnique: true })]),
      );
      repo.create.mockResolvedValue(buildEntry());
      await service.create('blog', { locale: 'en', data: { sku: 'A1' } }, 'author');
      expect(repo.create).toHaveBeenCalledWith(
        'ct1',
        { sku: 'A1' },
        'en',
        'author',
        expect.any(String),
        [],
        [{ fieldName: 'sku', localeCode: 'en', value: 'A1' }],
      );
    });
  });

  describe('update', () => {
    it('snapshots a version before changing data', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType
        .mockResolvedValueOnce(buildEntry())
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
      expect(repo.update).toHaveBeenCalledWith(
        'e1',
        'ct1',
        'en',
        { title: 'Updated' },
        [],
        undefined,
      );
    });

    it('updates status without snapshotting when only status changes', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      await service.update('blog', 'e1', { status: 'ARCHIVED' }, 'editor');
      expect(repo.createVersion).not.toHaveBeenCalled();
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'ARCHIVED');
    });

    it('writes the locale named in the payload', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      await service.update('blog', 'e1', { locale: 'ar', data: { title: 'مرحبا' } }, 'editor');
      expect(repo.update).toHaveBeenCalledWith(
        'e1',
        'ct1',
        'ar',
        { title: 'مرحبا' },
        [],
        undefined,
      );
    });

    it('throws NotFound when the entry is missing', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(null);
      await expect(service.update('blog', 'missing', { data: {} }, 'e')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an invalid field value with a field-specific message', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-n', name: 'readTime', type: ContentFieldType.NUMBER })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry());
      await expect(
        service.update('blog', 'e1', { data: { readTime: '3 min' } }, 'editor'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CONTENT_VALIDATION_FAILED',
          message: expect.stringContaining('readTime must be a number'),
        }),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('enforces required fields when the update also publishes', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-t', name: 'title', isRequired: true })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry());
      await expect(
        service.update('blog', 'e1', { data: {}, status: 'PUBLISHED' }, 'editor'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: expect.stringContaining('title is required'),
        }),
      });
    });

    it.each(['PUBLISHED', 'SCHEDULED'] as const)(
      'enforces required fields on a data-only write to a %s entry',
      async (status) => {
        contentTypes.findByName.mockResolvedValue(
          buildType([buildField({ id: 'f-t', name: 'title', isRequired: true })]),
        );
        repo.findByIdForType.mockResolvedValue(buildEntry({ status }));
        await expect(
          service.update('blog', 'e1', { data: { title: '' } }, 'editor'),
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            code: 'CONTENT_VALIDATION_FAILED',
            message: expect.stringContaining('title is required'),
          }),
        });
        expect(repo.update).not.toHaveBeenCalled();
      },
    );

    it('still allows an incomplete payload when a published entry is saved back to draft', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-t', name: 'title', isRequired: true })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry({ status: 'PUBLISHED' }));
      await service.update('blog', 'e1', { data: {}, status: 'DRAFT' }, 'editor');
      expect(repo.update).toHaveBeenCalledWith('e1', 'ct1', 'en', {}, [], undefined);
    });

    it('re-validates stored data on a status-only move to SCHEDULED', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-t', name: 'title', isRequired: true })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry({ locales: [] }));
      await expect(
        service.update('blog', 'e1', { status: 'SCHEDULED' }, 'editor'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_SCHEMA_INVALID' }),
      });
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('re-validates stored data on a status-only publish', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-t', name: 'title', isRequired: true })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry({ locales: [] }));
      await expect(
        service.update('blog', 'e1', { status: 'PUBLISHED' }, 'editor'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_SCHEMA_INVALID' }),
      });
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('publish (SEO gate)', () => {
    beforeEach(() => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
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
      repo.findByIdForType
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'PUBLISHED' }));

      const result = await service.publish('blog', 'e1', { force: true });

      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'PUBLISHED', expect.any(Date));
      expect(emitter.emit).toHaveBeenCalledWith('content.published', expect.anything());
      expect(result.data.status).toBe('PUBLISHED');
    });

    it('publishes cleanly when there are no issues', async () => {
      seo.validateNow.mockResolvedValue(validation());
      repo.findByIdForType
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'PUBLISHED' }));
      await service.publish('blog', 'e1');
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'PUBLISHED', expect.any(Date));
    });

    it('blocks publish before the SEO gate when stored data misses a required field', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-b', name: 'body', isRequired: true })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry({ locales: [] }));
      await expect(service.publish('blog', 'e1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_SCHEMA_INVALID' }),
      });
      expect(seo.validateNow).not.toHaveBeenCalled();
    });
  });

  describe('addLocale', () => {
    it('rejects adding a locale the entry already has', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      await expect(
        service.addLocale('blog', 'e1', { locale: 'en', slug: 's', data: {} }, 'u'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects copyFromLocale that does not exist on the entry', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
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
      repo.findByIdForType
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'DRAFT' }));
      await service.addLocale(
        'blog',
        'e1',
        { locale: 'ar', slug: 'مرحبا', data: { title: 'مرحبا' } },
        'u',
      );
      expect(repo.addLocale).toHaveBeenCalledWith(
        'e1',
        'ct1',
        'ar',
        'مرحبا',
        { title: 'مرحبا' },
        [],
      );
    });

    it('validates the locale payload', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      await expect(
        service.addLocale('blog', 'e1', { locale: 'ar', slug: 's', data: { nope: 1 } }, 'u'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_VALIDATION_FAILED' }),
      });
      expect(repo.addLocale).not.toHaveBeenCalled();
    });
  });

  describe('schedulePublish', () => {
    it('rejects a publishAt in the past', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      await expect(
        service.schedulePublish('blog', 'e1', { publishAt: '2000-01-01T00:00:00.000Z' }),
      ).rejects.toThrow(/future/);
    });

    it('queues a delayed publish job for a future date', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType
        .mockResolvedValueOnce(buildEntry())
        .mockResolvedValueOnce(buildEntry({ status: 'SCHEDULED' }));
      const future = new Date(Date.now() + 3600_000).toISOString();
      await service.schedulePublish('blog', 'e1', { publishAt: future });
      expect(queue.add).toHaveBeenCalledWith(
        'publish',
        { entryId: 'e1', typeSlug: 'blog' },
        expect.objectContaining({ jobId: 'publish-e1' }),
      );
      expect(repo.updateSchedule).toHaveBeenCalledWith('e1', 'ct1', expect.any(Date), 'SCHEDULED');
    });

    it('refuses to schedule content that could not be published', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-t', name: 'title', isRequired: true })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry({ locales: [] }));
      const future = new Date(Date.now() + 3600_000).toISOString();
      await expect(
        service.schedulePublish('blog', 'e1', { publishAt: future }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_SCHEMA_INVALID' }),
      });
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('versions', () => {
    it('throws NotFound when reverting to a missing version', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      repo.findVersionByIdForType.mockResolvedValue(null);
      await expect(service.revertToVersion('blog', 'e1', 'v9', 'u')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to restore a snapshot that no longer matches the schema', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      repo.findVersionByIdForType.mockResolvedValue({
        id: 'v1',
        entryId: 'e1',
        data: {},
        localesData: { en: { slug: 's', data: { removedField: 'x' } } },
      });
      await expect(service.revertToVersion('blog', 'e1', 'v1', 'u')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'VERSION_INCOMPATIBLE_WITH_SCHEMA' }),
      });
      expect(repo.revertToVersion).not.toHaveBeenCalled();
    });

    it('reverts a compatible snapshot scoped to the content type', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      const version = {
        id: 'v1',
        entryId: 'e1',
        data: {},
        localesData: { en: { slug: 's', data: { title: 'Old' } } },
      };
      repo.findVersionByIdForType.mockResolvedValue(version);
      repo.revertToVersion.mockResolvedValue(buildEntry());
      await service.revertToVersion('blog', 'e1', 'v1', 'u');
      expect(repo.revertToVersion).toHaveBeenCalledWith('e1', 'ct1', version, 'u', []);
    });
  });

  describe('content-type binding (P0-09)', () => {
    beforeEach(() => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(null);
      repo.findByIdWithFallbackForType.mockResolvedValue(null);
      seo.validateNow.mockResolvedValue(validation());
    });

    it('scopes every lookup to the resolved content type id', async () => {
      repo.findByIdForType.mockResolvedValue(buildEntry());
      repo.findByIdWithFallbackForType.mockResolvedValue(buildEntry());
      await service.findOne('blog', 'e1');
      expect(repo.findByIdForType).toHaveBeenCalledWith('e1', 'ct1');

      await service.findOne('blog', 'e1', 'ar');
      expect(repo.findByIdWithFallbackForType).toHaveBeenCalledWith('e1', 'ct1', 'ar');
    });

    it.each([
      ['findOne', (s: ContentService) => s.findOne('blog', 'foreign')],
      ['findOne with locale', (s: ContentService) => s.findOne('blog', 'foreign', 'ar')],
      ['update', (s: ContentService) => s.update('blog', 'foreign', { data: {} }, 'u')],
      ['trash', (s: ContentService) => s.trash('blog', 'foreign')],
      ['publish', (s: ContentService) => s.publish('blog', 'foreign')],
      ['unpublish', (s: ContentService) => s.unpublish('blog', 'foreign')],
      ['archive', (s: ContentService) => s.archive('blog', 'foreign')],
      ['restore', (s: ContentService) => s.restore('blog', 'foreign')],
      [
        'schedulePublish',
        (s: ContentService) =>
          s.schedulePublish('blog', 'foreign', {
            publishAt: new Date(Date.now() + 3600_000).toISOString(),
          }),
      ],
      ['cancelSchedule', (s: ContentService) => s.cancelSchedule('blog', 'foreign')],
      [
        'addLocale',
        (s: ContentService) =>
          s.addLocale('blog', 'foreign', { locale: 'ar', slug: 's', data: {} }, 'u'),
      ],
      ['listVersions', (s: ContentService) => s.listVersions('blog', 'foreign', 10)],
      ['getVersion', (s: ContentService) => s.getVersion('blog', 'foreign', 'v1')],
      ['revertToVersion', (s: ContentService) => s.revertToVersion('blog', 'foreign', 'v1', 'u')],
    ])('%s returns 404 for an id that belongs to another content type', async (_name, call) => {
      await expect(call(service)).rejects.toThrow(NotFoundException);
      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(repo.updateSchedule).not.toHaveBeenCalled();
      expect(repo.trash).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.addLocale).not.toHaveBeenCalled();
      expect(repo.revertToVersion).not.toHaveBeenCalled();
    });

    it('passes the content type id to every state mutation', async () => {
      repo.findByIdForType.mockResolvedValue(buildEntry());
      repo.findVersionByIdForType.mockResolvedValue(null);

      await service.unpublish('blog', 'e1');
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'DRAFT');
      await service.archive('blog', 'e1');
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'ARCHIVED');
      await service.restore('blog', 'e1');
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'DRAFT');
      await service.trash('blog', 'e1');
      expect(repo.trash).toHaveBeenCalledWith('e1', 'ct1', undefined);
      await service.trash('blog', 'e1', 'admin-1');
      expect(repo.trash).toHaveBeenCalledWith('e1', 'ct1', 'admin-1');
      await service.cancelSchedule('blog', 'e1');
      expect(repo.updateSchedule).toHaveBeenCalledWith('e1', 'ct1', null, 'DRAFT');
      await expect(service.getVersion('blog', 'e1', 'v1')).rejects.toThrow(NotFoundException);
      expect(repo.findVersionByIdForType).toHaveBeenCalledWith('e1', 'ct1', 'v1');
    });

    it('404s when a concurrent write removed the entry from this type', async () => {
      repo.findByIdForType.mockResolvedValueOnce(buildEntry());
      repo.updateStatus.mockResolvedValue(false);
      await expect(service.archive('blog', 'e1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('slug handling (CON-04)', () => {
    it('normalizes an explicit slug and prefers it over data.slug', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.create.mockResolvedValue(buildEntry());

      await service.create(
        'blog',
        { locale: 'en', slug: 'My First Post!', data: { slug: 'ignored' } },
        'author',
      );

      expect(repo.create).toHaveBeenCalledWith(
        'ct1',
        { slug: 'ignored' },
        'en',
        'author',
        'my-first-post',
        [],
        [],
      );
    });

    it('generates a distinct slug for two entries created in the same millisecond', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.create.mockResolvedValue(buildEntry());

      await service.create('blog', { locale: 'en', data: {} }, 'author');
      await service.create('blog', { locale: 'en', data: {} }, 'author');

      const slugs = repo.create.mock.calls.map((call) => call[4] as string);
      expect(slugs[0]).not.toBe(slugs[1]);
    });

    it('rejects an explicit slug with no slug-safe characters', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      await expect(
        service.create('blog', { locale: 'en', slug: '///', data: {} }, 'author'),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rewrites the locale slug on update alongside the data', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());

      await service.update('blog', 'e1', { slug: 'New Slug', data: { title: 'x' } }, 'editor');

      expect(repo.update).toHaveBeenCalledWith('e1', 'ct1', 'en', { title: 'x' }, [], 'new-slug');
    });

    it('rewrites the locale slug on its own', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());

      await service.update('blog', 'e1', { slug: 'New Slug' }, 'editor');

      expect(repo.updateSlug).toHaveBeenCalledWith('e1', 'ct1', 'en', 'new-slug');
      expect(repo.createVersion).not.toHaveBeenCalled();
    });

    it('404s a slug-only update when the locale row is gone', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());
      repo.updateSlug.mockResolvedValue(false);

      await expect(service.update('blog', 'e1', { slug: 'new' }, 'editor')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('still gates a status change that also carries a slug', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildType([buildField({ id: 'f-b', name: 'body', isRequired: true })]),
      );
      repo.findByIdForType.mockResolvedValue(buildEntry({ locales: [] }));

      await expect(
        service.update('blog', 'e1', { slug: 'new', status: 'PUBLISHED' }, 'editor'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_SCHEMA_INVALID' }),
      });
      expect(repo.updateSlug).not.toHaveBeenCalled();
    });

    it('normalizes the slug of a locale added to an existing entry', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry());

      await service.addLocale('blog', 'e1', { locale: 'ar', slug: 'Hello There', data: {} }, 'u');

      expect(repo.addLocale).toHaveBeenCalledWith('e1', 'ct1', 'ar', 'hello-there', {}, []);
    });
  });

  describe('unarchive vs trash restore (CON-08)', () => {
    it('moves an archived entry back to draft', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(buildEntry({ status: 'ARCHIVED' }));

      await service.unarchive('blog', 'e1');

      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'DRAFT');
    });

    it('refuses a trashed entry and points at the trash endpoint', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(
        buildEntry({ status: 'TRASHED', trashedAt: new Date() }),
      );

      await expect(service.unarchive('blog', 'e1')).rejects.toThrow(ConflictException);
      // Flipping the status here would have left the row marked DRAFT and still
      // hidden, because trashedAt would not have been cleared.
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('keeps restore() as an alias of unarchive', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findByIdForType.mockResolvedValue(
        buildEntry({ status: 'TRASHED', trashedAt: new Date() }),
      );

      await expect(service.restore('blog', 'e1')).rejects.toThrow(ConflictException);
    });
  });

  describe('bulk actions (CON-03)', () => {
    beforeEach(() => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
    });

    it('trashes each id through the single-entry path', async () => {
      repo.findByIdForType.mockResolvedValue(buildEntry());

      const { data } = await service.bulkTrash('blog', ['a', 'b']);

      expect(repo.trash).toHaveBeenCalledWith('a', 'ct1', undefined);
      expect(repo.trash).toHaveBeenCalledWith('b', 'ct1', undefined);
      expect(data).toMatchObject({ succeeded: 2, failed: 0 });
    });

    it('records the actor against every id in the batch (TRASH-03)', async () => {
      repo.findByIdForType.mockResolvedValue(buildEntry());

      await service.bulkTrash('blog', ['a', 'b'], 'admin-1');

      // Without this the trash screen cannot say who deleted a bulk-trashed row.
      expect(repo.trash).toHaveBeenCalledWith('a', 'ct1', 'admin-1');
      expect(repo.trash).toHaveBeenCalledWith('b', 'ct1', 'admin-1');
    });

    it('reports the ids that belong to another content type instead of failing the batch', async () => {
      repo.findByIdForType.mockImplementation((id: string) =>
        Promise.resolve(id === 'mine' ? buildEntry() : null),
      );

      const { data } = await service.bulkTrash('blog', ['mine', 'foreign']);

      expect(data.succeeded).toBe(1);
      expect(data.results).toEqual([
        { id: 'mine', ok: true },
        { id: 'foreign', ok: false, error: expect.objectContaining({ status: 404 }) },
      ]);
      expect(repo.trash).toHaveBeenCalledTimes(1);
    });

    it('runs the SEO gate per entry on a bulk publish', async () => {
      repo.findByIdForType.mockResolvedValue(buildEntry());
      seo.validateNow.mockResolvedValueOnce(validation()).mockResolvedValueOnce(
        validation({
          errors: [{ type: 'title_missing', severity: 'ERROR', message: 'x', penalty: 20 }],
        }),
      );

      const { data } = await service.bulkPublish('blog', ['ok', 'blocked']);

      expect(data.succeeded).toBe(1);
      expect(data.results[1]?.error).toMatchObject({
        status: 422,
        code: 'SEO_VALIDATION_FAILED',
      });
      expect(repo.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('unpublishes each id', async () => {
      repo.findByIdForType.mockResolvedValue(buildEntry());

      const { data } = await service.bulkUnpublish('blog', ['a']);

      expect(repo.updateStatus).toHaveBeenCalledWith('a', 'ct1', 'DRAFT');
      expect(data.failed).toBe(0);
    });
  });
});
