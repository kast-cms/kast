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
      // Only a still-scheduled, untrashed entry may go live. The job was
      // queued in the past: since then the entry may have been trashed, or its
      // schedule cancelled, and an unconditional update would publish it
      // anyway. Payload validity was enforced when the schedule was created.
      const { count } = await this.prisma.contentEntry.updateMany({
        where: { id: entryId, status: 'SCHEDULED', trashedAt: null },
        data: { status: 'PUBLISHED', publishedAt: new Date(), scheduledAt: null },
      });

      if (count === 0) {
        this.logger.warn(
          `Entry ${entryId} was not published: it is no longer scheduled or has been trashed`,
        );
        return;
      }
      this.logger.log(`Entry ${entryId} published via schedule`);
    } catch (err: unknown) {
      this.logger.error(`Failed to publish scheduled entry ${entryId}`, err);
      throw err;
    }
  }
}
