/**
 * Locks the anonymous attack surface: /api/v1/delivery/* is the ONLY public
 * read surface. Every management content / content-type / media read must
 * answer 401 without credentials.
 */
import type { INestApplication } from '@nestjs/common';
import { adminToken, bearer, createTestApp, httpServer } from './test-app';
import request = require('supertest');

describe('Public surface containment (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const typeName = 'guarded-type';
  const base = `/api/v1/content-types/${typeName}/entries`;
  let entryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await adminToken(app);

    await request(httpServer(app))
      .post('/api/v1/content-types')
      .set(...bearer(token))
      .send({ name: typeName, displayName: 'Guarded Type' })
      .expect(201);

    await request(httpServer(app))
      .post(`/api/v1/content-types/${typeName}/fields`)
      .set(...bearer(token))
      .send({ name: 'title', displayName: 'Title', type: 'TEXT' })
      .expect(201);

    const created = await request(httpServer(app))
      .post(base)
      .set(...bearer(token))
      .send({ locale: 'en', data: { slug: 'guarded-entry', title: 'Guarded' } })
      .expect(201);
    entryId = created.body.data?.id ?? created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('management routes reject anonymous callers', () => {
    it.each([
      ['content type list', '/api/v1/content-types'],
      ['content type detail', `/api/v1/content-types/${typeName}`],
      ['media list', '/api/v1/media'],
      ['media detail', '/api/v1/media/00000000-0000-0000-0000-000000000000'],
    ])('401 on %s', async (_label, url) => {
      await request(httpServer(app)).get(url).expect(401);
    });

    it.each(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED', 'TRASHED'])(
      '401 on the entry list filtered by status=%s',
      async (status) => {
        await request(httpServer(app)).get(`${base}?status=${status}`).expect(401);
      },
    );

    it('401 on the unfiltered entry list', async () => {
      await request(httpServer(app)).get(base).expect(401);
    });

    it('401 on the entry detail route', async () => {
      await request(httpServer(app)).get(`${base}/${entryId}`).expect(401);
    });

    it('401 on the entry detail route even for a trashed entry', async () => {
      await request(httpServer(app))
        .delete(`${base}/${entryId}`)
        .set(...bearer(token))
        .expect(204);
      await request(httpServer(app)).get(`${base}/${entryId}`).expect(401);
    });
  });

  describe('delivery stays public', () => {
    it('serves public settings anonymously (200)', async () => {
      const res = await request(httpServer(app)).get('/api/v1/delivery/settings').expect(200);
      expect(res.body.data).toBeDefined();
    });

    it('serves the sitemap anonymously (200)', async () => {
      await request(httpServer(app)).get('/api/v1/delivery/sitemap.xml').expect(200);
    });
  });
});
