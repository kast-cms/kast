// field-validators -> sanitize-rich-text.util -> isomorphic-dompurify pulls in an
// ESM-only transitive dep that ts-jest will not transform; mock it (same approach
// as sanitize-rich-text.util.spec.ts) so the module under test loads cleanly.
jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return { default: { sanitize }, sanitize };
});

import { ContentFieldType } from '@prisma/client';
import type { CompiledField } from './content-validation.types';
import { readFieldConfig } from './field-config';
import { coerceAndValidateField, isPresentValue } from './field-validators';

function field(
  type: ContentFieldType,
  config: Record<string, unknown> = {},
  over: Partial<CompiledField> = {},
): CompiledField {
  const parsed = readFieldConfig(config);
  return {
    name: 'f',
    displayName: 'F',
    type,
    required: false,
    unique: false,
    localized: false,
    hidden: false,
    defaultValue: undefined,
    config: parsed,
    pattern: parsed.regex !== undefined ? new RegExp(parsed.regex) : null,
    ...over,
  };
}

function accepts(f: CompiledField, value: unknown): unknown {
  const outcome = coerceAndValidateField(f, value);
  expect(outcome.issues).toEqual([]);
  return outcome.value;
}

function rejects(f: CompiledField, value: unknown, rule: string): void {
  const outcome = coerceAndValidateField(f, value);
  expect(outcome.issues.map((i) => i.rule)).toContain(rule);
}

