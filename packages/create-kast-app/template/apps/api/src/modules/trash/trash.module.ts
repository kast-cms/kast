import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { TrashController } from './trash.controller';
import { TrashProcessor } from './trash.processor';
import { TrashScheduler } from './trash.scheduler';
import { TrashService } from './trash.service';

@Module({
  // MediaModule so the purge can release stored objects, not just rows.
  imports: [PrismaModule, MediaModule, BullModule.registerQueue({ name: QUEUE_NAMES.TRASH })],
  controllers: [TrashController],
  providers: [TrashService, TrashProcessor, TrashScheduler],
})
export class TrashModule {}
