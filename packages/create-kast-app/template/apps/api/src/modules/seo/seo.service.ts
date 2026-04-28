import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Redirect, SeoMeta } from '@prisma/client';
import { Queue } from 'bullmq';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import type { PaginatedResult } from '../../common/types/auth.types';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { CreateRedirectDto, UpdateRedirectDto } from './dto/redirect.dto';
import type { UpsertSeoMetaDto } from './dto/seo-meta.dto';
import type { SeoJobData } from './seo.processor';
import { SeoRepository, type SeoMetaFull, type SeoScoreWithIssues } from './seo.repository';

@Injectable()
export class SeoService {
  constructor(
    private readonly repo: SeoRepository,
    @InjectQueue(QUEUE_NAMES.SEO) private readonly seoQueue: Queue<SeoJobData>,
  ) {}

  async upsertMeta(entryId: string, dto: UpsertSeoMetaDto): Promise<SeoMeta> {
    return this.repo.upsertMeta(entryId, dto);
  }

  async getMeta(entryId: string): Promise<SeoMetaFull> {
    const meta = await this.repo.findMeta(entryId);
    if (!meta) throw new NotFoundException(`No SEO meta for entry ${entryId}`);
    return meta;
  }

  async getScore(entryId: string): Promise<SeoScoreWithIssues> {
    const score = await this.repo.findLatestScore(entryId);
    if (!score) throw new NotFoundException(`No SEO score for entry ${entryId}`);
    return score;
  }

  async enqueueValidation(entryId: string): Promise<{ queued: boolean }> {
    await this.seoQueue.add('validate', { entryId }, { jobId: `seo-${entryId}` });
    return { queued: true };
  }

  async getSitemapEntries(): Promise<Array<{ canonicalUrl: string; updatedAt: Date }>> {
    return this.repo.findPublishedWithCanonical();
  }

  async listRedirects(query: PaginationDto): Promise<PaginatedResult<Redirect>> {
    return this.repo.findAllRedirects(query);
  }

  async createRedirect(dto: CreateRedirectDto, userId: string): Promise<Redirect> {
    return this.repo.createRedirect(dto, userId);
  }

  async updateRedirect(id: string, dto: UpdateRedirectDto): Promise<Redirect> {
    const existing = await this.repo.findRedirectById(id);
    if (!existing) throw new NotFoundException(`Redirect ${id} not found`);
    return this.repo.updateRedirect(id, dto);
  }

  async deleteRedirect(id: string): Promise<void> {
    const existing = await this.repo.findRedirectById(id);
    if (!existing) throw new NotFoundException(`Redirect ${id} not found`);
    await this.repo.deleteRedirect(id);
  }
}
