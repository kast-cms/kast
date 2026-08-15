import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Arbitrary, stable key for the advisory lock serialising this sweep.
 * Any other advisory lock in this database must use a different key
 * (see SETUP_ADVISORY_LOCK_KEY in auth.repository.ts).
 */
const RECONCILE_ADVISORY_LOCK_KEY = 4922422n;

@Injectable()
export class PublishReconciliationService {
  private readonly logger = new Logger(PublishReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Redis delayed jobs are an acceleration path, not the source of truth.
   * This sweep makes due schedules recover after Redis loss, worker downtime,
   * or a queue/database partial failure.
   *
   * `@Cron` fires on every replica, so the body runs behind a transaction-scoped
   * advisory lock: one instance sweeps and the rest skip the tick. The per-row
   * update is conditional and would stay correct without it, but N replicas
   * would each scan the table every minute and each report the same rows as
   * their own work.
   */
  @Cron('*/1 * * * *')
  publishDueEntries(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.acquireLock(tx))) return 0;
      return this.publishDue(tx, new Date());
    });
  }

  /**
   * `pg_try_advisory_xact_lock` rather than the blocking form: a replica that
   * loses the race should drop this tick, not queue up behind the winner and
   * re-run the sweep a moment later. Transaction-scoped so it is released on
   * commit or rollback — Prisma pools connections, and a session-scoped lock
   * could be unlocked on a different connection than took it.
   */
  private async acquireLock(tx: Prisma.TransactionClient): Promise<boolean> {
    const rows = await tx.$queryRaw<
      Array<{ locked: boolean }>
    >`SELECT pg_try_advisory_xact_lock(${RECONCILE_ADVISORY_LOCK_KEY}) AS locked`;
    return rows[0]?.locked === true;
  }

  private async publishDue(tx: Prisma.TransactionClient, now: Date): Promise<number> {
    const due = await tx.contentEntry.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now }, trashedAt: null },
      select: { id: true },
      take: 500,
    });

    let published = 0;
    for (const { id } of due) {
      const result = await tx.contentEntry.updateMany({
        where: { id, status: 'SCHEDULED', scheduledAt: { lte: now }, trashedAt: null },
        data: { status: 'PUBLISHED', publishedAt: now, scheduledAt: null },
      });
      published += result.count;
    }
    if (published > 0) this.logger.log(`Reconciled ${published} due scheduled entries`);
    return published;
  }
}
