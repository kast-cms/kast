import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { MediaFile } from '@prisma/client';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import type { PaginatedResult } from '../../common/types/auth.types';
import { validateMagicBytes } from '../../common/utils/mime-magic.util';
import type { Env } from '../../config/env.schema';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { MediaJobData } from './media.processor';
import { MediaRepository } from './media.repository';
import type { StorageAdapter } from './storage/storage.adapter';

const sizeOf = require('image-size') as (buf: Buffer) => { width?: number; height?: number } | null;

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const OPTIMIZE_RASTER_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly maxBytes: number;
  private readonly allowedMimes: Set<string>;

  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: StorageAdapter,
    config: ConfigService<Env>,
    private readonly queue: QueueAdapter,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const maxMb = config.get('UPLOAD_MAX_FILE_SIZE_MB', { infer: true }) ?? 10;
    this.maxBytes = maxMb * 1024 * 1024;
    const mimes = config.get('UPLOAD_ALLOWED_MIME_TYPES', { infer: true });
    this.allowedMimes = new Set(
      mimes ?? ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
    );
  }

  async upload(file: Express.Multer.File, uploaderId: string): Promise<{ data: MediaFile }> {
    if (file.size > this.maxBytes) {
      throw new UnprocessableEntityException(
        `File exceeds max size of ${this.maxBytes / 1024 / 1024}MB`,
      );
    }
    if (!this.allowedMimes.has(file.mimetype)) {
      throw new UnprocessableEntityException(`MIME type ${file.mimetype} is not allowed`);
    }
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new UnprocessableEntityException(
        'File type mismatch: magic bytes do not match declared MIME type',
      );
    }

    const ext = extname(file.originalname);
    const key = `${randomUUID()}${ext}`;
    const { url, storageKey } = await this.storage.upload(key, file.buffer, file.mimetype);
    const { width, height } = this.getImageDimensions(file);

    const media = await this.repo.create({
      filename: key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      storageKey,
      provider: 'local',
      width: width ?? null,
      height: height ?? null,
      uploadedBy: { connect: { id: uploaderId } },
    });

    await this.enqueueOptimizationJobs(media.id, storageKey, file.mimetype);
    this.eventEmitter.emit('media.uploaded', {
      mediaId: media.id,
      mimeType: media.mimeType,
      url: media.url,
    });
    return { data: media };
  }

  private getImageDimensions(file: Express.Multer.File): {
    width?: number;
    height?: number;
  } {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) return {};
    try {
      const dim = sizeOf(file.buffer);
      const result: { width?: number; height?: number } = {};
      if (dim?.width !== undefined) result.width = dim.width;
      if (dim?.height !== undefined) result.height = dim.height;
      return result;
    } catch {
      this.logger.warn(`Could not get dimensions for ${file.originalname}`);
      return {};
    }
  }

  private async enqueueOptimizationJobs(
    mediaFileId: string,
    storageKey: string,
    mimeType: string,
  ): Promise<void> {
    if (!OPTIMIZE_RASTER_TYPES.has(mimeType)) return;
    const jobData: MediaJobData = { mediaFileId, storageKey, mimeType };
    await Promise.all([
      this.queue.enqueue(QUEUE_NAMES.MEDIA, 'optimize', jobData, { attempts: 3 }),
      this.queue.enqueue(QUEUE_NAMES.MEDIA, 'thumbnail', jobData, { attempts: 3 }),
    ]);
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<MediaFile>> {
    const limit = query.limit ?? 20;
    const { items, total } = await this.repo.findAll(query);
    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, limit) : items;
    const cursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
    return { data, meta: { total, limit, cursor, hasNextPage } };
  }

  async findById(id: string): Promise<{ data: MediaFile }> {
    const media = await this.repo.findById(id);
    if (!media) throw new NotFoundException(`Media ${id} not found`);
    return { data: media };
  }

  async update(
    id: string,
    data: { altText?: string; caption?: string; folderId?: string },
  ): Promise<{ data: MediaFile }> {
    await this.findById(id);
    const updated = await this.repo.update(id, data);
    return { data: updated };
  }

  async delete(id: string): Promise<void> {
    const { data: media } = await this.findById(id);
    await this.storage.delete(media.storageKey);
    await this.repo.softDelete(id);
  }
}
