import { FormFieldType, type FormField } from '@prisma/client';
import type { FormWithFields } from '../form.repository';

let seq = 0;

export function buildFormField(overrides: Partial<FormField> = {}): FormField {
  seq += 1;
  return {
    id: `field-${seq}`,
    formId: 'form-1',
    name: 'message',
    label: 'Message',
    type: FormFieldType.TEXT,
    isRequired: false,
    position: 0,
    config: {},
    ...overrides,
  } as FormField;
}

export function buildForm(
  fields: FormField[],
  overrides: Partial<FormWithFields> = {},
): FormWithFields {
  return {
    id: 'form-1',
    name: 'Contact',
    slug: 'contact',
    description: null,
    isActive: true,
    notifyEmail: null,
    trashedAt: null,
    trashedByUserId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    fields,
    ...overrides,
  } as FormWithFields;
}
