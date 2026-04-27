import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { TrashController } from './trash.controller';
import { TrashProcessor } from './trash.processor';
import { TrashScheduler } from './trash.scheduler';
import { TrashService } from './trash.service';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: QUEUE_NAMES.TRASH })],
  controllers: [TrashController],
  providers: [TrashService, TrashProcessor, TrashScheduler],
})
export class TrashModule {}
