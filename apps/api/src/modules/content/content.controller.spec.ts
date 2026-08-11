// content.controller -> content.service -> sanitize-rich-text.util pulls in an
// ESM-only transitive dep that ts-jest will not transform; mock it the same way
// content.service.spec.ts does so the controller under test loads cleanly.
jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return { default: { sanitize }, sanitize };
});

import {
  ValidationPipe,
  VersioningType,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { deriveRouteTarget } from '../../common/authorization/route-permission.util';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { ContentTypesService } from '../content-types/content-types.service';
import { ContentController } from './content.controller';
import type { EntryWithLocale } from './content.repository';
import { ContentService } from './content.service';
import { buildField, buildType } from './validation/test-fixtures';
import request = require('supertest');

const ENTRY = {
  id: 'e1',
  contentTypeId: 'ct1',
  status: 'DRAFT',
  publishedAt: null,
  scheduledAt: null,
  trashedAt: null,
  isAiGenerated: false,
  createdById: 'u1',
  createdBy: { id: 'u1', firstName: 'Ada', lastName: 'Lovelace' },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  locales: [
    {
      id: 'l1',
      entryId: 'e1',
      localeCode: 'en',
      slug: 'hello',
      data: { title: 'Hello' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  ],
} as unknown as EntryWithLocale;

describe('ContentController', () => {
  let app: INestApplication;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        data: [ENTRY],
        meta: { total: 1, limit: 20, cursor: null, hasNextPage: false },
      }),
      findOne: jest.fn().mockResolvedValue({ data: ENTRY }),
      unarchive: jest.fn().mockResolvedValue({ data: ENTRY }),
      bulkTrash: jest.fn().mockResolvedValue({ data: { results: [], succeeded: 0, failed: 0 } }),
      bulkPublish: jest.fn().mockResolvedValue({ data: { results: [], succeeded: 0, failed: 0 } }),
      bulkUnpublish: jest
        .fn()
        .mockResolvedValue({ data: { results: [], succeeded: 0, failed: 0 } }),
      publish: jest.fn().mockResolvedValue({ data: ENTRY }),
    };
    const contentTypes = {
      findByName: jest
        .fn()
        .mockResolvedValue(buildType([buildField({ id: 'f-title', name: 'title' })])),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        { provide: ContentService, useValue: service },
        { provide: ContentTypesService, useValue: contentTypes },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // The global JwtAuthGuard populates req.user in production; this stands in
    // for it so @CurrentUser() routes resolve the same way they do at runtime.
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { id: 'u1', email: 'a@k.local', roles: ['admin'] };
      next();
    });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost)));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();
  const base = '/api/v1/content-types/blog/entries';

  describe('bulk routes (CON-03)', () => {
    it.each([
      ['trash', 'bulkTrash'],
      ['publish', 'bulkPublish'],
      ['unpublish', 'bulkUnpublish'],
    ])('routes bulk/%s to the bulk handler, not to :id', async (action, method) => {
      const res = await request(server())
        .post(`${base}/bulk/${action}`)
        .send({ ids: ['a', 'b'] })
        .expect(200);

      expect(service[method]).toHaveBeenCalledWith(
        'blog',
        ['a', 'b'],
        ...(method === 'bulkTrash' ? ['u1'] : []),
      );
      // 'bulk' must not have been read as an entry id by the single-entry route.
      expect(service['publish']).not.toHaveBeenCalledWith('blog', 'bulk', expect.anything());
      expect(res.body.data).toEqual({ results: [], succeeded: 0, failed: 0 });
    });

    it('rejects an empty id list', async () => {
      await request(server()).post(`${base}/bulk/trash`).send({ ids: [] }).expect(400);
      expect(service['bulkTrash']).not.toHaveBeenCalled();
    });

    it('rejects a batch larger than the cap', async () => {
      await request(server())
        .post(`${base}/bulk/trash`)
        .send({ ids: Array.from({ length: 101 }, (_, i) => `e${i}`) })
        .expect(400);
      expect(service['bulkTrash']).not.toHaveBeenCalled();
    });
  });

  describe('restore vs unarchive (CON-08)', () => {
    it('serves :id/unarchive', async () => {
      await request(server()).post(`${base}/e1/unarchive`).expect(201);
      expect(service['unarchive']).toHaveBeenCalledWith('blog', 'e1');
    });

    it('keeps :id/restore working as an alias', async () => {
      await request(server()).post(`${base}/e1/restore`).expect(201);
      expect(service['unarchive']).toHaveBeenCalledWith('blog', 'e1');
    });
  });

  // The scope guards derive resource:action from this controller's own route
  // metadata, so the mapping is asserted against the real class rather than a
  // copy of the paths.
  describe('permission derived from the real route metadata', () => {
    const reflector = new Reflector();
    const contextFor = (handler: string): ExecutionContext =>
      ({
        getClass: () => ContentController,
        getHandler: () =>
          (ContentController.prototype as unknown as Record<string, unknown>)[handler],
      }) as unknown as ExecutionContext;
    const targetOf = (handler: string, method: string): { resource: string; action: string } =>
      deriveRouteTarget(
        contextFor(handler),
        { method, params: {} } as unknown as Request,
        reflector,
      );

    it.each([
      ['bulkTrash', 'POST', 'remove', 'DELETE'],
      ['bulkPublish', 'POST', 'publish', 'POST'],
      ['bulkUnpublish', 'POST', 'unpublish', 'POST'],
      ['restore', 'POST', 'unarchive', 'POST'],
    ])('%s (%s) needs what %s (%s) needs', (bulk, bulkMethod, single, singleMethod) => {
      expect(targetOf(bulk, bulkMethod)).toMatchObject(targetOf(single, singleMethod));
    });

    it('derives content:delete for the bulk trash route', () => {
      expect(targetOf('bulkTrash', 'POST')).toMatchObject({
        resource: 'content',
        action: 'delete',
        resolved: true,
      });
    });
  });

  describe('response shape', () => {
    it('flattens the active locale onto a detail response and keeps every translation', async () => {
      const res = await request(server()).get(`${base}/e1`).expect(200);

      expect(res.body.data).toMatchObject({
        id: 'e1',
        locale: 'en',
        slug: 'hello',
        data: { title: 'Hello' },
        authorName: 'Ada Lovelace',
      });
      expect(res.body.data.locales).toHaveLength(1);
    });

    it('adds titleField to list rows', async () => {
      const res = await request(server()).get(base).expect(200);

      expect(res.body.data[0]).toMatchObject({ titleField: 'Hello', locale: 'en' });
      expect(res.body.meta).toEqual({ total: 1, limit: 20, cursor: null, hasNextPage: false });
    });

    it('forwards force to the publish gate', async () => {
      await request(server()).post(`${base}/e1/publish`).send({ force: true }).expect(201);

      expect(service['publish']).toHaveBeenCalledWith('blog', 'e1', { force: true });
    });
  });
});
