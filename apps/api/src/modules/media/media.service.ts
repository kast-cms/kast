import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { MediaFile } from '@prisma/client';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import type { PaginatedResult } from '../../common/types/auth.types';
import { validateMagicBytes } from '../../common/utils/mime-magic.util';
import type { Env } from '../../config/env.schema';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { ListMediaDto } from './dto/list-media.dto';
import type { MediaJobData } from './media.processor';
import { MediaRepository, type MediaDetailRow, type MediaListRow } from './media.repository';
import { fetchRemoteMedia } from './remote-media-fetcher';
import { derivedStorageKeys } from './storage/derived-keys.util';
import { safeExtension } from './storage/storage-key.util';
import type { StorageAdapter } from './storage/storage.adapter';

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

export interface MediaFileView extends Omit<MediaFile, 'thumbnails'> {
  folder: { id: string; name: string } | null;
  usagesCount: number;
  thumbnails: Record<string, { url: string; size: number }>;
  totalSize: number;
}

export interface MediaFileDetailView extends MediaFileView {
  usages: Array<{
    entryId: string;
    contentType: string;
    fieldName: string;
    entryTitle: string | null;
  }>;
}

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

  async upload(
    file: Express.Multer.File | undefined,
    uploaderId: string,
    folderId?: string,
  ): Promise<{ data: MediaFileDetailView }> {
    if (!file) {
      throw new BadRequestException('No file was uploaded under the "file" field');
    }
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

    const key = `${randomUUID()}${safeExtension(file.originalname)}`;
    const { url, storageKey } = await this.storage.upload(key, file.buffer, file.mimetype);
    const { width, height } = await this.getImageDimensions(file);

    const media = await this.repo.create({
      filename: key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      storageKey,
      provider: this.storage.provider,
      originalStorageKey: storageKey,
      originalUrl: url,
      originalSize: file.size,
      width: width ?? null,
      height: height ?? null,
      ...(folderId ? { folder: { connect: { id: folderId } } } : {}),
      uploadedBy: { connect: { id: uploaderId } },
    });

    await this.enqueueOptimizationJobs(media.id, storageKey, file.mimetype);
    this.eventEmitter.emit('media.uploaded', {
      mediaId: media.id,
      mimeType: media.mimeType,
      url: media.url,
    });
    return this.findById(media.id);
  }

  /**
   * Reads dimensions with sharp, which this module already uses for
   * optimisation. It replaced `image-size`, whose DoS advisories
   * (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) have no patched release — and
   * this path parses attacker-supplied uploads.
   */
  private async getImageDimensions(file: {
    mimetype: string;
    buffer: Buffer;
    originalname: string;
  }): Promise<{ width?: number; height?: number }> {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) return {};
    try {
      const meta = await sharp(file.buffer).metadata();
      return { width: meta.width, height: meta.height };
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
    // One job, not two: optimize and thumbnailing both consume the uploaded
    // object, and running them in sequence is what lets the processor delete it
    // afterwards instead of leaving an unreferenced original behind.
    await this.queue.enqueue(QUEUE_NAMES.MEDIA, 'derive', jobData, {
      attempts: 3,
      jobId: `media-derive-${mediaFileId}`,
      removeOnComplete: true,
    });
  }

  async findAll(query: ListMediaDto): Promise<PaginatedResult<MediaFileView>> {
    const limit = query.limit ?? 20;
    const { items, total } = await this.repo.findAll(query);
    const hasNextPage = items.length > limit;
    const rows = hasNextPage ? items.slice(0, limit) : items;
    const data = rows.map((item) => this.toView(item));
    const cursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
    return { data, meta: { total, limit, cursor, hasNextPage } };
  }

  async findById(id: string): Promise<{ data: MediaFileDetailView }> {
    const media = await this.repo.findById(id);
    if (!media) throw new NotFoundException(`Media ${id} not found`);
    return { data: this.toDetailView(media) };
  }

  async update(
    id: string,
    data: { altText?: string; caption?: string; folderId?: string },
  ): Promise<{ data: MediaFileDetailView }> {
    await this.findById(id);
    await this.repo.update(id, data);
    return this.findById(id);
  }

  /**
   * Moves the file to the trash. The stored object stays put: trash restore only
   * clears `trashedAt`, so dropping the bytes here would restore a broken row.
   * {@link purge} is what releases storage.
   */
  async delete(id: string, actorId?: string): Promise<void> {
    await this.findById(id);
    await this.repo.softDelete(id, actorId);
    this.eventEmitter.emit('media.deleted', { mediaId: id });
  }

  /**
   * Permanent delete: removes every object the row owns, then the row itself.
   * Thumbnails and the pre-optimization original are stored beside the current
   * key without being recorded, so {@link derivedStorageKeys} reconstructs them.
   */
  async purge(id: string): Promise<void> {
    const media = await this.repo.findByIdIncludingTrashed(id);
    if (!media) throw new NotFoundException(`Media ${id} not found`);
    const failures: string[] = [];
    for (const key of derivedStorageKeys(media.storageKey)) {
      try {
        await this.storage.delete(key);
      } catch (err: unknown) {
        // An object that is already gone is the goal state of a delete, not a
        // cleanup failure — only a retained object may retain the row.
        if (this.isAlreadyGone(err)) continue;
        this.logger.warn(`Could not delete stored object ${key}: ${String(err)}`);
        failures.push(key);
      }
    }
    if (failures.length > 0) {
      throw new ServiceUnavailableException(
        `Media storage cleanup failed for ${failures.length} object(s); the row was retained`,
      );
    }
    await this.repo.hardDelete(id);
  }

  private isAlreadyGone(err: unknown): boolean {
    const code = (err as Partial<NodeJS.ErrnoException> | null)?.code ?? '';
    const text = `${code} ${err instanceof Error ? err.message : String(err)}`;
    return /NoSuchKey|NotFound|ENOENT|\b404\b/i.test(text);
  }

  /**
   * Downloads a remote file by URL and stores it. Size and MIME type are
   * validated against the same limits as direct uploads.
   */
  async uploadFromUrl(
    url: string,
    uploaderId: string,
    opts: { folderId?: string; altText?: string } = {},
  ): Promise<{ data: MediaFileDetailView }> {
    const { buffer, mimeType, originalName } = await fetchRemoteMedia(
      url,
      this.allowedMimes,
      this.maxBytes,
    );

    const key = `${randomUUID()}${safeExtension(originalName)}`;
    const { url: storedUrl, storageKey } = await this.storage.upload(key, buffer, mimeType);
    const { width, height } = await this.getImageDimensions({
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
      provider: this.storage.provider,
      originalStorageKey: storageKey,
      originalUrl: storedUrl,
      originalSize: buffer.length,
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
    return this.findById(media.id);
  }

  private toView(row: MediaListRow): MediaFileView {
    const { _count, ...file } = row;
    const thumbnails = this.parseThumbnails(file.thumbnails);
    return {
      ...file,
      thumbnails,
      usagesCount: _count.usages,
      totalSize: (file.originalSize ?? file.size) + (file.optimizedSize ?? 0) + file.thumbnailSize,
    };
  }

  private toDetailView(row: MediaDetailRow): MediaFileDetailView {
    const view = this.toView(row);
    return {
      ...view,
      usages: row.usages.map((usage) => ({
        entryId: usage.entryId,
        contentType: usage.entry.contentType.name,
        fieldName: usage.fieldName,
        entryTitle: this.entryTitle(usage.entry.locales[0]?.data),
      })),
    };
  }

  private parseThumbnails(value: unknown): Record<string, { url: string; size: number }> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, { url: string; size: number }>;
  }

  private entryTitle(data: unknown): string | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const row = data as Record<string, unknown>;
    const value = row['title'] ?? row['name'];
    return typeof value === 'string' ? value : null;
  }
}
