/** One issue from the API's SEO gate. Only warning-tier issues are overridable. */
export interface SeoWarning {
  rule: string;
  message: string;
}

/**
 * Reads the `details` the API attaches to a SEO_VALIDATION_WARNINGS failure.
 *
 * `details` crosses the wire as `unknown`, so every shape has to be tolerated:
 * anything unrecognised yields an empty list and the dialog falls back to its
 * generic prompt, rather than rendering `[object Object]` at the user or
 * throwing inside an error handler.
 */
export function toSeoWarnings(details: unknown): SeoWarning[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((item) => {
    if (item === null || typeof item !== 'object') return [];
    const { rule, message } = item as Record<string, unknown>;
    return typeof message === 'string'
      ? [{ rule: typeof rule === 'string' ? rule : '', message }]
      : [];
  });
}
