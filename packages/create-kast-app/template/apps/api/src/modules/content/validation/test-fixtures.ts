import { type ContentField, ContentFieldType } from '@prisma/client';
import type { ContentTypeWithFields } from '../../content-types/content-types.repository';

let seq = 0;

export function buildField(over: Partial<ContentField> = {}): ContentField {
  seq += 1;
  return {
    id: `f${seq}`,
    contentTypeId: 'ct1',
    name: `field${seq}`,
    displayName: `Field ${seq}`,
    type: ContentFieldType.TEXT,
    isRequired: false,
    isLocalized: false,
    isUnique: false,
    isHidden: false,
    position: 0,
    config: {},
    defaultValue: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as ContentField;
}

export function buildType(
  fields: ContentField[],
  over: Partial<ContentTypeWithFields> = {},
): ContentTypeWithFields {
  return {
    id: 'ct1',
    name: 'blog',
    displayName: 'Blog',
    description: null,
    icon: null,
    isLocalized: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    fields,
    ...over,
  } as ContentTypeWithFields;
}
