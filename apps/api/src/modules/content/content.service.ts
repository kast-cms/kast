import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import type { PaginatedResult } from '../../common/types/auth.types';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import { ContentTypesService } from '../content-types/content-types.service';
import type { PublishJobData } from '../publish/publish.processor';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { SeoService } from '../seo/seo.service';
import { assertApplied, localeData, snapshotLocales, writeLocale } from './content-entry.helpers';
import { revertEntryToVersion } from './content-revert.ops';
import { ContentRepository, EntryWithLocale, VersionWithAuthor } from './content.repository';
import type {
  AddLocaleDto,
  CreateContentEntryDto,
  PublishContentDto,
  SchedulePublishDto,
  UpdateContentEntryDto,
} from './dto/content-entry.dto';
import type { ContentQueryDto } from './dto/content-query.dto';
import type { ValidationResult } from './validation/content-validation.types';
import { ContentWriteGate } from './validation/content-write.gate';
import { PUBLIC_STATUSES, resolveValidationMode } from './validation/validation-mode';

@Injectable()
export class ContentService {
  constructor(
    private readonly repo: ContentRepository,
    private readonly contentTypesService: ContentTypesService,
    private readonly seoService: SeoService,
    @InjectQueue(QUEUE_NAMES.PUBLISH) private readonly publishQueue: Queue<PublishJobData>,
    private readonly eventEmitter: EventEmitter2,
    private readonly gate: ContentWriteGate,
  ) {}

  /** Builds a { localeCode: { slug, data } } snapshot for version history. */
  /**
   * Resolves the route content type and the entry together. The entry is loaded by
   * ID *and* content type, so an ID from another type is a 404 rather than a hit.
   */
  private async requireEntry(
    typeSlug: string,
    id: string,
    locale?: string,
  ): Promise<{ ct: ContentTypeWithFields; entry: EntryWithLocale }> {
    const ct = await this.contentTypesService.findByName(typeSlug);
    const entry = locale
      ? await this.repo.findByIdWithFallbackForType(id, ct.id, locale)
      : await this.repo.findByIdForType(id, ct.id);
    if (!entry) throw new NotFoundException(`Content entry ${id} not found`);
    return { ct, entry };
  }

  private async reload(contentTypeId: string, id: string): Promise<EntryWithLocale> {
    const updated = await this.repo.findByIdForType(id, contentTypeId);
    if (!updated) throw new NotFoundException(`Content entry ${id} not found`);
    return updated;
  }

