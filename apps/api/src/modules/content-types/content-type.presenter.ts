import type { ContentField } from '@prisma/client';
import type { ContentTypeWithCounts } from './content-types.repository';

/**
 * The management contract the SDK and admin are written against: the stored row
 * plus the relation counts. `fields` is kept so nothing that already reads the
 * Prisma shape loses data.
 */
export interface ContentTypeResponse {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  icon: string | null;
  isSystem: boolean;
  isLocalized: boolean;
  fields: ContentField[];
  fieldsCount: number;
  entriesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toContentTypeResponse(ct: ContentTypeWithCounts): ContentTypeResponse {
  return {
    id: ct.id,
    name: ct.name,
    displayName: ct.displayName,
    description: ct.description,
    icon: ct.icon,
    isSystem: ct.isSystem,
    isLocalized: ct.isLocalized,
    fields: ct.fields,
    fieldsCount: ct._count.fields,
    entriesCount: ct._count.entries,
    createdAt: ct.createdAt,
    updatedAt: ct.updatedAt,
  };
}
