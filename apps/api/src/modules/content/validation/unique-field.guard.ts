import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { UniqueCheck } from './content-validation.types';

function uniqueKey(contentTypeId: string, check: UniqueCheck): string {
  return `${contentTypeId}|${check.fieldName}|${check.localeCode}|${check.value}`;
}

function advisoryLockKey(contentTypeId: string, check: UniqueCheck): bigint {
  return createHash('sha256').update(uniqueKey(contentTypeId, check)).digest().readBigInt64BE(0);
}

/**
 * Serialises concurrent writers on the same field value with a transaction-scoped
 * advisory lock, so the existence check cannot be raced by a second request. Locks
 * are taken in a deterministic order to keep two multi-field writes from deadlocking.
 */
export async function assertUniqueFields(
  tx: Prisma.TransactionClient,
  contentTypeId: string,
  checks: UniqueCheck[],
  excludeEntryId: string | null,
): Promise<void> {
  if (checks.length === 0) return;
  const ordered = [...checks].sort((a, b) =>
    uniqueKey(contentTypeId, a).localeCompare(uniqueKey(contentTypeId, b)),
  );
  for (const check of ordered) {
    // $executeRaw, not $queryRaw: the lock function returns void, which the client
    // cannot deserialize into a row.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey(contentTypeId, check)}::bigint)`;
    const clash = await tx.$queryRaw<{ entryId: string }[]>`
      SELECT l."entryId" AS "entryId"
      FROM content_entry_locales l
      JOIN content_entries e ON e.id = l."entryId"
      WHERE e."contentTypeId" = ${contentTypeId}
        AND e."trashedAt" IS NULL
        AND l."localeCode" = ${check.localeCode}
        AND l.data ->> ${check.fieldName}::text = ${check.value}
        AND l."entryId" <> ${excludeEntryId ?? ''}
      LIMIT 1`;
    if (clash.length > 0) {
      throw new ConflictException(
        `${check.fieldName} "${check.value}" is already used by another ${check.localeCode} entry`,
      );
    }
  }
}
