import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

function versionLockKey(entryId: string): bigint {
  return createHash('sha256').update(`content-version:${entryId}`).digest().readBigInt64BE(0);
}

/**
 * Allocates the next version number for an entry. The read and the write that
 * follows it must be serialised against other writers on the same entry: read
 * committed lets two concurrent updates both see version N and then collide on
 * the (entryId, versionNumber) unique index, losing one caller's snapshot.
 * Callers must already be inside a transaction — the lock is transaction-scoped.
 */
export async function allocateVersionNumber(
  tx: Prisma.TransactionClient,
  entryId: string,
): Promise<number> {
  // $executeRaw, not $queryRaw: the lock function returns void, which the client
  // cannot deserialize into a row.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${versionLockKey(entryId)}::bigint)`;
  const latest = await tx.contentEntryVersion.findFirst({
    where: { entryId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });
  return (latest?.versionNumber ?? 0) + 1;
}
