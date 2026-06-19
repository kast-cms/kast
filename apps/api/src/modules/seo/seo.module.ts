import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RobotsController } from './robots.controller';
import { SeoController } from './seo.controller';
import { SeoProcessor } from './seo.processor';
import { SeoRepository } from './seo.repository';
import { SeoService } from './seo.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    MulterModule.register({ storage: memoryStorage() }),
    BullModule.registerQueue({ name: QUEUE_NAMES.SEO }),
  ],
  controllers: [SeoController, RobotsController],
  providers: [SeoService, SeoRepository, SeoProcessor],
  exports: [SeoService],
})
export class SeoModule {}
