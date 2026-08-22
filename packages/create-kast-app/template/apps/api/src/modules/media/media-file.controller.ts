import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { LOCAL_MEDIA_ROUTE_PATH, contentDispositionFor, mimeTypeForKey } from './media.constants';
import { STORAGE_ADAPTER } from './media.processor';
import { MediaRepository } from './media.repository';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import type { StorageAdapter } from './storage/storage.adapter';

/**
 * Serves objects written by {@link LocalStorageAdapter}. Media URLs have to
 * resolve for anonymous readers — the delivery API hands them to public front
 * ends and the admin renders them in plain <img> tags — so this mirrors what an
 * S3/R2 public bucket does rather than gating on a bearer token. It answers 404
 * whenever another adapter is active, so switching provider cannot leave a stale
 * reader on the local directory.
 */
@Controller({ path: LOCAL_MEDIA_ROUTE_PATH, version: '1' })
export class MediaFileController {
  constructor(
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly local: LocalStorageAdapter,
    private readonly repo: MediaRepository,
  ) {}

  @Public()
  @Get('*key')
  @ApiExcludeEndpoint()
  async serve(@Param('key') key: string | string[], @Res() res: Response): Promise<void> {
    if (this.storage !== this.local) throw new NotFoundException('Not found');
    const storageKey = Array.isArray(key) ? key.join('/') : key;
    const sourceKey = storageKey.startsWith('thumbs/')
      ? storageKey.split('/').slice(2).join('/')
      : storageKey.startsWith('variants/')
        ? storageKey
            .split('/')
            .slice(2)
            .join('/')
            .replace(/\.webp$/, '')
        : storageKey;
    if (!(await this.repo.findActiveByStorageKey(sourceKey))) {
      throw new NotFoundException('Not found');
    }
    const object = await this.local.resolveObject(storageKey);
    if (object === null) throw new NotFoundException('Not found');

    const mimeType = mimeTypeForKey(storageKey);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', contentDispositionFor(storageKey, mimeType));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Overrides the app-wide policy: an upload must never be able to run script
    // or reach anything from this origin, even if a browser renders it anyway.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    // helmet defaults this to same-origin, which would stop a front end on
    // another origin from loading media the delivery API told it about.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    await new Promise<void>((resolvePromise, reject) => {
      const options = { root: object.root, dotfiles: 'deny' as const, acceptRanges: true };
      res.sendFile(object.relativePath, options, (err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        resolvePromise();
      });
    }).catch((err: NodeJS.ErrnoException) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (err.code === 'ENOENT' || err.code === 'EISDIR') throw new NotFoundException('Not found');
      throw err;
    });
  }
}
