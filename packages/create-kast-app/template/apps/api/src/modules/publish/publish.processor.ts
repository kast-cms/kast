import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface PublishJobData {
  entryId: string;
  typeSlug: string;
}

@Processor(QUEUE_NAMES.PUBLISH)
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<PublishJobData>): Promise<void> {
    const { entryId } = job.data;
    this.logger.log(`Scheduled publish triggered for entry ${entryId}`);
    try {
      await this.prisma.contentEntry.update({
        where: { id: entryId },
        data: { status: 'PUBLISHED', publishedAt: new Date(), scheduledAt: null },
      });
      this.logger.log(`Entry ${entryId} published via schedule`);
    } catch (err: unknown) {
      this.logger.error(`Failed to publish scheduled entry ${entryId}`, err);
      throw err;
    }
  }
}
