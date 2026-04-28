import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

/* ── Stat interfaces ─────────────────────────────────────────── */

interface ContentByStatus {
  draft: number;
  published: number;
  scheduled: number;
  archived: number;
}

interface ContentStats {
  total: number;
  byStatus: ContentByStatus;
  byType: Array<{ typeSlug: string; count: number }>;
}

interface MediaByMimeGroup {
  image: number;
  video: number;
  document: number;
  other: number;
}

interface MediaStats {
  total: number;
  totalSizeMb: number;
  byMimeGroup: MediaByMimeGroup;
}

interface SeoScoreDistribution {
  below50: number;
  between50and74: number;
  above74: number;
}

interface SeoStats {
  averageScore: number;
  scoreDistribution: SeoScoreDistribution;
}

interface FormStats {
  total: number;
  submissionsToday: number;
  submissionsThisWeek: number;
}

interface UserStats {
  total: number;
  active: number;
  invited: number;
}

export interface DashboardStats {
  contentEntries: ContentStats;
  media: MediaStats;
  seo: SeoStats;
  forms: FormStats;
  users: UserStats;
}

export interface ActivityUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ActivityEntry {
  id: string;
  userId: string | null;
  user: ActivityUser | null;
  agentName: string | null;
  ipAddress: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  isDryRun: boolean;
  createdAt: Date;
}

export interface QueueHealthEntry {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/* ── Helpers ─────────────────────────────────────────────────── */

function isDocMime(mimeType: string): boolean {
  return ['application/pdf', 'application/msword', 'application/vnd.', 'text/'].some((p) =>
    mimeType.startsWith(p),
  );
}

function startOfDay(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ── Service ─────────────────────────────────────────────────── */

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.WEBHOOK) private readonly webhookQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MEDIA) private readonly mediaQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SEO) private readonly seoQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUBLISH) private readonly publishQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AUDIT) private readonly auditQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TRASH) private readonly trashQueue: Queue,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [contentEntries, media, seo, forms, users] = await Promise.all([
      this.getContentStats(),
      this.getMediaStats(),
      this.getSeoStats(),
      this.getFormStats(),
      this.getUserStats(),
    ]);
    return { contentEntries, media, seo, forms, users };
  }

  private async getContentStats(): Promise<ContentStats> {
    const [total, byStatusRaw, byTypeRaw] = await Promise.all([
      this.prisma.contentEntry.count(),
      this.prisma.contentEntry.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contentEntry.groupBy({ by: ['contentTypeId'], _count: { _all: true } }),
    ]);

    const countFor = (s: string): number =>
      byStatusRaw.find((r) => r.status === s)?._count._all ?? 0;

    const typeIds = byTypeRaw.map((r) => r.contentTypeId);
    const types = await this.prisma.contentType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true },
    });
    const typeMap = new Map(types.map((t) => [t.id, t.name]));

    return {
      total,
      byStatus: {
        draft: countFor('DRAFT'),
        published: countFor('PUBLISHED'),
        scheduled: countFor('SCHEDULED'),
        archived: countFor('ARCHIVED'),
      },
      byType: byTypeRaw.map((r) => ({
        typeSlug: typeMap.get(r.contentTypeId) ?? r.contentTypeId,
        count: r._count._all,
      })),
    };
  }

  private async getMediaStats(): Promise<MediaStats> {
    const [agg, byMimeRaw] = await Promise.all([
      this.prisma.mediaFile.aggregate({ _count: { _all: true }, _sum: { size: true } }),
      this.prisma.mediaFile.groupBy({ by: ['mimeType'], _count: { _all: true } }),
    ]);

    const sumGroup = (prefix: string): number =>
      byMimeRaw.filter((r) => r.mimeType.startsWith(prefix)).reduce((s, r) => s + r._count._all, 0);

    const docCount = byMimeRaw
      .filter((r) => isDocMime(r.mimeType))
      .reduce((s, r) => s + r._count._all, 0);

    const otherCount = byMimeRaw
      .filter(
        (r) =>
          !r.mimeType.startsWith('image/') &&
          !r.mimeType.startsWith('video/') &&
          !isDocMime(r.mimeType),
      )
      .reduce((s, r) => s + r._count._all, 0);

    return {
      total: agg._count._all,
      totalSizeMb: Math.round(((agg._sum.size ?? 0) / 1024 / 1024) * 10) / 10,
      byMimeGroup: {
        image: sumGroup('image/'),
        video: sumGroup('video/'),
        document: docCount,
        other: otherCount,
      },
    };
  }

  private async getSeoStats(): Promise<SeoStats> {
    const scores = await this.prisma.seoScore.findMany({ select: { score: true } });
    const n = scores.length;
    const avg = n === 0 ? 0 : Math.round(scores.reduce((s, r) => s + r.score, 0) / n);
    return {
      averageScore: avg,
      scoreDistribution: {
        below50: scores.filter((r) => r.score < 50).length,
        between50and74: scores.filter((r) => r.score >= 50 && r.score <= 74).length,
        above74: scores.filter((r) => r.score > 74).length,
      },
    };
  }

  private async getFormStats(): Promise<FormStats> {
    const [total, submissionsToday, submissionsThisWeek] = await Promise.all([
      this.prisma.formSubmission.count(),
      this.prisma.formSubmission.count({ where: { createdAt: { gte: startOfDay() } } }),
      this.prisma.formSubmission.count({ where: { createdAt: { gte: startOfWeek() } } }),
    ]);
    return { total, submissionsToday, submissionsThisWeek };
  }

  private async getUserStats(): Promise<UserStats> {
    const [total, active, invited] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false, isVerified: false } }),
    ]);
    return { total, active, invited };
  }

  async getActivity(): Promise<ActivityEntry[]> {
    return this.prisma.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async getQueueHealth(): Promise<QueueHealthEntry[]> {
    const queues = [
      { name: QUEUE_NAMES.WEBHOOK, queue: this.webhookQueue },
      { name: QUEUE_NAMES.MEDIA, queue: this.mediaQueue },
      { name: QUEUE_NAMES.SEO, queue: this.seoQueue },
      { name: QUEUE_NAMES.PUBLISH, queue: this.publishQueue },
      { name: QUEUE_NAMES.AUDIT, queue: this.auditQueue },
      { name: QUEUE_NAMES.EMAIL, queue: this.emailQueue },
      { name: QUEUE_NAMES.TRASH, queue: this.trashQueue },
    ];

    return Promise.all(
      queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        );
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
        };
      }),
    );
  }
}
