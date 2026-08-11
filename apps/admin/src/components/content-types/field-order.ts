import type { ContentField } from '@kast-cms/sdk';

/** The list renders in `position` order, which is what the API stores. */
export function sortFieldsByPosition(fields: readonly ContentField[]): ContentField[] {
  return [...fields].sort((a, b) => a.position - b.position);
}

/**
 * Moves `activeName` into `overName`'s slot and renumbers `position` to match.
 *
 * Renumbering is what makes the optimistic update stick: the rendered list sorts
 * by `position`, so carrying the old numbers forward re-sorts the new array
 * straight back to the old order while the API stores the new one. The next drag
 * would then compute its indices against a list the user is not looking at.
 *
 * Returns null when the drag changes nothing.
 */
export function reorderFieldsForDrag(
  fields: readonly ContentField[],
  activeName: string,
  overName: string,
): ContentField[] | null {
  const sorted = sortFieldsByPosition(fields);
  const oldIndex = sorted.findIndex((f) => f.name === activeName);
  const newIndex = sorted.findIndex((f) => f.name === overName);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;

  const moved = sorted[oldIndex];
  if (moved === undefined) return null;
  sorted.splice(oldIndex, 1);
  sorted.splice(newIndex, 0, moved);
  return sorted.map((field, index) => ({ ...field, position: index }));
}
