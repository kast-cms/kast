import { describe, expect, it } from '@/test/jest-globals';
import type { ContentField } from '@kast-cms/sdk';
import { reorderFieldsForDrag, sortFieldsByPosition } from './field-order';

function field(name: string, position: number): ContentField {
  return {
    id: `f-${name}`,
    name,
    displayName: name.toUpperCase(),
    type: 'TEXT',
    isRequired: false,
    isLocalized: false,
    isUnique: false,
    isHidden: false,
    position,
    config: {},
    defaultValue: null,
  };
}

const names = (fields: readonly ContentField[]): string[] =>
  sortFieldsByPosition(fields).map((f) => f.name);

describe('reorderFieldsForDrag', () => {
  it('renumbers position so the optimistic order survives the render sort', () => {
    const fields = [field('a', 0), field('b', 1), field('c', 2)];

    const reordered = reorderFieldsForDrag(fields, 'a', 'c');

    // Carrying the old positions forward rendered a,b,c again while the API
    // stored b,c,a — the drag snapped back and the two disagreed from then on.
    expect(reordered?.map((f) => f.position)).toEqual([0, 1, 2]);
    expect(names(reordered ?? [])).toEqual(['b', 'c', 'a']);
  });

  it('reads the drag against the rendered order, so a second drag lands where the user aimed', () => {
    const first = reorderFieldsForDrag([field('a', 0), field('b', 1), field('c', 2)], 'a', 'c');

    // The user now sees b,c,a and drags b onto c, intending c,b,a.
    const second = reorderFieldsForDrag(first ?? [], 'b', 'c');

    expect(names(second ?? [])).toEqual(['c', 'b', 'a']);
  });

  it('ignores a drag that changes nothing', () => {
    const fields = [field('a', 0), field('b', 1)];

    expect(reorderFieldsForDrag(fields, 'a', 'a')).toBeNull();
    expect(reorderFieldsForDrag(fields, 'a', 'ghost')).toBeNull();
  });

  it('orders by position rather than by array order', () => {
    const fields = [field('c', 2), field('a', 0), field('b', 1)];

    const reordered = reorderFieldsForDrag(fields, 'c', 'a');

    expect(names(reordered ?? [])).toEqual(['c', 'a', 'b']);
  });
});
