/**
 * Route that serves objects held by {@link LocalStorageAdapter}. The controller
 * path and the URL LocalStorageAdapter hands out have to agree, so both read it
 * from here.
 */
export const LOCAL_MEDIA_ROUTE_PATH = 'media/files';
export const LOCAL_MEDIA_URL_PATH = `/api/v1/${LOCAL_MEDIA_ROUTE_PATH}`;

/**
 * Types a browser may render in place. Everything else is served as an
 * attachment: an inline SVG or HTML document would run script in the API's
 * origin, and nothing in this repo sanitises uploaded markup.
 */
const INLINE_SAFE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
]);

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

/** Resolves a served object's content type from its key, never from the client. */
export function mimeTypeForKey(key: string): string {
  const dot = key.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  return EXTENSION_MIME_TYPES[key.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

export function isInlineSafeMimeType(mimeType: string): boolean {
  return INLINE_SAFE_MIME_TYPES.has(mimeType);
}

/** RFC 6266 header value; the filename is reduced to a quote-safe ASCII subset. */
export function contentDispositionFor(key: string, mimeType: string): string {
  const kind = isInlineSafeMimeType(mimeType) ? 'inline' : 'attachment';
  const base = key.split('/').pop() ?? 'download';
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 128) || 'download';
  return `${kind}; filename="${safe}"`;
}
