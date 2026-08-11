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

/**
 * The sample content shipped with the local stack is written straight through
 * Prisma and therefore never passed the validator. These cases pin the exact
 * stored shapes so a schema rule can never make the seeded site unpublishable.
 */
const BLOG_POST = buildType(
  [
    buildField({ name: 'title', type: ContentFieldType.TEXT, isRequired: true, isLocalized: true }),
    buildField({ name: 'slug', type: ContentFieldType.TEXT, isRequired: true, isUnique: true }),
    buildField({ name: 'excerpt', type: ContentFieldType.TEXT, isLocalized: true }),
    buildField({
      name: 'body',
      type: ContentFieldType.RICH_TEXT,
      isRequired: true,
      isLocalized: true,
    }),
    buildField({ name: 'coverImage', type: ContentFieldType.URL }),
    buildField({ name: 'publishedAt', type: ContentFieldType.DATE }),
    buildField({ name: 'author', type: ContentFieldType.TEXT }),
    buildField({ name: 'category', type: ContentFieldType.TEXT }),
    buildField({ name: 'tags', type: ContentFieldType.JSON }),
    buildField({ name: 'readTimeMinutes', type: ContentFieldType.NUMBER }),
  ],
  { id: 'ct-blog-post', name: 'blog-post' },
);

const BLOG_CATEGORY = buildType(
  [
    buildField({ name: 'name', type: ContentFieldType.TEXT, isRequired: true }),
    buildField({ name: 'slug', type: ContentFieldType.TEXT, isRequired: true, isUnique: true }),
    buildField({ name: 'description', type: ContentFieldType.TEXT }),
  ],
  { id: 'ct-blog-category', name: 'blog-category' },
);

const SEEDED_POST = {
  body: '<p>Entries move through a simple lifecycle: <em>draft → published</em>.</p><ul><li>Create a draft</li></ul>',
  slug: 'publishing-workflows',
  tags: ['workflow', 'publishing'],
  title: 'Publishing Workflows for Small Teams',
  author: 'Kast Writer',
  excerpt: 'Draft, publish, schedule, archive — a tour of the entry lifecycle.',
  category: 'engineering',
  publishedAt: '2026-08-10T11:00:00.000Z',
  readTimeMinutes: 5,
};

const SEEDED_CATEGORY = {
  name: 'Engineering',
  slug: 'engineering',
  description: 'Deep dives into how we build software.',
};

describe('seeded sample content', () => {
  let validator: ContentSchemaValidator;

  beforeEach(() => {
    clearSchemaCache();
    validator = new ContentSchemaValidator({
      findLiveMedia: jest.fn().mockResolvedValue(new Map()),
      findLiveEntryTypes: jest.fn().mockResolvedValue(new Map()),
      findContentTypeIdsByName: jest.fn().mockResolvedValue(new Map()),
    } as unknown as ContentValidationRepository);
  });

  it.each(['draft', 'publish'] as const)('validates a blog-post entry in %s mode', async (mode) => {
    const result = await validator.validate(BLOG_POST, SEEDED_POST, { mode, localeCode: 'en' });
    expect(result.issues).toEqual([]);
    expect(result.data['publishedAt']).toBe('2026-08-10T11:00:00.000Z');
    expect(result.data['tags']).toEqual(['workflow', 'publishing']);
    expect(result.data['readTimeMinutes']).toBe(5);
    expect(result.uniqueChecks).toEqual([
      { fieldName: 'slug', localeCode: 'en', value: 'publishing-workflows' },
    ]);
  });

  it.each(['draft', 'publish'] as const)(
    'validates a blog-category entry in %s mode',
    async (mode) => {
      const result = await validator.validate(BLOG_CATEGORY, SEEDED_CATEGORY, {
        mode,
        localeCode: 'en',
      });
      expect(result.issues).toEqual([]);
      expect(result.data).toEqual(SEEDED_CATEGORY);
    },
  );

  it('accepts a blog-post payload carrying the admin _seo block', async () => {
    const result = await validator.validate(
      BLOG_POST,
      {
        ...SEEDED_POST,
        _seo: { metaTitle: 'x', metaDescription: '', canonicalUrl: '', ogImage: '' },
      },
      { mode: 'publish', localeCode: 'en' },
    );
    expect(result.issues).toEqual([]);
  });

  it('accepts the near-empty payload the admin autosaves for a new draft', async () => {
    const result = await validator.validate(
      BLOG_POST,
      { _seo: { metaTitle: '', metaDescription: '', canonicalUrl: '', ogImage: '' } },
      { mode: 'draft', localeCode: 'en' },
    );
    expect(result.issues).toEqual([]);
  });

  it('still refuses to publish that near-empty draft', async () => {
    const result = await validator.validate(BLOG_POST, {}, { mode: 'publish', localeCode: 'en' });
    expect(result.issues.map((i) => i.field).sort()).toEqual(['body', 'slug', 'title']);
  });
});
