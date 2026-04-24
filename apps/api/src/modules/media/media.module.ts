import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Env } from '../../config/env.schema';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';

const STORAGE_ADAPTER = 'STORAGE_ADAPTER';

@Module({
  imports: [ConfigModule, MulterModule.register({ storage: memoryStorage() })],
  controllers: [MediaController],
  providers: [
    MediaRepository,
    LocalStorageAdapter,
    S3StorageAdapter,
    {
      provide: STORAGE_ADAPTER,
      inject: [ConfigService, LocalStorageAdapter, S3StorageAdapter],
      useFactory: (
        config: ConfigService<Env>,
        local: LocalStorageAdapter,
        s3: S3StorageAdapter,
      ) => {
        const provider = config.get('STORAGE_PROVIDER', { infer: true });
        return provider === 's3' ? s3 : local;
      },
    },
    {
      provide: MediaService,
      inject: [MediaRepository, STORAGE_ADAPTER, ConfigService],
      useFactory: (
        repo: MediaRepository,
        storage: LocalStorageAdapter | S3StorageAdapter,
        config: ConfigService<Env>,
      ) => new MediaService(repo, storage, config),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
