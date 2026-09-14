/**
 * Widths {@link MediaProcessor} renders thumbnails at. The processor and the
 * purge both read this so a new size cannot be written without being cleaned up.
 */
export const THUMBNAIL_WIDTHS = [400, 800] as const;
export const MEDIA_VARIANTS = {
  thumbnail: { width: 320, height: 180 },
  card: { width: 640, height: 360 },
  hero: { width: 1280, height: 720 },
} as const;

/** Suffix {@link MediaProcessor.handleOptimize} appends to the uploaded key. */
const OPTIMIZED_SUFFIX = '.webp';

/**
 * Every object a media row can own, given the key it currently points at.
 *
 * Two background jobs write beside the uploaded object and neither records what
 * it wrote: `optimize` uploads `<key>.webp` and repoints the row at it, leaving
 * the original behind, and `thumbnail` writes `thumbs/<width>/<key>` under the
 * *uploaded* key. Deleting only `storageKey` therefore leaks up to three objects
 * per file, so the purge reconstructs the set instead.
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
  for (const name of Object.keys(MEDIA_VARIANTS)) {
    keys.add(variantStorageKey(name, uploadedKey));
  }
  return [...keys];
}

export function variantStorageKey(name: string, storageKey: string): string {
  const uploadedKey = storageKey.endsWith(OPTIMIZED_SUFFIX)
    ? storageKey.slice(0, -OPTIMIZED_SUFFIX.length)
    : storageKey;
  return `variants/${name}/${uploadedKey}.webp`;
}
