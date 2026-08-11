import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { runBulkEntryAction } from './content-bulk.ops';

describe('runBulkEntryAction', () => {
  it('reports every id it was given', async () => {
    const outcome = await runBulkEntryAction(['a', 'b'], () => Promise.resolve());
    expect(outcome).toEqual({
      results: [
        { id: 'a', ok: true },
        { id: 'b', ok: true },
      ],
      succeeded: 2,
      failed: 0,
    });
  });

  it('keeps going after a per-item failure and does not undo the successes', async () => {
    const applied: string[] = [];
    const outcome = await runBulkEntryAction(['a', 'b', 'c'], (id) => {
      if (id === 'b') return Promise.reject(new NotFoundException('Content entry b not found'));
      applied.push(id);
      return Promise.resolve();
    });

    expect(applied).toEqual(['a', 'c']);
    expect(outcome.succeeded).toBe(2);
    expect(outcome.failed).toBe(1);
    expect(outcome.results[1]).toEqual({
      id: 'b',
      ok: false,
      error: { status: 404, code: 'NOT_FOUND', message: 'Content entry b not found' },
    });
  });

  it('carries the gate code an entry was rejected with', async () => {
    const outcome = await runBulkEntryAction(['a'], () =>
      Promise.reject(
        new UnprocessableEntityException({
          message: 'Publish blocked by SEO errors',
          code: 'SEO_VALIDATION_FAILED',
        }),
      ),
    );
    expect(outcome.results[0]?.error).toEqual({
      status: 422,
      code: 'SEO_VALIDATION_FAILED',
      message: 'Publish blocked by SEO errors',
    });
  });

  it('applies a repeated id only once', async () => {
    const action = jest.fn().mockResolvedValue(undefined);
    const outcome = await runBulkEntryAction(['a', 'a', 'b'], action);
    expect(action).toHaveBeenCalledTimes(2);
    expect(outcome.results).toHaveLength(2);
  });

  it('aborts on a failure that is not an HTTP rejection', async () => {
    const boom = new Error('connection lost');
    await expect(
      runBulkEntryAction(['a', 'b'], (id) =>
        id === 'a' ? Promise.reject(boom) : Promise.resolve(),
      ),
    ).rejects.toBe(boom);
  });

  it('falls back to the status when the exception body carries no code', async () => {
    const outcome = await runBulkEntryAction(['a'], () =>
      Promise.reject(new ConflictException('already used')),
    );
    expect(outcome.results[0]?.error).toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});