describe('coerceAndValidateField', () => {
  describe('TEXT', () => {
    it('accepts and trims a string', () => {
      expect(accepts(field(ContentFieldType.TEXT), '  hello  ')).toBe('hello');
    });

    it('rejects a non-string without silently coercing a number', () => {
      rejects(field(ContentFieldType.TEXT), 42, 'type');
    });

    it('enforces minLength, maxLength and regex from config', () => {
      rejects(field(ContentFieldType.TEXT, { minLength: 3 }), 'ab', 'minLength');
      rejects(field(ContentFieldType.TEXT, { maxLength: 2 }), 'abc', 'maxLength');
      rejects(field(ContentFieldType.TEXT, { regex: '^[a-z]+$' }), 'ABC', 'regex');
      expect(accepts(field(ContentFieldType.TEXT, { regex: '^[a-z]+$' }), 'abc')).toBe('abc');
    });
  });

  describe('RICH_TEXT', () => {
    it('sanitizes an HTML string', () => {
      const out = accepts(field(ContentFieldType.RICH_TEXT), '<p>ok</p><script>alert(1)</script>');
      expect(out).toBe('<p>ok</p>');
    });

    it('accepts a TipTap document object', () => {
      const doc = { type: 'doc', content: [{ type: 'paragraph' }] };
      expect(accepts(field(ContentFieldType.RICH_TEXT), doc)).toEqual(doc);
    });

    it('rejects a document carrying a javascript: link', () => {
      rejects(
        field(ContentFieldType.RICH_TEXT),
        { type: 'doc', content: [{ type: 'a', attrs: { href: 'javascript:alert(1)' } }] },
        'unsafe_link',
      );
    });

    it('accepts relative and mailto links inside a document', () => {
      const doc = {
        content: [{ attrs: { href: '/about' } }, { attrs: { href: 'mailto:a@b.com' } }],
      };
      expect(accepts(field(ContentFieldType.RICH_TEXT), doc)).toEqual(doc);
    });

    it('rejects a number', () => {
      rejects(field(ContentFieldType.RICH_TEXT), 5, 'type');
    });
  });

  describe('NUMBER', () => {
    it('accepts a number and coerces a numeric string', () => {
      expect(accepts(field(ContentFieldType.NUMBER), 3)).toBe(3);
      expect(accepts(field(ContentFieldType.NUMBER), '3.5')).toBe(3.5);
    });

    it('rejects a non-numeric string', () => {
      rejects(field(ContentFieldType.NUMBER), '3 min', 'type');
    });

    it('enforces min, max and isInteger', () => {
      rejects(field(ContentFieldType.NUMBER, { min: 5 }), 4, 'min');
      rejects(field(ContentFieldType.NUMBER, { max: 5 }), 6, 'max');
      rejects(field(ContentFieldType.NUMBER, { isInteger: true }), 1.5, 'isInteger');
    });

    it('rejects Infinity', () => {
      rejects(field(ContentFieldType.NUMBER), Number.POSITIVE_INFINITY, 'type');
    });
  });

  describe('BOOLEAN', () => {
    it('accepts booleans and the string forms', () => {
      expect(accepts(field(ContentFieldType.BOOLEAN), true)).toBe(true);
      expect(accepts(field(ContentFieldType.BOOLEAN), 'false')).toBe(false);
    });

    it('rejects a number', () => {
      rejects(field(ContentFieldType.BOOLEAN), 1, 'type');
    });
  });

  describe('DATE', () => {
    it('accepts a date-only value and keeps it as written', () => {
      expect(accepts(field(ContentFieldType.DATE), '2026-08-10')).toBe('2026-08-10');
    });

    it('accepts a full ISO timestamp without truncating it', () => {
      expect(accepts(field(ContentFieldType.DATE), '2026-08-10T09:00:00.000Z')).toBe(
        '2026-08-10T09:00:00.000Z',
      );
    });

    it('accepts the datetime-local shape the admin emits', () => {
      expect(accepts(field(ContentFieldType.DATE), '2026-08-10T09:00')).toBe('2026-08-10T09:00');
    });

    it('rejects a free-text date', () => {
      rejects(field(ContentFieldType.DATE), '10 August 2026', 'format');
    });

    it('rejects an impossible calendar date', () => {
      rejects(field(ContentFieldType.DATE), '2026-02-31', 'format');
    });

    it('accepts a time when the variant says so', () => {
      expect(accepts(field(ContentFieldType.DATE, { variant: 'time' }), '09:30')).toBe('09:30');
      rejects(field(ContentFieldType.DATE, { variant: 'time' }), '2026-08-10', 'format');
    });
  });

  describe('DATETIME', () => {
    it('normalises to an ISO timestamp', () => {
      expect(accepts(field(ContentFieldType.DATETIME), '2026-08-10T09:00:00Z')).toBe(
        '2026-08-10T09:00:00.000Z',
      );
    });

    it('rejects nonsense', () => {
      rejects(field(ContentFieldType.DATETIME), 'not-a-date', 'format');
    });
  });

  describe('JSON', () => {
    it('accepts objects, arrays and scalars', () => {
      expect(accepts(field(ContentFieldType.JSON), ['a', 'b'])).toEqual(['a', 'b']);
      expect(accepts(field(ContentFieldType.JSON), { a: 1 })).toEqual({ a: 1 });
      expect(accepts(field(ContentFieldType.JSON), 7)).toBe(7);
    });

    it('parses a JSON string, as the admin textarea sends raw text', () => {
      expect(accepts(field(ContentFieldType.JSON), '{"a":1}')).toEqual({ a: 1 });
    });

    it('rejects an unparseable string', () => {
      rejects(field(ContentFieldType.JSON), '{oops', 'invalid_json');
    });

    it('rejects a structure nested past the depth cap', () => {
      let deep: unknown = 'leaf';
      for (let i = 0; i < 25; i++) deep = { deep };
      rejects(field(ContentFieldType.JSON), deep, 'json_too_deep');
    });
  });

  describe('SELECT / MULTI_SELECT', () => {
    it('accepts a configured choice and rejects an unknown one', () => {
      const f = field(ContentFieldType.SELECT, { values: ['a', 'b'] });
      expect(accepts(f, 'a')).toBe('a');
      rejects(f, 'c', 'choice');
    });

    it('reads choices from the options alias too', () => {
      expect(accepts(field(ContentFieldType.SELECT, { options: ['x'] }), 'x')).toBe('x');
    });

    it('dedupes and bounds a multi-select', () => {
      const f = field(ContentFieldType.MULTI_SELECT, { values: ['a', 'b'], maxItems: 1 });
      expect(accepts(field(ContentFieldType.MULTI_SELECT, { values: ['a'] }), ['a', 'a'])).toEqual([
        'a',
      ]);
      rejects(f, ['a', 'b'], 'maxItems');
      rejects(f, ['a', 'z'], 'choice');
      rejects(f, 'a', 'type');
    });
  });

  describe('COLOR', () => {
    it('accepts hex and rgb forms', () => {
      expect(accepts(field(ContentFieldType.COLOR), '#abc')).toBe('#abc');
      expect(accepts(field(ContentFieldType.COLOR), '#AABBCCDD')).toBe('#AABBCCDD');
      expect(accepts(field(ContentFieldType.COLOR), 'rgba(1, 2, 3, 0.5)')).toBe(
        'rgba(1, 2, 3, 0.5)',
      );
    });

    it('rejects a colour name', () => {
      rejects(field(ContentFieldType.COLOR), 'red', 'format');
    });
  });

  describe('URL', () => {
    it('accepts http and https', () => {
      expect(accepts(field(ContentFieldType.URL), 'https://example.com/a')).toBe(
        'https://example.com/a',
      );
    });

    it('rejects javascript: and data: URLs', () => {
      rejects(field(ContentFieldType.URL), 'javascript:alert(1)', 'scheme');
      rejects(field(ContentFieldType.URL), 'data:text/html,<b>x</b>', 'scheme');
    });

    it('rejects a relative path unless allowRelative is configured', () => {
      rejects(field(ContentFieldType.URL), '/about', 'format');
      expect(accepts(field(ContentFieldType.URL, { allowRelative: true }), '/about')).toBe(
        '/about',
      );
    });
  });

  describe('EMAIL', () => {
    it('accepts an address and lowercases the domain', () => {
      expect(accepts(field(ContentFieldType.EMAIL), 'Ann@Example.COM')).toBe('Ann@example.com');
    });

    it('rejects a malformed address', () => {
      rejects(field(ContentFieldType.EMAIL), 'nope@', 'format');
      rejects(field(ContentFieldType.EMAIL), `${'a'.repeat(300)}@b.com`, 'format');
    });
  });

  describe('MEDIA / RELATION', () => {
    it('reports the referenced ids for a batched existence check', () => {
      const single = coerceAndValidateField(field(ContentFieldType.MEDIA), 'm1');
      expect(single.mediaIds).toEqual(['m1']);
      const many = coerceAndValidateField(field(ContentFieldType.RELATION, { multiple: true }), [
        'e1',
        'e2',
        'e1',
      ]);
      expect(many.relationIds).toEqual(['e1', 'e2']);
    });

    it('rejects an array when the field is single-valued', () => {
      rejects(field(ContentFieldType.MEDIA), ['m1'], 'type');
      rejects(field(ContentFieldType.RELATION, { multiple: true }), 'e1', 'type');
    });
  });

  describe('COMPONENT / BLOCK (shape only)', () => {
    it('accepts an object component and an array of discriminated blocks', () => {
      expect(accepts(field(ContentFieldType.COMPONENT), { a: 1 })).toEqual({ a: 1 });
      expect(accepts(field(ContentFieldType.BLOCK), [{ type: 'hero' }])).toEqual([
        { type: 'hero' },
      ]);
    });

    it('rejects a block without a discriminator', () => {
      rejects(field(ContentFieldType.BLOCK), [{ a: 1 }], 'block_type');
      rejects(field(ContentFieldType.COMPONENT), [], 'type');
    });
  });
});

describe('isPresentValue', () => {
  it.each([
    [null, false],
    ['', false],
    ['  ', false],
    [[], false],
    [{}, false],
    [0, true],
    [false, true],
    ['x', true],
  ])('treats %p as present=%p', (value, expected) => {
    expect(isPresentValue(value)).toBe(expected);
  });
});
