import type { FormFieldType } from '@prisma/client';
import type { FieldConfig } from '../../content/validation/field-config';

export interface FieldIssue {
  field: string;
  rule: string;
  /**
   * Reaches the public submitter, so it names the rule that failed and never
   * echoes the stored configuration (bounds, allowed choices, the form itself).
   */
  message: string;
}

export interface CompiledFormField {
  name: string;
  type: FormFieldType;
  required: boolean;
  config: FieldConfig;
  pattern: RegExp | null;
}

export interface CompiledFormSchema {
  formId: string;
  fields: CompiledFormField[];
  byName: Map<string, CompiledFormField>;
}

export interface SubmissionValidationResult {
  /** Only known fields, coerced to their storable form. */
  data: Record<string, unknown>;
  issues: FieldIssue[];
}

/** Applied to the whole submission, since a field may set no bound of its own. */
export const MAX_SUBMISSION_BYTES = 64 * 1024;
export const DEFAULT_MAX_LENGTH = 10_000;
export const MAX_ITEMS = 100;
