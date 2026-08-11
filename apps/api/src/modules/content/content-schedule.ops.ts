import { BadRequestException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import type { PublishJobData } from '../publish/publish.processor';
import { assertApplied } from './content-entry.helpers';
import type { ContentRepository, EntryWithLocale } from './content.repository';
import type { ContentWriteGate } from './validation/content-write.gate';

function jobId(entryId: string): string {
  return `publish-${entryId}`;
}

/**
 * Queues a delayed publish and marks the entry SCHEDULED. The schema gate runs
 * here rather than at fire time because the worker flips the status directly.
 */
export async function scheduleEntryPublish(
  repo: ContentRepository,
  gate: ContentWriteGate,
  queue: Queue<PublishJobData>,
  ct: ContentTypeWithFields,
  entry: EntryWithLocale,
  typeSlug: string,
  publishAtRaw: string,
): Promise<void> {
  const publishAt = new Date(publishAtRaw);
  if (publishAt <= new Date()) {
    throw new BadRequestException('publishAt must be in the future');
  }
  await gate.assertStoredPublishable(ct, entry);
  const delay = publishAt.getTime() - Date.now();
  await queue.add('publish', { entryId: entry.id, typeSlug }, { delay, jobId: jobId(entry.id) });
  assertApplied(await repo.updateSchedule(entry.id, ct.id, publishAt, 'SCHEDULED'), entry.id);
}

export async function cancelEntrySchedule(
  repo: ContentRepository,
  queue: Queue<PublishJobData>,
  contentTypeId: string,
  entryId: string,
): Promise<void> {
  const job = await queue.getJob(jobId(entryId));
  await job?.remove();
  assertApplied(await repo.updateSchedule(entryId, contentTypeId, null, 'DRAFT'), entryId);
}
