import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { ContentRepository } from './content.repository';
import type { UniqueCheck } from './validation/content-validation.types';

function buildTx(): Record<string, jest.Mock | Record<string, jest.Mock>> {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([]),
    contentEntry: {
      create: jest.fn().mockResolvedValue({ id: 'e1' }),
      update: jest.fn().mockResolvedValue({ id: 'e1' }),
      findFirstOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'e1', locales: [{ slug: 'hello-world' }] }),
    },
    contentEntryVersion: {
      findFirst: jest.fn().mockResolvedValue({ versionNumber: 4 }),
      create: jest.fn().mockResolvedValue({ id: 'v1' }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    globalSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('ContentRepository', () => {
  let tx: ReturnType<typeof buildTx>;
  let prisma: Record<string, unknown>;
  let repo: ContentRepository;

  beforeEach(() => {
    tx = buildTx();
    prisma = {
      $transaction: jest.fn((cb: (client: unknown) => unknown) => cb(tx)),
      contentEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      contentEntryLocale: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      contentEntryVersion: { findFirst: jest.fn(), create: jest.fn() },
    };
    repo = new ContentRepository(prisma as unknown as PrismaService);
  });

  /** Reads a mocked delegate method off the prisma or transaction client stub. */
  const mockOf = (client: Record<string, unknown>, model: string, method: string): jest.Mock =>
    (client[model] as Record<string, jest.Mock>)[method] as jest.Mock;

  const entryModel = (): jest.Mock =>
    (prisma['contentEntry'] as Record<string, jest.Mock>)['findFirst'] as jest.Mock;
  const updateMany = (): jest.Mock =>
    (prisma['contentEntry'] as Record<string, jest.Mock>)['updateMany'] as jest.Mock;

  describe('content-type binding', () => {
    it('looks an entry up by id and content type together', async () => {
      await repo.findByIdForType('e1', 'ct1');
      expect(entryModel()).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', contentTypeId: 'ct1' } }),
      );
    });

    it.each([
      ['updateStatus', (r: ContentRepository) => r.updateStatus('e1', 'ct1', 'DRAFT')],
      ['updateSchedule', (r: ContentRepository) => r.updateSchedule('e1', 'ct1', null, 'DRAFT')],
    ])('%s scopes the write to the content type and skips trashed rows', async (_name, call) => {
      await call(repo);
      expect(updateMany()).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', contentTypeId: 'ct1', trashedAt: null } }),
      );
    });

    it('trash scopes the write to the content type', async () => {
      await repo.trash('e1', 'ct1');
      expect(updateMany()).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', contentTypeId: 'ct1' } }),
      );
    });

    it.each([
      ['updateStatus', (r: ContentRepository) => r.updateStatus('e1', 'other', 'DRAFT')],
      ['updateSchedule', (r: ContentRepository) => r.updateSchedule('e1', 'other', null, 'DRAFT')],
      ['trash', (r: ContentRepository) => r.trash('e1', 'other')],
    ])('%s reports no rows written when the type does not match', async (_name, call) => {
      updateMany().mockResolvedValue({ count: 0 });
      await expect(call(repo)).resolves.toBe(false);
    });

    it('re-asserts the binding inside the update transaction', async () => {
      await repo.update('e1', 'ct1', 'en', { title: 'x' });
      const entryTx = tx['contentEntry'] as Record<string, jest.Mock>;
      expect(entryTx['findFirstOrThrow']).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', contentTypeId: 'ct1' } }),
      );
    });
  });

  describe('unique field guard', () => {
    const checks: UniqueCheck[] = [{ fieldName: 'slug', localeCode: 'en', value: 'a' }];

    it('issues no raw SQL when there is nothing to check', async () => {
      await repo.create('ct1', {}, 'en', 'u', 's');
      expect(tx['$executeRaw']).not.toHaveBeenCalled();
      expect(tx['$queryRaw']).not.toHaveBeenCalled();
    });

    it('takes a transaction-scoped advisory lock before looking for a clash', async () => {
      await repo.create('ct1', { slug: 'a' }, 'en', 'u', 's', [], checks);
      const lockCall = (tx['$executeRaw'] as jest.Mock).mock.calls[0] as unknown[];
      expect(String(lockCall[0])).toContain('pg_advisory_xact_lock');
      expect(typeof lockCall[1]).toBe('bigint');
      expect(tx['$queryRaw']).toHaveBeenCalled();
      expect((tx['contentEntry'] as Record<string, jest.Mock>)['create']).toHaveBeenCalled();
    });

    it('rejects a clash with 409 and does not write', async () => {
      (tx['$queryRaw'] as jest.Mock).mockResolvedValue([{ entryId: 'other' }]);
      await expect(repo.create('ct1', { slug: 'a' }, 'en', 'u', 's', [], checks)).rejects.toThrow(
        ConflictException,
      );
      expect((tx['contentEntry'] as Record<string, jest.Mock>)['create']).not.toHaveBeenCalled();
    });

    it('excludes the entry itself when updating', async () => {
      await repo.update('e1', 'ct1', 'en', { slug: 'a' }, checks);
      const args = (tx['$queryRaw'] as jest.Mock).mock.calls[0] as unknown[];
      expect(args).toContain('e1');
    });

    it('writes a supplied slug on both branches of the locale upsert', async () => {
      await repo.update('e1', 'ct1', 'en', { title: 'x' }, [], 'new-slug');
      const args = mockOf(tx, 'contentEntry', 'update').mock.calls[0]?.[0] as {
        data: { locales: { upsert: { create: { slug: string }; update: { slug?: string } } } };
      };
      expect(args.data.locales.upsert.create.slug).toBe('new-slug');
      expect(args.data.locales.upsert.update.slug).toBe('new-slug');
    });

    it('leaves the stored slug alone when none is supplied', async () => {
      await repo.update('e1', 'ct1', 'en', { title: 'x' });
      const args = mockOf(tx, 'contentEntry', 'update').mock.calls[0]?.[0] as {
        data: { locales: { upsert: { update: Record<string, unknown> } } };
      };
      expect(args.data.locales.upsert.update).not.toHaveProperty('slug');
    });

    // (localeCode, slug) is unique across the whole install, so a create branch
    // defaulting to the locale code gives the first translation the slug "ar"
    // and 409s every entry translated after it.
    it('derives the slug of a locale row it creates from the entry, not the locale code', async () => {
      await repo.update('e1', 'ct1', 'ar', { title: 'مرحبا' });
      const args = mockOf(tx, 'contentEntry', 'update').mock.calls[0]?.[0] as {
        data: { locales: { upsert: { create: { slug: string } } } };
      };
      expect(args.data.locales.upsert.create.slug).toBe('hello-world-ar');
    });

    it('generates a unique slug when the entry has no locale to derive from', async () => {
      mockOf(tx, 'contentEntry', 'findFirstOrThrow').mockResolvedValue({ id: 'e1', locales: [] });

      await repo.update('e1', 'ct1', 'ar', { title: 'مرحبا' });
      const args = mockOf(tx, 'contentEntry', 'update').mock.calls[0]?.[0] as {
        data: { locales: { upsert: { create: { slug: string } } } };
      };
      expect(args.data.locales.upsert.create.slug).toMatch(/^ar-[0-9a-f]{12}$/);
    });

    it('locks in a stable order regardless of the order the checks arrive in', async () => {
      const a: UniqueCheck = { fieldName: 'slug', localeCode: 'en', value: 'a' };
      const b: UniqueCheck = { fieldName: 'sku', localeCode: 'en', value: 'b' };

      await repo.create('ct1', {}, 'en', 'u', 's', [], [a, b]);
      const first = (tx['$executeRaw'] as jest.Mock).mock.calls.map((c) => (c as unknown[])[1]);

      tx = buildTx();
      (prisma['$transaction'] as jest.Mock).mockImplementation((cb: (c: unknown) => unknown) =>
        cb(tx),
      );
      await repo.create('ct1', {}, 'en', 'u', 's', [], [b, a]);
      const second = (tx['$executeRaw'] as jest.Mock).mock.calls.map((c) => (c as unknown[])[1]);

      expect(first).toHaveLength(2);
      expect(second).toEqual(first);
    });
  });

  describe('slug-only write', () => {
    it('rewrites one locale slug and reports whether a row was touched', async () => {
      mockOf(prisma, 'contentEntry', 'findFirst').mockResolvedValue({ id: 'e1' });

      await expect(repo.updateSlug('e1', 'ct1', 'en', 'new-slug')).resolves.toBe(true);
      expect(mockOf(prisma, 'contentEntryLocale', 'updateMany')).toHaveBeenCalledWith({
        where: { entryId: 'e1', localeCode: 'en' },
        data: { slug: 'new-slug' },
      });
    });

    it('refuses to write when the entry belongs to another content type', async () => {
      mockOf(prisma, 'contentEntry', 'findFirst').mockResolvedValue(null);

      await expect(repo.updateSlug('e1', 'other', 'en', 'new-slug')).resolves.toBe(false);
      expect(mockOf(prisma, 'contentEntryLocale', 'updateMany')).not.toHaveBeenCalled();
    });

    it('reports false when the entry has no row for that locale', async () => {
      mockOf(prisma, 'contentEntry', 'findFirst').mockResolvedValue({ id: 'e1' });
      mockOf(prisma, 'contentEntryLocale', 'updateMany').mockResolvedValue({ count: 0 });

      await expect(repo.updateSlug('e1', 'ct1', 'fr', 'new-slug')).resolves.toBe(false);
    });
  });

  describe('version numbering (CON-05)', () => {
    it('allocates the next number inside the transaction, behind an entry lock', async () => {
      await repo.createVersion('e1', { title: 'x' }, {}, 'u1', 'DRAFT');

      const lockCall = (tx['$executeRaw'] as jest.Mock).mock.calls[0] as unknown[];
      expect(String(lockCall[0])).toContain('pg_advisory_xact_lock');
      expect(typeof lockCall[1]).toBe('bigint');

      // Read and write are in one transaction: the read outside it let two
      // concurrent updates both see version N and collide on (entryId, versionNumber).
      expect(mockOf(tx, 'contentEntryVersion', 'findFirst')).toHaveBeenCalled();
      expect(mockOf(tx, 'contentEntryVersion', 'create')).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 5 }) }),
      );
      expect(mockOf(prisma, 'contentEntryVersion', 'findFirst')).not.toHaveBeenCalled();
    });

    it('starts at 1 for an entry that has no versions yet', async () => {
      mockOf(tx, 'contentEntryVersion', 'findFirst').mockResolvedValue(null);

      await repo.createVersion('e1', {}, {}, 'u1', 'DRAFT');

      expect(mockOf(tx, 'contentEntryVersion', 'create')).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1 }) }),
      );
    });

    it('takes the same lock for the same entry and a different one for another', async () => {
      await repo.createVersion('e1', {}, {}, 'u1', 'DRAFT');
      await repo.createVersion('e1', {}, {}, 'u1', 'DRAFT');
      await repo.createVersion('e2', {}, {}, 'u1', 'DRAFT');
      const keys = (tx['$executeRaw'] as jest.Mock).mock.calls.map((c) => (c as unknown[])[1]);
      expect(keys[0]).toBe(keys[1]);
      expect(keys[2]).not.toBe(keys[0]);
    });
  });
});
