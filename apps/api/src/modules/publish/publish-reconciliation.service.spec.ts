import type { PrismaService } from '../../prisma/prisma.service';
import { PublishReconciliationService } from './publish-reconciliation.service';

interface TxMock {
  $queryRaw: jest.Mock;
  contentEntry: { findMany: jest.Mock; updateMany: jest.Mock };
}

function buildTx(locked: boolean, due: Array<{ id: string }>): TxMock {
  return {
    $queryRaw: jest.fn(async () => [{ locked }]),
    contentEntry: {
      findMany: jest.fn(async () => due),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
}

function buildService(tx: TxMock): PublishReconciliationService {
  const prisma = {
    $transaction: (fn: (client: unknown) => Promise<number>) => fn(tx),
  } as unknown as PrismaService;
  return new PublishReconciliationService(prisma);
}

describe('PublishReconciliationService (SEC-13 / OPS-11)', () => {
  it('publishes every entry whose schedule is due', async () => {
    const tx = buildTx(true, [{ id: 'e1' }, { id: 'e2' }]);

    await expect(buildService(tx).publishDueEntries()).resolves.toBe(2);
    expect(tx.contentEntry.updateMany).toHaveBeenCalledTimes(2);
  });

  it('re-checks the status in the update so a concurrent publish cannot double-fire', async () => {
    const tx = buildTx(true, [{ id: 'e1' }]);

    await buildService(tx).publishDueEntries();

    const [args] = tx.contentEntry.updateMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({ id: 'e1', status: 'SCHEDULED', trashedAt: null });
  });

  it('skips the tick entirely when another replica holds the advisory lock', async () => {
    const tx = buildTx(false, [{ id: 'e1' }]);

    await expect(buildService(tx).publishDueEntries()).resolves.toBe(0);
    expect(tx.contentEntry.findMany).not.toHaveBeenCalled();
    expect(tx.contentEntry.updateMany).not.toHaveBeenCalled();
  });

  it('takes the lock before reading, so a losing replica does no work at all', async () => {
    const tx = buildTx(true, []);

    await buildService(tx).publishDueEntries();

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0] as number;
    const readOrder = tx.contentEntry.findMany.mock.invocationCallOrder[0] as number;
    expect(lockOrder).toBeLessThan(readOrder);
  });
});
