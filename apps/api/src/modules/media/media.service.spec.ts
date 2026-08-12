import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { MediaFile } from '@prisma/client';
import type { Env } from '../../config/env.schema';
import type { QueueAdapter } from '../queue/queue.adapter';
import type { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import type { StorageAdapter, StorageProviderId } from './storage/storage.adapter';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function pngUpload(originalname = 'photo.png'): Express.Multer.File {
  return {
    originalname,
    mimetype: 'image/png',
    size: PNG.length,
    buffer: PNG,
  } as Express.Multer.File;
}

function mediaRow(overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    id: 'media-1',
    storageKey: 'key.png',
    size: PNG.length,
    originalSize: null,
    optimizedSize: null,
    thumbnailSize: 0,
    thumbnails: null,
    usages: [],
    _count: { usages: 0 },
    ...overrides,
  } as MediaFile;
}

interface Harness {
  service: MediaService;
  repo: jest.Mocked<MediaRepository>;
  storage: jest.Mocked<StorageAdapter>;
}

function makeService(provider: StorageProviderId = 'local'): Harness {
  const repo = {
    create: jest.fn(async (data: unknown) => mediaRow(data as Partial<MediaFile>)),
    findById: jest.fn(async () => mediaRow()),
    findByIdIncludingTrashed: jest.fn(async () => mediaRow()),
    softDelete: jest.fn(async () => mediaRow()),
    hardDelete: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<MediaRepository>;

  const storage = {
    provider,
    upload: jest.fn(async (key: string) => ({ url: `https://cdn.test/${key}`, storageKey: key })),
    read: jest.fn(),
    delete: jest.fn(async () => undefined),
    getSignedUrl: jest.fn(),
  } as unknown as jest.Mocked<StorageAdapter>;

  const config = {
    get: (key: keyof Env) =>
      key === 'UPLOAD_MAX_FILE_SIZE_MB' ? 10 : 'image/jpeg,image/png,application/pdf',
  } as unknown as ConfigService<Env>;

  const queue = { enqueue: jest.fn(async () => undefined) } as unknown as QueueAdapter;
  const events = { emit: jest.fn() } as unknown as EventEmitter2;

  return { service: new MediaService(repo, storage, config, queue, events), repo, storage };
}

describe('MediaService', () => {
  describe('provider identity (MED-03)', () => {
    it.each<StorageProviderId>(['local', 's3', 'r2'])(
      'persists the active adapter identity (%s) on upload',
      async (provider) => {
        const { service, repo } = makeService(provider);

        await service.upload(pngUpload(), 'user-1');

        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ provider }));
      },
    );

    it('does not hard-code local when a remote adapter is active', async () => {
      const { service, repo } = makeService('r2');

      await service.upload(pngUpload(), 'user-1');

      expect(repo.create).not.toHaveBeenCalledWith(expect.objectContaining({ provider: 'local' }));
    });
  });

  describe('storage keys', () => {
    it('drops an extension that is not a plain alphanumeric suffix', async () => {
      const { service, storage } = makeService();

      await service.upload(pngUpload('photo.png/../../evil'), 'user-1');

      const key = storage.upload.mock.calls[0]?.[0] ?? '';
      expect(key).not.toContain('/');
      expect(key).not.toContain('..');
    });
  });

  describe('delete keeps the object until purge (MED-02)', () => {
    it('soft-deletes without touching storage', async () => {
      const { service, repo, storage } = makeService();

      await service.delete('media-1');

      expect(repo.softDelete).toHaveBeenCalledWith('media-1', undefined);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('records who trashed the file (TRASH-03)', async () => {
      const { service, repo } = makeService();

      await service.delete('media-1', 'user-7');

      expect(repo.softDelete).toHaveBeenCalledWith('media-1', 'user-7');
    });

    it('404s for a file that is already trashed', async () => {
      const { service, repo } = makeService();
      (repo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.delete('media-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('purge removes the stored object and then the row', async () => {
      const { service, repo, storage } = makeService();

      await service.purge('media-1');

      expect(storage.delete).toHaveBeenCalledWith('key.png');
      expect(repo.hardDelete).toHaveBeenCalledWith('media-1');
      expect((storage.delete as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        (repo.hardDelete as jest.Mock).mock.invocationCallOrder[0] as number,
      );
    });

    it('purge still removes the row when the object is already gone', async () => {
      const { service, repo, storage } = makeService();
      (storage.delete as jest.Mock).mockRejectedValueOnce(new Error('NoSuchKey'));

      await service.purge('media-1');

      expect(repo.hardDelete).toHaveBeenCalledWith('media-1');
    });

    it('purge also removes the thumbnails nothing recorded (TRASH-05)', async () => {
      const { service, storage } = makeService();

      await service.purge('media-1');

      const deleted = (storage.delete as jest.Mock).mock.calls.map(([key]: [string]) => key);
      expect(deleted).toContain('thumbs/400/key.png');
      expect(deleted).toContain('thumbs/800/key.png');
    });

    it('purge 404s for an unknown id', async () => {
      const { service, repo } = makeService();
      (repo.findByIdIncludingTrashed as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.purge('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remote upload bounds (MED-04)', () => {
    const REMOTE_URL = 'https://93.184.216.34/photo.png';
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    /** A response whose body streams `chunks` and declares `contentLength` when given. */
    function remoteResponse(chunks: Buffer[], contentLength?: number): Response {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
          controller.close();
        },
      });
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          ...(contentLength === undefined ? {} : { 'content-length': String(contentLength) }),
        },
      });
    }

    it('refuses a Content-Length over the limit before the body is buffered', async () => {
      const { service, repo } = makeService();
      // Small body, enormous declared length: only the header check can catch it.
      global.fetch = jest.fn(async () =>
        Promise.resolve(remoteResponse([PNG], 64 * 1024 * 1024)),
      ) as unknown as typeof fetch;

      await expect(service.uploadFromUrl(REMOTE_URL, 'user-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('abandons a body that passes the limit while streaming, even with no Content-Length', async () => {
      const { service, repo } = makeService();
      const megabyte = Buffer.alloc(1024 * 1024, 0x61);
      global.fetch = jest.fn(async () =>
        Promise.resolve(remoteResponse(Array.from({ length: 12 }, () => megabyte))),
      ) as unknown as typeof fetch;

      await expect(service.uploadFromUrl(REMOTE_URL, 'user-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('still stores a remote file inside the limit', async () => {
      const { service, repo } = makeService();
      global.fetch = jest.fn(async () =>
        Promise.resolve(remoteResponse([PNG], PNG.length)),
      ) as unknown as typeof fetch;

      await service.uploadFromUrl(REMOTE_URL, 'user-1');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: 'image/png', size: PNG.length }),
      );
    });
  });

  describe('upload validation (MED-04 / MED-08)', () => {
    it('rejects a file over the configured limit', async () => {
      const { service } = makeService();
      const big = { ...pngUpload(), size: 11 * 1024 * 1024 } as Express.Multer.File;

      await expect(service.upload(big, 'user-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('rejects an SVG when it is not in the allow-list', async () => {
      const { service } = makeService();
      const svg = {
        originalname: 'x.svg',
        mimetype: 'image/svg+xml',
        size: 20,
        buffer: Buffer.from('<svg onload="alert(1)"/>'),
      } as Express.Multer.File;

      await expect(service.upload(svg, 'user-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });
});
