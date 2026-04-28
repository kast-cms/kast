import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import {
  checkBody,
  checkCanonical,
  checkDescription,
  checkOgImage,
  checkSlug,
  checkTitle,
  computeScore,
} from './seo-checks';
import { SeoRepository, type SeoIssueInput } from './seo.repository';

export interface SeoJobData {
  entryId: string;
}

@Processor(QUEUE_NAMES.SEO)
export class SeoProcessor extends WorkerHost {
  private readonly logger = new Logger(SeoProcessor.name);

  constructor(
    private readonly repo: SeoRepository,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SeoJobData>): Promise<void> {
    const { entryId } = job.data;
    this.logger.log(`Processing SEO job for entry ${entryId}`);
    try {
      await this.runValidation(entryId);
    } catch (err: unknown) {
      this.logger.error(`SEO validation failed for entry ${entryId}`, err);
      throw err;
    }
  }

  private async runValidation(entryId: string): Promise<void> {
    const [meta, entry] = await Promise.all([
      this.repo.findMeta(entryId),
      this.prisma.contentEntry.findUnique({
        where: { id: entryId },
        include: { locales: { take: 1 } },
      }),
    ]);

    if (!meta) {
      this.logger.warn(`No SeoMeta found for entry ${entryId}; skipping`);
      return;
    }

    const locale = entry?.locales[0];
    const bodyData = locale?.data ?? null;
    const slug = locale?.slug;

    const issues: SeoIssueInput[] = [
      ...checkTitle(meta.metaTitle),
      ...checkDescription(meta.metaDescription),
      ...checkOgImage(meta.ogImageId),
      ...checkCanonical(meta.canonicalUrl),
      ...checkSlug(slug),
      ...checkBody(bodyData),
    ];

    const score = computeScore(issues);
    await this.repo.saveScore(meta.id, score, issues);
    this.logger.log(`SEO score for entry ${entryId}: ${score}`);
  }
}
