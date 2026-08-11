import { NotFoundException, VersioningType, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import request = require('supertest');

const SCHEMA = {
  name: 'blog',
  displayName: 'Blog',
  localized: true,
  fields: [{ name: 'title', type: 'TEXT', required: true, localized: true }],
};

describe('DeliveryController', () => {
  let app: INestApplication;
  let service: { listSchemas: jest.Mock; getSchema: jest.Mock; listContent: jest.Mock };

  beforeEach(async () => {
    service = { listSchemas: jest.fn(), getSchema: jest.fn(), listContent: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [DeliveryController],
      providers: [{ provide: DeliveryService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost)));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();

  it('marks a successful schema response publicly cacheable', async () => {
    service.getSchema.mockResolvedValue({ data: SCHEMA });

    const res = await request(server()).get('/api/v1/delivery/schema/blog').expect(200);

    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  it('never marks a 404 for an unknown content type publicly cacheable', async () => {
    service.getSchema.mockRejectedValue(new NotFoundException('nope'));

    const res = await request(server()).get('/api/v1/delivery/schema/does-not-exist').expect(404);

    expect(res.headers['cache-control']).not.toContain('public');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('never marks a failed schema listing publicly cacheable', async () => {
    service.listSchemas.mockRejectedValue(new Error('database is down'));

    const res = await request(server()).get('/api/v1/delivery/schema').expect(500);

    expect(res.headers['cache-control']).not.toContain('public');
  });

  it('marks a successful schema listing publicly cacheable', async () => {
    service.listSchemas.mockResolvedValue({ data: [SCHEMA] });

    const res = await request(server()).get('/api/v1/delivery/schema').expect(200);

    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  it('falls back to desc rather than passing an unknown order through to the query', async () => {
    service.listContent.mockResolvedValue({
      data: [],
      meta: { total: 0, limit: 20, cursor: null, hasNextPage: false },
    });

    await request(server()).get('/api/v1/delivery/content/blog?locale=en&order=bogus').expect(200);

    expect(service.listContent).toHaveBeenCalledWith('blog', 'en', 20, 'desc', undefined);
  });
});
