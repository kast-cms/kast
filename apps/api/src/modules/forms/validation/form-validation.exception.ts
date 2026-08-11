import { BadRequestException } from '@nestjs/common';
import type { FieldIssue } from './form-validation.types';

/**
 * Answers a public submitter, so the top-level message is fixed and the per-field
 * detail names only the rule that failed. Nothing about the form itself — its
 * name, its configured bounds or its allowed choices — is disclosed here.
 */
export class FormSubmissionException extends BadRequestException {
  constructor(issues: FieldIssue[]) {
    super({
      message: 'Submission is invalid',
      code: 'FORM_SUBMISSION_INVALID',
      errors: issues,
    });
  }
}
