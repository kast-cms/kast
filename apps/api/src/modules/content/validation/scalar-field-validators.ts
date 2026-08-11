import type { CompiledField, FieldIssue } from './content-validation.types';
import { describe, fail, failWith, type FieldOutcome, issue, ok } from './field-outcome';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/i;
const TIME_ONLY = /^\d{2}:\d{2}(:\d{2})?$/;
const COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FUNC = /^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)$/i;
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>".]+(\.[^\s@<>".]+)+$/;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** `new Date('2026-02-31')` silently rolls over, so the calendar day is checked by hand. */
function isRealCalendarDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!parts) return true;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function lengthIssues(field: CompiledField, value: string): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const { minLength, maxLength } = field.config;
  if (minLength !== undefined && value.length < minLength) {
    issues.push(
      issue(field, 'minLength', `${field.name} must be at least ${minLength} characters`),
    );
  }
  if (maxLength !== undefined && value.length > maxLength) {
    issues.push(issue(field, 'maxLength', `${field.name} must be at most ${maxLength} characters`));
  }
  if (field.pattern && !field.pattern.test(value)) {
    issues.push(issue(field, 'regex', `${field.name} does not match the required pattern`));
  }
  return issues;
}

export function validateText(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') {
    return fail(field, 'type', `${field.name} must be a string (received ${describe(raw)})`);
  }
  const value = raw.trim();
  const issues = lengthIssues(field, value);
  return issues.length > 0 ? failWith(issues) : ok(value);
}

function coerceNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberRuleIssues(field: CompiledField, value: number): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const { min, max, isInteger } = field.config;
  if (isInteger === true && !Number.isInteger(value)) {
    issues.push(issue(field, 'isInteger', `${field.name} must be an integer`));
  }
  if (min !== undefined && value < min) {
    issues.push(issue(field, 'min', `${field.name} must be at least ${min}`));
  }
  if (max !== undefined && value > max) {
    issues.push(issue(field, 'max', `${field.name} must be at most ${max}`));
  }
  return issues;
}

export function validateNumber(field: CompiledField, raw: unknown): FieldOutcome {
  const value = coerceNumber(raw);
  if (value === null) {
    return fail(field, 'type', `${field.name} must be a number (received ${describe(raw)})`);
  }
  const issues = numberRuleIssues(field, value);
  return issues.length > 0 ? failWith(issues) : ok(value);
}

export function validateBoolean(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw === 'boolean') return ok(raw);
  if (raw === 'true') return ok(true);
  if (raw === 'false') return ok(false);
  return fail(field, 'type', `${field.name} must be a boolean (received ${describe(raw)})`);
}

export function validateDate(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') {
    return fail(field, 'type', `${field.name} must be a date string (received ${describe(raw)})`);
  }
  const value = raw.trim();
  if (field.config.variant === 'time') {
    return TIME_ONLY.test(value)
      ? ok(value)
      : fail(field, 'format', `${field.name} must be a HH:mm or HH:mm:ss time`);
  }
  // Stored values keep the precision they arrived with: the sample content holds a
  // full ISO timestamp on a DATE field and the admin renders DATE as datetime-local.
  if (!DATE_ONLY.test(value) && !DATE_TIME.test(value)) {
    return fail(field, 'format', `${field.name} must be an ISO 8601 date or date-time`);
  }
  if (!isRealCalendarDate(value) || Number.isNaN(new Date(value).getTime())) {
    return fail(field, 'format', `${field.name} is not a real calendar date`);
  }
  return ok(value);
}

export function validateDateTime(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') {
    return fail(
      field,
      'type',
      `${field.name} must be a date-time string (received ${describe(raw)})`,
    );
  }
  const value = raw.trim();
  if (!DATE_TIME.test(value) && !DATE_ONLY.test(value)) {
    return fail(field, 'format', `${field.name} must be an ISO 8601 date-time`);
  }
  const parsed = new Date(value);
  if (!isRealCalendarDate(value) || Number.isNaN(parsed.getTime())) {
    return fail(field, 'format', `${field.name} is not a real calendar date-time`);
  }
  return ok(parsed.toISOString());
}

export function validateSelect(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') {
    return fail(field, 'type', `${field.name} must be a string (received ${describe(raw)})`);
  }
  const choices = field.config.choices;
  if (choices && !choices.includes(raw)) {
    return fail(field, 'choice', `${field.name} must be one of: ${choices.join(', ')}`);
  }
  return ok(raw);
}

function multiSelectRuleIssues(field: CompiledField, values: string[]): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const { choices, minItems, maxItems } = field.config;
  if (choices) {
    const unknown = values.filter((v) => !choices.includes(v));
    if (unknown.length > 0) {
      issues.push(
        issue(field, 'choice', `${field.name} has invalid choices: ${unknown.join(', ')}`),
      );
    }
  }
  if (minItems !== undefined && values.length < minItems) {
    issues.push(issue(field, 'minItems', `${field.name} needs at least ${minItems} entries`));
  }
  if (maxItems !== undefined && values.length > maxItems) {
    issues.push(issue(field, 'maxItems', `${field.name} allows at most ${maxItems} entries`));
  }
  return issues;
}

export function validateMultiSelect(field: CompiledField, raw: unknown): FieldOutcome {
  if (!Array.isArray(raw)) {
    return fail(field, 'type', `${field.name} must be an array (received ${describe(raw)})`);
  }
  const values: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      return fail(field, 'type', `${field.name} must contain only strings`);
    }
    if (!values.includes(item)) values.push(item);
  }
  const issues = multiSelectRuleIssues(field, values);
  return issues.length > 0 ? failWith(issues) : ok(values);
}

export function validateColor(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') {
    return fail(field, 'type', `${field.name} must be a color string (received ${describe(raw)})`);
  }
  const value = raw.trim();
  if (!COLOR_HEX.test(value) && !COLOR_FUNC.test(value)) {
    return fail(field, 'format', `${field.name} must be a hex or rgb()/rgba() color`);
  }
  return ok(value);
}

export function validateUrl(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') {
    return fail(field, 'type', `${field.name} must be a URL string (received ${describe(raw)})`);
  }
  const value = raw.trim();
  if (!HAS_SCHEME.test(value)) {
    if (field.config.allowRelative === true && value.startsWith('/')) return ok(value);
    return fail(field, 'format', `${field.name} must be an absolute http(s) URL`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail(field, 'format', `${field.name} is not a valid URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return fail(field, 'scheme', `${field.name} must use http or https`);
  }
  return ok(value);
}

export function validateEmail(field: CompiledField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') {
    return fail(field, 'type', `${field.name} must be an email string (received ${describe(raw)})`);
  }
  const value = raw.trim();
  if (value.length > 254 || !EMAIL.test(value)) {
    return fail(field, 'format', `${field.name} must be a valid email address`);
  }
  const at = value.lastIndexOf('@');
  return ok(`${value.slice(0, at)}@${value.slice(at + 1).toLowerCase()}`);
}
