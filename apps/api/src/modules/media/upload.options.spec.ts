import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  type INestApplication,
} from '@nestjs/common';
import { FileInterceptor, MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DEFAULT_UPLOAD_MAX_FILE_SIZE_MB, buildMulterOptions } from './upload.options';
import request = require('supertest');

@Controller('probe')
class ProbeController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File | undefined): { size: number | null } {
    return { size: file?.size ?? null };
  }
}

describe('buildMulterOptions (MED-04)', () => {
  it('derives the byte limit from the validated env value', () => {
    expect(buildMulterOptions(3).limits?.fileSize).toBe(3 * 1024 * 1024);
    expect(buildMulterOptions(undefined).limits?.fileSize).toBe(
      DEFAULT_UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
    );
  });

  it('caps the number of files per request', () => {
    expect(buildMulterOptions(1).limits?.files).toBe(1);
  });

  describe('enforced at the multer layer', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [MulterModule.register(buildMulterOptions(1))],
        controllers: [ProbeController],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('accepts a request inside the limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/probe')
        .attach('file', Buffer.alloc(512 * 1024, 1), 'small.bin')
        .expect(201);

      expect(res.body.size).toBe(512 * 1024);
    });

    it('rejects an oversized upload with 413 before the handler runs', async () => {
      await request(app.getHttpServer())
        .post('/probe')
        .attach('file', Buffer.alloc(2 * 1024 * 1024, 1), 'big.bin')
        .expect(413);
    });

    it('rejects a second file in the same request', async () => {
      await request(app.getHttpServer())
        .post('/probe')
        .attach('file', Buffer.alloc(16, 1), 'a.bin')
        .attach('other', Buffer.alloc(16, 1), 'b.bin')
        .expect(400);
    });
  });
});
