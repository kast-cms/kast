import { ContentFieldType } from '@prisma/client';
import { toEntryDetail, toEntrySummary } from './content.presenter';
import type { EntryWithLocale } from './content.repository';
import { buildField } from './validation/test-fixtures';

function buildEntry(over: Partial<EntryWithLocale> = {}): EntryWithLocale {
  return {
    id: 'e1',
    contentTypeId: 'ct1',
    status: 'DRAFT',
    publishedAt: null,
    scheduledAt: null,
    trashedAt: null,
    isAiGenerated: false,
    createdById: 'u1',
    createdBy: { id: 'u1', firstName: 'Ada', lastName: 'Lovelace' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    locales: [
      {
        id: 'l-en',
        entryId: 'e1',
        localeCode: 'en',
        slug: 'hello',
        data: { title: 'Hello' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
      {
        id: 'l-ar',
        entryId: 'e1',
        localeCode: 'ar',
        slug: 'مرحبا',
        data: { title: 'مرحبا' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
    ],
    ...over,
  } as unknown as EntryWithLocale;
}

describe('content presenter', () => {
  describe('toEntryDetail', () => {
    it('flattens the first locale onto the entry and keeps every translation', () => {
      const detail = toEntryDetail(buildEntry());
      expect(detail).toMatchObject({
        id: 'e1',
        locale: 'en',
        slug: 'hello',
        data: { title: 'Hello' },
        authorId: 'u1',
        authorName: 'Ada Lovelace',
      });
      expect(detail.locales).toHaveLength(2);
    });

    it('flattens the requested locale when the entry has it', () => {
      expect(toEntryDetail(buildEntry(), 'ar')).toMatchObject({
        locale: 'ar',
        slug: 'مرحبا',
        data: { title: 'مرحبا' },
      });
    });

    it('falls back to the stored locale when the requested one is absent', () => {
      expect(toEntryDetail(buildEntry(), 'fr')).toMatchObject({ locale: 'en' });
    });

    it('reports null rather than throwing for an entry with no locale row', () => {
      const detail = toEntryDetail(buildEntry({ locales: [] }));
      expect(detail).toMatchObject({ locale: null, slug: null, data: {} });
    });

    it('reports a null author name when the row was not loaded', () => {
      expect(toEntryDetail(buildEntry({ createdBy: null })).authorName).toBeNull();
    });
  });

  describe('toEntrySummary', () => {
    const fields = [
      buildField({ id: 'f-body', name: 'body', type: ContentFieldType.RICH_TEXT }),
      buildField({ id: 'f-title', name: 'title', type: ContentFieldType.TEXT }),
    ];

    it('takes titleField from the first TEXT field of the active locale', () => {
      expect(toEntrySummary(buildEntry(), fields).titleField).toBe('Hello');
      expect(toEntrySummary(buildEntry(), fields, 'ar').titleField).toBe('مرحبا');
    });

    it('is null when the type has no TEXT field or the value is not a string', () => {
      const richTextOnly = fields.filter((f) => f.type === ContentFieldType.RICH_TEXT);
      expect(toEntrySummary(buildEntry(), richTextOnly).titleField).toBeNull();
      const numeric = buildEntry({
        locales: [{ localeCode: 'en', slug: 's', data: { title: 7 } }],
      } as unknown as Partial<EntryWithLocale>);
      expect(toEntrySummary(numeric, fields).titleField).toBeNull();
    });
  });
});
