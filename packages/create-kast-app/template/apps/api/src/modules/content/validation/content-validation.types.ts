import type { ContentFieldType } from '@prisma/client';
import type { FieldConfig } from './field-config';

/**
 * Required fields are enforced only when content is about to become public.
 * The admin autosaves a brand-new entry after 30s with a mostly empty payload,
 * so draft writes must be allowed to be incomplete.
 */
export type ValidationMode = 'draft' | 'publish';

export interface FieldIssue {
  field: string;
  rule: string;
  message: string;
}

export interface UniqueCheck {
  fieldName: string;
  localeCode: string;
  value: string;
}

export interface CompiledField {
  name: string;
  displayName: string;
  type: ContentFieldType;
  required: boolean;
  unique: boolean;
  localized: boolean;
  hidden: boolean;
  defaultValue: unknown;
  config: FieldConfig;
  pattern: RegExp | null;
}

export interface CompiledSchema {
  contentTypeId: string;
  contentTypeName: string;
  fields: CompiledField[];
  byName: Map<string, CompiledField>;
}

/**
 * Where the data being validated came from. 'stored' data went through this
 * validator when it was written, so a key that stopped being a field afterwards is
 * a schema-history artifact rather than a bad request; re-rejecting it would make
 * deleting a field brick every entry that already had one.
 */
export type ValidationSource = 'payload' | 'stored';

export interface ValidateOptions {
  mode: ValidationMode;
  localeCode: string;
  /** Only true on create and locale add; an update must not resurrect a cleared value. */
  applyDefaults?: boolean;
  /** Stored locale data, used to carry non-writable field values forward. */
  previousData?: Record<string, unknown>;
  /** Defaults to 'payload'. */
  source?: ValidationSource;
}

export interface ValidationResult {
  data: Record<string, unknown>;
  uniqueChecks: UniqueCheck[];
  issues: FieldIssue[];
}

/** Data keys that are not content-type fields but are part of the entry contract. */
export const SLUG_KEY = 'slug';
export const SEO_KEY = '_seo';

export const MAX_JSON_DEPTH = 20;
export const MAX_JSON_BYTES = 256 * 1024;
