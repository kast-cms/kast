import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContentFieldType, Prisma } from '@prisma/client';
import type { ContentTypesRepository } from './content-types.repository';
import { ContentTypesService } from './content-types.service';

/**
 * CON-01. `config`, `defaultValue` and `isHidden` used to be absent from the
 * field DTOs. Because the global ValidationPipe runs with
 * `forbidNonWhitelisted: true`, the admin's field-configuration drawer — which
 * has always sent all three — was rejected outright with
 * "property config should not exist", and any field created through the API
 * ended up with an empty rule set, leaving every config-driven content
 * validation rule (minLength, regex, choices, allowedMimeTypes, ...) inert.
 */
describe('ContentTypesService field persistence (CON-01)', () => {
  const contentType = { id: 'ct1', name: 'blog_post', fields: [] };

  function build(): { service: ContentTypesService; repo: jest.Mocked<ContentTypesRepository> } {
    const repo = {
      findByName: jest.fn().mockResolvedValue(contentType),
      findFieldByNameAndType: jest.fn().mockResolvedValue(null),
      createField: jest.fn().mockResolvedValue({ id: 'f1' }),
      updateField: jest.fn().mockResolvedValue({ id: 'f1' }),
    } as unknown as jest.Mocked<ContentTypesRepository>;
    return { service: new ContentTypesService(repo), repo };
  }

  describe('createField', () => {
    it('persists config, defaultValue and isHidden', async () => {
      const { service, repo } = build();

      await service.createField('blog_post', {
        name: 'title',
        displayName: 'Title',
        type: ContentFieldType.TEXT,
        isHidden: true,
        config: { minLength: 3, maxLength: 120 },
        defaultValue: 'Untitled',
      });

      expect(repo.createField).toHaveBeenCalledWith(
        expect.objectContaining({
          isHidden: true,
          config: { minLength: 3, maxLength: 120 },
          defaultValue: 'Untitled',
        }),
      );
    });

    it('defaults config to an empty object and isHidden to false', async () => {
      const { service, repo } = build();

      await service.createField('blog_post', {
        name: 'title',
        displayName: 'Title',
        type: ContentFieldType.TEXT,
      });

      const arg = repo.createField.mock.calls[0]?.[0];
      expect(arg).toEqual(expect.objectContaining({ config: {}, isHidden: false }));
      // Omitted rather than set to null, so the column keeps its own default.
      expect(arg).not.toHaveProperty('defaultValue');
    });

    it('accepts a falsy defaultValue instead of discarding it', async () => {
      const { service, repo } = build();

      await service.createField('blog_post', {
        name: 'featured',
        displayName: 'Featured',
        type: ContentFieldType.BOOLEAN,
        defaultValue: false,
      });

      expect(repo.createField).toHaveBeenCalledWith(
        expect.objectContaining({ defaultValue: false }),
      );
    });

    it('stores an explicit null defaultValue as a SQL NULL', async () => {
      const { service, repo } = build();

      await service.createField('blog_post', {
        name: 'subtitle',
        displayName: 'Subtitle',
        type: ContentFieldType.TEXT,
        defaultValue: null,
      });

      expect(repo.createField).toHaveBeenCalledWith(
        expect.objectContaining({ defaultValue: Prisma.DbNull }),
      );
    });

    it('rejects a duplicate field name', async () => {
      const { service, repo } = build();
      repo.findFieldByNameAndType.mockResolvedValue({ id: 'existing' } as never);

      await expect(
        service.createField('blog_post', {
          name: 'title',
          displayName: 'Title',
          type: ContentFieldType.TEXT,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.createField).not.toHaveBeenCalled();
    });
  });

  describe('updateField', () => {
    beforeEach(() => jest.clearAllMocks());

    it('replaces config and isHidden when supplied', async () => {
      const { service, repo } = build();
      repo.findFieldByNameAndType.mockResolvedValue({ id: 'f1' } as never);

      await service.updateField('blog_post', 'title', {
        isHidden: true,
        config: { regex: '^[a-z]+$' },
      });

      expect(repo.updateField).toHaveBeenCalledWith('f1', {
        isHidden: true,
        config: { regex: '^[a-z]+$' },
      });
    });

    it('leaves a stored config untouched when the key is omitted', async () => {
      const { service, repo } = build();
      repo.findFieldByNameAndType.mockResolvedValue({ id: 'f1' } as never);

      await service.updateField('blog_post', 'title', { isRequired: true });

      const arg = repo.updateField.mock.calls[0]?.[1];
      expect(arg).not.toHaveProperty('config');
      expect(arg).not.toHaveProperty('defaultValue');
    });

    it('clears a defaultValue with the DbNull sentinel, not a bare null', async () => {
      const { service, repo } = build();
      repo.findFieldByNameAndType.mockResolvedValue({ id: 'f1' } as never);

      await service.updateField('blog_post', 'title', { defaultValue: null });

      // A bare `null` would read as "leave unchanged" on a Prisma update.
      expect(repo.updateField).toHaveBeenCalledWith('f1', { defaultValue: Prisma.DbNull });
    });

    it('404s for a field that does not exist on the type', async () => {
      const { service, repo } = build();
      repo.findFieldByNameAndType.mockResolvedValue(null);

      await expect(
        service.updateField('blog_post', 'nope', { isRequired: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.updateField).not.toHaveBeenCalled();
    });
  });
});

/**
 * CON-11. ContentType.isLocalized decides whether an entry is created with a row
 * per active locale, but it was absent from the create/update DTOs, so anything
 * made through the API or the admin was stuck at false.
 */
describe('ContentTypesService localization flag (CON-11)', () => {
  function build(): { service: ContentTypesService; repo: jest.Mocked<ContentTypesRepository> } {
    const repo = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ct1' }),
      update: jest.fn().mockResolvedValue({ id: 'ct1' }),
    } as unknown as jest.Mocked<ContentTypesRepository>;
    return { service: new ContentTypesService(repo), repo };
  }

  it('persists isLocalized on create', async () => {
    const { service, repo } = build();

    await service.create({ name: 'blog_post', displayName: 'Blog Post', isLocalized: true });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isLocalized: true }));
  });

  it('defaults isLocalized to false when it is omitted', async () => {
    const { service, repo } = build();

    await service.create({ name: 'blog_post', displayName: 'Blog Post' });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isLocalized: false }));
  });

  it('forwards isLocalized on update', async () => {
    const { service, repo } = build();
    repo.findByName.mockResolvedValue({ id: 'ct1', name: 'blog_post', fields: [] } as never);

    await service.update('blog_post', { isLocalized: true });

    expect(repo.update).toHaveBeenCalledWith('blog_post', { isLocalized: true });
  });
});

