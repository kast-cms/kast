import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { FieldIssue } from './content-validation.types';

/**
 * The global exception filter keeps only `code` and `message` from an HttpException
 * body, so the per-field detail has to survive inside the flattened message. The
 * structured `errors` array is emitted as well for clients that can read it.
 */
export function flattenIssues(typeName: string, issues: FieldIssue[]): string {
  const detail = issues.map((i) => i.message).join('; ');
  return `Content validation failed for '${typeName}': ${detail}`;
}

export class ContentValidationException extends BadRequestException {
  constructor(typeName: string, issues: FieldIssue[]) {
    super({
      message: flattenIssues(typeName, issues),
      code: 'CONTENT_VALIDATION_FAILED',
      errors: issues,
    });
  }
}

/** Stored content does not satisfy its schema, so a state transition is refused. */
export class ContentSchemaStateException extends UnprocessableEntityException {
  constructor(typeName: string, code: string, issues: FieldIssue[]) {
    super({
      message: flattenIssues(typeName, issues),
      code,
      errors: issues,
    });
  }
}
