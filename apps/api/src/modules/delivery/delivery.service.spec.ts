import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentFieldType } from '@prisma/client';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import type { ContentTypesService } from '../content-types/content-types.service';
import type { MenuService } from '../menus/menu.service';
import type { SeoService } from '../seo/seo.service';
import type { SettingsService } from '../settings/settings.service';
import type { DeliveryRepository, PublishedEntryRow } from './delivery.repository';
import { DeliveryService } from './delivery.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildField(
  over: Partial<ContentTypeWithFields['fields'][number]> = {},
): ContentTypeWithFields['fields'][number] {
  return {
    id: 'f1',
    contentTypeId: 'ct1',
    name: 'title',
    displayName: 'Title',
    type: ContentFieldType.TEXT,
    isRequired: true,
    isLocalized: true,
    isUnique: false,
    isHidden: false,
    position: 0,
    config: { internalWebhook: 'https://internal.example/hook' },
    defaultValue: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as ContentTypeWithFields['fields'][number];
}

function buildContentType(over: Partial<ContentTypeWithFields> = {}): ContentTypeWithFields {
  return {
    id: 'ct1',
    name: 'blog',
    displayName: 'Blog',
    description: 'internal notes',
    icon: null,
    isSystem: false,
    isLocalized: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: [buildField(), buildField({ id: 'f2', name: 'secret', isHidden: true })],
    ...over,
  } as unknown as ContentTypeWithFields;
}

function buildRow(over: Partial<PublishedEntryRow> = {}): PublishedEntryRow {
  return {
    id: 'e1',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    seoMeta: {
      metaTitle: 'Meta',
      metaDescription: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: { url: 'https://cdn.example/og.png' },
      noIndex: false,
      noFollow: false,
      canonicalUrl: null,
    },
    locales: [{ slug: 'hello-world', data: { title: 'Hello' } }],
    ...over,
  } as PublishedEntryRow;
}

describe('DeliveryService', () => {
  let repo: Mocked<DeliveryRepository>;
  let contentTypes: Mocked<ContentTypesService>;
  let menus: Mocked<MenuService>;
  let settings: Mocked<SettingsService>;
  let seo: Mocked<SeoService>;
  let service: DeliveryService;

  beforeEach(() => {
    repo = {
      listPublished: jest.fn(),
      findPublishedBySlug: jest.fn(),
      findMediaUrls: jest.fn().mockResolvedValue(new Map()),
    } as unknown as Mocked<DeliveryRepository>;
    contentTypes = {
      findAll: jest.fn(),
      findByName: jest.fn(),
    } as unknown as Mocked<ContentTypesService>;
    menus = { findBySlug: jest.fn() } as unknown as Mocked<MenuService>;
    settings = { getPublicSettings: jest.fn() } as unknown as Mocked<SettingsService>;
    seo = {
      buildSitemapEntries: jest.fn(),
      getSiteMetaDefaults: jest
        .fn()
        .mockResolvedValue({ defaultMetaTitle: null, defaultMetaDescription: null }),
    } as unknown as Mocked<SeoService>;
    service = new DeliveryService(
      repo as unknown as DeliveryRepository,
      contentTypes as unknown as ContentTypesService,
      menus as unknown as MenuService,
      settings as unknown as SettingsService,
      seo as unknown as SeoService,
    );
  });

  describe('site meta defaults (SEO-04)', () => {
    it('serves the site default title when the entry defines none', async () => {
      seo.getSiteMetaDefaults.mockResolvedValue({
        defaultMetaTitle: 'My Site',
        defaultMetaDescription: 'A site.',
      });
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({
          seoMeta: {
            ...buildRow().seoMeta,
            metaTitle: null,
            metaDescription: null,
          } as PublishedEntryRow['seoMeta'],
        }),
      );

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      // The SEO score already treats the site default as the effective title,
      // so shipping null here made the score and the payload disagree.
      expect(data.seoMeta?.metaTitle).toBe('My Site');
      expect(data.seoMeta?.metaDescription).toBe('A site.');
    });

    it('treats a legacy empty-string title as unset, matching how it was scored', async () => {
      // A row written before SeoService.upsertMeta normalised blanks to null.
      // The scoring side falls back on any falsy value, so this entry scored as
      // having a title and passed the enforce publish gate; serving '' verbatim
      // shipped an empty <title> for a document that scored 92.
      seo.getSiteMetaDefaults.mockResolvedValue({
        defaultMetaTitle: 'My Site',
        defaultMetaDescription: 'A site.',
      });
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({
          seoMeta: {
            ...buildRow().seoMeta,
            metaTitle: '',
            metaDescription: '   ',
          } as PublishedEntryRow['seoMeta'],
        }),
      );

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.seoMeta?.metaTitle).toBe('My Site');
      expect(data.seoMeta?.metaDescription).toBe('A site.');
    });

    it('never overrides a title the entry set for itself', async () => {
      seo.getSiteMetaDefaults.mockResolvedValue({
        defaultMetaTitle: 'My Site',
        defaultMetaDescription: 'A site.',
      });
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(buildRow());

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.seoMeta?.metaTitle).toBe(buildRow().seoMeta?.metaTitle);
    });

    it('synthesises meta for an entry with no SeoMeta row at all', async () => {
      seo.getSiteMetaDefaults.mockResolvedValue({
        defaultMetaTitle: 'My Site',
        defaultMetaDescription: null,
      });
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(buildRow({ seoMeta: null }));

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.seoMeta?.metaTitle).toBe('My Site');
      expect(data.seoMeta?.noIndex).toBe(false);
    });

    it('stays null when neither the entry nor the site defines any meta', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(buildRow({ seoMeta: null }));

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.seoMeta).toBeNull();
    });
  });

  describe('entry projection', () => {
    it('emits the resolved og image URL and never the internal media id', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(buildRow());

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.seoMeta?.ogImageUrl).toBe('https://cdn.example/og.png');
      expect(data.seoMeta).not.toHaveProperty('ogImageId');
    });

    it('emits a null og image URL when no og image is linked', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({
          seoMeta: { ...buildRow().seoMeta, ogImage: null } as PublishedEntryRow['seoMeta'],
        }),
      );

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.seoMeta?.ogImageUrl).toBeNull();
    });

    it('exposes no status, author or content-type ids on a delivery entry', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.listPublished.mockResolvedValue({ items: [buildRow()], total: 1 });

      const { data } = await service.listContent('blog', 'en', 20, 'desc');

      expect(Object.keys(data[0] as object).sort()).toEqual([
        'data',
        'id',
        'publishedAt',
        'seoMeta',
        'slug',
      ]);
    });

    it('404s when no published entry matches the slug', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(null);

      await expect(service.getContentBySlug('blog', 'draft-post', 'en')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('requires a locale on both content routes', async () => {
      await expect(service.listContent('blog', undefined, 20, 'desc')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.getContentBySlug('blog', 'hello-world', undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('payload projection', () => {
    // A value written while the field was visible survives in stored data after
    // the operator flips the field to hidden; only the projection keeps it in.
    const carriedHiddenData = { title: 'Hello', secret: 'sk_live_INTERNAL' };

    it('strips hidden field values from the single-entry payload', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({ locales: [{ slug: 'hello-world', data: carriedHiddenData }] }),
      );

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.data).toEqual({ title: 'Hello' });
      expect(JSON.stringify(data)).not.toContain('sk_live_INTERNAL');
    });

    it('strips hidden field values from the list payload', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.listPublished.mockResolvedValue({
        items: [buildRow({ locales: [{ slug: 'hello-world', data: carriedHiddenData }] })],
        total: 1,
      });

      const { data } = await service.listContent('blog', 'en', 20, 'desc');

      expect(data[0]?.data).toEqual({ title: 'Hello' });
    });

    it('drops the admin _seo blob and orphaned keys of deleted fields', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({
          locales: [
            {
              slug: 'hello-world',
              data: {
                title: 'Hello',
                removedField: 'left behind',
                _seo: { ogImageId: 'cmsn5l1lv004dqf01z3j4i1ur', metaTitle: 'Internal' },
              },
            },
          ],
        }),
      );

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.data).toEqual({ title: 'Hello' });
      expect(JSON.stringify(data)).not.toContain('cmsn5l1lv004dqf01z3j4i1ur');
    });

    it('keeps the reserved slug key the starters read out of data', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({
          locales: [{ slug: 'hello-world', data: { title: 'Hello', slug: 'hello-world' } }],
        }),
      );

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(data.data).toEqual({ title: 'Hello', slug: 'hello-world' });
    });

    it('resolves MEDIA field ids into public URLs instead of leaking the ids', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildContentType({
          fields: [
            buildField(),
            buildField({ id: 'f3', name: 'cover', type: ContentFieldType.MEDIA }),
          ],
        }),
      );
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({
          locales: [{ slug: 'hello-world', data: { title: 'Hello', cover: 'media_1' } }],
        }),
      );
      repo.findMediaUrls.mockResolvedValue(new Map([['media_1', 'https://cdn.example/cover.png']]));

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(repo.findMediaUrls).toHaveBeenCalledWith(['media_1']);
      expect(data.data).toEqual({ title: 'Hello', cover: 'https://cdn.example/cover.png' });
      expect(JSON.stringify(data)).not.toContain('media_1');
    });

    it('resolves multi-value MEDIA fields and drops ids that no longer resolve', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildContentType({
          fields: [
            buildField({ id: 'f3', name: 'gallery', type: ContentFieldType.MEDIA }),
            buildField({ id: 'f4', name: 'cover', type: ContentFieldType.MEDIA }),
          ],
        }),
      );
      repo.listPublished.mockResolvedValue({
        items: [
          buildRow({
            locales: [
              {
                slug: 'hello-world',
                data: { gallery: ['media_1', 'media_trashed'], cover: 'media_gone' },
              },
            ],
          }),
        ],
        total: 1,
      });
      repo.findMediaUrls.mockResolvedValue(new Map([['media_1', 'https://cdn.example/a.png']]));

      const { data } = await service.listContent('blog', 'en', 20, 'desc');

      expect(data[0]?.data).toEqual({ gallery: ['https://cdn.example/a.png'], cover: null });
    });

    it('never queries media for a hidden MEDIA field', async () => {
      contentTypes.findByName.mockResolvedValue(
        buildContentType({
          fields: [
            buildField(),
            buildField({ id: 'f3', name: 'cover', type: ContentFieldType.MEDIA, isHidden: true }),
          ],
        }),
      );
      repo.findPublishedBySlug.mockResolvedValue(
        buildRow({
          locales: [{ slug: 'hello-world', data: { title: 'Hello', cover: 'media_1' } }],
        }),
      );

      const { data } = await service.getContentBySlug('blog', 'hello-world', 'en');

      expect(repo.findMediaUrls).not.toHaveBeenCalled();
      expect(data.data).toEqual({ title: 'Hello' });
    });
  });

  describe('schema discovery', () => {
    it('projects only safe field metadata and drops hidden fields', async () => {
      contentTypes.findByName.mockResolvedValue(buildContentType());

      const { data } = await service.getSchema('blog');

      expect(data).toEqual({
        name: 'blog',
        displayName: 'Blog',
        localized: true,
        fields: [{ name: 'title', type: ContentFieldType.TEXT, required: true, localized: true }],
      });
      expect(data.fields.some((f) => f.name === 'secret')).toBe(false);
      for (const key of ['id', 'contentTypeId', 'config', 'defaultValue', 'position', 'isUnique']) {
        expect(data.fields[0]).not.toHaveProperty(key);
      }
      for (const key of ['id', 'description', 'isSystem', 'createdAt', 'updatedAt']) {
        expect(data).not.toHaveProperty(key);
      }
    });

    it('lists schemas for every content type', async () => {
      contentTypes.findAll.mockResolvedValue([
        buildContentType(),
        buildContentType({ id: 'ct2', name: 'page', displayName: 'Page', isLocalized: false }),
      ]);

      const { data } = await service.listSchemas();

      expect(data.map((t) => t.name)).toEqual(['blog', 'page']);
      expect(data[1]?.localized).toBe(false);
    });

    it('propagates the 404 for an unknown content type', async () => {
      contentTypes.findByName.mockRejectedValue(new NotFoundException('nope'));

      await expect(service.getSchema('does-not-exist')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
