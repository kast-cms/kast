import { sanitizeRichText } from '../../../common/utils/sanitize-rich-text.util';
import type { CompiledField } from './content-validation.types';
import {
  checkJsonBounds,
  describe,
  fail,
  failWith,
  type FieldOutcome,
  isPlainObject,
  ok,
} from './field-outcome';

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function isSafeLink(raw: string): boolean {
  const value = raw.trim();
  if (value === '') return true;
  if (!HAS_SCHEME.test(value)) return true;
  try {
    return SAFE_LINK_SCHEMES.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Rejects unsafe href/src leaves inside a TipTap document without rebuilding it. */
function hasUnsafeLink(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUnsafeLink);
  if (!isPlainObject(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'href' || key === 'src') && typeof child === 'string' && !isSafeLink(child)) {
      return true;
    }
    if (hasUnsafeLink(child)) return true;
  }
  return false;
}

export function validateRichText(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw === 'string') return ok(sanitizeRichText(raw));
  if (!isPlainObject(raw)) {
    return fail(
      field,
      'type',
      `${field.name} must be rich text (HTML string or document object, received ${describe(raw)})`,
    );
  }
  const bounds = checkJsonBounds(field, raw);
  if (bounds.length > 0) return failWith(bounds);
  if (hasUnsafeLink(raw)) {
    return fail(field, 'unsafe_link', `${field.name} contains a link with a disallowed scheme`);
  }
  return ok(raw);
}

export function validateJson(field: CompiledField, raw: unknown): FieldOutcome {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return fail(field, 'invalid_json', `${field.name} is not valid JSON`);
    }
  }
  const issues = checkJsonBounds(field, value);
  return issues.length > 0 ? failWith(issues) : ok(value);
}

/**
 * COMPONENT and BLOCK are validated shape-only: nested component schemas are not
 * resolved, so their inner fields are not enforced.
 */
export function validateComponent(field: CompiledField, raw: unknown): FieldOutcome {
  if (!isPlainObject(raw)) {
    return fail(field, 'type', `${field.name} must be an object (received ${describe(raw)})`);
  }
  const issues = checkJsonBounds(field, raw);
  return issues.length > 0 ? failWith(issues) : ok(raw);
}

export function validateBlock(field: CompiledField, raw: unknown): FieldOutcome {
  if (!Array.isArray(raw)) {
    return fail(
      field,
      'type',
      `${field.name} must be an array of blocks (received ${describe(raw)})`,
    );
  }
  for (const item of raw) {
    if (!isPlainObject(item)) {
      return fail(field, 'type', `${field.name} must contain only block objects`);
    }
    const kind = item['type'] ?? item['__component'];
    if (typeof kind !== 'string' || kind === '') {
      return fail(
        field,
        'block_type',
        `${field.name} blocks need a string "type" or "__component" discriminator`,
      );
    }
  }
  const issues = checkJsonBounds(field, raw);
  return issues.length > 0 ? failWith(issues) : ok(raw);
}

type ReferenceKind = 'media' | 'relation';

function referenceNoun(kind: ReferenceKind): string {
  return kind === 'media' ? 'media file ID' : 'entry ID';
}

function withReferences(kind: ReferenceKind, ids: string[]): FieldOutcome {
  return ok(ids, kind === 'media' ? { mediaIds: ids } : { relationIds: ids });
}

function validateManyReferences(
  field: CompiledField,
  raw: unknown,
  kind: ReferenceKind,
): FieldOutcome {
  if (!Array.isArray(raw)) {
    return fail(field, 'type', `${field.name} must be an array of ${referenceNoun(kind)}s`);
  }
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || item.trim() === '') {
      return fail(field, 'type', `${field.name} must contain only ${referenceNoun(kind)}s`);
    }
    if (!ids.includes(item)) ids.push(item);
  }
  return withReferences(kind, ids);
}

export function validateReference(
  field: CompiledField,
  raw: unknown,
  kind: ReferenceKind,
): FieldOutcome {
  if (field.config.multiple === true) return validateManyReferences(field, raw, kind);
  if (typeof raw !== 'string' || raw.trim() === '') {
    return fail(
      field,
      'type',
      `${field.name} must be a ${referenceNoun(kind)} (received ${describe(raw)})`,
    );
  }
  const outcome = withReferences(kind, [raw]);
  return { ...outcome, value: raw };
}
