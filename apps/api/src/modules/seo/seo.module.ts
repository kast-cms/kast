import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RobotsController } from './robots.controller';
import { SeoController } from './seo.controller';
import { SeoProcessor } from './seo.processor';
import { SeoRepository } from './seo.repository';
import { SeoService } from './seo.service';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: QUEUE_NAMES.SEO })],
  controllers: [SeoController, RobotsController],
  providers: [SeoService, SeoRepository, SeoProcessor],
  exports: [SeoService],
})
export class SeoModule {}
