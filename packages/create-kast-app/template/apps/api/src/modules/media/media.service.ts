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
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { extname } from 'path';
import sharp from 'sharp';
import type { PaginatedResult } from '../../common/types/auth.types';
import { validateMagicBytes } from '../../common/utils/mime-magic.util';
import { isPrivateAddress } from '../../common/utils/ssrf-guard.util';
import type { Env } from '../../config/env.schema';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { ListMediaDto } from './dto/list-media.dto';
import type { MediaJobData } from './media.processor';
import { MediaRepository } from './media.repository';
import { readBoundedBody } from './remote-body.util';
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

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;

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
  ): Promise<{ data: MediaFile }> {
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
    await Promise.all([
      this.queue.enqueue(QUEUE_NAMES.MEDIA, 'optimize', jobData, { attempts: 3 }),
      this.queue.enqueue(QUEUE_NAMES.MEDIA, 'thumbnail', jobData, { attempts: 3 }),
    ]);
  }

  async findAll(query: ListMediaDto): Promise<PaginatedResult<MediaFile>> {
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

  /**
   * Moves the file to the trash. The stored object stays put: trash restore only
   * clears `trashedAt`, so dropping the bytes here would restore a broken row.
   * {@link purge} is what releases storage.
   */
  async delete(id: string, actorId?: string): Promise<void> {
    await this.findById(id);
    await this.repo.softDelete(id, actorId);
  }

  /**
   * Permanent delete: removes every object the row owns, then the row itself.
   * Thumbnails and the pre-optimization original are stored beside the current
   * key without being recorded, so {@link derivedStorageKeys} reconstructs them.
   */
  async purge(id: string): Promise<void> {
    const media = await this.repo.findByIdIncludingTrashed(id);
    if (!media) throw new NotFoundException(`Media ${id} not found`);
    for (const key of derivedStorageKeys(media.storageKey)) {
      try {
        await this.storage.delete(key);
      } catch (err: unknown) {
        // A missing or unreachable object must not strand the row in the trash.
        this.logger.warn(`Could not delete stored object ${key}: ${String(err)}`);
      }
    }
    await this.repo.hardDelete(id);
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

    const res = await this.fetchGuarded(url);
    if (!res.ok) {
      throw new UnprocessableEntityException(`Remote returned ${res.status} for the URL`);
    }

    const mimeType = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    if (!this.allowedMimes.has(mimeType)) {
      throw new UnprocessableEntityException(`MIME type ${mimeType || 'unknown'} is not allowed`);
    }

    const buffer = await readBoundedBody(res, this.maxBytes);
    if (!validateMagicBytes(buffer, mimeType)) {
      throw new UnprocessableEntityException(
        'File type mismatch: magic bytes do not match content-type',
      );
    }
    return { buffer, mimeType, originalName: this.fileNameFromUrl(parsed, mimeType) };
  }

  /** Fetches a URL, blocking SSRF to private/internal hosts and re-validating each redirect hop. */
  private async fetchGuarded(initialUrl: string): Promise<Response> {
    let target = this.parseHttpUrl(initialUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await this.assertPublicUrl(target);
      let res: Response;
      try {
        res = await fetch(target, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          redirect: 'manual',
        });
      } catch (err: unknown) {
        throw new UnprocessableEntityException(`Failed to fetch URL: ${String(err)}`);
      }
      if (res.status < 300 || res.status >= 400) return res;
      const location = res.headers.get('location');
      if (location === null) return res;
      target = this.parseHttpUrl(new URL(location, target).toString());
    }
    throw new UnprocessableEntityException('Too many redirects while fetching the URL');
  }

  /** Rejects hosts that resolve to loopback/private/link-local addresses (SSRF guard). */
  private async assertPublicUrl(parsed: URL): Promise<void> {
    const host = parsed.hostname
      .toLowerCase()
      .replace(/\.$/, '')
      .replace(/^\[|\]$/g, '');
    let addresses: string[];
    if (isIP(host) !== 0) {
      addresses = [host];
    } else {
      try {
        addresses = (await lookup(host, { all: true })).map((record) => record.address);
      } catch {
        throw new BadRequestException('Could not resolve URL host');
      }
    }
    if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address))) {
      throw new BadRequestException('URL host is not allowed');
    }
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
