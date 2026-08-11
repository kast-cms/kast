/**
 * Locks the anonymous attack surface. Exactly two things are public:
 *   - /api/v1/delivery/*        the published content read API
 *   - /api/v1/media/files/*     stored objects under the local storage adapter
 *
 * The media route is anonymous by design: delivery hands media URLs to public
 * readers and the admin renders them in plain <img> tags, which is what an
 * S3/R2 public bucket does. It serves bytes by opaque storage key only — it
 * exposes no listing and no metadata — so an unknown key must 404, never 401.
 *
 * Every management content / content-type / media read must answer 401 without
 * credentials.
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

  describe('media objects are public, media management is not', () => {
    it('404s an unknown media key rather than 401ing, because the route is public', async () => {
      await request(httpServer(app)).get('/api/v1/media/files/nope.png').expect(404);
    });

    it('refuses to walk out of the upload directory', async () => {
      await request(httpServer(app)).get('/api/v1/media/files/..%2f..%2fetc%2fpasswd').expect(404);
    });

    it('401s the media listing, which would expose every object', async () => {
      await request(httpServer(app)).get('/api/v1/media').expect(401);
    });
  });
});