  /**
   * The single gate an update payload has to clear. Shared with the MCP dry run so
   * that a dry run cannot report success for a write the real path rejects.
   */
  private validateUpdate(
    ct: ContentTypeWithFields,
    entry: EntryWithLocale,
    dto: UpdateContentEntryDto,
    data: Record<string, unknown>,
  ): Promise<ValidationResult> {
    const locale = writeLocale(entry, dto.locale);
    return this.gate.validatePayload(ct, data, {
      mode: resolveValidationMode(entry.status, dto.status),
      localeCode: locale,
      previousData: localeData(entry, locale),
    });
  }

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
    const { entry } = await this.requireEntry(typeSlug, id, locale);
    return { data: entry };
  }

  async create(
    typeSlug: string,
    dto: CreateContentEntryDto,
    authorId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const ct = await this.contentTypesService.findByName(typeSlug);
    const locale = dto.locale;
    const result = await this.gate.validatePayload(ct, dto.data, {
      mode: 'draft',
      localeCode: locale,
      applyDefaults: true,
    });

    const slugValue = result.data['slug'];
    const slug =
      typeof slugValue === 'string' && slugValue !== '' ? slugValue : `${typeSlug}-${Date.now()}`;
    const extraLocaleCodes = ct.isLocalized ? await this.repo.findActiveLocaleCodes() : [];
    const entry = await this.repo.create(
      ct.id,
      result.data,
      locale,
      authorId,
      slug,
      extraLocaleCodes,
      result.uniqueChecks,
    );
    this.eventEmitter.emit('content.created', {
      entryId: entry.id,
      typeSlug,
      locale,
      status: entry.status,
    });
    return { data: entry };
  }

  async update(
    typeSlug: string,
    id: string,
    dto: UpdateContentEntryDto,
    userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireEntry(typeSlug, id);
    const locale = writeLocale(entry, dto.locale);
    // The status the entry ends up in, not just the one being asked for: a data-only
    // write to live or scheduled content has to clear the same bar as publishing it.
    const goesPublic = PUBLIC_STATUSES.has(dto.status ?? entry.status);

    if (dto.data) {
      const result = await this.validateUpdate(ct, entry, dto, dto.data);
      // Snapshot the full multi-locale state so reverts restore every locale.
      await this.repo.createVersion(
        id,
        localeData(entry, locale),
        snapshotLocales(entry),
        userId,
        entry.status,
      );
      await this.repo.update(id, ct.id, locale, result.data, result.uniqueChecks);
    } else if (dto.status !== undefined && goesPublic) {
      // A status-only transition must not be able to publish data that never passed.
      await this.gate.assertStoredPublishable(ct, entry);
    }

    if (dto.status) assertApplied(await this.repo.updateStatus(id, ct.id, dto.status), id);

    const updated = await this.reload(ct.id, id);
    this.eventEmitter.emit('content.updated', { entryId: id, typeSlug, status: updated.status });
    return { data: updated };
  }

  /**
   * Runs `update`'s gate against the stored entry without writing anything, for
   * MCP dry runs. It resolves to the payload the write would persist and throws
   * whatever the write would throw.
   */
  async validateUpdateWithoutWriting(
    typeSlug: string,
    id: string,
    dto: UpdateContentEntryDto,
  ): Promise<Record<string, unknown>> {
    const { ct, entry } = await this.requireEntry(typeSlug, id);
    const result = await this.validateUpdate(ct, entry, dto, dto.data ?? {});
    return result.data;
  }

  async trash(typeSlug: string, id: string): Promise<void> {
    const { ct } = await this.requireEntry(typeSlug, id);
    assertApplied(await this.repo.trash(id, ct.id), id);
    this.eventEmitter.emit('content.trashed', { entryId: id, typeSlug });
  }

  async publish(
    typeSlug: string,
    id: string,
    dto?: PublishContentDto,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireEntry(typeSlug, id);

    await this.gate.assertStoredPublishable(ct, entry);

    // SEO gate: ERROR-severity issues always block; WARNING-severity issues
    // block unless `force: true` is passed (API spec §4).
    const validation = await this.seoService.validateNow(id);
    if (validation.errors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Publish blocked by SEO errors',
        code: 'SEO_VALIDATION_FAILED',
        issues: validation.errors,
        score: validation.score,
      });
    }
    if (validation.warnings.length > 0 && dto?.force !== true) {
      throw new UnprocessableEntityException({
        message: 'Publish blocked by SEO warnings. Pass force: true to override.',
        code: 'SEO_VALIDATION_WARNINGS',
        issues: validation.warnings,
        score: validation.score,
      });
    }

    assertApplied(await this.repo.updateStatus(id, ct.id, 'PUBLISHED', new Date()), id);
    const updated = await this.reload(ct.id, id);
    this.eventEmitter.emit('content.published', { entryId: id, typeSlug, status: 'PUBLISHED' });
    return { data: updated };
  }

  async addLocale(
    typeSlug: string,
    id: string,
    dto: AddLocaleDto,
    _userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireEntry(typeSlug, id);

    if (entry.locales.some((l) => l.localeCode === dto.locale)) {
      throw new ConflictException(`Entry already has locale "${dto.locale}"`);
    }

    // Optionally seed from another locale, then apply the supplied data on top.
    let seed: Record<string, unknown> = {};
    if (dto.copyFromLocale) {
      const source = entry.locales.find((l) => l.localeCode === dto.copyFromLocale);
      if (!source) {
        throw new BadRequestException(`Source locale "${dto.copyFromLocale}" not found on entry`);
      }
      seed = source.data as Record<string, unknown>;
    }
    // A new locale on a live entry is published the moment it is written, so it
    // faces publish rules: the mode comes from the entry, which is the only status
    // this route can end up in.
    const result = await this.gate.validatePayload(
      ct,
      { ...seed, ...dto.data },
      {
        mode: resolveValidationMode(entry.status),
        localeCode: dto.locale,
        applyDefaults: true,
        previousData: seed,
      },
    );

    await this.repo.addLocale(id, ct.id, dto.locale, dto.slug, result.data, result.uniqueChecks);
    const updated = await this.reload(ct.id, id);
    this.eventEmitter.emit('content.updated', { entryId: id, typeSlug, status: updated.status });
    return { data: updated };
  }

  async unpublish(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireEntry(typeSlug, id);
    assertApplied(await this.repo.updateStatus(id, ct.id, 'DRAFT'), id);
    const updated = await this.reload(ct.id, id);
    this.eventEmitter.emit('content.unpublished', { entryId: id, typeSlug, status: 'DRAFT' });
    return { data: updated };
  }

  async archive(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireEntry(typeSlug, id);
    assertApplied(await this.repo.updateStatus(id, ct.id, 'ARCHIVED'), id);
    return { data: await this.reload(ct.id, id) };
  }

  async restore(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireEntry(typeSlug, id);
    assertApplied(await this.repo.updateStatus(id, ct.id, 'DRAFT'), id);
    return { data: await this.reload(ct.id, id) };
  }

  async schedulePublish(
    typeSlug: string,
    id: string,
    dto: SchedulePublishDto,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireEntry(typeSlug, id);
    const publishAt = new Date(dto.publishAt);
    if (publishAt <= new Date()) {
      throw new BadRequestException('publishAt must be in the future');
    }
    // The scheduled-publish worker flips the status directly, so the schema gate has
    // to run here rather than at fire time.
    await this.gate.assertStoredPublishable(ct, entry);
    const delay = publishAt.getTime() - Date.now();
    await this.publishQueue.add(
      'publish',
      { entryId: id, typeSlug },
      { delay, jobId: `publish-${id}` },
    );
    assertApplied(await this.repo.updateSchedule(id, ct.id, publishAt, 'SCHEDULED'), id);
    return { data: await this.reload(ct.id, id) };
  }

  async cancelSchedule(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireEntry(typeSlug, id);
    const job = await this.publishQueue.getJob(`publish-${id}`);
    await job?.remove();
    assertApplied(await this.repo.updateSchedule(id, ct.id, null, 'DRAFT'), id);
    return { data: await this.reload(ct.id, id) };
  }

  async listVersions(
    typeSlug: string,
    id: string,
    limit: number,
    cursor?: string,
  ): Promise<PaginatedResult<VersionWithAuthor>> {
    await this.requireEntry(typeSlug, id);
    const { items, total } = await this.repo.listVersions(id, limit, cursor);
    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
    return { data, meta: { total, limit, cursor: nextCursor, hasNextPage } };
  }

  async getVersion(
    typeSlug: string,
    id: string,
    versionId: string,
  ): Promise<{ data: VersionWithAuthor }> {
    const { ct } = await this.requireEntry(typeSlug, id);
    const version = await this.repo.findVersionByIdForType(id, ct.id, versionId);
    if (!version) throw new NotFoundException(`Version ${versionId} not found`);
    return { data: version };
  }

  async revertToVersion(
    typeSlug: string,
    id: string,
    versionId: string,
    userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireEntry(typeSlug, id);
    const data = await revertEntryToVersion(this.repo, this.gate, ct, entry, versionId, userId);
    return { data };
  }
}
