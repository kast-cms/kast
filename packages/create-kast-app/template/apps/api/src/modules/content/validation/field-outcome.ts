import {
  type CompiledField,
  type FieldIssue,
  MAX_JSON_BYTES,
  MAX_JSON_DEPTH,
} from './content-validation.types';

export interface FieldOutcome {
  value: unknown;
  issues: FieldIssue[];
  /** Media file IDs referenced by this value, to be checked for existence in batch. */
  mediaIds: string[];
  /** Content entry IDs referenced by this value, to be checked for existence in batch. */
  relationIds: string[];
}

export function issue(field: CompiledField, rule: string, message: string): FieldIssue {
  return { field: field.name, rule, message };
}

export function fail(field: CompiledField, rule: string, message: string): FieldOutcome {
  return { value: undefined, issues: [issue(field, rule, message)], mediaIds: [], relationIds: [] };
}

export function failWith(issues: FieldIssue[]): FieldOutcome {
  return { value: undefined, issues, mediaIds: [], relationIds: [] };
}

export function ok(
  value: unknown,
  extra?: Partial<Pick<FieldOutcome, 'mediaIds' | 'relationIds'>>,
): FieldOutcome {
  return {
    value,
    issues: [],
    mediaIds: extra?.mediaIds ?? [],
    relationIds: extra?.relationIds ?? [],
  };
}

export function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.slice(0, 60));
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  return String(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonDepth(value: unknown, depth: number): number {
  if (depth > MAX_JSON_DEPTH) return depth;
  if (Array.isArray(value)) {
    let max = depth;
    for (const item of value) max = Math.max(max, jsonDepth(item, depth + 1));
    return max;
  }
  if (isPlainObject(value)) {
    let max = depth;
    for (const item of Object.values(value)) max = Math.max(max, jsonDepth(item, depth + 1));
    return max;
  }
  return depth;
}

/** Guards against unbounded nesting and payload size on the free-form JSON types. */
export function checkJsonBounds(field: CompiledField, value: unknown): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (jsonDepth(value, 0) > MAX_JSON_DEPTH) {
    issues.push(issue(field, 'json_too_deep', `${field.name} nests deeper than ${MAX_JSON_DEPTH}`));
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return [issue(field, 'invalid_json', `${field.name} is not serialisable JSON`)];
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BYTES) {
    issues.push(
      issue(field, 'json_too_large', `${field.name} exceeds ${MAX_JSON_BYTES} bytes once encoded`),
    );
  }
  return issues;
}

/** A value the caller supplied to clear the field rather than to set it. */
export function isClearedValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/** Whether a stored value counts as present for the purposes of `isRequired`. */
export function isPresentValue(value: unknown): boolean {
  if (isClearedValue(value)) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}
