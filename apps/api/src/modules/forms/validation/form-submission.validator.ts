import { FormFieldType } from '@prisma/client';
import { isBlank, issue, validateFormField } from './form-field-validators';
import {
  type CompiledFormField,
  type CompiledFormSchema,
  type FieldIssue,
  MAX_SUBMISSION_BYTES,
  type SubmissionValidationResult,
} from './form-validation.types';

function sizeIssue(data: Record<string, unknown>): FieldIssue | null {
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return { field: 'data', rule: 'invalid_json', message: 'Submission is not serialisable JSON' };
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SUBMISSION_BYTES) {
    return { field: 'data', rule: 'too_large', message: 'Submission is too large' };
  }
  return null;
}

/**
 * A required checkbox is a consent box: only a tick satisfies it, whereas every
 * other type only has to be non-blank.
 */
function isSatisfied(field: CompiledFormField, value: unknown): boolean {
  if (field.type === FormFieldType.CHECKBOX) return value === true;
  return !isBlank(value);
}

/**
 * Validates a public submission against the form's own field definitions and
 * returns only the known fields, coerced. Never throws: every issue is collected
 * so the caller can answer with one response.
 */
function applyField(
  field: CompiledFormField,
  data: Record<string, unknown>,
  out: Record<string, unknown>,
): FieldIssue[] {
  const present = Object.prototype.hasOwnProperty.call(data, field.name);
  const raw = present ? data[field.name] : undefined;

  if (!present || isBlank(raw)) {
    return field.required ? [issue(field, 'required', `${field.name} is required`)] : [];
  }

  const outcome = validateFormField(field, raw);
  if (outcome.issues.length > 0) return outcome.issues;
  if (field.required && !isSatisfied(field, outcome.value)) {
    return [issue(field, 'required', `${field.name} is required`)];
  }

  out[field.name] = outcome.value;
  return [];
}

export function validateSubmission(
  schema: CompiledFormSchema,
  data: Record<string, unknown>,
): SubmissionValidationResult {
  const oversized = sizeIssue(data);
  if (oversized) return { data: {}, issues: [oversized] };

  const out: Record<string, unknown> = {};
  const issues: FieldIssue[] = [];

  for (const key of Object.keys(data)) {
    if (schema.byName.has(key)) continue;
    issues.push({
      field: key,
      rule: 'unknown_field',
      message: `${key} is not a field of this form`,
    });
  }

  for (const field of schema.fields) issues.push(...applyField(field, data, out));

  return { data: out, issues };
}
