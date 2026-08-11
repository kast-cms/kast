import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { TrashService } from './trash.service';

@Processor(QUEUE_NAMES.TRASH, { concurrency: 1 })
export class TrashProcessor extends WorkerHost {
  private readonly logger = new Logger(TrashProcessor.name);

  constructor(private readonly trash: TrashService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'permanent-delete') {
      await this.runHardDelete();
    } else {
      this.logger.warn(`Unknown trash job: ${String(job.name)}`);
    }
  }

  private async runHardDelete(): Promise<void> {
    const summary = await this.trash.purgeExpired();
    const perModel = Object.entries(summary.models)
      .map(([model, { deleted, failed }]) => `${model}: ${deleted} deleted, ${failed} failed`)
      .join('; ');
    this.logger.log(`Purged trash older than ${summary.cutoff.toISOString()} — ${perModel}`);

    const failures = Object.values(summary.models).reduce((sum, m) => sum + m.failed, 0);
    if (failures > 0) {
      this.logger.error(`${failures} trashed record(s) could not be purged; see errors above`);
    }
  }
}
