import type { ContentStatus } from '@prisma/client';
import type { ValidationMode } from './content-validation.types';

/**
 * Statuses whose stored data is served publicly. SCHEDULED counts because the
 * publish worker promotes it without re-checking the payload.
 */
export const PUBLIC_STATUSES: ReadonlySet<ContentStatus> = new Set<ContentStatus>([
  'PUBLISHED',
  'SCHEDULED',
]);

/**
 * The bar a write has to clear, derived from where the entry ends up. The stored
 * status is the floor: a request that names no status, or names one on a path that
 * cannot change it, still faces publish rules on live content. Only a request that
 * actually moves the entry out of a public status may fall back to draft rules.
 */
export function resolveValidationMode(
  storedStatus: ContentStatus,
  requestedStatus?: ContentStatus | null,
): ValidationMode {
  return PUBLIC_STATUSES.has(requestedStatus ?? storedStatus) ? 'publish' : 'draft';
}
