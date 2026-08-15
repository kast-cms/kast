import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { MediaRepository } from './media.repository';
import { THUMBNAIL_WIDTHS } from './storage/derived-keys.util';
import type { StorageAdapter } from './storage/storage.adapter';

export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';

export interface MediaJobData {
  mediaFileId: string;
  storageKey: string;
  mimeType: string;
}

const RASTER_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

@Processor(QUEUE_NAMES.MEDIA, { concurrency: 2 })
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly repo: MediaRepository,
  ) {
    super();
  }

  async process(job: Job<MediaJobData>): Promise<void> {
    switch (job.name) {
      // `optimize` and `thumbnail` were separate jobs until the original-retention
      // fix; both names stay routed here so jobs queued by an older instance across
      // a rolling deploy still complete instead of dead-lettering as unknown.
      case 'derive':
      case 'optimize':
      case 'thumbnail':
        return this.handleDerive(job.data);
      default:
        this.logger.warn(`Unknown media job: ${String(job.name)}`);
    }
  }

  /**
   * Renders every derivative from a single read of the uploaded object, then
   * reclaims that object.
   *
   * Optimize and thumbnailing used to run as two jobs enqueued in parallel, both
   * reading the uploaded key. Neither could delete it — either would have pulled
   * the bytes out from under the other — so the original stayed for the life of
   * the row, unreferenced and uncounted (`size` is overwritten with the WebP's).
   * Running them in sequence makes the last reader known, so the original can go
   * as soon as its derivatives are durable.
   */
  private async handleDerive(data: MediaJobData): Promise<void> {
    const { mediaFileId, storageKey, mimeType } = data;
    if (!RASTER_TYPES.has(mimeType)) {
      this.logger.debug(`Skipping derive for non-raster: ${mimeType}`);
      return;
    }
    this.logger.log(`Deriving ${mediaFileId} (${storageKey})`);
    try {
      const original = await this.storage.read(storageKey);
      const webp = await this.writeOptimized(storageKey, original);
      const thumbs = await this.writeThumbnails(storageKey, original);

      await this.repo.update(mediaFileId, {
        url: webp.url,
        storageKey: webp.key,
        mimeType: 'image/webp',
        size: webp.size,
        optimizedSize: webp.size,
        width: webp.width,
        height: webp.height,
        thumbnails: thumbs.thumbnails,
        thumbnailSize: thumbs.thumbnailSize,
      });

      // Only after the row points at the WebP: a crash before this leaves the
      // original in place and the retry re-derives from it.
      await this.storage.delete(storageKey);
      this.logger.log(`Derived ${mediaFileId} -> ${webp.key}, original reclaimed`);
    } catch (err: unknown) {
      if (await this.alreadyDerived(mediaFileId, storageKey)) {
        this.logger.log(`Derive for ${mediaFileId} already applied, nothing to redo`);
        return;
      }
      this.logger.error(`Failed to derive ${mediaFileId}`, err);
      throw err;
    }
  }

  private async writeOptimized(
    storageKey: string,
    original: Buffer,
  ): Promise<{
    key: string;
    url: string;
    size: number;
    width: number | null;
    height: number | null;
  }> {
    const webpBuffer = await sharp(original).webp({ quality: 85 }).toBuffer();
    const key = `${storageKey}.webp`;
    const { url } = await this.storage.upload(key, webpBuffer, 'image/webp');
    const meta = await sharp(webpBuffer).metadata();
    return {
      key,
      url,
      size: webpBuffer.length,
      width: (meta.width as number | null | undefined) ?? null,
      height: (meta.height as number | null | undefined) ?? null,
    };
  }

  private async writeThumbnails(
    storageKey: string,
    original: Buffer,
  ): Promise<{ thumbnails: Record<string, { url: string; size: number }>; thumbnailSize: number }> {
    const thumbnails: Record<string, { url: string; size: number }> = {};
    let thumbnailSize = 0;
    for (const width of THUMBNAIL_WIDTHS) {
      const thumbBuffer = await sharp(original).resize(width).webp({ quality: 80 }).toBuffer();
      // Keyed off the uploaded key, not the WebP: `derivedStorageKeys` rebuilds
      // this same path at purge time from whichever key the row ends up holding.
      const thumbKey = `thumbs/${width}/${storageKey}`;
      const { url } = await this.storage.upload(thumbKey, thumbBuffer, 'image/webp');
      thumbnails[String(width)] = { url, size: thumbBuffer.length };
      thumbnailSize += thumbBuffer.length;
    }
    return { thumbnails, thumbnailSize };
  }

  /**
   * A retry of an already-applied derive fails on the first read, because the
   * original it names has been reclaimed. That is success, not failure — so it
   * must not be retried until the queue gives up and reports a broken upload.
   */
  private async alreadyDerived(mediaFileId: string, storageKey: string): Promise<boolean> {
    try {
      const row = await this.repo.findByIdIncludingTrashed(mediaFileId);
      return row?.storageKey === `${storageKey}.webp`;
    } catch {
      return false;
    }
  }
}
