import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import type { Env } from '../../config/env.schema';

export const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = 10;

/**
 * Multer buffers the whole request body before any handler runs, so the size
 * limit has to be declared here — a check inside MediaService happens after the
 * allocation it is meant to prevent.
 */
export function buildMulterOptions(
  maxFileSizeMb: Env['UPLOAD_MAX_FILE_SIZE_MB'] | undefined,
): MulterOptions {
  const megabytes = maxFileSizeMb ?? DEFAULT_UPLOAD_MAX_FILE_SIZE_MB;
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: megabytes * 1024 * 1024,
      files: 1,
      fields: 20,
    },
  };
}
