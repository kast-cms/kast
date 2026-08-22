import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { MediaRepository } from './media.repository';
import { MEDIA_VARIANTS, THUMBNAIL_WIDTHS, variantStorageKey } from './storage/derived-keys.util';
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
  'image/webp',
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
      case 'variants':
        return this.handleVariants(job.data);
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
        optimizedSize: webpBuffer.length,
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
      const thumbnails: Record<string, { url: string; size: number }> = {};
      let thumbnailSize = 0;
      for (const width of THUMBNAIL_WIDTHS) {
        const thumbBuffer = await sharp(original).resize(width).webp({ quality: 80 }).toBuffer();
        const thumbKey = `thumbs/${width}/${storageKey}`;
        const { url } = await this.storage.upload(thumbKey, thumbBuffer, 'image/webp');
        thumbnails[String(width)] = { url, size: thumbBuffer.length };
        thumbnailSize += thumbBuffer.length;
        this.logger.log(`Thumbnail ${width}px written for ${mediaFileId}`);
      }
      await this.repo.update(mediaFileId, { thumbnails, thumbnailSize });
    } catch (err: unknown) {
      this.logger.error(`Failed to generate thumbnails for ${mediaFileId}`, err);
      throw err;
    }
  }

  private async handleVariants(data: MediaJobData): Promise<void> {
    const { mediaFileId, storageKey, mimeType } = data;
    if (!RASTER_TYPES.has(mimeType)) {
      this.logger.debug(`Skipping variants for non-raster: ${mimeType}`);
      return;
    }
    const media = await this.repo.findByIdIncludingTrashed(mediaFileId);
    if (!media || media.trashedAt) return;
    const sourceKey = media.originalStorageKey ?? storageKey;
    const focalPoint = this.focalPoint(media.focalPoint);
    const original = await this.storage.read(sourceKey);
    const variants: Record<
      string,
      { url: string; size: number; width: number; height: number; mimeType: string }
    > = {};
    let variantSize = 0;
    for (const [name, spec] of Object.entries(MEDIA_VARIANTS)) {
      const variantBuffer = await sharp(original)
        .resize(spec.width, spec.height, { fit: 'cover', position: this.cropPosition(focalPoint) })
        .webp({ quality: 82 })
        .toBuffer();
      const { url } = await this.storage.upload(
        variantStorageKey(name, sourceKey),
        variantBuffer,
        'image/webp',
      );
      variants[name] = {
        url,
        size: variantBuffer.length,
        width: spec.width,
        height: spec.height,
        mimeType: 'image/webp',
      };
      variantSize += variantBuffer.length;
    }
    await this.repo.update(mediaFileId, {
      variants,
      variantSize,
      deliveryTransforms: { mode: 'precomputed', names: Object.keys(MEDIA_VARIANTS) },
    });
  }

  private focalPoint(value: unknown): { x: number; y: number } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const x = Number(record['x']);
    const y = Number(record['y']);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }

  private cropPosition(point: { x: number; y: number } | null): string {
    if (!point) return 'center';
    const horizontal = point.x < 0.33 ? 'west' : point.x > 0.67 ? 'east' : '';
    const vertical = point.y < 0.33 ? 'north' : point.y > 0.67 ? 'south' : '';
    return `${vertical}${horizontal}` || 'center';
  }
}
