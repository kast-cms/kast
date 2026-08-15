import type { Job } from 'bullmq';
import { MediaProcessor, type MediaJobData } from './media.processor';
import type { MediaRepository } from './media.repository';
import { THUMBNAIL_WIDTHS } from './storage/derived-keys.util';
import type { StorageAdapter } from './storage/storage.adapter';

/**
 * sharp is a native binding and does not load under ts-jest's default-import
 * interop, so it is stubbed. What is under test here is the derive job's
 * ordering and cleanup, not the encoder.
 */
const encoded = (label: string): Buffer => Buffer.from(`${label}-bytes`);
jest.mock('sharp', () => {
  const chain = (label: string): Record<string, unknown> => ({
    webp: () => chain(label),
    resize: (width: number) => chain(`thumb-${String(width)}`),
    toBuffer: () => Promise.resolve(Buffer.from(`${label}-bytes`)),
    metadata: () => Promise.resolve({ width: 32, height: 24 }),
  });
  return { __esModule: true, default: () => chain('webp') };
});

const UPLOADED_KEY = '2026/08/photo.png';
const WEBP_KEY = `${UPLOADED_KEY}.webp`;

function job(overrides: Partial<MediaJobData> = {}, name = 'derive'): Job<MediaJobData> {
  return {
    name,
    data: { mediaFileId: 'm1', storageKey: UPLOADED_KEY, mimeType: 'image/png', ...overrides },
  } as Job<MediaJobData>;
}

describe('MediaProcessor (ADV-14 original retention)', () => {
  let storage: jest.Mocked<StorageAdapter>;
  let repo: { update: jest.Mock; findByIdIncludingTrashed: jest.Mock };
  let processor: MediaProcessor;

  beforeEach(() => {
    storage = {
      provider: 'local',
      upload: jest.fn(async (key: string) => ({ url: `https://cdn.test/${key}`, storageKey: key })),
      read: jest.fn(async () => encoded('original')),
      delete: jest.fn(async () => undefined),
      getSignedUrl: jest.fn(),
    } as unknown as jest.Mocked<StorageAdapter>;
    repo = {
      update: jest.fn(async () => ({})),
      findByIdIncludingTrashed: jest.fn(async () => null),
    };
    processor = new MediaProcessor(storage, repo as unknown as MediaRepository);
  });

  it('reads the uploaded object once and reclaims it after both derivatives land', async () => {
    await processor.process(job());

    expect(storage.read).toHaveBeenCalledTimes(1);
    expect(storage.read).toHaveBeenCalledWith(UPLOADED_KEY);

    const uploaded = storage.upload.mock.calls.map(([key]) => key);
    expect(uploaded).toContain(WEBP_KEY);
    for (const width of THUMBNAIL_WIDTHS) {
      expect(uploaded).toContain(`thumbs/${String(width)}/${UPLOADED_KEY}`);
    }

    expect(storage.delete).toHaveBeenCalledWith(UPLOADED_KEY);
  });

  it('deletes the original only after the row points at the WebP', async () => {
    const order: string[] = [];
    repo.update.mockImplementation(async () => {
      order.push('row-updated');
      return {};
    });
    storage.delete.mockImplementation(async () => {
      order.push('original-deleted');
    });

    await processor.process(job());

    expect(order).toEqual(['row-updated', 'original-deleted']);
  });

  it('records the WebP as the row size and carries both thumbnails', async () => {
    await processor.process(job());

    const [, data] = repo.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(data['storageKey']).toBe(WEBP_KEY);
    expect(data['mimeType']).toBe('image/webp');
    expect(data['size']).toBe(data['optimizedSize']);
    expect(Object.keys(data['thumbnails'] as object)).toEqual(
      THUMBNAIL_WIDTHS.map((width) => String(width)),
    );
    expect(data['thumbnailSize']).toBeGreaterThan(0);
  });

  it('keeps the original when the row update fails, so the retry can re-derive', async () => {
    repo.update.mockRejectedValueOnce(new Error('database unreachable'));

    await expect(processor.process(job())).rejects.toThrow('database unreachable');
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('treats a retry of an already-applied derive as done rather than failing', async () => {
    storage.read.mockRejectedValueOnce(new Error('NoSuchKey'));
    repo.findByIdIncludingTrashed.mockResolvedValueOnce({ storageKey: WEBP_KEY });

    await expect(processor.process(job())).resolves.toBeUndefined();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('still fails when the original is missing and nothing was derived', async () => {
    storage.read.mockRejectedValueOnce(new Error('NoSuchKey'));
    repo.findByIdIncludingTrashed.mockResolvedValueOnce({ storageKey: UPLOADED_KEY });

    await expect(processor.process(job())).rejects.toThrow('NoSuchKey');
  });

  it('routes job names queued by an older instance to the same path', async () => {
    await processor.process(job({}, 'optimize'));
    await processor.process(job({}, 'thumbnail'));

    expect(repo.update).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it('skips non-raster uploads without touching storage', async () => {
    await processor.process(job({ mimeType: 'application/pdf' }));

    expect(storage.read).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
