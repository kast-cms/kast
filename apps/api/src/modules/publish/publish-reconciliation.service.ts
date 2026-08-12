import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PublishReconciliationService {
  private readonly logger = new Logger(PublishReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Redis delayed jobs are an acceleration path, not the source of truth.
   * This sweep makes due schedules recover after Redis loss, worker downtime,
   * or a queue/database partial failure.
   */
  @Cron('*/1 * * * *')
  async publishDueEntries(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.contentEntry.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now }, trashedAt: null },
      select: { id: true },
      take: 500,
    });

    let published = 0;
    for (const { id } of due) {
      const result = await this.prisma.contentEntry.updateMany({
        where: { id, status: 'SCHEDULED', scheduledAt: { lte: now }, trashedAt: null },
        data: { status: 'PUBLISHED', publishedAt: now, scheduledAt: null },
      });
      published += result.count;
    }
    if (published > 0) this.logger.log(`Reconciled ${published} due scheduled entries`);
    return published;
  }
}
