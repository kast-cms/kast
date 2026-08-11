jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return { default: { sanitize }, sanitize };
});

import { ContentFieldType } from '@prisma/client';
import { clearSchemaCache } from './content-schema.compiler';
import { ContentSchemaValidator } from './content-schema.validator';
import type { ContentValidationRepository } from './content-validation.repository';
import { buildField, buildType } from './test-fixtures';

type Mocked<T> = { [K in keyof T]: jest.Mock };

describe('ContentSchemaValidator', () => {
  let repo: Mocked<ContentValidationRepository>;
  let validator: ContentSchemaValidator;

  beforeEach(() => {
    clearSchemaCache();
    repo = {
      findLiveMedia: jest.fn().mockResolvedValue(new Map()),
      findLiveEntryTypes: jest.fn().mockResolvedValue(new Map()),
      findContentTypeIdsByName: jest.fn().mockResolvedValue(new Map()),
    } as unknown as Mocked<ContentValidationRepository>;
    validator = new ContentSchemaValidator(repo as unknown as ContentValidationRepository);
  });

  const draft = { mode: 'draft' as const, localeCode: 'en' };
  const publish = { mode: 'publish' as const, localeCode: 'en' };

  it('rejects a key that is not a field of the type', async () => {
    const ct = buildType([buildField({ name: 'title' })]);
    const result = await validator.validate(ct, { title: 'a', nope: 1 }, draft);
    expect(result.issues).toEqual([
      { field: 'nope', rule: 'unknown_field', message: 'nope is not a field of blog' },
    ]);
  });

  it('passes the reserved slug and _seo keys through untouched', async () => {
    const ct = buildType([buildField({ name: 'title' })]);
    const result = await validator.validate(
      ct,
      { title: 'a', slug: 'my-slug', _seo: { metaTitle: 'x' } },
      draft,
    );
    expect(result.issues).toEqual([]);
    expect(result.data).toEqual({ title: 'a', slug: 'my-slug', _seo: { metaTitle: 'x' } });
  });

  it('validates slug as a normal field when the type declares one', async () => {
    const ct = buildType([buildField({ name: 'slug', config: { maxLength: 3 } })]);
    const result = await validator.validate(ct, { slug: 'too-long' }, draft);
    expect(result.issues.map((i) => i.rule)).toEqual(['maxLength']);
  });

  it('refuses to write a hidden field but carries the stored value forward', async () => {
    const ct = buildType([buildField({ name: 'internal', isHidden: true })]);
    const result = await validator.validate(
      ct,
      { internal: 'hack' },
      {
        ...draft,
        previousData: { internal: 'kept' },
      },
    );
    expect(result.issues.map((i) => i.rule)).toEqual(['field_not_writable']);
    expect(result.data['internal']).toBe('kept');
  });

  it('accepts a hidden field echoed back unchanged, however deeply structured', async () => {
    const ct = buildType([
      buildField({ name: 'internal', type: ContentFieldType.JSON, isHidden: true }),
    ]);
    const stored = { a: [1, { b: 'c' }], d: null };
    const result = await validator.validate(
      ct,
      { internal: { d: null, a: [1, { b: 'c' }] } },
      { ...draft, previousData: { internal: stored } },
    );
    expect(result.issues).toEqual([]);
    // The stored value is what gets written, never the echo.
    expect(result.data['internal']).toBe(stored);
  });

  it('refuses a hidden field the payload invents where nothing was stored', async () => {
    const ct = buildType([buildField({ name: 'internal', isHidden: true })]);
    const result = await validator.validate(ct, { internal: 'smuggled' }, draft);
    expect(result.issues.map((i) => i.rule)).toEqual(['field_not_writable']);
    expect(result.data['internal']).toBeUndefined();
  });

  it('does not apply the writability rule to stored data validated against itself', async () => {
    const ct = buildType([
      buildField({ name: 'title', isRequired: true }),
      buildField({ name: 'internal', isHidden: true }),
    ]);
    const stored = { title: 'Hello', internal: 'notes' };
    const result = await validator.validate(ct, stored, { ...publish, previousData: stored });
    expect(result.issues).toEqual([]);
  });

  it('leaves a key whose field was deleted alone when the source is stored data', async () => {
    const ct = buildType([buildField({ name: 'title' })]);
    const stored = { title: 'Hello', author: 'Kast Writer' };
    await expect(
      validator.validate(ct, stored, { ...publish, source: 'stored', previousData: stored }),
    ).resolves.toMatchObject({ issues: [] });
    // ...but the same key in an incoming payload is still rejected.
    const payload = await validator.validate(ct, stored, publish);
    expect(payload.issues.map((i) => i.rule)).toEqual(['unknown_field']);
  });

  it('enforces required fields only when publishing', async () => {
    const ct = buildType([buildField({ name: 'title', isRequired: true })]);
    await expect(validator.validate(ct, {}, draft)).resolves.toMatchObject({ issues: [] });
    const gated = await validator.validate(ct, {}, publish);
    expect(gated.issues).toEqual([
      { field: 'title', rule: 'required', message: 'title is required' },
    ]);
  });

  it('treats an explicitly cleared required field as missing at publish time', async () => {
    const ct = buildType([buildField({ name: 'title', isRequired: true })]);
    const result = await validator.validate(ct, { title: '' }, publish);
    expect(result.issues.map((i) => i.rule)).toEqual(['required']);
    expect(result.data['title']).toBeNull();
  });

  it('applies defaultValue only when asked to', async () => {
    const ct = buildType([buildField({ name: 'title', defaultValue: 'Untitled' })]);
    const created = await validator.validate(ct, {}, { ...draft, applyDefaults: true });
    expect(created.data['title']).toBe('Untitled');
    const updated = await validator.validate(ct, {}, draft);
    expect(updated.data).not.toHaveProperty('title');
  });

  it('accumulates every issue into one result', async () => {
    const ct = buildType([
      buildField({ name: 'title', isRequired: true }),
      buildField({ name: 'count', type: ContentFieldType.NUMBER }),
    ]);
    const result = await validator.validate(ct, { count: '3 min', nope: true }, publish);
    expect(result.issues.map((i) => i.rule).sort()).toEqual(['required', 'type', 'unknown_field']);
  });

  it('collects a unique check for each unique field with a value', async () => {
    const ct = buildType([
      buildField({ name: 'slug', isUnique: true }),
      buildField({ name: 'title' }),
    ]);
    const result = await validator.validate(ct, { slug: 'a', title: 'b' }, draft);
    expect(result.uniqueChecks).toEqual([{ fieldName: 'slug', localeCode: 'en', value: 'a' }]);
  });

  describe('media references', () => {
    it('rejects a media id that does not exist', async () => {
      const ct = buildType([buildField({ name: 'cover', type: ContentFieldType.MEDIA })]);
      const result = await validator.validate(ct, { cover: 'm-missing' }, draft);
      expect(result.issues.map((i) => i.rule)).toEqual(['media_not_found']);
    });

    it('enforces allowedMimeTypes with wildcard support', async () => {
      repo.findLiveMedia.mockResolvedValue(new Map([['m1', 'application/pdf']]));
      const ct = buildType([
        buildField({
          name: 'cover',
          type: ContentFieldType.MEDIA,
          config: { allowedMimeTypes: ['image/*'] },
        }),
      ]);
      const rejected = await validator.validate(ct, { cover: 'm1' }, draft);
      expect(rejected.issues.map((i) => i.rule)).toEqual(['media_type']);

      repo.findLiveMedia.mockResolvedValue(new Map([['m1', 'image/png']]));
      const accepted = await validator.validate(ct, { cover: 'm1' }, draft);
      expect(accepted.issues).toEqual([]);
    });
  });

  describe('relation references', () => {
    it('rejects a target entry that does not exist', async () => {
      const ct = buildType([buildField({ name: 'author', type: ContentFieldType.RELATION })]);
      const result = await validator.validate(ct, { author: 'e-missing' }, draft);
      expect(result.issues.map((i) => i.rule)).toEqual(['relation_not_found']);
    });

    it('rejects a target entry of the wrong content type', async () => {
      repo.findLiveEntryTypes.mockResolvedValue(new Map([['e1', 'ct-other']]));
      repo.findContentTypeIdsByName.mockResolvedValue(new Map([['author', 'ct-author']]));
      const ct = buildType([
        buildField({
          name: 'author',
          type: ContentFieldType.RELATION,
          config: { targetType: 'author' },
        }),
      ]);
      const result = await validator.validate(ct, { author: 'e1' }, draft);
      expect(result.issues.map((i) => i.rule)).toEqual(['relation_type']);
    });

    it('accepts a target entry of the configured content type', async () => {
      repo.findLiveEntryTypes.mockResolvedValue(new Map([['e1', 'ct-author']]));
      repo.findContentTypeIdsByName.mockResolvedValue(new Map([['author', 'ct-author']]));
      const ct = buildType([
        buildField({
          name: 'author',
          type: ContentFieldType.RELATION,
          config: { targetType: 'author' },
        }),
      ]);
      const result = await validator.validate(ct, { author: 'e1' }, draft);
      expect(result.issues).toEqual([]);
    });
  });

  it('does not query the database when nothing references it', async () => {
    const ct = buildType([buildField({ name: 'title' })]);
    await validator.validate(ct, { title: 'a' }, draft);
    expect(repo.findLiveMedia).not.toHaveBeenCalled();
    expect(repo.findLiveEntryTypes).not.toHaveBeenCalled();
  });
});
