import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import { writeLocale } from './content-entry.helpers';
import type { ContentRepository, EntryWithLocale, VersionWithAuthor } from './content.repository';
import type { ContentWriteGate } from './validation/content-write.gate';
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