/**
 * CON-02. The SDK and the admin field builder have always called
 * PATCH /content-types/:name/fields/reorder; there was no such route, so a drag
 * reverted as soon as the page reloaded.
 */
describe('ContentTypesService.reorderFields (CON-02)', () => {
  const fields = [
    { id: 'f1', name: 'title', position: 0 },
    { id: 'f2', name: 'slug', position: 1 },
    { id: 'f3', name: 'body', position: 2 },
  ];

  function build(): { service: ContentTypesService; repo: jest.Mocked<ContentTypesRepository> } {
    const repo = {
      findByName: jest.fn().mockResolvedValue({ id: 'ct1', name: 'blog_post', fields }),
      findByNameWithCounts: jest.fn().mockResolvedValue({
        id: 'ct1',
        name: 'blog_post',
        fields,
        _count: { fields: 3, entries: 0 },
      }),
      reorderFields: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ContentTypesRepository>;
    return { service: new ContentTypesService(repo), repo };
  }

  it('rewrites positions in the requested order and returns the refreshed type', async () => {
    const { service, repo } = build();

    const result = await service.reorderFields('blog_post', { order: ['body', 'title', 'slug'] });

    expect(repo.reorderFields).toHaveBeenCalledWith(['f3', 'f1', 'f2']);
    expect(result.name).toBe('blog_post');
  });

  it('rejects an order that names a field the type does not have', async () => {
    const { service, repo } = build();

    await expect(
      service.reorderFields('blog_post', { order: ['title', 'slug', 'ghost'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.reorderFields).not.toHaveBeenCalled();
  });

  it('rejects a partial order rather than silently dropping the missing fields', async () => {
    const { service, repo } = build();

    await expect(
      service.reorderFields('blog_post', { order: ['title', 'slug'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.reorderFields).not.toHaveBeenCalled();
  });

  it('rejects a repeated field name', async () => {
    const { service, repo } = build();

    await expect(
      service.reorderFields('blog_post', { order: ['title', 'title', 'slug'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.reorderFields).not.toHaveBeenCalled();
  });

  it('404s for a content type that does not exist', async () => {
    const { service, repo } = build();
    repo.findByName.mockResolvedValue(null);

    await expect(service.reorderFields('ghost', { order: ['title'] })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
