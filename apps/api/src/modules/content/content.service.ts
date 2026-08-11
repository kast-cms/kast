import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import type { PaginatedResult } from '../../common/types/auth.types';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import { ContentTypesService } from '../content-types/content-types.service';
import type { PublishJobData } from '../publish/publish.processor';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { SeoService } from '../seo/seo.service';
import { runBulkEntryAction, type BulkEntryOutcome } from './content-bulk.ops';
import {
  assertApplied,
  assertNotTrashed,
  assertSeoPublishable,
  assertWritableStatus,
  localeData,
  paginate,
  snapshotLocales,
  writeLocale,
} from './content-entry.helpers';
import { addEntryLocale, assertActiveLocale } from './content-locale.ops';
import { revertEntryToVersion } from './content-revert.ops';
import { cancelEntrySchedule, scheduleEntryPublish } from './content-schedule.ops';
import { requireSlug, resolveEntrySlug } from './content-slug';
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

  /** The loader every mutation shares: `requireEntry` plus the trash guard. */
  private async requireWritableEntry(
    typeSlug: string,
    id: string,
    locale?: string,
  ): Promise<{ ct: ContentTypeWithFields; entry: EntryWithLocale }> {
    const loaded = await this.requireEntry(typeSlug, id, locale);
    assertNotTrashed(loaded.entry, id);
    return loaded;
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
    return paginate(items, total, limit);
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

    // The locale `slug` column is what URLs resolve against; it is derived from the
    // request and normalized. A `slug` *field* on the type, if there is one, stays
    // ordinary content and is stored exactly as it was validated.
    const slug = resolveEntrySlug(typeSlug, dto.slug, result.data);
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
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    assertWritableStatus(typeSlug, id, dto.status);
    const locale = writeLocale(entry, dto.locale);
    // A locale the entry does not have yet is created by this write, so it faces
    // the same check as POST :id/locale rather than being taken on trust.
    if (!entry.locales.some((l) => l.localeCode === locale)) {
      await assertActiveLocale(this.repo, locale);
    }
    const slug = dto.slug !== undefined ? requireSlug(dto.slug, 'slug') : undefined;
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
      await this.repo.update(id, ct.id, locale, result.data, result.uniqueChecks, slug);
    } else {
      if (dto.status !== undefined && goesPublic) {
        // A status-only transition must not be able to publish data that never passed.
        await this.gate.assertStoredPublishable(ct, entry);
      }
      if (slug !== undefined) {
        assertApplied(await this.repo.updateSlug(id, ct.id, locale, slug), id);
      }
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
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    const result = await this.validateUpdate(ct, entry, dto, dto.data ?? {});
    return result.data;
  }

  async trash(typeSlug: string, id: string, actorId?: string): Promise<void> {
    const { ct } = await this.requireEntry(typeSlug, id);
    assertApplied(await this.repo.trash(id, ct.id, actorId), id);
    this.eventEmitter.emit('content.trashed', { entryId: id, typeSlug });
  }

  async publish(
    typeSlug: string,
    id: string,
    dto?: PublishContentDto,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);

    await this.gate.assertStoredPublishable(ct, entry);
    assertSeoPublishable(await this.seoService.validateNow(id), dto?.force);

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
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    await addEntryLocale(this.repo, this.gate, ct, entry, dto);
    const updated = await this.reload(ct.id, id);
    this.eventEmitter.emit('content.updated', { entryId: id, typeSlug, status: updated.status });
    return { data: updated };
  }

  async unpublish(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    assertApplied(await this.repo.updateStatus(id, ct.id, 'DRAFT'), id);
    const updated = await this.reload(ct.id, id);
    this.eventEmitter.emit('content.unpublished', { entryId: id, typeSlug, status: 'DRAFT' });
    return { data: updated };
  }

  async archive(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    assertApplied(await this.repo.updateStatus(id, ct.id, 'ARCHIVED'), id);
    return { data: await this.reload(ct.id, id) };
  }

  /**
   * Moves an ARCHIVED entry back to DRAFT. This is not trash restoration: a
   * trashed entry is brought back with `POST /trash/content/:id/restore`, which
   * also clears `trashedAt`. Flipping the status here would have left a trashed
   * row marked DRAFT and still invisible, so it is refused.
   */
  async unarchive(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    assertApplied(await this.repo.updateStatus(id, ct.id, 'DRAFT'), id);
    return { data: await this.reload(ct.id, id) };
  }

  /** @deprecated Ambiguous with trash restore — use {@link unarchive}. */
  restore(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    return this.unarchive(typeSlug, id);
  }

  /**
   * Bulk actions are per-item, not atomic: see `runBulkEntryAction`. Every id goes
   * through the same single-entry path as the individual route, so the content-type
   * binding, the schema gate and the SEO gate are enforced for each one.
   */
  async bulkTrash(
    typeSlug: string,
    ids: string[],
    actorId?: string,
  ): Promise<{ data: BulkEntryOutcome }> {
    return { data: await runBulkEntryAction(ids, (id) => this.trash(typeSlug, id, actorId)) };
  }

  async bulkPublish(typeSlug: string, ids: string[]): Promise<{ data: BulkEntryOutcome }> {
    return { data: await runBulkEntryAction(ids, (id) => this.publish(typeSlug, id)) };
  }

  async bulkUnpublish(typeSlug: string, ids: string[]): Promise<{ data: BulkEntryOutcome }> {
    return { data: await runBulkEntryAction(ids, (id) => this.unpublish(typeSlug, id)) };
  }

  async schedulePublish(
    typeSlug: string,
    id: string,
    dto: SchedulePublishDto,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    const queue = this.publishQueue;
    await scheduleEntryPublish(this.repo, this.gate, queue, ct, entry, typeSlug, dto.publishAt);
    return { data: await this.reload(ct.id, id) };
  }

  async cancelSchedule(typeSlug: string, id: string): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    await cancelEntrySchedule(this.repo, this.publishQueue, ct.id, id);
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
    return paginate(items, total, limit);
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
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    const data = await revertEntryToVersion(this.repo, this.gate, ct, entry, versionId, userId);
    return { data };
  }
}
