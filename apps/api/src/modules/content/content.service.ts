import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../common/types/auth.types';
import { ContentTypesService } from '../content-types/content-types.service';
import { ContentRepository, EntryWithLocale } from './content.repository';
import type { CreateContentEntryDto, UpdateContentEntryDto } from './dto/content-entry.dto';
import type { ContentQueryDto } from './dto/content-query.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly repo: ContentRepository,
    private readonly contentTypesService: ContentTypesService,
  ) {}

  async findAll(
    typeSlug: string,
    query: ContentQueryDto,
  ): Promise<PaginatedResult<EntryWithLocale>> {
    const ct = await this.contentTypesService.findByName(typeSlug);
    const limit = query.limit ?? 20;
    const { items, total } = await this.repo.findAll(ct.id, query);
    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, limit) : items;
    const cursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
    return { data, meta: { total, limit, cursor, hasNextPage } };
  }

  async findOne(typeSlug: string, id: string, locale?: string): Promise<{ data: EntryWithLocale }> {
    await this.contentTypesService.findByName(typeSlug);
    const entry = locale
      ? await this.repo.findByIdWithFallback(id, locale)
      : await this.repo.findById(id);
    if (!entry) throw new NotFoundException(`Content entry ${id} not found`);
    return { data: entry };
  }

  async create(
    typeSlug: string,
    dto: CreateContentEntryDto,
    authorId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const ct = await this.contentTypesService.findByName(typeSlug);
    const locale = dto.locale;
    const slug = (dto.data['slug'] as string | undefined) ?? `${typeSlug}-${Date.now()}`;
    const extraLocaleCodes = ct.isLocalized ? await this.repo.findActiveLocaleCodes() : [];
    const entry = await this.repo.create(ct.id, dto.data, locale, authorId, slug, extraLocaleCodes);
    return { data: entry };
  }

  async update(
    typeSlug: string,
    id: string,
    dto: UpdateContentEntryDto,
    userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    await this.contentTypesService.findByName(typeSlug);
    const entry = await this.repo.findById(id);
    if (!entry) throw new NotFoundException(`Content entry ${id} not found`);

    if (dto.data) {
      const locale = entry.locales[0]?.localeCode ?? 'en';
      await this.repo.createVersion(
        id,
        (entry.locales[0]?.data ?? {}) as Record<string, unknown>,
        {},
        userId,
        entry.status,
      );
      await this.repo.update(id, locale, dto.data);
    }

    if (dto.status) await this.repo.updateStatus(id, dto.status);

    const updated = await this.repo.findById(id);
    if (!updated) throw new NotFoundException(`Content entry ${id} not found`);
    return { data: updated };
  }

  async trash(typeSlug: string, id: string): Promise<void> {
    await this.contentTypesService.findByName(typeSlug);
    const entry = await this.repo.findById(id);
    if (!entry) throw new NotFoundException(`Content entry ${id} not found`);
    await this.repo.trash(id);
  }

  async publish(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    await this.contentTypesService.findByName(typeSlug);
    const entry = await this.repo.findById(id);
    if (!entry) throw new NotFoundException(`Content entry ${id} not found`);
    await this.repo.updateStatus(id, 'PUBLISHED', new Date());
    const updated = await this.repo.findById(id);
    if (!updated) throw new NotFoundException(`Content entry ${id} not found`);
    return { data: updated };
  }
}
