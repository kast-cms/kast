import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { MediaRepository } from './media.repository';
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
      case 'optimize':
        return this.handleOptimize(job.data);
      case 'thumbnail':
        return this.handleThumbnail(job.data);
      default:
        this.logger.warn(`Unknown media job: ${String(job.name)}`);
    }
  }

  private async handleOptimize(data: MediaJobData): Promise<void> {
    const { mediaFileId, storageKey, mimeType } = data;
    if (!RASTER_TYPES.has(mimeType)) {
      this.logger.debug(`Skipping optimize for non-raster: ${mimeType}`);
      return;
    }
    this.logger.log(`Optimizing ${mediaFileId} (${storageKey})`);
    try {
      const original = await this.storage.read(storageKey);
      const webpBuffer = await sharp(original).webp({ quality: 85 }).toBuffer();
      const webpKey = `${storageKey}.webp`;
      const { url } = await this.storage.upload(webpKey, webpBuffer, 'image/webp');
      const meta = await sharp(webpBuffer).metadata();
      await this.repo.update(mediaFileId, {
        url,
        storageKey: webpKey,
        mimeType: 'image/webp',
        size: webpBuffer.length,
        width: (meta.width as number | null | undefined) ?? null,
        height: (meta.height as number | null | undefined) ?? null,
      });
      this.logger.log(`Optimized ${mediaFileId} -> ${webpKey}`);
    } catch (err: unknown) {
      this.logger.error(`Failed to optimize ${mediaFileId}`, err);
      throw err;
    }
  }

  private async handleThumbnail(data: MediaJobData): Promise<void> {
    const { mediaFileId, storageKey, mimeType } = data;
    if (!RASTER_TYPES.has(mimeType)) {
      this.logger.debug(`Skipping thumbnail for non-raster: ${mimeType}`);
      return;
    }
    this.logger.log(`Generating thumbnails for ${mediaFileId}`);
    try {
      const original = await this.storage.read(storageKey);
      for (const width of [400, 800]) {
        const thumbBuffer = await sharp(original).resize(width).webp({ quality: 80 }).toBuffer();
        const thumbKey = `thumbs/${width}/${storageKey}`;
        await this.storage.upload(thumbKey, thumbBuffer, 'image/webp');
        this.logger.log(`Thumbnail ${width}px written for ${mediaFileId}`);
      }
    } catch (err: unknown) {
      this.logger.error(`Failed to generate thumbnails for ${mediaFileId}`, err);
      throw err;
    }
  }
}
