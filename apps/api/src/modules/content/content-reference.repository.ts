import { ContentFieldType, type ContentField, type Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

interface ReferenceRows {
  relations: Map<string, { fromId: string; toId: string; fieldName: string; position: number }>;
  usages: Map<string, { fileId: string; entryId: string; fieldName: string }>;
}

function collectFieldReferences(
  rows: ReferenceRows,
  entryId: string,
  field: Pick<ContentField, 'name' | 'type'>,
  data: Prisma.JsonValue,
): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  const raw = (data as Record<string, unknown>)[field.name];
  const ids = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];
  ids.forEach((value, position) => {
    if (typeof value !== 'string') return;
    if (field.type === ContentFieldType.RELATION) {
      rows.relations.set(`${field.name}:${value}`, {
        fromId: entryId,
        toId: value,
        fieldName: field.name,
        position,
      });
    } else {
      rows.usages.set(`${field.name}:${value}`, { fileId: value, entryId, fieldName: field.name });
    }
  });
}

/** Rebuilds queryable relation/media reference rows from all locale JSON values. */
export async function syncContentReferences(
  prisma: PrismaService,
  entryId: string,
  fields: Array<Pick<ContentField, 'name' | 'type'>>,
): Promise<void> {
  const locales = await prisma.contentEntryLocale.findMany({
    where: { entryId },
    select: { data: true },
  });
  const rows: ReferenceRows = { relations: new Map(), usages: new Map() };
  for (const field of fields) {
    if (field.type !== ContentFieldType.RELATION && field.type !== ContentFieldType.MEDIA) continue;
    for (const locale of locales) collectFieldReferences(rows, entryId, field, locale.data);
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.contentRelation.deleteMany({ where: { fromId: entryId } }),
      tx.mediaUsage.deleteMany({ where: { entryId } }),
    ]);
    if (rows.relations.size > 0) {
      await tx.contentRelation.createMany({ data: [...rows.relations.values()] });
    }
    if (rows.usages.size > 0) await tx.mediaUsage.createMany({ data: [...rows.usages.values()] });
  });
}
