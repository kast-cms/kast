import { TRASH_RETENTION_MS } from './trash.constants';

export interface RankedTrashItem<T> {
  item: T;
  trashedAt: Date;
}

export function daysUntilDeletion(trashedAt: Date): number {
  const deletionDate = new Date(trashedAt.getTime() + TRASH_RETENTION_MS);
  return Math.max(0, Math.ceil((deletionDate.getTime() - Date.now()) / 86_400_000));
}

/** Newest first, with `id` as the tiebreak the keyset predicate also uses. */
export function byTrashedAtDesc<T extends { id: string }>(
  a: RankedTrashItem<T>,
  b: RankedTrashItem<T>,
): number {
  const diff = b.trashedAt.getTime() - a.trashedAt.getTime();
  return diff === 0 ? b.item.id.localeCompare(a.item.id) : diff;
}
