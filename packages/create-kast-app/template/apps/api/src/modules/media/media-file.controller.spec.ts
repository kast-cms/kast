import { VersioningType, type INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { promises as fs, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { Env } from '../../config/env.schema';
import { MediaFileController } from './media-file.controller';
import { STORAGE_ADAPTER } from './media.processor';
import { MediaRepository } from './media.repository';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import type { StorageAdapter } from './storage/storage.adapter';
import request = require('supertest');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

describe('MediaFileController (MED-01)', () => {
  let app: INestApplication;
  let dir: string;
  let outside: string;

  async function boot(useLocalAsActiveAdapter: boolean): Promise<void> {
    const config = {
      get: (key: keyof Env) =>
        key === 'STORAGE_LOCAL_DIR' ? dir : 'http://localhost:3000/api/v1/media/files',
    } as unknown as ConfigService<Env>;
    const local = new LocalStorageAdapter(config);
    const remote: StorageAdapter = {
      provider: 's3',
      upload: jest.fn(),
      read: jest.fn(),
      delete: jest.fn(),
      getSignedUrl: jest.fn(),
    } as unknown as StorageAdapter;

    const moduleRef = await Test.createTestingModule({
      controllers: [MediaFileController],
      providers: [
        { provide: LocalStorageAdapter, useValue: local },
        { provide: STORAGE_ADAPTER, useValue: useLocalAsActiveAdapter ? local : remote },
        {
          provide: MediaRepository,
          useValue: {
            findActiveByStorageKey: jest.fn((key: string) =>
              Promise.resolve(
                ['photo.png', 'drawing.svg', 'notes.pdf', 'payload.bin', 'link.txt'].includes(key)
                  ? { id: key }
                  : null,
              ),
            ),
          },
        },
        // The real global guard, so the anonymous reads below prove @Public is
        // wired rather than assuming it.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'kast-serve-'));
    outside = mkdtempSync(join(tmpdir(), 'kast-serve-outside-'));
    await fs.writeFile(join(outside, 'secret.txt'), 'top secret');
    await fs.writeFile(join(dir, 'photo.png'), PNG);
    await fs.mkdir(join(dir, 'thumbs/400'), { recursive: true });
    await fs.writeFile(join(dir, 'thumbs/400/photo.png'), PNG);
    await fs.writeFile(join(dir, 'drawing.svg'), '<svg onload="alert(1)"></svg>');
    await fs.writeFile(join(dir, 'notes.pdf'), '%PDF-1.4');
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  describe('with the local adapter active', () => {
    beforeEach(() => boot(true));

    it('serves an uploaded file that used to 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/media/files/photo.png')
        .expect(200);

      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['content-disposition']).toBe('inline; filename="photo.png"');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(Buffer.from(res.body as Buffer).equals(PNG)).toBe(true);
    });

    it('serves a nested thumbnail key', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/media/files/thumbs/400/photo.png')
        .expect(200);
    });

    it('forces SVG to download and neutralises it (MED-08)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/media/files/drawing.svg')
        .expect(200);

      expect(res.headers['content-disposition']).toBe('attachment; filename="drawing.svg"');
      expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    });

    it('forces PDF to download', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/media/files/notes.pdf')
        .expect(200);

      expect(res.headers['content-disposition']).toBe('attachment; filename="notes.pdf"');
    });

    it('never trusts a client-supplied content type', async () => {
      await fs.writeFile(join(dir, 'payload.bin'), 'x');
      const res = await request(app.getHttpServer())
        .get('/api/v1/media/files/payload.bin')
        .set('Accept', 'text/html')
        .expect(200);

      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['content-disposition']).toBe('attachment; filename="payload.bin"');
    });

    it.each([
      ['encoded parent traversal', '/api/v1/media/files/..%2f..%2fetc%2fpasswd'],
      ['encoded traversal into a real neighbour dir', '/api/v1/media/files/..%2fsecret.txt'],
      ['dotfile', '/api/v1/media/files/.env'],
      ['unknown key', '/api/v1/media/files/nope.png'],
      ['directory', '/api/v1/media/files/thumbs'],
    ])('404s on %s', async (_label, url) => {
      await request(app.getHttpServer()).get(url).expect(404);
    });

    it('404s on a symlink escaping the upload directory', async () => {
      await fs.symlink(join(outside, 'secret.txt'), join(dir, 'link.txt'));
      await request(app.getHttpServer()).get('/api/v1/media/files/link.txt').expect(404);
    });
  });

  describe('with a remote adapter active', () => {
    beforeEach(() => boot(false));

    it('404s rather than reading the local directory', async () => {
      await request(app.getHttpServer()).get('/api/v1/media/files/photo.png').expect(404);
    });
  });
});
