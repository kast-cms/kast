import { ContentFieldType } from '@prisma/client';
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

export function coerceAndValidateField(field: CompiledField, raw: unknown): FieldOutcome {
  return VALIDATORS[field.type](field, raw);
}
