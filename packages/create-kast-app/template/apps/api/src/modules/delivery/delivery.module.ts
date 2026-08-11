import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContentTypesModule } from '../content-types/content-types.module';
import { MenuModule } from '../menus/menu.module';
import { SeoModule } from '../seo/seo.module';
import { SettingsModule } from '../settings/settings.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryRepository } from './delivery.repository';
import { DeliveryService } from './delivery.service';
import { RedirectMiddleware } from './redirect.middleware';

@Module({
  imports: [PrismaModule, ContentTypesModule, MenuModule, SettingsModule, SeoModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryRepository, RedirectMiddleware],
  exports: [DeliveryService],
})
export class DeliveryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 / path-to-regexp v8 require named wildcards.
    consumer.apply(RedirectMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.GET });
  }
}
