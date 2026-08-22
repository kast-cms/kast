import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Header } from '@nestjs/common';
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

  @Get('metrics')
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus metrics' })
  async metrics(): Promise<string> {
    const [users, contentEntries, mediaFiles, queueMetrics] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.contentEntry.count(),
      this.prisma.mediaFile.count({ where: { trashedAt: null } }),
      this.collectQueueMetrics(),
    ]);
    return [
      '# HELP kast_users_total Total users in the instance.',
      '# TYPE kast_users_total gauge',
      `kast_users_total ${users}`,
      '# HELP kast_content_entries_total Total content entries in the instance.',
      '# TYPE kast_content_entries_total gauge',
      `kast_content_entries_total ${contentEntries}`,
      '# HELP kast_media_files_total Total non-deleted media files in the instance.',
      '# TYPE kast_media_files_total gauge',
      `kast_media_files_total ${mediaFiles}`,
      ...queueMetrics,
      '',
    ].join('\n');
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

  private async collectQueueMetrics(): Promise<string[]> {
    const queues = [
      [QUEUE_NAMES.WEBHOOK, this.webhookQueue],
      [QUEUE_NAMES.MEDIA, this.mediaQueue],
      [QUEUE_NAMES.SEO, this.seoQueue],
      [QUEUE_NAMES.PUBLISH, this.redisProbeQueue],
      [QUEUE_NAMES.EMAIL, this.emailQueue],
      [QUEUE_NAMES.TRASH, this.trashQueue],
    ] as const;
    const lines = [
      '# HELP kast_queue_jobs Number of BullMQ jobs by queue and state.',
      '# TYPE kast_queue_jobs gauge',
    ];
    const snapshots = await Promise.all(
      queues.map(async ([name, queue]) => {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'failed',
          'completed',
          'delayed',
        );
        return [name, counts] as const;
      }),
    );
    for (const [name, counts] of snapshots) {
      for (const state of ['waiting', 'active', 'failed', 'completed', 'delayed'] as const) {
        lines.push(`kast_queue_jobs{queue="${name}",state="${state}"} ${counts[state] ?? 0}`);
      }
    }
    return lines;
  }
}
