import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { QueueModule } from '../queue/queue.module';
import { WebhookController } from './webhook.controller';
import { WebhookListener } from './webhook.listener';
import { WebhookProcessor } from './webhook.processor';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

@Module({
  imports: [PrismaModule, QueueModule, BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOK })],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookRepository, WebhookProcessor, WebhookListener],
  exports: [WebhookService],
})
export class WebhookModule {}
