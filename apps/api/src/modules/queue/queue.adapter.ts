import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job, JobsOptions, Queue } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from './queue.constants';
import { redisCommands } from './redis-commands';

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
  ) {
    this.map = {
      [QUEUE_NAMES.WEBHOOK]: webhookQueue,
      [QUEUE_NAMES.MEDIA]: mediaQueue,
      [QUEUE_NAMES.SEO]: seoQueue,
      [QUEUE_NAMES.PUBLISH]: publishQueue,
      [QUEUE_NAMES.TRASH]: trashQueue,
      [QUEUE_NAMES.EMAIL]: emailQueue,
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

  /** Stores short-lived coordination state in the same shared Redis as BullMQ. */
  async setEphemeral(key: string, value: string, ttlMs: number): Promise<void> {
    const redis = await redisCommands(this.map[QUEUE_NAMES.WEBHOOK]);
    await redis.set(`kast:ephemeral:${key}`, value, 'PX', ttlMs);
  }

  /**
   * Atomically reads and deletes short-lived state. Lua keeps this compatible
   * with Redis versions that predate GETDEL while preserving single-use
   * semantics across every API replica.
   */
  async consumeEphemeral(key: string): Promise<string | null> {
    const redis = await redisCommands(this.map[QUEUE_NAMES.WEBHOOK]);
    const result = await redis.eval(
      "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
      1,
      `kast:ephemeral:${key}`,
    );
    return typeof result === 'string' ? result : null;
  }

  async retryFailed(
    queue: QueueName,
    limit: number,
  ): Promise<{
    inspected: number;
    retried: number;
    errors: string[];
  }> {
    const jobs = await this.map[queue].getFailed(0, Math.max(0, limit - 1));
    const errors: string[] = [];
    let retried = 0;
    for (const job of jobs) {
      try {
        await job.retry('failed');
        retried += 1;
      } catch (error: unknown) {
        errors.push(
          `${job.id ?? 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { inspected: jobs.length, retried, errors };
  }
}
