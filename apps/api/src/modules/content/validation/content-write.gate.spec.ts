jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return { default: { sanitize }, sanitize };
});

import type { EntryWithLocale, VersionWithAuthor } from '../content.repository';
import { clearSchemaCache } from './content-schema.compiler';
import { ContentSchemaValidator } from './content-schema.validator';
import type { ContentValidationRepository } from './content-validation.repository';
import { ContentWriteGate } from './content-write.gate';
import { buildField, buildType } from './test-fixtures';

function entry(locales: { localeCode: string; data: unknown }[]): EntryWithLocale {
  return { id: 'e1', locales } as unknown as EntryWithLocale;
}

function version(over: Partial<VersionWithAuthor> = {}): VersionWithAuthor {
  return { id: 'v1', entryId: 'e1', data: {}, localesData: {}, ...over } as VersionWithAuthor;
}

describe('ContentWriteGate', () => {
  let gate: ContentWriteGate;
  const ct = buildType([buildField({ id: 'f-t', name: 'title', isRequired: true })]);

  beforeEach(() => {
    clearSchemaCache();
    gate = new ContentWriteGate(
      new ContentSchemaValidator({
        findLiveMedia: jest.fn().mockResolvedValue(new Map()),
        findLiveEntryTypes: jest.fn().mockResolvedValue(new Map()),
        findContentTypeIdsByName: jest.fn().mockResolvedValue(new Map()),
      } as unknown as ContentValidationRepository),
    );
  });

  describe('validatePayload', () => {
    it('throws a 400 listing every field problem in the message', async () => {
      await expect(
        gate.validatePayload(ct, { title: 5, other: 1 }, { mode: 'draft', localeCode: 'en' }),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'CONTENT_VALIDATION_FAILED',
          message: expect.stringContaining('title must be a string'),
          errors: expect.arrayContaining([expect.objectContaining({ rule: 'unknown_field' })]),
        },
      });
    });

    it('returns the normalized data when the payload is valid', async () => {
      const result = await gate.validatePayload(
        ct,
        { title: ' hi ' },
        { mode: 'draft', localeCode: 'en' },
      );
      expect(result.data).toEqual({ title: 'hi' });
    });
  });

  describe('assertStoredPublishable', () => {
    it('ignores empty placeholder locales when a populated one exists', async () => {
      await expect(
        gate.assertStoredPublishable(
          ct,
          entry([
            { localeCode: 'en', data: { title: 'ok' } },
            { localeCode: 'ar', data: {} },
          ]),
        ),
      ).resolves.toBeUndefined();
    });

    it('gates an entry whose only locale is empty', async () => {
      await expect(
        gate.assertStoredPublishable(ct, entry([{ localeCode: 'en', data: {} }])),
      ).rejects.toMatchObject({ status: 422, response: { code: 'CONTENT_SCHEMA_INVALID' } });
    });

    it('gates an entry with no locale rows at all', async () => {
      await expect(gate.assertStoredPublishable(ct, entry([]))).rejects.toMatchObject({
        status: 422,
      });
    });

    it('reports a populated locale that is missing a required field', async () => {
      await expect(
        gate.assertStoredPublishable(
          ct,
          entry([
            { localeCode: 'en', data: { title: 'ok' } },
            { localeCode: 'ar', data: { slug: 'x' } },
          ]),
        ),
      ).rejects.toMatchObject({
        response: { message: expect.stringContaining('title is required') },
      });
    });
  });

  describe('validateVersionSnapshot', () => {
    it('validates every locale in a multi-locale snapshot', async () => {
      await expect(
        gate.validateVersionSnapshot(
          ct,
          version({ localesData: { en: { data: { gone: 1 } } } }),
          'en',
        ),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'VERSION_INCOMPATIBLE_WITH_SCHEMA' },
      });
    });

    it('falls back to the primary locale for a legacy snapshot', async () => {
      const checks = await gate.validateVersionSnapshot(
        buildType([buildField({ id: 'f-s', name: 'slug', isUnique: true })]),
        version({ localesData: null, data: { slug: 'legacy' } }),
        'fr',
      );
      expect(checks).toEqual([{ fieldName: 'slug', localeCode: 'fr', value: 'legacy' }]);
    });

    it('does not enforce required fields when restoring a draft snapshot', async () => {
      await expect(
        gate.validateVersionSnapshot(ct, version({ localesData: { en: { data: {} } } }), 'en'),
      ).resolves.toEqual([]);
    });
  });
});
