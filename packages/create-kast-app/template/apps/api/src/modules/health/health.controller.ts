import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  PrismaHealthIndicator,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import { Public } from '../../common/decorators/public.decorator';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { redisCommands } from '../queue/redis-commands';
import { SettingsService } from '../settings/settings.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.PUBLISH) private readonly redisProbeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOK) private readonly webhookQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MEDIA) private readonly mediaQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SEO) private readonly seoQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TRASH) private readonly trashQueue: Queue,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env>,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.checkRedis(),
    ]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check including storage and background workers' })
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.checkRedis(),
      () => this.checkStorage(),
      () => this.checkWorkers(),
    ]);
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const client = await redisCommands(this.redisProbeQueue);
    await client.ping();
    return { redis: { status: 'up' } };
  }

  private async checkStorage(): Promise<HealthIndicatorResult> {
    const result = await this.settings.testStorage();
    if (!result.checks.delete) throw new Error('Storage probe could not remove its test object');
    return { storage: { status: 'up', provider: result.provider } };
  }

  private async checkWorkers(): Promise<HealthIndicatorResult> {
    const queues = [
      [QUEUE_NAMES.WEBHOOK, this.webhookQueue],
      [QUEUE_NAMES.MEDIA, this.mediaQueue],
      [QUEUE_NAMES.SEO, this.seoQueue],
      [QUEUE_NAMES.PUBLISH, this.redisProbeQueue],
      [QUEUE_NAMES.EMAIL, this.emailQueue],
      [QUEUE_NAMES.TRASH, this.trashQueue],
    ] as const;
    const state = Object.fromEntries(
      await Promise.all(
        queues.map(async ([name, queue]) => {
          const [workers, counts] = await Promise.all([
            queue.getWorkers(),
            queue.getJobCounts('waiting', 'active', 'failed'),
          ]);
          return [
            name,
            {
              workers: workers.length,
              waiting: counts.waiting ?? 0,
              active: counts.active ?? 0,
              failed: counts.failed ?? 0,
            },
          ] as const;
        }),
      ),
    );
    const missing = Object.entries(state)
      .filter(([, value]) => value.workers === 0)
      .map(([name]) => name);
    if (missing.length > 0) throw new Error(`No workers registered for: ${missing.join(', ')}`);
    const backlogLimit = this.config.get('QUEUE_BACKLOG_ALERT_THRESHOLD', { infer: true }) ?? 1000;
    const failedLimit = this.config.get('QUEUE_FAILED_ALERT_THRESHOLD', { infer: true }) ?? 100;
    const overloaded = Object.entries(state)
      .filter(([, value]) => value.waiting >= backlogLimit || value.failed >= failedLimit)
      .map(([name]) => name);
    if (overloaded.length > 0) {
      throw new Error(`Queue alert threshold exceeded: ${overloaded.join(', ')}`);
    }
    return { workers: { status: 'up', queues: state } };
  }
}
