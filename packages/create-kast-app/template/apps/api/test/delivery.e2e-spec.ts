/**
 * Proves the public delivery surface returns published, non-trashed content
 * only, and that the schema route leaks no internal metadata.
 *
 * The fixture is written straight through PrismaService rather than the HTTP
 * publish route because publishing runs the SEO gate, which would reject these
 * minimal rows.
 */
import type { INestApplication } from '@nestjs/common';
import { ContentFieldType, ContentStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, httpServer } from './test-app';
import request = require('supertest');

const TYPE_NAME = 'delivery-fixture';
const SLUGS = {
  published: 'delivery-published',
  draft: 'delivery-draft',
  scheduled: 'delivery-scheduled',
  archived: 'delivery-archived',
  trashed: 'delivery-trashed',
} as const;

describe('Delivery public surface (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let contentTypeId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const author = await prisma.user.findFirstOrThrow({ where: { email: 'admin@kast.local' } });
    const ct = await prisma.contentType.create({
      data: {
        name: TYPE_NAME,
        displayName: 'Delivery Fixture',
        description: 'internal-only description',
        isLocalized: true,
        fields: {
          create: [
            {
              name: 'title',
              displayName: 'Title',
              type: ContentFieldType.TEXT,
              isRequired: true,
              isLocalized: true,
              position: 0,
              config: { internalWebhook: 'https://internal.example/hook' },
            },
            {
              name: 'internalNotes',
              displayName: 'Internal Notes',
              type: ContentFieldType.TEXT,
              isHidden: true,
              position: 1,
            },
          ],
        },
      },
    });
    contentTypeId = ct.id;

    const seed = async (
      slug: string,
      status: ContentStatus,
      extra: { trashedAt?: Date; publishedAt?: Date } = {},
    ): Promise<void> => {
      await prisma.contentEntry.create({
        data: {
          contentTypeId,
          status,
          createdById: author.id,
          publishedAt: extra.publishedAt ?? null,
          trashedAt: extra.trashedAt ?? null,
          locales: { create: { localeCode: 'en', slug, data: { title: slug } } },
          seoMeta: { create: { metaTitle: `Meta ${slug}` } },
        },
      });
    };

    await seed(SLUGS.published, ContentStatus.PUBLISHED, { publishedAt: new Date() });
    await seed(SLUGS.draft, ContentStatus.DRAFT);
    await seed(SLUGS.scheduled, ContentStatus.SCHEDULED);
    await seed(SLUGS.archived, ContentStatus.ARCHIVED);
    await seed(SLUGS.trashed, ContentStatus.PUBLISHED, {
      publishedAt: new Date(),
      trashedAt: new Date(),
    });
  });

  afterAll(async () => {
    await prisma.contentEntry.deleteMany({ where: { contentTypeId } });
    await prisma.contentType.delete({ where: { id: contentTypeId } });
    await app.close();
  });

  describe('content', () => {
    it('lists only the published, non-trashed entry', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/delivery/content/${TYPE_NAME}?locale=en`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.data.map((e: { slug: string }) => e.slug)).toEqual([SLUGS.published]);
    });

    it('exposes no status, author or content-type ids on delivery entries', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/delivery/content/${TYPE_NAME}?locale=en`)
        .expect(200);

      const entry = res.body.data[0] as Record<string, unknown>;
      for (const key of [
        'status',
        'createdById',
        'updatedById',
        'contentTypeId',
        'trashedAt',
        'scheduledAt',
      ]) {
        expect(entry).not.toHaveProperty(key);
      }
      expect(entry.seoMeta).toHaveProperty('ogImageUrl');
      expect(entry.seoMeta).not.toHaveProperty('ogImageId');
    });

    it.each([SLUGS.draft, SLUGS.scheduled, SLUGS.archived, SLUGS.trashed])(
      'returns 404 for the %s entry',
      async (slug) => {
        await request(httpServer(app))
          .get(`/api/v1/delivery/content/${TYPE_NAME}/${slug}?locale=en`)
          .expect(404);
      },
    );

    it('serves the published entry by slug (200)', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/delivery/content/${TYPE_NAME}/${SLUGS.published}?locale=en`)
        .expect(200);
      expect(res.body.data.slug).toBe(SLUGS.published);
    });

    it('requires a locale (400)', async () => {
      await request(httpServer(app)).get(`/api/v1/delivery/content/${TYPE_NAME}`).expect(400);
    });
  });

  describe('schema discovery', () => {
    it('lists safe schema metadata anonymously (200)', async () => {
      const res = await request(httpServer(app)).get('/api/v1/delivery/schema').expect(200);

      const type = (res.body.data as Record<string, unknown>[]).find(
        (t) => t.name === TYPE_NAME,
      ) as Record<string, unknown>;
      expect(Object.keys(type).sort()).toEqual(['displayName', 'fields', 'localized', 'name']);
    });

    it('omits hidden fields and every internal field property', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/delivery/schema/${TYPE_NAME}`)
        .expect(200);

      const fields = res.body.data.fields as Record<string, unknown>[];
      expect(fields.map((f) => f.name)).toEqual(['title']);
      expect(Object.keys(fields[0] as object).sort()).toEqual([
        'localized',
        'name',
        'required',
        'type',
      ]);
      for (const key of ['id', 'contentTypeId', 'description', 'isSystem']) {
        expect(res.body.data).not.toHaveProperty(key);
      }
    });

    it('returns 404 for an unknown content type', async () => {
      await request(httpServer(app)).get('/api/v1/delivery/schema/does-not-exist').expect(404);
    });
  });
});
