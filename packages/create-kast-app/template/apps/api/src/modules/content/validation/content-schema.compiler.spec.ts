import { ContentFieldType } from '@prisma/client';
import { clearSchemaCache, compileSchema } from './content-schema.compiler';
import { buildField, buildType } from './test-fixtures';

describe('compileSchema', () => {
  beforeEach(() => {
    clearSchemaCache();
  });

  it('exposes fields by name with the config parsed', () => {
    const ct = buildType([
      buildField({
        name: 'title',
        type: ContentFieldType.TEXT,
        isRequired: true,
        config: { maxLength: 5 },
      }),
    ]);
    const schema = compileSchema(ct);
    const title = schema.byName.get('title');
    expect(title?.required).toBe(true);
    expect(title?.config.maxLength).toBe(5);
  });

  it('returns the cached instance for an unchanged content type', () => {
    const ct = buildType([buildField({ name: 'title' })]);
    expect(compileSchema(ct)).toBe(compileSchema(ct));
  });

  it('recompiles when a field definition changes', () => {
    const field = buildField({ name: 'title' });
    const first = compileSchema(buildType([field]));
    const second = compileSchema(buildType([{ ...field, isRequired: true }]));
    expect(second).not.toBe(first);
    expect(second.byName.get('title')?.required).toBe(true);
  });

  it('drops a stored regex that does not compile instead of throwing', () => {
    const schema = compileSchema(
      buildType([buildField({ name: 'title', config: { regex: '([unclosed' } })]),
    );
    expect(schema.byName.get('title')?.pattern).toBeNull();
  });

  it('treats a missing config as empty', () => {
    const schema = compileSchema(
      buildType([buildField({ name: 'title', config: null as unknown as object })]),
    );
    expect(schema.byName.get('title')?.config).toEqual({});
  });
});
