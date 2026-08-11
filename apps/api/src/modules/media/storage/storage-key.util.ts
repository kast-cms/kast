import { extname } from 'path';

const SAFE_EXTENSION = /^\.[A-Za-z0-9]{1,12}$/;

/**
 * Object keys are built from an uploader-supplied filename, so the extension is
 * attacker controlled. Anything outside a conservative alphanumeric form is
 * dropped rather than escaped: a key is later joined onto a filesystem path.
 */
export function safeExtension(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  return SAFE_EXTENSION.test(ext) ? ext : '';
}

/**
 * Accepts only the shape this module generates: slash-separated segments with
 * no traversal, no dotfiles, no backslashes and no NUL. Percent-decoding happens
 * before routing, so `..%2f` arrives here as a literal `../` and is rejected.
 */
export function isSafeObjectKey(key: string): boolean {
  if (key.length === 0 || key.length > 512) return false;
  if (key.includes('\0') || key.includes('\\')) return false;
  return key
    .split('/')
    .every((segment) => segment.length > 0 && !segment.startsWith('.') && segment !== '..');
}
