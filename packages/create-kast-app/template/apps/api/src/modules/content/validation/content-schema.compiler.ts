import { Logger } from '@nestjs/common';
import type { ContentField } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { ContentTypeWithFields } from '../../content-types/content-types.repository';
import type { CompiledField, CompiledSchema } from './content-validation.types';
import { readFieldConfig } from './field-config';

const logger = new Logger('ContentSchemaCompiler');

const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, CompiledSchema>();

/** Keyed on the field definitions themselves so any edit invalidates the entry. */
function cacheKey(ct: ContentTypeWithFields): string {
  const parts = ct.fields.map((f) =>
    [
      f.id,
      f.name,
      f.type,
      f.isRequired,
      f.isUnique,
      f.isLocalized,
      f.isHidden,
      JSON.stringify(f.config ?? null),
      JSON.stringify(f.defaultValue ?? null),
    ].join('|'),
  );
  return createHash('sha1')
    .update([ct.id, ct.name, ...parts].join('\n'))
    .digest('hex');
}

function compilePattern(field: ContentField, source: string | undefined): RegExp | null {
  if (!source) return null;
  try {
    return new RegExp(source);
  } catch {
    logger.warn(`Field '${field.name}' has an invalid regex config and it will be ignored`);
    return null;
  }
}

function compileField(field: ContentField): CompiledField {
  const config = readFieldConfig(field.config);
  return {
    name: field.name,
    displayName: field.displayName,
    type: field.type,
    required: field.isRequired === true,
    unique: field.isUnique === true,
    localized: field.isLocalized === true,
    hidden: field.isHidden === true,
    defaultValue: field.defaultValue ?? undefined,
    config,
    pattern: compilePattern(field, config.regex),
  };
}

/**
 * Compiles the stored field rows into a lookup-friendly schema. Cached on the
 * newest field `updatedAt` so a field edit invalidates the entry automatically.
 */
export function compileSchema(ct: ContentTypeWithFields): CompiledSchema {
  const key = cacheKey(ct);
  const cached = cache.get(key);
  if (cached) return cached;

  const fields = ct.fields.map(compileField);
  const compiled: CompiledSchema = {
    contentTypeId: ct.id,
    contentTypeName: ct.name,
    fields,
    byName: new Map(fields.map((f) => [f.name, f])),
  };

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, compiled);
  return compiled;
}

export function clearSchemaCache(): void {
  cache.clear();
}
