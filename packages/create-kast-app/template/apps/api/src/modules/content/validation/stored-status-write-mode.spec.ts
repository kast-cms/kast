jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return { default: { sanitize }, sanitize };
});

import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type ContentStatus, ContentFieldType } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { ContentTypesService } from '../../content-types/content-types.service';
import type { SeoService } from '../../seo/seo.service';
import type { ContentRepository, EntryWithLocale, VersionWithAuthor } from '../content.repository';
import { ContentService } from '../content.service';
import { clearSchemaCache } from './content-schema.compiler';
import { ContentSchemaValidator } from './content-schema.validator';
import type { ContentValidationRepository } from './content-validation.repository';
import { ContentWriteGate } from './content-write.gate';
import { buildField, buildType } from './test-fixtures';

const CT = buildType(
  [
    buildField({ id: 'f-title', name: 'title', type: ContentFieldType.TEXT, isRequired: true }),
    buildField({ id: 'f-body', name: 'body', type: ContentFieldType.TEXT }),
    buildField({ id: 'f-int', name: 'internal', type: ContentFieldType.TEXT, isHidden: true }),
  ],
  { id: 'ct1', name: 'blog-post', isLocalized: true },
);

function entry(
  status: ContentStatus,
  data: Record<string, unknown> = { title: 'Hello' },
): EntryWithLocale {
  return {
    id: 'e1',
    contentTypeId: 'ct1',
    status,
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
        slug: 'hello',
        data,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  } as unknown as EntryWithLocale;
}

function version(data: Record<string, unknown>): VersionWithAuthor {
  return {
    id: 'v1',
    entryId: 'e1',
    data,
    localesData: { en: { data } },
  } as unknown as VersionWithAuthor;
}

interface RepoMocks {
  findByIdForType: jest.Mock;
  addLocale: jest.Mock;
  update: jest.Mock;
  createVersion: jest.Mock;
  updateStatus: jest.Mock;
  findVersionByIdForType: jest.Mock;
  revertToVersion: jest.Mock;
}

