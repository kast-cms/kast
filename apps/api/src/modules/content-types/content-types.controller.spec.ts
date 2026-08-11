import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { ContentTypesController } from './content-types.controller';
import type { ContentTypeWithCounts } from './content-types.repository';
import { ContentTypesService } from './content-types.service';

import request = require('supertest');

const CONTENT_TYPE = {
  id: 'ct1',
  name: 'blog_post',
  displayName: 'Blog Post',
  description: null,
  icon: null,
  isSystem: false,
  isLocalized: true,
  fields: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  _count: { fields: 3, entries: 42 },
} as unknown as ContentTypeWithCounts;

describe('ContentTypesController', () => {
  let app: INestApplication;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([CONTENT_TYPE]),
      findDetailByName: jest.fn().mockResolvedValue(CONTENT_TYPE),
      create: jest.fn().mockResolvedValue(CONTENT_TYPE),
      reorderFields: jest.fn().mockResolvedValue(CONTENT_TYPE),
      updateField: jest.fn().mockResolvedValue({ id: 'f1' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContentTypesController],
      providers: [{ provide: ContentTypesService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    // Mirrors main.ts exactly, including the implicit conversion that turns a
    // bare string into whatever the property is declared as.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost)));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();

  describe('field reorder (CON-02)', () => {
    it('routes fields/reorder to the reorder handler, not to :fieldName', async () => {
      await request(server())
        .patch('/api/v1/content-types/blog_post/fields/reorder')
        .send({ order: ['body', 'title'] })
        .expect(200);

      expect(service['reorderFields']).toHaveBeenCalledWith('blog_post', {
        order: ['body', 'title'],
      });
      expect(service['updateField']).not.toHaveBeenCalled();
    });

    it('rejects a body that is not a list of field names', async () => {
      await request(server())
        .patch('/api/v1/content-types/blog_post/fields/reorder')
        .send({ order: 'title' })
        .expect(400);
      expect(service['reorderFields']).not.toHaveBeenCalled();
    });

    it('still routes a real field name to the field handler', async () => {
      await request(server())
        .patch('/api/v1/content-types/blog_post/fields/title')
        .send({ isRequired: true })
        .expect(200);

      expect(service['updateField']).toHaveBeenCalledWith('blog_post', 'title', {
        isRequired: true,
      });
    });
  });

  describe('response shape', () => {
    it('exposes the relation counts and the localization flag', async () => {
      const res = await request(server()).get('/api/v1/content-types/blog_post').expect(200);

      expect(res.body.data).toMatchObject({
        name: 'blog_post',
        isLocalized: true,
        fieldsCount: 3,
        entriesCount: 42,
      });
      expect(res.body.data).not.toHaveProperty('_count');
    });

    it('shapes list rows the same way', async () => {
      const res = await request(server()).get('/api/v1/content-types').expect(200);

      expect(res.body.data[0]).toMatchObject({ fieldsCount: 3, entriesCount: 42 });
    });

    it('reads a string boolean as the operator wrote it, not as truthiness', async () => {
      await request(server())
        .post('/api/v1/content-types')
        .send({ name: 'post', displayName: 'Post', isLocalized: 'false' })
        .expect(201);

      expect(service['create']).toHaveBeenCalledWith(
        expect.objectContaining({ isLocalized: false }),
      );
    });

    it('does not flip an existing type to localized on PATCH isLocalized="false"', async () => {
      service['update'] = jest.fn().mockResolvedValue(CONTENT_TYPE);

      await request(server())
        .patch('/api/v1/content-types/blog_post')
        .send({ isLocalized: 'false' })
        .expect(200);

      expect(service['update']).toHaveBeenCalledWith(
        'blog_post',
        expect.objectContaining({ isLocalized: false }),
      );
    });

    it('rejects a boolean flag that is neither a boolean nor "true"/"false"', async () => {
      await request(server())
        .post('/api/v1/content-types')
        .send({ name: 'post', displayName: 'Post', isLocalized: 'maybe' })
        .expect(400);

      expect(service['create']).not.toHaveBeenCalled();
    });

    it('applies the same reading to the field flags', async () => {
      await request(server())
        .patch('/api/v1/content-types/blog_post/fields/title')
        .send({ isRequired: 'false', isUnique: 'false', isHidden: 'false', isLocalized: 'false' })
        .expect(200);

      expect(service['updateField']).toHaveBeenCalledWith('blog_post', 'title', {
        isRequired: false,
        isUnique: false,
        isHidden: false,
        isLocalized: false,
      });
    });

    it('accepts isLocalized on create (CON-11)', async () => {
      await request(server())
        .post('/api/v1/content-types')
        .send({ name: 'blog_post', displayName: 'Blog Post', isLocalized: true })
        .expect(201);

      expect(service['create']).toHaveBeenCalledWith({
        name: 'blog_post',
        displayName: 'Blog Post',
        isLocalized: true,
      });
    });
  });
});
