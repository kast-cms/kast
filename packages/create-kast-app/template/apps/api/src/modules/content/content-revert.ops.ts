import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import { writeLocale } from './content-entry.helpers';
import { allocateVersionNumber } from './content-version.ops';
import type { ContentRepository, EntryWithLocale, VersionWithAuthor } from './content.repository';
import type { UniqueCheck } from './validation/content-validation.types';
import type { ContentWriteGate } from './validation/content-write.gate';
import { assertUniqueFields } from './validation/unique-field.guard';
import { resolveValidationMode } from './validation/validation-mode';

/**
 * Reverting re-runs the write gate against the snapshot: a version captured before
 * the current schema can hold data the type no longer accepts.
 */
export async function revertEntryToVersion(
  repo: ContentRepository,
  gate: ContentWriteGate,
  ct: ContentTypeWithFields,
  entry: EntryWithLocale,
  versionId: string,
  userId: string,
): Promise<EntryWithLocale> {
  const version = await repo.findVersionByIdForType(entry.id, ct.id, versionId);
  if (!version) throw new NotFoundException(`Version ${versionId} not found`);

  const uniqueChecks = await gate.validateVersionSnapshot(
    ct,
    version,
    writeLocale(entry),
    resolveValidationMode(entry.status),
  );

  return repo.revertToVersion(entry.id, ct.id, version, userId, uniqueChecks);
}

function parseLocalesData(value: unknown): Record<string, { slug?: string; data: unknown }> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, { slug?: string; data: unknown }>;
}

/** Builds the locale upsert ops for a revert, using the multi-locale snapshot when present. */
export function buildRevertLocaleOps(
  tx: Prisma.TransactionClient,
  entryId: string,
  version: VersionWithAuthor,
  primaryLocale: string,
): Prisma.PrismaPromise<unknown>[] {
  const snapshot = parseLocalesData(version.localesData);
  if (snapshot && Object.keys(snapshot).length > 0) {
    return Object.entries(snapshot).map(([code, payload]) =>
      tx.contentEntryLocale.upsert({
        where: { entryId_localeCode: { entryId, localeCode: code } },
        create: {
          entryId,
          localeCode: code,
          slug: payload.slug ?? code,
          data: payload.data as Prisma.InputJsonValue,
        },
        update: {
          ...(payload.slug ? { slug: payload.slug } : {}),
          data: payload.data as Prisma.InputJsonValue,
        },
      }),
    );
  }
  // Legacy version without a locale snapshot: restore primary-locale data only.
  return [
    tx.contentEntryLocale.upsert({
      where: { entryId_localeCode: { entryId, localeCode: primaryLocale } },
      create: {
        entryId,
        localeCode: primaryLocale,
        slug: primaryLocale,
        data: version.data as Prisma.InputJsonValue,
      },
      update: { data: version.data as Prisma.InputJsonValue },
    }),
  ];
}

interface RevertInput {
  entryId: string;
  contentTypeId: string;
  version: VersionWithAuthor;
  userId: string;
  uniqueChecks: UniqueCheck[];
}

/**
 * Restores a snapshot and records the restore as a new version. Runs inside the
 * caller's transaction so the locale writes, the status change and the version
 * row either all land or none do.
 */
export async function applyVersionRevert(
  tx: Prisma.TransactionClient,
  { entryId, contentTypeId, version, userId, uniqueChecks }: RevertInput,
): Promise<EntryWithLocale> {
  const entry = await tx.contentEntry.findFirstOrThrow({
    where: { id: entryId, contentTypeId },
    include: { locales: true },
  });
  await assertUniqueFields(tx, contentTypeId, uniqueChecks, entryId);
  const primaryLocale = entry.locales[0]?.localeCode ?? 'en';

  for (const op of buildRevertLocaleOps(tx, entryId, version, primaryLocale)) {
    await op;
  }
  await tx.contentEntry.update({ where: { id: entryId }, data: { status: 'DRAFT' } });

  await tx.contentEntryVersion.create({
    data: {
      entryId,
      versionNumber: await allocateVersionNumber(tx, entryId),
      status: 'DRAFT',
      data: version.data as Prisma.InputJsonValue,
      localesData: (version.localesData ?? {}) as Prisma.InputJsonValue,
      savedById: userId,
    },
  });
  return tx.contentEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { locales: true },
  }) as Promise<EntryWithLocale>;
}
