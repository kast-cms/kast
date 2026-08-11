import type { Job } from 'bullmq';
import type { TrashPurgeSummary } from './dto/trash-query.dto';
import { TrashProcessor } from './trash.processor';
import type { TrashService } from './trash.service';

function summary(): TrashPurgeSummary {
  return {
    cutoff: new Date('2026-04-01T00:00:00.000Z'),
    models: {
      content: { deleted: 2, failed: 0 },
      media: { deleted: 1, failed: 0 },
      user: { deleted: 0, failed: 1 },
      form: { deleted: 3, failed: 0 },
    },
  };
}

describe('TrashProcessor', () => {
  let trash: { purgeExpired: jest.Mock };
  let processor: TrashProcessor;

  beforeEach(() => {
    trash = { purgeExpired: jest.fn().mockResolvedValue(summary()) };
    processor = new TrashProcessor(trash as unknown as TrashService);
  });

  it('purges every trashable model on the scheduled job', async () => {
    await processor.process({ name: 'permanent-delete' } as Job);

    expect(trash.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('ignores a job it does not own', async () => {
    await processor.process({ name: 'something-else' } as Job);

    expect(trash.purgeExpired).not.toHaveBeenCalled();
  });
});
