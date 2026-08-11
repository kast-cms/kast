import { FormFieldType } from '@prisma/client';
import { UNSTORABLE_TEXT } from '../../../common/utils/unstorable-text.util';
import {
  type CompiledFormField,
  DEFAULT_MAX_LENGTH,
  type FieldIssue,
  MAX_ITEMS,
} from './form-validation.types';

const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>".]+(\.[^\s@<>".]+)+$/;
const PHONE = /^\+?[\d\s().-]{5,32}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/i;
const TRUTHY = new Set(['true', 'on', 'yes', '1']);
const FALSY = new Set(['false', 'off', 'no', '0', '']);
const MAX_FILE_REF_LENGTH = 2048;

export interface FieldOutcome {
  value: unknown;
  issues: FieldIssue[];
}

export function issue(field: CompiledFormField, rule: string, message: string): FieldIssue {
  return { field: field.name, rule, message };
}

function fail(field: CompiledFormField, rule: string, message: string): FieldOutcome {
  return { value: undefined, issues: [issue(field, rule, message)] };
}

function failWith(issues: FieldIssue[]): FieldOutcome {
  return { value: undefined, issues };
}

function ok(value: unknown): FieldOutcome {
  return { value, issues: [] };
}

/** Refuses a coerced value the database could not store, whatever the field type. */
export function unstorableTextIssue(field: CompiledFormField, value: unknown): FieldIssue | null {
  const values = Array.isArray(value) ? value : [value];
  const offends = values.some((item) => typeof item === 'string' && UNSTORABLE_TEXT.test(item));
  return offends
    ? issue(field, 'invalid_characters', `${field.name} contains characters that are not allowed`)
    : null;
}

/** A value the submitter left blank rather than filled in. */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** `new Date('2026-02-31')` silently rolls over, so the calendar day is checked by hand. */
function isRealCalendarDate(value: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function lengthIssues(field: CompiledFormField, value: string): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const { minLength } = field.config;
  const maxLength = field.config.maxLength ?? DEFAULT_MAX_LENGTH;
  if (minLength !== undefined && value.length < minLength) {
    issues.push(issue(field, 'minLength', `${field.name} is too short`));
  }
  if (value.length > maxLength) {
    issues.push(issue(field, 'maxLength', `${field.name} is too long`));
  }
  if (field.pattern && !field.pattern.test(value)) {
    issues.push(issue(field, 'regex', `${field.name} has an invalid format`));
  }
  return issues;
}

function validateText(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') return fail(field, 'type', `${field.name} must be text`);
  const value = raw.trim();
  const issues = lengthIssues(field, value);
  return issues.length > 0 ? failWith(issues) : ok(value);
}

function validateEmail(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') return fail(field, 'type', `${field.name} must be text`);
  const value = raw.trim();
  if (value.length > 254 || !EMAIL.test(value)) {
    return fail(field, 'format', `${field.name} must be a valid email address`);
  }
  const at = value.lastIndexOf('@');
  return ok(`${value.slice(0, at)}@${value.slice(at + 1).toLowerCase()}`);
}

function validatePhone(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') return fail(field, 'type', `${field.name} must be text`);
  const value = raw.trim();
  const digits = value.replace(/\D/g, '');
  if (!PHONE.test(value) || digits.length < 5) {
    return fail(field, 'format', `${field.name} must be a valid phone number`);
  }
  return ok(value);
}

function coerceNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberRuleIssues(field: CompiledFormField, value: number): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const { min, max, isInteger } = field.config;
  if (isInteger === true && !Number.isInteger(value)) {
    issues.push(issue(field, 'isInteger', `${field.name} must be a whole number`));
  }
  if (min !== undefined && value < min) {
    issues.push(issue(field, 'min', `${field.name} is too low`));
  }
  if (max !== undefined && value > max) {
    issues.push(issue(field, 'max', `${field.name} is too high`));
  }
  return issues;
}

function validateNumber(field: CompiledFormField, raw: unknown): FieldOutcome {
  const value = coerceNumber(raw);
  if (value === null) return fail(field, 'type', `${field.name} must be a number`);
  const issues = numberRuleIssues(field, value);
  return issues.length > 0 ? failWith(issues) : ok(value);
}

