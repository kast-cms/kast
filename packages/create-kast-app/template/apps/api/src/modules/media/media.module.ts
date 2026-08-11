import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import type { Env } from '../../config/env.schema';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { MediaFileController } from './media-file.controller';
import { MediaFolderService } from './media-folder.service';
import { MediaController } from './media.controller';
import { MediaProcessor, STORAGE_ADAPTER } from './media.processor';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { R2StorageAdapter } from './storage/r2-storage.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { buildMulterOptions } from './upload.options';

@Module({
  imports: [
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) =>
        buildMulterOptions(config.get('UPLOAD_MAX_FILE_SIZE_MB', { infer: true })),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.MEDIA }),
  ],
  controllers: [MediaFileController, MediaController],
  providers: [
    MediaRepository,
    MediaFolderService,
    LocalStorageAdapter,
    S3StorageAdapter,
    R2StorageAdapter,
    {
      provide: STORAGE_ADAPTER,
      inject: [ConfigService, LocalStorageAdapter, S3StorageAdapter, R2StorageAdapter],
      useFactory: (
        config: ConfigService<Env>,
        local: LocalStorageAdapter,
        s3: S3StorageAdapter,
        r2: R2StorageAdapter,
      ) => {
        const provider = config.get('STORAGE_PROVIDER', { infer: true });
        if (provider === 'r2') return r2;
        if (provider === 's3') return s3;
        return local;
      },
    },
    {
      provide: MediaService,
      inject: [MediaRepository, STORAGE_ADAPTER, ConfigService, QueueAdapter, EventEmitter2],
      useFactory: (
        repo: MediaRepository,
        storage: LocalStorageAdapter | S3StorageAdapter | R2StorageAdapter,
        config: ConfigService<Env>,
        queue: QueueAdapter,
        eventEmitter: EventEmitter2,
      ) => new MediaService(repo, storage, config, queue, eventEmitter),
    },
    MediaProcessor,
  ],
  exports: [MediaService],
})
export class MediaModule {}
