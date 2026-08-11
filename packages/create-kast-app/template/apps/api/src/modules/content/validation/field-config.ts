/**
 * Reader for the free-form `ContentField.config` JSON column.
 *
 * The vocabulary is not owned by the API: the admin field-type editor writes some
 * keys under one name while the entry renderer reads them under another (choices
 * are written to `values` but read from `options`). Every alias is accepted here so
 * neither side has to move first, and an unreadable value is dropped rather than
 * failing the write.
 */
export interface FieldConfig {
  minLength?: number;
  maxLength?: number;
  regex?: string;
  min?: number;
  max?: number;
  isInteger?: boolean;
  multiple?: boolean;
  allowedMimeTypes?: string[];
  variant?: 'date' | 'datetime' | 'time';
  choices?: string[];
  minItems?: number;
  maxItems?: number;
  targetType?: string;
  allowRelative?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((v): v is string => typeof v === 'string' && v !== '');
  return items.length > 0 ? items : undefined;
}

function readVariant(value: unknown): FieldConfig['variant'] {
  if (value === 'date' || value === 'datetime' || value === 'time') return value;
  return undefined;
}

function firstDefined<T>(...values: (T | undefined)[]): T | undefined {
  for (const value of values) if (value !== undefined) return value;
  return undefined;
}

type Reader = (c: Record<string, unknown>) => unknown;

const READERS: Record<keyof FieldConfig, Reader> = {
  minLength: (c) => readNumber(c['minLength']),
  maxLength: (c) => readNumber(c['maxLength']),
  regex: (c) => firstDefined(readString(c['regex']), readString(c['pattern'])),
  min: (c) => readNumber(c['min']),
  max: (c) => readNumber(c['max']),
  isInteger: (c) => firstDefined(readBoolean(c['isInteger']), readBoolean(c['integer'])),
  multiple: (c) => readBoolean(c['multiple']),
  allowedMimeTypes: (c) =>
    firstDefined(readStringArray(c['allowedMimeTypes']), readStringArray(c['allowedTypes'])),
  variant: (c) => readVariant(c['variant']),
  choices: (c) =>
    firstDefined(
      readStringArray(c['options']),
      readStringArray(c['values']),
      readStringArray(c['choices']),
    ),
  minItems: (c) => readNumber(c['minItems']),
  maxItems: (c) => readNumber(c['maxItems']),
  targetType: (c) =>
    firstDefined(
      readString(c['targetType']),
      readString(c['target']),
      readString(c['contentType']),
    ),
  allowRelative: (c) => readBoolean(c['allowRelative']),
};

export function readFieldConfig(raw: unknown): FieldConfig {
  const source = asRecord(raw);
  const config: Record<string, unknown> = {};
  for (const [key, read] of Object.entries(READERS)) {
    const value = read(source);
    if (value !== undefined) config[key] = value;
  }
  return config as FieldConfig;
}
