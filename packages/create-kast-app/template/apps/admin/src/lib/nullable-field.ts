/**
 * A nullable column has three request states, not two: an absent key leaves the
 * stored value alone, `null` clears it, and a string replaces it. Dropping a
 * blank input from the body therefore keeps the old value — the user clears the
 * field, the save returns 200, and the previous address/name/URL stays live.
 */
export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * `blankToNull` for the SDK request bodies.
 *
 * This used to carry a `as unknown as string` cast because the SDK typed these
 * fields as `string`. The SDK now declares the nullable ones as `string | null`,
 * so the cast is gone and TypeScript checks these call sites for real: passing
 * `clearable(...)` to a field the SDK has NOT widened is now a compile error,
 * which is the correct signal — that field cannot be cleared over the API.
 */
export const clearable = blankToNull;
