/** How long a soft-deleted record stays recoverable before the purge job removes it. */
export const TRASH_RETENTION_DAYS = 30;

export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
