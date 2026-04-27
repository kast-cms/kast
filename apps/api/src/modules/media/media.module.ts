import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Env } from '../../config/env.schema';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { MediaController } from './media.controller';
import { MediaProcessor, STORAGE_ADAPTER } from './media.processor';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({ storage: memoryStorage() }),
    BullModule.registerQueue({ name: QUEUE_NAMES.MEDIA }),
  ],
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
      inject: [MediaRepository, STORAGE_ADAPTER, ConfigService, QueueAdapter, EventEmitter2],
      useFactory: (
        repo: MediaRepository,
        storage: LocalStorageAdapter | S3StorageAdapter,
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
