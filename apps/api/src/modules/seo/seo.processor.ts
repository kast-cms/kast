import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { SeoService } from './seo.service';

export interface SeoJobData {
  entryId: string;
}

@Processor(QUEUE_NAMES.SEO)
export class SeoProcessor extends WorkerHost {
  private readonly logger = new Logger(SeoProcessor.name);

  constructor(private readonly seoService: SeoService) {
    super();
  }

  async process(job: Job<SeoJobData>): Promise<void> {
    const { entryId } = job.data;
    this.logger.log(`Processing SEO job for entry ${entryId}`);
    try {
      const result = await this.seoService.validateNow(entryId);
      this.logger.log(`SEO score for entry ${entryId}: ${result.score}`);
    } catch (err: unknown) {
      this.logger.error(`SEO validation failed for entry ${entryId}`, err);
      throw err;
    }
  }
}
