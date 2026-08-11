import type { DynamicModule, INestApplication } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { SeoController } from './seo.controller';
import { REDIRECT_IMPORT_MAX_FILE_SIZE_MB, SeoModule } from './seo.module';
import { SeoService } from './seo.service';

import request = require('supertest');

/** The registration the running app uses, not a copy of it. */
function multerRegistration(): DynamicModule {
  const imports = (Reflect.getMetadata('imports', SeoModule) ?? []) as unknown[];
  const found = imports.find(
    (entry): entry is DynamicModule =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as DynamicModule).module === MulterModule,
  );
  if (!found) throw new Error('SeoModule no longer registers MulterModule');
  return found;
}

describe('POST /seo/redirects/import upload bounds (MED-04)', () => {
  let app: INestApplication;
  let service: { importRedirects: jest.Mock };

  beforeEach(async () => {
    service = {
      importRedirects: jest.fn().mockResolvedValue({ imported: 1, skipped: 0, errors: [] }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [multerRegistration()],
      controllers: [SeoController],
      providers: [{ provide: SeoService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = { id: 'admin-1', email: 'a@b.c', roles: [] };
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuses a body larger than the declared cap before the handler runs', async () => {
    const oversized = Buffer.alloc((REDIRECT_IMPORT_MAX_FILE_SIZE_MB + 1) * 1024 * 1024, 0x61);

    await request(app.getHttpServer())
      .post('/seo/redirects/import')
      .attach('file', oversized, 'redirects.csv')
      .expect(413);

    expect(service.importRedirects).not.toHaveBeenCalled();
  });

  it('still accepts a redirect CSV of a realistic size', async () => {
    const csv = Buffer.from('fromPath,toPath,type,isActive\n/a,/b,PERMANENT,true\n', 'utf8');

    await request(app.getHttpServer())
      .post('/seo/redirects/import')
      .attach('file', csv, 'redirects.csv')
      .expect(200);

    expect(service.importRedirects).toHaveBeenCalledWith(csv.toString('utf8'), 'admin-1');
  });
});