describe('validation mode comes from the stored entry status', () => {
  let repo: RepoMocks;
  let service: ContentService;

  beforeEach(() => {
    clearSchemaCache();
    repo = {
      findByIdForType: jest.fn(),
      addLocale: jest.fn().mockResolvedValue(entry('PUBLISHED')),
      update: jest.fn().mockResolvedValue(entry('PUBLISHED')),
      createVersion: jest.fn().mockResolvedValue(undefined),
      updateStatus: jest.fn().mockResolvedValue(true),
      findVersionByIdForType: jest.fn(),
      revertToVersion: jest.fn().mockResolvedValue(entry('PUBLISHED')),
    };
    const validator = new ContentSchemaValidator({
      findLiveMedia: jest.fn().mockResolvedValue(new Map()),
      findLiveEntryTypes: jest.fn().mockResolvedValue(new Map()),
      findContentTypeIdsByName: jest.fn().mockResolvedValue(new Map()),
    } as unknown as ContentValidationRepository);
    service = new ContentService(
      repo as unknown as ContentRepository,
      { findByName: jest.fn().mockResolvedValue(CT) } as unknown as ContentTypesService,
      {
        validateNow: jest
          .fn()
          .mockResolvedValue({ score: 100, issues: [], errors: [], warnings: [] }),
      } as unknown as SeoService,
      { add: jest.fn(), getJob: jest.fn() } as unknown as Queue,
      { emit: jest.fn() } as unknown as EventEmitter2,
      new ContentWriteGate(validator),
    );
  });

  describe.each<ContentStatus>(['PUBLISHED', 'SCHEDULED'])('addLocale on a %s entry', (status) => {
    beforeEach(() => {
      repo.findByIdForType.mockResolvedValue(entry(status));
    });

    it('refuses a new locale that omits a required field', async () => {
      await expect(
        service.addLocale(
          'blog-post',
          'e1',
          { locale: 'fr', slug: 'bonjour', data: { body: 'x' } },
          'u1',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CONTENT_VALIDATION_FAILED',
          message: expect.stringContaining('title is required'),
        }),
      });
      expect(repo.addLocale).not.toHaveBeenCalled();
    });

    it('refuses a new locale that blanks a required field', async () => {
      await expect(
        service.addLocale(
          'blog-post',
          'e1',
          { locale: 'de', slug: 'hallo', data: { title: '' } },
          'u1',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_VALIDATION_FAILED' }),
      });
      expect(repo.addLocale).not.toHaveBeenCalled();
    });

    it('refuses an empty new locale', async () => {
      await expect(
        service.addLocale('blog-post', 'e1', { locale: 'ar', slug: 'ar-slug', data: {} }, 'u1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_VALIDATION_FAILED' }),
      });
      expect(repo.addLocale).not.toHaveBeenCalled();
    });

    it('accepts a complete new locale', async () => {
      await expect(
        service.addLocale(
          'blog-post',
          'e1',
          { locale: 'fr', slug: 'bonjour', data: { title: 'Bonjour' } },
          'u1',
        ),
      ).resolves.toBeDefined();
      expect(repo.addLocale).toHaveBeenCalledWith(
        'e1',
        'ct1',
        'fr',
        'bonjour',
        { title: 'Bonjour' },
        [],
      );
    });
  });

  describe('addLocale on a DRAFT entry', () => {
    beforeEach(() => {
      repo.findByIdForType.mockResolvedValue(entry('DRAFT'));
    });

    it('still allows an incomplete translation', async () => {
      await expect(
        service.addLocale('blog-post', 'e1', { locale: 'ar', slug: 'ar-slug', data: {} }, 'u1'),
      ).resolves.toBeDefined();
      expect(repo.addLocale).toHaveBeenCalledWith('e1', 'ct1', 'ar', 'ar-slug', {}, []);
    });

    it('carries a hidden field over from the copied locale instead of rejecting it', async () => {
      repo.findByIdForType.mockResolvedValue(entry('DRAFT', { title: 'Hello', internal: 'notes' }));
      await expect(
        service.addLocale(
          'blog-post',
          'e1',
          { locale: 'ar', slug: 'ar-slug', data: { title: 'مرحبا' }, copyFromLocale: 'en' },
          'u1',
        ),
      ).resolves.toBeDefined();
      expect(repo.addLocale).toHaveBeenCalledWith(
        'e1',
        'ct1',
        'ar',
        'ar-slug',
        { title: 'مرحبا', internal: 'notes' },
        [],
      );
    });
  });

  describe('revertToVersion', () => {
    it('refuses to restore an incomplete snapshot onto a PUBLISHED entry', async () => {
      repo.findByIdForType.mockResolvedValue(entry('PUBLISHED'));
      repo.findVersionByIdForType.mockResolvedValue(version({ body: 'old' }));
      await expect(service.revertToVersion('blog-post', 'e1', 'v1', 'u1')).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({ code: 'VERSION_INCOMPATIBLE_WITH_SCHEMA' }),
      });
      expect(repo.revertToVersion).not.toHaveBeenCalled();
    });

    it('still restores an incomplete snapshot onto a DRAFT entry', async () => {
      repo.findByIdForType.mockResolvedValue(entry('DRAFT'));
      repo.findVersionByIdForType.mockResolvedValue(version({ body: 'old' }));
      await expect(service.revertToVersion('blog-post', 'e1', 'v1', 'u1')).resolves.toBeDefined();
      expect(repo.revertToVersion).toHaveBeenCalled();
    });

    it('restores a snapshot holding a value for a since-hidden field', async () => {
      repo.findByIdForType.mockResolvedValue(entry('PUBLISHED'));
      repo.findVersionByIdForType.mockResolvedValue(version({ title: 'Hello', internal: 'notes' }));
      await expect(service.revertToVersion('blog-post', 'e1', 'v1', 'u1')).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('applies publish rules to a data-only write on a PUBLISHED entry', async () => {
      repo.findByIdForType.mockResolvedValue(entry('PUBLISHED'));
      await expect(
        service.update('blog-post', 'e1', { data: { title: '' } }, 'u1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CONTENT_VALIDATION_FAILED' }),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('accepts an unchanged hidden field echoed back by the editor', async () => {
      repo.findByIdForType.mockResolvedValue(
        entry('PUBLISHED', { title: 'Hello', internal: 'notes' }),
      );
      await expect(
        service.update('blog-post', 'e1', { data: { title: 'Hello', internal: 'notes' } }, 'u1'),
      ).resolves.toBeDefined();
      expect(repo.update).toHaveBeenCalledWith(
        'e1',
        'ct1',
        'en',
        { title: 'Hello', internal: 'notes' },
        [],
      );
    });

    it('refuses a changed hidden field and keeps the stored value', async () => {
      repo.findByIdForType.mockResolvedValue(
        entry('PUBLISHED', { title: 'Hello', internal: 'notes' }),
      );
      await expect(
        service.update('blog-post', 'e1', { data: { title: 'Hello', internal: 'hacked' } }, 'u1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: expect.stringContaining('internal is not writable'),
        }),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('publishes an entry whose populated field was hidden after it was written', async () => {
      repo.findByIdForType.mockResolvedValue(entry('DRAFT', { title: 'Hello', internal: 'notes' }));
      await expect(service.publish('blog-post', 'e1')).resolves.toBeDefined();
      expect(repo.updateStatus).toHaveBeenCalledWith('e1', 'ct1', 'PUBLISHED', expect.any(Date));
    });

    it('publishes an entry holding a key whose field was deleted from the type', async () => {
      repo.findByIdForType.mockResolvedValue(entry('DRAFT', { title: 'Hello', author: 'Kast' }));
      await expect(service.publish('blog-post', 'e1')).resolves.toBeDefined();
    });

    it('still refuses to publish stored data missing a required field', async () => {
      repo.findByIdForType.mockResolvedValue(entry('DRAFT', { body: 'x' }));
      await expect(service.publish('blog-post', 'e1')).rejects.toMatchObject({ status: 422 });
    });
  });
});
