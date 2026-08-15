import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

const DEFAULT_VERSION_RETENTION = 50;

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

/** Deletes the oldest snapshots beyond the saved per-entry retention limit. */
export async function pruneContentVersions(
  tx: Prisma.TransactionClient,
  entryId: string,
): Promise<void> {
  const setting = await tx.globalSetting.findUnique({
    where: { key: 'content.versionRetention' },
    select: { value: true },
  });
  const parsed = Number(setting?.value ?? DEFAULT_VERSION_RETENTION);
  const retention =
    Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : DEFAULT_VERSION_RETENTION;
  const stale = await tx.contentEntryVersion.findMany({
    where: { entryId },
    orderBy: { versionNumber: 'desc' },
    skip: retention,
    select: { id: true },
  });
  if (stale.length > 0) {
    await tx.contentEntryVersion.deleteMany({ where: { id: { in: stale.map(({ id }) => id) } } });
  }
}
