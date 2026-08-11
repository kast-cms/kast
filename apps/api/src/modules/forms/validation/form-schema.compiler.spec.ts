import { FormFieldType } from '@prisma/client';
import { clearFormSchemaCache, compileFormSchema } from './form-schema.compiler';
import { buildForm, buildFormField } from './test-fixtures';

describe('compileFormSchema', () => {
  beforeEach(() => {
    clearFormSchemaCache();
  });

  it('exposes fields by name with the config parsed', () => {
    const form = buildForm([
      buildFormField({
        name: 'topic',
        type: FormFieldType.SELECT,
        isRequired: true,
        config: { options: ['sales', 'support'] },
      }),
    ]);

    const topic = compileFormSchema(form).byName.get('topic');

    expect(topic?.required).toBe(true);
    expect(topic?.config.choices).toEqual(['sales', 'support']);
  });

  it('returns the cached instance for an unchanged form', () => {
    const form = buildForm([buildFormField({ name: 'email' })]);
    expect(compileFormSchema(form)).toBe(compileFormSchema(form));
  });

  it('recompiles when a field definition changes', () => {
    const field = buildFormField({ name: 'email' });
    const first = compileFormSchema(buildForm([field]));
    const second = compileFormSchema(buildForm([{ ...field, isRequired: true }]));

    expect(second).not.toBe(first);
    expect(second.byName.get('email')?.required).toBe(true);
  });

  it('drops a stored regex that does not compile instead of throwing', () => {
    const form = buildForm([buildFormField({ name: 'ref', config: { regex: '([unclosed' } })]);
    expect(compileFormSchema(form).byName.get('ref')?.pattern).toBeNull();
  });
});
