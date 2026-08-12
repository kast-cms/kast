import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { PublishReconciliationService } from './publish-reconciliation.service';
import { PublishProcessor } from './publish.processor';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: QUEUE_NAMES.PUBLISH })],
  providers: [PublishProcessor, PublishReconciliationService],
})
export class PublishModule {}
