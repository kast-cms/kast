import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Processor(QUEUE_NAMES.TRASH, { concurrency: 1 })
export class TrashProcessor extends WorkerHost {
  private readonly logger = new Logger(TrashProcessor.name);

  constructor(private readonly prisma: PrismaService) {
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
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.logger.log(`Running hard delete for items trashed before ${cutoff.toISOString()}`);

    const [deletedEntries, deletedMedia] = await Promise.all([
      this.prisma.contentEntry.deleteMany({ where: { trashedAt: { lte: cutoff } } }),
      this.prisma.mediaFile.deleteMany({ where: { trashedAt: { lte: cutoff } } }),
    ]);

    this.logger.log(
      `Hard deleted ${deletedEntries.count} content entries and ${deletedMedia.count} media files`,
    );
  }
}
