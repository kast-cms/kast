import { Injectable } from '@nestjs/common';
import type { ContentTypeWithFields } from '../../content-types/content-types.repository';
import { compileSchema } from './content-schema.compiler';
import { ContentValidationRepository } from './content-validation.repository';
import {
  type CompiledField,
  type FieldIssue,
  MAX_JSON_DEPTH,
  SEO_KEY,
  SLUG_KEY,
  type UniqueCheck,
  type ValidateOptions,
  type ValidationResult,
} from './content-validation.types';
import { type FieldOutcome, isPlainObject } from './field-outcome';
import { coerceAndValidateField, isClearedValue, isPresentValue } from './field-validators';

interface Reference {
  field: CompiledField;
  ids: string[];
}

interface Accumulator {
  out: Record<string, unknown>;
  issues: FieldIssue[];
  uniqueChecks: UniqueCheck[];
  mediaRefs: Reference[];
  relationRefs: Reference[];
}

function mimeMatches(pattern: string, mimeType: string): boolean {
  if (pattern === mimeType) return true;
  if (!pattern.endsWith('/*')) return false;
  return mimeType.startsWith(pattern.slice(0, -1));
}

function uniqueIds(refs: Reference[]): string[] {
  const set = new Set<string>();
  for (const ref of refs) for (const id of ref.ids) set.add(id);
  return [...set];
}

/** Depth-capped structural equality; anything deeper than a storable value is "different". */
function sameArray(a: unknown[], b: unknown, depth: number): boolean {
  if (!Array.isArray(b) || a.length !== b.length) return false;
  return a.every((item, i) => sameValue(item, b[i], depth + 1));
}

function sameObject(a: Record<string, unknown>, b: unknown, depth: number): boolean {
  if (!isPlainObject(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key], depth + 1),
  );
}

function sameValue(a: unknown, b: unknown, depth = 0): boolean {
  if (a === b) return true;
  if (depth >= MAX_JSON_DEPTH) return false;
  if (Array.isArray(a)) return sameArray(a, b, depth);
  if (Array.isArray(b)) return false;
  if (!isPlainObject(a)) return false;
  return sameObject(a, b, depth);
}

@Injectable()
export class ContentSchemaValidator {
  constructor(private readonly repo: ContentValidationRepository) {}

  /**
   * Validates and normalizes a data payload against the content type's fields.
   * Never throws for content problems: every issue is accumulated so a caller can
   * report them all at once with the status code that fits its write path.
   */
  async validate(
    ct: ContentTypeWithFields,
    data: Record<string, unknown>,
    options: ValidateOptions,
  ): Promise<ValidationResult> {
    const schema = compileSchema(ct);
    const acc: Accumulator = {
      out: {},
      issues: [],
      uniqueChecks: [],
      mediaRefs: [],
      relationRefs: [],
    };

    if (options.source !== 'stored') this.scanUnknownKeys(schema.byName, data, acc, ct.name);
    this.copyReservedKeys(schema.byName, data, acc);
    for (const field of schema.fields) this.applyField(field, data, options, acc);

    await this.checkMediaReferences(acc.mediaRefs, acc.issues);
    await this.checkRelationReferences(acc.relationRefs, acc.issues);

    return { data: acc.out, uniqueChecks: acc.uniqueChecks, issues: acc.issues };
  }

  private applyField(
    field: CompiledField,
    data: Record<string, unknown>,
    options: ValidateOptions,
    acc: Accumulator,
  ): void {
    const present = Object.prototype.hasOwnProperty.call(data, field.name);

    if (field.hidden) {
      this.applyHiddenField(field, data, present, options, acc);
      return;
    }

    const value = this.incomingValue(field, data, present, options);

    if (isClearedValue(value)) {
      if (present && value !== undefined) acc.out[field.name] = null;
      this.requireIfPublishing(field, options, acc.issues);
      return;
    }

    const outcome = coerceAndValidateField(field, value);
    if (outcome.issues.length > 0) {
      acc.issues.push(...outcome.issues);
      return;
    }
    this.recordValue(field, outcome, options, acc);
  }

  private incomingValue(
    field: CompiledField,
    data: Record<string, unknown>,
    present: boolean,
    options: ValidateOptions,
  ): unknown {
    if (present) return data[field.name];
    if (options.applyDefaults === true && !isClearedValue(field.defaultValue)) {
      return field.defaultValue;
    }
    return undefined;
  }

  private recordValue(
    field: CompiledField,
    outcome: FieldOutcome,
    options: ValidateOptions,
    acc: Accumulator,
  ): void {
    acc.out[field.name] = outcome.value;
    if (!isPresentValue(outcome.value)) this.requireIfPublishing(field, options, acc.issues);
    if (outcome.mediaIds.length > 0) acc.mediaRefs.push({ field, ids: outcome.mediaIds });
    if (outcome.relationIds.length > 0) acc.relationRefs.push({ field, ids: outcome.relationIds });
    this.recordUniqueCheck(field, outcome.value, options, acc);
  }