function validateChoice(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') return fail(field, 'type', `${field.name} must be text`);
  const value = raw.trim();
  const choices = field.config.choices;
  if (choices && !choices.includes(value)) {
    return fail(field, 'choice', `${field.name} is not an allowed choice`);
  }
  if (!choices && value.length > DEFAULT_MAX_LENGTH) {
    return fail(field, 'maxLength', `${field.name} is too long`);
  }
  return ok(value);
}

function readStringList(raw: unknown[]): string[] | null {
  const values: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const value = item.trim();
    if (!values.includes(value)) values.push(value);
  }
  return values;
}

function multiChoiceRuleIssues(field: CompiledFormField, values: string[]): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const { choices, minItems, maxItems } = field.config;
  if (choices && values.some((v) => !choices.includes(v))) {
    issues.push(issue(field, 'choice', `${field.name} contains a choice that is not allowed`));
  }
  if (minItems !== undefined && values.length < minItems) {
    issues.push(issue(field, 'minItems', `${field.name} needs more entries`));
  }
  if (maxItems !== undefined && values.length > maxItems) {
    issues.push(issue(field, 'maxItems', `${field.name} has too many entries`));
  }
  return issues;
}

function validateMultiChoice(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (!Array.isArray(raw)) return fail(field, 'type', `${field.name} must be a list`);
  if (raw.length > MAX_ITEMS) return fail(field, 'maxItems', `${field.name} has too many entries`);

  const values = readStringList(raw);
  if (values === null) return fail(field, 'type', `${field.name} must contain only text`);

  const issues = multiChoiceRuleIssues(field, values);
  return issues.length > 0 ? failWith(issues) : ok(values);
}

/**
 * A browser posts a ticked checkbox as `on` and an unticked one not at all, so the
 * string forms are accepted alongside a real boolean.
 */
function validateCheckbox(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (typeof raw === 'boolean') return ok(raw);
  if (typeof raw === 'number' && (raw === 0 || raw === 1)) return ok(raw === 1);
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (TRUTHY.has(value)) return ok(true);
    if (FALSY.has(value)) return ok(false);
  }
  return fail(field, 'type', `${field.name} must be a boolean`);
}

function validateDate(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') return fail(field, 'type', `${field.name} must be a date`);
  const value = raw.trim();
  if (!DATE_ONLY.test(value) && !DATE_TIME.test(value)) {
    return fail(field, 'format', `${field.name} must be an ISO 8601 date`);
  }
  if (!isRealCalendarDate(value) || Number.isNaN(new Date(value).getTime())) {
    return fail(field, 'format', `${field.name} is not a real date`);
  }
  return ok(value);
}

/** A file field carries a reference (media id or URL); the bytes never ride in the JSON. */
function validateFile(field: CompiledFormField, raw: unknown): FieldOutcome {
  if (typeof raw !== 'string') return fail(field, 'type', `${field.name} must be a file reference`);
  const value = raw.trim();
  if (value.length > MAX_FILE_REF_LENGTH) {
    return fail(field, 'maxLength', `${field.name} is too long`);
  }
  return ok(value);
}

type Validator = (field: CompiledFormField, raw: unknown) => FieldOutcome;

/** Keyed on the whole enum, so a new field type cannot be added without a validator. */
const VALIDATORS: Record<FormFieldType, Validator> = {
  [FormFieldType.TEXT]: validateText,
  [FormFieldType.TEXTAREA]: validateText,
  [FormFieldType.EMAIL]: validateEmail,
  [FormFieldType.PHONE]: validatePhone,
  [FormFieldType.NUMBER]: validateNumber,
  [FormFieldType.SELECT]: validateChoice,
  [FormFieldType.RADIO]: validateChoice,
  [FormFieldType.MULTI_SELECT]: validateMultiChoice,
  [FormFieldType.CHECKBOX]: validateCheckbox,
  [FormFieldType.DATE]: validateDate,
  [FormFieldType.FILE]: validateFile,
};

export function validateFormField(field: CompiledFormField, raw: unknown): FieldOutcome {
  return VALIDATORS[field.type](field, raw);
}
