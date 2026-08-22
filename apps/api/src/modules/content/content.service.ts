/* eslint-disable max-lines */
import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ContentStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
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
  writeLocale,
} from './content-entry.helpers';
import { addEntryLocale } from './content-locale.ops';
import {
  previewEntryPublish,
  previewEntryTrash,
  previewEntryUnpublish,
  type PublishPreview,
} from './content-preview.ops';
import { revertEntryToVersion } from './content-revert.ops';
import { cancelEntrySchedule, scheduleEntryPublish } from './content-schedule.ops';
import { resolveEntrySlug } from './content-slug';
import { updateContentEntry } from './content-update.ops';
import { ContentRepository, EntryWithLocale, VersionWithAuthor } from './content.repository';
import type {
  AddLocaleDto,
  CreateContentEntryDto,
  ImportContentDto,
  ImportWordPressDto,
  PublishContentDto,
  SchedulePublishDto,
  UpdateContentEntryDto,
} from './dto/content-entry.dto';
import type { ContentQueryDto } from './dto/content-query.dto';
import type { ValidationResult } from './validation/content-validation.types';
import { ContentWriteGate } from './validation/content-write.gate';
import { resolveValidationMode } from './validation/validation-mode';

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
    await this.repo.syncReferences(entry.id, ct.fields);
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
    assertWritableStatus(typeSlug, id, dto.status);
    return updateContentEntry(
      {
        repo: this.repo,
        gate: this.gate,
        seo: this.seoService,
        events: this.eventEmitter,
        load: (slug, entryId) => this.requireWritableEntry(slug, entryId),
        reload: (contentTypeId, entryId) => this.reload(contentTypeId, entryId),
      },
      typeSlug,
      id,
      dto,
      userId,
    );
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
    actor?: AuthUser,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    this.assertReviewGate(entry, actor);

    await this.gate.assertStoredPublishable(ct, entry);
    assertSeoPublishable(await this.seoService.validateNow(id), dto?.force);

    assertApplied(await this.repo.updateStatus(id, ct.id, 'PUBLISHED', new Date()), id);
    const updated = await this.reload(ct.id, id);
    this.eventEmitter.emit('content.published', { entryId: id, typeSlug, status: 'PUBLISHED' });
    return { data: updated };
  }

  /** Runs every publish gate and returns its decision without changing entry status. */
  async previewPublish(typeSlug: string, id: string, force = false): Promise<PublishPreview> {
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    return previewEntryPublish(this.gate, this.seoService, ct, entry, force);
  }

  /** Checks that trashing would address a live entry, without touching it. */
  async previewTrash(typeSlug: string, id: string): Promise<{ wouldTrash: true; status: string }> {
    const { entry } = await this.requireWritableEntry(typeSlug, id);
    return previewEntryTrash(entry);
  }

  async previewUnpublish(
    typeSlug: string,
    id: string,
  ): Promise<{ wouldUnpublish: boolean; status: string }> {
    const { entry } = await this.requireWritableEntry(typeSlug, id);
    return previewEntryUnpublish(entry);
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
    await this.repo.syncReferences(id, ct.fields);
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

  async bulkPublish(
    typeSlug: string,
    ids: string[],
    actor?: AuthUser,
  ): Promise<{ data: BulkEntryOutcome }> {
    return { data: await runBulkEntryAction(ids, (id) => this.publish(typeSlug, id, {}, actor)) };
  }

  async bulkUnpublish(typeSlug: string, ids: string[]): Promise<{ data: BulkEntryOutcome }> {
    return { data: await runBulkEntryAction(ids, (id) => this.unpublish(typeSlug, id)) };
  }

  async schedulePublish(
    typeSlug: string,
    id: string,
    dto: SchedulePublishDto,
    actor?: AuthUser,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct, entry } = await this.requireWritableEntry(typeSlug, id);
    this.assertReviewGate(entry, actor);
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
    await this.repo.syncReferences(id, ct.fields);
    return { data };
  }

  async submitForReview(
    typeSlug: string,
    id: string,
    userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    assertApplied(await this.repo.updateReviewStatus(id, ct.id, 'IN_REVIEW', userId), id);
    return { data: await this.reload(ct.id, id) };
  }

  async approveReview(
    typeSlug: string,
    id: string,
    userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    assertApplied(await this.repo.updateReviewStatus(id, ct.id, 'APPROVED', userId), id);
    return { data: await this.reload(ct.id, id) };
  }

  async requestChanges(
    typeSlug: string,
    id: string,
    userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    assertApplied(await this.repo.updateReviewStatus(id, ct.id, 'CHANGES_REQUESTED', userId), id);
    return { data: await this.reload(ct.id, id) };
  }

  async acquireLock(
    typeSlug: string,
    id: string,
    userId: string,
  ): Promise<{ data: EntryWithLocale }> {
    const { ct } = await this.requireWritableEntry(typeSlug, id);
    const locked = await this.repo.acquireLock(
      id,
      ct.id,
      userId,
      new Date(Date.now() + 15 * 60_000),
    );
    if (!locked) throw new ConflictException('Entry is locked by another editor');
    return { data: locked };
  }

  async releaseLock(typeSlug: string, id: string, userId: string): Promise<void> {
    const { ct } = await this.requireEntry(typeSlug, id);
    await this.repo.releaseLock(id, ct.id, userId);
  }

  async diffVersion(
    typeSlug: string,
    id: string,
    versionId: string,
    locale?: string,
  ): Promise<{
    data: {
      fromVersionId: string;
      fromVersionNumber: number;
      to: 'current';
      changes: JsonDiff[];
    };
  }> {
    const [{ data: version }, { entry }] = await Promise.all([
      this.getVersion(typeSlug, id, versionId),
      this.requireEntry(typeSlug, id, locale),
    ]);
    return {
      data: {
        fromVersionId: version.id,
        fromVersionNumber: version.versionNumber,
        to: 'current',
        changes: diffJson(
          version.data as Record<string, unknown>,
          localeData(entry, writeLocale(entry, locale)),
        ),
      },
    };
  }

  async exportType(typeSlug: string): Promise<{
    data: {
      formatVersion: 1;
      exportedAt: string;
      contentType: ContentTypeWithFields;
      entries: Awaited<ReturnType<ContentRepository['findAllForExport']>>;
    };
  }> {
    const ct = await this.contentTypesService.findByName(typeSlug);
    return {
      data: {
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        contentType: ct,
        entries: await this.repo.findAllForExport(ct.id),
      },
    };
  }

  async importType(
    typeSlug: string,
    dto: ImportContentDto,
    userId: string,
  ): Promise<{ data: { imported: number; ids: string[] } }> {
    const ct = await this.contentTypesService.findByName(typeSlug);
    const ids: string[] = [];
    for (const entry of dto.entries) {
      for (const locale of entry.locales) {
        await this.gate.validatePayload(ct, locale.data, {
          mode: 'draft',
          localeCode: locale.localeCode,
          applyDefaults: true,
        });
      }
      const created = await this.repo.importEntry({
        contentTypeId: ct.id,
        ...(entry.id ? { id: entry.id } : {}),
        status: (entry.status ?? 'DRAFT') as ContentStatus,
        locales: entry.locales,
        versions:
          entry.versions?.map((version) => ({
            versionNumber: version.versionNumber,
            status: (version.status ?? 'DRAFT') as ContentStatus,
            data: version.data,
            localesData: version.localesData,
          })) ?? [],
        overwrite: dto.overwrite === true,
        actorId: userId,
      });
      ids.push(created.id);
      await this.repo.syncReferences(created.id, ct.fields);
    }
    return { data: { imported: ids.length, ids } };
  }

  async importWordPress(
    typeSlug: string,
    dto: ImportWordPressDto,
    userId: string,
  ): Promise<{ data: { imported: number; ids: string[] } }> {
    const ids: string[] = [];
    for (const post of dto.posts) {
      const created = await this.create(
        typeSlug,
        {
          locale: dto.locale ?? 'en',
          ...(post.slug ? { slug: post.slug } : {}),
          data: {
            title: post.title,
            content: post.content,
            excerpt: post.excerpt ?? '',
            publishedAt: post.date ?? null,
            source: 'wordpress',
          },
        },
        userId,
      );
      ids.push(created.data.id);
    }
    return { data: { imported: ids.length, ids } };
  }

  private assertReviewGate(entry: EntryWithLocale, actor?: AuthUser): void {
    if (!actor) return;
    const canBypass =
      actor.roles.includes(SYSTEM_ROLES.ADMIN) || actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN);
    if (canBypass || entry.reviewStatus === 'APPROVED') return;
    throw new ConflictException('Entry must be approved before publishing');
  }
}

interface JsonDiff {
  path: string;
  before: unknown;
  after: unknown;
  type: 'added' | 'removed' | 'changed';
}

function diffJson(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  path = '',
): JsonDiff[] {
  const changes: JsonDiff[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    const nextPath = path ? `${path}.${key}` : key;
    const left = before[key];
    const right = after[key];
    if (!(key in before)) {
      changes.push({ path: nextPath, before: undefined, after: right, type: 'added' });
    } else if (!(key in after)) {
      changes.push({ path: nextPath, before: left, after: undefined, type: 'removed' });
    } else if (isPlainObject(left) && isPlainObject(right)) {
      changes.push(...diffJson(left, right, nextPath));
    } else if (JSON.stringify(left) !== JSON.stringify(right)) {
      changes.push({ path: nextPath, before: left, after: right, type: 'changed' });
    }
  }
  return changes;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
