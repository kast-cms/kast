import type { INestApplication } from '@nestjs/common';
import { adminToken, bearer, createTestApp, httpServer } from './test-app';
import request = require('supertest');

describe('Content types & entries (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const typeName = 'article';

  beforeAll(async () => {
    app = await createTestApp();
    token = await adminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('content-types', () => {
    it('creates a content type (201)', async () => {
      const res = await request(httpServer(app))
        .post('/api/v1/content-types')
        .set(...bearer(token))
        .send({ name: typeName, displayName: 'Article' })
        .expect(201);
      expect(res.body.name ?? res.body.data?.name).toBe(typeName);
    });

    it('rejects a duplicate slug/name with 409', async () => {
      const res = await request(httpServer(app))
        .post('/api/v1/content-types')
        .set(...bearer(token))
        .send({ name: typeName, displayName: 'Dup' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('lists content types publicly (200)', async () => {
      const res = await request(httpServer(app)).get('/api/v1/content-types').expect(200);
      const list = (res.body.data ?? res.body) as { name: string }[];
      expect(list.some((t) => t.name === typeName)).toBe(true);
    });

    it('gets a content type by name publicly (200)', async () => {
      const res = await request(httpServer(app))
        .get(`/api/v1/content-types/${typeName}`)
        .expect(200);
      expect(res.body.name ?? res.body.data?.name).toBe(typeName);
    });

    it('returns 404 for an unknown content type', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/content-types/does-not-exist')
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects content-type creation without auth (401)', async () => {
      await request(httpServer(app))
        .post('/api/v1/content-types')
        .send({ name: 'x', displayName: 'X' })
        .expect(401);
    });

    it('rejects an invalid body (missing displayName) with 400', async () => {
      await request(httpServer(app))
        .post('/api/v1/content-types')
        .set(...bearer(token))
        .send({ name: 'incomplete' })
        .expect(400);
    });

    it('adds a field to the content type (201)', async () => {
      await request(httpServer(app))
        .post(`/api/v1/content-types/${typeName}/fields`)
        .set(...bearer(token))
        .send({ name: 'body', displayName: 'Body', type: 'RICH_TEXT' })
        .expect(201);
    });
  });

  describe('content entries', () => {
    let entryId: string;
    const base = `/api/v1/content-types/${typeName}/entries`;

    it('creates an entry (201) and emits the created id', async () => {
      const res = await request(httpServer(app))
        .post(base)
        .set(...bearer(token))
        .send({ locale: 'en', data: { slug: 'first-post', title: 'First' } })
        .expect(201);
      entryId = res.body.data?.id ?? res.body.id;
      expect(entryId).toBeDefined();
    });

    it('rejects a duplicate slug within the same locale with 409', async () => {
      const res = await request(httpServer(app))
        .post(base)
        .set(...bearer(token))
        .send({ locale: 'en', data: { slug: 'first-post', title: 'Dup slug' } })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects a missing data payload with 400', async () => {
      await request(httpServer(app))
        .post(base)
        .set(...bearer(token))
        .send({ locale: 'en' })
        .expect(400);
    });

    it('lists entries publicly (200)', async () => {
      const res = await request(httpServer(app)).get(base).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('gets an entry by id publicly (200)', async () => {
      const res = await request(httpServer(app)).get(`${base}/${entryId}`).expect(200);
      expect(res.body.data.id).toBe(entryId);
    });

    it('returns 404 for an unknown entry id', async () => {
      const res = await request(httpServer(app))
        .get(`${base}/00000000-0000-0000-0000-000000000000`)
        .expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('updates an entry (200)', async () => {
      const res = await request(httpServer(app))
        .patch(`${base}/${entryId}`)
        .set(...bearer(token))
        .send({ data: { slug: 'first-post', title: 'Updated title' } })
        .expect(200);
      expect(res.body.data.id).toBe(entryId);
    });

    it('blocks publish behind the SEO gate (422) because meta is missing', async () => {
      const res = await request(httpServer(app))
        .post(`${base}/${entryId}/publish`)
        .set(...bearer(token))
        .send({})
        .expect(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE');
    });

    it('rejects entry creation by an unauthenticated caller (401)', async () => {
      await request(httpServer(app))
        .post(base)
        .send({ locale: 'en', data: { slug: 'x' } })
        .expect(401);
    });
  });
});
