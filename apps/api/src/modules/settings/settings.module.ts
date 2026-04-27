import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MaintenanceMiddleware } from './maintenance.middleware';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsRepository, SettingsService, MaintenanceMiddleware],
  exports: [SettingsService],
})
export class SettingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(MaintenanceMiddleware)
      .forRoutes({ path: '*/delivery/*', method: RequestMethod.ALL });
  }
}
