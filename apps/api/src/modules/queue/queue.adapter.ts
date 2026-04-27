import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job, JobsOptions, Queue } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from './queue.constants';

@Injectable()
export class QueueAdapter {
  private readonly map: Record<QueueName, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.WEBHOOK) webhookQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MEDIA) mediaQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SEO) seoQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUBLISH) publishQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TRASH) trashQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AUDIT) auditQueue: Queue,
  ) {
    this.map = {
      [QUEUE_NAMES.WEBHOOK]: webhookQueue,
      [QUEUE_NAMES.MEDIA]: mediaQueue,
      [QUEUE_NAMES.SEO]: seoQueue,
      [QUEUE_NAMES.PUBLISH]: publishQueue,
      [QUEUE_NAMES.TRASH]: trashQueue,
      [QUEUE_NAMES.EMAIL]: emailQueue,
      [QUEUE_NAMES.AUDIT]: auditQueue,
    };
  }

  async enqueue<T>(
    queue: QueueName,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    return this.map[queue].add(jobName, data, options) as Promise<Job<T>>;
  }
}
