import { BadRequestException } from '@nestjs/common';
import { decodeTrashCursor, encodeTrashCursor } from './trash-cursor.util';

describe('trash cursor', () => {
  it('round-trips the sort key it was built from', () => {
    const cursor = { trashedAt: new Date('2026-04-01T10:20:30.123Z'), id: 'ckabc123' };

    expect(decodeTrashCursor(encodeTrashCursor(cursor))).toEqual(cursor);
  });

  it('treats a missing cursor as the first page', () => {
    expect(decodeTrashCursor(undefined)).toBeUndefined();
    expect(decodeTrashCursor('')).toBeUndefined();
  });

  it.each([
    ['a bare row id', Buffer.from('ckabc123', 'utf8').toString('base64url')],
    ['an unparseable timestamp', Buffer.from('yesterday|ckabc123', 'utf8').toString('base64url')],
    ['a missing id', Buffer.from('2026-04-01T00:00:00.000Z|', 'utf8').toString('base64url')],
  ])('rejects %s', (_label, raw) => {
    expect(() => decodeTrashCursor(raw)).toThrow(BadRequestException);
  });
});
