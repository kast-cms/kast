import { Logger } from '@nestjs/common';
import type { FormField } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFieldConfig } from '../../content/validation/field-config';
import type { FormWithFields } from '../form.repository';
import type { CompiledFormField, CompiledFormSchema } from './form-validation.types';

const logger = new Logger('FormSchemaCompiler');

const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, CompiledFormSchema>();

/** Keyed on the field definitions themselves so any edit invalidates the entry. */
function cacheKey(form: FormWithFields): string {
  const parts = form.fields.map((f) =>
    [f.id, f.name, f.type, f.isRequired, JSON.stringify(f.config ?? null)].join('|'),
  );
  return createHash('sha1')
    .update([form.id, ...parts].join('\n'))
    .digest('hex');
}

function compilePattern(field: FormField, source: string | undefined): RegExp | null {
  if (!source) return null;
  try {
    return new RegExp(source);
  } catch {
    logger.warn(`Field '${field.name}' has an invalid regex config and it will be ignored`);
    return null;
  }
}

function compileField(field: FormField): CompiledFormField {
  const config = readFieldConfig(field.config);
  return {
    name: field.name,
    type: field.type,
    required: field.isRequired === true,
    config,
    pattern: compilePattern(field, config.regex),
  };
}

/** Compiles the stored field rows into a lookup-friendly schema, cached per definition. */
export function compileFormSchema(form: FormWithFields): CompiledFormSchema {
  const key = cacheKey(form);
  const cached = cache.get(key);
  if (cached) return cached;

  const fields = form.fields.map(compileField);
  const compiled: CompiledFormSchema = {
    formId: form.id,
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

export function clearFormSchemaCache(): void {
  cache.clear();
}
