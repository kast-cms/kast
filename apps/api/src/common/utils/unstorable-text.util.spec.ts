import { hasUnstorableText, UNSTORABLE_TEXT } from './unstorable-text.util';

describe('hasUnstorableText', () => {
  it('catches the NUL byte a jsonb column rejects', () => {
    // Written the way it actually arrives: parsed from a JSON escape.
    const parsed = JSON.parse('{"message":"hello\\u0000world"}') as { message: string };

    expect(hasUnstorableText(parsed.message)).toBe(true);
  });

  it('catches the other C0 controls and unpaired surrogates', () => {
    expect(hasUnstorableText('a\u0001b')).toBe(true);
    expect(hasUnstorableText('a\u001fb')).toBe(true);
    expect(hasUnstorableText('a\ud800b')).toBe(true); // lone high surrogate
    expect(hasUnstorableText('a\udc00b')).toBe(true); // lone low surrogate
  });

  it('allows tab, newline and carriage return, which a textarea legitimately holds', () => {
    expect(hasUnstorableText('line one\nline two\ttabbed\r\n')).toBe(false);
  });

  it('allows a correctly paired surrogate, so emoji and non-BMP text survive', () => {
    expect(hasUnstorableText('a 😀 b')).toBe(false);
    expect(hasUnstorableText('مرحبا')).toBe(false);
  });

  it('finds a bad string nested inside a JSON/COMPONENT/BLOCK value', () => {
    // The reason the check walks: these types carry free-form nested strings.
    expect(hasUnstorableText({ blocks: [{ text: 'ok' }, { text: 'bad\u0000' }] })).toBe(true);
    expect(hasUnstorableText([[['deep\u0000']]])).toBe(true);
  });

  it('finds a bad object KEY, which is stored in the same column', () => {
    expect(hasUnstorableText({ 'bad\u0000key': 'fine' })).toBe(true);
  });

  it('passes a clean nested structure', () => {
    expect(hasUnstorableText({ a: [1, 'two', { b: 'three' }], c: null, d: true })).toBe(false);
  });

  it('ignores non-string leaves', () => {
    expect(hasUnstorableText(42)).toBe(false);
    expect(hasUnstorableText(null)).toBe(false);
    expect(hasUnstorableText(undefined)).toBe(false);
  });

  it('terminates on pathological nesting rather than blowing the stack', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 5000; i += 1) deep = [deep];

    expect(() => hasUnstorableText(deep)).not.toThrow();
  });

  it('exposes a stateless regex (no /g), so repeated tests do not alternate', () => {
    // A /g regex carries lastIndex between calls and would return false every
    // other time for the same input.
    expect(UNSTORABLE_TEXT.global).toBe(false);
    expect(UNSTORABLE_TEXT.test('a\u0000b')).toBe(true);
    expect(UNSTORABLE_TEXT.test('a\u0000b')).toBe(true);
  });
});
