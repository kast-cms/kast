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
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'e1' }),
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
      contentEntryVersion: { findFirst: jest.fn(), create: jest.fn() },
    };
    repo = new ContentRepository(prisma as unknown as PrismaService);
  });

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
      ['trash', (r: ContentRepository) => r.trash('e1', 'ct1')],
    ])('%s scopes the write to the content type', async (_name, call) => {
      await call(repo);
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
});
