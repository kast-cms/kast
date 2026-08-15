/**
 * Widths {@link MediaProcessor} renders thumbnails at. The processor and the
 * purge both read this so a new size cannot be written without being cleaned up.
 */
export const THUMBNAIL_WIDTHS = [400, 800] as const;

/** Suffix {@link MediaProcessor.handleOptimize} appends to the uploaded key. */
const OPTIMIZED_SUFFIX = '.webp';

/**
 * Every object a media row can own, given the key it currently points at.
 *
 * The `derive` job writes beside the uploaded object without recording what it
 * wrote: it uploads `<key>.webp`, repoints the row at it, and writes
 * `thumbs/<width>/<key>` under the *uploaded* key. Deleting only `storageKey`
 * would therefore leak the thumbnails, so the purge reconstructs the set.
 *
 * The uploaded key stays in the set even though `derive` now reclaims it: rows
 * written before that change still hold an original, and a derive that crashed
 * between upload and delete leaves one too.
 *
 * Reconstruction over-approximates by design: a file uploaded as `.webp` yields
 * a base key that was never written. Deletes are best-effort and a missing key
 * is a no-op, so guessing wide is safe while guessing narrow leaks bytes.
 */
export function derivedStorageKeys(storageKey: string): string[] {
  const uploadedKey = storageKey.endsWith(OPTIMIZED_SUFFIX)
    ? storageKey.slice(0, -OPTIMIZED_SUFFIX.length)
    : storageKey;

  const keys = new Set<string>([storageKey, uploadedKey]);
  for (const width of THUMBNAIL_WIDTHS) {
    keys.add(`thumbs/${String(width)}/${uploadedKey}`);
  }
  return [...keys];
}
