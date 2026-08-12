import type { ContentEntryVersion, User } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export type VersionWithAuthor = ContentEntryVersion & {
  savedBy: Pick<User, 'id' | 'firstName' | 'lastName'>;
};

export async function listContentVersions(
  prisma: PrismaService,
  entryId: string,
  limit: number,
  cursor?: string,
): Promise<{ items: VersionWithAuthor[]; total: number }> {
  const where = { entryId };
  const [items, total] = await Promise.all([
    prisma.contentEntryVersion.findMany({
      where,
      include: { savedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { versionNumber: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.contentEntryVersion.count({ where }),
  ]);
  return { items: items as VersionWithAuthor[], total };
}

export function findContentVersionForType(
  prisma: PrismaService,
  entryId: string,
  contentTypeId: string,
  versionId: string,
): Promise<VersionWithAuthor | null> {
  return prisma.contentEntryVersion.findFirst({
    where: { id: versionId, entryId, entry: { contentTypeId } },
    include: { savedBy: { select: { id: true, firstName: true, lastName: true } } },
  }) as Promise<VersionWithAuthor | null>;
}
