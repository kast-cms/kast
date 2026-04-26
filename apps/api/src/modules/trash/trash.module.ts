import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { TrashProcessor } from './trash.processor';
import { TrashScheduler } from './trash.scheduler';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: QUEUE_NAMES.TRASH })],
  providers: [TrashProcessor, TrashScheduler],
})
export class TrashModule {}
