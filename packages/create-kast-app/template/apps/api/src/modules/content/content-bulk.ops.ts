import { HttpException } from '@nestjs/common';

export interface BulkEntryFailure {
  status: number;
  code: string;
  message: string;
}

export interface BulkEntryResult {
  id: string;
  ok: boolean;
  error?: BulkEntryFailure;
}

export interface BulkEntryOutcome {
  results: BulkEntryResult[];
  succeeded: number;
  failed: number;
}

const STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
};

function toFailure(e: HttpException): BulkEntryFailure {
  const body = e.getResponse();
  const record = typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const status = e.getStatus();
  return {
    status,
    code: typeof record['code'] === 'string' ? record['code'] : (STATUS_CODES[status] ?? 'ERROR'),
    message: typeof record['message'] === 'string' ? record['message'] : e.message,
  };
}

/**
 * Runs a single-entry operation over a batch.
 *
 * Atomicity: none. Each id is applied on its own and reported on its own, so one
 * entry that fails its publish gate does not roll back the entries that passed —
 * the alternative would make a single unpublishable draft block a whole batch.
 * Callers get a per-item verdict and are expected to retry only the failures.
 * Ids are de-duplicated and processed in order; anything that is not an HTTP
 * failure (a lost connection, a bug) aborts the batch rather than being reported
 * as a per-item rejection.
 */
export async function runBulkEntryAction(
  ids: string[],
  action: (id: string) => Promise<unknown>,
): Promise<BulkEntryOutcome> {
  const results: BulkEntryResult[] = [];
  for (const id of [...new Set(ids)]) {
    try {
      await action(id);
      results.push({ id, ok: true });
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
      results.push({ id, ok: false, error: toFailure(e) });
    }
  }
  return {
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}
