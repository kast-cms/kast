import { FormFieldType } from '@prisma/client';
import { clearFormSchemaCache, compileFormSchema } from './form-schema.compiler';
import { validateSubmission } from './form-submission.validator';
import type { CompiledFormSchema } from './form-validation.types';
import { buildForm, buildFormField } from './test-fixtures';

function schemaOf(...fields: Parameters<typeof buildFormField>[0][]): CompiledFormSchema {
  clearFormSchemaCache();
  return compileFormSchema(buildForm(fields.map((f) => buildFormField(f))));
}

describe('validateSubmission', () => {
  it('keeps only the declared fields, coerced', () => {
    const schema = schemaOf(
      { name: 'email', type: FormFieldType.EMAIL },
      { name: 'age', type: FormFieldType.NUMBER },
    );

    const result = validateSubmission(schema, { email: ' A@B.COM ', age: '31' });

    expect(result.issues).toEqual([]);
    expect(result.data).toEqual({ email: 'A@b.com', age: 31 });
  });

  it('rejects a field the form does not declare', () => {
    const schema = schemaOf({ name: 'email', type: FormFieldType.EMAIL });

    const result = validateSubmission(schema, { email: 'a@b.com', isAdmin: true });

    expect(result.issues).toEqual([
      { field: 'isAdmin', rule: 'unknown_field', message: 'isAdmin is not a field of this form' },
    ]);
  });

  it('reports a missing required field', () => {
    const schema = schemaOf({ name: 'message', isRequired: true });

    expect(validateSubmission(schema, {}).issues).toEqual([
      { field: 'message', rule: 'required', message: 'message is required' },
    ]);
    expect(validateSubmission(schema, { message: '   ' }).issues).toEqual([
      { field: 'message', rule: 'required', message: 'message is required' },
    ]);
  });

  it('treats an unticked required checkbox as unanswered', () => {
    const schema = schemaOf({ name: 'consent', type: FormFieldType.CHECKBOX, isRequired: true });

    expect(validateSubmission(schema, { consent: false }).issues).toEqual([
      { field: 'consent', rule: 'required', message: 'consent is required' },
    ]);
    expect(validateSubmission(schema, { consent: true }).issues).toEqual([]);
  });

  it('leaves an optional blank field out of the stored data', () => {
    const schema = schemaOf({ name: 'company' });

    const result = validateSubmission(schema, { company: '' });

    expect(result.issues).toEqual([]);
    expect(result.data).toEqual({});
  });

  it('collects every issue rather than stopping at the first', () => {
    const schema = schemaOf(
      { name: 'email', type: FormFieldType.EMAIL, isRequired: true },
      { name: 'topic', type: FormFieldType.SELECT, config: { options: ['sales'] } },
    );

    const result = validateSubmission(schema, { topic: 'other', extra: 1 });

    expect(result.issues.map((i) => `${i.field}:${i.rule}`).sort()).toEqual([
      'email:required',
      'extra:unknown_field',
      'topic:choice',
    ]);
  });

  it('refuses an oversized submission before validating fields', () => {
    const schema = schemaOf({ name: 'message' });

    const result = validateSubmission(schema, { message: 'x'.repeat(65 * 1024) });

    expect(result.issues).toEqual([
      { field: 'data', rule: 'too_large', message: 'Submission is too large' },
    ]);
    expect(result.data).toEqual({});
  });

  it('never echoes the form name or its configuration in a message', () => {
    const schema = schemaOf({
      name: 'topic',
      type: FormFieldType.SELECT,
      config: { options: ['sales', 'support'] },
    });

    const messages = validateSubmission(schema, { topic: 'other' })
      .issues.map((i) => i.message)
      .join(' ');

    expect(messages).not.toContain('Contact');
    expect(messages).not.toContain('sales');
    expect(messages).not.toContain('support');
  });
});
