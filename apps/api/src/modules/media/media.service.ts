import {
  BadRequestException,
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
    const defaultMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    // UPLOAD_ALLOWED_MIME_TYPES is a comma-separated string; split it so the
    // Set holds whole MIME types, not individual characters.
    const mimeList =
      typeof mimes === 'string'
        ? mimes
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean)
        : defaultMimes;
    this.allowedMimes = new Set(mimeList);
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

  /**
   * Downloads a remote file by URL and stores it. Size and MIME type are
   * validated against the same limits as direct uploads.
   */
  async uploadFromUrl(
    url: string,
    uploaderId: string,
    opts: { folderId?: string; altText?: string } = {},
  ): Promise<{ data: MediaFile }> {
    const { buffer, mimeType, originalName } = await this.fetchRemoteFile(url);

    const ext = extname(originalName);
    const key = `${randomUUID()}${ext}`;
    const { url: storedUrl, storageKey } = await this.storage.upload(key, buffer, mimeType);
    const { width, height } = this.getImageDimensions({
      mimetype: mimeType,
      buffer,
      originalname: originalName,
    } as Express.Multer.File);

    const media = await this.repo.create({
      filename: key,
      originalName,
      mimeType,
      size: buffer.length,
      url: storedUrl,
      storageKey,
      provider: 'local',
      width: width ?? null,
      height: height ?? null,
      ...(opts.altText !== undefined ? { altText: opts.altText } : {}),
      ...(opts.folderId ? { folder: { connect: { id: opts.folderId } } } : {}),
      uploadedBy: { connect: { id: uploaderId } },
    });

    await this.enqueueOptimizationJobs(media.id, storageKey, mimeType);
    this.eventEmitter.emit('media.uploaded', {
      mediaId: media.id,
      mimeType: media.mimeType,
      url: media.url,
    });
    return { data: media };
  }

  /** Downloads and validates a remote file (URL, size, MIME, magic bytes). */
  private async fetchRemoteFile(
    url: string,
  ): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
    const parsed = this.parseHttpUrl(url);

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    } catch (err: unknown) {
      throw new UnprocessableEntityException(`Failed to fetch URL: ${String(err)}`);
    }
    if (!res.ok) {
      throw new UnprocessableEntityException(`Remote returned ${res.status} for the URL`);
    }

    const mimeType = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    if (!this.allowedMimes.has(mimeType)) {
      throw new UnprocessableEntityException(`MIME type ${mimeType || 'unknown'} is not allowed`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > this.maxBytes) {
      throw new UnprocessableEntityException(
        `File exceeds max size of ${this.maxBytes / 1024 / 1024}MB`,
      );
    }
    if (!validateMagicBytes(buffer, mimeType)) {
      throw new UnprocessableEntityException(
        'File type mismatch: magic bytes do not match content-type',
      );
    }
    return { buffer, mimeType, originalName: this.fileNameFromUrl(parsed, mimeType) };
  }

  private parseHttpUrl(url: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http(s) URLs are supported');
    }
    return parsed;
  }

  private fileNameFromUrl(parsed: URL, mimeType: string): string {
    const base = parsed.pathname.split('/').filter(Boolean).pop() ?? 'download';
    if (extname(base)) return base;
    const extByMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
    };
    return `${base}${extByMime[mimeType] ?? ''}`;
  }
}