  /**
   * A hidden field is read-only, not forbidden: the stored value is what gets
   * written no matter what the payload says, so nothing unvalidated can ride in on
   * one. Only a *change* is refused — echoing the stored value back is allowed
   * because the admin editor round-trips the whole data object, and validating
   * stored data against itself (publish, revert) must never report a write it
   * never made.
   */
  private applyHiddenField(
    field: CompiledField,
    data: Record<string, unknown>,
    present: boolean,
    options: ValidateOptions,
    acc: Accumulator,
  ): void {
    const carried = options.previousData?.[field.name];
    if (present && !sameValue(data[field.name], carried)) {
      acc.issues.push({
        field: field.name,
        rule: 'field_not_writable',
        message: `${field.name} is not writable`,
      });
    }
    if (carried !== undefined) acc.out[field.name] = carried;
  }

  private recordUniqueCheck(
    field: CompiledField,
    value: unknown,
    options: ValidateOptions,
    acc: Accumulator,
  ): void {
    if (!field.unique) return;
    if (typeof value !== 'string' && typeof value !== 'number') return;
    if (!isPresentValue(value)) return;
    acc.uniqueChecks.push({
      fieldName: field.name,
      localeCode: options.localeCode,
      value: String(value),
    });
  }

  private requireIfPublishing(
    field: CompiledField,
    options: ValidateOptions,
    issues: FieldIssue[],
  ): void {
    if (options.mode !== 'publish' || !field.required) return;
    issues.push({ field: field.name, rule: 'required', message: `${field.name} is required` });
  }

  private scanUnknownKeys(
    byName: Map<string, CompiledField>,
    data: Record<string, unknown>,
    acc: Accumulator,
    typeName: string,
  ): void {
    for (const key of Object.keys(data)) {
      if (byName.has(key) || key === SEO_KEY || key === SLUG_KEY) continue;
      acc.issues.push({
        field: key,
        rule: 'unknown_field',
        message: `${key} is not a field of ${typeName}`,
      });
    }
  }

  /**
   * `slug` is lifted out of `data` onto the locale row and `_seo` is injected by the
   * admin editor; both are part of the entry payload without being schema fields.
   */
  private copyReservedKeys(
    byName: Map<string, CompiledField>,
    data: Record<string, unknown>,
    acc: Accumulator,
  ): void {
    if (Object.prototype.hasOwnProperty.call(data, SEO_KEY)) {
      const seo = data[SEO_KEY];
      if (seo === null || isPlainObject(seo)) acc.out[SEO_KEY] = seo;
      else
        acc.issues.push({ field: SEO_KEY, rule: 'type', message: `${SEO_KEY} must be an object` });
    }

    if (byName.has(SLUG_KEY) || !Object.prototype.hasOwnProperty.call(data, SLUG_KEY)) return;
    const slug = data[SLUG_KEY];
    if (typeof slug === 'string' || slug === null) acc.out[SLUG_KEY] = slug;
    else
      acc.issues.push({ field: SLUG_KEY, rule: 'type', message: `${SLUG_KEY} must be a string` });
  }

  private async checkMediaReferences(refs: Reference[], issues: FieldIssue[]): Promise<void> {
    const ids = uniqueIds(refs);
    if (ids.length === 0) return;
    const live = await this.repo.findLiveMedia(ids);
    for (const ref of refs) {
      const allowed = ref.field.config.allowedMimeTypes;
      for (const id of ref.ids) {
        const mimeType = live.get(id);
        if (mimeType === undefined) {
          issues.push({
            field: ref.field.name,
            rule: 'media_not_found',
            message: `${ref.field.name} references media file ${id} which does not exist`,
          });
        } else if (allowed && !allowed.some((pattern) => mimeMatches(pattern, mimeType))) {
          issues.push({
            field: ref.field.name,
            rule: 'media_type',
            message: `${ref.field.name} must reference media of type: ${allowed.join(', ')}`,
          });
        }
      }
    }
  }

  private async checkRelationReferences(refs: Reference[], issues: FieldIssue[]): Promise<void> {
    const ids = uniqueIds(refs);
    if (ids.length === 0) return;
    const live = await this.repo.findLiveEntryTypes(ids);
    const targetNames = [
      ...new Set(
        refs
          .map((ref) => ref.field.config.targetType)
          .filter((name): name is string => name !== undefined),
      ),
    ];
    const targetIds = await this.repo.findContentTypeIdsByName(targetNames);

    for (const ref of refs) {
      for (const id of ref.ids) {
        const found = live.get(id);
        if (found === undefined) {
          issues.push({
            field: ref.field.name,
            rule: 'relation_not_found',
            message: `${ref.field.name} references entry ${id} which does not exist`,
          });
          continue;
        }
        const mismatch = this.relationTargetIssue(ref.field, found, targetIds);
        if (mismatch) issues.push(mismatch);
      }
    }
  }

  private relationTargetIssue(
    field: CompiledField,
    contentTypeId: string,
    targetIds: Map<string, string>,
  ): FieldIssue | null {
    const targetName = field.config.targetType;
    if (targetName === undefined) return null;
    const expected = targetIds.get(targetName);
    if (expected === undefined) {
      return {
        field: field.name,
        rule: 'relation_target_unknown',
        message: `${field.name} targets unknown content type '${targetName}'`,
      };
    }
    if (contentTypeId === expected) return null;
    return {
      field: field.name,
      rule: 'relation_type',
      message: `${field.name} must reference entries of type '${targetName}'`,
    };
  }
}
