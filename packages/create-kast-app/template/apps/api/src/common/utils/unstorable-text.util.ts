/**
 * Characters Postgres cannot store in a `jsonb` column.
 *
 * NUL and the other C0 controls are rejected outright ("unsupported Unicode
 * escape sequence ... cannot be converted to text"), and an unpaired surrogate
 * is not valid UTF-8. Prisma surfaces both as PrismaClientUnknownRequestError,
 * which the global exception filter does not special-case — so without this
 * check the request becomes a 500 plus a Sentry event instead of the 400 the
 * validation layer exists to produce.
 *
 * TAB (09), LF (0a) and CR (0d) are deliberately allowed: they are legitimate
 * inside a textarea and Postgres stores them fine.
 */
export const UNSTORABLE_TEXT =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Guards against a pathological nesting depth; content bounds are checked separately. */
const MAX_SCAN_DEPTH = 20;

/**
 * True if any string anywhere in `value` cannot be stored.
 *
 * Walks arrays and plain objects because a JSON, COMPONENT or BLOCK field
 * carries attacker-supplied strings arbitrarily deep. Object KEYS are checked
 * as well as values — a key is stored in the same column and fails identically.
 */
export function hasUnstorableText(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return UNSTORABLE_TEXT.test(value);
  if (depth >= MAX_SCAN_DEPTH) return false;
  if (Array.isArray(value)) return value.some((item) => hasUnstorableText(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, item]) => UNSTORABLE_TEXT.test(key) || hasUnstorableText(item, depth + 1),
    );
  }
  return false;
}
