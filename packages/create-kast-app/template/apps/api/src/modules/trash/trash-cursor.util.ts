import { BadRequestException } from '@nestjs/common';

export interface TrashCursor {
  trashedAt: Date;
  id: string;
}

/**
 * The listing merges four tables, so the cursor cannot be a row id: it has to
 * carry the sort key itself (`trashedAt`, then `id` as the tiebreak).
 */
export function encodeTrashCursor(cursor: TrashCursor): string {
  return Buffer.from(`${cursor.trashedAt.toISOString()}|${cursor.id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeTrashCursor(raw: string | undefined): TrashCursor | undefined {
  if (raw === undefined || raw === '') return undefined;
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separator = decoded.indexOf('|');
  if (separator === -1) throw new BadRequestException('Invalid trash cursor');
  const trashedAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (Number.isNaN(trashedAt.getTime()) || id === '') {
    throw new BadRequestException('Invalid trash cursor');
  }
  return { trashedAt, id };
}
