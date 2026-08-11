import { ContentFieldType } from '@prisma/client';
import { hasUnstorableText } from '../../../common/utils/unstorable-text.util';
import type { CompiledField } from './content-validation.types';
import type { FieldOutcome } from './field-outcome';
import {
  validateBoolean,
  validateColor,
  validateDate,
  validateDateTime,
  validateEmail,
  validateMultiSelect,
  validateNumber,
  validateSelect,
  validateText,
  validateUrl,
} from './scalar-field-validators';
import {
  validateBlock,
  validateComponent,
  validateJson,
  validateReference,
  validateRichText,
} from './structured-field-validators';

export { checkJsonBounds, isClearedValue, isPresentValue } from './field-outcome';
export type { FieldOutcome } from './field-outcome';

type Validator = (field: CompiledField, raw: unknown) => FieldOutcome;

const VALIDATORS: Record<ContentFieldType, Validator> = {
  [ContentFieldType.TEXT]: validateText,
  [ContentFieldType.RICH_TEXT]: validateRichText,
  [ContentFieldType.NUMBER]: validateNumber,
  [ContentFieldType.BOOLEAN]: validateBoolean,
  [ContentFieldType.DATE]: validateDate,
  [ContentFieldType.DATETIME]: validateDateTime,
  [ContentFieldType.MEDIA]: (field, raw) => validateReference(field, raw, 'media'),
  [ContentFieldType.RELATION]: (field, raw) => validateReference(field, raw, 'relation'),
  [ContentFieldType.JSON]: validateJson,
  [ContentFieldType.COMPONENT]: validateComponent,
  [ContentFieldType.BLOCK]: validateBlock,
  [ContentFieldType.SELECT]: validateSelect,
  [ContentFieldType.MULTI_SELECT]: validateMultiSelect,
  [ContentFieldType.COLOR]: validateColor,
  [ContentFieldType.URL]: validateUrl,
  [ContentFieldType.EMAIL]: validateEmail,
};

/**
 * Runs the per-type validator, then refuses any value carrying text a jsonb
 * column cannot store (CON: authenticated 500).
 *
 * The check sits here, on the COERCED value, rather than inside each validator,
 * for the same reason the forms layer puts it in `applyField`: it then covers
 * all sixteen types — including the nested strings inside JSON, COMPONENT and
 * BLOCK — and a validator added later cannot forget it. Postgres rejects NUL
 * and unpaired surrogates outright, and Prisma raises an *Unknown*RequestError
 * the global filter has no branch for, so the write turned an editor's PATCH
 * into a 500 and a Sentry event instead of a field-level 400.
 */
export function coerceAndValidateField(field: CompiledField, raw: unknown): FieldOutcome {
  const outcome = VALIDATORS[field.type](field, raw);
  if (outcome.issues.length > 0 || !hasUnstorableText(outcome.value)) return outcome;
  // No mediaIds/relationIds: the value is rejected, so nothing about it should
  // be queued for the batch existence checks.
  return {
    value: undefined,
    issues: [
      {
        field: field.name,
        rule: 'invalid_characters',
        message: `${field.name} contains characters that are not allowed`,
      },
    ],
    mediaIds: [],
    relationIds: [],
  };
}
