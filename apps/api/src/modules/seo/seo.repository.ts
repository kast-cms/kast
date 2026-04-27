import { Injectable } from '@nestjs/common';
import type { Redirect, SeoIssue, SeoMeta, SeoScore } from '@prisma/client';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import type { PaginatedResult } from '../../common/types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateRedirectDto, UpdateRedirectDto } from './dto/redirect.dto';
import type { UpsertSeoMetaDto } from './dto/seo-meta.dto';

export interface SeoIssueInput {
  type: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  penalty: number;
}

export type SeoScoreWithIssues = SeoScore & { issues: SeoIssue[] };
export type SeoMetaFull = SeoMeta & { scores: SeoScoreWithIssues[] };

@Injectable()
export class SeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMeta(entryId: string, data: UpsertSeoMetaDto): Promise<SeoMeta> {
    return this.prisma.seoMeta.upsert({
      where: { entryId },
      create: { entryId, ...data },
      update: data,
    });
  }

  async findMeta(entryId: string): Promise<SeoMetaFull | null> {
    return this.prisma.seoMeta.findUnique({
      where: { entryId },
      include: {
        scores: {
          include: { issues: true },
          orderBy: { validatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findLatestScore(entryId: string): Promise<SeoScoreWithIssues | null> {
    const meta = await this.prisma.seoMeta.findUnique({ where: { entryId } });
    if (!meta) return null;
    return this.prisma.seoScore.findFirst({
      where: { seoMetaId: meta.id },
      include: { issues: true },
      orderBy: { validatedAt: 'desc' },
    });
  }

  async saveScore(
    seoMetaId: string,
    score: number,
    issues: SeoIssueInput[],
  ): Promise<SeoScoreWithIssues> {
    return this.prisma.seoScore.create({
      data: { seoMetaId, score, issues: { create: issues } },
      include: { issues: true },
    });
  }

  async findAllRedirects(query: PaginationDto): Promise<PaginatedResult<Redirect>> {
    const limit = query.limit ?? 20;
    const take = limit + 1;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.redirect.findMany({
        take,
        ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
        orderBy: { createdAt: query.order ?? 'desc' },
      }),
      this.prisma.redirect.count(),
    ]);
    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, limit) : items;
    const cursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
    return { data, meta: { total, limit, cursor, hasNextPage } };
  }

  async createRedirect(data: CreateRedirectDto, userId: string): Promise<Redirect> {
    return this.prisma.redirect.create({ data: { ...data, createdById: userId } });
  }

  async updateRedirect(id: string, data: UpdateRedirectDto): Promise<Redirect> {
    return this.prisma.redirect.update({ where: { id }, data });
  }

  async deleteRedirect(id: string): Promise<void> {
    await this.prisma.redirect.delete({ where: { id } });
  }

  async findRedirectById(id: string): Promise<Redirect | null> {
    return this.prisma.redirect.findUnique({ where: { id } });
  }

  async findPublishedWithCanonical(): Promise<Array<{ canonicalUrl: string; updatedAt: Date }>> {
    const rows = await this.prisma.seoMeta.findMany({
      where: {
        canonicalUrl: { not: null },
        entry: { status: 'PUBLISHED', trashedAt: null },
      },
      select: { canonicalUrl: true, updatedAt: true },
    });
    return rows.filter(
      (r): r is { canonicalUrl: string; updatedAt: Date } => r.canonicalUrl !== null,
    );
  }
}
