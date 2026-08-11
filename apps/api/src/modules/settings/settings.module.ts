import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocalStorageAdapter } from '../media/storage/local-storage.adapter';
import { R2StorageAdapter } from '../media/storage/r2-storage.adapter';
import { S3StorageAdapter } from '../media/storage/s3-storage.adapter';
import { MaintenanceMiddleware } from './maintenance.middleware';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import { STORAGE_PROBE_ADAPTER } from './storage-probe.token';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [
    SettingsRepository,
    SettingsService,
    MaintenanceMiddleware,
    LocalStorageAdapter,
    S3StorageAdapter,
    R2StorageAdapter,
    {
      // MediaModule keeps its adapter private, so the storage probe selects the
      // same adapter from the same environment variable rather than importing
      // it. Both selections must stay in step.
      provide: STORAGE_PROBE_ADAPTER,
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
  ],
  exports: [SettingsService],
})
export class SettingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 / path-to-regexp v8 require named wildcards. Bind to all routes
    // with the `{*path}` wildcard; the middleware itself filters to delivery
    // routes via `req.path`.
    consumer.apply(MaintenanceMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
