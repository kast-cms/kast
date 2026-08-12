import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import type { SeoService } from '../seo/seo.service';
import { assertApplied, localeData, snapshotLocales, writeLocale } from './content-entry.helpers';
import { assertActiveLocale } from './content-locale.ops';
import { requireSlug } from './content-slug';
import type { ContentRepository, EntryWithLocale } from './content.repository';
import type { UpdateContentEntryDto } from './dto/content-entry.dto';
import type { ContentWriteGate } from './validation/content-write.gate';
import { PUBLIC_STATUSES, resolveValidationMode } from './validation/validation-mode';

export interface ContentUpdateDependencies {
  repo: ContentRepository;
  gate: ContentWriteGate;
  seo: SeoService;
  events: EventEmitter2;
  load(
    typeSlug: string,
    id: string,
  ): Promise<{
    ct: ContentTypeWithFields;
    entry: EntryWithLocale;
  }>;
  reload(contentTypeId: string, id: string): Promise<EntryWithLocale>;
}

interface UpdateState {
  ct: ContentTypeWithFields;
  entry: EntryWithLocale;
  locale: string;
  slug: string | undefined;
}

async function persistPayload(
  deps: ContentUpdateDependencies,
  state: UpdateState,
  id: string,
  dto: UpdateContentEntryDto,
  userId: string,
): Promise<void> {
  const { ct, entry, locale, slug } = state;
  if (dto.data) {
    const result = await deps.gate.validatePayload(ct, dto.data, {
      mode: resolveValidationMode(entry.status, dto.status),
      localeCode: locale,
      previousData: localeData(entry, locale),
    });
    await deps.repo.createVersion(
      id,
      localeData(entry, locale),
      snapshotLocales(entry),
      userId,
      entry.status,
    );
    await deps.repo.update(id, ct.id, locale, result.data, result.uniqueChecks, slug);
    return;
  }

  const goesPublic = PUBLIC_STATUSES.has(dto.status ?? entry.status);
  if (dto.status !== undefined && goesPublic) await deps.gate.assertStoredPublishable(ct, entry);
  if (slug !== undefined) assertApplied(await deps.repo.updateSlug(id, ct.id, locale, slug), id);
}

async function createSlugRedirect(
  seo: SeoService,
  typeSlug: string,
  previousSlug: string | undefined,
  nextSlug: string | undefined,
  wasPublished: boolean,
  userId: string,
): Promise<void> {
  if (!wasPublished || !previousSlug || !nextSlug || previousSlug === nextSlug) return;
  await seo.createRedirect(
    {
      fromPath: `/${typeSlug}/${previousSlug}`,
      toPath: `/${typeSlug}/${nextSlug}`,
    },
    userId,
  );
}

export async function updateContentEntry(
  deps: ContentUpdateDependencies,
  typeSlug: string,
  id: string,
  dto: UpdateContentEntryDto,
  userId: string,
): Promise<{ data: EntryWithLocale }> {
  const { ct, entry } = await deps.load(typeSlug, id);
  const locale = writeLocale(entry, dto.locale);
  if (!entry.locales.some((item) => item.localeCode === locale)) {
    await assertActiveLocale(deps.repo, locale);
  }
  const slug = dto.slug === undefined ? undefined : requireSlug(dto.slug, 'slug');
  const previousSlug = entry.locales.find((item) => item.localeCode === locale)?.slug;

  await persistPayload(deps, { ct, entry, locale, slug }, id, dto, userId);
  if (dto.status) assertApplied(await deps.repo.updateStatus(id, ct.id, dto.status), id);

  const updated = await deps.reload(ct.id, id);
  await deps.repo.syncReferences(id, ct.fields);
  await createSlugRedirect(
    deps.seo,
    typeSlug,
    previousSlug,
    slug,
    entry.status === 'PUBLISHED',
    userId,
  );
  deps.events.emit('content.updated', { entryId: id, typeSlug, status: updated.status });
  return { data: updated };
}
