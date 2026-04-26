import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Injectable()
export class TrashScheduler {
  private readonly logger = new Logger(TrashScheduler.name);

  constructor(@InjectQueue(QUEUE_NAMES.TRASH) private readonly trashQueue: Queue) {}

  /** Runs daily at 02:00 UTC */
  @Cron('0 2 * * *')
  async scheduleDailyCleanup(): Promise<void> {
    this.logger.log('Enqueueing daily trash hard-delete job');
    await this.trashQueue.add('permanent-delete', {}, { attempts: 1 });
  }
}
