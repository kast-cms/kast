import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../prisma/prisma.module';
import { buildMulterOptions } from '../media/upload.options';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RobotsController } from './robots.controller';
import { SeoController } from './seo.controller';
import { SeoProcessor } from './seo.processor';
import { SeoRepository } from './seo.repository';
import { SeoService } from './seo.service';

/**
 * The redirect import buffers the upload in memory before the handler runs, so
 * it declares the same kind of bound the media uploads do. A redirect table is
 * a few hundred rows of short paths; two megabytes is generous for that.
 */
export const REDIRECT_IMPORT_MAX_FILE_SIZE_MB = 2;

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    MulterModule.register(buildMulterOptions(REDIRECT_IMPORT_MAX_FILE_SIZE_MB)),
    BullModule.registerQueue({ name: QUEUE_NAMES.SEO }),
  ],
  controllers: [SeoController, RobotsController],
  providers: [SeoService, SeoRepository, SeoProcessor],
  exports: [SeoService],
})
export class SeoModule {}
